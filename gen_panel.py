"""
Generate tevethara-panel.png — 320×1100 px
"Luminous Sediment" design philosophy
Tevethara MUD world art: geological strata, twin moons, ruins, Celestium crystals
"""

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = Path("/home/griffen/projects/mudmap/.claude/skills/canvas-design/canvas-fonts")
OUT   = Path("/home/griffen/projects/mudmap/frontend/public/tevethara-panel.png")

W, H = 320, 1100
rng  = random.Random(42)

img  = Image.new("RGBA", (W, H), (0, 0, 0, 255))
draw = ImageDraw.Draw(img)

# ── colour palette ────────────────────────────────────────────────────────────
SKY_TOP       = (4,   7,  22)
SKY_MID       = (8,  14,  38)
SKY_HORIZON   = (14, 22,  58)
SILTHEA_CORE  = (120,180,255)   # blue moon
SILTHEA_GLOW  = (60, 100,200)
ELARION_CORE  = (255,120, 80)   # red moon
ELARION_GLOW  = (180, 50, 30)
CELES_PINK    = (200, 80,230)   # Celestium
CELES_LIGHT   = (230,140,255)
CELES_DIM     = (100, 30,120)
ROCK_DARK     = (18,  16, 28)
ROCK_MID      = (28,  24, 40)
ROCK_LIGHT    = (52,  46, 72)
GOLD          = (180,148, 72)
GOLD_DIM      = ( 90, 72, 32)
GROUND        = (10,   8, 18)
MIST          = (20,  28, 60, 90)

def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(len(a)))

# ── 1. sky gradient ───────────────────────────────────────────────────────────
sky_h = 500
for y in range(sky_h):
    t = y / sky_h
    if t < 0.5:
        c = lerp_color(SKY_TOP, SKY_MID, t*2)
    else:
        c = lerp_color(SKY_MID, SKY_HORIZON, (t-0.5)*2)
    draw.line([(0, y), (W, y)], fill=c)

# ── 2. stars ──────────────────────────────────────────────────────────────────
stars = []
for _ in range(180):
    sx = rng.randint(0, W-1)
    sy = rng.randint(0, 380)
    br = rng.random()
    sz = 1 if br < 0.75 else 2
    alpha = int(60 + br * 180)
    stars.append((sx, sy, sz, alpha))

for sx, sy, sz, alpha in stars:
    c = (200+int(rng.random()*55), 200+int(rng.random()*55), 220+int(rng.random()*35), alpha)
    if sz == 1:
        img.putpixel((sx, sy), c)
    else:
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if 0<=sx+dx<W and 0<=sy+dy<H:
                    a2 = alpha if dx==0 and dy==0 else alpha//3
                    img.putpixel((sx+dx, sy+dy), (*c[:3], a2))

def draw_moon(cx, cy, r, core, glow, layers=5):
    overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    for i in range(layers, -1, -1):
        ratio  = i / layers
        radius = int(r * (1 + ratio * 3.5))
        alpha  = int(18 * (1 - ratio))
        od.ellipse([cx-radius, cy-radius, cx+radius, cy+radius],
                   fill=(*glow, alpha))
    # soft corona
    for i in range(3):
        cr = r + 4 + i*6
        od.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=(*glow, 12-i*3))
    # core disk with limb darkening
    for ri in range(r, 0, -1):
        t = ri / r
        col = lerp_color(core, lerp_color(core, glow, 0.4), t*0.3)
        od.ellipse([cx-ri, cy-ri, cx+ri, cy+ri], fill=(*col, 255))
    img.alpha_composite(overlay)

# Silthëa — blue moon, upper right, larger
draw_moon(cx=244, cy=52, r=22, core=SILTHEA_CORE, glow=SILTHEA_GLOW)
# Elarion — red moon, left side, smaller
draw_moon(cx=54, cy=82, r=14, core=ELARION_CORE, glow=ELARION_GLOW)

