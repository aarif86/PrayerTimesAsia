"""Draws the Falak glyph (sun, upright stick, its shadow) as template images
for the tab bar and the Falak header. Run: python3 tools/gen_falak_icon.py"""
import json, math, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', 'PrayerTimesAsia', 'Resources', 'Assets.xcassets')

def glyph(px):
    S = px * 8  # draw big, scale down for smooth edges
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S / 100
    black = (0, 0, 0, 255)
    # Sun, upper left, with eight short rays.
    cx, cy, r = 23 * k, 25 * k, 10 * k
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=black)
    for i in range(8):
        a = i * math.pi / 4
        d.line([cx + math.cos(a) * 14.5 * k, cy + math.sin(a) * 14.5 * k,
                cx + math.cos(a) * 20 * k, cy + math.sin(a) * 20 * k], fill=black, width=int(5 * k))
    # Ground.
    d.rounded_rectangle([6 * k, 91 * k, 94 * k, 95 * k], radius=2 * k, fill=black)
    # Upright stick with a round top.
    d.rounded_rectangle([56 * k, 34 * k, 63 * k, 88 * k], radius=3.5 * k, fill=black)
    d.ellipse([54 * k, 30 * k, 65 * k, 41 * k], fill=black)
    # The shadow, away from the sun: a tapered wedge along the ground.
    d.polygon([(59 * k, 79 * k), (96 * k, 83 * k), (96 * k, 86.5 * k), (59 * k, 88 * k)], fill=black)
    return im.resize((px, px), Image.LANCZOS)

def imageset(name, pt):
    folder = os.path.join(ROOT, f'{name}.imageset')
    os.makedirs(folder, exist_ok=True)
    images = []
    for scale in (2, 3):
        fn = f'{name}@{scale}x.png'
        glyph(pt * scale).save(os.path.join(folder, fn))
        images.append({'idiom': 'universal', 'filename': fn, 'scale': f'{scale}x'})
    json.dump({'images': images, 'info': {'author': 'xcode', 'version': 1},
               'properties': {'template-rendering-intent': 'template'}},
              open(os.path.join(folder, 'Contents.json'), 'w'), indent=2)

imageset('FalakTab', 25)
imageset('FalakGlyph', 64)
