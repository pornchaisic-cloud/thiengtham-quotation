import { chromium } from "playwright";

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  await page.goto("https://supabase.com/dashboard/projects", { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2000));

  if (page.url().includes("login") || page.url().includes("sign-in")) {
    console.log("🔓 รอ login...");
    while (page.url().includes("login") || page.url().includes("sign-in")) {
      await new Promise((r) => setTimeout(r, 3000));
      try { await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
    }
  }

  // เปิด tab ใหม่ไปที่ localhost
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => console.log("⚠️ Dev server อาจไม่ได้เปิด"));
  await new Promise((r) => setTimeout(r, 2000));

  const keys = await page.evaluate(() => {
    const result = {};
    try {
      const gemini = JSON.parse(localStorage.getItem("tt_api_keys") || "[]");
      result.gemini = gemini.length > 0 ? gemini.map((k, i) => `${i+1}: ${k.slice(0, 12)}...`) : ["(ไม่มี)"];
    } catch { result.gemini = ["(error)"]; }
    try {
      const openrouter = JSON.parse(localStorage.getItem("tt_openrouter_keys") || "[]");
      result.openrouter = openrouter.length > 0 ? openrouter.map((k, i) => `${i+1}: ${k.slice(0, 12)}...`) : ["(ไม่มี)"];
    } catch { result.openrouter = ["(error)"]; }
    try {
      const anthropic = JSON.parse(localStorage.getItem("tt_anthropic_keys") || "[]");
      result.anthropic = anthropic.length > 0 ? anthropic.map((k, i) => `${i+1}: ${k.slice(0, 12)}...`) : ["(ไม่มี)"];
    } catch { result.anthropic = ["(error)"]; }
    result.provider = localStorage.getItem("tt_api_provider") || "(ไม่ได้ตั้ง)";
    return result;
  });

  console.log("\n=== API Keys ที่มีในเครื่อง ===");
  console.log(`🔵 Gemini Keys (${keys.gemini.length}):`);
  keys.gemini.forEach(k => console.log(`   ${k}`));
  console.log(`\n⚡ OpenRouter Keys (${keys.openrouter.length}):`);
  keys.openrouter.forEach(k => console.log(`   ${k}`));
  console.log(`\n🟠 Anthropic Keys (${keys.anthropic.length}):`);
  keys.anthropic.forEach(k => console.log(`   ${k}`));
  console.log(`\n⚙️ Provider ล่าสุดที่ใช้: ${keys.provider}`);

  await browser.close();
})();
