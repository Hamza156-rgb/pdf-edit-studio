"""Shrinks large PNGs (splash screens) below 1 MB with palette quantization + dithering.

Manus checkpoints reject files over 1 MB, and smaller splashes also shrink the app download.
Usage (from the repo root): python3 brand/compress_pngs.py
"""
import pathlib
from PIL import Image

ROOTS = ["mobile/assets", "mobile/android/app/src/main/res", "mobile/ios/App/App/Assets.xcassets"]
LIMIT = 500 * 1024

for root in ROOTS:
    for path in pathlib.Path(root).rglob("*.png"):
        if path.stat().st_size <= LIMIT:
            continue
        before = path.stat().st_size
        image = Image.open(path)
        has_alpha = image.mode in ("RGBA", "LA") and image.getextrema()[-1][0] < 255
        if has_alpha:
            image.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
        else:
            image.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
        print(f"{before // 1024:>5} KB -> {path.stat().st_size // 1024:>4} KB  {path}")
