import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import Header from "./Header";
import { inputStyle, btnSm, Label } from "../utils/styles";
import { formatMoney } from "../utils/helpers";

export default function PriceDbScreen({ priceDb, setPriceDb, showToast, navTo }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", unit: "งาน", price: "" });
  const [importing, setImporting] = useState(false);
  const xlsxRef = useRef();

  const filtered = useMemo(() => priceDb.filter(p => !search || p.name.includes(search)), [priceDb, search]);

  async function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    e.target.value = "";
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const imported = [];
      let startRow = 0;
      if (rows.length > 0) {
        const firstPrice = rows[0][2];
        if (isNaN(Number(firstPrice)) || String(firstPrice).trim() === "") startRow = 1;
      }
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[0] ?? "").trim();
        const unit = String(row[1] ?? "งาน").trim() || "งาน";
        const price = Number(row[2]);
        if (name && !isNaN(price) && price > 0) {
          imported.push({ id: Date.now() + Math.random(), name, unit, price });
        }
      }
      if (imported.length === 0) {
        showToast("ไม่พบข้อมูล — คอลัมน์ต้องเป็น: ชื่องาน | หน่วย | ราคา", "danger");
      } else {
        setPriceDb(prev => {
          const existing = new Set(prev.map(p => p.name));
          const newOnes = imported.filter(p => !existing.has(p.name));
          showToast(`นำเข้า ${newOnes.length} รายการใหม่ (ข้าม ${imported.length - newOnes.length} ซ้ำ)`);
          return [...prev, ...newOnes];
        });
      }
    } catch (err) {
      showToast("อ่านไฟล์ไม่สำเร็จ: " + err.message, "danger");
    }
    setImporting(false);
  }

  function handleAdd() {
    if (!form.name || !form.price) { showToast("กรุณากรอกข้อมูลให้ครบ", "danger"); return; }
    setPriceDb(prev => [...prev, { id: Date.now(), ...form, price: Number(form.price) }]);
    setForm({ name: "", unit: "งาน", price: "" });
    setAdding(false);
    showToast("เพิ่มรายการราคาแล้ว");
  }

  function handleEdit(p) {
    setEditId(p.id);
    setForm({ name: p.name, unit: p.unit, price: String(p.price) });
  }

  function handleSaveEdit() {
    setPriceDb(prev => prev.map(p => p.id === editId ? { ...p, ...form, price: Number(form.price) } : p));
    setEditId(null);
    showToast("บันทึกการแก้ไขแล้ว");
  }

  function handleDelete(id) {
    setPriceDb(prev => prev.filter(p => p.id !== id));
    showToast("ลบรายการแล้ว", "danger");
  }

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Header title="ฐานข้อมูลราคา" onBack={() => navTo("home")}
        right={<button onClick={() => { setAdding(true); setEditId(null); setForm({ name: "", unit: "งาน", price: "" }); }} style={btnSm("#5af5a0")}>+ เพิ่ม</button>} />
      <div style={{ padding: "12px 16px" }}>
        <input style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหางาน..." />
        <input type="file" accept=".xlsx,.xls" ref={xlsxRef} onChange={handleExcelImport} style={{ display: "none" }} />
        <button onClick={() => xlsxRef.current.click()} disabled={importing}
          style={{ ...btnSm("#a06af5"), width: "100%", padding: "8px", marginBottom: 4, borderRadius: 8, fontSize: 12, opacity: importing ? 0.6 : 1 }}>
          {importing ? "⏳ กำลังนำเข้า..." : "📥 นำเข้าจาก Excel (.xlsx)"}
        </button>
        <div style={{ fontSize: 10, color: "#444", marginBottom: 12, textAlign: "center" }}>คอลัมน์ใน Excel: A=ชื่องาน  B=หน่วย  C=ราคา</div>

        {(adding || editId) && (
          <div style={{ background: "#111", border: "1px solid #2a2a1a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#c8a96e", marginBottom: 10 }}>{editId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}</div>
            <Label>ชื่องาน</Label>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่องาน" />
            <Label>หน่วย</Label>
            <input style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="งาน / ตร.ม. / ชุด" />
            <Label>ราคา (บาท)</Label>
            <input type="number" style={inputStyle} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={editId ? handleSaveEdit : handleAdd} style={{ flex: 1, padding: 10, background: "#c8a96e", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>บันทึก</button>
              <button onClick={() => { setAdding(false); setEditId(null); }} style={{ flex: 1, padding: 10, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#aaa", fontSize: 13, cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#444", marginBottom: 8 }}>{filtered.length} รายการ</div>
        {filtered.map(p => (
          <div key={p.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
            {editId === p.id ? null : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ fontSize: 13, color: "#ddd", marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#c8a96e", fontWeight: 600 }}>฿{formatMoney(p.price)} / {p.unit}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => handleEdit(p)} style={{ ...btnSm("#5ab4f5"), padding: "4px 10px", fontSize: 11 }}>แก้ไข</button>
                  <button onClick={() => handleDelete(p.id)} style={{ ...btnSm("#c8423a"), padding: "4px 10px", fontSize: 11 }}>ลบ</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
