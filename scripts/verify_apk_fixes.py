"""Verify APK contains the T1+T2+T3 fixes."""
import zipfile

APK = r"android/app/build/outputs/apk/debug/app-debug.apk"

with zipfile.ZipFile(APK) as z:
    js_files = [n for n in z.namelist() if n.startswith("assets/public/assets/") and n.endswith(".js")]
    print(f"JS bundles: {len(js_files)}")
    for jf in js_files:
        info = z.getinfo(jf)
        print(f"  {jf}: {info.file_size:,} bytes")

    # Use the largest bundle (main app code, per build output was index-AkTMoiUa.js)
    # Scan ALL bundles for our markers
    all_data = ""
    for jf in js_files:
        all_data += z.read(jf).decode("utf-8", errors="replace")
    # Also try the dist html
    for name in z.namelist():
        if name.endswith(".js") or name.endswith(".html"):
            all_data += z.read(name).decode("utf-8", errors="replace")
    data = all_data

    markers = {
        "T3 anchor 5.999":            "5.999",
        "T2 format letter":           "format:\"letter\"",
        "T2 format letter 2":         'format:"letter"',
        "T3 addImage TL":             "col:18,row:1",
        "T3 addImage BR":             "col:20.999",
        "T1 Number ||":               "Number(",
        "T1 fall-back reduce":        ".reduce",
        "T1 subtotalUI":              "subtotalUI",
    }
    print(f"\n=== Fix markers in bundle ({len(data):,} chars) ===")
    for label, marker in markers.items():
        if isinstance(marker, bool):
            continue
        count = data.count(marker)
        status = "FOUND" if count > 0 else "NOT FOUND"
        print(f"  {label:32s}: {status} ({count} hits)")

    # Also check: old "row: 6" pattern is gone from logo anchor (single instance only)
    old_pattern = "row: 6"
    print(f"\n  Old 'row: 6' count in bundle: {data.count(old_pattern)}")
    # Note: may match other unrelated lines, just for info

