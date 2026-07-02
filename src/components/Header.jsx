export default function Header({ title, onBack, right }) {
  return (
    <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
      {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: "#c8a96e", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>←</button>}
      <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e8e8e8" }}>{title}</div>
      {right}
    </div>
  );
}
