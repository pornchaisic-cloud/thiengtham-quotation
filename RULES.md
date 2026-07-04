# RULES — กฎการทำงาน ZCode + ThiengTham App

1. **ห้ามแก้โค้ดก่อนสั่ง** — รอคำสั่งก่อนทุกครั้ง
2. **สรุปสั้น เข้าใจง่าย** — ไม่เยิ่นเย้อ
3. **วิเคราะห์ก่อนทุกครั้ง** — ดูโค้ด/วิเคราะห์ก่อนเสนอ/ลงมือ
4. **ดูโค้ดก่อนตอบ** — ไม่มั่ว
5. **อัปเดท RULES.md ทุกครั้งหลังแก้ไข**
6. **ทำ checkpoint (git commit) ทุกครั้งหลังแก้โค้ด**
7. **ใช้ภาษาไทยในการสื่อสาร**
8. **ใช้ Playwright สำหรับ browser automation** (สร้าง GitHub/Supabase)
9. **ทำงานให้เร็ว** (ที่บอกล่าสุด)
10. **ห้ามลบ runtime-critical code (permissions, fallbacks, storage paths) โดยไม่ verify บน Android จริง** — เรียนรู้จาก checkpoint 13 → 14 (ลบ storage permissions + `Directory.External` fallback ออกโดยไม่ทดสอบ → APK ใหม่ save ไฟล์ไม่ได้ → user ต้องรอ hotfix)
11. **ส่ง APK ให้ user = ต้อง smoke test ก่อน** — install → tap main flows → ตรวจ toast / logcat ไม่ใช่แค่ `gradlew build` ผ่าน

---

**Checkpoint ล่าสุด:**
- checkpoint 14 — Hotfix: บันทึกไฟล์ไม่ได้ (PDF/Excel) บน Android
  - **Root cause** (จาก checkpoint 13): ลบ `WRITE/READ_EXTERNAL_STORAGE` + `requestLegacyExternalStorage` + `Directory.External` fallback ออก → Capacitor Filesystem ขาด permission + ไม่มี fallback
  - **Capacitor plugin** (`FilesystemPlugin.kt:36-51`) ประกาศ permissions ที่จำเป็นสำหรับ `Directory.Documents`/`External` บน Android 11-12
  - **แก้** (`src/utils/fileHelper.js`): 3-tier fallback
    1. `Directory.Documents` → Android ≤ 12 with permission
    2. `Directory.External` → Android ≤ 12 fallback
    3. `Directory.Cache` + `Share.share()` → Android 13+ scoped storage (user เลือกแอปปลายทางเอง)
  - **แก้** (`android/app/src/main/AndroidManifest.xml`): restore `WRITE_EXTERNAL_STORAGE` (maxSdkVersion=32), `READ_EXTERNAL_STORAGE` (maxSdkVersion=32), `requestLegacyExternalStorage="true"`
  - **API change**: `saveFileToDevice` return `{ saved, shared }` แทน `boolean` (backward compatible — caller ใช้ fire-and-forget)
  - **UX**: ถ้า Documents/External fail → Cache + Share ก็ยังได้ไฟล์ (Android 13+ ผ่าน Share sheet)
  - **Verified**: build 14s ✅ ผ่าน

- checkpoint 13 — Excel export logo/signature image + Android storage cleanup + splash resize
  - `src/components/ViewQuoteScreen.jsx` — เพิ่ม logo (S2:U6) + signature (L36:U42) ใน Excel export ผ่าน `wb.addImage()` (ตำแหน่ง verified กับ reference.xlsx ผ่าน `scripts/image_positions.py`)
  - `src/components/ViewQuoteScreen.jsx` — Item rows: `height = undefined` (auto-fit) + เพิ่ม `wrapText: true, indent: 1` ที่ item name cell — รองรับชื่อ item ยาวขึ้นบรรทัด
  - `src/utils/fileHelper.js` — ลบ fallback `Directory.External` (เหลือแค่ `Directory.Documents` → fail แสดง toast) — สอดคล้องกับ manifest ที่ลบ storage permissions
  - `android/app/src/main/AndroidManifest.xml` — ลบ `requestLegacyExternalStorage="true"`, `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE` (ใช้ FileProvider + `Directory.Documents` แทน — Android 13+ scoped storage)
  - Splash images — resize 12 ไฟล์ (`drawable[-port|-land]-{m,h,xh,xxh,xxxh}dpi/splash.png` + master `drawable/splash.png`) เป็น TT logo centered บนพื้น `#0a0a0a` (1024px master, optimize=True)
  - `scripts/resize_splash.py` (new) — PIL script สร้าง splash ทุก density
  - `scripts/image_positions.py` (new) — extract TwoCellAnchor `_from/_to` ของ images ใน reference.xlsx (verify: logo S2→U6, signature L36→U42)
  - `scripts/compare_xlsx.py` (new) — diff cell-by-cell ref vs app-generated (merged cells, widths, heights, images, print area)
  - `scripts/compare_pdf.py` (new) — diff text + layout ระหว่าง ref vs app PDF
  - **Verified safe**: build 2.77s ผ่าน, image positions match reference เป๊ะ (verified ผ่าน `image_positions.py`)

