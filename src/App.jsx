import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { supabase, BUCKET_NAME } from "./lib/supabase";
import * as sync from "./lib/sync";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Helper: ตรวจสอบว่ารันบน native app (Android/iOS) หรือไม่
function isNative() {
  return Capacitor.isNativePlatform();
}

// Helper: แปลง Blob เป็น base64 string
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper สำหรับ Native: บันทึกไฟล์ลง Documents โดยตรง (ใช้กับปุ่ม "ดาวน์โหลด")
async function saveFileToDevice(blob, fileName, showToast) {
  try {
    const base64 = await blobToBase64(blob);
    // ลองเขียนที่ Documents ก่อน (Android 11+ อาจไปที่ app-private)
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Documents,
    });
    showToast("💾 บันทึกไฟล์สำเร็จ: " + fileName);
    return true;
  } catch (e) {
    console.error("Save to Documents failed, trying Share fallback:", e);
    // Fallback: ใช้ Share dialog ให้ผู้ใช้เลือก "บันทึกไปยังไฟล์" เอง
    await shareFileNative(blob, fileName, showToast);
    return true;
  }
}

// Helper สำหรับ Native: เรียกเมนูแชร์ (ใช้กับปุ่ม "เปิด")
async function shareFileNative(blob, fileName, showToast) {
  try {
    const base64 = await blobToBase64(blob);
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: fileName,
      url: savedFile.uri,
    });
    return true;
  } catch (e) {
    console.error("Share error:", e);
    showToast("❌ ไม่สามารถแชร์ไฟล์ได้: " + e.message, "danger");
    throw e;
  }
}


const COMPANY_INFO = {
  name: "นายพรชัย ชูพรม",
  address: "เลขที่ 10/15 ซ.1/3 หมู่ที่ 6 ถ.รัตนาธิเบศร์ ต.เสาธงหิน อ.บางใหญ่ จ.นนทบุรี 11140",
  phone: "062-069-8888",
  taxId: "1729900000000",
};

const COMPANY_LOGO = "/logo.png";

const INITIAL_PRICE_DB = [
  { id: 1, name: "แก้ไขผนังแตกร้าว ขูดรอยร้าวและเซาะร่อง V อุดรอยร้าวด้วย non-shrink", unit: "งาน", price: 4650 },
  { id: 2, name: "งานรื้อและปูกระเบื้องยาง SPC (รวมพื้นกระเบื้องยาง)", unit: "ตร.ม.", price: 850 },
  { id: 3, name: "งานทาสีผนังภายใน (สีเบเยอร์ คูล ภายใน กึ่งเงาหรือเทียบเท่า)", unit: "ตร.ม.", price: 580 },
  { id: 4, name: "งานโป้วขัดและทาสีระเบียงภายนอก", unit: "ตร.ม.", price: 620 },
  { id: 5, name: "รื้อและปูกระเบื้องพื้นห้องน้ำ (ไม่รวมกระเบื้อง)", unit: "ตร.ม.", price: 950 },
  { id: 6, name: "งานรื้อและติดตั้งสุขภัณฑ์", unit: "งาน", price: 2500 },
  { id: 7, name: "งานติดตั้งชุดน้ำดี (น้ำร้อนและน้ำเย็น)", unit: "งาน", price: 2000 },
  { id: 8, name: "งานทุบรื้ออ่างอาบน้ำ", unit: "งาน", price: 3000 },
  { id: 9, name: "งานรื้อและปูกระเบื้องผนังห้องน้ำ (ไม่รวมกระเบื้อง)", unit: "ตร.ม.", price: 980 },
  { id: 10, name: "งานรื้อและปูกระเบื้องบริเวณหน้าห้องน้ำ (ตู้เสื้อผ้า)", unit: "ตร.ม.", price: 950 },
  { id: 11, name: "งานยิง PU Sealant รอบหน้าต่างห้องนอน", unit: "งาน", price: 2400 },
  { id: 12, name: "งานทำกันซึมระเบียงภายนอก (ใต้คอมเพรสเซอร์แอร์)", unit: "งาน", price: 1800 },
  { id: 13, name: "งานเพิ่มไฟส่องสว่าง (ในห้องน้ำ)", unit: "งาน", price: 1500 },
  { id: 14, name: "งานเปลี่ยนหลอดไฟฝ้าเพดานเป็นดาวน์ไลท์", unit: "ชุด", price: 400 },
  { id: 15, name: "งานรื้อเคาน์เตอร์ครัว", unit: "งาน", price: 2200 },
  { id: 16, name: "งานรื้อและปูกระเบื้องบริเวณชุดครัว", unit: "ตร.ม.", price: 950 },
  { id: 17, name: "งานทาสีฝ้าเพดานทั้งห้อง", unit: "ตร.ม.", price: 350 },
  { id: 18, name: "ค่าเดินทาง", unit: "วัน", price: 500 },
  { id: 19, name: "งานโป้วและขัดผนังภายใน", unit: "งาน", price: 2470 },
  { id: 20, name: "งานรื้อและเปลี่ยนกระเบื้องผนังห้องน้ำ (เฉพาะจุด) (ไม่รวมกระเบื้อง)", unit: "งาน", price: 5980 },
  { id: 21, name: "งานแก้ไขฝ้าเพดาน (เฉพาะจุด)", unit: "งาน", price: 4850 },
];

const SCREENS = { HOME: "home", NEW_QUOTE: "new_quote", QUOTES: "quotes", VIEW_QUOTE: "view_quote", PRICE_DB: "price_db", AI_ANALYZE: "ai_analyze", TRANSFER: "transfer" };

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function formatMoney(n) { return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }
function thaiDateStr(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

function getItemNumbers(items) {
  const nums = []; let cat = 0, sub = 0, afterCat = false, seq = 0;
  for (const item of items || []) {
    if (item.type === "category") { cat++; nums.push(String(cat)); sub = 0; afterCat = true }
    else if (afterCat) { sub++; nums.push(cat + "." + sub) }
    else { seq++; nums.push(String(seq)) }
  }
  return nums;
}

// Helper: แปลงเงินบาทเป็นตัวอักษรไทย
function ThaiBaht(Number) {
  if (!Number && Number !== 0) return "";
  const n = Number.toString().replace(/[,]/g, "");
  if (isNaN(n)) return "";
  const numberText = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const unitText = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  let [intPart, decPart] = n.split(".");
  let res = "";
  if (parseInt(intPart) === 0) res = "ศูนย์";
  else {
    for (let i = 0; i < intPart.length; i++) {
      let digit = parseInt(intPart.charAt(i));
      let pos = intPart.length - 1 - i;
      if (digit !== 0) {
        if (pos % 6 === 1 && digit === 1) res += "เอ็ด"; // แก้ไขจุดนี้ถ้าต้องการ 'สิบ' แทน 'หนึ่งสิบ'
        else if (pos % 6 === 1 && digit === 2) res += "ยี่";
        else if (pos % 6 === 0 && digit === 1 && i > 0) res += "เอ็ด";
        else res += numberText[digit];
        res += unitText[pos % 6];
      }
      if (pos > 0 && pos % 6 === 0) res += "ล้าน";
    }
  }
  res += "บาท";
  if (!decPart || parseInt(decPart) === 0) res += "ถ้วน";
  else {
    if (decPart.length === 1) decPart += "0";
    for (let i = 0; i < 2; i++) {
      let digit = parseInt(decPart.charAt(i));
      let pos = 1 - i;
      if (digit !== 0) {
        if (pos === 0 && digit === 1 && i > 0) res += "เอ็ด";
        else if (pos === 1 && digit === 2) res += "ยี่";
        else if (pos === 1 && digit === 1) res += "สิบ";
        else {
          res += numberText[digit];
          if (pos === 1) res += "สิบ";
        }
      }
    }
    res += "สตางค์";
  }
  return res.replace("หนึ่งสิบ", "สิบ");
}



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

  useEffect(() => { localStorage.setItem("tt_quotes", JSON.stringify(quotes)); }, [quotes]);
  useEffect(() => { localStorage.setItem("tt_pricedb_meta", JSON.stringify(priceDbMeta)); }, [priceDbMeta]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      sync.replayPending().then(() => setPendingCount(sync.getPendingCount()));
    };
    const goOffline = () => setOnline(false);
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
            if (ct > (prev.updatedAt || '')) {
              return { updatedAt: ct, data: cloud.priceDb.data };
            }
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

  return (
    // FIX: เต็มหน้าจอ ไม่จำกัด maxWidth
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif", width: "100%", maxWidth: "100%", position: "relative", overflowX: "hidden" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <ConnectionBanner online={online} pendingCount={pendingCount} />
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

function ConnectionBanner({ online, pendingCount }) {
  if (online && pendingCount === 0) return null;
  const color = online ? "#1a3a5c" : "#5c3a1a";
  const icon = online ? "🔄" : "🟡";
  const text = online
    ? `ซิงค์ ${pendingCount} รายการ...`
    : `ออฟไลน์ — ทำงานปกติ จะซิงค์เมื่อเชื่อมต่อ`;
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 100, background: color, color: "#e8e8e8", padding: "6px 16px", fontSize: 12, textAlign: "center", fontWeight: 600 }}>
      {icon} {text}
    </div>
  );
}

