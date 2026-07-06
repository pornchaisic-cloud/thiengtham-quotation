# แผนแก้ 3 Bugs ที่ verify เจอ — checkpoint 16

**Origin**: post-checkpoint 15 auto-export verification (2026-07-04 19:56)
**Source data**: `scripts/ref_qn.xlsx`, `scripts/reference.pdf` vs `scripts/app_qn062.{xlsx,pdf}` (generated 19:56)

---

## Verification ที่ทำไปแล้ว

- ✅ ใช้ playwright MCP drive browser ผ่าน `localhost:5173`
- ✅ inject TT-QN-062-26 fake quote + hijack `URL.createObjectURL` + extract blob
- ✅ run `python scripts/compare_xlsx.py` (openpyxl) — ดู merged cells / widths / heights / cells / images
- ✅ run `python scripts/compare_pdf.py` (PyMuPDF) — ดู page size + text
- ✅ **เสร็จแล้วทุก T0-T3** (checkpoint 16+17)

---

## Tasks (เรียงตาม priority)

### T0 — Visual rendering compare (ทำก่อน — ใช้เวลา 5 นาที)
- [x] เขียน `scripts/render_compare.py` — PyMuPDF render `reference.pdf` → `scripts/_ref_render.png`, `scripts/app_qn062.pdf` → `scripts/_app_render.png` (DPI 150)
- [x] รัน + ดูทั้ง 2 ภาพแบบ side-by-side
- [x] บันทึกผล visual diff ลง RULES.md

**เหตุผล**: ถ้า visual diff เจอปัญหาเพิ่ม (เช่น font ผิด, layout เลื่อน) อาจต้องขยาย scope — รู้ก่อนแก้ดีกว่า

> **สถานะ: เสร็จแล้ว** (checkpoint 16 ทำรวมกับ T1+T2)

---

### T1 — Fix subtotal fallback (priority: 🔴 high — real bug)
> ✅ **เสร็จแล้ว** (checkpoint 16)
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
> ✅ **เสร็จแล้ว** (checkpoint 16)
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
> ✅ **เสร็จแล้ว** (checkpoint 17)
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
T0 (visual verify)     ✅ done
   ↓
T1 (subtotal)         ✅ checkpoint 16
T2 (PDF size)          ✅ checkpoint 16
T3 (logo anchor)       ✅ checkpoint 17
   ↓
T0-final (re-verify)  ✅ checkpoint 16+17
```

✅ **ทั้ง 4 tasks เสร็จเรียบร้อย** (checkpoint 16 + 17)

---

## Post-completion follow-ups

งานที่เกิดขึ้นหลัง T1+T2+T3 เสร็จ — เพื่อกันไม่ให้ bug แบบเดียวกันกลับมา:

- **checkpoint 18** — foojay-resolver-convention plugin (auto-download JDK 21) — กัน build fail บน dev เครื่องใหม่ที่ไม่ได้ติดตั้ง JDK 21 (Capacitor 8 ต้องการ)
- **checkpoint 19** — RULES sync 16+17+18 (pure documentation)
- **checkpoint 20** — `scripts/verify_android.cjs` + `scripts/verify_android.bat` — smoke test helper (install APK + cold launch + tap main flows + check toast/logcat) — บังคับใช้หลังทุก APK change (RULES.md rule 11)
- **checkpoint 21** — P1-12 AI prompt: populate overheadPct/discount/paymentTerms defaults — แก้ที่ AI ไม่ได้ populate ค่า default ทำให้ grand total ผิด (คล้าย T1 แต่ที่ AI layer)

> **Lesson**: หลังเจอ bug class ใหม่ ควรสร้าง helper ป้องกันไม่ให้กลับมา — T1+T2+T3 → checkpoint 20 verification helper

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

| Bug | Severity | Scope | User-impact | สถานะ |
|---|---|---|---|---|
| T1 subtotal=0 | 🔴 High | ทุก quote ที่ไม่ใช่ UI-saved | Grand total ผิด ใน Excel export | ✅ แก้แล้ว |
| T2 PDF size A4 | 🟡 Med | PDF export ทุกใบ | Print preview ผิดขนาด/อาจตัดขอบ | ✅ แก้แล้ว |
| T3 logo row+1 | 🟢 Low | Logo image | Layout 1 row เลื่อน, ตาเห็นได้ | ✅ แก้แล้ว |

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

### แผนอื่นที่เกี่ยวข้อง
- `update_PLAN.md` — แผนหลัก (Phase 11 = T1+T2+T3, Phase 14 = AI prompt defaults)
- `PLAN_EXCEL_PDF_MATCH.md` — Phase 10 refine (checkpoint 15) ที่มา verify ก่อน → เจอ T1+T2+T3
- `CLEANUP_PLAN.md` — Phase 1-7 cleanup (checkpoint 8-12) ที่มาก่อน Phase 11
- `RULES.md` rule 11 — บังคับ smoke test APK หลังแก้ (เพิ่มใน checkpoint 20)
