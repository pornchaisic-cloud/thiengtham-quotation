import { chromium } from "playwright";
import { execSync, spawn } from "child_process";
import readline from "readline";
import path from "path";
import fs from "fs";
import os from "os";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function ensureChromeDebug() {
  const debugDir = path.join(os.tmpdir(), "chrome_debug_thiengtham");
  try { execSync("taskkill /F /IM chrome.exe 2>nul", { stdio: "ignore" }); } catch {}
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
  ];
  const chromePath = chromePaths.find((p) => fs.existsSync(p));
  if (!chromePath) throw new Error("ไม่พบ Chrome");
  spawn(chromePath, [
    `--remote-debugging-port=9222`,
    `--user-data-dir=${debugDir}`,
    "--no-first-run", "--no-default-browser-check",
  ], { detached: true, stdio: "ignore" });
}

async function createGithubRepo(browser) {
  console.log("\n=== GitHub: สร้าง repository ===\n");
  const page = await browser.newPage();

  await page.goto("https://github.com/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  let url = page.url();
  console.log(`URL: ${url}`);

  if (url.includes("login") || url.includes("signin")) {
    console.log("🔓 กรุณา login GitHub บน Chrome แล้วกด Enter...");
    await ask("");
    await page.goto("https://github.com/new", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("📝 กรุณากรอกข้อมูลใน browser แล้วกด Create repository");
  console.log("   - ชื่อ repo: thiengtham-quotation");
  console.log("   - visibility: Private");
  console.log("   - ไม่ต้องเพิ่ม README/.gitignore\n");
  console.log("⏳ รอให้คุณกด Create repository เสร็จ...");
  console.log("   กด Enter ที่นี่เมื่อสร้าง repo เสร็จแล้ว\n");
  await ask("");

  console.log("✅ GitHub repo created\n");
  await page.close();
}

async function createSupabaseProject(browser) {
  console.log("\n=== Supabase: สร้าง project ===\n");
  const page = await browser.newPage();

  await page.goto("https://supabase.com/dashboard/projects", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  let url = page.url();
  if (url.includes("login") || url.includes("sign-in")) {
    console.log("🔓 กรุณา login Supabase บน Chrome แล้วกด Enter...");
    await ask("");
    await page.goto("https://supabase.com/dashboard/projects", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
  }

  await page.goto("https://supabase.com/dashboard/projects/new", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));

  console.log("📝 กรุณากรอกข้อมูลใน browser:");
  console.log("   - Name: thiengtham-quotations");
  console.log("   - Database Password: Thiengtham2024!");
  console.log("   - Region: Southeast Asia");
  console.log("   - Pricing Plan: Free\n");
  console.log("⏳ กด 'Create new project' แล้วรอจนสร้างเสร็จ");
  console.log("   กด Enter ที่นี่เมื่อสร้างเสร็จ\n");
  await ask("");

  console.log("✅ Supabase project created\n");
  await page.close();
}

function gitPush() {
  console.log("\n=== Push โค้ดไป GitHub ===\n");
  execSync("git remote remove origin 2>nul", { stdio: "ignore" });
  execSync("git remote add origin https://github.com/pornchai.sic/thiengtham-quotation.git", { encoding: "utf8" });
  console.log("✅ remote origin added");
  try {
    execSync("git push -u origin main", { encoding: "utf8", stdio: "inherit" });
    console.log("✅ Push สำเร็จ!");
  } catch (e) {
    console.log("⚠️ Push failed: " + e.message.split("\n")[0]);
  }
  console.log("🔗 https://github.com/pornchai.sic/thiengtham-quotation");
}

(async () => {
  console.log("🚀 Playwright Deploy Script\n");
  console.log("1. GitHub: thiengtham-quotation (private)");
  console.log("2. Supabase: thiengtham-quotations");
  console.log("3. Push โค้ด\n");

  console.log("⏳ กำลังเปิด Chrome (remote debugging)...");
  ensureChromeDebug();
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0] || await browser.newContext();

  try {
    await createGithubRepo(context);
    const ans = await ask("สร้าง Supabase project ต่อ? (y/n): ");
    if (ans.toLowerCase() === "y") await createSupabaseProject(context);
    const ans2 = await ask("Push โค้ดไป GitHub? (y/n): ");
    if (ans2.toLowerCase() === "y") gitPush();
  } catch (err) {
    console.error("❌ Error:", err.message);
  }

  await browser.close();
  rl.close();
  console.log("\n🎉 เสร็จสิ้น!");
})();
