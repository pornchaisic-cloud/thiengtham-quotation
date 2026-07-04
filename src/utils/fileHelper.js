import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export function isNative() {
  return Capacitor.isNativePlatform();
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Save file to device with 3-tier fallback:
 *   1. Directory.Documents  → Android ≤ 12 with WRITE_EXTERNAL_STORAGE
 *   2. Directory.External   → Android ≤ 12 fallback (some devices)
 *   3. Directory.Cache + Share  → Android 13+ (scoped storage) — user saves via Share sheet
 *
 * Returns { saved: bool, shared: bool } — caller decides whether to show "เปิด" hint.
 */
export async function saveFileToDevice(blob, fileName, showToast, setShowExportBtn) {
  const base64 = await blobToBase64(blob);
  // ── Tier 1: Documents (Android ≤ 12 with permission) ──
  try {
    await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents });
    showToast("💾 บันทึกไฟล์แล้ว (Documents)");
    if (setShowExportBtn) setShowExportBtn(true);
    return { saved: true, shared: false };
  } catch (e) {
    console.warn("Directory.Documents failed:", e);
  }
  // ── Tier 2: External (Android ≤ 12 fallback) ──
  try {
    await Filesystem.writeFile({ path: "Quotations/" + fileName, data: base64, directory: Directory.External, recursive: true });
    showToast("💾 บันทึกไฟล์แล้ว (External)");
    if (setShowExportBtn) setShowExportBtn(true);
    return { saved: true, shared: false };
  } catch (e2) {
    console.warn("Directory.External failed:", e2);
  }
  // ── Tier 3: Cache + Share (Android 13+ scoped storage) ──
  try {
    const saved = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
    showToast("📤 กำลังเปิดให้เลือกแอปปลายทาง...");
    await Share.share({ title: fileName, url: saved.uri });
    return { saved: true, shared: true };
  } catch (e3) {
    console.error("All save tiers failed:", e3);
    showToast("❌ ไม่สามารถบันทึกไฟล์ได้", "danger");
    return { saved: false, shared: false };
  }
}

export async function shareFileNative(blob, fileName, showToast) {
  try {
    const base64 = await blobToBase64(blob);
    const savedFile = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
    await Share.share({ title: fileName, url: savedFile.uri });
    return true;
  } catch (e) {
    console.error("Share error:", e);
    showToast("❌ ไม่สามารถแชร์ไฟล์ได้: " + e.message, "danger");
    throw e;
  }
}