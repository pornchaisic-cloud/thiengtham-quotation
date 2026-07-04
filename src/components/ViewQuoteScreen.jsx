import { useState } from "react";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Header from "./Header";
import { saveFileToDevice, shareFileNative, isNative } from "../utils/fileHelper";
import { COMPANY_INFO, formatMoney, thaiDateStr, getItemNumbers, thaiBahtText, SCREENS } from "../utils/helpers";
import { btnSm, SumRow } from "../utils/styles.jsx";

export default function ViewQuoteScreen({ quote, navTo, deleteQuote, showToast }) {
  const [lightbox, setLightbox] = useState(null);
  const [showExportBtn, setShowExportBtn] = useState(false);

  const imageAttachments = (quote.attachments || []).filter(a => a.isImage);
  const fileAttachments = (quote.attachments || []).filter(a => !a.isImage);

  async function buildExcelBlob() {
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

    const thaiDate = thaiDateStr(quote.date);

    // ── Column widths (from reference.xlsx) ───────────────────────
    ws.columns = [
      { width: 5.140625 },    // A
      { width: 3.85546875 },  // B
      { width: 4.7109375 },   // C
      { width: 4.140625 },    // D
      { width: 4 },           // E
      { width: 4.7109375 },   // F
      { width: 13.28515625 }, // G
      { width: 12.7109375 },  // H
      { width: 14 },          // I
      { width: 4.140625 },    // J
      { width: 5 },           // K
      { width: 3 },           // L
      { width: 4 },           // M
      { width: 3 },           // N
      { width: 4 },           // O
      { width: 2.42578125 },  // P
      { width: 2.7109375 },   // Q
      { width: 7 },           // R
      { width: 4.7109375 },   // S
      { width: 3.42578125 },  // T
      { width: 13.28515625 }, // U
    ];

    // ── Font / Border / Align presets ─────────────────────────────
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

    // ── Row 1: spacer (matches reference rowHeight 21.75) ─────────
    ws.getRow(1).height = 21.75;

    // ── Row 2: subcontractor name top-right (D2:G2) ───────────────
    ws.getRow(2).height = 21.75;
    ws.mergeCells("D2:G2");
    setCell(2, 4, subcontractorName, boldFont,
      { horizontal: "center", vertical: "center" },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 3: company address (A3:U3) ────────────────────────────
    ws.getRow(3).height = 35.25;
    ws.mergeCells("A3:U3");
    setCell(3, 1, COMPANY_INFO.address, normalFont,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 4: company phone (A4:U4) — rich-text-like bold ────────
    ws.getRow(4).height = 21;
    ws.mergeCells("A4:U4");
    setCell(4, 1, { richText: [{ text: "โทร. ", font: { bold: true, size: 16, name: "Angsana New" } }, { text: COMPANY_INFO.phone, font: { size: 16, name: "Angsana New" } }] },
      null,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 5: tax ID (E5:I5) ─────────────────────────────────────
    ws.getRow(5).height = 21;
    ws.mergeCells("E5:I5");
    setCell(5, 5, COMPANY_INFO.taxId, normalFont,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 6: "ใบเสนอราคา" title (R6:U6) ────────────────────────
    ws.getRow(6).height = 29.25;
    ws.mergeCells("R6:U6");
    setCell(6, 18, "ใบเสนอราคา", { name: "Angsana New", size: 18, bold: true },
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 7: ชื่อลูกค้า + เลขที่ ───────────────────────────────
    ws.getRow(7).height = 20.25;
    ws.mergeCells("A7:B7");
    setCell(7, 1, "ชื่อลูกค้า  :", normalFont, leftAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("C7:I7");
    setCell(7, 3, quote.customerName || "", normalFont,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("R7:U7");
    setCell(7, 18, "เลขที่ " + (quote.quoteNo || ""), normalFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 8: ที่อยู่ + project location ────────────────────────
    ws.getRow(8).height = 21;
    ws.mergeCells("A8:B8");
    setCell(8, 1, "ที่อยู่ :", normalFont, leftAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("C8:U8");
    // Reference stores project in the address slot; append customer's actual address if different.
    const addrPart = customerAddress && customerAddress !== projectLabel ? "  " + customerAddress : "";
    const projectFullText = projectLabel + addrPart + "  Unit : - (หน่วยนับ : -)";
    setCell(8, 3, projectFullText, normalFont,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 9: โทรศัพท์ + (blank right) ──────────────────────────
    ws.getRow(9).height = 15.75;
    ws.mergeCells("A9:B9");
    setCell(9, 1, "โทรศัพท์ :", normalFont, leftAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("C9:K9");
    setCell(9, 3, quote.phone || "", normalFont,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("R9:U9");
    setCell(9, 18, "", normalFont, leftAlign, noBorder);

    // ── Row 10: วันที่เสนอราคา ──────────────────────────────────
    ws.getRow(10).height = 15.75;
    ws.mergeCells("M10:O10");
    setCell(10, 13, "วันที่เสนอราคา", normalFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("R10:U10");
    setCell(10, 18, quote.date ? new Date(quote.date) : "", normalFont,
      { horizontal: "left", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    if (quote.date) ws.getCell(10, 18).numFmt = "d mmm yyyy";

    // ── Row 11: spacer (height 15) ──────────────────────────────
    ws.getRow(11).height = 15;
    ws.mergeCells("E11:I11");
    ws.mergeCells("K11:O11");

    // ── Row 12: thin spacer (height 9.75) ───────────────────────
    ws.getRow(12).height = 9.75;

    // ── Row 13: column headers TH ───────────────────────────────
    ws.getRow(13).height = 21;
    ws.mergeCells("A13:B13");
    setCell(13, 1, "ลำดับที่", tableHeaderFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("C13:I13");
    setCell(13, 3, "รายการ", tableHeaderFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("J13:M13");
    setCell(13, 10, "จำนวน", tableHeaderFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("N13:O13");
    setCell(13, 14, "หน่วย", tableHeaderFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("P13:R13");
    setCell(13, 16, "หน่วยละ", tableHeaderFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("S13:U13");
    setCell(13, 19, "จำนวนเงิน", tableHeaderFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 14: column headers EN ───────────────────────────────
    ws.getRow(14).height = 21;
    ws.mergeCells("A14:B14");
    setCell(14, 1, "No.", smallFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("C14:I14");
    setCell(14, 3, "DESCRIPTION", smallFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("J14:M14");
    setCell(14, 10, "QUANTITY", smallFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("N14:O14");
    setCell(14, 14, "UNIT", smallFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("P14:R14");
    setCell(14, 16, "UNIT PRICE", smallFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells("S14:U14");
    setCell(14, 19, "AMOUNT(BAHT)", smallFont, centerAlign,
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Items rows (start at row 15) ────────────────────────────
    let rowIdx = 15;
    const itemStartRow = rowIdx;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const num = nums[i] || "";
      ws.getRow(rowIdx).height = 19.5;
      if (item.type === "category") {
        ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
        setCell(rowIdx, 1, num, boldFont, centerAlign,
          { top: thin, bottom: thin, left: thin, right: thin },
          { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } });
        ws.mergeCells(`C${rowIdx}:I${rowIdx}`);
        setCell(rowIdx, 3, item.name, boldFont, leftAlign,
          { top: thin, bottom: thin, left: thin, right: thin },
          { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } });
        ws.mergeCells(`J${rowIdx}:U${rowIdx}`);
        setCell(rowIdx, 10, "", null, null, noBorder);
        // add light fill across
        for (let c = 1; c <= 21; c++) {
          if (![1, 3].includes(c)) {
            ws.getCell(rowIdx, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
          }
        }
      } else {
        ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
        setCell(rowIdx, 1, num, normalFont, centerAlign,
          { top: thin, bottom: thin, left: thin, right: thin });
        ws.mergeCells(`C${rowIdx}:I${rowIdx}`);
        setCell(rowIdx, 3, item.name, normalFont, leftAlign,
          { top: thin, bottom: thin, left: thin, right: thin });
        ws.mergeCells(`J${rowIdx}:M${rowIdx}`);
        setCell(rowIdx, 10, Number(item.qty), normalFont,
          { horizontal: "center", vertical: "center" },
          { top: thin, bottom: thin, left: thin, right: thin });
        ws.mergeCells(`N${rowIdx}:O${rowIdx}`);
        setCell(rowIdx, 14, item.unit || "", normalFont,
          { horizontal: "center", vertical: "center" },
          { top: thin, bottom: thin, left: thin, right: thin });
        ws.mergeCells(`P${rowIdx}:R${rowIdx}`);
        setCell(rowIdx, 16, Number(item.price), normalFont,
          { horizontal: "right", vertical: "center", indent: 1 },
          { top: thin, bottom: thin, left: thin, right: thin });
        ws.getCell(rowIdx, 16).numFmt = numFmt2;
        ws.mergeCells(`S${rowIdx}:U${rowIdx}`);
        setCell(rowIdx, 19, Number(item.qty) * Number(item.price), normalFont,
          { horizontal: "right", vertical: "center", indent: 1 },
          { top: thin, bottom: thin, left: thin, right: thin });
        ws.getCell(rowIdx, 19).numFmt = numFmt2;
      }
      rowIdx++;
    }

    // Pad up to 9 item rows (matching reference which has 9 data rows including categories)
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
    const itemEndRow = rowIdx - 1;
    const sumRange = `S${itemStartRow}:U${itemEndRow}`;

    // ── Row 25: โครงการ : project ───────────────────────────────
    rowIdx++;
    ws.getRow(rowIdx).height = 20.25;
    ws.mergeCells(`A${rowIdx}:I${rowIdx}`);
    setCell(rowIdx, 1, "โครงการ : " + projectLabel, normalFont, leftAlign, noBorder);

    // ── Row 26: remarks + รวมเงิน / GROSS TOTAL ──────────────────
    ws.getRow(rowIdx + 1).height = 21;
    ws.mergeCells(`C${rowIdx + 1}:L${rowIdx + 1}`);
    setCell(rowIdx + 1, 3, quote.remarks || "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้", smallFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 1}:R${rowIdx + 1}`);
    setCell(rowIdx + 1, 13, "รวมเงิน", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells(`S${rowIdx + 1}:U${rowIdx + 2}`);
    setCell(rowIdx + 1, 19, subtotal, boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.getCell(rowIdx + 1, 19).numFmt = numFmt2;

    // ── Row 27: กำหนดยื่นราคา + GROSS TOTAL (label) ─────────────
    ws.getRow(rowIdx + 2).height = 21;
    ws.mergeCells(`A${rowIdx + 2}:L${rowIdx + 2}`);
    setCell(rowIdx + 2, 1, "กำหนดยื่นราคา 30 วัน นับจากวันที่ยื่นใบเสนอราคา  ", smallFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 2}:R${rowIdx + 2}`);
    setCell(rowIdx + 2, 13, "GROSS TOTAL", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 28: installment summary + Overhead&Profit ────────────
    ws.getRow(rowIdx + 3).height = 21;
    const summaryHead = installments.length > 0
      ? `งวดงานแบ่งจ่ายเป็น ${installments.length} งวด รวมทั้งหมด  ${formatMoney(grandTotal)} บาท`
      : "";
    ws.mergeCells(`A${rowIdx + 3}:L${rowIdx + 3}`);
    setCell(rowIdx + 3, 1, summaryHead, smallFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 3}:R${rowIdx + 3}`);
    setCell(rowIdx + 3, 13, "Overhead&Profit", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells(`S${rowIdx + 3}:U${rowIdx + 4}`);
    setCell(rowIdx + 3, 19, overhead, boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.getCell(rowIdx + 3, 19).numFmt = numFmt2;

    // ── Row 29: installment 1 (or blank) + O&P% ─────────────────
    ws.getRow(rowIdx + 4).height = 21;
    if (installments[0]) {
      ws.mergeCells(`A${rowIdx + 4}:L${rowIdx + 4}`);
      setCell(rowIdx + 4, 1,
        `งวดงานที่ 1 ${installments[0].label}  ${Number(installments[0].pct)}%           ${formatMoney(installments[0].amount)} `,
        smallFont, leftAlign, noBorder);
    } else {
      ws.mergeCells(`A${rowIdx + 4}:L${rowIdx + 4}`);
      setCell(rowIdx + 4, 1, "", smallFont, leftAlign, noBorder);
    }
    ws.mergeCells(`M${rowIdx + 4}:R${rowIdx + 4}`);
    setCell(rowIdx + 4, 13, `${overheadPct}%`, boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 30: installment 2 (or blank) + รวมเป็นเงิน ───────────
    ws.getRow(rowIdx + 5).height = 21;
    if (installments[1]) {
      ws.mergeCells(`A${rowIdx + 5}:L${rowIdx + 5}`);
      setCell(rowIdx + 5, 1,
        `งวดงานที่ 2 ${installments[1].label} ${Number(installments[1].pct)}%     ${formatMoney(installments[1].amount)} บาท `,
        smallFont, leftAlign, noBorder);
    } else {
      ws.mergeCells(`A${rowIdx + 5}:L${rowIdx + 5}`);
      setCell(rowIdx + 5, 1, "", smallFont, leftAlign, noBorder);
    }
    ws.mergeCells(`M${rowIdx + 5}:R${rowIdx + 5}`);
    setCell(rowIdx + 5, 13, "รวมเป็นเงิน", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells(`S${rowIdx + 5}:U${rowIdx + 6}`);
    setCell(rowIdx + 5, 19, subtotalWithOverhead, boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.getCell(rowIdx + 5, 19).numFmt = numFmt2;

    // ── Row 31: ช่องทางการชำระเงิน + GROSS TOTAL (label) ────────
    ws.getRow(rowIdx + 6).height = 21;
    ws.mergeCells(`A${rowIdx + 6}:L${rowIdx + 6}`);
    setCell(rowIdx + 6, 1, "ช่องทางการชำระเงิน ", smallFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 6}:R${rowIdx + 6}`);
    setCell(rowIdx + 6, 13, "GROSS TOTAL", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 32: สั่งจ่ายในนาม + ภาษีมูลค่าเพิ่ม 7% ─────────────
    ws.getRow(rowIdx + 7).height = 21;
    ws.mergeCells(`A${rowIdx + 7}:L${rowIdx + 7}`);
    setCell(rowIdx + 7, 1, "สั่งจ่ายในนาม " + (quote.payeeName || subcontractorName || "-"), smallFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 7}:R${rowIdx + 7}`);
    setCell(rowIdx + 7, 13, "ภาษีมูลค่าเพิ่ม 7%", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells(`S${rowIdx + 7}:U${rowIdx + 8}`);
    setCell(rowIdx + 7, 19, vat, boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.getCell(rowIdx + 7, 19).numFmt = numFmt2;

    // ── Row 33: bank + VAT 7% ───────────────────────────────────
    ws.getRow(rowIdx + 8).height = 21;
    ws.mergeCells(`A${rowIdx + 8}:L${rowIdx + 8}`);
    setCell(rowIdx + 8, 1, COMPANY_INFO.bank, smallFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 8}:R${rowIdx + 8}`);
    setCell(rowIdx + 8, 13, "VAT  7%", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 34-35: Thai Baht text + ยอดเงินสุทธิ / NET GROSS ─────
    ws.getRow(rowIdx + 9).height = 23.25;
    ws.mergeCells(`A${rowIdx + 9}:L${rowIdx + 10}`);
    setCell(rowIdx + 9, 1, thaiBahtText(grandTotal), boldFont, leftAlign, noBorder);
    ws.mergeCells(`M${rowIdx + 9}:R${rowIdx + 9}`);
    setCell(rowIdx + 9, 13, "ยอดเงินสุทธิ", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.mergeCells(`S${rowIdx + 9}:U${rowIdx + 10}`);
    setCell(rowIdx + 9, 19, grandTotal, netGrossFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });
    ws.getCell(rowIdx + 9, 19).numFmt = numFmt2;
    ws.getRow(rowIdx + 10).height = 36;
    ws.mergeCells(`M${rowIdx + 10}:R${rowIdx + 10}`);
    setCell(rowIdx + 10, 13, "NET GROSS", boldFont,
      { horizontal: "right", vertical: "center", indent: 1 },
      { top: thin, bottom: thin, left: thin, right: thin });

    // ── Row 36: separator ────────────────────────────────────────
    const sepRow = rowIdx + 11;
    ws.getRow(sepRow).height = 21;
    ws.mergeCells(`A${sepRow}:U${sepRow}`);
    setCell(sepRow, 1, ".", smallFont,
      { horizontal: "center", vertical: "center" }, noBorder);

    // ── Row 37: section labels (TH) ─────────────────────────────
    const sigRow = sepRow + 1;
    ws.getRow(sigRow).height = 21;
    ws.mergeCells(`A${sigRow}:G${sigRow}`);
    setCell(sigRow, 1, "ได้รับสินค้าถูกต้องเรียบร้อยแล้ว", boldFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`H${sigRow}:K${sigRow}`);
    setCell(sigRow, 8, "ผู้ตรวจสอบ", boldFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`L${sigRow}:U${sigRow}`);
    setCell(sigRow, 12, "ในนาม", boldFont,
      { horizontal: "center", vertical: "center" }, noBorder);

    // ── Row 38: section labels (EN) + subcontractor name ────────
    ws.getRow(sigRow + 1).height = 21;
    ws.mergeCells(`A${sigRow + 1}:G${sigRow + 1}`);
    setCell(sigRow + 1, 1, "Received The Above Goods in Good Conidition", smallFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`H${sigRow + 1}:K${sigRow + 1}`);
    setCell(sigRow + 1, 8, "Verify  By", smallFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`L${sigRow + 1}:U${sigRow + 1}`);
    setCell(sigRow + 1, 12, subcontractorName, boldFont,
      { horizontal: "center", vertical: "center" }, noBorder);

    // ── Row 39: spacer (height 23.25) ────────────────────────────
    ws.getRow(sigRow + 2).height = 23.25;

    // ── Row 40: signature lines ──────────────────────────────────
    ws.getRow(sigRow + 3).height = 36;
    ws.mergeCells(`A${sigRow + 3}:G${sigRow + 3}`);
    setCell(sigRow + 3, 1, ".....................................................",
      smallFont, { horizontal: "center", vertical: "bottom" }, noBorder);
    ws.mergeCells(`H${sigRow + 3}:K${sigRow + 3}`);
    setCell(sigRow + 3, 8, ".....................................................",
      smallFont, { horizontal: "center", vertical: "bottom" }, noBorder);
    ws.mergeCells(`L${sigRow + 3}:U${sigRow + 3}`);
    setCell(sigRow + 3, 12, ".....................................................",
      smallFont, { horizontal: "center", vertical: "bottom" }, noBorder);

    // ── Row 41: section role labels ──────────────────────────────
    ws.getRow(sigRow + 4).height = 18.75;
    ws.mergeCells(`A${sigRow + 4}:G${sigRow + 4}`);
    setCell(sigRow + 4, 1, "ผู้รับวางบิล         ", boldFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`L${sigRow + 4}:U${sigRow + 4}`);
    setCell(sigRow + 4, 12, "ผู้เสนอราคา", boldFont,
      { horizontal: "center", vertical: "center" }, noBorder);

    // ── Row 42: date lines ───────────────────────────────────────
    ws.getRow(sigRow + 5).height = 36;
    ws.mergeCells(`A${sigRow + 5}:G${sigRow + 5}`);
    setCell(sigRow + 5, 1, "……………/………………./……………..", smallFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`H${sigRow + 5}:K${sigRow + 5}`);
    setCell(sigRow + 5, 8, "……………/………………./……………..", smallFont,
      { horizontal: "center", vertical: "center" }, noBorder);
    ws.mergeCells(`L${sigRow + 5}:U${sigRow + 5}`);
    setCell(sigRow + 5, 12, " ……………/………………../…………...", smallFont,
      { horizontal: "center", vertical: "center" }, noBorder);

    // ── Done ─────────────────────────────────────────────────────
    const wbout = await wb.xlsx.writeBuffer();
    const cleanProject = (quote.project || "ใบเสนอราคา").replace(/[<>:"/\\|?*]/g, "").trim();
    const filename = `${quote.quoteNo} ${cleanProject}.xlsx`;
    return { blob: new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename };
  }

  async function handleExcelDownload() {
    try {
      showToast("⏳ กำลังเตรียมไฟล์ Excel...", "info");
      const { blob: excelBlob, filename } = await buildExcelBlob();
      if (isNative()) {
        setShowExportBtn(false);
        await saveFileToDevice(excelBlob, filename, showToast, setShowExportBtn);
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

  async function buildPdfBlob() {
    const grandTotal = Number(quote.grandTotal || 0);
    const subtotal = Number(quote.subtotal || 0);
    const overhead = Number(quote.overhead || 0);
    const overheadPct = Number(quote.overheadPct || 0);
    const vat = Number(quote.vat || 0);
    const installments = (quote.paymentInstallments || []).map(inst => ({
      ...inst, amount: grandTotal * (Number(inst.pct) / 100)
    }));
    const installmentsHtml = installments.map((inst, i) => {
      // format เหมือนใบเสนอราคาจริง (QN 26):
      //   งวดงานที่ N <label>  <pct>%           <amount> บาท
      const label = inst.label || "";
      const padAfterLabel = label.length <= 12 ? "  " : " ";
      const padBeforeAmount = label.length <= 12 ? "           " : "     ";
      return `<div>งวดงานที่ ${i + 1} ${label}${padAfterLabel}${Number(inst.pct)}%${padBeforeAmount}${formatMoney(inst.amount)} บาท</div>`;
    }).join("");

    const itemsHtml = (() => { const nums = getItemNumbers(quote.items); return (quote.items || []).map((item, i) =>
      item.type === "category"
        ? `<tr style="background:#f2f2f2"><td style="border:1px solid #000;padding:5px;font-size:10px;font-weight:700;text-align:center">${nums[i]}</td><td style="border:1px solid #000;padding:5px;font-size:10px;font-weight:700" colspan="5">${item.name}</td></tr>`
        : `<tr>
        <td style="text-align:center;border:1px solid #000;padding:5px;font-size:10px">${nums[i]}</td>
        <td style="border:1px solid #000;padding:5px;font-size:10px">${item.name}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;font-size:10px">${item.qty}</td>
        <td style="text-align:center;border:1px solid #000;padding:5px;font-size:10px">${item.unit}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;font-size:10px">${formatMoney(item.price)}</td>
        <td style="text-align:right;border:1px solid #000;padding:5px;font-size:10px;font-weight:600">${formatMoney(Number(item.qty)*Number(item.price))}</td>
      </tr>`
    ).join(""); })();

    const logoHtml = quote.logo
      ? `<img src="${quote.logo}" style="height:50px;object-fit:contain" crossorigin="anonymous">`
      : `<div style="width:50px;height:50px;background:#c8a96e;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:700;font-size:12px">TT</div>`;

    const sigImg = quote.signature ? `<img src="${quote.signature}" style="height:36px;object-fit:contain"><br>` : "";

    const html = `<div id="__pdf_root" style="width:720px; background:#fff; padding:24px 32px; font-family:'Sarabun','Angsana New',sans-serif; color:#000; box-sizing:border-box">
  <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:flex-start">
    <div style="display:flex; gap:12px; flex:1">
      ${logoHtml}
      <div style="flex:1">
        <div style="font-weight:700; font-size:15px; color:#000">${COMPANY_INFO.name}</div>
        <div style="font-size:9px; line-height:1.5; color:#333">
          ${COMPANY_INFO.address}<br>
          โทร: ${COMPANY_INFO.phone} | เลขประจำตัวผู้เสียภาษี: ${COMPANY_INFO.taxId}
        </div>
      </div>
    </div>
    <div style="text-align:right; width:180px">
      <div style="font-size:18px; font-weight:700; margin-bottom:2px">ใบเสนอราคา</div>
      <div style="font-size:11px; font-weight:700; color:#666">QUOTATION</div>
      <div style="font-size:9px; margin-top:6px"><b>เลขที่</b> ${quote.quoteNo}</div>
      <div style="font-size:9px"><b>วันที่เสนอราคา :</b> ${thaiDateStr(quote.date)}</div>
    </div>
  </div>
  <div style="border:1px solid #000; padding:8px 10px; margin-bottom:10px; font-size:10px; line-height:1.6">
    <div style="display:flex; margin-bottom:2px">
      <div style="width:95px"><b>ชื่อลูกค้า  :</b></div>
      <div style="flex:1; border-bottom:1px dotted #000">${quote.customerName || ""}</div>
      <div style="width:55px; text-align:right; padding-right:6px"><b>โทรศัพท์ :</b></div>
      <div style="width:120px; border-bottom:1px dotted #000">${quote.phone || ""}</div>
    </div>
    <div style="display:flex; margin-bottom:2px">
      <div style="width:95px"><b>ที่อยู่ :</b></div>
      <div style="flex:1; border-bottom:1px dotted #000">${quote.address || ""}</div>
    </div>
    <div style="display:flex">
      <div style="width:95px"><b>โครงการ :</b></div>
      <div style="flex:1; border-bottom:1px dotted #000">${quote.project || ""}</div>
    </div>
  </div>
  <table style="width:100%; border-collapse:collapse; margin-bottom:6px; border:1px solid #000">
    <thead><tr style="background:#f2f2f2">
      <th style="border:1px solid #000; padding:5px; font-size:9px; width:6%">ลำดับ<br>No.</th>
      <th style="border:1px solid #000; padding:5px; font-size:9px; text-align:left">รายการ / DESCRIPTION</th>
      <th style="border:1px solid #000; padding:5px; font-size:9px; width:8%">ปริมาณ<br>QTY</th>
      <th style="border:1px solid #000; padding:5px; font-size:9px; width:7%">หน่วย<br>UNIT</th>
      <th style="border:1px solid #000; padding:5px; font-size:9px; width:14%; text-align:right">ราคาต่อหน่วย<br>UNIT PRICE</th>
      <th style="border:1px solid #000; padding:5px; font-size:9px; width:17%; text-align:right">จำนวนเงิน<br>AMOUNT(BAHT)</th>
    </tr></thead>
    <tbody>
      ${itemsHtml}
      ${Array(Math.max(0, 10 - (quote.items?.length || 0))).fill(0).map(() => `<tr><td style="border-left:1px solid #000;border-right:1px solid #000;height:22px"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td><td style="border-right:1px solid #000"></td></tr>`).join("")}
    </tbody>
  </table>
  <div style="display:flex; justify-content:space-between; margin-bottom:8px">
    <div style="flex:1; font-size:9px; padding-right:12px; line-height:1.5; vertical-align:top">
      <div style="background:#f5f5f5; padding:4px 6px; margin-bottom:4px"><b>ตัวอักษร:</b> ${thaiBahtText(grandTotal)}</div>
      <div><b>หมายเหตุ  :</b> ${quote.remarks || "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้"}</div>
      <div><b>กำหนดยื่นราคา 30 วัน นับจากวันที่ยื่นใบเสนอราคา</b></div>
      ${installments.length > 0 ? `<div><b>งวดงานแบ่งจ่ายเป็น ${installments.length} งวด รวมทั้งหมด ${formatMoney(grandTotal)} บาท</b></div>` : ''}
      ${installmentsHtml || (quote.paymentTerms || "-")}
      <div style="margin-top:4px">ช่องทางการชำระเงิน </div>
      <div>สั่งจ่ายในนาม ${quote.payeeName || COMPANY_INFO.subcontractorName || "-"}</div>
      <div>${COMPANY_INFO.bank}</div>
    </div>
    <div style="width:200px; font-size:9px">
      <table style="width:100%; border-collapse:collapse">
        <tr><td style="padding:3px 4px; text-align:right">รวมเงิน / GROSS TOTAL</td><td style="padding:3px 4px; text-align:right; width:80px">${formatMoney(subtotal)}</td></tr>
        ${overhead > 0 ? `<tr><td style="padding:3px 4px; text-align:right">Overhead&Profit (${overheadPct}%)</td><td style="padding:3px 4px; text-align:right">${formatMoney(overhead)}</td></tr>` : ""}
        ${overhead > 0 ? `<tr><td style="padding:3px 4px; text-align:right">รวมเป็นเงิน</td><td style="padding:3px 4px; text-align:right">${formatMoney(subtotal + overhead)}</td></tr>` : ""}
        ${overhead > 0 ? `<tr><td style="padding:3px 4px; text-align:right">GROSS TOTAL</td><td style="padding:3px 4px; text-align:right"></td></tr>` : ""}
        ${vat > 0 ? `<tr><td style="padding:3px 4px; text-align:right">ภาษีมูลค่าเพิ่ม 7%</td><td style="padding:3px 4px; text-align:right">${formatMoney(vat)}</td></tr>` : ""}
        ${vat > 0 ? `<tr><td style="padding:3px 4px; text-align:right">VAT 7%</td><td style="padding:3px 4px; text-align:right"></td></tr>` : ""}
        <tr style="font-weight:700; border-top:1px solid #000; background:#f2f2f2">
          <td style="padding:4px; text-align:right">ยอดเงินสุทธิ / NET GROSS</td>
          <td style="padding:4px; text-align:right; font-size:11px">฿${formatMoney(grandTotal)}</td>
        </tr>
      </table>
    </div>
  </div>
  <div style="display:flex; justify-content:space-between; margin-top:16px; font-size:9px">
    <div style="text-align:center; width:30%">
       <div>ได้รับสินค้าถูกต้องเรียบร้อยแล้ว</div>
       <div style="font-size:8px; color:#666">Received The Above Goods in Good Conidition</div>
       <div style="margin-top:24px">.....................................................</div>
       <div>ผู้รับวางบิล</div>
       <div style="margin-top:3px">...../......./.......</div>
    </div>
    <div style="text-align:center; width:30%">
       <div>ผู้ตรวจสอบ</div>
       <div style="font-size:8px; color:#666">Verify By</div>
       <div style="margin-top:24px">.....................................................</div>
       <div style="margin-top:3px">...../......./.......</div>
    </div>
    <div style="text-align:center; width:30%">
       <div>ในนาม</div>
       <div style="margin-top:5px; height:25px">${sigImg}</div>
       <div style="margin-bottom:5px">${quote.payeeName || COMPANY_INFO.subcontractorName || ""}</div>
       <div>.....................................................</div>
       <div>ผู้เสนอราคา</div>
       <div style="margin-top:3px">...../......./.......</div>
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

  async function handlePdfDownload() {
    try {
      showToast("⏳ กำลังเตรียมไฟล์ PDF...", "info");
      const { blob: pdfBlob, filename } = await buildPdfBlob();
      if (isNative()) {
        setShowExportBtn(false);
        await saveFileToDevice(pdfBlob, filename, showToast, setShowExportBtn);
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
          <div style={{ position: "absolute", top: 16, right: 16 }}>
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
          <SumRow label="GROSS TOTAL" value={formatMoney(quote.subtotal)} />
          {quote.overhead > 0 && <SumRow label={`Overhead&Profit (${quote.overheadPct}%)`} value={formatMoney(quote.overhead)} />}
          {Number(quote.overhead) > 0 && <SumRow label="GROSS TOTAL (incl O&P)" value={formatMoney(Number(quote.subtotal) + Number(quote.overhead))} />}
          {quote.discountAmt > 0 && <SumRow label="ส่วนลด" value={"-" + formatMoney(quote.discountAmt)} />}
          {quote.vat > 0 && <SumRow label="VAT 7%" value={formatMoney(quote.vat)} />}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e1e1e", paddingTop: 10, marginTop: 10 }}>
            <span style={{ fontWeight: 700, color: "#e8e8e8" }}>NET GROSS</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: "#c8a96e" }}>฿{formatMoney(quote.grandTotal)}</span>
          </div>
        </div>

        {quote.remarks && <div style={{ fontSize: 12, color: "#666", marginBottom: 12, background: "#0d0d0d", padding: "10px 12px", borderRadius: 8, border: "1px solid #1a1a1a" }}>📝 {quote.remarks}</div>}
        {(quote.paymentInstallments || []).length > 0 && (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>💳 งวดการชำระเงิน</div>
            {(quote.paymentInstallments || []).map((inst, i) => {
              const amt = Number(quote.grandTotal) * (Number(inst.pct) / 100);
              return (
                <div key={inst.id || i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#ccc", padding: "4px 0", borderBottom: "1px solid #1a1a1a" }}>
                  <span>งวดที่ {i + 1}: {inst.label} ({inst.pct}%)</span>
                  <span style={{ color: "#c8a96e" }}>฿{formatMoney(amt)}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>ช่องทาง: {COMPANY_INFO.bank}</div>
          </div>
        )}
        {(!quote.paymentInstallments || quote.paymentInstallments.length === 0) && quote.paymentTerms && (
          <div style={{ fontSize: 12, color: "#666", marginBottom: 16, background: "#0d0d0d", padding: "10px 12px", borderRadius: 8, border: "1px solid #1a1a1a" }}>💳 {quote.paymentTerms}</div>
        )}

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
        {showExportBtn && (
          <div style={{ fontSize: 11, color: "#888", marginBottom: 10, textAlign: "center", background: "#0d0d0d", padding: "8px", borderRadius: 8, border: "1px solid #1a1a1a" }}>
            💾 ไฟล์ถูกบันทึกในแอปแล้ว — กด "📂 เปิด" เพื่อส่งออก
          </div>
        )}
        <button onClick={handleDelete} style={{ width: "100%", padding: 12, background: "none", border: "1px solid #2a1a1a", borderRadius: 10, color: "#c8423a", cursor: "pointer", fontSize: 13 }}>🗑 ลบใบเสนอราคานี้</button>
      </div>
    </div>
  );
}
