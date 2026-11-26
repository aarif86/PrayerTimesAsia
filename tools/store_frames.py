#!/usr/bin/env python3
"""Turn raw app screenshots into captioned store images.

  python3 tools/store_frames.py iphone RAW_DIR design/store/app-store   # App Store 6.9" (1320x2868)
  python3 tools/store_frames.py ipad   RAW_DIR design/store/app-store   # App Store 13"  (2064x2752)
  python3 tools/store_frames.py play   RAW_DIR design/store/play        # Google Play phone (1080x2160)
  python3 tools/store_frames.py feature - design/store/play             # Play feature graphic (1024x500)

Each run writes an en/, ms/ and id/ folder (one per listing language).

Raw iPhone/iPad shots come from the store-screenshots-raw branch (workflow
"Store screenshots"); Android ones from the screenshots-android branch.
Captions match docs/store-listings. Needs Pillow.
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

# Captions in English, Malay and Indonesian. Same wording as docs/store-listings.
# Each row is (iPhone/iPad raw suffix, Android raw file, {lang: caption}).
# A shot with None for a platform is left out on that platform.
SHOTS = [
    ("1-today", "02-today-centre-night.png",
     {"en": "Know when to pray, wherever you land",
      "ms": "Tahu waktu solat, di mana sahaja anda berada",
      "id": "Tahu waktu sholat, di mana pun Anda berada"}),
    ("2-landed", "06-today-travel-hanoi.png",
     {"en": "Your times switch the moment you arrive",
      "ms": "Waktu solat bertukar sebaik sahaja anda tiba",
      "id": "Jadwal berganti begitu Anda tiba"}),
    ("3-journey", "11-journey.png",
     {"en": "Jamak and qasar, worked out for you",
      "ms": "Jamak dan qasar, dikira untuk anda",
      "id": "Jamak dan qashar, dihitung untuk Anda"}),
    ("4-qibla", "07b-qibla-aligned.png",
     {"en": "Face the Kaaba in one glance",
      "ms": "Hadap Kaabah dengan sekali pandang",
      "id": "Menghadap Ka'bah dengan sekali lihat"}),
    ("5-ramadan", "14-ramadan-berbuka.png",
     {"en": "Imsak and Berbuka, counted down for you",
      "ms": "Kiraan detik ke imsak dan berbuka",
      "id": "Hitung mundur menuju imsak dan buka puasa"}),
    ("6-wakeup", "10c-wake-up.png",
     {"en": "Never miss Subuh again",
      "ms": "Jangan terlepas Subuh lagi",
      "id": "Jangan sampai terlewat Subuh lagi"}),
    ("7-masjid", "13b-your-masjid-jamaah-countdown.png",
     {"en": "Your masjid's jamaah times, right here",
      "ms": "Waktu jemaah masjid anda, di sini",
      "id": "Jadwal jamaah masjid Anda, di sini"}),
    ("8-looks", "03-today-dial-night.png",
     {"en": "Five looks for your Prayer screen",
      "ms": "Lima gaya paparan waktu solat",
      "id": "Lima tampilan layar sholat"}),
    (None, "12-widget-list.png",
     {"en": "Your times on the home screen",
      "ms": "Waktu solat di skrin utama",
      "id": "Jadwal sholat di layar utama"}),
]
LANGS = ("en", "ms", "id")
FEATURE = {  # Play feature graphic: line 1, line 2, small line
    "en": ("Prayer times & qibla,", "wherever you land", "Asia first, works worldwide. No outside ads."),
    "ms": ("Waktu solat & kiblat,", "di mana sahaja anda berada", "Bermula di Asia, untuk seluruh dunia. Tiada iklan luar."),
    "id": ("Jadwal sholat & kiblat,", "di mana pun Anda berada", "Berawal dari Asia, untuk seluruh dunia. Tanpa iklan luar."),
}
SIZES = {"iphone": (1320, 2868), "ipad": (2064, 2752), "play": (1080, 2160)}


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


def feature(out_dir, lang="en"):
    w, h = 1024, 500
    canvas = sky(w, h).convert("RGBA")
    icon = Image.open(ICON).convert("RGB").resize((300, 300), Image.LANCZOS)
    canvas.alpha_composite(rounded(icon, 66), (70, 100))
    d = ImageDraw.Draw(canvas)
    d.text((420, 150), "Prayer Times Asia", font=ImageFont.truetype(FONT, 64), fill=TEXT)
    line1, line2, small = FEATURE[lang]
    sub = ImageFont.truetype(FONT_SUB, 34)
    d.text((422, 245), line1, font=sub, fill=GOLD)
    d.text((422, 290), line2, font=sub, fill=GOLD)
    d.text((422, 360), small, font=ImageFont.truetype(FONT_SUB, 22), fill=(169, 178, 214))
    canvas.convert("RGB").save(os.path.join(out_dir, "feature-graphic.png"))
    Image.open(ICON).convert("RGB").resize((512, 512), Image.LANCZOS).save(os.path.join(out_dir, "icon-512.png"))


def main():
    kind, raw_dir, out_root = sys.argv[1:4]
    for lang in LANGS:
        out_dir = os.path.join(out_root, lang)
        os.makedirs(out_dir, exist_ok=True)
        if kind == "feature":
            feature(out_dir, lang)
            continue
        n = 0
        for apple, android, captions in SHOTS:
            name = android if kind == "play" else apple and f"{kind}-{apple}.png"
            if not name or n == 8:  # Play takes at most 8 phone screenshots
                continue
            src = os.path.join(raw_dir, name)
            if not os.path.exists(src):
                print(f"skip (missing): {name}")
                continue
            n += 1
            dest = os.path.join(out_dir, f"{'phone' if kind == 'play' else kind}-{n}.png")
            frame(src, captions[lang], SIZES[kind]).save(dest)
            print(dest)


if __name__ == "__main__":
    main()
