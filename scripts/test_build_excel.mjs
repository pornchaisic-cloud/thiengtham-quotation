// Test buildExcelBlob by simulating what React component does
// Sample quote matching reference data
import ExcelJS from "exceljs";
import { writeFile } from "fs/promises";

const sampleQuote = {
  id: "test001",
  quoteNo: "TT-QN-001-26",
  date: "2026-01-07",
  customerName: "K.Ddee Haworth",
  address: "",
  project: "ดิ ยูนีค เท็น ไนน์ อาคาร - ชั้น - เลขที่ Unit : - (หน่วยนับ : -)",
  phone: "",
  subcontractorName: "นายพรชัย ชูพรม",
  payeeName: "นายพรชัย ชูพรม",
  remarks: "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
  paymentTerms: "",
  items: [
    { type: "category", name: "ค่าแรง" },
    { name: "แก้ไขผนังแตกร้าว ขูดรอยร้าวและเซาะร่อง V อุดรอยร้าวด้วย non-shrink", qty: 1, unit: "งาน", price: 12840 },
    { name: "งานขัดแต่งผิวให้เรียบ", qty: 1, unit: "งาน", price: 4180 },
    { name: "งานทาสีผนังภายใน", qty: 50, unit: "ตร.ม.", price: 520 },
    { type: "category", name: "อื่นๆ" },
    { name: "ค่าเดินทาง", qty: 5, unit: "วัน", price: 500 },
    { name: "งานProtection+ทำความสะอาดเบื้องต้น(ฟรี)", qty: 0, unit: "", price: 0 },
    { name: "งานเคลื่อนย้ายของภายในห้อง(ฟรี)", qty: 0, unit: "", price: 0 },
  ],
  subtotal: 45520,
  overheadPct: 15,
  overhead: 6828,
  afterOverhead: 52348,
  discountAmt: 0,
  vat: 3664.36,
  grandTotal: 56012.36,
  paymentInstallments: [
    { id: "i1", label: "ก่อนเริ่มงาน", pct: 50, amount: 28006.18 },
    { id: "i2", label: "หลังส่งมอบงาน", pct: 50, amount: 28006.18 },
  ],
};

// Inline copy of helpers
const COMPANY_INFO = {
  name: "บริษัท เที่ยงทำ ดีเวลล็อปเมนท์ จำกัด",
  address: "เลขที่ 10/15 ซ.1/3 หมู่ที่ 6 ถ.รัตนาธิเบศร์ ต.เสาธงหิน อ.บางใหญ่ จ.นนทบุรี 11140",
  phone: "062-069-8888",
  taxId: "1729900082674",
  bank: "ธ.ไทยพาณิชย์ บัญชี ออมทรัพย์  เลขที่บัญชี 1174057341",
  subcontractorName: "นายพรชัย ชูพรม",
};

