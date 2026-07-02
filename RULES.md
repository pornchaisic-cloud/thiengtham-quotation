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
- checkpoint 5 (3796274) — Phase 2: sync layer + priceDbMeta merge + deploy assets
  - `src/lib/sync.js` (new) — getOrCreateDevice, upsertQuote, deleteQuote, upsertPriceDb, pullAll
  - `src/App.jsx` — priceDbMeta state, merge logic (last-write-wins), saveQuote timestamp, handleSetPriceDb wrapper
  - `update_PLAN.md` แทน `FIX_PLAN.md`
  - APK rebuilt, logo cleanup
