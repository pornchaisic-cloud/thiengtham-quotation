
# แผนปรับ Layout ใบเสนอราคาให้เหมือนต้นฉบับ 100%

## เวอร์ชันเป้าหมาย: `ThiengTham2_v7_AI_GPT_Test`

---

## งานด่วน / เปิดค้างไว้

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
