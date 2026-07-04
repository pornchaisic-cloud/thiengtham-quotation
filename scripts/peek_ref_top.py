import fitz
doc = fitz.open('scripts/reference.pdf')
page = doc[0]
print('=== PAGE 1 TOP (y < 200) ===')
blocks = page.get_text('dict')['blocks']
for b in blocks:
    if b['type'] == 0:
        for line in b['lines']:
            for span in line['spans']:
                text = span['text'].strip()
                if text and span['bbox'][1] < 200:
                    bbox = span['bbox']
                    print(f"  ({bbox[0]:.0f},{bbox[1]:.0f})-({bbox[2]:.0f},{bbox[3]:.0f}) [{span['size']:.1f}pt b={span['flags']>>4&1}] {text}")