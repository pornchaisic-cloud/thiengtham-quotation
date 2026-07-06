# FIX_PLAN — แผนงาน ThiengTham Quotation App

> **แผนหลัก** ของโปรเจกต์ — ครอบคลุม Supabase sync, offline UI, AI integration, QN 26 layout, Android build, dead code cleanup
>
> **แผนเสริม:** `CLEANUP_PLAN.md` (Phase 1-7), `PLAN_EXCEL_PDF_MATCH.md` (Phase 1-6), `PLAN_CHECKPOINT16_BUGFIX.md` (T0-T3)

---

## สถานะโค้ดปัจจุบัน (2026-07-06)

- ✅ **Phase 0-5** — Supabase sync / RLS / offline UI / dead code / AI fields (checkpoint 3-6)
- ✅ **Phase 6** — QN 26 layout 100% match (checkpoint 7)
- ✅ **Phase 7** — Dead imports + Bundle cleanup 7 phase (checkpoint 8-12)
- ✅ **Phase 8** — Android storage cleanup + Excel logo/sig (checkpoint 13)
- ✅ **Phase 9** — APK save file hotfix (checkpoint 14) — 3-tier fallback Documents→External→Cache+Share
- ✅ **Phase 10** — QN 26 layout refine + logo fallback + correct taxId (checkpoint 15)
- ✅ **Phase 11** — T1+T2+T3 bugfix (checkpoint 16+17) — subtotal fallback, PDF A4→Letter, logo anchor
- ✅ **Phase 12** — Build env: foojay JDK21 auto-download (checkpoint 18)
- ✅ **Phase 13** — Verification helpers for T1+T2+T3 (checkpoint 20)
- ✅ **Phase 14** — P1-12 prompt enhancement: AI populate overhead/discount/paymentTerms (checkpoint 21)

**สรุป: เสร็จครบทุก phase** (checkpoint 1-21) — พร้อม commit/push ผ่าน SSH

---

## สรุปตรวจ Priority List

### Phase 0-5 (checkpoint 3-6)

| ข้อ | เดิม | สถานะ |
|---|---|---|
| P0-1 | ปุ่มดาวน์โหลดไม่เซฟไฟล์ | ✅ blob download + a.click() + Filesystem/Share |
| P0-2 | CDN dynamic inject | ✅ npm import |
| P0-3 | deleteQuote ลบ local ก่อน cloud | ✅ sync layer |
| P0-4 | saveQuote fire-and-forget | ✅ sync layer |
| P0-5 | useEffect catch เงียบ | ✅ sync layer |
| P0-6 | Dead code | ✅ Phase 1-3 CLEANUP |
| P1-7 | sync ไม่ครบ | ✅ sync layer + RLS |
| P1-8 | ไม่มี offline UI | ✅ ConnectionBanner + pending queue |
| P1-9 | API key hardcode | ✅ Phase 0 .env |
| P1-10 | form ไม่ reset | ✅ component remount reset จริง |
| P1-11 | label "Claude" แต่ใช้ Gemini/Llama | ✅ ทุก "Claude" อยู่ใน Anthropic path (Claude จริง) — checkpoint 4 |
| P1-12 | AI ไม่ใช้ overhead/discount/terms | ✅ JSON schema ครบ + prompt บอก default (App.jsx:751-758) |

### Phase 6+ (checkpoint 7-21)

