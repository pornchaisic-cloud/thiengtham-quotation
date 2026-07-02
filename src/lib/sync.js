import { supabase } from "./supabase";

const SESSION_KEY = "tt_supabase_session";

export async function getOrCreateDevice() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      const { data, error } = await supabase.auth.setSession(JSON.parse(saved));
      if (!error && data.session) return data.session;
    } catch {}
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (data?.session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }));
  }
  return data.session;
}

export async function upsertQuote(q) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No session");
  const { error } = await supabase.from("quotes").upsert({
    id: q.id,
    user_id: user.id,
    data: q,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteQuote(id) {
  const { error } = await supabase.from("quotes").update({
    deleted_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function upsertPriceDb(meta) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No session");
  const { error } = await supabase.from("price_db").upsert({
    user_id: user.id,
    data: meta.data,
    updated_at: meta.updatedAt || new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

// ---- Offline pending queue ----
const PENDING_KEY = "tt_pending_sync";

export function getPendingCount() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]").length; } catch { return 0; }
}

export function addToPending(action, payload) {
  const queue = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  queue.push({ action, payload, ts: new Date().toISOString() });
  localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
}

export async function replayPending() {
  const queue = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  if (queue.length === 0) return;
  const remaining = [];
  for (const item of queue) {
    try {
      if (item.action === "upsertQuote") await upsertQuote(item.payload);
      else if (item.action === "deleteQuote") await deleteQuote(item.payload);
      else if (item.action === "upsertPriceDb") await upsertPriceDb(item.payload);
      else remaining.push(item);
    } catch (e) {
      console.warn("replay failed for", item.action, e);
      remaining.push(item);
    }
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
}

export function clearPending() {
  localStorage.removeItem(PENDING_KEY);
}

export async function pullAll() {
  const { data: quotesData, error: quotesError } = await supabase
    .from("quotes")
    .select("data, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (quotesError) throw quotesError;

  const { data: priceDbData, error: priceDbError } = await supabase
    .from("price_db")
    .select("data, updated_at")
    .single();
  if (priceDbError && priceDbError.code !== "PGRST116") throw priceDbError;

  return {
    quotes: (quotesData || []).map(r => ({ ...r.data, _updatedAt: r.updated_at })),
    priceDb: priceDbData
      ? { data: priceDbData.data, _updatedAt: priceDbData.updated_at }
      : null,
  };
}
