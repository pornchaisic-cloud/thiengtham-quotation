import os
import re
import json
import base64
from pathlib import Path

TOOL_OUT = Path(r'C:\Users\Succubuz\.local\share\opencode\tool-output')
WORKSPACE = r"D:\app thiengtham\AI App\Thiengtham2_v7_AI_GPT_Model2\ThiengTham2_v7_AI_GPT_Test"
SCRIPTS = os.path.join(WORKSPACE, "scripts")
XL_OUT = os.path.join(SCRIPTS, "app_qn062.xlsx")
PDF_OUT = os.path.join(SCRIPTS, "app_qn062.pdf")

EXCEL_RX = re.compile(r'kind"?\\?":?\\?"excel')
PDF_RX = re.compile(r'kind"?\\?":?\\?"pdf')


def find_latest(rx):
    files = sorted(TOOL_OUT.glob('tool_*'), key=lambda f: f.stat().st_mtime, reverse=True)
    for f in files:
        text = f.read_text(encoding='utf-8', errors='replace')
        if rx.search(text):
            return f, text
    return None, None


def extract_b64(text, kind):
    # find: ### Result\n"..."  (the ... may be the escaped JSON string)
    # We split on first "### Result\n" then take until next \n" that's followed by either ### or end
    idx = text.find('### Result\n')
    if idx < 0:
        raise RuntimeError(f"no ### Result for {kind}")
    after = text[idx + len('### Result\n'):]
    # the string is wrapped in " ... \n" - ends with \"}"\n
    end_match = re.search(r'\\"}"\s*\n', after)
    if not end_match:
        end_match = re.search(r'\\"}"\s*$', after)
    if not end_match:
        raise RuntimeError(f"no closing quote for {kind}")
    # Include the closing \"} in the escaped string
    escaped = after[:end_match.start() + 5]  # 5 chars: \ " } "
    # This is a JSON string literal like: "{\"ok\":true,...,\"b64\":\"...\"}"
    # Parse it directly - first layer gives string, second gives dict
    obj_str = json.loads(escaped)
    obj = json.loads(obj_str)
    print(f"  {kind}: ok={obj.get('ok')}, type={obj.get('type')}, size={obj.get('size')}, b64Len={obj.get('b64Len')}")
    return base64.b64decode(obj["b64"])


print("=" * 60)
print("extract captured blobs → overwrite app_qn062.{xlsx,pdf}")
print("=" * 60)

xl_file, xl_text = find_latest(EXCEL_RX)
if xl_file is None:
    raise RuntimeError("no excel extract output found")
print(f"xl source: {xl_file.name}")
xl_bytes = extract_b64(xl_text, "excel")
with open(XL_OUT, "wb") as f:
    f.write(xl_bytes)
print(f"✅ wrote {XL_OUT} ({len(xl_bytes)} bytes)")

xl_mtime = xl_file.stat().st_mtime
pdf_file, pdf_text = None, None
files = sorted(TOOL_OUT.glob('tool_*'), key=lambda f: f.stat().st_mtime, reverse=True)
for f in files:
    if f.stat().st_mtime <= xl_mtime:
        continue
    text = f.read_text(encoding='utf-8', errors='replace')
    if PDF_RX.search(text):
        pdf_file, pdf_text = f, text
        break
if pdf_file is None:
    raise RuntimeError("no pdf extract output found (newer than xl)")
print(f"pdf source: {pdf_file.name}")
pdf_bytes = extract_b64(pdf_text, "pdf")
with open(PDF_OUT, "wb") as f:
    f.write(pdf_bytes)
print(f"✅ wrote {PDF_OUT} ({len(pdf_bytes)} bytes)")