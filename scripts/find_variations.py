"""Find all installment labels and bank variations."""
import re
from pathlib import Path

EXTRACT = Path(r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test\scripts\qn26_extract.txt")

text = EXTRACT.read_text(encoding="utf-8")
sections = re.split(r"^=+\s+(.+?)\s+=+\s*$", text, flags=re.M)

labels = {}
banks = {}
quotation_days = {}
payees = {}
installment_counts = {}

for i in range(1, len(sections), 2):
    name = sections[i].strip()
    body = sections[i + 1] if i + 1 < len(sections) else ""

    # Installment labels (e.g., "งวดงานที่ 1 ก่อนเริ่มงาน")
    for m in re.finditer(r"งวดงานที่\s+\d+\s+([^|0-9\n]+?)(?=\s+\d+%)", body):
        lbl = m.group(1).strip()
        labels.setdefault(lbl, []).append(name)

    # Bank info
    for m in re.finditer(r"ธ\.([^\n|]+(?:บัญชี[^\n|]*)?เลขที่บัญชี\s*[\d\-]+)", body):
        bank = m.group(0).strip()
        banks.setdefault(bank, []).append(name)

    # Quotation days
    for m in re.finditer(r"กำหนดยื่นราคา\s+(\d+)\s+วัน", body):
        d = m.group(1)
        quotation_days.setdefault(d, []).append(name)

    # Payees
    for m in re.finditer(r"สั่งจ่ายในนาม\s+([^\n|]+)", body):
        p = m.group(1).strip()
        payees.setdefault(p, []).append(name)

    # Installment count
    for m in re.finditer(r"งวดงานแบ่งจ่ายเป็น\s+(\d+)\s+งวด", body):
        c = m.group(1)
        installment_counts.setdefault(c, []).append(name)

print("=== Installment Labels ===")
for lbl, names in sorted(labels.items(), key=lambda x: -len(x[1])):
    print(f"  '{lbl}' → {len(names)} files")

print("\n=== Banks ===")
for b, names in sorted(banks.items(), key=lambda x: -len(x[1])):
    print(f"  '{b}' → {len(names)} files")
    if len(names) <= 3:
        for n in names: print(f"    - {n}")

print("\n=== Quotation Days ===")
for d, names in sorted(quotation_days.items(), key=lambda x: -len(x[1])):
    print(f"  '{d} วัน' → {len(names)} files")

print("\n=== Payees ===")
for p, names in sorted(payees.items(), key=lambda x: -len(x[1])):
    print(f"  '{p}' → {len(names)} files")

print("\n=== Installment Counts ===")
for c, names in sorted(installment_counts.items(), key=lambda x: -len(x[1])):
    print(f"  '{c} งวด' → {len(names)} files")