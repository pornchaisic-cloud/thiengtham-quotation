#!/usr/bin/env python3
"""
T0b — zoom into top section (Company info + Logo) for both PDFs
ใช้ DPI 250 + clip rect เฉพาะ top 35% ของ page
"""
import os
import fitz

WORKSPACE = r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test"
SCRIPTS = os.path.join(WORKSPACE, "scripts")
REF_PDF = os.path.join(SCRIPTS, "reference.pdf")
APP_PDF = os.path.join(SCRIPTS, "app_qn062.pdf")

REF_TOP = os.path.join(SCRIPTS, "_ref_top.png")
APP_TOP = os.path.join(SCRIPTS, "_app_top.png")

DPI = 250  # สูงกว่า T0 (150) เพื่ออ่าน text ชัด
TOP_FRAC = 0.40  # top 40% ของ page (header + customer block)


def render_top(pdf_path, out_path, dpi=DPI, top_frac=TOP_FRAC):
    if not os.path.exists(pdf_path):
        print(f"❌ missing: {pdf_path}")
        return False
    doc = fitz.open(pdf_path)
    page = doc[0]
    rect = page.rect
    # clip เฉพาะ top portion
    clip = fitz.Rect(0, 0, rect.width, rect.height * top_frac)
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False, clip=clip)
    pix.save(out_path)
    print(f"✅ {os.path.basename(pdf_path)}: top {int(top_frac*100)}% = {clip.width:.1f}×{clip.height:.1f} pt → {out_path} ({pix.width}×{pix.height} px)")
    doc.close()
    return True


print("=" * 60)
print("T0b — top section zoom (Company info + Logo)")
print("=" * 60)
ok1 = render_top(REF_PDF, REF_TOP)
print()
ok2 = render_top(APP_PDF, APP_TOP)
print()
if ok1 and ok2:
    print("✅ done — เปิด 2 ภาพเทียบ:")
    print(f"   {REF_TOP}")
    print(f"   {APP_TOP}")