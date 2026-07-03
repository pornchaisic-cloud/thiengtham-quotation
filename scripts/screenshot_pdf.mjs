import { chromium } from "playwright";
import path from "path";

const pdfPath = process.argv[2];
const outPath = process.argv[3] || "screenshot.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
const page = await ctx.newPage();

await page.goto("file:///" + path.resolve(pdfPath).replace(/\\/g, "/"));
await page.waitForTimeout(3000);
await page.screenshot({ path: outPath, fullPage: true });

await browser.close();
console.log(`Screenshot: ${outPath}`);