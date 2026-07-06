# CLEANUP_PLAN — แผนกวาด Code Hygiene / Dead Code / Bundle Size

**เวอร์ชันเป้าหมาย**: `ThiengTham2_v7_AI_GPT_Test`
**ค้นพบเมื่อ**: 4 ก.ค. 2569 (รอบเช็คไฟล์หลัง checkpoint 7)

---

## สรุปปัญหาที่เจอ

### ✅ Phase 1-6 (PLAN_EXCEL_PDF_MATCH.md) เสร็จแล้ว — รวม Phase 10 refine (checkpoint 15) — แต่เจอ dead code / dead imports เพิ่ม

| # | ปัญหา | ไฟล์ | ผลกระทบ |
|---|---|---|---|
| 1 | Dead imports 10 ตัว | `src/App.jsx` | เพิ่มขนาด bundle เปล่า ๆ, ทำให้สับสน |
| 2 | Dead imports 3 ตัว | `src/components/ViewQuoteScreen.jsx` | เหมือนกัน |
| 3 | Dead `React` import | `PriceDbScreen.jsx`, `TransferScreen.jsx` | React 19 auto JSX — ไม่ต้อง import |
| 4 | Import paths ไม่ explicit | 4 ไฟล์ (`./utils/styles` ควรเป็น `./utils/styles.jsx`) | Vite resolve ได้ แต่ไม่ชัด |
| 5 | `setTimeout` ไม่มี cleanup | `src/components/KeySection.jsx:99` | setState บน unmounted component (React warning) |
| 6 | Duplicate `xlsx` library | `package.json` + `PriceDbScreen.jsx:2` | ใช้ ExcelJS แล้วแต่ xlsx ยังอยู่ |
| 7 | Bundle chunk 2.3 MB warning | Build output | html2canvas+jspdf หนัก — ควร dynamic import |

---

## Phase 1 — ลบ dead imports ใน App.jsx (P1)

**ไฟล์**: `src/App.jsx` (ลบ 10 imports)

**Imports ที่ลบ**:
```js
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
//  ↑ ลบ React (React 19 auto JSX transform)

import { Capacitor } from "@capacitor/core";          // ❌ ไม่ใช้
import { supabase, BUCKET_NAME } from "./lib/supabase";  // ❌ ไม่ใช้ (ใช้ใน TransferScreen)
import * as XLSX from "xlsx";                         // ❌ ไม่ใช้ (ใช้ ExcelJS แทน)
import html2canvas from "html2canvas";                // ❌ ไม่ใช้ (ใช้ใน ViewQuoteScreen)
import { jsPDF } from "jspdf";                        // ❌ ไม่ใช้
import { Filesystem, Directory } from "@capacitor/filesystem";  // ❌ ไม่ใช้
import { Share } from "@capacitor/share";             // ❌ ไม่ใช้
```

**Imports ที่เก็บไว้**:
- `useState, useEffect, useRef, useCallback, useMemo` (ใช้ใน QuoteFormScreen/AIAnalyzeScreen)
- `* as sync from "./lib/sync"` (sync layer)
- `Toast, ConnectionBanner, Header, KeySection, TransferScreen, PriceDbScreen, ViewQuoteScreen` (components)
- `saveFileToDevice, shareFileNative, isNative, blobToBase64` (file helper)
- ทุกตัวจาก `helpers`, `styles`, `apiKeys`

**Verify**: `grep -c "XLSX\|html2canvas\|jsPDF\|Capacitor\|Filesystem\|Share\|BUCKET_NAME\|supabase" src/App.jsx` ต้องได้ 0

---

## Phase 2 — ลบ dead imports ใน ViewQuoteScreen.jsx (P1)

**ไฟล์**: `src/components/ViewQuoteScreen.jsx` (ลบ 3 imports)

**Imports ที่ลบ**:
```js
import React, { useState } from "react";
//  ↑ ลบ React

import { ... ThaiBaht, thaiBahtText ... } from "../utils/helpers";
//                  ↑ ลบ ThaiBaht (ใช้ thaiBahtText แทน)

import { btnSm, SumRow, inputStyle } from "../utils/styles";
//                              ↑ ลบ inputStyle (ไม่ได้ใช้)
```

**Verify**: เปิด ViewQuoteScreen ในเบราว์เซอร์ → export Excel/PDF ยังทำงานปกติ

---

## Phase 3 — ลบ `React` import ที่ไม่จำเป็น (P1)

**ไฟล์**:
- `src/components/PriceDbScreen.jsx:1` — `import React, { useState, useRef, useMemo } from "react";`
- `src/components/TransferScreen.jsx:1` — `import React, { useState, useEffect } from "react";`

