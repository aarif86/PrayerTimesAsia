# App icon

`app-icon.svg` is the source of the app icon: a watch with a compass bezel
(N/E/S/W and the gold qibla arrow at 293°), the Kaabah at the centre and
Omega Seamaster-style skeleton sword hands. Since November 2026 the navy compass
ring carries a faint fine-line kawung batik pattern with cream hand-stitching
along both edges (the version before that is kept as `icon-before-batik.svg`).

To update the icon, edit the SVG and export every size in one go
(iPhone, Android, web app and promo site) from the repo root:

    pip install cairosvg pillow
    python3 design/logo/export-icons.py

(App Store icons must have no transparency, so the iPhone icon is saved as RGB.)
The other `icon-*.svg` files are the explored options, kept for reference.
