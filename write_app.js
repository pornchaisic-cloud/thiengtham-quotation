// Script to write the full App.jsx
const fs = require('fs');
const path = require('path');

const APP_JSX = `import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { supabase, BUCKET_NAME } from "./lib/supabase";

function isNative() { return Capacitor.isNativePlatform(); }
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => { resolve(reader.result.split(",")[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
async function uploadPdfToSupabase(pdfBlob, fileName) {
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return data.publicUrl;
}
async function uploadExcelToSupabase(excelBlob, fileName) {
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, excelBlob, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return data.publicUrl;
}

const COMPANY_INFO = {
  name: "นายพรชัย ชูพรม",
  address: "เลขที่ 10/15 ซ.1/3 หมู่ที่ 6 ถ.รัตนาธิเบศร์ ต.เสาธงหิน อ.บางใหญ่ จ.นนทบุรี 11140 (สำนักงานใหญ่)",
  phone: "062-069-8888",
  taxId: "1729900082674",
  bank: { name: "ธ.ไทยพาณิชย์", accountType: "บัญชี ออมทรัพย์", accountNo: "1174057341" },
};
const COMPANY_LOGO = "https://lh3.googleusercontent.com/d/1ADCx2vlUxgagYSz1NlbsfpjSeI5PIMuz";

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

const SCREENS = { HOME: "home", NEW_QUOTE: "new_quote", QUOTES: "quotes", VIEW_QUOTE: "view_quote", PRICE_DB: "price_db", AI_ANALYZE: "ai_analyze" };

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function formatMoney(n) { return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }
function thaiDateStr(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}
function addDays(dateStr, days) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

function numberToThaiText(num) {
  if (num == null || isNaN(num)) return "";
  num = Math.round(Number(num) * 100) / 100;
  if (num === 0) return "ศูนย์บาทถ้วน";
  const numText = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const posText = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  function readInt(n) {
    if (n === 0) return "";
    let str = "";
    const s = String(n);
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(s[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 1 && d === 1) str += "สิบ";
      else if (pos === 1 && d === 2) str += "ยี่สิบ";
      else if (pos === 0 && d === 1 && len > 1) str += "เอ็ด";
      else str += numText[d] + posText[pos];
    }
    return str;
  }
  const baht = Math.floor(num);
  const satang = Math.round((num - baht) * 100);
  let result = baht === 0 ? "ศูนย์บาท" : readInt(baht) + "บาท";
  result += satang === 0 ? "ถ้วน" : readInt(satang) + "สตางค์";
  return result;
}

const DEFAULT_FORM = () => ({
  id: genId(),
  quoteNo: "TT-QN-" + String(Date.now()).slice(-6),
  customerName: "", address: "", phone: "", project: "", taxId: "",
  date: today(), validDays: 30, items: [], includeVat: true,
  discount: 0, overheadPct: 0, paymentTerms: "",
  remarks: "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
  logo: COMPANY_LOGO, signature: null,
  installments: [
    { pct: 50, label: "ก่อนเริ่มงาน" },
    { pct: 50, label: "หลังส่งมอบงาน" },
  ],
});

// ===== Main App =====
export default function App() {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [quotes, setQuotes] = useState(() => { try { return JSON.parse(localStorage.getItem("tt_quotes") || "[]"); } catch { return []; } });
  const [priceDb, setPriceDb] = useState(() => { try { return JSON.parse(localStorage.getItem("tt_pricedb") || JSON.stringify(INITIAL_PRICE_DB)); } catch { return INITIAL_PRICE_DB; } });
  const [activeQuote, setActiveQuote] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem("tt_quotes", JSON.stringify(quotes)); }, [quotes]);
  useEffect(() => { localStorage.setItem("tt_pricedb", JSON.stringify(priceDb)); }, [priceDb]);

  function showToast(msg, type = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); }
  function saveQuote(q) {
    setQuotes(prev => { const idx = prev.findIndex(x => x.id === q.id); if (idx >= 0) { const n = [...prev]; n[idx] = q; return n; } return [q, ...prev]; });
  }
  function deleteQuote(id) { setQuotes(prev => prev.filter(x => x.id !== id)); showToast("ลบใบเสนอราคาแล้ว", "danger"); setScreen(SCREENS.QUOTES); }
  const navTo = (s, q = null) => { setActiveQuote(q); setScreen(s); };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif", width: "100%", maxWidth: "100%", position: "relative", overflowX: "hidden" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {screen === SCREENS.HOME && <HomeScreen navTo={navTo} quotes={quotes} />}
      {screen === SCREENS.QUOTES && <QuoteListScreen quotes={quotes} navTo={navTo} deleteQuote={deleteQuote} />}
      {screen === SCREENS.NEW_QUOTE && <QuoteFormScreen navTo={navTo} priceDb={priceDb} saveQuote={saveQuote} quote={activeQuote} showToast={showToast} />}
      {screen === SCREENS.VIEW_QUOTE && activeQuote && <ViewQuoteScreen quote={activeQuote} navTo={navTo} deleteQuote={deleteQuote} showToast={showToast} setPdfPreviewUrl={setPdfPreviewUrl} />}
      {screen === SCREENS.PRICE_DB && <PriceDbScreen priceDb={priceDb} setPriceDb={setPriceDb} showToast={showToast} navTo={navTo} />}
      {screen === SCREENS.AI_ANALYZE && <AIAnalyzeScreen navTo={navTo} priceDb={priceDb} setPriceDb={setPriceDb} saveQuote={saveQuote} showToast={showToast} />}
    </div>
  );
}

function Toast({ msg, type }) {
  const colors = { success: "#1a5c2e", danger: "#5c1a1a", info: "#1a3a5c" };
  return <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: colors[type] || colors.success, color: "#fff", padding: "10px 20px", borderRadius: 20, zIndex: 9999, fontSize: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>{msg}</div>;
}

export { COMPANY_INFO, COMPANY_LOGO, INITIAL_PRICE_DB, SCREENS, genId, formatMoney, today, thaiDateStr, addDays, numberToThaiText, DEFAULT_FORM, isNative };
`;

const filePath = path.join(__dirname, 'src', 'App.jsx');
fs.writeFileSync(filePath, APP_JSX, 'utf8');
console.log('Wrote', APP_JSX.length, 'chars to', filePath);