| ข้อ | เดิม | สถานะ |
|---|---|---|
| P0-13 | APK save file พัง (checkpoint 13 ลบ storage permissions + fallback) | ✅ checkpoint 14 — restore 3-tier fallback (Documents→External→Cache+Share) + restore AndroidManifest permissions |
| P1-14 | T1 subtotal=0 (quote ไม่มี field subtotal → grand total ผิด) | ✅ checkpoint 16 — fallback = items.reduce(qty*price) |
| P1-15 | T2 PDF page size A4 (8.27×11.69") แต่ REF = Letter (8.5×11") | ✅ checkpoint 16 — `format: "letter"`, pdfW=215.9mm, pdfH=279.4mm |
| P1-16 | xlsx duplicate dep (ใช้ ExcelJS แล้วแต่ xlsx ยังอยู่) | ✅ checkpoint 11 — migrate + `npm uninstall xlsx` (-332 KB raw / -112 KB gzipped) |
| P1-17 | Bundle 2.3 MB (html2canvas+jspdf หนัก) | ✅ checkpoint 12 — code-split via dynamic import (main 2,375 → 513 KB, -78%) |
| P1-18 | Dead imports 13 ตัว (App.jsx 10 + ViewQuoteScreen 3) | ✅ checkpoint 8 — ลบ + ลบ `React` import ใน PriceDbScreen/TransferScreen |
| P1-19 | Import paths ไม่ explicit (4 ไฟล์) | ✅ checkpoint 9 — explicit `.jsx` paths |
| P2-20 | KeySection setTimeout no cleanup (React warning) | ✅ checkpoint 10 — useRef + Map<i, timeoutId> + cleanup |
| P2-21 | Logo Excel image overshoot 1 row (T3) | ✅ checkpoint 17 — `br: { row: 5.999 }` (แทน 6) |
| P2-22 | AndroidManifest storage cleanup (checkpoint 13) | ⚠️ **ย้อนกลับ** checkpoint 14 — restore permissions + `requestLegacyExternalStorage` (RULES.md rule 10-11) |
| P2-23 | QN 26 layout refine: taxId, address "(สำนักงานใหญ่)", logo fallback, PDF subcontractor header | ✅ checkpoint 15 |
| P2-24 | JDK 21 missing on dev เครื่องใหม่ (Capacitor 8 ต้องการ) | ✅ checkpoint 18 — foojay-resolver-convention plugin auto-download |
| P2-25 | Verification helpers สำหรับ T1+T2+T3 | ✅ checkpoint 20 — `scripts/verify_android.cjs` + `verify_android.bat` |
| P2-26 | AI prompt บอกให้ populate overheadPct/discount/paymentTerms (ซ้ำ P1-12 แต่ละเอียดขึ้น) | ✅ checkpoint 21 — เพิ่ม default rule 10/15/20% ตามประเภทงาน |

---

## ทิศทางที่เลือก

> **localStorage + Supabase ทั้งคู่**, sync 2 ทาง consistent (ลบในแอป→ลบ cloud), anonymous per-device, sync ทั้ง quotes + priceDb
>
> **AI**: รองรับ 3 providers (Gemini direct, OpenRouter Gemini/Llama, Anthropic Claude) — key rotation + model fallback chain
>
> **Excel/PDF**: ใช้ ExcelJS + jsPDF (dynamic import) — ตรงต้นฉบับ QN 26 (US Letter, 27-column, 2 งวด 50/50 default)

---

## Phase 0 — ย้าย secret ออกจาก source (P1-9)

**ทำอะไร:**
- สร้าง `.env` วาง `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- สร้าง `.env.example` (ไม่มีค่าจริง) เป็น template
- เพิ่ม `.env` ใน `.gitignore`
- แก้ `src/lib/supabase.js` อ่านจาก `import.meta.env.VITE_*`

**แก้:** P1-9
**ไฟล์:** `.env`, `.env.example`, `.gitignore`, `src/lib/supabase.js`
**Checkpoint:** 3 ✅

---

## Phase 1 — Supabase Schema + RLS + Anonymous Auth

**ทำอะไร:**
- รัน SQL สร้าง table + RLS ใน Supabase Dashboard (ใช้ Playwright ตาม RULES)
- เปิด Anonymous Auth ใน Dashboard

**Schema:**
```sql
-- quotes: ข้อมูลใบเสนอราคา
create table quotes (
  id text primary key,
  user_id uuid not null references auth.users(id),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz           -- soft delete
);

