import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase, BUCKET_NAME } from "./lib/supabase";
import * as sync from "./lib/sync";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import Toast from "./components/Toast";
import ConnectionBanner from "./components/ConnectionBanner";
import Header from "./components/Header";
import KeySection from "./components/KeySection";
import TransferScreen from "./components/TransferScreen";
import PriceDbScreen from "./components/PriceDbScreen";
import ViewQuoteScreen from "./components/ViewQuoteScreen";
import { saveFileToDevice, shareFileNative, isNative, blobToBase64 } from "./utils/fileHelper";
import { COMPANY_INFO, COMPANY_LOGO, INITIAL_PRICE_DB, SCREENS, genId, formatMoney, today, thaiDateStr, getItemNumbers, ThaiBaht } from "./utils/helpers";
import { inputStyle, btnSm, btnKey, Label, SumRow } from "./utils/styles";
import { getUserApiKeys, getAllApiKeys, getAnthropicApiKeys, getOpenRouterKeys, OPENROUTER_BUILTIN_KEY } from "./utils/apiKeys";

// ---------------------------------------------------------------------------
// App — main orchestrator
// ---------------------------------------------------------------------------
export default function App() {
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [quotes, setQuotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tt_quotes") || "[]"); } catch { return []; }
  });
  const [priceDbMeta, setPriceDbMeta] = useState(() => {
    const raw = localStorage.getItem("tt_pricedb_meta");
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem("tt_pricedb");
    if (legacy) {
      const data = JSON.parse(legacy);
      localStorage.removeItem("tt_pricedb");
      return { updatedAt: "", data };
    }
    return { updatedAt: "", data: INITIAL_PRICE_DB };
  });
  const priceDb = priceDbMeta.data;
  const [activeQuote, setActiveQuote] = useState(null);
  const [toast, setToast] = useState(null);

  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => sync.getPendingCount());
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | error

  useEffect(() => { localStorage.setItem("tt_quotes", JSON.stringify(quotes)); }, [quotes]);
  useEffect(() => { localStorage.setItem("tt_pricedb_meta", JSON.stringify(priceDbMeta)); }, [priceDbMeta]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setSyncState("syncing");
      sync.replayPending()
        .then(() => { setPendingCount(sync.getPendingCount()); setSyncState("idle"); })
        .catch(e => { console.error("replayPending failed:", e); setSyncState("error"); });
    };
    const goOffline = () => { setOnline(false); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await sync.getOrCreateDevice();
        const cloud = await sync.pullAll();
        if (cloud.quotes?.length > 0) {
          setQuotes(prev => {
            const map = new Map(prev.map(q => [q.id, q]));
            let changed = false;
            for (const cq of cloud.quotes) {
              const local = map.get(cq.id);
              if (!local || (cq._updatedAt || '') > (local.updatedAt || '')) {
                map.set(cq.id, cq);
                changed = true;
              }
            }
            return changed ? [...map.values()] : prev;
          });
        }
        if (cloud.priceDb) {
          setPriceDbMeta(prev => {
            const ct = cloud.priceDb._updatedAt || '';
            if (ct > (prev.updatedAt || '')) return { updatedAt: ct, data: cloud.priceDb.data };
            return prev;
          });
        }
      } catch (e) {
        console.warn("cloud sync failed, using local data", e);
      }
    })();
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function saveQuote(q) {
    const now = new Date().toISOString();
    const qWithTime = { ...q, updatedAt: now };
    let prev = null;
    setQuotes(p => { prev = p; const idx = p.findIndex(x => x.id === q.id); if (idx >= 0) { const n = [...p]; n[idx] = qWithTime; return n; } return [qWithTime, ...p]; });
    if (!online) {
      sync.addToPending("upsertQuote", qWithTime);
      setPendingCount(sync.getPendingCount());
      showToast("📡 ออฟไลน์ — จะซิงค์เมื่อเชื่อมต่อ", "info");
      return;
    }
    try { await sync.upsertQuote(qWithTime); } catch (e) {
      console.error("save to cloud failed", e);
      if (prev) setQuotes(prev);
      showToast("บันทึก cloud ไม่สำเร็จ", "danger");
    }
  }

  async function deleteQuote(id) {
    let prev = null;
    setQuotes(p => { prev = p; return p.filter(x => x.id !== id); });
    if (!online) {
      sync.addToPending("deleteQuote", id);
      setPendingCount(sync.getPendingCount());
      showToast("📡 ออฟไลน์ — จะซิงค์เมื่อเชื่อมต่อ", "info");
      setScreen(SCREENS.QUOTES);
      return;
    }
    try { await sync.deleteQuote(id); showToast("ลบใบเสนอราคาแล้ว", "danger"); setScreen(SCREENS.QUOTES); } catch (e) {
      console.error("delete from cloud failed", e);
      if (prev) setQuotes(prev);
      showToast("ลบ cloud ไม่สำเร็จ", "danger");
    }
  }

  function handleSetPriceDb(updater) {
    let prevSnapshot = null;
    let newData = null;
    setPriceDbMeta(p => {
      prevSnapshot = p;
      newData = typeof updater === 'function' ? updater(p.data) : updater;
      return { updatedAt: new Date().toISOString(), data: newData };
    });
    if (!online) {
      sync.addToPending("upsertPriceDb", { data: newData, updatedAt: new Date().toISOString() });
      setPendingCount(sync.getPendingCount());
      return;
    }
    sync.upsertPriceDb({ data: newData, updatedAt: new Date().toISOString() }).catch(e => {
      console.error("priceDb sync fail", e);
      if (prevSnapshot) setPriceDbMeta(prevSnapshot);
      showToast("บันทึกฐานข้อมูลราคาไม่สำเร็จ", "danger");
    });
  }

  const navTo = (s, q = null) => { setActiveQuote(q); setScreen(s); };

  function handleRetrySync() {
    setSyncState("syncing");
    sync.replayPending()
      .then(() => { setPendingCount(sync.getPendingCount()); setSyncState("idle"); })
      .catch(e => { console.error("retry replayPending failed:", e); setSyncState("error"); });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif", width: "100%", maxWidth: "100%", position: "relative", overflowX: "hidden" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <ConnectionBanner online={online} pendingCount={pendingCount} syncState={syncState} onRetry={handleRetrySync} />
      {screen === SCREENS.HOME && <HomeScreen navTo={navTo} quotes={quotes} />}
      {screen === SCREENS.QUOTES && <QuoteListScreen quotes={quotes} navTo={navTo} deleteQuote={deleteQuote} />}
      {screen === SCREENS.NEW_QUOTE && <QuoteFormScreen navTo={navTo} priceDb={priceDb} saveQuote={saveQuote} quote={activeQuote} showToast={showToast} quotes={quotes} />}
      {screen === SCREENS.VIEW_QUOTE && activeQuote && <ViewQuoteScreen quote={activeQuote} navTo={navTo} deleteQuote={deleteQuote} showToast={showToast} />}
      {screen === SCREENS.PRICE_DB && <PriceDbScreen priceDb={priceDb} setPriceDb={handleSetPriceDb} showToast={showToast} navTo={navTo} />}
      {screen === SCREENS.AI_ANALYZE && <AIAnalyzeScreen navTo={navTo} priceDb={priceDb} setPriceDb={handleSetPriceDb} saveQuote={saveQuote} showToast={showToast} />}
      {screen === SCREENS.TRANSFER && <TransferScreen navTo={navTo} showToast={showToast} quotes={quotes} setQuotes={setQuotes} priceDbMeta={priceDbMeta} setPriceDbMeta={setPriceDbMeta} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------
function HomeScreen({ navTo, quotes }) {
  const [showSummary, setShowSummary] = useState(false);
  const currentLogo = localStorage.getItem("tt_company_logo") || COMPANY_LOGO;
  const stats = {
    total: quotes.length,
    thisMonth: quotes.filter(q => q.date && q.date.slice(0, 7) === today().slice(0, 7)).length,
    totalValue: quotes.reduce((s, q) => s + (q.grandTotal || 0), 0),
  };
  const projectSummary = Object.values(
    quotes.reduce((acc, q) => {
      const key = q.project || "ไม่ระบุโครงการ";
      if (!acc[key]) acc[key] = { project: key, count: 0, total: 0, quotes: [] };
      acc[key].count++;
      acc[key].total += q.grandTotal || 0;
      acc[key].quotes.push(q);
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {showSummary && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { setShowSummary(false); setSelectedProject(null); }} style={{ background: "none", border: "none", color: "#c8a96e", fontSize: 20, cursor: "pointer" }}>←</button>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e8e8e8" }}>{selectedProject ? selectedProject.project : "สรุปมูลค่าตามโครงการ"}</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {!selectedProject ? (
              <div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>กดเลือกโครงการเพื่อดูรายละเอียด</div>
                {projectSummary.map((ps, i) => (
                  <div key={i} onClick={() => setSelectedProject(ps)}
                    style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#c8a96e"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
                    <div><div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>🏗 {ps.project}</div><div style={{ fontSize: 11, color: "#555" }}>{ps.count} ใบเสนอราคา</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(ps.total)}</div><div style={{ fontSize: 10, color: "#444" }}>›</div></div>
                  </div>
                ))}
                <div style={{ background: "#111", border: "1px solid #2a2a1a", borderRadius: 10, padding: "14px", marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700, color: "#e8e8e8" }}>มูลค่ารวมทั้งหมด</span><span style={{ fontWeight: 700, fontSize: 18, color: "#c8a96e" }}>฿{formatMoney(stats.totalValue)}</span></div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: "#111", border: "1px solid #2a2a1a", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>มูลค่ารวมโครงการ</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(selectedProject.total)}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{selectedProject.count} ใบเสนอราคา</div>
                </div>
                {selectedProject.quotes.map(q => (
                  <div key={q.id} onClick={() => { setShowSummary(false); setSelectedProject(null); navTo(SCREENS.VIEW_QUOTE, q); }}
                    style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>{q.customerName || "ไม่ระบุลูกค้า"}</div><div style={{ fontSize: 11, color: "#555" }}>{q.quoteNo} · {thaiDateStr(q.date)}</div></div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(q.grandTotal)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ background: "linear-gradient(135deg,#111,#1a1a1a)", padding: "40px 20px 24px", borderBottom: "1px solid #222" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 60, height: 60, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "2px solid #c8a96e" }}>
            <img src={currentLogo} alt="logo" style={{ width: "90%", height: "90%", objectFit: "contain" }} onError={(e) => { e.target.src = COMPANY_LOGO; }} />
          </div>
          <div><div style={{ fontSize: 18, fontWeight: 700, color: "#e63030", letterSpacing: 0.5 }}>เที่ยงทำ ดีเวลล็อปเมนท์</div><div style={{ fontSize: 12, color: "#666" }}>ระบบใบเสนอราคา</div></div>
        </div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>{COMPANY_INFO.name} · โทร {COMPANY_INFO.phone}</div>
      </div>
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          <StatCard label="ทั้งหมด" value={stats.total + " ใบ"} color="#c8a96e" onClick={() => setShowSummary(true)} />
          <StatCard label="เดือนนี้" value={stats.thisMonth + " ใบ"} color="#5ab4f5" />
          <StatCard label="มูลค่ารวม" value={"฿" + (stats.totalValue / 1000).toFixed(0) + "K"} color="#5af5a0" onClick={() => setShowSummary(true)} />
        </div>
        <div style={{ marginBottom: 12, fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>เมนูหลัก</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MenuBtn icon="✨" label="วิเคราะห์ AI" sub="สร้างใบเสนอราคาอัตโนมัติ" color="#c8a96e" onClick={() => navTo(SCREENS.AI_ANALYZE)} />
          <MenuBtn icon="➕" label="สร้างใบเสนอราคา" sub="กรอกข้อมูลด้วยตนเอง" color="#5ab4f5" onClick={() => navTo(SCREENS.NEW_QUOTE)} />
          <MenuBtn icon="📂" label="ใบเสนอราคา" sub={stats.total + " รายการ"} color="#a06af5" onClick={() => navTo(SCREENS.QUOTES)} />
          <MenuBtn icon="💰" label="ฐานข้อมูลราคา" sub="จัดการราคางาน" color="#5af5a0" onClick={() => navTo(SCREENS.PRICE_DB)} />
        </div>
        <button onClick={() => navTo(SCREENS.TRANSFER)} style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", fontSize: 12, cursor: "pointer", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>📡 ย้ายข้อมูลไปเครื่องใหม่</button>
        {quotes.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>ล่าสุด</div>
            {quotes.slice(0, 3).map(q => (<RecentQuoteRow key={q.id} q={q} onClick={() => navTo(SCREENS.VIEW_QUOTE, q)} />))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 10px", textAlign: "center", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      {onClick && <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>แตะเพื่อดู</div>}
    </div>
  );
}

function MenuBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "16px 12px", textAlign: "left", cursor: "pointer", transition: "all 0.15s", width: "100%" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#555" }}>{sub}</div>
    </button>
  );
}

function RecentQuoteRow({ q, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>{q.customerName || "ไม่ระบุลูกค้า"}</div><div style={{ fontSize: 11, color: "#555" }}>{q.quoteNo} · {thaiDateStr(q.date)}</div></div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(q.grandTotal)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuoteListScreen
// ---------------------------------------------------------------------------
function QuoteListScreen({ quotes, navTo, deleteQuote }) {
  const [search, setSearch] = useState("");
  const filtered = quotes.filter(q =>
    !search || (q.customerName || "").includes(search) || (q.quoteNo || "").includes(search) || (q.project || "").includes(search)
  );
  return (
    <div style={{ minHeight: "100vh" }}>
      <Header title="ใบเสนอราคาทั้งหมด" onBack={() => navTo(SCREENS.HOME)} right={<button onClick={() => navTo(SCREENS.NEW_QUOTE)} style={btnSm("#c8a96e")}>+ สร้าง</button>} />
      <div style={{ padding: "12px 16px" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." style={inputStyle} />
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "#444", marginTop: 40, fontSize: 14 }}>ยังไม่มีใบเสนอราคา</div>}
        {filtered.map(q => (<QuoteCard key={q.id} q={q} onClick={() => navTo(SCREENS.VIEW_QUOTE, q)} onDelete={() => deleteQuote(q.id)} />))}
      </div>
    </div>
  );
}

function QuoteCard({ q, onClick, onDelete }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={onClick}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>{q.customerName || "ไม่ระบุลูกค้า"}</div>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{q.quoteNo} · {thaiDateStr(q.date)}</div>
          {q.project && <div style={{ fontSize: 11, color: "#888" }}>📍 {q.project}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(q.grandTotal)}</div>
          <div style={{ fontSize: 10, color: "#444" }}>{q.items?.length || 0} รายการ</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>
        <button onClick={onClick} style={btnSm("#5ab4f5", true)}>ดู/แก้ไข</button>
        <button onClick={onDelete} style={btnSm("#c8423a", true)}>ลบ</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuoteFormScreen
// ---------------------------------------------------------------------------
function QuoteFormScreen({ navTo, priceDb, saveQuote, quote, showToast, quotes }) {
  const isEdit = !!quote;

  const getNextQuoteNo = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    let maxSeq = 61;
    quotes.forEach(q => {
      const match = (q.quoteNo || "").match(/TT-QN-(\d+)-/);
      if (match) { const seq = parseInt(match[1]); if (seq > maxSeq) maxSeq = seq; }
    });
    const existingSeqs = new Set(quotes.map(q => { const m = (q.quoteNo || "").match(/TT-QN-(\d+)-/); return m ? parseInt(m[1]) : null; }).filter(s => s !== null));
    let nextSeq = maxSeq + 1;
    for (let i = 62; i <= maxSeq; i++) { if (!existingSeqs.has(i)) { nextSeq = i; break; } }
    return `TT-QN-${String(nextSeq).padStart(3, '0')}-${year}`;
  };

  const changeQuoteNo = (val) => {
    const parts = form.quoteNo.split("-");
    if (parts.length < 4) return;
    let seq = parseInt(parts[2]) + val;
    if (seq < 1) seq = 1;
    const newNo = `${parts[0]}-${parts[1]}-${String(seq).padStart(3, '0')}-${parts[3]}`;
    setForm(f => ({ ...f, quoteNo: newNo }));
  };

  const getDefaultInstallments = () => [
    { id: genId(), label: "ก่อนเริ่มงาน", pct: 50, amount: 0 },
    { id: genId(), label: "หลังส่งมอบงาน", pct: 50, amount: 0 },
  ];

  const [form, setForm] = useState(quote ? { ...quote, paymentInstallments: quote.paymentInstallments || getDefaultInstallments() } : {
    id: genId(), quoteNo: getNextQuoteNo(), customerName: "", address: "", phone: "", project: "",
    date: today(), validDays: 30, items: [], includeVat: true,
    discount: 0, overheadPct: 0, paymentTerms: "", remarks: "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
    logo: localStorage.getItem("tt_company_logo") || COMPANY_LOGO, signature: null,
    paymentInstallments: getDefaultInstallments(),
  });
  const [tab, setTab] = useState("info");
  const [dbSearch, setDbSearch] = useState("");

  const { subtotal, overhead, afterOverhead, discountAmt, vat, grandTotal } = useMemo(() => {
    const subtotal = form.items.reduce((s, i) => s + (i.type === "category" ? 0 : Number(i.qty) * Number(i.price)), 0);
    const overhead = subtotal * (Number(form.overheadPct) / 100);
    const afterOverhead = subtotal + overhead;
    const discountAmt = Number(form.discount) || 0;
    const beforeVat = afterOverhead - discountAmt;
    const vat = form.includeVat ? beforeVat * 0.07 : 0;
    const grandTotal = beforeVat + vat;
    return { subtotal, overhead, afterOverhead, discountAmt, vat, grandTotal };
  }, [form.items, form.overheadPct, form.discount, form.includeVat]);

  const addItem = useCallback((dbItem) => { setForm(f => ({ ...f, items: [...f.items, { id: genId(), name: dbItem.name, unit: dbItem.unit, qty: 1, price: dbItem.price, type: "item" }] })); }, []);
  const addBlankItem = useCallback(() => { setForm(f => ({ ...f, items: [...f.items, { id: genId(), name: "", unit: "งาน", qty: 1, price: 0, type: "item" }] })); }, []);
  const addCategory = useCallback(() => { setForm(f => ({ ...f, items: [...f.items, { id: genId(), name: "", type: "category" }] })); }, []);
  const updateItem = useCallback((id, k, v) => { setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) })); }, []);
  const removeItem = useCallback((id) => { setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) })); }, []);

  const installmentsTotalPct = useMemo(() =>
    (form.paymentInstallments || []).reduce((s, inst) => s + Number(inst.pct), 0),
    [form.paymentInstallments]
  );

  const addInstallment = () => {
    const n = (form.paymentInstallments || []).length + 1;
    setForm(f => ({ ...f, paymentInstallments: [...(f.paymentInstallments || []), { id: genId(), label: `งวดที่ ${n}`, pct: 0, amount: 0 }] }));
  };

  const updateInstallment = (id, k, v) => {
    setForm(f => ({ ...f, paymentInstallments: (f.paymentInstallments || []).map(inst =>
      inst.id === id ? { ...inst, [k]: v } : inst
    ) }));
  };

  const removeInstallment = (id) => {
    if ((form.paymentInstallments || []).length <= 1) return;
    setForm(f => ({ ...f, paymentInstallments: (f.paymentInstallments || []).filter(inst => inst.id !== id) }));
  };

  function handleSave() {
    const installments = (form.paymentInstallments || []).map(inst => ({
      ...inst, amount: grandTotal * (Number(inst.pct) / 100)
    }));
    const q = { ...form, subtotal, overhead, afterOverhead, discountAmt, vat, grandTotal, paymentInstallments: installments };
    saveQuote(q);
    showToast(isEdit ? "บันทึกการแก้ไขแล้ว" : "สร้างใบเสนอราคาแล้ว");
    navTo(SCREENS.VIEW_QUOTE, q);
  }

  const filteredDb = useMemo(() => priceDb.filter(p => !dbSearch || p.name.includes(dbSearch)), [priceDb, dbSearch]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header title={isEdit ? "แก้ไขใบเสนอราคา" : "สร้างใบเสนอราคา"} onBack={() => navTo(isEdit ? SCREENS.VIEW_QUOTE : SCREENS.HOME, quote)} right={<button onClick={handleSave} style={btnSm("#c8a96e")}>บันทึก</button>} />
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", background: "#0d0d0d" }}>
        {[["info", "ข้อมูล"], ["items", "รายการ"], ["summary", "สรุป"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "12px 0", background: "none", border: "none", color: tab === k ? "#c8a96e" : "#555", fontSize: 13, fontWeight: tab === k ? 600 : 400, borderBottom: tab === k ? "2px solid #c8a96e" : "2px solid transparent", cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      <div style={{ padding: "16px" }}>
        {tab === "info" && (
          <div>
            <div style={{ marginBottom: 20, padding: 16, background: "#111", borderRadius: 12, border: "1px solid #1a1a1a" }}>
              <Label>โลโก้บริษัท (หัวกระดาษ)</Label>
              <ImgUpload value={form.logo} onChange={v => { setForm(f => ({ ...f, logo: v })); if (v) localStorage.setItem("tt_company_logo", v); }} label="เปลี่ยนโลโก้หัวกระดาษ" />
              <div style={{ fontSize: 10, color: "#444" }}>รูปนี้จะปรากฏที่มุมซ้ายบนของใบเสนอราคา</div>
            </div>
            <Label>เลขที่ใบเสนอราคา</Label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={form.quoteNo} onChange={e => setForm(f => ({ ...f, quoteNo: e.target.value }))} />
              <button onClick={() => changeQuoteNo(-1)} style={btnKey}>-</button>
              <button onClick={() => changeQuoteNo(1)} style={btnKey}>+</button>
            </div>
            <Label>ชื่อลูกค้า</Label>
            <input style={inputStyle} value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="ชื่อ-นามสกุล" />
            <Label>ที่อยู่</Label>
            <textarea style={{ ...inputStyle, height: 60, resize: "none" }} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <Label>โทรศัพท์</Label>
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0xx-xxx-xxxx" />
            <Label>โครงการ / สถานที่</Label>
            <input style={inputStyle} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="ชื่อโครงการ / ห้อง" />
            <Label>วันที่เสนอราคา</Label>
            <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Label>หมายเหตุ</Label>
            <textarea style={{ ...inputStyle, height: 60, resize: "none" }} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            <div style={{ marginTop: 20 }}>
              <Label>ลายเซ็น</Label>
              <ImgUpload value={form.signature} onChange={v => setForm(f => ({ ...f, signature: v }))} label="อัพโหลดลายเซ็น" />
            </div>
          </div>
        )}
        {tab === "items" && (
          <div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>เลือกจากฐานข้อมูลราคา หรือเพิ่มรายการเอง</div>
            <input style={inputStyle} value={dbSearch} onChange={e => setDbSearch(e.target.value)} placeholder="ค้นหางาน..." />
            <div style={{ maxHeight: 200, overflowY: "auto", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a", marginBottom: 14 }}>
              {filteredDb.map(p => (
                <div key={p.id} onClick={() => addItem(p)} style={{ padding: "10px 12px", borderBottom: "1px solid #141414", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#151515"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div><div style={{ fontSize: 12, color: "#ccc" }}>{p.name}</div><div style={{ fontSize: 11, color: "#555" }}>{p.unit} · ฿{formatMoney(p.price)}</div></div>
                  <span style={{ color: "#c8a96e", fontSize: 18 }}>+</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={addBlankItem} style={{ ...btnSm("#555"), flex: 1, padding: "10px", borderRadius: 8, fontSize: 13 }}>+ เพิ่มรายการ</button>
              <button onClick={addCategory} style={{ ...btnSm("#c8a96e"), flex: 1, padding: "10px", borderRadius: 8, fontSize: 13 }}>+ เพิ่มหมวดหมู่</button>
            </div>
            {form.items.length === 0 && <div style={{ textAlign: "center", color: "#333", fontSize: 13, padding: "20px 0" }}>ยังไม่มีรายการ</div>}
            {(() => { const nums = getItemNumbers(form.items); return form.items.map((item, idx) => (<QuoteItemRow key={item.id} item={item} displayNo={nums[idx]} updateItem={updateItem} removeItem={removeItem} />)); })()}
          </div>
        )}
        {tab === "summary" && (
          <div>
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <SumRow label="รวมค่าแรง/วัสดุ" value={formatMoney(subtotal)} />
              <div style={{ margin: "10px 0" }}><Label>Overhead & Profit (%)</Label><input type="number" style={inputStyle} value={form.overheadPct} onChange={e => setForm(f => ({ ...f, overheadPct: Number(e.target.value) }))} placeholder="0" /></div>
              {overhead > 0 && <SumRow label="Overhead & Profit" value={formatMoney(overhead)} />}
              <div style={{ margin: "10px 0" }}><Label>ส่วนลด (บาท)</Label><input type="number" style={inputStyle} value={form.discount} onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))} placeholder="0" /></div>
              <div style={{ margin: "10px 0", display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="vat" checked={form.includeVat} onChange={e => setForm(f => ({ ...f, includeVat: e.target.checked }))} />
                <label htmlFor="vat" style={{ fontSize: 13, color: "#aaa" }}>รวมภาษีมูลค่าเพิ่ม 7%</label>
              </div>
              {form.includeVat && <SumRow label="VAT 7%" value={formatMoney(vat)} />}
              <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#e8e8e8" }}>ยอดรวมสุทธิ</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: "#c8a96e" }}>฿{formatMoney(grandTotal)}</span>
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Label>งวดการชำระเงิน (Installments)</Label>
              <div style={{ marginTop: 8 }}>
                {(form.paymentInstallments || []).map((inst, idx) => {
                  const instAmt = grandTotal * (Number(inst.pct) / 100);
                  return (
                    <div key={inst.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "#555", minWidth: 14 }}>{idx + 1}</span>
                      <input style={{ ...inputStyle, flex: 2 }} value={inst.label} onChange={e => updateInstallment(inst.id, "label", e.target.value)} placeholder="รายละเอียดงวด" />
                      <input type="number" style={{ ...inputStyle, width: 60 }} value={inst.pct} onChange={e => updateInstallment(inst.id, "pct", Number(e.target.value))} placeholder="%" />
                      <span style={{ fontSize: 11, color: "#c8a96e", minWidth: 70, textAlign: "right" }}>฿{formatMoney(instAmt)}</span>
                      <button onClick={() => removeInstallment(inst.id)} style={{ background: "none", border: "none", color: "#c8423a", cursor: "pointer", fontSize: 14, padding: 2 }}>✕</button>
                    </div>
                  );
                })}
              </div>
              {installmentsTotalPct !== 100 && (
                <div style={{ fontSize: 11, color: "#f5a05a", marginTop: 4, padding: "6px 8px", background: "#1a0e00", borderRadius: 6 }}>
                  ⚠ เปอร์เซ็นรวม {installmentsTotalPct}% ยังไม่เท่ากับ 100%
                </div>
              )}
              <button onClick={addInstallment} style={{ ...btnSm("#555"), width: "100%", padding: "8px", borderRadius: 8, fontSize: 12, marginTop: 6 }}>+ เพิ่มงวด</button>
            </div>

            <button onClick={handleSave} style={{ width: "100%", padding: 14, background: "#c8a96e", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 }}>💾 บันทึกใบเสนอราคา</button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteItemRow({ item, displayNo, updateItem, removeItem }) {
  if (item.type === "category") {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #c8a96e", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#c8a96e", fontWeight: 700, fontSize: 13, minWidth: 24 }}>{displayNo}</span>
        <input style={{ flex: 1, background: "transparent", border: "none", color: "#e8e8e8", fontSize: 13, fontWeight: 600, outline: "none" }} value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="ชื่อหมวดหมู่" />
        <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#c8423a", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
      </div>
    );
  }
  return (
    <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 11, color: "#555" }}>รายการ {displayNo}</span><button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#c8423a", cursor: "pointer", fontSize: 16 }}>✕</button></div>
      <input style={{ ...inputStyle, marginBottom: 6 }} value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="ชื่องาน" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <div><div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>จำนวน</div><input type="number" style={inputStyle} value={item.qty} onChange={e => updateItem(item.id, "qty", e.target.value)} /></div>
        <div><div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>หน่วย</div><input style={inputStyle} value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} /></div>
        <div><div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>ราคา/หน่วย</div><input type="number" style={inputStyle} value={item.price} onChange={e => updateItem(item.id, "price", e.target.value)} /></div>
      </div>
      <div style={{ textAlign: "right", marginTop: 6, fontSize: 12, color: "#c8a96e" }}>฿{formatMoney(Number(item.qty) * Number(item.price))}</div>
    </div>
  );
}

function ImgUpload({ value, onChange, label }) {
  const ref = useRef();
  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => onChange(ev.target.result);
    r.readAsDataURL(f);
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <input type="file" accept="image/*" ref={ref} onChange={handleFile} style={{ display: "none" }} />
      {value
        ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={value} alt="" style={{ width: 60, height: 40, objectFit: "contain", background: "#1a1a1a", borderRadius: 6, border: "1px solid #222" }} />
            <button onClick={() => onChange(null)} style={{ ...btnSm("#555"), fontSize: 11 }}>ลบ</button>
          </div>
        : <button onClick={() => ref.current.click()} style={{ ...btnSm("#333"), width: "100%", padding: "8px", borderRadius: 8, fontSize: 12 }}>📎 {label}</button>
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIAnalyzeScreen
// ---------------------------------------------------------------------------
function AIAnalyzeScreen({ navTo, priceDb, setPriceDb, saveQuote, showToast }) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");
  const [showKeyMgmt, setShowKeyMgmt] = useState(false);
  const [apiProvider, setApiProvider] = useState(() => localStorage.getItem("tt_api_provider") || "gemini");
  const fileRef = useRef();

  function resizeImage(dataUrl, maxPx = 1024) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach(f => {
      const r = new FileReader();
      r.onload = async ev => {
        const raw = ev.target.result;
        const isImage = f.type.startsWith("image/");
        const data = isImage ? await resizeImage(raw, 1024) : raw;
        const mediaType = isImage ? "image/jpeg" : (f.type || "application/octet-stream");
        setAttachments(prev => [...prev, { id: genId(), name: f.name, data, mediaType, isImage }]);
      };
      r.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function removeAttachment(id) { setAttachments(prev => prev.filter(a => a.id !== id)); }

  function getThaiErrorMessage(errMsg) {
    if (!errMsg) return "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่";
    if (errMsg.startsWith("⏳") || errMsg.startsWith("❌") || errMsg.startsWith("💳") || errMsg.startsWith("🌐") || errMsg.startsWith("⚠️")) return errMsg;
    const msg = errMsg.toLowerCase();
    if (msg.includes("rate_limit") || msg.includes("quota") || msg.includes("toomanyrequests") || msg.includes("too many requests")) return "⚠️ Rate limit — รอ 1 นาทีแล้วลองใหม่ หรือเพิ่ม Gemini API Key ใน 🔑";
    if (msg.includes("requires more credits") || msg.includes("insufficient credits") || msg.includes("balance") || msg.includes("payment")) return "💳 Key หมด Credit — กรุณาเติม credit ที่ openrouter.ai หรือเพิ่ม Key ใหม่";
    if (msg.includes("overloaded") || msg.includes("503") || msg.includes("resource_exhausted")) return "⏳ AI โหลดมาก — รอสักครู่แล้วลองใหม่";
    if (msg.includes("401") || msg.includes("403") || msg.includes("api_key") || msg.includes("invalid") || msg.includes("permission") || msg.includes("authentication") || msg.includes("unauthorized")) return "❌ API Key ไม่ถูกต้อง — กรุณาตรวจสอบ Key";
    if (msg.includes("400") || msg.includes("bad request")) return "❌ Request ผิดรูปแบบ — กรุณาลองใหม่ หรือเปลี่ยน Provider";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch")) return "🌐 ไม่มีอินเทอร์เน็ต กรุณาตรวจสอบแล้วลองใหม่";
    return "❗ " + errMsg.slice(0, 200);
  }

  async function callAnthropicAPI(systemPrompt, userText, imageAttachments) {
    const anthropicKeys = getAnthropicApiKeys();
    if (anthropicKeys.length === 0) throw new Error("ยังไม่มี Anthropic API Key กรุณาเพิ่มก่อนใช้งาน (รับฟรีที่ console.anthropic.com)");
    let lastError = null;
    for (let attempt = 0; attempt < anthropicKeys.length; attempt++) {
      const key = anthropicKeys[attempt];
      if (attempt > 0) { setProgress(`🔄 เปลี่ยน Anthropic Key (${attempt + 1}/${anthropicKeys.length})...`); await new Promise(r => setTimeout(r, 1500)); }
      const userContent = [];
      for (const att of imageAttachments) {
        if (att.isImage) {
          const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data;
          userContent.push({ type: "image", source: { type: "base64", media_type: att.mediaType || "image/jpeg", data: b64 } });
        }
      }
      userContent.push({ type: "text", text: userText || "วิเคราะห์จากรูปที่แนบ" });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          signal: controller.signal,
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, system: systemPrompt, messages: [{ role: "user", content: userContent }] })
        });
        clearTimeout(timeout);
        if (resp.ok) { const data = await resp.json(); return data.content?.[0]?.text || ""; }
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429 && attempt < anthropicKeys.length - 1) { lastError = new Error(errMsg); continue; }
        throw new Error(errMsg);
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === "AbortError") throw new Error("หมดเวลา กรุณาลองใหม่");
        lastError = e;
        if (attempt < anthropicKeys.length - 1) continue;
        throw e;
      }
    }
    throw lastError || new Error("Anthropic API ล้มเหลว");
  }

  async function callOpenRouterAPI(systemPrompt, userText, imageAttachments) {
    const keys = getOpenRouterKeys();
    if (keys.length === 0) throw new Error("ยังไม่มี OpenRouter API Key — กรุณาเพิ่มใน 🔑 จัดการ API Keys");
    let lastError = null;
    const orModels = ["google/gemini-2.5-flash", "google/gemini-2.0-flash", "google/gemini-2.0-flash-lite:free", "google/gemini-2.0-flash:free", "meta-llama/llama-3.1-8b-instruct:free"];
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[attempt];
      if (attempt > 0) { setProgress(`🔄 เปลี่ยน OpenRouter Key (${attempt + 1}/${keys.length})...`); await new Promise(r => setTimeout(r, 1500)); }
      const userContent = [];
      for (const att of imageAttachments) {
        if (att.isImage) { const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data; userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }); }
      }
      userContent.push({ type: "text", text: userText || "วิเคราะห์จากรูปที่แนบ" });
      for (let m = 0; m < orModels.length; m++) {
        const modelName = orModels[m];
        setProgress(`🤖 Gemini/Llama (OpenRouter) กำลังวิเคราะห์... [${modelName}]`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        try {
          const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "HTTP-Referer": "https://thiengtham.app", "X-Title": "TheingTham" },
            signal: controller.signal,
            body: JSON.stringify({ model: modelName, max_tokens: 1024, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }] })
          });
          clearTimeout(timeout);
          if (resp.ok) { const data = await resp.json(); return data.choices?.[0]?.message?.content || ""; }
          const errData = await resp.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${resp.status}`;
          if (resp.status === 401 || resp.status === 403) { lastError = new Error(`❌ API Key ไม่ถูกต้อง — ${errMsg}`); break; }
          lastError = new Error(errMsg);
        } catch (e) {
          clearTimeout(timeout);
          if (e.name === "AbortError") lastError = new Error("หมดเวลา กรุณาลองใหม่");
          else lastError = e;
        }
      }
    }
    throw lastError || new Error("OpenRouter API ล้มเหลว");
  }

  const priceDbCompact = priceDb.map(p => `${p.name}|${p.unit}|${p.price}`).join(";");
  const systemPromptBase = `ผู้ช่วยออกใบเสนอราคาก่อสร้าง ตอบ JSON เท่านั้น ห้ามมีข้อความอื่น
ราคางาน(ชื่อ|หน่วย|ราคา): ${priceDbCompact}
JSON format: {"customerName":"","address":"","project":"","items":[{"name":"","qty":1,"unit":"","price":0}],"remarks":"","overheadPct":0,"discount":0,"paymentTerms":"","newPriceItems":[{"name":"","unit":"","price":0}]}
newPriceItems=รายการใหม่ที่ไม่มีในฐานข้อมูล ใช้ราคาประมาณ`;

  async function analyze() {
    if (!input && attachments.length === 0) { showToast("กรุณาใส่ข้อความหรือแนบรูป", "danger"); return; }
    setLoading(true); setError(null); setResult(null); setProgress("🔍 กำลังเตรียมข้อมูล...");
    try {
      const imageAtts = attachments.filter(a => a.isImage);
      let textResult = "";
      if (apiProvider === "anthropic") {
        const aKeys = getAnthropicApiKeys();
        if (aKeys.length === 0) throw new Error("❌ ยังไม่มี Anthropic API Key — กรุณาเพิ่มใน 🔑 จัดการ API Keys ก่อนวิเคราะห์");
        setProgress("🤖 Claude AI กำลังวิเคราะห์...");
        textResult = await callAnthropicAPI(systemPromptBase, input || "วิเคราะห์จากรูปที่แนบ", imageAtts);
      } else if (apiProvider === "openrouter") {
        const orKeys = getOpenRouterKeys();
        if (orKeys.length === 0) throw new Error("❌ ยังไม่มี OpenRouter API Key — กรุณาเพิ่มใน 🔑 จัดการ API Keys ก่อนวิเคราะห์");
        setProgress("🤖 Gemini/Llama (OpenRouter) กำลังวิเคราะห์...");
        textResult = await callOpenRouterAPI(systemPromptBase, input || "วิเคราะห์จากรูปที่แนบ", imageAtts);
      } else {
        const contents = [];
        for (const att of imageAtts) { contents.push({ inlineData: { mimeType: "image/jpeg", data: att.data.split(",")[1] } }); }
        contents.push({ text: systemPromptBase + "\n\nข้อมูล: " + (input || "วิเคราะห์จากรูปที่แนบ") });
        const allKeys = getAllApiKeys();
        if (allKeys.length === 0) throw new Error("ยังไม่มี Gemini API Key — กรุณาเพิ่มใน 🔑 จัดการ API Keys");
        const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
        let geminiDone = false;
        let geminiError = null;
        outerLoop:
        for (let i = 0; i < allKeys.length; i++) {
          const key = allKeys[i];
          for (let m = 0; m < GEMINI_MODELS.length; m++) {
            const modelName = GEMINI_MODELS[m];
            setProgress(`🤖 Gemini กำลังวิเคราะห์...${allKeys.length > 1 ? ` (Key ${i+1}/${allKeys.length})` : ""} [${modelName}]`);
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 35000);
            let resp;
            try {
              resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
                body: JSON.stringify({ contents: [{ parts: contents }], generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 4096 } })
              });
              clearTimeout(t);
            } catch (e) { clearTimeout(t); geminiError = e.name === "AbortError" ? new Error("หมดเวลา กรุณาลองใหม่") : e; continue; }
            if (resp.ok) {
              setProgress("📋 กำลังประมวลผล...");
              const data = await resp.json();
              const parts = data.candidates?.[0]?.content?.parts || [];
              textResult = "";
              for (let p = parts.length - 1; p >= 0; p--) { if (parts[p].text && !parts[p].thought) { textResult = parts[p].text; break; } }
              if (!textResult && parts.length > 0) textResult = parts[parts.length - 1].text || "";
              if (textResult) { geminiDone = true; break outerLoop; }
              geminiError = new Error("Gemini ไม่ส่งข้อมูลกลับมา");
              continue;
            } else {
              const errData = await resp.json().catch(() => ({}));
              const errMsg = errData.error?.message || `HTTP ${resp.status}`;
              console.error(`Gemini Error on ${modelName}:`, errMsg);
              if (resp.status === 429) {
                if (!geminiError) geminiError = new Error("⚠️ Gemini ชน rate limit — กรุณารอ 1 นาทีแล้วลองใหม่ หรือเพิ่ม API Key ใน 🔑");
                if (i < allKeys.length - 1) { setProgress(`⚠️ Key ${i+1} ชน rate limit — ลอง Key ${i+2}...`); await new Promise(r => setTimeout(r, 500)); }
                break;
              } else if (resp.status === 401 || resp.status === 403 || errMsg.includes("key not valid") || errMsg.includes("API key")) {
                geminiError = new Error(`❌ API Key ไม่ถูกต้อง — ${errMsg}`);
                break;
              } else { if (!geminiError) geminiError = new Error(errMsg); }
            }
          }
        }
        if (!geminiDone) throw geminiError || new Error("Gemini ใช้ไม่ได้ — กรุณาตรวจสอบ Key ด้วยปุ่ม 🔍");
      }
      setProgress("📋 กำลังสร้างใบเสนอราคา...");
      textResult = textResult.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      let parsed = null;
      try { parsed = JSON.parse(textResult); } catch {
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error("AI Raw Response:", textResult.slice(0, 500)); throw new Error("AI ไม่ส่ง JSON กลับมา กรุณาลองใหม่"); }
        parsed = JSON.parse(jsonMatch[0]);
      }
      if (!parsed.items || !Array.isArray(parsed.items)) throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      setResult(parsed);
    } catch (e) {
      console.error("AI Analyze Error:", e);
      const msg = e?.message || String(e) || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("CORS") || msg.includes("Load failed")) {
        setError(apiProvider === "anthropic" ? "🌐 ไม่สามารถเชื่อมต่อ Anthropic API ได้ (อาจถูก CORS บล็อก)\n💡 แนะนำ: เปลี่ยนไปใช้ 🔵 Google Gemini แทน" : "🌐 ไม่มีอินเทอร์เน็ต หรือ API ถูกบล็อก — กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่");
      } else setError(getThaiErrorMessage(msg));
    }
    setLoading(false); setProgress("");
  }

  function createQuoteFromResult() {
    if (!result) return;
    if (result.newPriceItems?.length > 0) { setPriceDb(prev => [...prev, ...result.newPriceItems.map(p => ({ id: Date.now() + Math.random(), ...p, price: Number(p.price) }))]); }
    const q = {
      id: genId(), quoteNo: "TT-QN-" + String(Date.now()).slice(-6), customerName: result.customerName || "", address: result.address || "",
      phone: "", project: result.project || "", date: today(),
      items: (result.items || []).map(i => ({ ...i, id: genId() })),
      remarks: result.remarks || "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
      includeVat: true, discount: Number(result.discount) || 0, overheadPct: Number(result.overheadPct) || 0, paymentTerms: result.paymentTerms || "",
      paymentInstallments: [
        { id: genId(), label: "ก่อนเริ่มงาน", pct: 50, amount: 0 },
        { id: genId(), label: "หลังส่งมอบงาน", pct: 50, amount: 0 },
      ],
      attachments: attachments.map(a => ({ id: a.id, name: a.name, data: a.data, isImage: a.isImage, mediaType: a.mediaType })),
    };
    const subtotal = q.items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0);
    const overhead = subtotal * (Number(q.overheadPct) / 100);
    const afterOverhead = subtotal + overhead;
    const discountAmt = Number(q.discount) || 0;
    const vat = q.includeVat ? (afterOverhead - discountAmt) * 0.07 : 0;
    const grandTotal = (afterOverhead - discountAmt) + vat;
    q.subtotal = subtotal; q.overhead = overhead; q.afterOverhead = afterOverhead; q.discountAmt = discountAmt; q.vat = vat; q.grandTotal = grandTotal;
    saveQuote(q);
    showToast("สร้างใบเสนอราคาสำเร็จ");
    navTo(SCREENS.VIEW_QUOTE, q);
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header title="วิเคราะห์ AI" onBack={() => navTo(SCREENS.HOME)} />
      <div style={{ padding: "16px" }}>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>เลือก AI ที่ใช้วิเคราะห์</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "gemini", label: "🔵 Google Gemini", sub: "แนะนำ / ฟรี / ใส่ Key เอง" },
              { id: "openrouter", label: "⚡ Gemini/Llama (OpenRouter)", sub: "ใส่ Key เอง" },
              { id: "anthropic", label: "🟠 Claude (Direct)", sub: "ใส่ Key เอง" },
            ].map(p => (
              <button key={p.id} onClick={() => { setApiProvider(p.id); localStorage.setItem("tt_api_provider", p.id); }} style={{
                flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                background: apiProvider === p.id ? "#1a2a1a" : "#0d0d0d",
                border: `1px solid ${apiProvider === p.id ? "#5af5a0" : "#2a2a2a"}`,
                color: apiProvider === p.id ? "#5af5a0" : "#666",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{p.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10, lineHeight: 1.6 }}>✨ พิมพ์รายละเอียดงาน หรือแนบรูปถ่ายกระดาษจดงาน/ใบเสร็จ</div>
          <textarea style={{ ...inputStyle, height: 100, resize: "none" }} value={input} onChange={e => setInput(e.target.value)} placeholder="เช่น: แก้ไขผนังแตกร้าว 1 งาน, รื้อปูกระเบื้องยาง SPC 15 ตร.ม." />
          <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleFiles} style={{ display: "none" }} />
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {attachments.map(att => (
                <div key={att.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a2a" }}>
                  <img src={att.data} alt={att.name} style={{ width: 72, height: 64, objectFit: "cover", display: "block" }} />
                  <button onClick={() => removeAttachment(att.id)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.8)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ccc", fontSize: 13, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            🖼 เลือกรูปภาพ {attachments.length > 0 && <span style={{ background: "#c8a96e", color: "#000", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{attachments.length}</span>}
          </button>
          <button onClick={analyze} disabled={loading} style={{ width: "100%", padding: 14, background: loading ? "#222" : "#c8a96e", border: "none", borderRadius: 10, color: loading ? "#666" : "#000", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "⏳ กำลังวิเคราะห์..." : "✨ วิเคราะห์และสร้างใบเสนอราคา"}
          </button>
          {loading && progress && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, color: "#c8a96e", padding: "10px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a" }}>
              {progress}
              <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 4 }}>
                {[0,1,2].map(i => (<div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8a96e", animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`, opacity: 0.5 }} />))}
              </div>
            </div>
          )}
          <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>

          {apiProvider === "anthropic" && getAnthropicApiKeys().length === 0 && !loading && (
            <div style={{ marginTop: 8, color: "#f5a05a", fontSize: 12, padding: "10px 12px", background: "#1a0e00", borderRadius: 8, border: "1px solid #3a2200" }}>
              ⚠️ ยังไม่มี Anthropic API Key — กรุณาเพิ่มด้านล่างก่อนวิเคราะห์<br/><span style={{ color: "#888", fontSize: 11 }}>หรือเปลี่ยนไปใช้ 🔵 Google Gemini (ฟรี)</span>
            </div>
          )}
          {apiProvider === "openrouter" && getOpenRouterKeys().length === 0 && !loading && (
            <div style={{ marginTop: 8, color: "#9af55a", fontSize: 12, padding: "10px 12px", background: "#0a1a00", borderRadius: 8, border: "1px solid #2a3a00" }}>
              ⚠️ ยังไม่มี OpenRouter API Key — กรุณาเพิ่มด้านล่างก่อนวิเคราะห์<br/><span style={{ color: "#888", fontSize: 11 }}>รับ Key ฟรีที่ openrouter.ai หรือเปลี่ยนไปใช้ 🔵 Google Gemini</span>
            </div>
          )}
          {apiProvider === "gemini" && getUserApiKeys().length === 0 && !loading && (
            <div style={{ marginTop: 8, color: "#5ab4f5", fontSize: 12, padding: "10px 12px", background: "#001a2e", borderRadius: 8, border: "1px solid #003a5a" }}>
              ⚠️ ยังไม่มี Gemini API Key — กรุณาเพิ่มด้านล่างก่อนวิเคราะห์<br/><span style={{ color: "#888", fontSize: 11 }}>รับ Key ฟรีที่ aistudio.google.com</span>
            </div>
          )}

          {error && (<div style={{ marginTop: 8, color: "#f55a5a", fontSize: 12, padding: "8px 12px", background: "#1a0a0a", borderRadius: 8 }}>{error}</div>)}
        </div>

        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <button onClick={() => setShowKeyMgmt(v => !v)} style={{ background: "none", border: "none", color: "#c8a96e", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", textAlign: "left", padding: 0 }}>
            🔑 จัดการ API Keys {showKeyMgmt ? "▲" : "▼"}
          </button>
          {showKeyMgmt && (
            <div style={{ marginTop: 12 }}>
              <KeySection color="#9af55a" title="⚡ OpenRouter API Key (Gemini/Llama)" hint="รับที่ openrouter.ai" placeholder="sk-or-v1-..." storageKey="tt_openrouter_keys" showToast={showToast} />
              <KeySection color="#5ab4f5" title="🔵 Google Gemini API Key" hint="รับฟรีที่ aistudio.google.com" placeholder="AIzaSy..." storageKey="tt_api_keys" showToast={showToast} />
              <KeySection color="#f5a05a" title="🟠 Anthropic Claude API Key" hint="รับที่ console.anthropic.com" placeholder="sk-ant-..." storageKey="tt_anthropic_keys" showToast={showToast} />
            </div>
          )}
        </div>

        {result && (
          <div style={{ background: "#111", border: "1px solid #2a3a1a", borderRadius: 12, padding: 14 }}>
            <div style={{ color: "#5af5a0", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>✅ วิเคราะห์สำเร็จ</div>
            {result.customerName && <div style={{ fontSize: 13, color: "#ccc", marginBottom: 4 }}>👤 {result.customerName}</div>}
            {result.project && <div style={{ fontSize: 13, color: "#ccc", marginBottom: 8 }}>🏗 {result.project}</div>}
            <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>รายการที่วิเคราะห์ได้:</div>
            {(result.items || []).map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 4, padding: "4px 0", borderBottom: "1px solid #1a1a1a" }}>
                <span style={{ flex: 1, marginRight: 8 }}>{item.name} ({item.qty} {item.unit})</span>
                <span style={{ color: "#c8a96e", whiteSpace: "nowrap" }}>฿{formatMoney(Number(item.qty) * Number(item.price))}</span>
              </div>
            ))}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c8a96e", textAlign: "right", marginTop: 8 }}>รวม: ฿{formatMoney((result.items || []).reduce((s, i) => s + Number(i.qty) * Number(i.price), 0))}</div>
            {result.newPriceItems?.length > 0 && <div style={{ fontSize: 11, color: "#888", marginTop: 8, background: "#0d0d0d", padding: "8px 10px", borderRadius: 6 }}>💡 เพิ่มฐานข้อมูลราคาใหม่ {result.newPriceItems.length} รายการ</div>}
            <button onClick={createQuoteFromResult} style={{ width: "100%", padding: 12, background: "#5af5a0", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 12 }}>📋 สร้างเอกสารใบเสนอราคา</button>
          </div>
        )}
      </div>
    </div>
  );
}