**แก้**: เปลี่ยนเป็น
```js
import { useState, useRef, useMemo } from "react";  // PriceDbScreen
import { useState, useEffect } from "react";        // TransferScreen
```

หมายเหตุ: `main.jsx`, `Header.jsx`, `Toast.jsx`, `ConnectionBanner.jsx`, `KeySection.jsx` ตรวจแล้ว — clean

---

## Phase 4 — Explicit import paths สำหรับ `styles.jsx` (P2)

**ไฟล์** (4 ไฟล์ — แก้จากไม่มี extension → `.jsx`):
- `src/App.jsx:20` → `from "./utils/styles.jsx"`
- `src/components/ViewQuoteScreen.jsx:8` → `from "../utils/styles.jsx"`
- `src/components/PriceDbScreen.jsx:4` → `from "../utils/styles.jsx"`
- `src/components/TransferScreen.jsx:5` → `from "../utils/styles.jsx"`

**Verify**: `npm run build` ผ่าน + Vite ไม่เตือน ambiguous module

---

## Phase 5 — แก้ KeySection setTimeout cleanup (P2)

**ไฟล์**: `src/components/KeySection.jsx:99`

**ปัญหา**:
```js
setTimeout(() => setTestStatus(s => { ... }), 10000);
// ถ้า component unmount ก่อน 10 วินาที → setState บน unmounted component
// React warning: "Can't perform a React state update on an unmounted component"
```

**แก้** — เก็บ timeout id ใน ref + cleanup:
```js
const timeoutsRef = useRef(new Set());

// ใน handler:
const id = setTimeout(() => {
  setTestStatus(s => { ... });
  timeoutsRef.current.delete(id);
}, 10000);
timeoutsRef.current.add(id);

// useEffect cleanup:
useEffect(() => {
  return () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  };
}, []);
```

หรือใช้ AbortController:
```js
const ac = new AbortController();
setTimeout(() => { ... }, 10000, { signal: ac.signal });
// unmount → ac.abort() → clear timeout
```

---

## Phase 6 (optional) — ลบ xlsx duplicate dependency (P3)

**ไฟล์**: `package.json`, `src/components/PriceDbScreen.jsx`

**ทำอะไร**:
1. Migrate Price DB import จาก `xlsx` → `exceljs`:
   ```js
   // ปัจจุบัน (PriceDbScreen.jsx:17-27)
   const arrayBuffer = await file.arrayBuffer();
   const workbook = XLSX.read(arrayBuffer, { type: "array" });
   const sheetName = workbook.SheetNames[0];
   const sheet = workbook.Sheets[sheetName];
   const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

   // ใหม่ (ExcelJS)
   const wb = new ExcelJS.Workbook();
   await wb.xlsx.load(arrayBuffer);
   const sheet = wb.worksheets[0];
   const rows = [];
   sheet.eachRow((row, rowNumber) => {
     rows.push([row.getCell(1).value, row.getCell(2).value, row.getCell(3).value]);
   });
   ```
2. `npm uninstall xlsx`
3. ลบ `import * as XLSX from "xlsx";` จาก PriceDbScreen.jsx

**Verify**: import Excel เข้า Price DB ยังทำงานปกติ

---

## Phase 7 (optional) — Code-split html2canvas + jspdf (P3)

**ไฟล์**: `src/components/ViewQuoteScreen.jsx`

**ทำอะไร**:
- เปลี่ยน static import → dynamic import เฉพาะตอน export
- ลด initial bundle ลง ~600KB (html2canvas ~200KB + jspdf ~400KB)
- Initial load เร็วขึ้น

**ตัวอย่าง**:
```js
// ปัจจุบัน (top of file)
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ใหม่ (dynamic เฉพาะตอน export)
async function buildPdfBlob() {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  // ... ใช้ html2canvas / jsPDF ตามเดิม
}
```

หมายเหตุ: Vite จะแยก chunk อัตโนมัติ — ดูใน `dist/assets/` ว่ามี chunk ใหม่

---

## ลำดับทำ (ตาม dependency)

