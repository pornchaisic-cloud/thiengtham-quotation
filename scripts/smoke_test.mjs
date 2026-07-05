// Smoke test for ThiengTham2 — T1+T2+T3 fixes
// - T1: subtotal fallback (UI/Excel/PDF)
// - T2: PDF page A4 → Letter
// - T3: logo anchor row 6 → 5.999
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "fs";

const BASE = "http://localhost:4173";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  const toasts = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console.error] ${msg.text()}`);
    if (msg.type() === "warning") errors.push(`[console.warn] ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

  // ── Capture URL.createObjectURL blobs (Excel/PDF) ────────────────────
  await page.addInitScript(() => {
    window.__captured = [];
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) {
      const entry = { type: blob.type, size: blob.size, blob, ts: Date.now() };
      window.__captured.push(entry);
      return origCreate(blob);
    };
  });

  // ── Inject test quote (matches QN 26 pattern) ─────────────────────────
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const fakeQuote = {
      quoteNo: "TT-QN-062-26",
      date: new Date("2026-01-07").toISOString(),
      customerName: "ดิ ยูนีค เท็น ไนน์",
      address: "",
      phone: "",
      project: "ดิ ยูนีค เท็น ไนน์ อาคาร - ชั้น - เลขที่ Unit : - (เลขที่บ้าน : 319/10)",
      remarks: "*งานนอกเหนือจากงานนี้เป็นงานเพิ่มเติมได้",
      paymentTerms: "",
      paymentInstallments: [
        { id: "i1", label: "ก่อนเริ่มงาน", pct: 50 },
        { id: "i2", label: "หลังส่งมอบงาน", pct: 50 },
      ],
      payeeName: null,
      subcontractorName: null,
      overhead: 6828,
      overheadPct: 15,
      vat: 0,
      discountAmt: 0,
      items: [
        { id: 1, name: "แก้ไขผนังแตกร้าว ขูดรอยร้าวและเซาะร่อง V อุดรอยร้าวด้วย non-shrink", unit: "งาน", qty: 1, price: 12840 },
        { id: 2, name: "งานขัดแต่งผิวให้เรียบ", unit: "งาน", qty: 1, price: 4180 },
        { id: 3, name: "งานทาสีผนังภายใน", unit: "ตร.ม.", qty: 50, price: 520 },
        { id: 4, name: "ค่าเดินทาง", unit: "วัน", qty: 5, price: 500 },
        { id: 5, name: "งานProtection+ทำความสะอาดเบื้องต้น(ฟรี)", unit: "", qty: 0, price: 0 },
      ],
      logo: null,
      signature: null,
    };
    localStorage.setItem("tt_quotes", JSON.stringify([fakeQuote]));
    // DON'T remove company logo — we WANT default logo to test T3
  });

  // ── Reload to pick up injected quote ────────────────────────────────
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // ── Screenshot the home / quote list ────────────────────────────────
  await page.screenshot({ path: "scripts/_smoke_home.png", fullPage: true });

  // ── Find ViewQuoteScreen route — try common patterns ────────────────
  // Try clicking on the first quote row to enter ViewQuoteScreen
  const quoteRow = await page.$("text=ดิ ยูนีค เท็น ไนน์");
  if (!quoteRow) {
    console.log("[smoke] FAIL: quote row not found");
    process.exit(1);
  }
  await quoteRow.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "scripts/_smoke_viewquote.png", fullPage: true });

  // ── UI GROSS TOTAL check — text should include amount (T1 fix) ──────
  const grossTotalVisible = await page.getByText("GROSS TOTAL", { exact: true }).isVisible();
  console.log(`[smoke] GROSS TOTAL row visible: ${grossTotalVisible}`);

  // ── Trigger Excel export ───────────────────────────────────────────
  const excelButton = await page.$('button:has-text("Excel")');
  if (excelButton) {
    await excelButton.click();
    await page.waitForTimeout(3000); // wait for ExcelJS to generate
  } else {
    console.log("[smoke] WARN: Excel export button not found");
  }

  // ── Trigger PDF export ─────────────────────────────────────────────
  const pdfButton = await page.$('button:has-text("PDF")');
  if (pdfButton) {
    await pdfButton.click();
    await page.waitForTimeout(5000); // wait for html2canvas+jspdf
  } else {
    console.log("[smoke] WARN: PDF export button not found");
  }

  // ── Save captured blobs ────────────────────────────────────────────
  const blobs = await page.evaluate(async () => {
    const out = [];
    for (const e of window.__captured) {
      const buf = await e.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      out.push({ type: e.type, size: e.size, b64: btoa(bin) });
    }
    return out;
  });

  for (const b of blobs) {
    if (b.type.includes("spreadsheet") || b.type.includes("excel")) {
      writeFileSync("scripts/smoke_excel.xlsx", Buffer.from(b.b64, "base64"));
      console.log(`[smoke] Excel saved: ${b.size} bytes`);
    } else if (b.type.includes("pdf")) {
      writeFileSync("scripts/smoke_pdf.pdf", Buffer.from(b.b64, "base64"));
      console.log(`[smoke] PDF saved: ${b.size} bytes`);
    }
  }

  console.log(`[smoke] console errors/warnings: ${errors.length}`);
  for (const e of errors) console.log(`  ${e}`);

  await browser.close();
  console.log("[smoke] DONE");
})().catch((e) => {
  console.error("[smoke] CRASH:", e.message);
  process.exit(1);
});
