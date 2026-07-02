import { useState } from "react";

const inputStyle = {
  width: "100%", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #1e1e1e",
  borderRadius: 8, color: "#e8e8e8", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 0,
};

export default function KeySection({ color, title, hint, placeholder, storageKey, showToast }) {
  const [keys, setKeys] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; } });
  const [newKey, setNewKey] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [showIdx, setShowIdx] = useState(null);
  const [testStatus, setTestStatus] = useState({});

  function save(updated) {
    setKeys(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  function addKey() {
    const k = newKey.trim();
    if (!k) return;
    if (keys.includes(k)) { showToast("Key นี้มีอยู่แล้ว", "danger"); return; }
    save([k, ...keys]);
    setNewKey("");
    showToast("✅ เพิ่ม Key แล้ว");
  }

  function deleteKey(i) {
    save(keys.filter((_, idx) => idx !== i));
    showToast("🗑️ ลบ Key แล้ว", "danger");
  }

  function startEdit(i) { setEditIdx(i); setEditVal(keys[i]); }

  function saveEdit() {
    const k = editVal.trim();
    if (!k) return;
    const updated = [...keys]; updated[editIdx] = k;
    save(updated);
    setEditIdx(null);
    showToast("✏️ แก้ไข Key แล้ว");
  }

  async function testKey(k, i) {
    setTestStatus(s => ({ ...s, [i]: "testing" }));
    try {
      let ok = false;
      let errMsg = "";
      if (storageKey === "tt_openrouter_keys" || k.startsWith("sk-or-")) {
        const orModels = ["google/gemini-2.5-flash", "google/gemini-2.0-flash", "google/gemini-2.0-flash-lite:free", "google/gemini-2.0-flash:free", "meta-llama/llama-3.1-8b-instruct:free"];
        for (const m of orModels) {
          try {
            const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${k}`, "HTTP-Referer": "https://thiengtham.app", "X-Title": "TheingTham" },
              body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "hi" }] })
            });
            if (r.ok) { ok = true; break; }
            const errData = await r.json().catch(() => ({}));
            errMsg = errData.error?.message || `HTTP ${r.status}`;
            if (r.status === 401 || r.status === 403) break;
          } catch (e) { errMsg = e.message; }
        }
      } else if (storageKey === "tt_anthropic_keys" || k.startsWith("sk-ant-")) {
        const models = ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"];
        for (const m of models) {
          try {
            const r = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
              body: JSON.stringify({ model: m, max_tokens: 5, messages: [{ role: "user", content: "hi" }] })
            });
            if (r.ok) { ok = true; break; }
            const errData = await r.json().catch(() => ({}));
            errMsg = errData.error?.message || `HTTP ${r.status}`;
            if (r.status === 401 || r.status === 403) break;
          } catch (e) { errMsg = e.message; }
        }
      } else if (storageKey === "tt_api_keys" || k.startsWith("AIzaSy")) {
        const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
        for (const m of geminiModels) {
          try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 5 } })
            });
            if (r.ok) { ok = true; break; }
            const errData = await r.json().catch(() => ({}));
            const serverMsg = errData.error?.message || `HTTP ${r.status}`;
            if (!errMsg) errMsg = serverMsg;
            if (r.status === 429 || r.status === 401 || r.status === 403 || serverMsg.includes("key not valid") || serverMsg.includes("API key")) break;
          } catch (e) { if (!errMsg) errMsg = e.message; }
        }
      } else { errMsg = "รูปแบบคีย์ไม่ถูกต้อง"; }
      setTestStatus(s => ({ ...s, [i]: ok ? "ok" : `fail: ${errMsg}` }));
    } catch (err) { setTestStatus(s => ({ ...s, [i]: `fail: ${err.message}` })); }
    setTimeout(() => setTestStatus(s => { const n = { ...s }; delete n[i]; return n; }), 10000);
  }

  const bgColor = color + "11";
  const borderColor = color + "44";

  return (
    <div style={{ marginBottom: 18, borderRadius: 10, border: `1px solid ${borderColor}`, padding: 12, background: bgColor }}>
      <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>{hint} | user {keys.length} keys</div>
      <div style={{ display: "flex", gap: 6, marginBottom: keys.length > 0 ? 10 : 0 }}>
        <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={placeholder}
          style={{ ...inputStyle, flex: 1, fontSize: 11, fontFamily: "monospace", marginBottom: 0 }} />
        <button onClick={addKey} style={{ padding: "8px 12px", background: "#0d0d0d", border: `1px solid ${color}`, borderRadius: 8, color, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>➕ เพิ่ม</button>
      </div>
      {keys.map((k, i) => (
        <div key={i} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
          {editIdx === i ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={editVal} onChange={e => setEditVal(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 11, fontFamily: "monospace", marginBottom: 0 }} />
              <button onClick={saveEdit} style={{ padding: "6px 10px", background: "#1a2e0a", border: `1px solid ${color}`, borderRadius: 6, color, fontSize: 11, cursor: "pointer" }}>💾</button>
              <button onClick={() => setEditIdx(null)} style={{ padding: "6px 10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#666", fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>Key {i + 1}</div>
                  {testStatus[i]?.startsWith("fail") && (
                    <div style={{ fontSize: 9, color: "#f55a5a", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={testStatus[i].replace("fail: ", "")}>
                      ⚠️ {testStatus[i].replace("fail: ", "")}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {showIdx === i ? k : k.slice(0, 10) + "..." + k.slice(-4)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setShowIdx(showIdx === i ? null : i)} title="ดู Key" style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: "2px 4px" }}>{showIdx === i ? "🙈" : "👁️"}</button>
                <button onClick={() => testKey(k, i)} title="ทดสอบ Key" style={{ background: "none", border: "none", fontSize: 13, cursor: "pointer", padding: "2px 4px" }}>{testStatus[i] === "testing" ? "⏳" : testStatus[i] === "ok" ? "✅" : testStatus[i]?.startsWith("fail") ? "❌" : "🔍"}</button>
                <button onClick={() => startEdit(i)} title="แก้ไข Key" style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: "2px 4px" }}>✏️</button>
                <button onClick={() => deleteKey(i)} title="ลบ Key" style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: "2px 4px" }}>🗑️</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {keys.length > 1 && (
        <button onClick={() => { save([]); showToast("ล้าง keys ทั้งหมดแล้ว", "danger"); }} style={{ background: "none", border: "none", color: "#c8423a", fontSize: 11, cursor: "pointer", marginTop: 2 }}>🗑️ ล้างทั้งหมด</button>
      )}
    </div>
  );
}
