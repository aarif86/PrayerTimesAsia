#!/usr/bin/env python3
"""Turn raw app screenshots into captioned store images.

  python3 tools/store_frames.py iphone RAW_DIR OUT_DIR   # App Store 6.9" (1320x2868)
  python3 tools/store_frames.py ipad   RAW_DIR OUT_DIR   # App Store 13"  (2064x2752)
  python3 tools/store_frames.py play   RAW_DIR OUT_DIR   # Google Play phone (1080x1920)
  python3 tools/store_frames.py feature - OUT_DIR        # Play feature graphic (1024x500)

Raw iPhone/iPad shots come from the store-screenshots-raw branch (workflow
"Store screenshots"); Android ones from the screenshots-android branch.
Captions match docs/app-store.md and docs/play-store.md. Needs Pillow.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "android/app/src/main/res/font/nunito_extrabold.ttf")
FONT_SUB = os.path.join(ROOT, "android/app/src/main/res/font/nunito_semibold.ttf")
ICON = os.path.join(ROOT, "ios/PrayerTimesAsia/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png")

NIGHT_TOP, NIGHT_BOTTOM = (11, 15, 42), (34, 30, 74)
GOLD, TEXT = (242, 192, 99), (238, 240, 250)

APPLE = [  # (raw file suffix, caption)
    ("1-today", "Know when to pray, wherever you land"),
    ("2-landed", "Switches the moment you arrive"),
    ("3-journey", "Jamak & qasar, worked out for you"),
    ("4-qibla", "Face the Kaaba in one glance"),
    ("5-masjid", "Find a masjid or musollah nearby"),
    ("6-falak", "Qibla Day and the shadow stick"),
    ("7-today-day", "A sky that follows the sun"),
]
PLAY = [
    ("02-today-centre-night.png", "Know when to pray, wherever you land"),
    ("06-today-travel-hanoi.png", "Switches the moment you arrive"),
    ("11-journey.png", "Jamak & qasar, worked out for you"),
    ("07b-qibla-aligned.png", "Face the Kaaba in one glance"),
    ("13b-your-masjid-jamaah-countdown.png", "Find your masjid, see its iqamah"),
    ("05-today-bands-night.png", "Five looks for your Prayer screen"),
]
SIZES = {"iphone": (1320, 2868), "ipad": (2064, 2752), "play": (1080, 1920)}


def sky(w, h):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(NIGHT_TOP, NIGHT_BOTTOM)))
    return img


def wrap(draw, text, font, max_w):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def rounded(img, r):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], r, fill=255)
    out = Image.new("RGBA", img.size)
    out.paste(img, mask=mask)
    return out


def frame(raw_path, caption, size):
    w, h = size
    canvas = sky(w, h)
    d = ImageDraw.Draw(canvas)
    pad = round(w * 0.07)
    font = ImageFont.truetype(FONT, round(w * (0.072 if w < h * 0.7 else 0.05)))
    lines = wrap(d, caption, font, w - 2 * pad)
    line_h = round(font.size * 1.18)
    top = round(h * 0.05)
    for i, line in enumerate(lines):
        d.text((w / 2, top + i * line_h), line, font=font, fill=GOLD if i == 0 else TEXT, anchor="ma")
    text_bottom = top + len(lines) * line_h + round(h * 0.03)

    shot = Image.open(raw_path).convert("RGB")
    avail_w, avail_h = w - 2 * pad, h - text_bottom - round(h * 0.03)
    scale = min(avail_w / shot.width, avail_h / shot.height)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)
    r = round(shot.width * 0.06)
    x, y = (w - shot.width) // 2, text_bottom

    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([x - 6, y - 6, x + shot.width + 6, y + shot.height + 6], r + 6,
                                           fill=(242, 192, 99, 90))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(18)))
    canvas.alpha_composite(rounded(shot, r), (x, y))
    return canvas.convert("RGB")


def feature(out_dir):
    w, h = 1024, 500
    canvas = sky(w, h).convert("RGBA")
    icon = Image.open(ICON).convert("RGB").resize((300, 300), Image.LANCZOS)
    canvas.alpha_composite(rounded(icon, 66), (70, 100))
    d = ImageDraw.Draw(canvas)
    d.text((420, 150), "Prayer Times Asia", font=ImageFont.truetype(FONT, 64), fill=TEXT)
    sub = ImageFont.truetype(FONT_SUB, 34)
    d.text((422, 245), "Prayer times & qibla,", font=sub, fill=GOLD)
    d.text((422, 290), "wherever you land in Asia", font=sub, fill=GOLD)
    d.text((422, 360), "Official MUIS & JAKIM · offline · no ads", font=ImageFont.truetype(FONT_SUB, 24), fill=(169, 178, 214))
    canvas.convert("RGB").save(os.path.join(out_dir, "feature-graphic.png"))
    Image.open(ICON).convert("RGB").resize((512, 512), Image.LANCZOS).save(os.path.join(out_dir, "icon-512.png"))


def main():
    kind, raw_dir, out_dir = sys.argv[1:4]
    os.makedirs(out_dir, exist_ok=True)
    if kind == "feature":
        return feature(out_dir)
    items = PLAY if kind == "play" else [(f"{kind}-{name}.png", cap) for name, cap in APPLE]
    for n, (name, caption) in enumerate(items, 1):
        src = os.path.join(raw_dir, name)
        if not os.path.exists(src):
            print(f"skip (missing): {name}")
            continue
        dest = os.path.join(out_dir, f"{'phone' if kind == 'play' else kind}-{n}.png")
        frame(src, caption, SIZES[kind]).save(dest)
        print(dest)


if __name__ == "__main__":
    main()