-- price_db: รายการราคา (1 row ต่อ user)
create table price_db (
  user_id uuid primary key references auth.users(id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS: แต่ละ anonymous user เห็นของตัวเองเท่านั้น
alter table quotes enable row level security;
create policy "own quotes" on quotes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table price_db enable row level security;
create policy "own price_db" on price_db
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**แก้:** ปูพื้น cloud
**เครื่องมือ:** Playwright (ตาม RULES)
**Checkpoint:** 4 ✅

---

## Phase 2 — Sync Layer (`src/lib/sync.js`) + เชื่อม App.jsx

**ทำอะไร:**
- สร้าง `src/lib/sync.js` — โมดูลกลางจัดการ cloud sync
- เชื่อมเข้า App.jsx: `saveQuote`, `deleteQuote`, `useEffect` load

**ฟังก์ชัน sync.js:**
```
getOrCreateDevice()  → signInAnonymously, เก็บ session reuse
upsertQuote(q)       → upsert quotes row (user_id, data, updated_at)
deleteQuote(id)      → soft delete (set deleted_at)
upsertPriceDb(db)    → upsert price_db row
pullAll()            → select quotes (deleted_at is null) + price_db
```

**กลยุทธ์ sync:**
- **Local-first + optimistic:** อัปเดต local ทันที → push cloud ใน background
- **Rollback:** cloud fail → คืน state เดิม + toast error
- **Pending queue:** offline → เก็บ action → sync ตอน online
- **Conflict:** last-write-wins ตาม `updated_at`

**เชื่อม App.jsx:**
- `saveQuote(q)` → local set + `sync.upsertQuote(q)` (await + try/catch)
- `deleteQuote(id)` → local filter + `sync.deleteQuote(id)` + rollback ถ้า fail
- `useEffect` load → `sync.getOrCreateDevice()` → `pullAll()` → merge → fallback localStorage

**แก้:** P0-3, P0-4, P0-5, P1-7 (จริงจัง ตั้งแต่ต้น)
**ไฟล์ใหม่:** `src/lib/sync.js`
**ไฟล์แก้:** `src/App.jsx`
**Checkpoint:** 5 ✅

---

## Phase 3 — Offline UI (P1-8)

**ทำอะไร:**
- state `online` (init `navigator.onLine`) + listener `online`/`offline`
- Banner: 🟢 online | 🟡 offline (pending X) | 🔴 sync error + retry
- Offline → save/delete ทำงานปกติ (local) + เข้า pending queue + toast

**แก้:** P1-8
**ไฟล์แก้:** `src/App.jsx`
**Checkpoint:** 6 ✅

---

## Phase 4 — แก้ปัญหาคงค้าง

**4a) Dead code (P0-6):**
- ลบ `pdfPreviewUrl/setPdfPreviewUrl` (App.jsx:159)
- ลบ `import { Browser }` (App.jsx:2) — ไม่ได้ใช้
- ตรวจคอมเมนต์อ้างถึง pdfPreviewUrl (บรรทัด 2066) → ลบ/แก้

**4b) Label "Claude" (P1-11):**
- เปลี่ยน "Claude (OpenRouter)" → "Gemini/Llama (OpenRouter)"
- จุด: App.jsx 1634, 1400, 1475, 1735
- ส่วน Anthropic path ที่ใช้ Claude จริง → คง label "Claude" ไว้

**4c) AI fields (P1-12):**
- เพิ่ม `overheadPct`, `discount`, `paymentTerms` ใน JSON schema ของ prompt (App.jsx:753)
- แก้ `createQuoteFromResult` อ่านจาก result แทน hardcode 0 (App.jsx:852)
- เพิ่ม "กฎค่าทางการเงิน" ใน systemPromptBase (App.jsx:751-758) — สั่ง AI กรอก default overhead 10-20% / discount เฉพาะที่ระบุ / paymentTerms default 50-50

**แก้:** P0-6, P1-11, P1-12
**ไฟล์แก้:** `src/App.jsx`
**Checkpoint:** 7 ✅

---

## Phase 5 — ย้ายข้อมูลไปเครื่องใหม่

**ทำอะไร:**
- ปุ่ม "ย้ายข้อมูลไปเครื่องใหม่" ในหน้าตั้งค่า
- สร้าง 6-digit code (ผูก anonymous session, หมดอายุ 15 นาที)
- เครื่องใหม่ใส่ code → pullAll()

**Checkpoint:** 6 ✅

---

## Phase 6 — QN 26 layout 100% match (PLAN_EXCEL_PDF_MATCH.md)

