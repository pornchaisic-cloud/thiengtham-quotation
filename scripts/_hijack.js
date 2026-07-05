(() => {
  window.__captured = window.__captured || [];
  window.__pendingExcel = null;
  window.__pendingPdf = null;

  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob) {
    const entry = { type: blob.type, size: blob.size, blob, ts: Date.now() };
    window.__captured.push(entry);
    return origCreate(blob);
  };

  return "Hijack ready, captured=" + window.__captured.length;
})()