function Toast({ msg, type }) {
  const colors = { success: "#1a5c2e", danger: "#5c1a1a", info: "#1a3a5c" };
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: colors[type] || colors.success, color: "#fff", padding: "10px 20px", borderRadius: 20, zIndex: 9999, fontSize: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
}

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
    // FIX: เต็มหน้าจอ
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {showSummary && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { setShowSummary(false); setSelectedProject(null); }} style={{ background: "none", border: "none", color: "#c8a96e", fontSize: 20, cursor: "pointer" }}>←</button>
            <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e8e8e8" }}>
              {selectedProject ? selectedProject.project : "สรุปมูลค่าตามโครงการ"}
            </div>
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
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>🏗 {ps.project}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{ps.count} ใบเสนอราคา</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(ps.total)}</div>
                      <div style={{ fontSize: 10, color: "#444" }}>›</div>
                    </div>
                  </div>
                ))}
                <div style={{ background: "#111", border: "1px solid #2a2a1a", borderRadius: 10, padding: "14px", marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: "#e8e8e8" }}>มูลค่ารวมทั้งหมด</span>
                    <span style={{ fontWeight: 700, fontSize: 18, color: "#c8a96e" }}>฿{formatMoney(stats.totalValue)}</span>
                  </div>
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
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>{q.customerName || "ไม่ระบุลูกค้า"}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{q.quoteNo} · {thaiDateStr(q.date)}</div>
                    </div>
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
            <img src={currentLogo} alt="logo" style={{ width: "90%", height: "90%", objectFit: "contain" }}
                 onError={(e) => { e.target.src = COMPANY_LOGO; }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e63030", letterSpacing: 0.5 }}>เที่ยงทำ ดีเวลลอปเม้นท์</div>
            <div style={{ fontSize: 12, color: "#666" }}>ระบบใบเสนอราคา</div>
          </div>
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

        <button onClick={() => navTo(SCREENS.TRANSFER)} style={{ width: "100%", padding: "10px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", fontSize: 12, cursor: "pointer", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📡 ย้ายข้อมูลไปเครื่องใหม่
        </button>

        {quotes.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>ล่าสุด</div>
            {quotes.slice(0, 3).map(q => (
              <RecentQuoteRow key={q.id} q={q} onClick={() => navTo(SCREENS.VIEW_QUOTE, q)} />
            ))}
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
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", marginBottom: 2 }}>{q.customerName || "ไม่ระบุลูกค้า"}</div>
        <div style={{ fontSize: 11, color: "#555" }}>{q.quoteNo} · {thaiDateStr(q.date)}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#c8a96e" }}>฿{formatMoney(q.grandTotal)}</div>
    </div>
  );
}

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
        {filtered.map(q => (
          <QuoteCard key={q.id} q={q} onClick={() => navTo(SCREENS.VIEW_QUOTE, q)} onDelete={() => deleteQuote(q.id)} />
        ))}
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

function QuoteFormScreen({ navTo, priceDb, saveQuote, quote, showToast, quotes }) {
  const isEdit = !!quote;

  // ฟังก์ชันหาเลขที่ใบเสนอราคาล่าสุดและรันต่อให้อัตโนมัติ
  const getNextQuoteNo = () => {
    const year = new Date().getFullYear().toString().slice(-2);

    // หาเลขลำดับ (XXX) ที่สูงที่สุดในบรรดาใบเสนอราคาที่มีอยู่
    let maxSeq = 61; // เริ่มที่ 61 เพื่อให้ใบแรกเป็น 62
    quotes.forEach(q => {
      const match = (q.quoteNo || "").match(/TT-QN-(\d+)-/);
      if (match) {
        const seq = parseInt(match[1]);
        if (seq > maxSeq) maxSeq = seq;
      }
    });

    // ตรวจสอบช่องว่างของเลขที่อาจถูกลบไป (Gap Filling)
    const existingSeqs = new Set(quotes.map(q => {
      const m = (q.quoteNo || "").match(/TT-QN-(\d+)-/);
      return m ? parseInt(m[1]) : null;
    }).filter(s => s !== null));

    let nextSeq = maxSeq + 1;
    for (let i = 62; i <= maxSeq; i++) {
      if (!existingSeqs.has(i)) {
        nextSeq = i;
        break;
      }
    }

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

  const [form, setForm] = useState(quote ? { ...quote } : {
    id: genId(),
    quoteNo: getNextQuoteNo(),
    customerName: "", address: "", phone: "", project: "",
    date: today(), validDays: 30, items: [], includeVat: true,
    discount: 0, overheadPct: 0, paymentTerms: "", remarks: "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
    logo: localStorage.getItem("tt_company_logo") || COMPANY_LOGO,
    signature: null,
  });
  const [tab, setTab] = useState("info");
  const [dbSearch, setDbSearch] = useState("");

  // FIX: คำนวณด้วย useMemo เพื่อความเร็ว ไม่ค้างหน้าขาว
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

  const addItem = useCallback((dbItem) => {
    setForm(f => ({ ...f, items: [...f.items, { id: genId(), name: dbItem.name, unit: dbItem.unit, qty: 1, price: dbItem.price, type: "item" }] }));
  }, []);

  const addBlankItem = useCallback(() => {
    setForm(f => ({ ...f, items: [...f.items, { id: genId(), name: "", unit: "งาน", qty: 1, price: 0, type: "item" }] }));
  }, []);

  const addCategory = useCallback(() => {
    setForm(f => ({ ...f, items: [...f.items, { id: genId(), name: "", type: "category" }] }));
  }, []);

  const updateItem = useCallback((id, k, v) => {
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }));
  }, []);

  const removeItem = useCallback((id) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  }, []);

  function handleSave() {
    const q = { ...form, subtotal, overhead, afterOverhead, discountAmt, vat, grandTotal };
    saveQuote(q);
    showToast(isEdit ? "บันทึกการแก้ไขแล้ว" : "สร้างใบเสนอราคาแล้ว");
    navTo(SCREENS.VIEW_QUOTE, q);
  }

  const filteredDb = useMemo(() => priceDb.filter(p => !dbSearch || p.name.includes(dbSearch)), [priceDb, dbSearch]);

  return (
    // FIX: เต็มหน้าจอ
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
              <ImgUpload
                value={form.logo}
                onChange={v => {
                  setForm(f => ({ ...f, logo: v }));
                  if (v) localStorage.setItem("tt_company_logo", v);
                }}
                label="เปลี่ยนโลโก้หัวกระดาษ"
              />
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
                  <div>
                    <div style={{ fontSize: 12, color: "#ccc" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{p.unit} · ฿{formatMoney(p.price)}</div>
                  </div>
                  <span style={{ color: "#c8a96e", fontSize: 18 }}>+</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={addBlankItem} style={{ ...btnSm("#555"), flex: 1, padding: "10px", borderRadius: 8, fontSize: 13 }}>+ เพิ่มรายการ</button>
              <button onClick={addCategory} style={{ ...btnSm("#c8a96e"), flex: 1, padding: "10px", borderRadius: 8, fontSize: 13 }}>+ เพิ่มหมวดหมู่</button>
            </div>

            {form.items.length === 0 && <div style={{ textAlign: "center", color: "#333", fontSize: 13, padding: "20px 0" }}>ยังไม่มีรายการ</div>}
            {(() => { const nums = getItemNumbers(form.items); return form.items.map((item, idx) => (
              <QuoteItemRow key={item.id} item={item} displayNo={nums[idx]} updateItem={updateItem} removeItem={removeItem} />
            )); })()}
          </div>
        )}

        {tab === "summary" && (
          <div>
            <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <SumRow label="รวมค่าแรง/วัสดุ" value={formatMoney(subtotal)} />
              <div style={{ margin: "10px 0" }}>
                <Label>Overhead & Profit (%)</Label>
                <input type="number" style={inputStyle} value={form.overheadPct} onChange={e => setForm(f => ({ ...f, overheadPct: e.target.value }))} placeholder="0" />
              </div>
              {overhead > 0 && <SumRow label="Overhead & Profit" value={formatMoney(overhead)} />}
              <div style={{ margin: "10px 0" }}>
                <Label>ส่วนลด (บาท)</Label>
                <input type="number" style={inputStyle} value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} placeholder="0" />
              </div>
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
            <Label>เงื่อนไขการชำระเงิน</Label>
            <textarea style={{ ...inputStyle, height: 60, resize: "none" }} value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="เช่น งวดที่ 1: 50% ก่อนเริ่มงาน..." />
            <button onClick={handleSave} style={{ width: "100%", padding: 14, background: "#c8a96e", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 }}>💾 บันทึกใบเสนอราคา</button>
          </div>
        )}
      </div>
    </div>
  );
}

const QuoteItemRow = ({ item, displayNo, updateItem, removeItem }) => {
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#555" }}>รายการ {displayNo}</span>
        <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#c8423a", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      <input style={{ ...inputStyle, marginBottom: 6 }} value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="ชื่องาน" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>จำนวน</div>
          <input type="number" style={inputStyle} value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>หน่วย</div>
          <input style={inputStyle} value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>ราคา/หน่วย</div>
          <input type="number" style={inputStyle} value={item.price} onChange={e => updateItem(item.id, "price", e.target.value)} />
        </div>
      </div>
      <div style={{ textAlign: "right", marginTop: 6, fontSize: 12, color: "#c8a96e" }}>฿{formatMoney(Number(item.qty) * Number(item.price))}</div>
    </div>
  );
};

function SumRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa", marginBottom: 4 }}>
      <span>{label}</span><span style={{ color: "#ccc" }}>฿{value}</span>
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

