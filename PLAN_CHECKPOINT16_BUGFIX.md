# แผนแก้ 3 Bugs ที่ verify เจอ — checkpoint 16

**Origin**: post-checkpoint 15 auto-export verification (2026-07-04 19:56)
**Source data**: `scripts/ref_qn.xlsx`, `scripts/reference.pdf` vs `scripts/app_qn062.{xlsx,pdf}` (generated 19:56)

---

## Verification ที่ทำไปแล้ว

- ✅ ใช้ playwright MCP drive browser ผ่าน `localhost:5173`
- ✅ inject TT-QN-062-26 fake quote + hijack `URL.createObjectURL` + extract blob
- ✅ run `python scripts/compare_xlsx.py` (openpyxl) — ดู merged cells / widths / heights / cells / images
- ✅ run `python scripts/compare_pdf.py` (PyMuPDF) — ดู page size + text
- ❌ **ยังไม่ได้ทำ**: render PDF ทั้ง 2 ฝั่งเป็น PNG เพื่อเทียบ layout ด้วยตา (เพราะ app PDF เป็น image-based ดู text ไม่ได้)

---

## Tasks (เรียงตาม priority)

### T0 — Visual rendering compare (ทำก่อน — ใช้เวลา 5 นาที)
- [ ] เขียน `scripts/render_compare.py` — PyMuPDF render `reference.pdf` → `scripts/_ref_render.png`, `scripts/app_qn062.pdf` → `scripts/_app_render.png` (DPI 150)
- [ ] รัน + ดูทั้ง 2 ภาพแบบ side-by-side
- [ ] บันทึกผล visual diff ลง RULES.md

**เหตุผล**: ถ้า visual diff เจอปัญหาเพิ่ม (เช่น font ผิด, layout เลื่อน) อาจต้องขยาย scope — รู้ก่อนแก้ดีกว่า

---

### T1 — Fix subtotal fallback (priority: 🔴 high — real bug)
**File**: `src/components/ViewQuoteScreen.jsx`
- Line 29: `const subtotal = Number(quote.subtotal || 0);`
- Line 611: เหมือนกัน

**Root cause**: `quote.subtotal` undefined → fallback = 0
- ปกติ `App.jsx:859, 865` จะ recompute subtotal แล้ว save ตอน user save quote ผ่าน UI
- แต่ quote เก่า (pre-recompute) / quote import จากระบบอื่น / automation inject จะไม่มี field นี้
- ผลคือ `S26 (รวมเงิน) = 0` ใน Excel, `฿0.00` ใน UI

**Fix**:
```js
// before
const subtotal = Number(quote.subtotal || 0);

// after
const subtotal = Number(quote.subtotal) ||
  (Array.isArray(quote.items)
    ? quote.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)
    : 0);
```
(apply ทั้ง 2 จุด)

**Verify**:
- build ผ่าน
- re-export TT-QN-062-26 ใหม่ → `S26 = 45520`, `S30 = 52348`, งวด 50% = 26174
- ทดสอบ quote ที่ subtotal undefined (เช่น inject `localStorage` แล้วลบ `subtotal` field ออก) — ต้อง fallback ได้ถูก

**Risk**: ต่ำ — เป็นเพิ่ม fallback, behavior เดิมยังคงเดิม

---

### T2 — Fix PDF page size A4 → Letter (priority: 🟡 medium — print impact)
**File**: `src/components/ViewQuoteScreen.jsx` (หาจุดที่เรียก `new jsPDF()`)

