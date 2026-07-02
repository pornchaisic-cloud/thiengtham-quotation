export default function Toast({ msg, type }) {
  const colors = { success: "#1a5c2e", danger: "#5c1a1a", info: "#1a3a5c" };
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: colors[type] || colors.success, color: "#fff", padding: "10px 20px", borderRadius: 20, zIndex: 9999, fontSize: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
}
