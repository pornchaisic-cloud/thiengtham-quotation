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

  console.log("📂 ไปที่ project dashboard...");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  // รอ login ถ้ายังไม่เข้า
  if (page.url().includes("login") || page.url().includes("sign-in")) {
    console.log("🔓 กรุณา login Supabase ใน Chrome ที่เปิดมา");
    console.log("   ระบบจะรอสูงสุด 120 วินาที...");
    const loggedIn = await waitForLogin(page);
    if (!loggedIn) {
      console.log("❌ ยังไม่ login — เปิดหน้า login ไว้ให้แล้ว");
      console.log(`   ไปที่ ${BASE} แล้ว login เอง`);
      await browser.close();
      process.exit(1);
    }
  }
  console.log("✅ Login สำเร็จ");

  // ===== 1. เปิด Anonymous Auth =====
  console.log("\n=== 1. เปิด Anonymous Auth ===");
  await page.goto(`${BASE}/auth/providers`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 4000));

  try {
    const anonSection = page.locator("button:has-text('Anonymous')").first();
    if (await anonSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await anonSection.click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    const alreadyOn = await page.locator("[role='switch'][aria-checked='true']").first().isVisible({ timeout: 2000 }).catch(() => false);
    if (alreadyOn) {
      console.log("✅ Anonymous Auth เปิดอยู่แล้ว");
    } else {
      const toggle = page.locator("[role='switch'], .toggle, button:has-text('Enable')").first();
      if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggle.click();
        await new Promise((r) => setTimeout(r, 1000));
        const save = page.locator("button:has-text('Save')").first();
        if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
          await save.click();
          console.log("✅ Anonymous Auth เปิดแล้ว");
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  } catch (e) {
    console.log("⚠️ เปิด Anonymous Auth ไม่ได้ — เปิดลิงก์นี้ใน Chrome แล้วทำเอง:");
    console.log(`   ${BASE}/auth/providers → Anonymous → Enable → Save`);
  }

  // ===== 2. ตรวจสอบตารางด้วย SQL =====
  console.log("\n=== 2. ตรวจสอบตาราง ===");
  await page.goto(`${BASE}/sql/new`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 4000));

  const sqlCheck = `select table_name from information_schema.tables where table_schema = 'public' and table_name in ('quotes', 'price_db');`;

  try {
    const editor = page.locator(".cm-editor, .monaco-editor, textarea, [contenteditable='true']").first();
    if (await editor.isVisible({ timeout: 8000 }).catch(() => false)) {
      await editor.click();
      await new Promise((r) => setTimeout(r, 500));
      await editor.fill("");
      await page.keyboard.type(sqlCheck, { delay: 5 });
      await new Promise((r) => setTimeout(r, 500));

      const runBtn = page.locator("button:has-text('Run'), button:has-text('▶')").first();
      if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runBtn.click();
        console.log("⏳ รัน SQL ตรวจสอบ...");
        await new Promise((r) => setTimeout(r, 4000));

        // อ่านผลลัพธ์
        const resultText = await page.locator(".cm-line, .view-line, .result, td, .grid").first().textContent({ timeout: 5000 }).catch(() => "");
        if (resultText.includes("quotes") && resultText.includes("price_db")) {
          console.log("✅ มีตาราง quotes + price_db ครบ");
        } else {
          console.log("⚠️ ไม่พบตาราง — อาจต้องรัน SQL จาก sql_setup.sql");
          console.log(`   เปิด ${BASE}/sql/new แล้ววาง SQL จาก sql_setup.sql`);
        }
      }
    }
  } catch (e) {
    console.log("⚠️ ตรวจสอบอัตโนมัติไม่ได้ — เปิด Table Editor ดูเอง:");
    console.log(`   ${BASE}/editor`);
  }

  // ===== 3. เปิด Table Editor =====
  console.log("\n=== 3. เปิด Table Editor ===");
  await page.goto(`${BASE}/editor`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));
  console.log("✅ เปิด Table Editor แล้ว — ตรวจสอบว่าเห็น quotes + price_db");

  console.log("\n====================================");
  console.log("📋 สรุปลิงก์");
  console.log("====================================");
  console.log(`🔗 Project: ${BASE}`);
  console.log(`🔗 Auth: ${BASE}/auth/providers`);
  console.log(`🔗 SQL: ${BASE}/sql/new`);
  console.log(`🔗 Table Editor: ${BASE}/editor`);
  console.log("====================================");

  await page.close();
  await browser.close();
  console.log("🎉 เสร็จสิ้น");
})();
