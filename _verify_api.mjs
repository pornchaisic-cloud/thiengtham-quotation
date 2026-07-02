import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, ".env"), "utf-8");
const envVars = Object.fromEntries(
  envRaw.split("\n").filter(Boolean).map(l => {
    const [k, ...v] = l.split("=");
    return [k.trim(), v.join("=").trim()];
  })
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

async function check(step, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${step}: ${result}`);
    return result;
  } catch (e) {
    console.log(`❌ ${step}: ${e.message || e}`);
    return null;
  }
}

(async () => {
  console.log("=== ตรวจสอบ Supabase Project ===\n");

  // 1. สร้าง client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 2. ทดสอบ Anonymous Auth
  console.log("--- Auth ---");
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) {
    console.log(`❌ Anonymous sign-in ล้มเหลว: ${authError.message}`);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log(`✅ Anonymous Auth: สำเร็จ (user: ${userId.slice(0, 8)}...)`);

  // 3. ทดสอบ query quotes table
  console.log("\n--- quotes table ---");
  const { data: quotes, error: quotesErr } = await supabase.from("quotes").select("*").limit(1);
  if (quotesErr) {
    if (quotesErr.code === "42P01") console.log("❌ quotes: ตารางไม่มีอยู่");
    else if (quotesErr.code === "42501") console.log("❌ quotes: RLS ป้องกันการเข้าถึง (policy ไม่ถูกต้อง)");
    else console.log(`❌ quotes: ${quotesErr.message} (code: ${quotesErr.code})`);
  } else {
    console.log(`✅ quotes: query สำเร็จ (พบ ${quotes.length} แถว)`);
  }

  // 4. ทดสอบ insert quotes
  const testQuote = {
    id: `test-${Date.now()}`,
    user_id: userId,
    data: { test: true },
    updated_at: new Date().toISOString()
  };
  const { error: insertErr } = await supabase.from("quotes").insert(testQuote).select().single();
  if (insertErr) {
    if (insertErr.code === "42501") console.log("❌ quotes insert: RLS ป้องกัน");
    else console.log(`❌ quotes insert: ${insertErr.message} (code: ${insertErr.code})`);
  } else {
    console.log("✅ quotes insert: สำเร็จ");
    // cleanup
    await supabase.from("quotes").delete().eq("id", testQuote.id);
  }

  // 5. ทดสอบ price_db table
  console.log("\n--- price_db table ---");
  const { data: priceDb, error: priceDbErr } = await supabase.from("price_db").select("*").limit(1);
  if (priceDbErr) {
    if (priceDbErr.code === "42P01") console.log("❌ price_db: ตารางไม่มีอยู่");
    else if (priceDbErr.code === "42501") console.log("❌ price_db: RLS ป้องกันการเข้าถึง (policy ไม่ถูกต้อง)");
    else console.log(`❌ price_db: ${priceDbErr.message} (code: ${priceDbErr.code})`);
  } else {
    console.log(`✅ price_db: query สำเร็จ (พบ ${priceDb.length} แถว)`);
  }

  // 6. ทดสอบ upsert price_db
  const testPriceDb = {
    user_id: userId,
    data: { test: true },
    updated_at: new Date().toISOString()
  };
  const { error: upsertErr } = await supabase.from("price_db").upsert(testPriceDb).select().single();
  if (upsertErr) {
    if (upsertErr.code === "42501") console.log("❌ price_db upsert: RLS ป้องกัน");
    else console.log(`❌ price_db upsert: ${upsertErr.message} (code: ${upsertErr.code})`);
  } else {
    console.log("✅ price_db upsert: สำเร็จ");
    // cleanup
    await supabase.from("price_db").delete().eq("user_id", userId);
  }

  // 7. Sign out
  await supabase.auth.signOut();

  console.log("\n====================================");
  console.log("📋 สรุป");
  console.log("====================================");
})();
