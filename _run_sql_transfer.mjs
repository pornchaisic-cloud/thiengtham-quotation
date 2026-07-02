import { chromium } from "playwright";
import { readFileSync } from "fs";

const PROJECT_REF = "tiehlmvwjvdlaoldtofu";
const BASE = `https://supabase.com/dashboard/project/${PROJECT_REF}`;
const SQL = readFileSync("sql_transfer.sql", "utf-8");

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  await page.goto(`${BASE}/sql/new`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));

  if (page.url().includes("login") || page.url().includes("sign-in")) {
    console.log("🔓 รอ login...");
    while (page.url().includes("login") || page.url().includes("sign-in")) {
      await new Promise((r) => setTimeout(r, 3000));
      try { await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
    }
  }
  console.log("✅ Login สำเร็จ");

  // รอให้ editor โหลด
  await new Promise((r) => setTimeout(r, 5000));

  // Focus editor via JavaScript (Monaco Editor)
  await page.evaluate(() => {
    const ta = document.querySelector("textarea[aria-label='Editor content']");
    if (ta) ta.focus();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Clear + paste
  await page.keyboard.press("Control+a");
  await new Promise((r) => setTimeout(r, 300));
  await page.keyboard.insertText(SQL);
  await new Promise((r) => setTimeout(r, 1000));

  console.log("⏳ กำลังรัน SQL... (รอ 10 วินาที)");
  await page.keyboard.press("Control+Enter");
  await new Promise((r) => setTimeout(r, 10000));

  console.log("✅ รัน SQL แล้ว");
  await page.screenshot({ path: "sql_transfer_result.png" });
  console.log("📸 ถ่ายรูปไว้ที่ sql_transfer_result.png");

  await browser.close();
})();
