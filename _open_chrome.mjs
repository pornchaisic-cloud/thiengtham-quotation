import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const debugDir = path.join(os.tmpdir(), "chrome_debug_thiengtham");
try { require("child_process").execSync("taskkill /F /IM chrome.exe 2>nul", { stdio: "ignore" }); } catch {}

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
];
const chromePath = chromePaths.find((p) => fs.existsSync(p));
if (!chromePath) { console.error("ไม่พบ Chrome"); process.exit(1); }

console.log("🚀 กำลังเปิด Chrome...");
console.log("URLs: https://github.com/new");
console.log("      https://supabase.com/dashboard/projects/new\n");
console.log("กด Ctrl+C เพื่อปิด Chrome\n");

spawn(chromePath, [
  `--remote-debugging-port=9222`,
  `--user-data-dir=${debugDir}`,
  "--no-first-run", "--no-default-browser-check",
  "https://github.com/new",
  "https://supabase.com/dashboard/projects/new",
], { detached: true, stdio: "ignore" });

process.stdin.resume();
