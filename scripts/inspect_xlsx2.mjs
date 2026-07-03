import ExcelJS from "exceljs";

const refPath = process.argv[2];
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(refPath);

const ws = wb.worksheets[0];
console.log(`Sheet: ${ws.name}, rows=${ws.rowCount}, cols=${ws.columnCount}`);

// Get merged ranges
const merges = (ws.model && ws.model.merges) || [];
const mergedMap = new Map(); // top-left -> range
for (const m of merges) {
  const [start, end] = m.split(":");
  mergedMap.set(start, { start, end });
}

// For each cell with value, show ONLY the top-left of its merged range
console.log("\n=== UNIQUE CELLS (deduped by merge) ===\n");
for (let r = 1; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  let line = `R${String(r).padStart(2, " ")}: `;
  const cells = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const cell = row.getCell(c);
    const addr = cell.address;
    const val = cell.value;

    // Skip if this cell is part of a merge but not the top-left
    if (mergedMap.has(addr) === false) {
      // check if this address is the start of any merge
      let isMerged = false;
      for (const [start, range] of mergedMap) {
        if (start === addr) { isMerged = true; break; }
      }
      if (!isMerged) continue;
    }

    if (val === null || val === undefined || val === "") continue;

    let v;
    if (typeof val === "object" && val.formula) {
      v = `${val.formula}=${val.result}`;
    } else if (typeof val === "object") {
      v = JSON.stringify(val);
    } else {
      v = String(val);
    }
    if (v.length > 50) v = v.substring(0, 47) + "...";

    const mergeInfo = mergedMap.get(addr);
    const mergeLabel = mergeInfo ? `[${mergeInfo.start}:${mergeInfo.end}]` : "";
    cells.push(`${addr}${mergeLabel}=${v}`);
  }
  if (cells.length > 0) {
    console.log(line + cells.join(" | "));
  }
}

console.log("\n=== ROW HEIGHTS ===");
for (let r = 1; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  if (row.height) console.log(`  Row ${r}: height=${row.height}`);
}