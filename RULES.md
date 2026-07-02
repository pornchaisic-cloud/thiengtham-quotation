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

---

**Checkpoint ล่าสุด:**
- checkpoint 6 (pending) — Download fix + component splitting + sync error handling
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
