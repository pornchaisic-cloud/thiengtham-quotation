export const COMPANY_INFO = {
  name: "บริษัท เที่ยงทำ ดีเวลล็อปเมนท์ จำกัด",
  address: "เลขที่ 10/15 ซ.1/3 หมู่ที่ 6 ถ.รัตนาธิเบศร์ ต.เสาธงหิน อ.บางใหญ่ จ.นนทบุรี 11140",
  phone: "062-069-8888",
  taxId: "1729900000000",
  bank: "ธ.ไทยพาณิชย์ บัญชี ออมทรัพย์  เลขที่บัญชี 1174057341",
  subcontractorName: "นายพรชัย ชูพรม",
};

export const COMPANY_LOGO = "/logo.png";

export const INITIAL_PRICE_DB = [
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

export const SCREENS = { HOME: "home", NEW_QUOTE: "new_quote", QUOTES: "quotes", VIEW_QUOTE: "view_quote", PRICE_DB: "price_db", AI_ANALYZE: "ai_analyze", TRANSFER: "transfer" };

export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export function formatMoney(n) { return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function today() { return new Date().toISOString().slice(0, 10); }

export function thaiDateStr(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

export function getItemNumbers(items) {
  const nums = []; let cat = 0, sub = 0, afterCat = false, seq = 0;
  for (const item of items || []) {
    if (item.type === "category") { cat++; nums.push(String(cat)); sub = 0; afterCat = true; }
    else if (afterCat) { sub++; nums.push(cat + "." + sub); }
    else { seq++; nums.push(String(seq)); }
  }
  return nums;
}

export function ThaiBaht(Number) {
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
        if (pos % 6 === 1 && digit === 1) res += "เอ็ด";
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

// Helper: format Thai baht in parentheses (matching reference Excel format)
// Reference: (ห้าหกบาทถ้วน) - no spaces between parens and text
export function thaiBahtText(n) {
  return "(" + ThaiBaht(n) + ")";
}