function formatMoney(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thaiDateStr(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

function getItemNumbers(items) {
  const nums = []; let cat = 0, sub = 0, afterCat = false, seq = 0;
  for (const item of items || []) {
    if (item.type === "category") { cat++; nums.push(String(cat)); sub = 0; afterCat = true; }
    else if (afterCat) { sub++; nums.push(cat + "." + sub); }
    else { seq++; nums.push(String(seq)); }
  }
  return nums;
}

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

function thaiBahtText(n) { return "(" + ThaiBaht(n) + ")"; }

// ─── IMPORT THE FUNCTION FROM THE COMPONENT ───
// We can't easily import JSX from a .mjs file, so we extract the logic inline:
async function buildExcelBlob(quote) {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_INFO.name;
  const ws = wb.addWorksheet("ใบเสนอราคา");

  const nums = getItemNumbers(quote.items);
  const items = quote.items || [];
  const grandTotal = Number(quote.grandTotal || 0);
  const overhead = Number(quote.overhead || 0);
  const overheadPct = Number(quote.overheadPct || 0);
  const vat = Number(quote.vat || 0);
  const subtotal = Number(quote.subtotal || 0);
  const discountAmt = Number(quote.discountAmt || 0);
  const subtotalWithOverhead = subtotal + overhead;
  const installments = (quote.paymentInstallments || []).map(inst => ({
    ...inst, amount: grandTotal * (Number(inst.pct) / 100)
  }));
  const projectLabel = quote.project || "";
  const customerAddress = quote.address || "";
  const subcontractorName = quote.subcontractorName || COMPANY_INFO.subcontractorName || "";

  // ... [same code as the component]
  ws.columns = [
    { width: 5.140625 }, { width: 3.85546875 }, { width: 4.7109375 }, { width: 4.140625 },
    { width: 4 }, { width: 4.7109375 }, { width: 13.28515625 }, { width: 12.7109375 }, { width: 14 },
    { width: 4.140625 }, { width: 5 }, { width: 3 }, { width: 4 }, { width: 3 }, { width: 4 },
    { width: 2.42578125 }, { width: 2.7109375 }, { width: 7 }, { width: 4.7109375 },
    { width: 3.42578125 }, { width: 13.28515625 },
  ];

  const thin = { style: "thin" };
  const noBorder = {};
  const headerFont = { name: "Angsana New", size: 16, bold: true };
  const normalFont = { name: "Angsana New", size: 14 };
  const smallFont = { name: "Angsana New", size: 12 };
  const tableHeaderFont = { name: "Angsana New", size: 14, bold: true };
  const boldFont = { name: "Angsana New", size: 14, bold: true };
  const netGrossFont = { name: "Angsana New", size: 14, bold: true, color: { argb: "FFFF0000" } };
  const centerAlign = { horizontal: "center", vertical: "center", wrapText: true };
  const leftAlign = { horizontal: "left", vertical: "center", wrapText: true, indent: 1 };
  const rightAlign = { horizontal: "right", vertical: "center", indent: 1 };

  const setCell = (r, c, val, font, align, borderStyle, fill) => {
    const cell = ws.getCell(r, c);
    cell.value = val;
    if (font) cell.font = font;
    if (align) cell.alignment = align;
    if (borderStyle) cell.border = borderStyle;
    if (fill) cell.fill = fill;
    return cell;
  };
  const numFmt2 = "#,##0.00";

  ws.getRow(1).height = 21.75;

  ws.getRow(2).height = 21.75;
  ws.mergeCells("D2:G2");
  setCell(2, 4, subcontractorName, boldFont,
    { horizontal: "center", vertical: "center" },
    { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(3).height = 35.25;
  ws.mergeCells("A3:U3");
  setCell(3, 1, COMPANY_INFO.address, normalFont,
    { horizontal: "left", vertical: "center", indent: 1 },
    { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(4).height = 21;
  ws.mergeCells("A4:U4");
  setCell(4, 1, { richText: [{ text: "โทร. ", font: { bold: true, size: 16, name: "Angsana New" } }, { text: COMPANY_INFO.phone, font: { size: 16, name: "Angsana New" } }] },
    null,
    { horizontal: "left", vertical: "center", indent: 1 },
    { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(5).height = 21;
  ws.mergeCells("E5:I5");
  setCell(5, 5, COMPANY_INFO.taxId, normalFont,
    { horizontal: "left", vertical: "center", indent: 1 },
    { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(6).height = 29.25;
  ws.mergeCells("R6:U6");
  setCell(6, 18, "ใบเสนอราคา", { name: "Angsana New", size: 18, bold: true },
    { horizontal: "right", vertical: "center", indent: 1 },
    { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(7).height = 20.25;
  ws.mergeCells("A7:B7");
  setCell(7, 1, "ชื่อลูกค้า  :", normalFont, leftAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("C7:I7");
  setCell(7, 3, quote.customerName || "", normalFont, { horizontal: "left", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("R7:U7");
  setCell(7, 18, "เลขที่ " + (quote.quoteNo || ""), normalFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(8).height = 21;
  ws.mergeCells("A8:B8");
  setCell(8, 1, "ที่อยู่ :", normalFont, leftAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("C8:U8");
  const projectFullText = projectLabel + (customerAddress ? "  " + customerAddress : "") + "  Unit : - (หน่วยนับ : -)";
  setCell(8, 3, projectFullText, normalFont, { horizontal: "left", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(9).height = 15.75;
  ws.mergeCells("A9:B9");
  setCell(9, 1, "โทรศัพท์ :", normalFont, leftAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("C9:K9");
  setCell(9, 3, quote.phone || "", normalFont, { horizontal: "left", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("R9:U9");
  setCell(9, 18, "", normalFont, leftAlign, noBorder);

  ws.getRow(10).height = 15.75;
  ws.mergeCells("M10:O10");
  setCell(10, 13, "วันที่เสนอราคา", normalFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("R10:U10");
  setCell(10, 18, quote.date ? new Date(quote.date) : "", normalFont, { horizontal: "left", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  if (quote.date) ws.getCell(10, 18).numFmt = "d mmm yyyy";

  ws.getRow(11).height = 15;
  ws.mergeCells("E11:I11");
  ws.mergeCells("K11:O11");

  ws.getRow(12).height = 9.75;

  ws.getRow(13).height = 21;
  ws.mergeCells("A13:B13");
  setCell(13, 1, "ลำดับที่", tableHeaderFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("C13:I13");
  setCell(13, 3, "รายการ", tableHeaderFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("J13:M13");
  setCell(13, 10, "จำนวน", tableHeaderFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("N13:O13");
  setCell(13, 14, "หน่วย", tableHeaderFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("P13:R13");
  setCell(13, 16, "หน่วยละ", tableHeaderFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("S13:U13");
  setCell(13, 19, "จำนวนเงิน", tableHeaderFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(14).height = 21;
  ws.mergeCells("A14:B14");
  setCell(14, 1, "No.", smallFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("C14:I14");
  setCell(14, 3, "DESCRIPTION", smallFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("J14:M14");
  setCell(14, 10, "QUANTITY", smallFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("N14:O14");
  setCell(14, 14, "UNIT", smallFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("P14:R14");
  setCell(14, 16, "UNIT PRICE", smallFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells("S14:U14");
  setCell(14, 19, "AMOUNT(BAHT)", smallFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });

  let rowIdx = 15;
  const itemStartRow = rowIdx;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const num = nums[i] || "";
    ws.getRow(rowIdx).height = 19.5;
    if (item.type === "category") {
      ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
      setCell(rowIdx, 1, num, boldFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin }, { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } });
      ws.mergeCells(`C${rowIdx}:I${rowIdx}`);
      setCell(rowIdx, 3, item.name, boldFont, leftAlign, { top: thin, bottom: thin, left: thin, right: thin }, { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } });
      ws.mergeCells(`J${rowIdx}:U${rowIdx}`);
      setCell(rowIdx, 10, "", null, null, noBorder);
      for (let c = 1; c <= 21; c++) {
        if (![1, 3].includes(c)) {
          ws.getCell(rowIdx, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
        }
      }
    } else {
      ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
      setCell(rowIdx, 1, num, normalFont, centerAlign, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`C${rowIdx}:I${rowIdx}`);
      setCell(rowIdx, 3, item.name, normalFont, leftAlign, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`J${rowIdx}:M${rowIdx}`);
      setCell(rowIdx, 10, Number(item.qty), normalFont, { horizontal: "center", vertical: "center" }, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`N${rowIdx}:O${rowIdx}`);
      setCell(rowIdx, 14, item.unit || "", normalFont, { horizontal: "center", vertical: "center" }, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`P${rowIdx}:R${rowIdx}`);
      setCell(rowIdx, 16, Number(item.price), normalFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
      ws.getCell(rowIdx, 16).numFmt = numFmt2;
      ws.mergeCells(`S${rowIdx}:U${rowIdx}`);
      setCell(rowIdx, 19, Number(item.qty) * Number(item.price), normalFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
      ws.getCell(rowIdx, 19).numFmt = numFmt2;
    }
    rowIdx++;
  }

  const minItemRows = 9;
  const itemRows = items.length;
  if (itemRows < minItemRows) {
    for (let i = 0; i < minItemRows - itemRows; i++) {
      ws.getRow(rowIdx).height = 19.5;
      ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
      setCell(rowIdx, 1, "", null, null, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`C${rowIdx}:I${rowIdx}`);
      setCell(rowIdx, 3, "", null, null, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`J${rowIdx}:M${rowIdx}`);
      setCell(rowIdx, 10, "", null, null, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`N${rowIdx}:O${rowIdx}`);
      setCell(rowIdx, 14, "", null, null, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`P${rowIdx}:R${rowIdx}`);
      setCell(rowIdx, 16, "", null, null, { top: thin, bottom: thin, left: thin, right: thin });
      ws.mergeCells(`S${rowIdx}:U${rowIdx}`);
      setCell(rowIdx, 19, "", null, null, { top: thin, bottom: thin, left: thin, right: thin });
      rowIdx++;
    }
  }

  rowIdx++;
  ws.getRow(rowIdx).height = 20.25;
  ws.mergeCells(`A${rowIdx}:I${rowIdx}`);
  setCell(rowIdx, 1, "โครงการ : " + projectLabel, normalFont, leftAlign, noBorder);

  ws.getRow(rowIdx + 1).height = 21;
  ws.mergeCells(`C${rowIdx + 1}:L${rowIdx + 1}`);
  setCell(rowIdx + 1, 3, quote.remarks || "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้", smallFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 1}:R${rowIdx + 1}`);
  setCell(rowIdx + 1, 13, "รวมเงิน", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells(`S${rowIdx + 1}:U${rowIdx + 2}`);
  setCell(rowIdx + 1, 19, subtotal, boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.getCell(rowIdx + 1, 19).numFmt = numFmt2;

  ws.getRow(rowIdx + 2).height = 21;
  ws.mergeCells(`A${rowIdx + 2}:L${rowIdx + 2}`);
  setCell(rowIdx + 2, 1, "กำหนดยื่นราคา 30 วัน นับจากวันที่ยื่นใบเสนอราคา  ", smallFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 2}:R${rowIdx + 2}`);
  setCell(rowIdx + 2, 13, "GROSS TOTAL", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(rowIdx + 3).height = 21;
  const summaryHead = installments.length > 0 ? `งวดงานแบ่งจ่ายเป็น ${installments.length} งวด รวมทั้งหมด  ${formatMoney(grandTotal)} บาท` : "";
  ws.mergeCells(`A${rowIdx + 3}:L${rowIdx + 3}`);
  setCell(rowIdx + 3, 1, summaryHead, smallFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 3}:R${rowIdx + 3}`);
  setCell(rowIdx + 3, 13, "Overhead&Profit", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells(`S${rowIdx + 3}:U${rowIdx + 4}`);
  setCell(rowIdx + 3, 19, overhead, boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.getCell(rowIdx + 3, 19).numFmt = numFmt2;

  ws.getRow(rowIdx + 4).height = 21;
  if (installments[0]) {
    ws.mergeCells(`A${rowIdx + 4}:L${rowIdx + 4}`);
    setCell(rowIdx + 4, 1, `งวดงานที่ 1 ${installments[0].label}  ${Number(installments[0].pct)}%           ${formatMoney(installments[0].amount)} `, smallFont, leftAlign, noBorder);
  } else {
    ws.mergeCells(`A${rowIdx + 4}:L${rowIdx + 4}`);
    setCell(rowIdx + 4, 1, "", smallFont, leftAlign, noBorder);
  }
  ws.mergeCells(`M${rowIdx + 4}:R${rowIdx + 4}`);
  setCell(rowIdx + 4, 13, `${overheadPct}%`, boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(rowIdx + 5).height = 21;
  if (installments[1]) {
    ws.mergeCells(`A${rowIdx + 5}:L${rowIdx + 5}`);
    setCell(rowIdx + 5, 1, `งวดงานที่ 2 ${installments[1].label} ${Number(installments[1].pct)}%     ${formatMoney(installments[1].amount)} บาท `, smallFont, leftAlign, noBorder);
  } else {
    ws.mergeCells(`A${rowIdx + 5}:L${rowIdx + 5}`);
    setCell(rowIdx + 5, 1, "", smallFont, leftAlign, noBorder);
  }
  ws.mergeCells(`M${rowIdx + 5}:R${rowIdx + 5}`);
  setCell(rowIdx + 5, 13, "รวมเป็นเงิน", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells(`S${rowIdx + 5}:U${rowIdx + 6}`);
  setCell(rowIdx + 5, 19, subtotalWithOverhead, boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.getCell(rowIdx + 5, 19).numFmt = numFmt2;

  ws.getRow(rowIdx + 6).height = 21;
  ws.mergeCells(`A${rowIdx + 6}:L${rowIdx + 6}`);
  setCell(rowIdx + 6, 1, "ช่องทางการชำระเงิน ", smallFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 6}:R${rowIdx + 6}`);
  setCell(rowIdx + 6, 13, "GROSS TOTAL", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(rowIdx + 7).height = 21;
  ws.mergeCells(`A${rowIdx + 7}:L${rowIdx + 7}`);
  setCell(rowIdx + 7, 1, "สั่งจ่ายในนาม " + (quote.payeeName || subcontractorName || "-"), smallFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 7}:R${rowIdx + 7}`);
  setCell(rowIdx + 7, 13, "ภาษีมูลค่าเพิ่ม 7%", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells(`S${rowIdx + 7}:U${rowIdx + 8}`);
  setCell(rowIdx + 7, 19, vat, boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.getCell(rowIdx + 7, 19).numFmt = numFmt2;

  ws.getRow(rowIdx + 8).height = 21;
  ws.mergeCells(`A${rowIdx + 8}:L${rowIdx + 8}`);
  setCell(rowIdx + 8, 1, COMPANY_INFO.bank, smallFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 8}:R${rowIdx + 8}`);
  setCell(rowIdx + 8, 13, "VAT  7%", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  ws.getRow(rowIdx + 9).height = 23.25;
  ws.mergeCells(`A${rowIdx + 9}:L${rowIdx + 10}`);
  setCell(rowIdx + 9, 1, thaiBahtText(grandTotal), boldFont, leftAlign, noBorder);
  ws.mergeCells(`M${rowIdx + 9}:R${rowIdx + 9}`);
  setCell(rowIdx + 9, 13, "ยอดเงินสุทธิ", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.mergeCells(`S${rowIdx + 9}:U${rowIdx + 10}`);
  setCell(rowIdx + 9, 19, grandTotal, netGrossFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });
  ws.getCell(rowIdx + 9, 19).numFmt = numFmt2;
  ws.getRow(rowIdx + 10).height = 36;
  ws.mergeCells(`M${rowIdx + 10}:R${rowIdx + 10}`);
  setCell(rowIdx + 10, 13, "NET GROSS", boldFont, { horizontal: "right", vertical: "center", indent: 1 }, { top: thin, bottom: thin, left: thin, right: thin });

  const sepRow = rowIdx + 11;
  ws.getRow(sepRow).height = 21;
  ws.mergeCells(`A${sepRow}:U${sepRow}`);
  setCell(sepRow, 1, ".", smallFont, { horizontal: "center", vertical: "center" }, noBorder);

  const sigRow = sepRow + 1;
  ws.getRow(sigRow).height = 21;
  ws.mergeCells(`A${sigRow}:G${sigRow}`);
  setCell(sigRow, 1, "ได้รับสินค้าถูกต้องเรียบร้อยแล้ว", boldFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`H${sigRow}:K${sigRow}`);
  setCell(sigRow, 8, "ผู้ตรวจสอบ", boldFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`L${sigRow}:U${sigRow}`);
  setCell(sigRow, 12, "ในนาม", boldFont, { horizontal: "center", vertical: "center" }, noBorder);

  ws.getRow(sigRow + 1).height = 21;
  ws.mergeCells(`A${sigRow + 1}:G${sigRow + 1}`);
  setCell(sigRow + 1, 1, "Received The Above Goods in Good Conidition", smallFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`H${sigRow + 1}:K${sigRow + 1}`);
  setCell(sigRow + 1, 8, "Verify  By", smallFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`L${sigRow + 1}:U${sigRow + 1}`);
  setCell(sigRow + 1, 12, subcontractorName, boldFont, { horizontal: "center", vertical: "center" }, noBorder);

  ws.getRow(sigRow + 2).height = 23.25;

  ws.getRow(sigRow + 3).height = 36;
  ws.mergeCells(`A${sigRow + 3}:G${sigRow + 3}`);
  setCell(sigRow + 3, 1, ".....................................................", smallFont, { horizontal: "center", vertical: "bottom" }, noBorder);
  ws.mergeCells(`H${sigRow + 3}:K${sigRow + 3}`);
  setCell(sigRow + 3, 8, ".....................................................", smallFont, { horizontal: "center", vertical: "bottom" }, noBorder);
  ws.mergeCells(`L${sigRow + 3}:U${sigRow + 3}`);
  setCell(sigRow + 3, 12, ".....................................................", smallFont, { horizontal: "center", vertical: "bottom" }, noBorder);

  ws.getRow(sigRow + 4).height = 18.75;
  ws.mergeCells(`A${sigRow + 4}:G${sigRow + 4}`);
  setCell(sigRow + 4, 1, "ผู้รับวางบิล         ", boldFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`L${sigRow + 4}:U${sigRow + 4}`);
  setCell(sigRow + 4, 12, "ผู้เสนอราคา", boldFont, { horizontal: "center", vertical: "center" }, noBorder);

  ws.getRow(sigRow + 5).height = 36;
  ws.mergeCells(`A${sigRow + 5}:G${sigRow + 5}`);
  setCell(sigRow + 5, 1, "……………/………………./……………..", smallFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`H${sigRow + 5}:K${sigRow + 5}`);
  setCell(sigRow + 5, 8, "……………/………………./……………..", smallFont, { horizontal: "center", vertical: "center" }, noBorder);
  ws.mergeCells(`L${sigRow + 5}:U${sigRow + 5}`);
  setCell(sigRow + 5, 12, " ……………/………………../…………...", smallFont, { horizontal: "center", vertical: "center" }, noBorder);

  const buf = await wb.xlsx.writeBuffer();
  await writeFile(process.argv[2] || "output.xlsx", Buffer.from(buf));
  console.log(`Wrote ${process.argv[2]}`);
}

buildExcelBlob(sampleQuote).catch(e => { console.error(e); process.exit(1); });