import { chromium } from "playwright";
import { execSync } from "child_process";
import fs from "fs";

const readyFile = "C:\\Users\\Succubuz\\AppData\\Local\\Temp\\token_ready.txt";

(async () => {
  console.log("🔗 กำลังเชื่อมต่อ Chrome...");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page = await browser.newPage();

  await page.goto("https://github.com/settings/personal-access-tokens", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));

  let url = page.url();
  if (url.includes("login")) {
    console.log("🔓 กรุณา login GitHub แล้วกด Enter ที่ PowerShell...");
    await new Promise((r) => process.stdin.once("data", r));
    await page.goto("https://github.com/settings/personal-access-tokens", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\n📝 ไปที่ Chrome แล้วตั้งค่า:");
  console.log("   1. คลิก token 'thiengtham-quotation'");
  console.log("   2. 'Repository access' → 'Only select repositories'");
  console.log("   3. เลือก 'pornchaisic-cloud/thiengtham-quotation'");
  console.log("   4. Apply → Save");
  console.log("\n⏳ เมื่อตั้งค่าเสร็จ พิมพ์ OK แล้ว Enter:\n");

  await new Promise((r) => process.stdin.once("data", r));

  console.log("\n✅ กำลัง push โค้ด...");

  const token = "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";
  execSync(`git remote set-url origin https://pornchaisic-cloud:${token}@github.com/pornchaisic-cloud/thiengtham-quotation.git`, { stdio: "pipe" });
  execSync("git push -u origin master", { stdio: "inherit" });

  console.log("✅ Push สำเร็จ!");
  await browser.close();
})();
