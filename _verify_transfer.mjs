import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, ".env"), "utf-8");
const envVars = Object.fromEntries(
  envRaw.split("\n").filter(Boolean).map(l => {
    const [k, ...v] = l.split("=");
    return [k.trim(), v.join("=").trim()];
  })
);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

(async () => {
  console.log("=== ตรวจสอบว่า RPC transfer ใช้งานได้ ===");

  // 1. Sign in
  const { data: auth } = await supabase.auth.signInAnonymously();
  if (!auth?.user) { console.log("❌ Auth ล้มเหลว"); process.exit(1); }
  console.log(`✅ Auth: ${auth.user.id.slice(0, 8)}...`);

  // 2. ทดสอบ generate_transfer_code
  console.log("\n--- ทดสอบ generate_transfer_code ---");
  const { data: code, error: genErr } = await supabase.rpc("generate_transfer_code", {
    p_source_user_id: auth.user.id,
  });
  if (genErr) {
    console.log(`❌ RPC error: ${genErr.message}`);
    process.exit(1);
  }
  console.log(`✅ สร้างโค้ดได้: ${code}`);

  // 3. ทดสอบ transfer_data (ควร fail เพราะ no data to transfer but code is valid)
  console.log("\n--- ทดสอบ transfer_data ---");
  const { data: result, error: xferErr } = await supabase.rpc("transfer_data", {
    p_code: code,
    p_dest_user_id: auth.user.id,
  });
  if (xferErr) {
    if (xferErr.message.includes("TRANSFER_CODE_INVALID")) {
      console.log("❌ TRANSFER_CODE_INVALID — โค้ดไม่ถูกต้อง");
    } else {
      console.log(`❌ RPC error: ${xferErr.message}`);
    }
    process.exit(1);
  }
  console.log(`✅ transfer_data: ${result}`);

  // 4. Sign out
  await supabase.auth.signOut();
  console.log("\n✅ SQL ทั้งหมดใช้งานได้!");
})();
