(async () => {
  if (!window.__captured || window.__captured.length === 0) {
    return JSON.stringify({ ok: false, reason: "no captured blob" });
  }
  const entry = window.__captured[window.__captured.length - 1];
  const blob = entry.blob;
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Convert to base64 in chunks
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binary);
  return JSON.stringify({ ok: true, type: blob.type, size: blob.size, b64Len: b64.length, b64 });
})()
