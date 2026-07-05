// Quick test: Generate a minimal xlsx with just the logo anchor (T3 fix).
// Then we can run image_positions.py to verify Excel writes `_to: row=5 rowOff=0`
// matching the reference QN 26 (row=5.999 should produce row=5 with rowOff=0).
import ExcelJS from "exceljs";
import { writeFile } from "fs/promises";
import { readFileSync } from "fs";

const companyLogoB64 = readFileSync("scripts/logo_b64.txt", "utf-8").trim();

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("ใบเสนอราคา");

// Match layout: row heights for rows 1-5
ws.getRow(1).height = 21.75;
ws.getRow(2).height = 21.75;
ws.getRow(3).height = 35.25;
ws.getRow(4).height = 21;
ws.getRow(5).height = 21;

// Add logo with T3 fix anchor: br = { col: 20.999, row: 5.999 }
const imgId = wb.addImage({ base64: companyLogoB64, extension: "png" });
ws.addImage(imgId, {
  tl: { col: 18, row: 1 },       // S2
  br: { col: 20.999, row: 5.999 }, // U5.999 (T3 fix: was row: 6)
});

const buf = await wb.xlsx.writeBuffer();
const outPath = "scripts/test_T3_logo.xlsx";
await writeFile(outPath, Buffer.from(buf));
console.log(`Wrote ${outPath}`);
