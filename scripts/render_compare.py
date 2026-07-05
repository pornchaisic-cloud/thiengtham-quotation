#!/usr/bin/env python3
"""
T0 visual verification — render reference.pdf + app_qn062.pdf เป็น PNG (DPI 150)
แล้ว save ลง scripts/_ref_render.png, scripts/_app_render.png

เหตุผล: app PDF เป็น image-based (html2canvas) → text extract ไม่ได้
ต้อง render เป็น raster แล้วเทียบด้วยตา
"""
import os
import sys
import fitz  # PyMuPDF

WORKSPACE = r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test"
SCRIPTS = os.path.join(WORKSPACE, "scripts")
REF_PDF = os.path.join(SCRIPTS, "reference.pdf")
APP_PDF = os.path.join(SCRIPTS, "app_qn062.pdf")
REF_OUT = os.path.join(SCRIPTS, "_ref_render.png")
APP_OUT = os.path.join(SCRIPTS, "_app_render.png")

DPI = 150  # ~ retina-ish — เห็น text ชัดพอที่จะอ่านได้

def render_pdf(pdf_path, out_path, dpi=DPI):
    if not os.path.exists(pdf_path):
        print(f"❌ missing: {pdf_path}")
        return False
    doc = fitz.open(pdf_path)
    print(f"📄 {os.path.basename(pdf_path)}: {len(doc)} page(s)")
    for i, page in enumerate(doc):
        # คำนวณ zoom จาก DPI (PDF default = 72 DPI)
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        suffix = "" if i == 0 else f"_page{i+1}"
        out_file = out_path.replace(".png", f"{suffix}.png")
        pix.save(out_file)
        size_pt = page.rect
        print(f"   page {i+1}: {size_pt.width:.1f}×{size_pt.height:.1f} pt → {out_file} ({pix.width}×{pix.height} px)")
    doc.close()
    return True

def main():
    print("=" * 60)
    print("T0 visual verify — render PDFs as PNG")
    print("=" * 60)
    ok1 = render_pdf(REF_PDF, REF_OUT)
    print()
    ok2 = render_pdf(APP_PDF, APP_OUT)
    print()
    if ok1 and ok2:
        print("✅ done — เปิด 2 ภาพเทียบ:")
        print(f"   {REF_OUT}")
        print(f"   {APP_OUT}")
    else:
        print("❌ มีไฟล์หาย — ตรวจ path ใหม่")
        sys.exit(1)

if __name__ == "__main__":
    main()