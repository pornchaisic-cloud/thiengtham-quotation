export default function ConnectionBanner({ online, pendingCount, syncState, onRetry }) {
  if (syncState === "error") {
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#5c1a1a", color: "#e8e8e8", padding: "6px 16px", fontSize: 12, textAlign: "center", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span>⚠️ ซิงค์ล้มเหลว</span>
        <button onClick={onRetry} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, color: "#fff", padding: "2px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔄 ลองใหม่</button>
      </div>
    );
  }
  if (online && pendingCount === 0) return null;
  const color = online ? "#1a3a5c" : "#5c3a1a";
  const icon = online ? "🔄" : "🟡";
  const text = online
    ? `ซิงค์ ${pendingCount} รายการ...`
    : `ออฟไลน์ — ทำงานปกติ จะซิงค์เมื่อเชื่อมต่อ`;
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 100, background: color, color: "#e8e8e8", padding: "6px 16px", fontSize: 12, textAlign: "center", fontWeight: 600 }}>
      {icon} {text}
    </div>
  );
}
