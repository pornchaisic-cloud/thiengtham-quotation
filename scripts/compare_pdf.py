"""Compare reference.pdf (ต้นฉบับ) vs TT-QN-062-26.pdf (app-generated)."""
import sys
from pathlib import Path
import fitz

REF = Path(r"scripts\reference.pdf")
APP = Path(r"C:\Users\Succubuz\Desktop\ทดสอบแอป\TT-QN-062-26 ????????.pdf")

# Copy app pdf to ASCII path
APP_ASCII = Path(r"scripts\app_qn062.pdf")

def extract_text(pdf_path):
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        pages.append(f"\n===== PAGE {i+1} =====\n{text}")
    return "".join(pages), len(doc)

def extract_layout(pdf_path):
    """Extract text with positions for layout comparison."""
    doc = fitz.open(pdf_path)
    out = []
    for i, page in enumerate(doc):
        out.append(f"\n===== PAGE {i+1} layout =====")
        # Get text blocks with positions
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if b["type"] == 0:  # text block
                for line in b["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if text:
                            bbox = span["bbox"]
                            out.append(f"  ({bbox[0]:.0f},{bbox[1]:.0f}) {text}")
    return "\n".join(out)

print("="*80)
print("REFERENCE (ต้นฉบับ)")
print("="*80)
text, npages = extract_text(REF)
print(f"Pages: {npages}")
print(text)
print()
print("="*80)
print("APP-GENERATED")
print("="*80)
text2, npages2 = extract_text(APP_ASCII)
print(f"Pages: {npages2}")
print(text2)