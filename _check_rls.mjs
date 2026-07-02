import { chromium } from "playwright";

const PROJECT_REF = "tiehlmvwjvdlaoldtofu";
const BASE = `https://supabase.com/dashboard/project/${PROJECT_REF}`;

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

  async function runSql(sql, label) {
    console.log(`\n-- ${label} --`);
    await page.keyboard.press("Control+a");
    await page.keyboard.type(sql, { delay: 3 });
    await new Promise((r) => setTimeout(r, 300));
    await page.keyboard.press("Control+Enter");
    await new Promise((r) => setTimeout(r, 5000));
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split("\n").filter(l => l.trim());
    console.log(lines.slice(2, 30).join("\n"));
  }

  await runSql(
    `SELECT tablename, rowsecurity FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename IN ('quotes', 'price_db');`,
    "RLS status"
  );

  await runSql(
    `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_catalog.pg_policies WHERE tablename IN ('quotes', 'price_db') ORDER BY tablename;`,
    "Policies"
  );

  console.log("\n\n✅ ตรวจสอบเสร็จ");
  await browser.close();
})();