| ลำดับ | Phase | Priority | Effort | Verify | สถานะ |
|---|---|---|---|---|---|
| 1 | Phase 1 — App.jsx dead imports | P1 | 5 นาที | `npm run build` ผ่าน | ✅ checkpoint 8 |
| 2 | Phase 2 — ViewQuoteScreen dead imports | P1 | 2 นาที | เปิดหน้าใบเสนอราคา → export | ✅ checkpoint 8 |
| 3 | Phase 3 — `React` import cleanup | P1 | 1 นาที | `npm run build` ผ่าน | ✅ checkpoint 8 |
| 4 | Phase 4 — explicit `.jsx` paths | P2 | 3 นาที | `npm run build` ไม่ warning | ✅ checkpoint 9 |
| 5 | Phase 5 — KeySection setTimeout cleanup | P2 | 10 นาที | toggle key แล้วออกก่อน 10 วิ | ✅ checkpoint 10 |
| 6 | Phase 6 — ลบ xlsx (optional) | P3 | 20 นาที | import Excel ใน Price DB | ✅ checkpoint 11 |
| 7 | Phase 7 — code-split html2canvas/jspdf (optional) | P3 | 15 นาที | ดู `dist/assets/` มี chunk แยก | ✅ checkpoint 12 |

---

## เกณฑ์เสร็จ (Definition of Done)

- [x] Phase 1-3 เสร็จ → checkpoint 8 ✅
- [x] Phase 4 เสร็จ → checkpoint 9 ✅
- [x] Phase 5 เสร็จ → checkpoint 10 ✅
- [x] Phase 6 เสร็จ → checkpoint 11 ✅
- [x] Phase 7 เสร็จ → checkpoint 12 ✅
- [x] `npm run build` ผ่าน ไม่มี warning ใหม่
- [x] Bundle ลดลง: main 2,375 KB → 513 KB (-78%) ✅
- [x] ทุก feature เดิมยังทำงาน (verify จาก smoke test)

> ✅ **CLEANUP_PLAN เสร็จเรียบร้อยทุก Phase** (checkpoint 8-12)

---

## หมายเหตุ

- ทำ checkpoint (git commit) ทุกครั้งหลังแก้โค้ด (ตาม RULES.md)
- ระวัง: ลบ `React` import แล้วใช้ `React.something` ตรง ๆ จะพัง — ตรวจให้ดีก่อนลบ
- ถ้าทำ Phase 6/7 ต้องทดสอบบน Android (Capacitor) ด้วย เพราะ dynamic import อาจมี edge case
- `useRef` ใน KeySection มี import อยู่แล้ว (line 2) — เพิ่ม `useEffect` ก็ import เพิ่ม

---

## ข้อมูลอ้างอิง

### ไฟล์ที่ตรวจ
- `src/App.jsx` (985 บรรทัด)
- `src/components/ViewQuoteScreen.jsx` (863 บรรทัด)
- `src/components/PriceDbScreen.jsx` (132 บรรทัด)
- `src/components/KeySection.jsx` (152 บรรทัด)
- `src/components/TransferScreen.jsx` (156 บรรทัด)
- `src/components/Header.jsx` (clean)
- `src/components/Toast.jsx` (clean)
- `src/components/ConnectionBanner.jsx` (clean)
- `src/lib/supabase.js` (clean)
- `src/lib/sync.js` (clean)
- `src/utils/apiKeys.js` (clean)
- `src/utils/fileHelper.js` (clean)
- `src/utils/helpers.js` (clean)
- `src/utils/styles.jsx` (clean)
- `src/main.jsx` (clean — `createRoot` false positive)

### Tools
- `scripts/check_unused_imports.cjs` — static analysis unused imports
- `scripts/check_imports2.cjs` — detailed import usage count + line numbers

### แผนอื่นที่เกี่ยวข้อง
- `PLAN_EXCEL_PDF_MATCH.md` — เสร็จแล้ว (Phase 1-6 → checkpoint 7, Phase 10 refine → checkpoint 15, T1+T2+T3 → checkpoint 16+17)
- `update_PLAN.md` — แผนหลักของโปรเจกต์ (Phase 0-14, checkpoint 1-21) — ครอบคลุม Supabase sync / offline UI / QN 26 layout / Android build / APK hotfix / foojay JDK21 / AI prompt
- `PLAN_CHECKPOINT16_BUGFIX.md` — รายละเอียด bugfix T1+T2+T3 (checkpoint 16+17)

### ⚠️ Lesson learned (จาก update_PLAN.md Phase 8 → Phase 9)
- Phase 8 (checkpoint 13) ลบ storage permissions + `Directory.External` fallback โดยไม่ verify บน Android จริง → APK save ไฟล์ไม่ได้
- Phase 9 (checkpoint 14) hotfix ด้วย 3-tier fallback + restore AndroidManifest permissions
- **บทเรียน** → RULES.md rule 10-11:
  - **Rule 10**: ห้ามลบ runtime-critical code (permissions, fallbacks, storage paths) โดยไม่ verify บน Android จริง
  - **Rule 11**: ส่ง APK = ต้อง smoke test (install → tap main flows → ตรวจ toast / logcat) ไม่ใช่แค่ `gradlew build` ผ่าน