**ทำอะไร:**
- เปลี่ยน `xlsx` → `exceljs` + เขียน `buildExcelBlob()` ใหม่ — 27 คอลัมน์, merge cells, fonts/borders
- เขียน `buildPdfBlob()` HTML template ใหม่ — header, customer info, items, summary, signature 3 ฝ่าย
- เปลี่ยน default installments 3 งวด (50/30/20) → 2 งวด 50/50 (124/128 ใบใน QN 26 ใช้แบบนี้)
- ปรับ label การคำนวณ: GROSS TOTAL → Overhead&Profit → VAT 7% → NET GROSS

**แก้:** Excel/PDF ไม่ตรงต้นฉบับ
**Checkpoint:** 7 ✅
**แผนย่อย:** `PLAN_EXCEL_PDF_MATCH.md`

---

## Phase 7 — Dead code / Bundle cleanup 7 phase (CLEANUP_PLAN.md)

| Sub-phase | ทำอะไร | Checkpoint |
|---|---|---|
| Phase 1-3 | Dead imports (App.jsx 10, ViewQuoteScreen 3, PriceDbScreen React, TransferScreen React) | ✅ checkpoint 8 |
| Phase 4 | Explicit `.jsx` paths (4 ไฟล์) | ✅ checkpoint 9 |
| Phase 5 | KeySection setTimeout cleanup (useRef + Map<i, timeoutId>) | ✅ checkpoint 10 |
| Phase 6 | xlsx → ExcelJS migration + `npm uninstall xlsx` (-332 KB) | ✅ checkpoint 11 |
| Phase 7 | Code-split exceljs/html2canvas/jspdf via dynamic import (main 2,375 → 513 KB, -78%) | ✅ checkpoint 12 |

**ผลรวม:** Bundle -78% raw / -75% gzipped — ทุก feature เดิมยังทำงาน
**แผนย่อย:** `CLEANUP_PLAN.md`

---

## Phase 8 — Android storage cleanup + Excel logo/sig

**ทำอะไร:**
- เพิ่ม logo (S2:U6) + signature (L36:U42) ใน Excel export ผ่าน `wb.addImage()` (ตำแหน่ง verified กับ reference.xlsx)
- Item rows: `height = undefined` (auto-fit) + `wrapText: true, indent: 1`
- AndroidManifest ลบ storage permissions + `requestLegacyExternalStorage` (assumption ว่า Android 13+ scoped storage พอ)
- ลบ `Directory.External` fallback ใน `fileHelper.js`
- Splash images resize 12 ไฟล์ทุก density

**Checkpoint:** 13 ✅
**⚠️ Side-effect:** ทำให้ APK save file พัง — ต้อง rollback ใน Phase 9 (RULES.md rule 10-11)

---

## Phase 9 — APK save file hotfix

**Root cause:** Phase 8 ลบ `WRITE/READ_EXTERNAL_STORAGE` + `requestLegacyExternalStorage` + `Directory.External` fallback ออกโดยไม่ verify — Capacitor Filesystem (`FilesystemPlugin.kt:36-51`) ต้องการ permissions เหล่านี้บน Android ≤ 12

**แก้:**
1. `src/utils/fileHelper.js` — 3-tier fallback
   - `Directory.Documents` (Android ≤ 12 with permission)
   - `Directory.External` (Android ≤ 12 fallback)
   - `Directory.Cache` + `Share.share()` (Android 13+ scoped storage)
2. `AndroidManifest.xml` — restore `WRITE_EXTERNAL_STORAGE` (maxSdkVersion=32), `READ_EXTERNAL_STORAGE` (maxSdkVersion=32), `requestLegacyExternalStorage="true"`
3. `saveFileToDevice` return `{ saved, shared }` แทน `boolean` (backward compatible)

**Checkpoint:** 14 ✅
**Lesson:** RULES.md rule 10-11 — ห้ามลบ runtime-critical code โดยไม่ verify บน Android จริง + ส่ง APK = ต้อง smoke test

---

## Phase 10 — QN 26 layout refine

