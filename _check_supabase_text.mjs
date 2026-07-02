import { chromium } from "playwright";

const PROJECT_REF = "tiehlmvwjvdlaoldtofu";
const BASE = `https://supabase.com/dashboard/project/${PROJECT_REF}`;

async function waitForLogin(page, timeoutSec = 120) {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    const url = page.url();
    if (!url.includes("login") && !url.includes("sign-in")) return true;
    await new Promise((r) => setTimeout(r, 3000));
    try { await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
  }
  return false;
}

(async () => {
  console.log("🔗 เชื่อมต่อ Chrome...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  // Login
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  if (page.url().includes("login") || page.url().includes("sign-in")) {
    console.log("🔓 กรุณา login ใน Chrome...");
    const loggedIn = await waitForLogin(page);
    if (!loggedIn) { console.log("❌ ไม่ได้ login"); await browser.close(); process.exit(1); }
  }
  console.log("✅ Login สำเร็จ");

  // 1. ตรวจสอบตารางด้วย SQL
  console.log("\n=== 1. ตรวจสอบตาราง ===");
  await page.goto(`${BASE}/sql/new`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));

  await page.keyboard.press("Control+a");
  await page.keyboard.type(`SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`, { delay: 5 });
  await new Promise((r) => setTimeout(r, 500));
  await page.keyboard.press("Control+Enter");
  await new Promise((r) => setTimeout(r, 6000));

  // ดึงข้อความจากหน้า
  const sqlResult = await page.evaluate(() => document.body.innerText);
  const tableLines = sqlResult.split("\n").filter(l => l.toLowerCase().includes("table") || l.toLowerCase().includes("quotes") || l.toLowerCase().includes("price_db"));
  console.log("📋 ผลลัพธ์ตาราง:");
  tableLines.forEach(l => console.log(`   ${l.trim()}`));
  if (tableLines.length === 0) console.log("   (ไม่พบข้อมูลตารางในข้อความที่ดึงมา — ดู screenshot แทน)");

  // 2. RLS
  console.log("\n=== 2. ตรวจสอบ RLS ===");
  await page.keyboard.press("Control+a");
  await page.keyboard.type(`SELECT tablename, rowsecurity FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename IN ('quotes', 'price_db');`, { delay: 5 });
  await new Promise((r) => setTimeout(r, 500));
  await page.keyboard.press("Control+Enter");
  await new Promise((r) => setTimeout(r, 6000));

  const rlsResult = await page.evaluate(() => document.body.innerText);
  const rlsLines = rlsResult.split("\n").filter(l => l.toLowerCase().includes("quotes") || l.toLowerCase().includes("price_db") || l.toLowerCase().includes("rowsecurity"));
  console.log("📋 ผลลัพธ์ RLS:");
  rlsLines.forEach(l => console.log(`   ${l.trim()}`));
  if (rlsLines.length === 0) console.log("   (ไม่พบ — ดู screenshot แทน)");

  // 3. Auth Providers
  console.log("\n=== 3. สถานะ Anonymous Auth ===");
  await page.goto(`${BASE}/auth/providers`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));
  const authText = await page.evaluate(() => document.body.innerText);
  const anonLines = authText.split("\n").filter(l => l.toLowerCase().includes("anonymous") || l.toLowerCase().includes("enable") || l.toLowerCase().includes("enabled"));
  console.log("📋 ข้อความเกี่ยวกับ Auth:");
  anonLines.forEach(l => console.log(`   ${l.trim()}`));

  // 4. Table Editor — ดึงรายชื่อตาราง
  console.log("\n=== 4. ตารางใน Table Editor ===");
  await page.goto(`${BASE}/editor`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));
  const editorText = await page.evaluate(() => document.body.innerText);
  const editorLines = editorText.split("\n").filter(l => l.toLowerCase().includes("quotes") || l.toLowerCase().includes("price_db") || l.toLowerCase().includes("table"));
  console.log("📋 ข้อความใน Table Editor:");
  editorLines.slice(0, 20).forEach(l => console.log(`   ${l.trim()}`));

  await browser.close();
  console.log("\n🎉 เสร็จสิ้น");
})();
