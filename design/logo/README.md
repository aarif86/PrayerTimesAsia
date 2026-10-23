# App icon

`app-icon.svg` is the source of the app icon: a watch with a compass bezel
(N/E/S/W and the gold qibla arrow at 293°), the Kaabah at the centre and
Omega Seamaster-style skeleton sword hands. To update the icon, edit the SVG and run:

    python3 -c "import cairosvg; from PIL import Image; \
    cairosvg.svg2png(url='design/logo/app-icon.svg', write_to='/tmp/i.png', output_width=1024, output_height=1024); \
    Image.open('/tmp/i.png').convert('RGB').save('PrayerTimesAsia/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png')"

(App Store icons must have no transparency, hence the RGB conversion.)
The other `icon-*.svg` files are the explored options, kept for reference.
