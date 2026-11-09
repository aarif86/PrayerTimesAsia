"""Export every app icon size (iPhone, Android, web, promo site) from design/logo/app-icon.svg.

Run from the repo root:  python3 design/logo/export-icons.py   (needs: pip install cairosvg pillow)
"""
import io, os, re
import cairosvg
from PIL import Image

SRC = "design/logo/app-icon.svg"
svg = open(SRC).read()
BG_RECTS = re.findall(r'<rect width="1024" height="1024"[^>]*/>', svg)
dial_only = svg
for r in BG_RECTS:
    dial_only = dial_only.replace(r, "", 1)
bg_only = svg[:svg.index(BG_RECTS[-1]) + len(BG_RECTS[-1])] + "</svg>"


def render(text, size):
    png = cairosvg.svg2png(bytestring=text.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    print(path, im.size)


full = render(svg, 1024)

# iPhone: App Store icons must have no transparency
save(full.convert("RGB"), "ios/PrayerTimesAsia/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png")
save(full.convert("RGB"), "site/press/prayer-times-asia-icon.png")  # press kit download

# Web app + promo site
for path, size in [("web/public/icons/icon-512.png", 512), ("web/public/icons/icon-192.png", 192),
                   ("web/public/icons/apple-touch-icon.png", 180), ("web/public/icons/favicon-32.png", 32),
                   ("site/img/icon-192.png", 192), ("site/img/apple-touch-icon.png", 180),
                   ("site/img/favicon-32.png", 32)]:
    save(full.resize((size, size), Image.LANCZOS), path)

# Maskable: whole icon inside the 80% safe zone on the edge colour
mask = Image.new("RGBA", (512, 512), (40, 39, 99, 255))
mask.alpha_composite(full.resize((410, 410), Image.LANCZOS), (51, 51))
save(mask, "web/public/icons/maskable-512.png")

# Notification badge: the dial, cropped close
save(full.crop((40, 40, 984, 984)).resize((96, 96), Image.LANCZOS), "web/public/icons/badge-96.png")

# Android: legacy icon + adaptive foreground (dial, 63% of the canvas) and background
for density, legacy, adaptive in [("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
                                  ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)]:
    adaptive = int(adaptive)
    d = f"android/app/src/main/res/mipmap-{density}"
    save(full.resize((legacy, legacy), Image.LANCZOS), f"{d}/ic_launcher.png")
    save(render(bg_only, adaptive).convert("RGB"), f"{d}/ic_launcher_background.png")
    dial = round(adaptive * 0.63 / (848 / 1024))
    fg = Image.new("RGBA", (adaptive, adaptive), (0, 0, 0, 0))
    fg.alpha_composite(render(dial_only, dial), ((adaptive - dial) // 2, (adaptive - dial) // 2))
    save(fg, f"{d}/ic_launcher_foreground.png")

# Opening screen: the dial alone (no square background), cropped to its white edge (r = 424).
dial_svg = re.sub(r"<metadata>.*?</metadata>", "", dial_only, flags=re.S)
dial_svg = dial_svg.replace('width="1024" height="1024" viewBox="0 0 1024 1024"', 'width="848" height="848" viewBox="88 88 848 848"', 1)
dial_svg = dial_svg.replace(' xmlns:c2pa="http://c2pa.org/manifest"', "")
with open("web/public/icons/dial.svg", "w") as f:
    f.write(dial_svg)
print("web/public/icons/dial.svg")
# The opening screen animates the dial in layers: run export-opening-layers.py next.
# (The iPhone launch screen and the Android 12 system splash are plain Night Navy, so the
# dial first appears as it starts to move.)

# The icon as a picture inside the app (the card at the top of Settings), 64 pt.
CARD = "ios/PrayerTimesAsia/Resources/Assets.xcassets/AppIconImage.imageset"
for scale in (1, 2, 3):
    save(full.resize((64 * scale, 64 * scale), Image.LANCZOS).convert("RGB"), f"{CARD}/app-icon@{scale}x.png")
with open(f"{CARD}/Contents.json", "w") as f:
    f.write('{\n  "images" : [\n'
            + ",\n".join(f'    {{ "filename" : "app-icon@{s}x.png", "idiom" : "universal", "scale" : "{s}x" }}' for s in (1, 2, 3))
            + '\n  ],\n  "info" : { "author" : "xcode", "version" : 1 }\n}\n')
save(full.resize((192, 192), Image.LANCZOS).convert("RGB"), "android/app/src/main/res/drawable-nodpi/app_icon_card.png")
