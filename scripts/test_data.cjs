// Generate test Excel from app code and compare with reference
const ExcelJS = require('exceljs');
const path = require('path');

// Use a fake quote similar to ref_qn.xlsx
const fakeQuote = {
  quoteNo: "TT-QN-001-26",
  date: new Date("2026-01-07"),
  customerName: "K.Ddee Haworth",
  address: "",
  phone: "",
  project: "ดิ ยูนีค เท็น ไนน์ อาคาร - ชั้น - เลขที่ Unit : - (เลขที่บ้าน : 319/10)",
  remarks: "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
  paymentTerms: "",
  paymentInstallments: [
    { label: "ก่อนเริ่มงาน", pct: 50 },
    { label: "หลังส่งมอบงาน", pct: 50 },
  ],
  payeeName: null,
  subcontractorName: null,
  overhead: 6828,
  overheadPct: 15,
  vat: 0,
  discountAmt: 0,
  items: [
    { id: 1, name: "แก้ไขผนังแตกร้าว ขูดรอยร้าวและเซาะร่อง V อุดรอยร้าวด้วย non-shrink", unit: "งาน", qty: 1, price: 12840 },
    { id: 2, name: "งานขัดแต่งผิวให้เรียบ", unit: "งาน", qty: 1, price: 4180 },
    { id: 3, name: "งานทาสีผนังภายใน", unit: "ตร.ม.", qty: 50, price: 520 },
    { id: 4, name: "ค่าเดินทาง", unit: "วัน", qty: 5, price: 500 },
    { id: 5, name: "งานProtection+ทำความสะอาดเบื้องต้น(ฟรี)", unit: "", qty: 0, price: 0 },
  ],
  logo: null,
  signature: null,
};

// Just read back the helpers + use a simpler test
const { COMPANY_INFO } = require('./src/utils/helpers.js');
console.log('COMPANY_INFO:', JSON.stringify(COMPANY_INFO, null, 2));