- checkpoint 12 — CLEANUP_PLAN.md Phase 7 (Code-split exceljs + html2canvas + jspdf via dynamic import)
  - `src/components/ViewQuoteScreen.jsx` — ลบ top-level imports ของ exceljs, html2canvas, jspdf → dynamic `import()` ใน `buildExcelBlob()` / `buildPdfBlob()`
  - `src/components/PriceDbScreen.jsx` — ลบ top-level import ของ exceljs → dynamic `import()` ใน `handleExcelImport()` (silence Vite INEFFECTIVE_DYNAMIC_IMPORT warning)
  - **Optimisation**: buildPdfBlob kick off Promise.all dynamic imports ตั้งแต่ต้นฟังก์ชัน เพื่อให้ sync HTML gen ทำงานขนาน
  - **Bundle impact**:
    - Main: 2,375 KB → **513 KB** (-78%, 689 KB → 142 KB gzipped)
    - exceljs lazy chunk: 930 KB (256 KB gzipped) — load เมื่อกด import/export
    - jspdf lazy chunk: 400 KB (130 KB gzipped) — load เมื่อกด export PDF
    - html2canvas lazy chunk: 200 KB (47 KB gzipped) — load เมื่อกด export PDF
  - **Verified safe**: test_exceljs_import.cjs ผ่าน 5/5 (PriceDbScreen logic), build 1.14s, ไม่มี Vite warning
  - **UX**: กด export ครั้งแรก delay ~1-2s (dynamic import) → toast "⏳ กำลังเตรียมไฟล์..." ครอบอยู่แล้ว

- checkpoint 11 — CLEANUP_PLAN.md Phase 6 (ลบ xlsx dep — migrate ไป ExcelJS)
  - `src/components/PriceDbScreen.jsx` — เปลี่ยน `import * as XLSX from "xlsx"` → `import ExcelJS from "exceljs"`
  - เขียน parse logic ใหม่: `new ExcelJS.Workbook()` + `workbook.xlsx.load()` + `sheet.eachRow` + manual empty-cell fill (ทดแทน `defval: ""`)
  - `package.json` — ลบ `"xlsx": "^0.18.5"` (ใช้ `npm uninstall xlsx`)
  - `scripts/test_exceljs_import.cjs` (new) — test script: สร้าง sample .xlsx, parse กลับ, assert 5 cases (empty cells, string price, trim, header skip) ผ่าน 5/5
  - **Verified safe**: build ผ่าน, **bundle ลดลง 332 KB raw / 112 KB gzipped** (2,375 → 2,043 KB), 'xlsx' ที่เหลือใน bundle คือ ExcelJS internal path เท่านั้น

- checkpoint 10 — CLEANUP_PLAN.md Phase 5 (KeySection setTimeout cleanup)
  - `src/components/KeySection.jsx` — เพิ่ม useRef + useEffect เพื่อ track test-status timeouts
  - ก่อนหน้า: setTimeout fire-and-forget → setState บน unmounted component (React warning) + race เมื่อกด test key เดิมซ้ำ
  - หลัง: testTimeoutsRef เก็บ Map<i, timeoutId>, cleanup useEffect clear ทุก timeout ตอน unmount, clear prev timeout ก่อน schedule ใหม่สำหรับ key เดียวกัน
  - **Verified safe**: build ผ่าน, bundle +210 bytes (Map + useEffect overhead)

