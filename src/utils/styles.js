export const inputStyle = {
  width: "100%", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #1e1e1e",
  borderRadius: 8, color: "#e8e8e8", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 0,
};

export const btnKey = {
  background: "#1a1a1a", border: "1px solid #333", color: "#c8a96e",
  borderRadius: 8, width: 40, height: 40, fontSize: 18, fontWeight: 700, cursor: "pointer"
};

export function btnSm(color, outline = false) {
  return {
    background: outline ? "transparent" : color + "22",
    border: `1px solid ${color}44`, color, borderRadius: 6,
    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  };
}

export function Label({ children }) {
  return <div style={{ fontSize: 11, color: "#555", marginBottom: 4, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}

export function SumRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa", marginBottom: 4 }}>
      <span>{label}</span><span style={{ color: "#ccc" }}>฿{value}</span>
    </div>
  );
}
