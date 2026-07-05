# ThiengTham Quotation App

แอปสร้างใบเสนอราคาสำหรับ บริษัท เที่ยงทำ ดีเวลล็อปเมนท์ จำกัด

## Tech Stack

- **Frontend:** React 19 + Vite
- **Mobile:** Capacitor 8 (Android APK)
- **Database:** Supabase (localStorage fallback)
- **Export:** ExcelJS + jsPDF + html2canvas

## Features

- สร้าง/แก้ไข/ลบใบเสนอราคา
- AI วิเคราะห์ราคา (Anthropic / OpenRouter / Gemini)
- Export Excel + PDF (layout ตรงตามต้นฉบับ QN 26)
- Price DB พร้อม Excel import
- Sync ข้อมูลระหว่างอุปกรณ์ (Supabase anonymous auth)
- Offline support พร้อม pending queue
- ย้ายข้อมูลไปเครื่องใหม่ด้วยรหัส 6 หลัก

## Setup

```bash
npm install
npm run dev          # dev server ที่ localhost:5173
npm run build        # build production
npm run android      # build APK (Capacitor)
```

## Environment Variables

```bash
cp .env.example .env
# เพิ่ม VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
```

## Project Plans (Markdown Files)

| ไฟล์ | เนื้อหา |
|---|---|
| `RULES.md` | กฎการทำงาน + checkpoint history |
| `update_PLAN.md` | แผน Supabase sync + offline UI |
| `CLEANUP_PLAN.md` | แผน cleanup dead code + bundle size |
| `PLAN_EXCEL_PDF_MATCH.md` | แผนปรับ Excel/PDF layout ให้ตรง QN 26 |
| `PLAN_CHECKPOINT16_BUGFIX.md` | รายละเอียด bugfix T1+T2+T3 |

## GitHub

https://github.com/pornchaisic-cloud/thiengtham-quotation