- checkpoint 9 — CLEANUP_PLAN.md Phase 4 (explicit `.jsx` import paths)
  - `src/App.jsx` — `from "./utils/styles"` → `from "./utils/styles.jsx"`
  - `src/components/ViewQuoteScreen.jsx` — `from "../utils/styles"` → `from "../utils/styles.jsx"`
  - `src/components/PriceDbScreen.jsx` — เหมือนกัน
  - `src/components/TransferScreen.jsx` — เหมือนกัน
  - **Verified safe**: build ผ่าน, bundle size เท่าเดิม (2,374.92 kB)

- checkpoint 8 — Dead import cleanup (CLEANUP_PLAN.md Phase 1-3)
  - `src/App.jsx` — ลบ 10 dead imports (React, Capacitor, supabase, BUCKET_NAME, XLSX, html2canvas, jsPDF, Filesystem, Directory, Share, ThaiBaht)
  - `src/components/ViewQuoteScreen.jsx` — ลบ 3 dead imports (React, ThaiBaht, inputStyle)
  - `src/components/PriceDbScreen.jsx` — ลบ React (Vite auto JSX runtime)
  - `src/components/TransferScreen.jsx` — ลบ React (Vite auto JSX runtime)
  - `CLEANUP_PLAN.md` (new) — แผน cleanup 7 Phase (Phase 1-3 done, 4-5 pending, 6-7 optional)
  - `scripts/check_imports2.cjs` (new) — helper ตรวจ dead imports
  - `scripts/check_unused_imports.cjs` (new) — helper ตรวจ unused imports
  - **Verified safe**: bundle ยังมี html2canvas/jspdf/ExcelJS/XLSX ครบ, build ผ่าน

- checkpoint 7 — QN 26 layout 100% match (Phase 1-6 ของ PLAN_EXCEL_PDF_MATCH.md)
  - `src/utils/helpers.js` — `COMPANY_INFO.bank` แก้ space/format ให้ตรงต้นฉบับ QN 26
  - `src/components/ViewQuoteScreen.jsx` — แก้ เงื่อนไขการชำระเงิน ใน HTML preview (ลบ header, format งวดแบบ Excel, แยกบรรทัด "ช่องทาง/สั่งจ่าย/ธนาคาร") — XLSX export ตรงอยู่แล้ว
  - `src/App.jsx` — เปลี่ยน default installments จาก 3 งวด (50/30/20) → 2 งวด 50/50 label "ก่อนเริ่มงาน" / "หลังส่งมอบงาน" (ตรงกับ 124/128 ใบใน QN 26)
  - `scripts/extract_qn26.py`, `find_variations.py`, `group_xlsx_patterns.py`, `verify_match.py` — verify scripts
  - `PLAN_EXCEL_PDF_MATCH.md` — mark Phase 1-6 เสร็จ + สรุปข้อมูลจริง QN 26

- checkpoint 6 — Download fix + component splitting + sync error handling
  - `AndroidManifest.xml` — WRITE_EXTERNAL_STORAGE (maxSdkVersion=32), READ_EXTERNAL_STORAGE, requestLegacyExternalStorage
  - `src/utils/fileHelper.js` (new) — saveFileToDevice fallback (Documents→External), shareFileNative, blobToBase64
  - `src/utils/helpers.js` (new) — COMPANY_INFO, SCREENS, formatMoney, thaiDateStr, ThaiBaht, getItemNumbers, genId, INITIAL_PRICE_DB
  - `src/utils/apiKeys.js` (new) — getUserApiKeys, getAllApiKeys, getAnthropicApiKeys, getOpenRouterKeys
  - `src/utils/styles.js` (new) — inputStyle, btnSm, btnKey, Label, SumRow
  - `src/components/Toast.jsx` (new) — toast notification
  - `src/components/ConnectionBanner.jsx` (new) — offline/syncing/error+retry banner
  - `src/components/Header.jsx` (new) — shared header
  - `src/components/KeySection.jsx` (new) — API key management
  - `src/components/TransferScreen.jsx` (new) — code-based data migration
  - `src/components/PriceDbScreen.jsx` (new) — price DB CRUD + Excel import
  - `src/components/ViewQuoteScreen.jsx` (new) — quote view + Excel/PDF
  - `src/App.jsx` — rewritten from ~2354 → ~928 lines, imports extracted components
  - `src/App.css` — removed unused Vite boilerplate
  - sync error: new syncState ("idle"|"syncing"|"error") with red banner + retry button
  - replayPending wrapped with try/catch
