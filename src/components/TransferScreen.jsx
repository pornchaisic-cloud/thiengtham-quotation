import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import * as sync from "../lib/sync";
import Header from "./Header";
import { inputStyle } from "../utils/styles";

export default function TransferScreen({ navTo, showToast, quotes, setQuotes, priceDbMeta, setPriceDbMeta }) {
  const [tab, setTab] = useState("send");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [inputCode, setInputCode] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      if (Date.now() > expiresAt.getTime()) {
        setGeneratedCode("");
        setExpiresAt(null);
        showToast("โค้ดหมดอายุแล้ว — กรุณาสร้างใหม่", "danger");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, showToast]);

  async function handleGenerate() {
    setLoading(true);
    setGeneratedCode("");
    setExpiresAt(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ยังไม่ได้ login");
      const { data: newCode, error } = await supabase.rpc("generate_transfer_code", { p_source_user_id: user.id });
      if (error) throw error;
      setGeneratedCode(newCode);
      setExpiresAt(new Date(Date.now() + 15 * 60 * 1000));
    } catch (e) {
      showToast("สร้างโค้ดไม่สำเร็จ: " + e.message, "danger");
    }
    setLoading(false);
  }

  async function handleReceive() {
    const c = inputCode.trim().toUpperCase();
    if (!c || c.length !== 6) { showToast("กรุณากรอกโค้ด 6 หลัก", "danger"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ยังไม่ได้ login");
      const { data: ok, error } = await supabase.rpc("transfer_data", { p_code: c, p_dest_user_id: user.id });
      if (error) throw error;
      setResult("success");
      showToast("✅ ย้ายข้อมูลสำเร็จ กำลังโหลดข้อมูล...", "success");
      const cloud = await sync.pullAll();
      if (cloud.quotes?.length > 0) {
        setQuotes(prev => {
          const map = new Map(prev.map(q => [q.id, q]));
          let changed = false;
          for (const cq of cloud.quotes) {
            const local = map.get(cq.id);
            if (!local || (cq._updatedAt || '') > (local.updatedAt || '')) {
              map.set(cq.id, cq);
              changed = true;
            }
          }
          return changed ? [...map.values()] : prev;
        });
      }
      if (cloud.priceDb) {
        setPriceDbMeta(prev => {
          const ct = cloud.priceDb._updatedAt || '';
          if (ct > (prev.updatedAt || '')) return { updatedAt: ct, data: cloud.priceDb.data };
          return prev;
        });
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("TRANSFER_CODE_INVALID")) showToast("❌ โค้ดไม่ถูกต้องหรือหมดอายุแล้ว", "danger");
      else showToast("❌ รับข้อมูลไม่สำเร็จ: " + msg, "danger");
      setResult("error");
    }
    setLoading(false);
  }

  const expiresSeconds = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0;
  const SCREENS = { HOME: "home", TRANSFER: "transfer" };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header title="ย้ายข้อมูลไปเครื่องใหม่" onBack={() => navTo(SCREENS.HOME)} />
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", background: "#0d0d0d", marginBottom: 16 }}>
          {[["send", "ส่งข้อมูล"], ["receive", "รับข้อมูล"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "12px 0", background: "none", border: "none",
              color: tab === k ? "#c8a96e" : "#555", fontSize: 13, fontWeight: tab === k ? 600 : 400,
              borderBottom: tab === k ? "2px solid #c8a96e" : "2px solid transparent", cursor: "pointer"
            }}>{l}</button>
          ))}
        </div>

        {tab === "send" ? (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
              สร้างโค้ด 6 หลักเพื่อย้ายข้อมูลไปเครื่องใหม่<br />
              <span style={{ fontSize: 12, color: "#555" }}>โค้ดหมดอายุใน 15 นาที</span>
            </div>
            {!generatedCode ? (
              <button onClick={handleGenerate} disabled={loading}
                style={{ padding: "14px 32px", background: loading ? "#222" : "#c8a96e", border: "none", borderRadius: 10, color: loading ? "#666" : "#000", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "⏳ กำลังสร้าง..." : "🔑 สร้างโค้ด"}
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 48, fontWeight: 700, color: "#c8a96e", letterSpacing: 8, fontFamily: "monospace", marginBottom: 8 }}>
                  {generatedCode}
                </div>
                <div style={{ fontSize: 13, color: expiresSeconds < 60 ? "#f55a5a" : "#888" }}>
                  ⏱ หมดอายุใน {Math.floor(expiresSeconds / 60)}:{String(expiresSeconds % 60).padStart(2, "0")} น.
                </div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 16, lineHeight: 1.6, background: "#0d0d0d", padding: 12, borderRadius: 8 }}>
                  ใส่โค้ดนี้ในเครื่องใหม่ → "รับข้อมูล"
                </div>
                <button onClick={handleGenerate} style={{ marginTop: 12, padding: "8px 20px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 12, cursor: "pointer" }}>
                  🔄 สร้างใหม่
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
              ใส่โค้ด 6 หลักจากเครื่องเก่าเพื่อรับข้อมูล
            </div>
            <input value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="เช่น A1B2C3"
              style={{ ...inputStyle, textAlign: "center", fontSize: 24, fontFamily: "monospace", letterSpacing: 6, textTransform: "uppercase" }}
              maxLength={6} />
            <button onClick={handleReceive} disabled={loading || inputCode.length !== 6}
              style={{ width: "100%", padding: 14, background: loading ? "#222" : "#c8a96e", border: "none", borderRadius: 10, color: loading ? "#666" : "#000", fontWeight: 700, fontSize: 15, cursor: (loading || inputCode.length !== 6) ? "not-allowed" : "pointer", marginTop: 16 }}>
              {loading ? "⏳ กำลังรับข้อมูล..." : "📥 รับข้อมูล"}
            </button>
            {result === "success" && (
              <div style={{ marginTop: 12, textAlign: "center", color: "#5af5a0", fontSize: 14, fontWeight: 600 }}>
                ✅ ย้ายข้อมูลสำเร็จ!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
