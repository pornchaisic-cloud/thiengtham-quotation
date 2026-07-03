"""Extract just the payment-conditions block per file."""
import re
from pathlib import Path

EXTRACT = Path(r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test\scripts\qn26_extract.txt")
OUT = Path(r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test\scripts\qn26_payment_blocks.txt")

text = EXTRACT.read_text(encoding="utf-8")
sections = re.split(r"^=+\s+(.+?)\s+=+\s*$", text, flags=re.M)

# sections looks like: [preamble, name1, body1, name2, body2, ...]
blocks = []
for i in range(1, len(sections), 2):
    name = sections[i].strip()
    body = sections[i + 1] if i + 1 < len(sections) else ""
    # Find payment-conditions block — start at "กำหนดยื่นราคา" or "งวดงานแบ่งจ่าย"
    m = re.search(r"(กำหนดยื่นราคา[^\n]*(?:\n(?!ได้รับสินค้า|Received|โครงการ)[^\n]*){0,15})", body)
    if not m:
        m = re.search(r"(งวดงานแบ่งจ่าย[^\n]*(?:\n[^\n]*){0,12})", body)
    block = m.group(1).strip() if m else "(not found)"
    blocks.append((name, block))

# Print to file
lines = []
for name, block in blocks:
    lines.append(f"=== {name} ===")
    lines.append(block)
    lines.append("")
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT}, {len(blocks)} files")
print()
# Distinct patterns
patterns = {}
for name, block in blocks:
    # normalize: strip numbers from amounts, strip whitespace
    norm = re.sub(r"\s+", " ", block).strip()
    norm = re.sub(r"\d[\d,]*\.\d+", "X.XX", norm)
    norm = re.sub(r"\d[\d,]*", "X", norm)
    patterns.setdefault(norm, []).append(name)

print(f"\nDistinct patterns: {len(patterns)}")
for i, (pat, names) in enumerate(patterns.items(), 1):
    print(f"\n--- Pattern {i} ({len(names)} files) ---")
    print(pat[:500])
    if len(names) <= 3:
        for n in names:
            print(f"  - {n}")