**ทำอะไร:**
- `taxId`: `1729900000000` → **`1729900082674`** (เลขจริงที่ใช้ในใบเสนอราคา บริษัท เที่ยงทำฯ)
- `address` → เพิ่ม "(สำนักงานใหญ่)" ท้ายที่อยู่
- `getDefaultLogoBase64()` — preload `/logo.png` เป็น base64 (cache) เพื่อให้ `ExcelJS.addImage()` ใช้ได้แม้ `quote.logo` เป็น path
- Logo block fallback เป็น defaultLogoB64 เมื่อ `quote.logo.length <= 64`
- Signature block skip add image ถ้า `quote.signature.length <= 64` (กัน crash)
- `ws.mergeCells("A2:C2")` + label "ชื่อผู้รับเหมา"
- `ws.mergeCells("A5:D5")` + label "เลขประจำตัวผู้เสียภาษี"
- `wb.creator = COMPANY_INFO.subcontractorName` (QN 26 metadata)
- PDF header: "ชื่อผู้รับเหมา : {quote.subcontractorName}" (font 15px → 13px)

**Checkpoint:** 15 ✅

---

## Phase 11 — T1+T2+T3 bugfix (PLAN_CHECKPOINT16_BUGFIX.md)

**Origin:** post-checkpoint 15 auto-export verification (2026-07-04 19:56) — playwright MCP + inject TT-QN-062-26 fake quote + compare vs `scripts/ref_qn.xlsx`

| Bug | Severity | Fix | Checkpoint |
|---|---|---|---|
| T1 subtotal=0 | 🔴 High | `subtotalUI = Number(quote.subtotal) || quote.items.reduce(...)` ใน UI/Excel/PDF | ✅ checkpoint 16 |
| T2 PDF size A4 | 🟡 Med | `format: "letter"`, pdfW=215.9mm, pdfH=279.4mm | ✅ checkpoint 16 |
| T3 logo row+1 | 🟢 Low | `br: { col: 20.999, row: 5.999 }` (แทน 6) | ✅ checkpoint 17 |

**แผนย่อย:** `PLAN_CHECKPOINT16_BUGFIX.md`

---

## Phase 12 — Build env: foojay JDK21 auto-download

**Root cause:** Capacitor 8 plugin (`@capacitor/filesystem@8.1.2`) ต้องการ JDK 21 — ถ้า dev เครื่องใหม่ไม่ได้ติดตั้ง + ไม่ได้ set `JAVA_HOME` → gradle build fail ด้วย `Could not find tools.jar`

**แก้:**
- `android/settings.gradle` — เพิ่ม `pluginManagement { repositories { gradlePluginPortal(); google(); mavenCentral() } }` + `plugins { id 'org.gradle.toolchains.foojay-resolver-convention' version '0.8.0' }`
- foojay-resolver auto-download JDK 21 ตาม `toolchain.languageVersion`

**Checkpoint:** 18 ✅
**Verified:** `cd android && ./gradlew assembleDebug` ผ่าน 14s

---

## Phase 13 — Verification helpers

**ทำอะไร:**
- `scripts/verify_android.cjs` (new) — smoke test helper: install APK + cold launch + tap main flows + check toast/logcat
- `scripts/verify_android.bat` (new) — Windows wrapper

**Context:** RULES.md rule 11 — "Build pass ≠ runtime work; APK ต้อง smoke test ก่อน ship"

**Checkpoint:** 20 ✅
**Usage:** `node scripts/verify_android.cjs` (หรือ `verify_android.bat`)

---

## Phase 14 — AI prompt enhancement: populate overhead/discount/paymentTerms

**ทำอะไร:**
- เพิ่มกฎใน systemPromptBase (App.jsx:751-758):
  - `overheadPct`: 10 = งานทั่วไป / 15 = renovate-ซ่อม / 20 = งานด่วน
  - `discount`: 0 (ถ้าผู้ใช้ไม่ระบุ)
  - `paymentTerms`: "ชำระ 50% ก่อนเริ่มงาน, 50% หลังส่งมอบ"

**Checkpoint:** 21 ✅

---

## ลำดับทำ (ตาม dependency)

