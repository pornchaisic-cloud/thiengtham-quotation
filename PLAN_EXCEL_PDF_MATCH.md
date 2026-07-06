
# แผนปรับ Layout ใบเสนอราคาให้เหมือนต้นฉบับ 100%

## เวอร์ชันเป้าหมาย: `ThiengTham2_v7_AI_GPT_Test`

---

## สถานะรวม

> ✅ **เสร็จเรียบร้อย** (Phase 1-6 → checkpoint 7; Phase 10 refine → checkpoint 15; T1+T2+T3 → checkpoint 16+17)

---

## งานที่ทำเสร็จทั้งหมด

### ✅ ที่ทำไปแล้ว (3-4 ก.ค. 2569)
- [x] วิเคราะห์โครงสร้างไฟล์จริงใน `D:\เที่ยงทำ ดีเวลล็อปเมนท์\ใบเสนอราคา\QN 26\` (TT-QN-056-26, TT-QN-037-26)
- [x] วิเคราะห์โค้ดแอป (ViewQuoteScreen.jsx, App.jsx, helpers.js)
- [x] เปรียบเทียบความแตกต่างระหว่าง output ปัจจุบันของแอปกับไฟล์จริง
- [x] สรุปแผนการแก้ไขทั้งหมด 6 Phase
- [x] **Phase 1**: อัปเดต `COMPANY_INFO.bank` ให้ตรงต้นฉบับ QN 26
- [x] **Phase 2**: เปลี่ยน `xlsx` → `exceljs` (buildExcelBlob ใช้ ExcelJS API)
- [x] **Phase 3**: เขียน `buildExcelBlob()` ใหม่ — 27 คอลัมน์, merge cells, fonts/borders, 27-column layout เหมือนต้นฉบับ
- [x] **Phase 4**: ปรับ `buildPdfBlob()` HTML template ให้เหมือน QN 26 (header, customer info, items, summary, signature 3 ฝ่าย)
- [x] **Phase 5**: เปลี่ยน default installments จาก 3 งวด (50/30/20) → 2 งวด 50/50 (label "ก่อนเริ่มงาน" + "หลังส่งมอบงาน" ตามต้นฉบับ 124/128 ใบ)
- [x] **Phase 6**: ปรับปรุง label การคำนวณ (Overhead&Profit + รวมเป็นเงิน + GROSS TOTAL + ภาษีมูลค่าเพิ่ม 7% + ยอดเงินสุทธิ + NET GROSS)
- [x] **Phase 10 (Refine)**: taxId จริง `1729900082674`, address "(สำนักงานใหญ่)", logo fallback `getDefaultLogoBase64()`, signature skip-if-path-only, label cells ("ชื่อผู้รับเหมา" A2:C2, "เลขประจำตัวผู้เสียภาษี" A5:D5), `wb.creator = subcontractorName`, PDF header "ชื่อผู้รับเหมา" font 15→13px (checkpoint 15)
- [x] **T1+T2+T3 (Bugfix)**: T1 subtotal fallback (quote.items.reduce), T2 PDF A4→Letter, T3 logo anchor row 6→5.999 (checkpoint 16+17)

### สรุปจากข้อมูลจริง QN 26 (128 ใบ, extract ด้วย scripts/extract_qn26.py)
- 124 ใบ (97%) ใช้ 2 งวด 50/50 label "ก่อนเริ่มงาน" + "หลังส่งมอบงาน"
- 2 ใบ ใช้ label เฉพาะงานสี: "หลังทาสีผนังภายในเสร็จ" + "หลังทาสีฝ้าเพดานเสร็จ"
- 2 ใบที่เหลือ (edge case — user แก้เองในฟอร์มได้)
- Bank: 127/128 ใช้ "ธ.ไทยพาณิชย์ บัญชี ออมทรัพย์  เลขที่บัญชี 1174057341" (มี 15 ไฟล์ typo "ไทยพำณิชย์" — ไม่กระทบ default)
- Payee: 127/128 ใช้ "นายพรชัย ชูพรม" (ตรงกับ COMPANY_INFO.subcontractorName)

### Phase 2: เปลี่ยน Library Excel
**ไฟล์**: `package.json`
- ถอด `"xlsx": "^0.18.5"` ออก
- เพิ่ม `"exceljs": "^4.4.0"`
- รัน `npm uninstall xlsx && npm install exceljs@^4.4.0`

### Phase 3: เขียน `buildExcelBlob()` ใหม่ทั้งหมด
**ไฟล์**: `src/components/ViewQuoteScreen.jsx` (บรรทัด 17-57)
- เปลี่ยนจาก `XLSX.utils.aoa_to_sheet()` → ใช้ `exceljs` API
- สร้าง 27 คอลัมน์พร้อม Merge Cells เลียนแบบต้นฉบับ
- จัดรูปแบบ: Fonts (Sarabun/Angsana New), Borders, Alignment, Number Format (#,##0.00)
- โครงสร้าง:
  ```
  Row 1:  บริษัทฯ + ที่อยู่ (Merge)
  Row 2-3: โทร, เลขภาษี
  Row 6:   Attention to : {name}          | เลขที่ TT-QN-XXX-26
  Row 7:   โครงการ : {project}            | Unit : -
  Row 8:   โทรศัพท์ : {phone}
  Row 9:   วันที่ : {thaiDate}
  Row 13:  ลำดับ | รายการ | ปริมาณ | หน่วย | ราคาต่อหน่วย | จำนวนเงิน
  Row 14:  No. | DESCRIPTION | QUANTITY | UNIT | UNIT PRICE | AMOUNT(BAHT)
  Row 15+: Items (หมวดหมู่ + รายการย่อย)
  Summary: GROSS TOTAL → O&P X% → VAT 7% → NET GROSS
  Signature: 3 ฝ่าย (ผู้รับของ, ผู้ส่งของ/DELIVERED BY, ผู้อนุมัติ)
  ```

### Phase 4: ออกแบบ `buildPdfBlob()` ใหม่
**ไฟล์**: `src/components/ViewQuoteScreen.jsx` (บรรทัด 96-232)
- ปรับ HTML template ให้เหมือน PDF จริง
- เพิ่มส่วนเซ็น 3 ฝ่าย
- ปรับ summary section ฝั่งขวา
- ใช้ Font ที่รองรับภาษาไทย (inject @font-face)
- ปรับ layout header/customer info/items/summary/signature

### Phase 5: ปรับปรุง QuoteFormScreen เริ่มต้น
**ไฟล์**: `src/App.jsx` (บรรทัด 388-393)
- เปลี่ยน default `remarks` → "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้"
- เปลี่ยน default `paymentTerms` → ข้อความ 2 งวด 50%
- เพิ่มฟิลด์ bank account ใน form

### Phase 6: ปรับปรุงการคำนวณ Label
**ไฟล์**: `src/App.jsx` (บรรทัด 397-406), `ViewQuoteScreen.jsx`
- ปรับ Label และลำดับการแสดงผลการคำนวณให้เป็น:
  ```
  GROSS TOTAL → Overhead&Profit X% → GROSS TOTAL (incl O&P) → VAT 7% → NET GROSS
  ```

---

### Phase 10 (Refine): ข้อมูลบริษัทจริง + Logo/Signature fallback (checkpoint 15)

**ไฟล์**: `src/utils/helpers.js`, `src/components/ViewQuoteScreen.jsx`

**เปลี่ยน:**
1. `address` → เพิ่ม "(สำนักงานใหญ่)" ท้ายที่อยู่ (ตรงตาม ภ.พ.20)
2. `taxId`: `1729900000000` → **`1729900082674`** (เลขจริงที่ใช้ในใบเสนอราคา บริษัท เที่ยงทำฯ)
3. `getDefaultLogoBase64()` — preload `/logo.png` เป็น base64 (cache) เพื่อให้ `ExcelJS.addImage()` ใช้ได้แม้ `quote.logo` เป็นแค่ path

**Layout fixes:**
4. Logo block: fallback เป็น defaultLogoB64 เมื่อ `quote.logo.length <= 64` (path-only หรือไม่มี)
5. Signature block: skip add image ถ้า `quote.signature.length <= 64` (กัน crash ตอน path-only)
6. `ws.mergeCells("A2:C2")` + label "ชื่อผู้รับเหมา" — column A-C ของ row 2
7. `ws.mergeCells("A5:D5")` + label "เลขประจำตัวผู้เสียภาษี" — column A-D ของ row 5 (taxId เดิมอยู่ที่ E5:I5 แล้ว)
8. `wb.creator = COMPANY_INFO.subcontractorName || COMPANY_INFO.name` (เอกสาร QN 26 ระบุชื่อผู้รับเหมาเป็น metadata)
9. PDF header: เปลี่ยนจากแสดง "ชื่อบริษัท" → "ชื่อผู้รับเหมา : {quote.subcontractorName}" (ตรง QN 26); ลด font 15px → 13px

**Tools ใหม่:**
- `scripts/_fix_image_blocks.py` — one-time patch script ที่ apply fallback fix ให้ logo + signature block
- `scripts/peek_ref_top.py` — PyMuPDF inspect top of reference.pdf (font/size/bbox) ใช้ debug layout

**Origin:** post-checkpoint 15 auto-export verification → เจอ T1+T2+T3 → แก้ใน checkpoint 16+17 (ดู `PLAN_CHECKPOINT16_BUGFIX.md`)

---

## ข้อมูลอ้างอิง

### ไฟล์ต้นฉบับใน QN 26
- `TT-QN-056-26 ศุภาลัย วิสต้า แยกติวานนท์.xlsx` — ตัวอย่างหลัก
- `TT-QN-037-26 ไอดีโอ ลาดพร้าว 17 (2-312).xlsx` — ตัวอย่างรอง (มีหลายรายการ)

### COMPANY_INFO (ปัจจุบัน → เป้าหมาย)
- ชื่อ: "นายพรชัย ชูพรม" → "บริษัท เที่ยงทำ ดีเวลล็อปเมนท์ จำกัด"
- ที่อยู่: เหมือนเดิม
- โทร: เหมือนเดิม
- เลขภาษี: เหมือนเดิม
- เพิ่ม: ข้อมูลบัญชีธนาคาร

### สูตรการคำนวณต้นฉบับ
```
GROSS TOTAL  = sum(item.qty * item.price)
Overhead&Profit = GROSS TOTAL * (overheadPct / 100)
VAT 7%       = (GROSS TOTAL + Overhead) * 0.07
NET GROSS    = GROSS TOTAL + Overhead + VAT
```

---

### แผนอื่นที่เกี่ยวข้อง
- `update_PLAN.md` — แผนหลัก (Phase 6 = QN 26 layout, Phase 10 = refine, Phase 11 = T1+T2+T3)
- `PLAN_CHECKPOINT16_BUGFIX.md` — bugfix ที่ verify หลัง Phase 10 (T1 subtotal fallback, T2 PDF size, T3 logo anchor)
- `CLEANUP_PLAN.md` — Phase 7 code-split exceljs/html2canvas/jspdf (สำคัญต่อ bundle size ของ QN 26 export)
