import { chromium } from "playwright";
import { execSync } from "child_process";

(async () => {
  console.log("🔗 เชื่อมต่อ Chrome...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = await browser.newPage();

  console.log("📂 ไปที่ Supabase...");
  await page.goto("https://supabase.com/dashboard/projects", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  let url = page.url();
  if (url.includes("login") || url.includes("sign-in")) {
    console.log("🔓 ยังไม่ได้ login — กรุณา login ที่ Chrome แล้วกด Enter ที่นี่...");
    await new Promise((r) => process.stdin.once("data", r));
    await page.goto("https://supabase.com/dashboard/projects", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("📂 ไปหน้า New project...");
  await page.goto("https://supabase.com/dashboard/projects/new", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 4000));

  // รอ form
  const nameInput = page.locator("input#name, input[name='name'], input[placeholder*='project']").first();
  if (await nameInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    await nameInput.fill("thiengtham-quotations");
    console.log("✅ กรอกชื่อ project");
  }

  const dbPass = page.locator("input#db_pass, input[name='db_pass']");
  if (await dbPass.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dbPass.fill("Thiengtham2024!");
    console.log("✅ กรอกรหัส DB");
  }

  const regionBtn = page.locator("button:has-text('Region')").first();
  if (await regionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await regionBtn.click();
    await new Promise((r) => setTimeout(r, 1000));
    const sea = page.locator("[role='option']:has-text('Southeast Asia')").first();
    if (await sea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sea.click();
      console.log("✅ เลือก Region: Southeast Asia");
    }
  }

  const createBtn = page.locator("button:has-text('Create project')").first();
  if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createBtn.click();
    console.log("⏳ กำลังสร้าง project... (ใช้เวลา 2-5 นาที)");
    console.log("   รอหน้า dashboard โหลด...");
    await new Promise((r) => setTimeout(r, 5000));
  } else {
    console.log("⚠️ ไม่เจอปุ่ม Create — project อาจมีอยู่แล้ว");
  }

  console.log("\n📌 Project: thiengtham-quotations");
  console.log("   DB Password: Thiengtham2024!");
  console.log("   Region: Southeast Asia (asia-southeast1)");
  console.log("   Plan: Free\n");

  console.log("⏳ กด Enter เมื่อ project สร้างเสร็จ (หรือจะตั้งค่าเองต่อ)...");
  await new Promise((r) => process.stdin.once("data", r));

  await page.close();
  await browser.close();
  console.log("✅ เสร็จ!");
})();
