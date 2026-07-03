import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { readFile } from "fs/promises";

const buf = await readFile(process.argv[2]);
const parser = new PDFParse({ data: buf });
const result = await parser.getText();
console.log("=== TEXT ===");
console.log(result.text);
console.log("=== METADATA ===");
console.log(JSON.stringify(result.metadata, null, 2));
console.log("=== PAGES:", result.total);