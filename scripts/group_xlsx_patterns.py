"""Group by structure, ignore content variation."""
import re
from pathlib import Path

EXTRACT = Path(r"D:\app thiengtham\AI App\ThiengTham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test\scripts\qn26_extract.txt")

text = EXTRACT.read_text(encoding="utf-8")
sections = re.split(r"^=+\s+(.+?)\s+=+\s*$", text, flags=re.M)

xlsx_blocks = []
pdf_blocks = []
for i in range(1, len(sections), 2):
    name = sections[i].strip()
    body = sections[i + 1] if i + 1 < len(sections) else ""
    # Find payment block
    m = re.search(r"(กำหนดยื่นราคา[^\n]*\n(?:[^\n]*\n){0,15})", body)
    if not m:
        m = re.search(r"(งวดงานแบ่งจ่าย[^\n]*(?:\n[^\n]*){0,12})", body)
    block = m.group(1).strip() if m else ""
    if name.endswith(".xlsx"):
        xlsx_blocks.append((name, block))
    elif name.endswith(".pdf"):
        pdf_blocks.append((name, block))

# For XLSX (structured) — group by exact structure (only XLSX since PDF gets garbled by font)
patterns = {}
for name, block in xlsx_blocks:
    patterns.setdefault(block, []).append(name)

print(f"XLSX files: {len(xlsx_blocks)}")
print(f"Distinct XLSX patterns: {len(patterns)}\n")

# Sort patterns by count desc
sorted_p = sorted(patterns.items(), key=lambda x: -len(x[1]))

# Print TOP 5 patterns with full text
for i, (pat, names) in enumerate(sorted_p[:5], 1):
    print(f"\n=== XLSX PATTERN {i} — {len(names)} files ===")
    print(pat[:1500])
    if len(names) <= 5:
        for n in names:
            print(f"  - {n}")
    else:
        for n in names[:5]:
            print(f"  - {n}")
        print(f"  ... +{len(names)-5} more")

# Print all single-file patterns (rare/oddballs)
print("\n\n=== SINGLE-FILE XLSX PATTERNS (rare) ===")
for pat, names in sorted_p:
    if len(names) == 1:
        print(f"--- {names[0]} ---")
        print(pat[:600])