function ViewQuoteScreen({ quote, navTo, deleteQuote, showToast }) {
  const [lightbox, setLightbox] = useState(null);

  const imageAttachments = (quote.attachments || []).filter(a => a.isImage);
  const fileAttachments = (quote.attachments || []).filter(a => !a.isImage);

  // สร้าง Excel Blob (ใช้ร่วมกันทั้ง Download และ Open)
  async function buildExcelBlob() {
    const rows = [
      ["ใบเสนอราคา / QUOTATION"],
      ["", "เที่ยงทำ ดีเวลล็อปเมนท์"],
      ["", COMPANY_INFO.address],
      ["", "โทร: " + COMPANY_INFO.phone + " | เลขประจำตัวผู้เสียภาษี: " + COMPANY_INFO.taxId],
      [],
      ["เลขที่", quote.quoteNo, "", "", "วันที่", thaiDateStr(quote.date)],
      [],
      ["ชื่อลูกค้า", quote.customerName || "", "", "", "โทรศัพท์", quote.phone || ""],
      ["ที่อยู่", quote.address || ""],
      ["โครงการ", quote.project || ""],
      [],
      ["ลำดับ", "รายการ / DESCRIPTION", "จำนวน", "หน่วย", "หน่วยละ", "จำนวนเงิน (บาท)"],
      ...(() => { const nums = getItemNumbers(quote.items); return (quote.items || []).flatMap((item, i) =>
        item.type === "category"
          ? [[nums[i], item.name, "", "", "", ""]]
          : [[nums[i], item.name, Number(item.qty), item.unit, Number(item.price), Number(item.qty) * Number(item.price)]]
      ); })(),
      ["", "( " + ThaiBaht(quote.grandTotal) + " )", "", "", "รวมค่าแรง/วัสดุ", Number(quote.subtotal || 0)],
      ...(quote.overhead > 0 ? [["", "", "", "", `Overhead (${quote.overheadPct}%)`, Number(quote.overhead)]] : []),
      ...(quote.discountAmt > 0 ? [["", "", "", "", "ส่วนลด", -Number(quote.discountAmt)]] : []),
      ...(quote.vat > 0 ? [["", "", "", "", "ภาษีมูลค่าเพิ่ม 7%", Number(quote.vat)]] : []),
      ["", "", "", "", "ยอดรวมสุทธิ", Number(quote.grandTotal || 0)],
      [],
      ["หมายเหตุ:", quote.remarks || ""],
      ["เงื่อนไขการชำระเงิน:", quote.paymentTerms || ""],
      [],
      ["", "ลงชื่อ.........................................", "", "", "ลงชื่อ........................................."],
      ["", "ผู้รับข้อเสนอราคา", "", "", "ผู้เสนอราคา"],
      ["", "( " + (quote.customerName || ".........................................") + " )", "", "", "( " + COMPANY_INFO.name + " )"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 55 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ใบเสนอราคา");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const cleanProject = (quote.project || "ใบเสนอราคา").replace(/[<>:"/\\|?*]/g, "").trim();
    const filename = `${quote.quoteNo} ${cleanProject}.xlsx`;
    return { blob: new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename };
  }

  // ปุ่ม "ดาวน์โหลด Excel"
  async function handleExcelDownload() {
    try {
      showToast("⏳ กำลังเตรียมไฟล์ Excel...", "info");
      const { blob: excelBlob, filename } = await buildExcelBlob();

      if (isNative()) {
        await saveFileToDevice(excelBlob, filename, showToast);
      } else {
        const url = URL.createObjectURL(excelBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast("📥 ดาวน์โหลด Excel สำเร็จ ✅");
      }
    } catch (e) {
      showToast("ไม่สำเร็จ: " + e.message, "danger");
    }
  }

  // ปุ่ม "เปิด Excel" - ใช้แชร์เพื่อให้เลือกแอปเปิดจากเครื่อง
  async function handleExcelOpen() {
    try {
      const { blob: excelBlob, filename } = await buildExcelBlob();
      if (isNative()) {
        await shareFileNative(excelBlob, filename, showToast);
      } else {
        const url = URL.createObjectURL(excelBlob);
        window.open(url, "_blank");
      }
    } catch (e) {
      showToast("ไม่สามารถเปิดไฟล์ได้: " + e.message, "danger");
    }
  }

  // สร้าง PDF Blob (ใช้ร่วมกันทั้ง Download และ Open)
  async function buildPdfBlob() {

    const items = (() => { const nums = getItemNumbers(quote.items); return (quote.items || []).map((item, i) =>
      item.type === "category"
        ? `<tr style="background:#f2f2f2"><td style="border:1px solid #000;padding:6px;font-size:11px;font-weight:700;text-align:center">${nums[i]}</td><td style="border:1px solid #000;padding:6px;font-size:11px;font-weight:700" colspan="5">${item.name}</td></tr>`
        : `<tr>
        <td style="text-align:center;border:1px solid #000;padding:6px;font-size:11px">${nums[i]}</td>
        <td style="border:1px solid #000;padding:6px;font-size:11px">${item.name}</td>
        <td style="text-align:center;border:1px solid #000;padding:6px;font-size:11px">${item.qty}</td>
        <td style="text-align:center;border:1px solid #000;padding:6px;font-size:11px">${item.unit}</td>
        <td style="text-align:right;border:1px solid #000;padding:6px;font-size:11px">${formatMoney(item.price)}</td>
        <td style="text-align:right;border:1px solid #000;padding:6px;font-size:11px;font-weight:600">${formatMoney(Number(item.qty)*Number(item.price))}</td>
      </tr>`
    ).join(""); })();

    const logoHtml = quote.logo
      ? `<img src="${quote.logo}" style="height:60px;object-fit:contain" crossorigin="anonymous">`
      : `<div style="width:60px;height:60px;background:#c8a96e;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:700;font-size:14px">TT</div>`;

    const sigHtml = quote.signature ? `<img src="${quote.signature}" style="height:45px;object-fit:contain;margin-bottom:-10px"><br>` : "";

    const sumRows = [
      ["รวมค่าแรงและค่าวัสดุ / SUBTOTAL", formatMoney(quote.subtotal)],
      ...(quote.overhead > 0 ? [[`ภาษีและดำเนินการ (${quote.overheadPct}%)`, formatMoney(quote.overhead)]] : []),
      ...(quote.discountAmt > 0 ? [["ส่วนลด / DISCOUNT", "-"+formatMoney(quote.discountAmt)]] : []),
      ...(quote.vat > 0 ? [["ภาษีมูลค่าเพิ่ม / VAT 7%", formatMoney(quote.vat)]] : []),
    ].map(([l,v]) => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px">
        <span style="font-weight:600">${l}</span>
        <span style="border-bottom:1px solid #000; min-width:80px; text-align:right">฿${v}</span>
      </div>`).join("");

    const html = `<div id="__pdf_root" style="width:720px; background:#fff; padding:30px 40px; font-family:'Sarabun', sans-serif; color:#000; box-sizing:border-box">
  <!-- Header Info -->
  <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:flex-start">
    <div style="display:flex; gap:15px; flex:1">
      ${logoHtml}
      <div style="flex:1">
        <div style="font-weight:700; font-size:16px; color:#c8000a">เที่ยงทำ ดีเวลล็อปเมนท์</div>
        <div style="font-size:10px; line-height:1.4">
          ${COMPANY_INFO.address}<br>
          โทร: ${COMPANY_INFO.phone} | เลขประจำตัวผู้เสียภาษี: ${COMPANY_INFO.taxId}
        </div>
      </div>
    </div>
    <div style="text-align:right; width:180px">
      <div style="font-size:20px; font-weight:700; margin-bottom:2px">ใบเสนอราคา</div>
      <div style="font-size:12px; font-weight:700; color:#666">QUOTATION</div>
      <div style="font-size:10px; margin-top:8px"><b>เลขที่ / NO:</b> ${quote.quoteNo}</div>
      <div style="font-size:10px"><b>วันที่ / DATE:</b> ${thaiDateStr(quote.date)}</div>
    </div>
  </div>

  <!-- Customer Block -->
  <div style="border:1px solid #000; padding:12px; margin-bottom:15px; font-size:11px; line-height:1.7">
    <div style="display:flex; margin-bottom:4px">
      <div style="width:100px"><b>ชื่อลูกค้า:</b></div>
      <div style="flex:1; border-bottom:1px dotted #000">${quote.customerName || ""}</div>
      <div style="width:60px; text-align:right; padding-right:8px"><b>โทรศัพท์:</b></div>
      <div style="width:130px; border-bottom:1px dotted #000">${quote.phone || ""}</div>
    </div>
    <div style="display:flex; margin-bottom:4px">
      <div style="width:100px"><b>ที่อยู่:</b></div>
      <div style="flex:1; border-bottom:1px dotted #000">${quote.address || ""}</div>
    </div>
    <div style="display:flex">
      <div style="width:100px"><b>โครงการ / สถานที่:</b></div>
      <div style="flex:1; border-bottom:1px dotted #000">${quote.project || ""}</div>
    </div>
  </div>

  <!-- Table Section -->
  <table style="width:100%; border-collapse:collapse; margin-bottom:8px; border:1px solid #000">
    <thead>
      <tr style="background:#f2f2f2">
        <th style="border:1px solid #000; padding:6px; font-size:10px; width:7%">ลำดับ</th>
        <th style="border:1px solid #000; padding:6px; font-size:10px; text-align:left">รายการ / DESCRIPTION</th>
        <th style="border:1px solid #000; padding:6px; font-size:10px; width:10%">จำนวน</th>
        <th style="border:1px solid #000; padding:6px; font-size:10px; width:10%">หน่วย</th>
        <th style="border:1px solid #000; padding:6px; font-size:10px; width:13%">หน่วยละ</th>
        <th style="border:1px solid #000; padding:6px; font-size:10px; width:17%">จำนวนเงิน (บาท)</th>
      </tr>
    </thead>
    <tbody>
      ${items}
      ${Array(Math.max(0, 12 - (quote.items?.length || 0))).fill(0).map(() => `<tr><td style="border-left:1px solid #000; border-right:1px solid #000; height:24px"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr style="border-top:1px solid #000">
        <td colspan="4" style="padding:8px; font-size:10px; vertical-align:top; border-right:1px solid #000">
          <div style="background:#eee; padding:4px; margin-bottom:8px"><b>ตัวอักษร:</b> ( ${ThaiBaht(quote.grandTotal)} )</div>
          <b>หมายเหตุ:</b> ${quote.remarks || "-"}<br>
          <b>เงื่อนไขการชำระเงิน:</b> ${quote.paymentTerms || "-"}
        </td>
        <td colspan="2" style="padding:0; vertical-align:top">
          <table style="width:100%; border-collapse:collapse; font-size:10px">
            <tr>
              <td style="padding:4px; text-align:right">รวมเงิน:</td>
              <td style="padding:4px; text-align:right; width:90px">${formatMoney(quote.subtotal)}</td>
            </tr>
            ${quote.vat > 0 ? `<tr><td style="padding:4px; text-align:right">ภาษีมูลค่าเพิ่ม 7%:</td><td style="padding:4px; text-align:right">${formatMoney(quote.vat)}</td></tr>` : ""}
            <tr style="background:#f2f2f2; font-weight:700; font-size:11px; border-top:1px solid #000">
              <td style="padding:6px; text-align:right">ยอดรวมสุทธิ:</td>
              <td style="padding:6px; text-align:right">฿${formatMoney(quote.grandTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- Signature -->
  <div style="display:flex; justify-content:space-between; margin-top:40px; font-size:10px">
    <div style="text-align:center; width:45%">
       <div style="margin-bottom:45px">ลงชื่อ............................................................</div>
       <div>ผู้รับข้อเสนอราคา</div>
       <div style="margin-top:5px">( ${quote.customerName || "........................................."} )</div>
    </div>
    <div style="text-align:center; width:45%">
       <div style="margin-bottom:5px; height:40px">${sigHtml}</div>
       <div style="margin-bottom:5px">ลงชื่อ............................................................</div>
       <div>ผู้เสนอราคา</div>
       <div style="margin-top:5px">( ${COMPANY_INFO.name} )</div>
    </div>
  </div>
</div>`;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;background:#fff";
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
    const el = wrapper.querySelector("#__pdf_root");
    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: "#ffffff", logging: false,
      width: 740, windowWidth: 740,
    });
    document.body.removeChild(wrapper);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdfW = 210;
    const pdfH = Math.min((canvas.height / canvas.width) * pdfW, 297);
    pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);

    const cleanProject = (quote.project || "ใบเสนอราคา").replace(/[<>:"/\\|?*]/g, "").trim();
    const filename = `${quote.quoteNo} ${cleanProject}.pdf`;

    return { blob: pdf.output("blob"), filename };
  }

  // ปุ่ม "ดาวน์โหลด PDF"
  async function handlePdfDownload() {
    try {
      showToast("⏳ กำลังเตรียมไฟล์ PDF...", "info");
      const { blob: pdfBlob, filename } = await buildPdfBlob();

      if (isNative()) {
        await saveFileToDevice(pdfBlob, filename, showToast);
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast("📥 ดาวน์โหลด PDF สำเร็จ ✅");
      }
    } catch(err) {
      showToast("ไม่สำเร็จ: " + err.message, "danger");
    }
  }

  // ปุ่ม "เปิด PDF" - ใช้แชร์เพื่อให้เลือกแอปเปิด
  async function handlePdfOpen() {
    try {
      const { blob: pdfBlob, filename } = await buildPdfBlob();
      if (isNative()) {
        await shareFileNative(pdfBlob, filename, showToast);
      } else {
        const url = URL.createObjectURL(pdfBlob);
        window.open(url, "_blank");
      }
    } catch (e) {
      showToast("ไม่สามารถเปิดไฟล์ได้: " + e.message, "danger");
    }
  }

  const handleDelete = () => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบใบเสนอราคานี้? ข้อมูลจะไม่สามารถกู้คืนได้")) {
      deleteQuote(quote.id);
    }
  };


  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 10 }}>
            <button onClick={() => setLightbox(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 50, width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <img src={lightbox.data} alt={lightbox.name}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 4px 40px rgba(0,0,0,0.8)" }} />
          <div style={{ marginTop: 12, fontSize: 12, color: "#888" }}>{lightbox.name}</div>
        </div>
      )}

      <Header title="รายละเอียดใบเสนอราคา" onBack={() => navTo(SCREENS.QUOTES)}
        right={<button onClick={() => navTo(SCREENS.NEW_QUOTE, quote)} style={btnSm("#5ab4f5")}>แก้ไข</button>} />

      <div style={{ padding: "16px" }}>
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          {quote.logo && <img src={quote.logo} alt="logo" style={{ height: 40, objectFit: "contain", marginBottom: 10 }} />}
          <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>เลขที่: {quote.quoteNo}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8a96e", marginBottom: 4 }}>{quote.customerName || "ไม่ระบุลูกค้า"}</div>
          {quote.address && <div style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>📍 {quote.address}</div>}
          {quote.phone && <div style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>📞 {quote.phone}</div>}
          {quote.project && <div style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>🏗 {quote.project}</div>}
          <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>วันที่: {thaiDateStr(quote.date)}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>รายการงาน</div>
          {(() => { const nums = getItemNumbers(quote.items); return (quote.items || []).map((item, i) => (
            item.type === "category" ? (
              <div key={item.id || i} style={{ background: "#1a1a1a", border: "1px solid #c8a96e", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#c8a96e" }}>{nums[i]} {item.name}</div>
              </div>
            ) : (
              <div key={item.id || i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <div style={{ fontSize: 12, color: "#ddd" }}>{nums[i]}. {item.name}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{item.qty} {item.unit} × ฿{formatMoney(item.price)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#c8a96e", whiteSpace: "nowrap" }}>฿{formatMoney(Number(item.qty) * Number(item.price))}</div>
                </div>
              </div>
            )
          )); })()}
        </div>

        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <SumRow label="รวมค่าแรง/วัสดุ" value={formatMoney(quote.subtotal)} />
          {quote.overhead > 0 && <SumRow label={`Overhead (${quote.overheadPct}%)`} value={formatMoney(quote.overhead)} />}
          {quote.discountAmt > 0 && <SumRow label="ส่วนลด" value={"-" + formatMoney(quote.discountAmt)} />}
          {quote.vat > 0 && <SumRow label="VAT 7%" value={formatMoney(quote.vat)} />}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e1e1e", paddingTop: 10, marginTop: 10 }}>
            <span style={{ fontWeight: 700, color: "#e8e8e8" }}>ยอดรวมสุทธิ</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: "#c8a96e" }}>฿{formatMoney(quote.grandTotal)}</span>
          </div>
        </div>

        {quote.remarks && <div style={{ fontSize: 12, color: "#666", marginBottom: 12, background: "#0d0d0d", padding: "10px 12px", borderRadius: 8, border: "1px solid #1a1a1a" }}>📝 {quote.remarks}</div>}
        {quote.paymentTerms && <div style={{ fontSize: 12, color: "#666", marginBottom: 16, background: "#0d0d0d", padding: "10px 12px", borderRadius: 8, border: "1px solid #1a1a1a" }}>💳 {quote.paymentTerms}</div>}

        {(imageAttachments.length > 0 || fileAttachments.length > 0) && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>📎 ไฟล์แนบ ({(quote.attachments || []).length})</div>
            {imageAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {imageAttachments.map((att, idx) => (
                  <div key={att.id} onClick={() => setLightbox({ ...att, index: idx })}
                    style={{ position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a2a", flexShrink: 0 }}>
                    <img src={att.data} alt={att.name} style={{ width: 80, height: 72, objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>ส่งออกเป็น</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <button onClick={handleExcelDownload} style={{ padding: "12px 8px", background: "#1a2e1a", border: "1px solid #2a4a2a", borderRadius: 10, color: "#5af5a0", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📥 ดาวน์โหลด Excel</button>
          <button onClick={handleExcelOpen} style={{ padding: "12px 8px", background: "#1a2e1a", border: "1px solid #2a4a2a", borderRadius: 10, color: "#a0ffc8", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📂 เปิด Excel</button>
          <button onClick={handlePdfDownload} style={{ padding: "12px 8px", background: "#2e1a1a", border: "1px solid #4a2a2a", borderRadius: 10, color: "#f55a5a", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📥 ดาวน์โหลด PDF</button>
          <button onClick={handlePdfOpen} style={{ padding: "12px 8px", background: "#2e1a1a", border: "1px solid #4a2a2a", borderRadius: 10, color: "#ffaaaa", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>📂 เปิด PDF</button>
        </div>
        <button onClick={handleDelete} style={{ width: "100%", padding: 12, background: "none", border: "1px solid #2a1a1a", borderRadius: 10, color: "#c8423a", cursor: "pointer", fontSize: 13 }}>🗑 ลบใบเสนอราคานี้</button>
      </div>
    </div>
  );
}

function PriceDbScreen({ priceDb, setPriceDb, showToast, navTo }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", unit: "งาน", price: "" });
  const [importing, setImporting] = useState(false);
  const xlsxRef = useRef();

  const filtered = useMemo(() => priceDb.filter(p => !search || p.name.includes(search)), [priceDb, search]);

  async function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    e.target.value = "";
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // แปลงเป็น array of arrays (raw)
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      const imported = [];
      // ตรวจหัวตาราง — ถ้าแถวแรกไม่ใช่ตัวเลขในคอลัมน์ราคา ให้ข้าม
      let startRow = 0;
      if (rows.length > 0) {
        const firstPrice = rows[0][2];
        if (isNaN(Number(firstPrice)) || String(firstPrice).trim() === "") startRow = 1;
      }

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[0] ?? "").trim();
        const unit = String(row[1] ?? "งาน").trim() || "งาน";
        const price = Number(row[2]);
        if (name && !isNaN(price) && price > 0) {
          imported.push({ id: Date.now() + Math.random(), name, unit, price });
        }
      }

      if (imported.length === 0) {
        showToast("ไม่พบข้อมูล — คอลัมน์ต้องเป็น: ชื่องาน | หน่วย | ราคา", "danger");
      } else {
        setPriceDb(prev => {
          const existing = new Set(prev.map(p => p.name));
          const newOnes = imported.filter(p => !existing.has(p.name));
          showToast(`นำเข้า ${newOnes.length} รายการใหม่ (ข้าม ${imported.length - newOnes.length} ซ้ำ)`);
          return [...prev, ...newOnes];
        });
      }
    } catch (err) {
      showToast("อ่านไฟล์ไม่สำเร็จ: " + err.message, "danger");
    }
    setImporting(false);
  }

  function handleAdd() {
    if (!form.name || !form.price) { showToast("กรุณากรอกข้อมูลให้ครบ", "danger"); return; }
    setPriceDb(prev => [...prev, { id: Date.now(), ...form, price: Number(form.price) }]);
    setForm({ name: "", unit: "งาน", price: "" });
    setAdding(false);
    showToast("เพิ่มรายการราคาแล้ว");
  }

  function handleEdit(p) {
    setEditId(p.id);
    setForm({ name: p.name, unit: p.unit, price: String(p.price) });
  }

  function handleSaveEdit() {
    setPriceDb(prev => prev.map(p => p.id === editId ? { ...p, ...form, price: Number(form.price) } : p));
    setEditId(null);
    showToast("บันทึกการแก้ไขแล้ว");
  }

  function handleDelete(id) {
    setPriceDb(prev => prev.filter(p => p.id !== id));
    showToast("ลบรายการแล้ว", "danger");
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header title="ฐานข้อมูลราคา" onBack={() => navTo(SCREENS.HOME)}
        right={<button onClick={() => { setAdding(true); setEditId(null); setForm({ name: "", unit: "งาน", price: "" }); }} style={btnSm("#5af5a0")}>+ เพิ่ม</button>} />
      <div style={{ padding: "12px 16px" }}>
        <input style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหางาน..." />
        <input type="file" accept=".xlsx,.xls" ref={xlsxRef} onChange={handleExcelImport} style={{ display: "none" }} />
        <button onClick={() => xlsxRef.current.click()} disabled={importing}
          style={{ ...btnSm("#a06af5"), width: "100%", padding: "8px", marginBottom: 4, borderRadius: 8, fontSize: 12, opacity: importing ? 0.6 : 1 }}>
          {importing ? "⏳ กำลังนำเข้า..." : "📥 นำเข้าจาก Excel (.xlsx)"}
        </button>
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, textAlign: "center" }}>คอลัมน์ใน Excel: A=ชื่องาน  B=หน่วย  C=ราคา</div>

        {(adding || editId) && (
          <div style={{ background: "#111", border: "1px solid #2a2a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#c8a96e", marginBottom: 10 }}>{editId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}</div>
            <Label>ชื่องาน</Label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่องาน" />
            <Label>หน่วย</Label>
            <input style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="งาน / ตร.ม. / ชุด" />
            <Label>ราคา (บาท)</Label>
            <input type="number" style={inputStyle} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={editId ? handleSaveEdit : handleAdd} style={{ flex: 1, padding: 10, background: "#c8a96e", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>บันทึก</button>
              <button onClick={() => { setAdding(false); setEditId(null); }} style={{ flex: 1, padding: 10, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 13, cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#444", marginBottom: 8 }}>{filtered.length} รายการ</div>
        {filtered.map(p => (
          <div key={p.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
            {editId === p.id
              ? null
              : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ fontSize: 13, color: "#ddd", marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#c8a96e", fontWeight: 600 }}>฿{formatMoney(p.price)} / {p.unit}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => handleEdit(p)} style={{ ...btnSm("#5ab4f5"), padding: "4px 10px", fontSize: 11 }}>แก้ไข</button>
                  <button onClick={() => handleDelete(p.id)} style={{ ...btnSm("#c8423a"), padding: "4px 10px", fontSize: 11 }}>ลบ</button>
                </div>
              </div>
            }
          </div>
        ))}
      </div>
    </div>
  );
}


// OpenRouter — ไม่มี built-in key — user ต้องใส่ key เอง
const OPENROUTER_BUILTIN_KEY = "";

// Gemini key management — user ใส่ key เอง 100%
function getUserApiKeys() {
  try { return JSON.parse(localStorage.getItem("tt_api_keys") || "[]").filter(k => k && k.trim()); } catch { return []; }
}
function getAllApiKeys() {
  return getUserApiKeys();
}
function AIAnalyzeScreen({ navTo, priceDb, setPriceDb, saveQuote, showToast }) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");
  const [showKeyMgmt, setShowKeyMgmt] = useState(false);
  const [apiProvider, setApiProvider] = useState(() =>
    localStorage.getItem("tt_api_provider") || "gemini"
  );
  const fileRef = useRef();

  // ย่อรูปก่อนส่ง AI ลด quota + เพิ่มความเร็ว
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

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function getThaiErrorMessage(errMsg) {
    if (!errMsg) return "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่";
    // error ที่ format ดีแล้ว — แสดงตรงๆ
    if (errMsg.startsWith("⏳") || errMsg.startsWith("❌") || errMsg.startsWith("💳") || errMsg.startsWith("🌐") || errMsg.startsWith("⚠️"))
      return errMsg;
    const msg = errMsg.toLowerCase();
    // rate limit ต้องเช็คก่อน credit เพราะ "429" อาจอยู่ใน url ด้วย
    if (msg.includes("rate_limit") || msg.includes("quota") || msg.includes("toomanyrequests") || msg.includes("too many requests"))
      return "⚠️ Rate limit — รอ 1 นาทีแล้วลองใหม่ หรือเพิ่ม Gemini API Key ใน 🔑";
    if (msg.includes("requires more credits") || msg.includes("insufficient credits") || msg.includes("balance") || msg.includes("payment"))
      return "💳 Key หมด Credit — กรุณาเติม credit ที่ openrouter.ai หรือเพิ่ม Key ใหม่";
    if (msg.includes("overloaded") || msg.includes("503") || msg.includes("resource_exhausted"))
      return "⏳ AI โหลดมาก — รอสักครู่แล้วลองใหม่";
    if (msg.includes("401") || msg.includes("403") || msg.includes("api_key") || msg.includes("invalid") || msg.includes("permission") || msg.includes("authentication") || msg.includes("unauthorized"))
      return "❌ API Key ไม่ถูกต้อง — กรุณาตรวจสอบ Key";
    if (msg.includes("400") || msg.includes("bad request"))
      return "❌ Request ผิดรูปแบบ — กรุณาลองใหม่ หรือเปลี่ยน Provider";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch"))
      return "🌐 ไม่มีอินเทอร์เน็ต กรุณาตรวจสอบแล้วลองใหม่";
    return "❗ " + errMsg.slice(0, 200);
  }

  // ---- Anthropic Claude API — รองรับหลาย keys + retry ----
  async function callAnthropicAPI(systemPrompt, userText, imageAttachments) {
    const anthropicKeys = getAnthropicApiKeys();
    if (anthropicKeys.length === 0)
      throw new Error("ยังไม่มี Anthropic API Key กรุณาเพิ่มก่อนใช้งาน (รับฟรีที่ console.anthropic.com)");

    let lastError = null;
    for (let attempt = 0; attempt < anthropicKeys.length; attempt++) {
      const key = anthropicKeys[attempt];
      if (attempt > 0) {
        setProgress(`🔄 เปลี่ยน Anthropic Key (${attempt + 1}/${anthropicKeys.length})...`);
        await new Promise(r => setTimeout(r, 1500));
      }
      const userContent = [];
      // แนบรูปภาพทุกรูป
      for (const att of imageAttachments) {
        if (att.isImage) {
          const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data;
          const mediaType = att.mediaType || "image/jpeg";
          userContent.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data: b64 }
          });
        }
      }
      userContent.push({ type: "text", text: userText || "วิเคราะห์จากรูปที่แนบ" });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }]
          })
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          return data.content?.[0]?.text || "";
        }
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${resp.status}`;
        // 429 = rate limit → ลอง key ถัดไป
        if (resp.status === 429 && attempt < anthropicKeys.length - 1) {
          lastError = new Error(errMsg);
          continue;
        }
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

  function getAnthropicApiKeys() {
    try { return JSON.parse(localStorage.getItem("tt_anthropic_keys") || "[]"); } catch { return []; }
  }
  // ---- OpenRouter API (sk-or-v1-...) ----
  function getOpenRouterKeys() {
    try { return JSON.parse(localStorage.getItem("tt_openrouter_keys") || "[]").filter(k => k); } catch { return []; }
  }
  async function callOpenRouterAPI(systemPrompt, userText, imageAttachments) {
    const keys = getOpenRouterKeys();
    if (keys.length === 0) throw new Error("ยังไม่มี OpenRouter API Key — กรุณาเพิ่มใน 🔑 จัดการ API Keys");
    let lastError = null;
    const orModels = [
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash",
      "google/gemini-2.0-flash-lite:free",
      "google/gemini-2.0-flash:free",
      "meta-llama/llama-3.1-8b-instruct:free"
    ];
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const key = keys[attempt];
      if (attempt > 0) {
        setProgress(`🔄 เปลี่ยน OpenRouter Key (${attempt + 1}/${keys.length})...`);
        await new Promise(r => setTimeout(r, 1500));
      }
      const userContent = [];
      for (const att of imageAttachments) {
        if (att.isImage) {
          const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data;
          userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } });
        }
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
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${key}`,
              "HTTP-Referer": "https://thiengtham.app",
              "X-Title": "TheingTham",
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: modelName,
              max_tokens: 1024,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
              ]
            })
          });
          clearTimeout(timeout);
          if (resp.ok) {
            const data = await resp.json();
            return data.choices?.[0]?.message?.content || "";
          }
          const errData = await resp.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${resp.status}`;
          
          if (resp.status === 401 || resp.status === 403) {
            lastError = new Error(`❌ API Key ไม่ถูกต้อง — ${errMsg}`);
            break;
          }
          lastError = new Error(errMsg);
        } catch (e) {
          clearTimeout(timeout);
          if (e.name === "AbortError") {
            lastError = new Error("หมดเวลา กรุณาลองใหม่");
          } else {
            lastError = e;
          }
        }
      }
    }
    throw lastError || new Error("OpenRouter API ล้มเหลว");
  }

  // ย่อ priceDb เป็น compact string เพื่อลด token
  const priceDbCompact = priceDb.map(p => `${p.name}|${p.unit}|${p.price}`).join(";");

  const systemPromptBase = `ผู้ช่วยออกใบเสนอราคาก่อสร้าง ตอบ JSON เท่านั้น ห้ามมีข้อความอื่น
ราคางาน(ชื่อ|หน่วย|ราคา): ${priceDbCompact}
JSON format: {"customerName":"","address":"","project":"","items":[{"name":"","qty":1,"unit":"","price":0}],"remarks":"","overheadPct":0,"discount":0,"paymentTerms":"","newPriceItems":[{"name":"","unit":"","price":0}]}
newPriceItems=รายการใหม่ที่ไม่มีในฐานข้อมูล ใช้ราคาประมาณ`;

  async function analyze() {
    if (!input && attachments.length === 0) {
      showToast("กรุณาใส่ข้อความหรือแนบรูป", "danger");
      return;
    }
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
        // Gemini — ลอง key ทีละตัว และวนลูปโมเดลสำรองเพื่อให้มั่นใจว่าใช้งานได้จริง
        const contents = [];
        for (const att of imageAtts) {
          contents.push({ inlineData: { mimeType: "image/jpeg", data: att.data.split(",")[1] } });
        }
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
              resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
                { 
                  method: "POST", 
                  headers: { "Content-Type": "application/json" }, 
                  signal: ctrl.signal,
                  body: JSON.stringify({ 
                    contents: [{ parts: contents }],
                    generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 4096 } 
                  }) 
                }
              );
              clearTimeout(t);
            } catch (e) {
              clearTimeout(t);
              geminiError = e.name === "AbortError" ? new Error("หมดเวลา กรุณาลองใหม่") : e;
              continue; // network error — ลองโมเดลถัดไป
            }
            if (resp.ok) {
              setProgress("📋 กำลังประมวลผล...");
              const data = await resp.json();
              // gemini-2.5-flash ส่ง thinking parts มาก่อน → หา part สุดท้ายที่ไม่ใช่ thought
              const parts = data.candidates?.[0]?.content?.parts || [];
              textResult = "";
              for (let p = parts.length - 1; p >= 0; p--) {
                if (parts[p].text && !parts[p].thought) {
                  textResult = parts[p].text;
                  break;
                }
              }
              // fallback: ถ้าไม่เจอ non-thought part → เอา text จาก part สุดท้าย
              if (!textResult && parts.length > 0) {
                textResult = parts[parts.length - 1].text || "";
              }
              if (textResult) {
                geminiDone = true;
                break outerLoop;
              }
              // ถ้ายังว่าง → ลอง model ถัดไป
              geminiError = new Error("Gemini ไม่ส่งข้อมูลกลับมา");
              continue;
            } else {
              const errData = await resp.json().catch(() => ({}));
              const errMsg = errData.error?.message || `HTTP ${resp.status}`;
              console.error(`Gemini Error on ${modelName}:`, errMsg);
              const currentError = new Error(errMsg);
              if (resp.status === 429) {
                if (!geminiError) geminiError = new Error("⚠️ Gemini ชน rate limit — กรุณารอ 1 นาทีแล้วลองใหม่ หรือเพิ่ม API Key ใน 🔑");
                if (i < allKeys.length - 1) {
                  setProgress(`⚠️ Key ${i+1} ชน rate limit — ลอง Key ${i+2}...`);
                  await new Promise(r => setTimeout(r, 500));
                }
                break; // Break the model loop for this key, as the key is rate limited for all models
              } else if (resp.status === 401 || resp.status === 403 || errMsg.includes("key not valid") || errMsg.includes("API key")) {
                geminiError = new Error(`❌ API Key ไม่ถูกต้อง — ${errMsg}`);
                break;
              } else {
                if (!geminiError) geminiError = currentError;
              }
            }
          }
        }
        if (!geminiDone) throw geminiError || new Error("Gemini ใช้ไม่ได้ — กรุณาตรวจสอบ Key ด้วยปุ่ม 🔍");
      }

      setProgress("📋 กำลังสร้างใบเสนอราคา...");
      // ทำความสะอาด markdown code block
      textResult = textResult
        .replace(/^```json\s*/i, "").replace(/^```\s*/i, "")
        .replace(/\s*```\s*$/i, "").trim();
      // ลอง parse ตรงๆ ก่อน แล้วค่อย regex
      let parsed = null;
      try {
        parsed = JSON.parse(textResult);
      } catch {
        const jsonMatch = textResult.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("AI Raw Response:", textResult.slice(0, 500));
          throw new Error("AI ไม่ส่ง JSON กลับมา กรุณาลองใหม่");
        }
        parsed = JSON.parse(jsonMatch[0]);
      }
      if (!parsed.items || !Array.isArray(parsed.items)) throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      setResult(parsed);
    } catch (e) {
      console.error("AI Analyze Error:", e);
      const msg = e?.message || String(e) || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
      // ตรวจจับ CORS errors
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("CORS") || msg.includes("Load failed")) {
        if (apiProvider === "anthropic") {
          setError("🌐 ไม่สามารถเชื่อมต่อ Anthropic API ได้ (อาจถูก CORS บล็อก)\n💡 แนะนำ: เปลี่ยนไปใช้ 🔵 Google Gemini แทน");
        } else {
          setError("🌐 ไม่มีอินเทอร์เน็ต หรือ API ถูกบล็อก — กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่");
        }
      } else {
        setError(getThaiErrorMessage(msg));
      }
    }
    setLoading(false); setProgress("");
  }

  function createQuoteFromResult() {
    if (!result) return;
    if (result.newPriceItems?.length > 0) {
      setPriceDb(prev => [...prev, ...result.newPriceItems.map(p => ({ id: Date.now() + Math.random(), ...p, price: Number(p.price) }))]);
    }
    const q = {
      id: genId(), quoteNo: "TT-QN-" + String(Date.now()).slice(-6),
      customerName: result.customerName || "", address: result.address || "",
      phone: "", project: result.project || "", date: today(),
      items: (result.items || []).map(i => ({ ...i, id: genId() })),
      remarks: result.remarks || "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
      includeVat: true, discount: Number(result.discount) || 0, overheadPct: Number(result.overheadPct) || 0, paymentTerms: result.paymentTerms || "",
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

        {/* เลือก AI Provider */}
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>เลือก AI ที่ใช้วิเคราะห์</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "gemini", label: "🔵 Google Gemini", sub: "แนะนำ / ฟรี / ใส่ Key เอง" },
              { id: "openrouter", label: "⚡ Gemini/Llama (OpenRouter)", sub: "ใส่ Key เอง" },
              { id: "anthropic", label: "🟠 Claude (Direct)", sub: "ใส่ Key เอง" },
            ].map(p => (
              <button key={p.id} onClick={() => {
                setApiProvider(p.id);
                localStorage.setItem("tt_api_provider", p.id);
              }} style={{
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

        {/* กล่องวิเคราะห์ */}
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 10, lineHeight: 1.6 }}>
            ✨ พิมพ์รายละเอียดงาน หรือแนบรูปถ่ายกระดาษจดงาน/ใบเสร็จ
          </div>
          <textarea style={{ ...inputStyle, height: 100, resize: "none" }} value={input} onChange={e => setInput(e.target.value)}
            placeholder="เช่น: แก้ไขผนังแตกร้าว 1 งาน, รื้อปูกระเบื้องยาง SPC 15 ตร.ม." />

          <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleFiles} style={{ display: "none" }} />

          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {attachments.map(att => (
                <div key={att.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a2a" }}>
                  <img src={att.data} alt={att.name} style={{ width: 72, height: 64, objectFit: "cover", display: "block" }} />
                  <button onClick={() => removeAttachment(att.id)}
                    style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.8)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => fileRef.current.click()}
            style={{ width: "100%", padding: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ccc", fontSize: 13, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            🖼 เลือกรูปภาพ {attachments.length > 0 && <span style={{ background: "#c8a96e", color: "#000", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{attachments.length}</span>}
          </button>

          <button onClick={analyze} disabled={loading}
            style={{ width: "100%", padding: 14, background: loading ? "#222" : "#c8a96e", border: "none", borderRadius: 10, color: loading ? "#666" : "#000", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "⏳ กำลังวิเคราะห์..." : "✨ วิเคราะห์และสร้างใบเสนอราคา"}
          </button>

          {loading && progress && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, color: "#c8a96e", padding: "10px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a" }}>
              {progress}
              <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#c8a96e",
                    animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`, opacity: 0.5 }} />
                ))}
              </div>
            </div>
          )}
          <style>{`@keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>

          {apiProvider === "anthropic" && getAnthropicApiKeys().length === 0 && !loading && (
            <div style={{ marginTop: 8, color: "#f5a05a", fontSize: 12, padding: "10px 12px", background: "#1a0e00", borderRadius: 8, border: "1px solid #3a2200" }}>
              ⚠️ ยังไม่มี Anthropic API Key — กรุณาเพิ่มด้านล่างก่อนวิเคราะห์<br/>
              <span style={{ color: "#888", fontSize: 11 }}>หรือเปลี่ยนไปใช้ 🔵 Google Gemini (ฟรี)</span>
            </div>
          )}
          {apiProvider === "openrouter" && getOpenRouterKeys().length === 0 && !loading && (
            <div style={{ marginTop: 8, color: "#9af55a", fontSize: 12, padding: "10px 12px", background: "#0a1a00", borderRadius: 8, border: "1px solid #2a3a00" }}>
              ⚠️ ยังไม่มี OpenRouter API Key — กรุณาเพิ่มด้านล่างก่อนวิเคราะห์<br/>
              <span style={{ color: "#888", fontSize: 11 }}>รับ Key ฟรีที่ openrouter.ai หรือเปลี่ยนไปใช้ 🔵 Google Gemini</span>
            </div>
          )}
          {apiProvider === "gemini" && getUserApiKeys().length === 0 && !loading && (
            <div style={{ marginTop: 8, color: "#5ab4f5", fontSize: 12, padding: "10px 12px", background: "#001a2e", borderRadius: 8, border: "1px solid #003a5a" }}>
              ⚠️ ยังไม่มี Gemini API Key — กรุณาเพิ่มด้านล่างก่อนวิเคราะห์<br/>
              <span style={{ color: "#888", fontSize: 11 }}>รับ Key ฟรีที่ aistudio.google.com</span>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8, color: "#f55a5a", fontSize: 12, padding: "8px 12px", background: "#1a0a0a", borderRadius: 8 }}>
              {error}
            </div>
          )}
        </div>

        {/* จัดการ API Keys */}
        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <button onClick={() => setShowKeyMgmt(v => !v)} style={{ background: "none", border: "none", color: "#c8a96e", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", textAlign: "left", padding: 0 }}>
            🔑 จัดการ API Keys {showKeyMgmt ? "▲" : "▼"}
          </button>
          {showKeyMgmt && (
            <div style={{ marginTop: 12 }}>

              {/* OpenRouter Keys */}
              <KeySection
                color="#9af55a"
                title="⚡ OpenRouter API Key (Gemini/Llama)"
                hint="รับที่ openrouter.ai"
                placeholder="sk-or-v1-..."
                storageKey="tt_openrouter_keys"
                builtinCount={0}
                showToast={showToast}
              />

              {/* Gemini Keys */}
              <KeySection
                color="#5ab4f5"
                title="🔵 Google Gemini API Key"
                hint="รับฟรีที่ aistudio.google.com"
                placeholder="AIzaSy..."
                storageKey="tt_api_keys"
                builtinCount={0}
                showToast={showToast}
              />

              {/* Anthropic Keys */}
              <KeySection
                color="#f5a05a"
                title="🟠 Anthropic Claude API Key"
                hint="รับที่ console.anthropic.com"
                placeholder="sk-ant-..."
                storageKey="tt_anthropic_keys"
                builtinCount={0}
                showToast={showToast}
              />

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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c8a96e", textAlign: "right", marginTop: 8 }}>
              รวม: ฿{formatMoney((result.items || []).reduce((s, i) => s + Number(i.qty) * Number(i.price), 0))}
            </div>
            {result.newPriceItems?.length > 0 && (
              <div style={{ fontSize: 11, color: "#888", marginTop: 8, background: "#0d0d0d", padding: "8px 10px", borderRadius: 6 }}>
                💡 เพิ่มฐานข้อมูลราคาใหม่ {result.newPriceItems.length} รายการ
              </div>
            )}
            <button onClick={createQuoteFromResult} style={{ width: "100%", padding: 12, background: "#5af5a0", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 12 }}>
              📋 สร้างเอกสารใบเสนอราคา
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TransferScreen({ navTo, showToast, quotes, setQuotes, priceDbMeta, setPriceDbMeta }) {
  const [tab, setTab] = useState("send");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [inputCode, setInputCode] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      if (Date.now() > expiresAt.getTime()) {
        setGeneratedCode("");
        setExpiresAt(null);
        showToast("โค้ดหมดอายุแล้ว — กรุณาสร้างใหม่", "danger");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, showToast]);

  async function handleGenerate() {
    setLoading(true);
    setGeneratedCode("");
    setExpiresAt(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ยังไม่ได้ login");
      const { data: newCode, error } = await supabase.rpc("generate_transfer_code", { p_source_user_id: user.id });
      if (error) throw error;
      setGeneratedCode(newCode);
      setExpiresAt(new Date(Date.now() + 15 * 60 * 1000));
    } catch (e) {
      showToast("สร้างโค้ดไม่สำเร็จ: " + e.message, "danger");
    }
    setLoading(false);
  }

  async function handleReceive() {
    const c = inputCode.trim().toUpperCase();
    if (!c || c.length !== 6) { showToast("กรุณากรอกโค้ด 6 หลัก", "danger"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ยังไม่ได้ login");
      const { data: ok, error } = await supabase.rpc("transfer_data", { p_code: c, p_dest_user_id: user.id });
      if (error) throw error;
      setResult("success");
      showToast("✅ ย้ายข้อมูลสำเร็จ กำลังโหลดข้อมูล...", "success");
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
      const msg = e.message || "";
      if (msg.includes("TRANSFER_CODE_INVALID")) showToast("❌ โค้ดไม่ถูกต้องหรือหมดอายุแล้ว", "danger");
      else showToast("❌ รับข้อมูลไม่สำเร็จ: " + msg, "danger");
      setResult("error");
    }
    setLoading(false);
  }

  const expiresSeconds = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header title="ย้ายข้อมูลไปเครื่องใหม่" onBack={() => navTo(SCREENS.HOME)} />
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", background: "#0d0d0d", marginBottom: 16 }}>
          {[["send", "ส่งข้อมูล"], ["receive", "รับข้อมูล"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "12px 0", background: "none", border: "none",
              color: tab === k ? "#c8a96e" : "#555", fontSize: 13, fontWeight: tab === k ? 600 : 400,
              borderBottom: tab === k ? "2px solid #c8a96e" : "2px solid transparent", cursor: "pointer"
            }}>{l}</button>
          ))}
        </div>

        {tab === "send" ? (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
              สร้างโค้ด 6 หลักเพื่อย้ายข้อมูลไปเครื่องใหม่<br />
              <span style={{ fontSize: 12, color: "#555" }}>โค้ดหมดอายุใน 15 นาที</span>
            </div>

            {!generatedCode ? (
              <button onClick={handleGenerate} disabled={loading}
                style={{ padding: "14px 32px", background: loading ? "#222" : "#c8a96e", border: "none", borderRadius: 10, color: loading ? "#666" : "#000", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "⏳ กำลังสร้าง..." : "🔑 สร้างโค้ด"}
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 48, fontWeight: 700, color: "#c8a96e", letterSpacing: 8, fontFamily: "monospace", marginBottom: 8 }}>
                  {generatedCode}
                </div>
                <div style={{ fontSize: 13, color: expiresSeconds < 60 ? "#f55a5a" : "#888" }}>
                  ⏱ หมดอายุใน {Math.floor(expiresSeconds / 60)}:{String(expiresSeconds % 60).padStart(2, "0")} น.
                </div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 16, lineHeight: 1.6, background: "#0d0d0d", padding: 12, borderRadius: 8 }}>
                  ใส่โค้ดนี้ในเครื่องใหม่ → "รับข้อมูล"
                </div>
                <button onClick={handleGenerate} style={{ marginTop: 12, padding: "8px 20px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 12, cursor: "pointer" }}>
                  🔄 สร้างใหม่
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
              ใส่โค้ด 6 หลักจากเครื่องเก่าเพื่อรับข้อมูล
            </div>
            <input value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="เช่น A1B2C3"
              style={{ ...inputStyle, textAlign: "center", fontSize: 24, fontFamily: "monospace", letterSpacing: 6, textTransform: "uppercase" }}
              maxLength={6} />
            <button onClick={handleReceive} disabled={loading || inputCode.length !== 6}
              style={{ width: "100%", padding: 14, background: loading ? "#222" : "#c8a96e", border: "none", borderRadius: 10, color: loading ? "#666" : "#000", fontWeight: 700, fontSize: 15, cursor: (loading || inputCode.length !== 6) ? "not-allowed" : "pointer", marginTop: 16 }}>
              {loading ? "⏳ กำลังรับข้อมูล..." : "📥 รับข้อมูล"}
            </button>
            {result === "success" && (
              <div style={{ marginTop: 12, textAlign: "center", color: "#5af5a0", fontSize: 14, fontWeight: 600 }}>
                ✅ ย้ายข้อมูลสำเร็จ!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// KeySection — จัดการ API Keys แบบ ดู/แก้ไข/ลบ
function KeySection({ color, title, hint, placeholder, storageKey, builtinCount, showToast }) {
  const [keys, setKeys] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; } });
  const [newKey, setNewKey] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [showIdx, setShowIdx] = useState(null);
  const [testStatus, setTestStatus] = useState({}); // idx -> "ok"|"fail"|"testing"

  function save(updated) {
    setKeys(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  function addKey() {
    const k = newKey.trim();
    if (!k) return;
    if (keys.includes(k)) { showToast("Key นี้มีอยู่แล้ว", "danger"); return; }
    save([k, ...keys]);
    setNewKey("");
    showToast("✅ เพิ่ม Key แล้ว");
  }

  function deleteKey(i) {
    save(keys.filter((_, idx) => idx !== i));
    showToast("🗑️ ลบ Key แล้ว", "danger");
  }

  function startEdit(i) { setEditIdx(i); setEditVal(keys[i]); }

  function saveEdit() {
    const k = editVal.trim();
    if (!k) return;
    const updated = [...keys]; updated[editIdx] = k;
    save(updated);
    setEditIdx(null);
    showToast("✏️ แก้ไข Key แล้ว");
  }

  async function testKey(k, i) {
    setTestStatus(s => ({ ...s, [i]: "testing" }));
    try {
      let ok = false;
      let errMsg = "";
      if (storageKey === "tt_openrouter_keys" || k.startsWith("sk-or-")) {
        const orModels = [
          "google/gemini-2.5-flash",
          "google/gemini-2.0-flash",
          "google/gemini-2.0-flash-lite:free",
          "google/gemini-2.0-flash:free",
          "meta-llama/llama-3.1-8b-instruct:free"
        ];
        for (const m of orModels) {
          try {
            const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${k}`, 
                "HTTP-Referer": "https://thiengtham.app", 
                "X-Title": "TheingTham" 
              },
              body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "hi" }] })
            });
            if (r.ok) {
              ok = true;
              break;
            } else {
              const errData = await r.json().catch(() => ({}));
              errMsg = errData.error?.message || `HTTP ${r.status}`;
              if (r.status === 401 || r.status === 403) {
                break;
              }
            }
          } catch (e) {
            errMsg = e.message;
          }
        }
      } else if (storageKey === "tt_anthropic_keys" || k.startsWith("sk-ant-")) {
        const anthropicModels = [
          "claude-sonnet-4-20250514",
          "claude-3-5-haiku-20241022",
          "claude-3-5-sonnet-20241022"
        ];
        for (const m of anthropicModels) {
          try {
            const r = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                "x-api-key": k, 
                "anthropic-version": "2023-06-01", 
                "anthropic-dangerous-direct-browser-access": "true" 
              },
              body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "hi" }] })
            });
            if (r.ok) {
              ok = true;
              break;
            } else {
              const errData = await r.json().catch(() => ({}));
              errMsg = errData.error?.message || `HTTP ${r.status}`;
              if (r.status === 401 || r.status === 403) {
                break;
              }
            }
          } catch (e) {
            errMsg = e.message;
          }
        }
      } else if (storageKey === "tt_api_keys" || k.startsWith("AIzaSy")) {
        const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
        for (const m of geminiModels) {
          try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
              method: "POST", 
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 5 } })
            });
            if (r.ok) {
              ok = true;
              break;
            } else {
              const errData = await r.json().catch(() => ({}));
              const serverMsg = errData.error?.message || `HTTP ${r.status}`;
              console.error(`Gemini Test Key Error on ${m}:`, serverMsg);
              if (!errMsg) errMsg = serverMsg;
              if (r.status === 429) {
                break; // rate limited, stop testing other models
              }
              if (r.status === 401 || r.status === 403 || serverMsg.includes("key not valid") || serverMsg.includes("API key")) {
                break;
              }
            }
          } catch (e) {
            console.error(`Gemini Test Key Exception on ${m}:`, e.message);
            if (!errMsg) errMsg = e.message;
          }
        }
      } else {
        errMsg = "รูปแบบคีย์ไม่ถูกต้อง";
      }
      
      if (ok) {
        setTestStatus(s => ({ ...s, [i]: "ok" }));
      } else {
        setTestStatus(s => ({ ...s, [i]: `fail: ${errMsg}` }));
      }
    } catch (err) {
      setTestStatus(s => ({ ...s, [i]: `fail: ${err.message}` }));
    }
    setTimeout(() => setTestStatus(s => { const n = { ...s }; delete n[i]; return n; }), 10000);
  }

  const bgColor = color + "11";
  const borderColor = color + "44";

  return (
    <div style={{ marginBottom: 18, borderRadius: 10, border: `1px solid ${borderColor}`, padding: 12, background: bgColor }}>
      <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>{hint} {builtinCount > 0 && `| built-in ${builtinCount} key`} | user {keys.length} keys</div>

      {/* เพิ่ม key ใหม่ */}
      <div style={{ display: "flex", gap: 6, marginBottom: keys.length > 0 ? 10 : 0 }}>
        <input value={newKey} onChange={e => setNewKey(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1, fontSize: 11, fontFamily: "monospace", marginBottom: 0 }} />
        <button onClick={addKey} style={{ padding: "8px 12px", background: "#0d0d0d", border: `1px solid ${color}`, borderRadius: 8, color, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          ➕ เพิ่ม
        </button>
      </div>

      {/* รายการ keys */}
      {keys.map((k, i) => (
        <div key={i} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
          {editIdx === i ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={editVal} onChange={e => setEditVal(e.target.value)}
                style={{ ...inputStyle, flex: 1, fontSize: 11, fontFamily: "monospace", marginBottom: 0 }} />
              <button onClick={saveEdit} style={{ padding: "6px 10px", background: "#1a2e0a", border: `1px solid ${color}`, borderRadius: 6, color, fontSize: 11, cursor: "pointer" }}>💾</button>
              <button onClick={() => setEditIdx(null)} style={{ padding: "6px 10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#666", fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>Key {i + 1}</div>
                  {testStatus[i]?.startsWith("fail") && (
                    <div style={{ fontSize: 9, color: "#f55a5a", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={testStatus[i].replace("fail: ", "")}>
                      ⚠️ {testStatus[i].replace("fail: ", "")}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {showIdx === i ? k : k.slice(0, 10) + "..." + k.slice(-4)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {/* 👁️ ดู */}
                <button onClick={() => setShowIdx(showIdx === i ? null : i)}
                  title="ดู Key"
                  style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: "2px 4px" }}>
                  {showIdx === i ? "🙈" : "👁️"}
                </button>
                {/* 🧪 ทดสอบ */}
                <button onClick={() => testKey(k, i)}
                  title="ทดสอบ Key"
                  style={{ background: "none", border: "none", fontSize: 13, cursor: "pointer", padding: "2px 4px" }}>
                  {testStatus[i] === "testing" ? "⏳" : testStatus[i] === "ok" ? "✅" : testStatus[i]?.startsWith("fail") ? "❌" : "🔍"}
                </button>
                {/* ✏️ แก้ไข */}
                <button onClick={() => startEdit(i)}
                  title="แก้ไข Key"
                  style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: "2px 4px" }}>✏️</button>
                {/* 🗑️ ลบ */}
                <button onClick={() => deleteKey(i)}
                  title="ลบ Key"
                  style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: "2px 4px" }}>🗑️</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {keys.length > 1 && (
        <button onClick={() => { save([]); showToast("ล้าง keys ทั้งหมดแล้ว", "danger"); }}
          style={{ background: "none", border: "none", color: "#c8423a", fontSize: 11, cursor: "pointer", marginTop: 2 }}>
          🗑️ ล้างทั้งหมด
        </button>
      )}
    </div>
  );
}

function Header({ title, onBack, right }) {
  return (
    <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
      {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: "#c8a96e", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>}
      <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e8e8e8" }}>{title}</div>
      {right}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: "#555", marginBottom: 4, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}

const inputStyle = {
  width: "100%", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #1e1e1e",
  borderRadius: 8, color: "#e8e8e8", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 0,
};

const btnKey = {
  background: "#1a1a1a", border: "1px solid #333", color: "#c8a96e",
  borderRadius: 8, width: 40, height: 40, fontSize: 18, fontWeight: 700, cursor: "pointer"
};

function btnSm(color, outline = false) {
  return {
    background: outline ? "transparent" : color + "22",
    border: `1px solid ${color}44`, color, borderRadius: 6,
    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  };
}

