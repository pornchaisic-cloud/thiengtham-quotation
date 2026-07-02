import { chromium } from "playwright";

const PROJECT_REF = "tiehlmvwjvdlaoldtofu";
const BASE = `https://supabase.com/dashboard/project/${PROJECT_REF}`;

async function waitForLogin(page, timeoutSec = 120) {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    const url = page.url();
    if (!url.includes("login") && !url.includes("sign-in")) return true;
    console.log("⏳ รอ login...");
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

  // 1. Wait for login
  await page.goto(`${BASE}/sql/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  if (page.url().includes("login") || page.url().includes("sign-in")) {
    console.log("🔓 กรุณา login Supabase ใน Chrome ที่เปิดมา");
    const loggedIn = await waitForLogin(page);
    if (!loggedIn) { console.log("❌ ไม่ได้ login"); await browser.close(); process.exit(1); }
  }
  console.log("✅ Login สำเร็จ");

  // 2. รัน SQL ตรวจสอบตาราง
  console.log("\n=== ตรวจสอบตาราง ===");
  await page.goto(`${BASE}/sql/new`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));

  // พิมพ์ SQL
  const sql = `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`;
  await page.keyboard.press("Control+a");
  await page.keyboard.type(sql, { delay: 10 });
  await new Promise((r) => setTimeout(r, 500));

  // กด Ctrl+Enter เพื่อรัน
  await page.keyboard.press("Control+Enter");
  console.log("⏳ รอผลลัพธ์...");
  await new Promise((r) => setTimeout(r, 5000));

  // จับภาพหน้าจอเพื่อดูผล
  await page.screenshot({ path: "supabase_sql_result.png", fullPage: true });
  console.log("📸 เซฟ screenshot ไว้ที่ supabase_sql_result.png");

  // ลองอ่านข้อความผลลัพธ์
  const bodyText = await page.textContent("body");
  const lines = bodyText.split("\n").filter(l => l.includes("quotes") || l.includes("price_db") || l.includes("public"));
  if (lines.length > 0) {
    console.log("\n📋 พบบรรทัดที่เกี่ยวข้อง:");
    lines.forEach(l => console.log(`  ${l.trim()}`));
  }

  // 3. ตรวจสอบ RLS
  console.log("\n=== ตรวจสอบ RLS ===");
  const rlsSql = `SELECT schemaname, tablename, rowsecurity FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename IN ('quotes', 'price_db');`;
  await page.keyboard.press("Control+a");
  await page.keyboard.type(rlsSql, { delay: 10 });
  await new Promise((r) => setTimeout(r, 500));
  await page.keyboard.press("Control+Enter");
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: "supabase_rls_result.png", fullPage: true });
  console.log("📸 เซฟ screenshot ไว้ที่ supabase_rls_result.png");

  // 4. ตรวจสอบ Anonymous Auth
  console.log("\n=== ตรวจสอบ Anonymous Auth ===");
  await page.goto(`${BASE}/auth/providers`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: "supabase_auth_providers.png", fullPage: true });
  console.log("📸 เซฟ screenshot ไว้ที่ supabase_auth_providers.png");

  // อ่านสถานะจากหน้า
  const authText = await page.textContent("body");
  const anonStatus = authText.includes("Enabled") || authText.includes("enabled") || authText.includes("On") ? "✅ พบคำว่า enabled/on" : "⚠️ ไม่พบ — กรุณาตรวจสอบ screenshot";
  console.log(anonStatus);

  // 5. Table Editor
  console.log("\n=== เปิด Table Editor ===");
  await page.goto(`${BASE}/editor`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: "supabase_table_editor.png", fullPage: true });
  console.log("📸 เซฟ screenshot ไว้ที่ supabase_table_editor.png");

  // สรุป
  console.log("\n==========================================");
  console.log("📋 บันทึกหน้าจอพร้อมตรวจสอบ");
  console.log("==========================================");
  console.log("ดูไฟล์รูปภาพ:");
  console.log("  1. supabase_sql_result.png     → ดูตารางที่มี");
  console.log("  2. supabase_rls_result.png      → ตรวจสอบ RLS");
  console.log("  3. supabase_auth_providers.png   → ดูสถานะ Anonymous Auth");
  console.log("  4. supabase_table_editor.png     → ดูตารางใน Editor");
  console.log("==========================================");

  await browser.close();
  console.log("🎉 เสร็จสิ้น");
})();
