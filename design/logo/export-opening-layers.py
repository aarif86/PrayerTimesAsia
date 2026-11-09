"""Split the opening screen dial (web/public/icons/dial.svg) into the layers the moving
opening screen animates: the compass ring, its kawung batik, the two stitch rings, the
ring's letters and ticks, the clock face, the Kaabah, the two hands (drawn pointing at 12)
and the hub.

Run from the repo root after export-icons.py:  python3 design/logo/export-opening-layers.py
(needs: pip install cairosvg pillow)

Writes
  web/index.html                      the layered SVG between the dial-layers markers
  iPhone  Assets.xcassets/Opening*.imageset   one 180 pt picture per layer
  Android drawable-nodpi/opening_*.png        one 540 px picture per layer
Every picture is the whole 848 unit dial box, so each layer turns about its own middle.
"""
import io, os, re
import cairosvg
from PIL import Image

src = open("web/public/icons/dial.svg").read()
head, body = src.split("\n", 1)
body = body.rsplit("</svg>", 1)[0]
defs = re.search(r"<defs>.*?</defs>", body, re.S).group(0)
lines = body.split("\n")


def find(prefix):
    for i, l in enumerate(lines):
        if l.startswith(prefix):
            return i
    raise SystemExit(f"dial.svg changed: no line starting {prefix!r}")


cream = lines[find('<circle cx="512" cy="512" r="424"')]
ring_line = lines[find('<circle cx="512" cy="512" r="410"')]
ring_base, rest = ring_line.split("<path", 1)
batik, stitch = ("<path" + rest).split("<g opacity", 1)
stitch = "<g opacity" + stitch
outer, inner = re.findall(r'<circle cx="512" cy="512" r="(?:403|335)"[^>]*/>', stitch)
stitch_open = re.match(r'<g opacity="[^"]*">', stitch).group(0)
marks_from = find("<text")
face_from = find('<circle cx="512" cy="512" r="328"')
kaabah_from = find("<g>")
kaabah_to = lines.index("</g>", kaabah_from)
hands = "\n".join(lines[kaabah_to + 1:])
hand_groups = re.findall(r'<g transform="rotate\([^)]*\)">(.*?)</g>', hands, re.S)
hour, minute = hand_groups  # drawn short (hour) first, then long (minute)
hub = re.search(r'<circle cx="512" cy="512" r="36".*?/>.*?/>', hands).group(0)

LAYERS = {
    "ring": cream + ring_base,
    "batik": batik,
    "stitch-outer": stitch_open + outer + "</g>",
    "stitch-inner": stitch_open + inner + "</g>",
    "marks": "\n".join(lines[marks_from:face_from]),
    "face": "\n".join(lines[face_from:kaabah_from]),
    "kaabah": "\n".join(lines[kaabah_from:kaabah_to + 1]),
    "hour": hour,
    "minute": minute,
    "hub": hub,
}

# Web: one inline SVG, a <g> per layer, placed in index.html so it shows before any script.
# The ring and everything on it sit in one more group (l-ring-all) so they can turn together.
RING = ("ring", "batik", "stitch-outer", "stitch-inner", "marks")
g = lambda k: f'<g class="l-{k}">{LAYERS[k]}</g>'
groups = '<g class="l-ring-all">' + "".join(g(k) for k in RING) + "</g>" + "".join(g(k) for k in LAYERS if k not in RING)
svg = f'<svg class="dial" xmlns="http://www.w3.org/2000/svg" viewBox="88 88 848 848" aria-hidden="true">{defs}{groups}</svg>'
svg = re.sub(r">\s+<", "><", svg)
html = open("web/index.html").read()
html = re.sub(r"(<!-- dial-layers:start -->).*?(<!-- dial-layers:end -->)", lambda m: m.group(1) + svg + m.group(2), html, flags=re.S)
open("web/index.html", "w").write(html)
print("web/index.html", len(svg), "bytes of dial")


def render(inner, size):
    text = f'<svg xmlns="http://www.w3.org/2000/svg" width="848" height="848" viewBox="88 88 848 848">{defs}{inner}</svg>'
    png = cairosvg.svg2png(bytestring=text.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


for key, inner in LAYERS.items():
    name = "Opening" + "".join(w.capitalize() for w in key.split("-"))
    d = f"ios/PrayerTimesAsia/Resources/Assets.xcassets/{name}.imageset"
    os.makedirs(d, exist_ok=True)
    for s in (2, 3):
        render(inner, 180 * s).save(f"{d}/{key}@{s}x.png", optimize=True)
    with open(f"{d}/Contents.json", "w") as f:
        f.write('{\n  "images" : [\n'
                + ",\n".join(f'    {{ "filename" : "{key}@{s}x.png", "idiom" : "universal", "scale" : "{s}x" }}' for s in (2, 3))
                + '\n  ],\n  "info" : { "author" : "xcode", "version" : 1 }\n}\n')
    out = f"android/app/src/main/res/drawable-nodpi/opening_{key.replace('-', '_')}.png"
    render(inner, 540).save(out, optimize=True)
    print(name, out)
