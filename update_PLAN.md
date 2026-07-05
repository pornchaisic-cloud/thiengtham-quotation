# FIX_PLAN — แผนงาน ThiengTham Quotation App

## สถานะโค้ดปัจจุบัน

- **Architecture:** localStorage + Supabase sync (Phase 0-5 เสร็จแล้ว — checkpoint 3-6)
- **Supabase:** anonymous auth + RLS + sync layer ทำงานแล้ว
- **Offline UI:** ConnectionBanner + pending queue ทำงานแล้ว
- **Dead code:** Phase 1-3 ของ CLEANUP_PLAN เสร็จแล้ว (checkpoint 8)
- **Excel/PDF layout:** เสร็จ Phase 1-6 (checkpoint 7) + bugfix T1+T2+T3 (checkpoint 16+17)
- **Bugfix ล่าสุด:** subtotal fallback, PDF page Letter, logo anchor (checkpoint 16+17)

---

## สรุปตรวจ Priority List เดิม

| ข้อ | เดิม | ความจริงตอนนี้ | สถานะ |
|---|---|---|---|
| P0-1 | ปุ่มดาวน์โหลดไม่เซฟไฟล์ | ใช้ blob download + a.click() + Filesystem/Share แล้ว | ✅ แก้แล้ว |
| P0-2 | CDN dynamic inject | เปลี่ยนเป็น npm import แล้ว | ✅ แก้แล้ว |
| P0-3 | deleteQuote ลบ local ก่อน cloud | sync layer แก้แล้ว | ✅ แก้แล้ว |
| P0-4 | saveQuote fire-and-forget | sync layer แก้แล้ว | ✅ แก้แล้ว |
| P0-5 | useEffect catch เงียบ | sync layer แก้แล้ว | ✅ แก้แล้ว |
| P0-6 | Dead code | Phase 1-3 CLEANUP เสร็จแล้ว | ✅ แก้แล้ว |
| P1-7 | sync ไม่ครบ | sync layer + RLS เสร็จแล้ว | ✅ แก้แล้ว |
| P1-8 | ไม่มี offline UI | ConnectionBanner + pending queue เสร็จแล้ว | ✅ แก้แล้ว |
| P1-9 | API key hardcode | Phase 0 .env เสร็จแล้ว | ✅ แก้แล้ว |
| P1-10 | form ไม่ reset | component remount แล้ว reset จริง | ✅ ไม่ใช่ปัญหา |
| P1-11 | label "Claude" แต่ใช้ Gemini/Llama | ยังต้องตรวจ + แก้ | ⚠️ ค้าง |
| P1-12 | AI ไม่ใช้ overhead/discount/terms | hardcode 0 + prompt ไม่ขอ | ⚠️ ค้าง |

---

## ทิศทางที่เลือก

> **localStorage + Supabase ทั้งคู่**, sync 2 ทาง consistent (ลบในแอป→ลบ cloud), anonymous per-device, sync ทั้ง quotes + priceDb

---

## Phase 0 — ย้าย secret ออกจาก source (P1-9)

**ทำอะไร:**
- สร้าง `.env` วาง `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- สร้าง `.env.example` (ไม่มีค่าจริง) เป็น template
- เพิ่ม `.env` ใน `.gitignore`
- แก้ `src/lib/supabase.js` อ่านจาก `import.meta.env.VITE_*`

**แก้:** P1-9
**ไฟล์:** `.env`, `.env.example`, `.gitignore`, `src/lib/supabase.js`

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

---

## Phase 3 — Offline UI (P1-8)

**ทำอะไร:**
- state `online` (init `navigator.onLine`) + listener `online`/`offline`
- Banner: 🟢 online | 🟡 offline (pending X) | 🔴 sync error + retry
- Offline → save/delete ทำงานปกติ (local) + เข้า pending queue + toast

**แก้:** P1-8
**ไฟล์แก้:** `src/App.jsx`

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
- เพิ่ม `overheadPct`, `discount`, `paymentTerms` ใน JSON schema ของ prompt (App.jsx:1453)
- แก้ `createQuoteFromResult` อ่านจาก result แทน hardcode 0 (App.jsx:1612-1617)

**แก้:** P0-6, P1-11, P1-12
**ไฟล์แก้:** `src/App.jsx`

---

## Phase 5 — ย้ายข้อมูลไปเครื่องใหม่

**ทำอะไร:**
- ปุ่ม "ย้ายข้อมูลไปเครื่องใหม่" ในหน้าตั้งค่า
- สร้าง 6-digit code (ผูก anonymous session, หมดอายุ 15 นาที)
- เครื่องใหม่ใส่ code → pullAll()
- (ทำทีหลัง ไม่ block phase อื่น)

---

## ลำดับทำ (ตาม dependency)

| ลำดับ | Phase | เริ่มหลัง | checkpoint | สถานะ |
|---|---|---|---|---|
| 1 | Phase 0 — .env | - | checkpoint 3 | ✅ เสร็จ |
| 2 | Phase 1 — Schema + Auth | Phase 0 | checkpoint 4 | ✅ เสร็จ |
| 3 | Phase 2 — Sync layer | Phase 1 | checkpoint 5 | ✅ เสร็จ |
| 4 | Phase 3 — Offline UI | Phase 2 | checkpoint 6 | ✅ เสร็จ |
| 5 | Phase 4 — Dead code/label/AI | ทำ parallel กับ 3-4 | checkpoint 7 | ⚠️ AI label ค้าง |
| 6 | Phase 5 — ย้ายเครื่อง | Phase 2-3 เสร็จ | checkpoint 6 | ✅ เสร็จ |

> ✅ **Phase 0-5 เสร็จเรียบร้อย** ยกเว้น P1-11 (label "Claude") + P1-12 (AI overhead/discount)

---

## หมายเหตุ

- `attachments[].data`, `logo`, `signature` เป็น base64 → เก็บใน jsonb ก่อน ถ้าเกิน 1MB/row → ย้ายไป Storage bucket
- Anonymous auth ไม่มี email → ข้อมูลผูก device สามารถ "link email" ภายหลังได้โดยไม่เขียนใหม่
- ทำ checkpoint (git commit) ทุกครั้งหลังแก้โค้ด (ตาม RULES)