**Root cause**: jspdf default = A4 (8.27×11.69")
- REF = US Letter (8.5×11")
- ผลกระทบ: พิมพ์/print preview ผิดขนาด, อาจตัดขอบ, ลูกค้าอาจ print แล้ว layout เพี้ยน

**Fix**:
```js
// before
const pdf = new jsPDF();

// after
const pdf = new jsPDF({ unit: "pt", format: "letter" }); // 612 x 792 pt
```

**Verify**:
- build ผ่าน
- export TT-QN-062-26 ใหม่ → fitz.open().rect = 612x792 pt (ไม่ใช่ 595.3x841.9)

**Risk**: ต่ำ — เปลี่ยนแค่ page format option, content เหมือนเดิม

---

### T3 — Fix logo image anchor overshoot 1 row (priority: 🟢 low — visual only)
**File**: `src/components/ViewQuoteScreen.jsx:106`

**Root cause**:
```js
ws.addImage(logoImageId, {
  tl: { col: 18, row: 1 },     // S2 ✓
  br: { col: 20.999, row: 6 },  // U6 → ExcelJS ตีความเป็น U7 (row 6 = แถวก่อนหน้า row 7)
});
```

**Fix**:
```js
// before
br: { col: 20.999, row: 6 },

// after
br: { col: 20.999, row: 5.999 },
```

**Verify**:
- build ผ่าน
- export ใหม่ → check anchor `_to` row = 5 (round 6) ไม่ใช่ 6 (round 7)
- run `python scripts/image_positions.py` — assert logo S2→U6

**Risk**: ต่ำมาก — แค่ลด row offset

---

## Execution plan (เรียงตามลำดับ)

```
T0 (visual verify, 5 min)
   ↓
T1 (subtotal — high impact, real bug) → checkpoint 16.1
   ↓  (re-run compare after T1)
T2 (PDF page size) + T3 (logo anchor) → checkpoint 16.2 (รวม)
   ↓
T0-final (re-render + final compare)
```

หรือถ้าอยาก fix ครบใน checkpoint 16 เดียว:
```
T0 → T1+T2+T3 → T0-final → checkpoint 16
```

---

## Verify protocol ทุก fix (RULES.md rule 11)

1. **แก้ไขโค้ด** (atomic edit ต่อ bug)
2. **build**: `npm run build` ต้องผ่านไม่มี warning
3. **smoke test** (preview server ที่ port 5173):
   - navigate `localhost:5173`
   - inject TT-QN-062-26 fake quote (reuse scripts/`_payload.json`)
   - export Excel + PDF
   - hijack จับ blob, extract ออกมา overwrite `scripts/app_qn062.{xlsx,pdf}`
4. **re-compare**: `python scripts/compare_xlsx.py` + `python scripts/compare_pdf.py` (เทียบกับ ref)
5. **git commit** (RULES.md rule 6): commit message = `checkpoint 16 — <what was fixed>`
6. **update RULES.md** (RULES.md rule 5): mark checkpoint done + verification results

---

## Risk matrix

| Bug | Severity | Scope | User-impact |
|---|---|---|---|
| T1 subtotal=0 | 🔴 High | ทุก quote ที่ไม่ใช่ UI-saved | Grand total ผิด ใน Excel export |
| T2 PDF size A4 | 🟡 Med | PDF export ทุกใบ | Print preview ผิดขนาด/อาจตัดขอบ |
| T3 logo row+1 | 🟢 Low | Logo image | Layout 1 row เลื่อน, ตาเห็นได้ |

---

## ข้อมูลอ้างอิง

### Files ที่เกี่ยวข้อง
- `src/components/ViewQuoteScreen.jsx` — target for T1, T2, T3
- `src/App.jsx:859, 865` — ที่ recompute subtotal (ศึกษา logic เพื่อ copy มาใช้)
- `scripts/compare_xlsx.py`, `scripts/compare_pdf.py` — verify scripts
- `scripts/_payload.json`, `_hijack_payload.json`, `_extract_payload.json`, `_check_payload.json` — automation scripts (reusable)

### Reference files (ต้นฉบับ QN 26)
- `scripts/ref_qn.xlsx` (Excel ต้นฉบับ)
- `scripts/reference.pdf` (PDF ต้นฉบับ)
- ทั้ง 2 มีขนาด US Letter, sub-items จัดเป็นหมวด 1.x, 2.x

### Rollback
- git tag ก่อนแก้: `pre-checkpoint-16-bugfix`
- หรือ commit "checkpoint 15 (pre-bugfix)" ก่อน
