import ExcelJS from "exceljs";
import path from "path";

const refPath = process.argv[2];
if (!refPath) {
  console.error("Usage: node inspect_xlsx.mjs <path-to-xlsx>");
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(refPath);
console.log("=== WORKBOOK ===");
console.log("Sheets:", wb.worksheets.map(s => s.name));

for (const ws of wb.worksheets) {
  console.log(`\n=== SHEET: ${ws.name} ===`);
  console.log(`Dimensions: ${ws.dimensions ? JSON.stringify(ws.dimensions) : "(empty)"}`);
  console.log(`Row count: ${ws.rowCount}, Col count: ${ws.columnCount}`);
  console.log("\n--- Column widths ---");
  for (let c = 1; c <= ws.columnCount; c++) {
    const col = ws.getColumn(c);
    if (col.width) console.log(`  Col ${c} (${col.letter}): width=${col.width}`);
  }
  console.log("\n--- Merged ranges ---");
  if (ws.model && ws.model.merges) {
    ws.model.merges.forEach(m => console.log(`  ${m}`));
  }

  console.log("\n--- All cells with content ---");
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let rowHasContent = false;
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      if (cell.value !== null && cell.value !== undefined && cell.value !== "") {
        if (!rowHasContent) {
          console.log(`\n  Row ${r}:`);
          rowHasContent = true;
        }
        const v = typeof cell.value === "object" ? JSON.stringify(cell.value) : String(cell.value);
        const short = v.length > 80 ? v.substring(0, 77) + "..." : v;
        console.log(`    ${cell.address}: "${short.replace(/\n/g, "\\n")}"`);
      }
    }
  }
}