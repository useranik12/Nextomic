"""Crop and downscale a region of a very large design image so it can be read.

Usage: python3 -I crop.py <src.png> <out.png> <x0> <y0> <x1> <y1> <scale>
Coordinates are in source pixels. Example: crop a 2000x800 area at 50%:
  python3 -I blueprint/tools/crop.py blueprint/design-system/design-system-sheet.png /tmp/out.png 13900 870 15500 1720 0.5
"""
import sys
from PIL import Image

Image.MAX_IMAGE_PIXELS = 400_000_000  # design sheets exceed Pillow's default limit
src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = (int(float(v)) for v in sys.argv[3:7])
scale = float(sys.argv[7])
crop = Image.open(src).convert("RGB").crop((x0, y0, x1, y1))
crop = crop.resize((max(int(crop.width * scale), 1), max(int(crop.height * scale), 1)), Image.LANCZOS)
crop.save(out)
print(crop.size)
