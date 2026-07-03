"""Extract payment-conditions text from all QN 26 quotation files (PDF + XLSX)."""
import os, re, json
from pathlib import Path
import openpyxl
import fitz  # PyMuPDF

QN_DIR = Path(r"D:\เที่ยงทำ ดีเวลล็อปเมนท์\ใบเสนอราคา\QN 26")
OUT = Path(r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test\scripts\qn26_extract.txt")
OUT.parent.mkdir(parents=True, exist_ok=True)

# keywords to flag in output
KEYS = [
    "เงื่อนไขการชำระเงิน",
    "ชำระเงิน",
    "งวด",
    "มัดจำ",
    "สั่งจ่ายในนาม",
    "ช่องทางการชำระเงิน",
    "ธนาคาร",
    "กำหนดยื่นราคา",
    "ราคาต่อหน่วย",
]

def extract_pdf(path: Path):
    try:
        doc = fitz.open(path)
        return "\n".join(p.get_text("text") for p in doc)
    except Exception as e:
        return f"<<PDF ERROR: {e}>>"

def extract_xlsx(path: Path):
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        chunks = []
        for ws in wb.worksheets:
            chunks.append(f"[Sheet: {ws.title}]")
            for row in ws.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                line = " | ".join(cells).rstrip(" |")
                if line.strip():
                    chunks.append(line)
        return "\n".join(chunks)
    except Exception as e:
        return f"<<XLSX ERROR: {e}>>"

def main():
    out = []
    pdf_files = sorted(QN_DIR.glob("*.pdf"))
    xlsx_files = sorted(QN_DIR.glob("*.xlsx"))
    print(f"Found {len(pdf_files)} PDFs and {len(xlsx_files)} XLSX")

    for xlsx in xlsx_files:
        text = extract_xlsx(xlsx)
        out.append(f"\n\n========== {xlsx.name} ==========")
        out.append(text)

    for pdf in pdf_files:
        text = extract_pdf(pdf)
        out.append(f"\n\n========== {pdf.name} ==========")
        out.append(text)

    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")

if __name__ == "__main__":
    main()