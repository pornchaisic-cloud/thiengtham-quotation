// Test ExcelJS-based price DB import logic
// 1. Generate sample.xlsx with ExcelJS
// 2. Parse it back using the new handleExcelImport logic
// 3. Assert output matches expected rows

const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

async function generateSample() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ราคา");
  // Header (should be skipped — firstPrice is text)
  ws.addRow(["ชื่องาน", "หน่วย", "ราคา"]);
  // Data rows
  ws.addRow(["ทาสีผนัง", "ตร.ม.", 85]);
  ws.addRow(["ปูกระเบื้อง", "ตร.ม.", 450]);
  // Empty cells (test defval behavior)
  ws.addRow(["", "", ""]); // skip
  ws.addRow(["งานรื้อ", "งาน", 1200]);
  // Edge: price as string in cell
  ws.addRow(["ซ่อมผนัง", "ตร.ม.", "95"]);
  // Edge: name with trailing space
  ws.addRow(["  ติดตั้งประตู  ", "ชุด", 2500]);

  const buf = await wb.xlsx.writeBuffer();
  const out = path.join(__dirname, "test_price_sample.xlsx");
  fs.writeFileSync(out, Buffer.from(buf));
  return out;
}

// Mirror of new handleExcelImport parse logic
async function parsePriceXlsx(arrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "ไม่พบ sheet" };

  const maxCol = Math.max(sheet.actualColumnCount || 0, 3);
  const rows = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const rowData = new Array(maxCol).fill("");
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      rowData[c - 1] = (v === null || v === undefined) ? "" : v;
    }
    rows.push(rowData);
  });

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
      imported.push({ name, unit, price });
    }
  }
  return { rows, startRow, imported };
}

(async () => {
  const samplePath = await generateSample();
  console.log("✅ Generated sample:", samplePath);

  const arrayBuffer = fs.readFileSync(samplePath);
  const result = await parsePriceXlsx(arrayBuffer.buffer);

  console.log("\n📋 Parsed rows (first 3 cols):");
  result.rows.forEach((r, i) => console.log(`  Row ${i}: [${r[0]}, ${r[1]}, ${r[2]}]`));

  console.log(`\n🎯 startRow (skip header): ${result.startRow}`);
  console.log(`\n📦 Imported ${result.imported.length} items:`);
  result.imported.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} | ${p.unit} | ฿${p.price}`));

  // Assertions
  const expected = [
    { name: "ทาสีผนัง", unit: "ตร.ม.", price: 85 },
    { name: "ปูกระเบื้อง", unit: "ตร.ม.", price: 450 },
    { name: "งานรื้อ", unit: "งาน", price: 1200 },
    { name: "ซ่อมผนัง", unit: "ตร.ม.", price: 95 },
    { name: "ติดตั้งประตู", unit: "ชุด", price: 2500 }, // trim() works
  ];

  console.log("\n🔍 Assertions:");
  let pass = true;
  if (result.imported.length !== expected.length) {
    console.log(`  ❌ Count mismatch: got ${result.imported.length}, expected ${expected.length}`);
    pass = false;
  } else {
    console.log(`  ✅ Count: ${result.imported.length}`);
  }
  for (let i = 0; i < expected.length; i++) {
    const got = result.imported[i];
    const exp = expected[i];
    const ok = got && got.name === exp.name && got.unit === exp.unit && got.price === exp.price;
    console.log(`  ${ok ? "✅" : "❌"} [${i}] ${exp.name}: got {${got?.name}, ${got?.unit}, ${got?.price}}`);
    if (!ok) pass = false;
  }

  console.log(pass ? "\n🎉 ALL TESTS PASSED" : "\n💥 SOME TESTS FAILED");
  process.exit(pass ? 0 : 1);
})().catch(err => {
  console.error("💥 Error:", err);
  process.exit(1);
});