# ── 3. cartographic grid overlay (sparse, low opacity) ───────────────────────
grid_overlay = Image.new("RGBA", (W, H), (0,0,0,0))
gd = ImageDraw.Draw(grid_overlay)
GRID_ALPHA = 10
for gx in range(0, W, 40):
    gd.line([(gx, 0), (gx, sky_h)], fill=(80, 100, 180, GRID_ALPHA))
for gy in range(0, sky_h, 40):
    gd.line([(0, gy), (W, gy)], fill=(80, 100, 180, GRID_ALPHA))
# tick marks on edges
for gy in range(0, sky_h, 20):
    gd.line([(0, gy), (4, gy)], fill=(GOLD[0], GOLD[1], GOLD[2], 25))
    gd.line([(W-4, gy), (W, gy)], fill=(GOLD[0], GOLD[1], GOLD[2], 25))
img.alpha_composite(grid_overlay)

# ── 4. mountain ridge silhouette ─────────────────────────────────────────────
ridge_y   = 440   # peak area
ridge_pts = []
# build a jagged ridge from left to right
xs = list(range(0, W+1, 8))
for i, x in enumerate(xs):
    if x < 40 or x > W-40:
        y = ridge_y + 80
    else:
        # major peaks
        base = ridge_y + 60
        noise = rng.randint(-30, 30)
        # create two main peaks
        if 80 < x < 130:
            peak_t = 1 - abs(x-105)/30
            base = ridge_y + int(20 - 60*max(0, peak_t))
        elif 180 < x < 250:
            peak_t = 1 - abs(x-215)/40
            base = ridge_y + int(10 - 80*max(0, peak_t))
        y = base + noise
    ridge_pts.append((x, y))

# fill below ridge to sky_h
fill_pts = [(0, sky_h)] + ridge_pts + [(W, sky_h)]
draw.polygon(fill_pts, fill=ROCK_DARK)

# add rock texture lines along ridge
for x, y in ridge_pts[2:-2]:
    if rng.random() < 0.3:
        draw.line([(x, y), (x+rng.randint(-6,6), y+rng.randint(15,40))],
                  fill=(*ROCK_MID, 80), width=1)

# ── 5. ground fill (bottom section) ──────────────────────────────────────────
for y in range(sky_h, H):
    t = (y - sky_h) / (H - sky_h)
    c = lerp_color(ROCK_DARK, GROUND, t)
    draw.line([(0, y), (W, y)], fill=c)

# ── 6. ruins architecture ─────────────────────────────────────────────────────
ruin_base = 900   # where ruins sit on ground

def draw_stone_block(x, y, w, h, shade=0):
    col = lerp_color(ROCK_DARK, ROCK_MID, 0.4 + shade*0.3)
    draw.rectangle([x, y, x+w, y+h], fill=col)
    # mortar lines
    for cy in range(y+12, y+h, 14):
        draw.line([(x+1, cy), (x+w-1, cy)], fill=(*ROCK_DARK, 120), width=1)
    # crack
    if rng.random() < 0.4:
        cx1 = rng.randint(x+2, x+w-2)
        draw.line([(cx1, y+3), (cx1+rng.randint(-3,3), y+h-3)],
                  fill=(*ROCK_DARK, 100), width=1)
    # edge highlight
    draw.line([(x, y), (x+w, y)], fill=(*ROCK_LIGHT, 60), width=1)

def draw_broken_tower(bx, by, tower_w, tower_h, lean=0):
    """Draw a crumbling tower section."""
    # base section
    draw_stone_block(bx, by, tower_w, tower_h, shade=0.2)
    # crenellations (partial)
    cren_w = tower_w // 4
    for i in range(4):
        if rng.random() < 0.6:
            cx = bx + i * cren_w
            ch = rng.randint(8, 18)
            draw_stone_block(cx, by - ch, cren_w - 2, ch, shade=0.3)
    # broken top edge — irregular
    for px in range(bx, bx+tower_w, 3):
        drop = rng.randint(0, 6)
        draw.rectangle([px, by-drop, px+2, by], fill=ROCK_DARK)

