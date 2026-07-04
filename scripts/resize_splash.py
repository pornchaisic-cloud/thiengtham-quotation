"""Resize splash.png + drawable splash variants to square using TT logo."""
from pathlib import Path
from PIL import Image

LOGO = Path(r"logo\TT logo-01.png")
SPLASH_OUT = Path(r"android\app\src\main\res\drawable\splash.png")
SPLASH_BG = "#0a0a0a"  # dark background matching app theme

# Generate splash for each density
SPLASH_DENSITIES = [
    ("drawable/splash.png", 1024),
    ("drawable-port-mdpi/splash.png", 320),
    ("drawable-port-hdpi/splash.png", 480),
    ("drawable-port-xhdpi/splash.png", 720),
    ("drawable-port-xxhdpi/splash.png", 960),
    ("drawable-port-xxxhdpi/splash.png", 1280),
    ("drawable-land-mdpi/splash.png", 320),
    ("drawable-land-hdpi/splash.png", 480),
    ("drawable-land-xhdpi/splash.png", 720),
    ("drawable-land-xxhdpi/splash.png", 960),
    ("drawable-land-xxxhdpi/splash.png", 1280),
]

def make_square_splash(size: int) -> Image.Image:
    """Create square splash with TT logo centered on dark background."""
    canvas = Image.new("RGB", (size, size), SPLASH_BG)
    logo = Image.open(LOGO).convert("RGBA")

    # Resize logo to ~60% of canvas (leave padding)
    target_w = int(size * 0.6)
    ratio = target_w / logo.width
    target_h = int(logo.height * ratio)
    logo_resized = logo.resize((target_w, target_h), Image.LANCZOS)

    # Center
    x = (size - target_w) // 2
    y = (size - target_h) // 2

    # Composite with alpha
    canvas.paste(logo_resized, (x, y), logo_resized if logo_resized.mode == "RGBA" else None)
    return canvas

def main():
    print(f"Source logo: {LOGO} ({Image.open(LOGO).size})")
    for rel, size in SPLASH_DENSITIES:
        out = Path(r"android\app\src\main\res") / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        img = make_square_splash(size)
        img.save(out, "PNG", optimize=True)
        print(f"  {rel} -> {size}x{size} ({out.stat().st_size} bytes)")

if __name__ == "__main__":
    main()