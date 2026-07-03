"""Generate sample output using new format and compare to real QN 26 files."""
import re
from pathlib import Path

# Real QN 26 reference (first installment pattern from XLSX)
real = {
    "validation_line": "กำหนดยื่นราคา 30 วัน นับจากวันที่ยื่นใบเสนอราคา",
    "summary_line":   "งวดงานแบ่งจ่ายเป็น 2 งวด รวมทั้งหมด  56,012.36 บาท",
    "inst1_line":     "งวดงานที่ 1 ก่อนเริ่มงาน  50%           28,006.18 บาท",
    "inst2_line":     "งวดงานที่ 2 หลังส่งมอบงาน 50%     28,006.18 บาท ",
    "channel_label":  "ช่องทางการชำระเงิน ",
    "payee_line":     "สั่งจ่ายในนาม นายพรชัย ชูพรม",
    "bank_line":      "ธ.ไทยพาณิชย์ บัญชี ออมทรัพย์  เลขที่บัญชี 1174057341",
}

# What our new code produces (simulate the format)
def simulate_installment_line(n, label, pct, amount):
    pad_after_label = "  " if len(label) <= 12 else " "
    pad_before_amount = "           " if len(label) <= 12 else "     "
    return f"งวดงานที่ {n} {label}{pad_after_label}{pct}%{pad_before_amount}{amount} บาท"

our = {
    "validation_line": "กำหนดยื่นราคา 30 วัน นับจากวันที่ยื่นใบเสนอราคา",  # hardcoded
    "summary_line":   "งวดงานแบ่งจ่ายเป็น 2 งวด รวมทั้งหมด  56,012.36 บาท",  # from template
    "inst1_line":     simulate_installment_line(1, "ก่อนเริ่มงาน", 50, "28,006.18"),
    "inst2_line":     simulate_installment_line(2, "หลังส่งมอบงาน", 50, "28,006.18") + " ",
    "channel_label":  "ช่องทางการชำระเงิน ",  # now without colon, no bold, trailing space matches real
    "payee_line":     "สั่งจ่ายในนาม นายพรชัย ชูพรม",
    "bank_line":      "ธ.ไทยพาณิชย์ บัญชี ออมทรัพย์  เลขที่บัญชี 1174057341",  # from updated COMPANY_INFO.bank
}

print("=" * 80)
print("REAL (จาก QN 26)  vs  OUR (จาก code ใหม่)")
print("=" * 80)
for key in real:
    match = "✅" if real[key] == our[key] else "❌"
    print(f"\n{match} [{key}]")
    print(f"   REAL : '{real[key]}'")
    print(f"   OURS : '{our[key]}'")

# Test with the other common patterns
print("\n\n=== Test other labels ===")
for label in ["ก่อนเริ่มงาน", "หลังส่งมอบงาน", "หลังทาสีผนังภายในเสร็จ", "หลังทาสีฝ้าเพดานเสร็จ"]:
    line = simulate_installment_line(1, label, 50, "10,000.00")
    print(f"  Label '{label}' (len={len(label)}): '{line}'")