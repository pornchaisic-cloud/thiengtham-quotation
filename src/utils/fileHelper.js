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

export async function saveFileToDevice(blob, fileName, showToast, setShowExportBtn) {
  const base64 = await blobToBase64(blob);
  try {
    await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents });
    showToast("💾 บันทึกไฟล์แล้ว");
    return true;
  } catch (e) {
    console.error("Directory.Documents failed:", e);
    try {
      await Filesystem.writeFile({ path: "Quotations/" + fileName, data: base64, directory: Directory.External, recursive: true });
      showToast("💾 บันทึกไฟล์สำเร็จ");
      if (setShowExportBtn) setShowExportBtn(true);
      return true;
    } catch (e2) {
      console.error("Directory.External also failed:", e2);
      showToast("❌ ไม่สามารถบันทึกไฟล์ได้", "danger");
      return false;
    }
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