| ลำดับ | Phase | เริ่มหลัง | Checkpoint | สถานะ |
|---|---|---|---|---|
| 1 | Phase 0 — .env | - | checkpoint 3 | ✅ เสร็จ |
| 2 | Phase 1 — Schema + Auth | Phase 0 | checkpoint 4 | ✅ เสร็จ |
| 3 | Phase 2 — Sync layer | Phase 1 | checkpoint 5 | ✅ เสร็จ |
| 4 | Phase 3 — Offline UI | Phase 2 | checkpoint 6 | ✅ เสร็จ |
| 5 | Phase 4 — Dead code/label/AI | parallel กับ 3-4 | checkpoint 7 | ✅ เสร็จ |
| 6 | Phase 5 — ย้ายเครื่อง | Phase 2-3 | checkpoint 6 | ✅ เสร็จ |
| 7 | Phase 6 — QN 26 layout | Phase 5 | checkpoint 7 | ✅ เสร็จ |
| 8 | Phase 7 — Dead imports | parallel กับ 6 | checkpoint 8 | ✅ เสร็จ |
| 9 | Phase 7.2 — `.jsx` paths | Phase 7.1 | checkpoint 9 | ✅ เสร็จ |
| 10 | Phase 7.3 — KeySection cleanup | Phase 7.2 | checkpoint 10 | ✅ เสร็จ |
| 11 | Phase 7.4 — xlsx → ExcelJS | Phase 7.3 | checkpoint 11 | ✅ เสร็จ |
| 12 | Phase 7.5 — Code-split | Phase 7.4 | checkpoint 12 | ✅ เสร็จ |
| 13 | Phase 8 — Android storage cleanup + Excel logo/sig | Phase 7.5 | checkpoint 13 | ✅ เสร็จ |
| 14 | Phase 9 — APK save file hotfix | Phase 8 | checkpoint 14 | ✅ เสร็จ |
| 15 | Phase 10 — QN 26 layout refine | Phase 8 | checkpoint 15 | ✅ เสร็จ |
| 16 | Phase 11 — T1+T2 bugfix | Phase 10 | checkpoint 16 | ✅ เสร็จ |
| 17 | Phase 11.2 — T3 bugfix | Phase 11.1 | checkpoint 17 | ✅ เสร็จ |
| 18 | Phase 12 — foojay JDK21 | Phase 8 | checkpoint 18 | ✅ เสร็จ |
| 19 | Phase 13 — RULES sync 16+17+18 | Phase 12 | checkpoint 19 | ✅ เสร็จ |
| 20 | Phase 13.2 — Verification helpers | Phase 11.2 | checkpoint 20 | ✅ เสร็จ |
| 21 | Phase 14 — AI prompt populate defaults | Phase 4 | checkpoint 21 | ✅ เสร็จ |

> ✅ **Phase 0-14 เสร็จเรียบร้อยทุกข้อ** (รวม P1-11 + P1-12 + P0-13 + T1+T2+T3)

---

## หมายเหตุ

- `attachments[].data`, `logo`, `signature` เป็น base64 → เก็บใน jsonb ก่อน ถ้าเกิน 1MB/row → ย้ายไป Storage bucket
- Anonymous auth ไม่มี email → ข้อมูลผูก device สามารถ "link email" ภายหลังได้โดยไม่เขียนใหม่
- ทำ checkpoint (git commit) ทุกครั้งหลังแก้โค้ด (ตาม RULES.md rule 6)
- **RULES.md rule 10-11** (เรียนรู้จาก checkpoint 13→14): ห้ามลบ runtime-critical code โดยไม่ verify บน Android จริง + APK ต้อง smoke test ก่อน ship
- AI provider labels (App.jsx:883-885): `gemini` → "🔵 Google Gemini", `openrouter` → "⚡ Gemini/Llama (OpenRouter)", `anthropic` → "🟠 Claude (Direct)" — ทั้งหมดถูก label แล้ว
- API key format Antigravity/Proxy (`AQ.Ab8...`) ทำงานผ่าน gateway ของ user ได้ — ไม่ต้องเปลี่ยนเป็น `AIzaSy...` ปกติ
- Remote: `git@github.com:pornchaisic-cloud/thiengtham-quotation.git` (SSH) — ไม่ใช้ token/PAT แล้ว

---

## GitHub

https://github.com/pornchaisic-cloud/thiengtham-quotation

**SSH setup:**
- Key: `thiengtham_push_ed25519` (pornchaisic-cloud)
- 19 commits pushed: `923db89..d3a4c9a`
- ❌ Tokens: ลบทั้งบนเครื่องและที่ GitHub
- ❌ Env var `GH_TOKEN`: ลบ