def draw_arch(cx, base_y, span, height, thickness=8):
    """Draw a broken stone arch."""
    # left pillar
    draw_stone_block(cx - span//2 - thickness, base_y - height - 40,
                     thickness, height + 40, shade=0.1)
    # right pillar
    draw_stone_block(cx + span//2, base_y - height - 40,
                     thickness, height + 40, shade=0.1)
    # arch curve (approximate with polygon)
    arch_pts = []
    steps = 24
    for i in range(steps+1):
        angle = math.pi * i / steps
        ax = cx + (span//2 + thickness//2) * math.cos(math.pi - angle)
        ay = base_y - height - int((span//2) * math.sin(angle) * 0.85)
        arch_pts.append((ax, ay))
    # outer arch
    outer = []
    for i in range(steps+1):
        angle = math.pi * i / steps
        ax = cx + (span//2 + thickness + 4) * math.cos(math.pi - angle)
        ay = base_y - height - 8 - int((span//2 + 4) * math.sin(angle) * 0.85)
        outer.append((ax, ay))
    combined = arch_pts + list(reversed(outer))
    draw.polygon(combined, fill=ROCK_MID)
    # keystone missing — broken gap at top
    ks_x = cx - 6
    ks_y = base_y - height - int(span//2 * 0.85) - 12
    draw.rectangle([ks_x, ks_y, ks_x+12, ks_y+18], fill=ROCK_DARK)

# ── left broken tower ─────────────────────────────────────────────────────────
draw_broken_tower(bx=8, by=ruin_base-180, tower_w=48, tower_h=180)
# extra rubble at base
for _ in range(8):
    rx = rng.randint(8, 60)
    ry = rng.randint(ruin_base-20, ruin_base+20)
    rw = rng.randint(6, 18); rh = rng.randint(4, 12)
    draw_stone_block(rx, ry, rw, rh, shade=rng.random())

# ── central broken arch ────────────────────────────────────────────────────────
draw_arch(cx=160, base_y=ruin_base-20, span=80, height=100, thickness=10)

# ── right taller intact tower ─────────────────────────────────────────────────
draw_broken_tower(bx=252, by=ruin_base-240, tower_w=56, tower_h=240)

# ── standing megaliths ─────────────────────────────────────────────────────────
megalith_data = [
    (82, ruin_base-110, 16, 110),
    (104, ruin_base-140, 18, 140),
    (196, ruin_base-95, 14, 95),
    (220, ruin_base-120, 16, 120),
]
for mx, my, mw, mh in megalith_data:
    draw_stone_block(mx, my, mw, mh, shade=0.15)
    # capstone suggestion on taller ones
    if mh > 120:
        draw_stone_block(mx-3, my-8, mw+6, 10, shade=0.35)

# ── rubble field across ground ─────────────────────────────────────────────────
for _ in range(35):
    rx = rng.randint(0, W-20)
    ry = rng.randint(ruin_base, H-20)
    rw = rng.randint(4, 22); rh = rng.randint(3, 10)
    draw_stone_block(rx, ry, rw, rh, shade=rng.random()*0.5)

# ── 7. Celestium crystal clusters ─────────────────────────────────────────────
def draw_crystal(cx, cy, length, angle_deg, width_ratio=0.18, alpha_mult=1.0):
    """Draw a single hexagonal crystal shard."""
    angle = math.radians(angle_deg)
    perp  = angle + math.pi/2
    half_w = length * width_ratio

    tip  = (cx + length * math.sin(angle), cy - length * math.cos(angle))
    base_l = (cx + half_w * math.sin(perp), cy - half_w * math.cos(perp))
    base_r = (cx - half_w * math.sin(perp), cy + half_w * math.cos(perp))
    mid_l = ((tip[0]+base_l[0])/2, (tip[1]+base_l[1])/2)
    mid_r = ((tip[0]+base_r[0])/2, (tip[1]+base_r[1])/2)

    crystal_overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    cd = ImageDraw.Draw(crystal_overlay)

    # glow halo
    for gi in range(5, 0, -1):
        gr = int(half_w * (1 + gi * 0.8))
        ga = int(12 * gi * alpha_mult)
        cd.ellipse([cx-gr, cy-gr, cx+gr, cy+gr], fill=(*CELES_DIM, ga))

    # face 1 (bright)
    cd.polygon([tip, base_l, mid_l], fill=(*CELES_LIGHT, int(200*alpha_mult)))
    # face 2 (dim)
    cd.polygon([tip, base_r, mid_r], fill=(*CELES_PINK, int(160*alpha_mult)))
    # base facets
    cd.polygon([base_l, base_r, mid_r, mid_l], fill=(*CELES_DIM, int(220*alpha_mult)))
    # edge highlight
    cd.line([tip, base_l], fill=(*CELES_LIGHT, int(180*alpha_mult)), width=1)

    img.alpha_composite(crystal_overlay)

def draw_cluster(ox, oy, count=5, scale=1.0):
    angles = [rng.randint(-25, 25) + i*(360//count) for i in range(count)]
    for ang in angles:
        length = int((rng.randint(20, 55)) * scale)
        draw_crystal(
            ox + rng.randint(-8, 8),
            oy + rng.randint(-6, 6),
            length, ang, alpha_mult=rng.uniform(0.6, 1.0)
        )
    # ground bloom
    bloom = Image.new("RGBA", (W, H), (0,0,0,0))
    bd = ImageDraw.Draw(bloom)
    for ri in range(30, 0, -4):
        ba = int(5 * (30-ri)/30 * scale)
        bd.ellipse([ox-ri, oy-ri//3, ox+ri, oy+ri//3], fill=(*CELES_DIM, ba))
    img.alpha_composite(bloom)

# three clusters at different depths
draw_cluster(ox=60,  oy=ruin_base-30, count=6, scale=0.7)
draw_cluster(ox=155, oy=ruin_base+10, count=8, scale=1.0)
draw_cluster(ox=280, oy=ruin_base-60, count=5, scale=0.85)

# ── 8. ground mist / atmospheric haze ─────────────────────────────────────────
mist_overlay = Image.new("RGBA", (W, H), (0,0,0,0))
md = ImageDraw.Draw(mist_overlay)
mist_y = sky_h - 60
for mi in range(8):
    mh_line = rng.randint(12, 30)
    my_off  = rng.randint(-20, 20)
    alpha   = rng.randint(18, 50)
    col     = lerp_color((20, 28, 70), (10, 20, 50), rng.random())
    md.rectangle([0, mist_y + my_off, W, mist_y + my_off + mh_line],
                 fill=(*col, alpha))
img.alpha_composite(mist_overlay.filter(ImageFilter.GaussianBlur(12)))

# horizon line indicator
draw.line([(0, sky_h-2), (W, sky_h-2)], fill=(*GOLD_DIM, 50), width=1)

# ── 9. measurement / cartographic notation ────────────────────────────────────
# left margin tick marks at regular intervals
tick_overlay = Image.new("RGBA", (W, H), (0,0,0,0))
td = ImageDraw.Draw(tick_overlay)

for ty in range(0, H, 30):
    major = (ty % 120 == 0)
    tick_len = 8 if major else 4
    alpha    = 50 if major else 25
    td.line([(0, ty), (tick_len, ty)], fill=(*GOLD, alpha))
    td.line([(W-tick_len, ty), (W, ty)], fill=(*GOLD, alpha))

# degree-style notations (very small, sparse)
try:
    tiny_font = ImageFont.truetype(str(FONTS / "DMMono-Regular.ttf"), 7)
    for ty in range(0, H, 120):
        deg = 90 - int(ty / H * 90)
        td.text((5, ty+2), f"{deg:02d}°", font=tiny_font, fill=(*GOLD, 40))
except:
    pass

img.alpha_composite(tick_overlay)

# ── 10. Celestium moon-reflection shimmer on ground ───────────────────────────
for _ in range(40):
    sx = rng.randint(20, W-20)
    sy = rng.randint(ruin_base+20, H-10)
    sl = rng.randint(4, 18)
    sa = rng.randint(8, 35)
    shimmer_ov = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(shimmer_ov)
    sd.line([(sx, sy), (sx+sl, sy+rng.randint(-2,2))],
            fill=(*CELES_DIM, sa), width=1)
    img.alpha_composite(shimmer_ov)

# ── 11. typography ────────────────────────────────────────────────────────────
text_overlay = Image.new("RGBA", (W, H), (0,0,0,0))
txd = ImageDraw.Draw(text_overlay)

# "TEVETHARA" — Italiana, large, centred, at sky/ruin boundary
try:
    title_font = ImageFont.truetype(str(FONTS / "Italiana-Regular.ttf"), 38)
except:
    title_font = ImageFont.load_default()

title_text = "TEVETHARA"
try:
    bbox = txd.textbbox((0,0), title_text, font=title_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
except:
    tw, th = 200, 40

tx = (W - tw) // 2
ty_pos = sky_h - 72   # just above the ridge

# flanking horizontal rules
rule_alpha = 80
rule_gap   = 10
txd.line([(8, ty_pos + th//2), (tx - rule_gap, ty_pos + th//2)],
          fill=(*GOLD, rule_alpha), width=1)
txd.line([(tx + tw + rule_gap, ty_pos + th//2), (W-8, ty_pos + th//2)],
          fill=(*GOLD, rule_alpha), width=1)
# rule ornament dots
txd.ellipse([tx - rule_gap - 3, ty_pos + th//2 - 2,
             tx - rule_gap + 1, ty_pos + th//2 + 2], fill=(*GOLD, rule_alpha))
txd.ellipse([tx + tw + rule_gap - 1, ty_pos + th//2 - 2,
             tx + tw + rule_gap + 3, ty_pos + th//2 + 2], fill=(*GOLD, rule_alpha))

# text with slight glow
for goff in [(0, 1), (1, 0), (-1, 0), (0, -1)]:
    txd.text((tx + goff[0], ty_pos + goff[1]), title_text,
             font=title_font, fill=(*CELES_DIM, 60))
txd.text((tx, ty_pos), title_text, font=title_font, fill=(*GOLD, 220))

# "mudmap" — DMMono, tiny, bottom-right
try:
    small_font = ImageFont.truetype(str(FONTS / "DMMono-Regular.ttf"), 10)
except:
    small_font = ImageFont.load_default()

mm_text = "mudmap"
try:
    mm_bbox = txd.textbbox((0,0), mm_text, font=small_font)
    mm_w = mm_bbox[2] - mm_bbox[0]
except:
    mm_w = 50

txd.text((W - mm_w - 10, H - 20), mm_text, font=small_font, fill=(*GOLD_DIM, 140))

img.alpha_composite(text_overlay)

# ── 12. Silthëa glow tint on upper clouds / mist ─────────────────────────────
moon_glow = Image.new("RGBA", (W, H), (0,0,0,0))
mgd = ImageDraw.Draw(moon_glow)
for ri in range(120, 0, -10):
    mgd.ellipse([258-ri, 55-ri//2, 258+ri, 55+ri//2],
                fill=(40, 80, 180, max(1, 3-ri//60)))
img.alpha_composite(moon_glow.filter(ImageFilter.GaussianBlur(30)))

# ── 13. final vignette ────────────────────────────────────────────────────────
vignette = Image.new("RGBA", (W, H), (0,0,0,0))
vd = ImageDraw.Draw(vignette)
for vi in range(60):
    a = int(vi * 1.4)
    vd.rectangle([vi, vi, W-vi, H-vi], outline=(0, 0, 0, a))
img.alpha_composite(vignette)

# ── convert to RGB and save ───────────────────────────────────────────────────
final = Image.new("RGB", (W, H), (0, 0, 0))
final.paste(img, mask=img.split()[3])
final.save(str(OUT), "PNG", optimize=True)
print(f"Saved {OUT}  ({W}x{H})")
