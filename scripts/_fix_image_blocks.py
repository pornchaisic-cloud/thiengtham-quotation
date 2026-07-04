# -*- coding: utf-8 -*-
import sys

fp = r'src\components\ViewQuoteScreen.jsx'

with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1) Logo block
old_logo = '''    // ── Logo image (top-right corner, S2:U6 like reference) ───────
    let logoImageId = null;
    if (quote.logo && typeof quote.logo === "string") {
      try {
        const logoBase64 = quote.logo.includes(",") ? quote.logo.split(",")[1] : quote.logo;
        logoImageId = wb.addImage({ base64: logoBase64, extension: "png" });
        ws.addImage(logoImageId, {
          tl: { col: 18, row: 1 },    // S2 (zero-indexed)
          br: { col: 20.999, row: 6 }, // U6
        });
      } catch (e) {
        console.warn("Excel logo add failed:", e);
      }
    }'''

new_logo = '''    // ── Logo image (top-right corner, S2:U6 like reference) ───────
    let logoImageId = null;
    try {
      let logoB64 = null;
      if (quote.logo && typeof quote.logo === "string" && quote.logo.length > 64) {
        logoB64 = quote.logo.includes(",") ? quote.logo.split(",")[1] : quote.logo;
      }
      if (!logoB64 && defaultLogoB64) logoB64 = defaultLogoB64;
      if (logoB64) {
        logoImageId = wb.addImage({ base64: logoB64, extension: "png" });
        ws.addImage(logoImageId, {
          tl: { col: 18, row: 1 },    // S2 (zero-indexed)
          br: { col: 20.999, row: 6 }, // U6
        });
      }
    } catch (e) {
      console.warn("Excel logo add failed:", e);
    }'''

if old_logo in content:
    content = content.replace(old_logo, new_logo)
    print('REPLACED logo block')
else:
    print('LOGO NOT FOUND')

# 2) Signature block
old_sig = '''    // ── Signature image (L36:U42 — sits over the "ในนาม" signature block) ──
    if (quote.signature && typeof quote.signature === "string") {
      try {
        const sigBase64 = quote.signature.includes(",") ? quote.signature.split(",")[1] : quote.signature;
        const sigImageId = wb.addImage({ base64: sigBase64, extension: "png" });
        ws.addImage(sigImageId, {
          tl: { col: 11, row: 35 },    // L36 (zero-indexed)
          br: { col: 20.999, row: 42 }, // U42
        });
      } catch (e) {
        console.warn("Excel signature add failed:", e);
      }
    }'''

new_sig = '''    // ── Signature image (L36:U42 — sits over the "ในนาม" signature block) ──
    try {
      let sigB64 = null;
      if (quote.signature && typeof quote.signature === "string" && quote.signature.length > 64) {
        sigB64 = quote.signature.includes(",") ? quote.signature.split(",")[1] : quote.signature;
      }
      if (sigB64) {
        const sigImageId = wb.addImage({ base64: sigB64, extension: "png" });
        ws.addImage(sigImageId, {
          tl: { col: 11, row: 35 },    // L36 (zero-indexed)
          br: { col: 20.999, row: 42 }, // U42
        });
      }
    } catch (e) {
      console.warn("Excel signature add failed:", e);
    }'''

if old_sig in content:
    content = content.replace(old_sig, new_sig)
    print('REPLACED sig block')
else:
    print('SIG NOT FOUND')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)

print('DONE')
