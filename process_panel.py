"""
process_panel.py
  1. Remove "— CAMPAIGN —" text cleanly
  2. Draw "— mudmap —" in matching gold
  3. Save as WebP
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

SRC   = Path("/mnt/c/dev/Tevethara Image.png")
OUT   = Path("/home/griffen/projects/mudmap/frontend/public/tevethara-panel.webp")
FONTS = Path("/home/griffen/projects/mudmap/.claude/skills/canvas-design/canvas-fonts")

orig = Image.open(SRC).convert("RGB")
W, H = orig.size   # 1024 × 1536
arr  = np.array(orig, dtype=np.float32)

# ── Zone boundaries (from visual inspection of crops) ───────────────────────
# TEVETHARA title lives in y ≈ 278-370
# CAMPAIGN + decorative rules live in y ≈ 370-445
TEV_BOTTOM = 372   # last row we want to PRESERVE from original (TEVETHARA)
CAM_Y0     = 373   # start of fill zone
CAM_Y1     = 448   # end of fill zone

result = Image.fromarray(arr.astype(np.uint8))

zone_h = CAM_Y1 - CAM_Y0

# ── 1. Draw a dark feathered overlay over the CAMPAIGN zone ─────────────────
# The original sky there is complex (warm clouds + moon glows) so we use a
# deliberate near-black overlay that reads as intentional night-sky depth,
# rather than a reconstruction that can't perfectly match the original texture.
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)

# Solid dark core
core_y0 = CAM_Y0 + 6
core_y1 = CAM_Y1 - 6
od.rectangle([0, core_y0, W, core_y1], fill=(6, 8, 18, 210))

# Feather top edge: semi-transparent gradient rows
fade_rows = 14
for i in range(fade_rows):
    a = int(210 * (i / fade_rows))
    od.line([(0, core_y0 - 1 - i), (W, core_y0 - 1 - i)], fill=(6, 8, 18, a))
# Feather bottom edge
for i in range(fade_rows):
    a = int(210 * (i / fade_rows))
    od.line([(0, core_y1 + 1 + i), (W, core_y1 + 1 + i)], fill=(6, 8, 18, a))

result = result.convert("RGBA")
result.alpha_composite(overlay)
result = result.convert("RGB")

# ── 2. Restore TEVETHARA region exactly from original ───────────────────────
# This guarantees zero blur damage to the original title text.
tev_orig = orig.crop((0, 0, W, TEV_BOTTOM))
result.paste(tev_orig, (0, 0))

# ── 3. Draw "— mudmap —" centred in the cleared zone ────────────────────────
draw = ImageDraw.Draw(result)

GOLD       = (205, 170, 85)
GOLD_DARK  = (100,  75, 25)
GOLD_LIGHT = (245, 220, 145)

try:
    font = ImageFont.truetype(str(FONTS / "CrimsonPro-Italic.ttf"), 44)
except Exception:
    font = ImageFont.load_default()

text = "\u2014  mudmap  \u2014"
bbox = draw.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
tx = (W - tw) // 2
ty = CAM_Y0 + (zone_h - th) // 2 - 4

# Shadow
draw.text((tx + 2, ty + 3), text, font=font, fill=(*GOLD_DARK, 200))
# Highlight
draw.text((tx - 1, ty - 1), text, font=font, fill=(*GOLD_LIGHT, 90))
# Main
draw.text((tx, ty), text, font=font, fill=GOLD)

# ── 4. Save ──────────────────────────────────────────────────────────────────
result.save(str(OUT), "WEBP", quality=88, method=6)
print(f"Saved {OUT}  ({W}×{H})  {OUT.stat().st_size // 1024} KB")
