# Design a new look for the app or the masjid screen

Anyone can suggest the next look, and you do **not** need to code. There are two places a look can go:

- **The app's Prayer screen** (iPhone, Android and [web](https://aarif86.github.io/PrayerTimesAsia/app/)). It has five
  styles today: Centre Dial, Side Dial, Day Dial, Sun Path and Colour Bands, each in light and dark.
  Change them in **Settings → Prayer screen**, or touch and hold the style button on the Prayer screen.
- **The masjid TV screen** ([try it](https://aarif86.github.io/PrayerTimesAsia/app/screen/#setup)). It has six looks today:
  Night, Day, Board, Bands, Day Dial and Sun Path.

A whole new style, or a colour theme for an existing one (for example "Ramadan night", "Kampung green"), is welcome for either.

There are three ways, from easiest to most hands-on. Pick whichever suits you.

| | Way | You need | Takes |
|---|---|---|---|
| 1 | Send a picture or idea | A sketch, a screenshot from Canva/Figma, or just words | 10 minutes |
| 2 | Ask an AI to make a mock-up, then send it | ChatGPT, Claude or Gemini (free versions work) | 30 minutes |
| 3 | Build it in the code and open a pull request | Some web coding (CSS) | An evening |

However you make it, the design ends up in the same place: the
[**New look** form](https://github.com/aarif86/PrayerTimesAsia/issues/new?template=new-look.yml) on GitHub
(a free GitHub account is needed). No account? Email the pictures to
[salam@prayertimes.asia](mailto:salam@prayertimes.asia) with "New look" in the subject.

## What a masjid screen look must show

A look changes colours, shapes, fonts and layout. It keeps the same information, because masjid committees rely on it:

- Masjid name, and today's date in both calendars (e.g. *Tuesday 27 October 2026* and *16 Jumada al-Ula 1448*)
- The six times: **Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak** (Imsak is added in Ramadan), with the iqamah time under each
  (or Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha in English; the masjid chooses)
- The **next prayer** and a big countdown to it (e.g. "Asar in 41m"), with the coming prayer clearly highlighted
- A line for **notices** (e.g. "Kuliah Maghrib every Tuesday")
- Small footer with where the times come from (e.g. "MUIS") and *prayertimes.asia*

And it has to work in four moments:

1. **Waiting**: the normal view, counting down to the next azan.
2. **Azan**: the prayer name large, then a countdown to iqamah.
3. **In prayer**: the screen goes almost dark, showing just the prayer name, "In prayer" and the clock.
4. **Friday**: Zohor becomes Jumu'ah, with "Khutbah" instead of "Iqamah".

## What an app look must show

The Prayer screen is what people open five times a day, so it has to answer "how long until the next prayer?" at a glance:

- The place (e.g. *Pasir Ris, Singapore*), today's date and Hijri date
- The **next prayer** and a countdown to it, clearly the biggest thing on the screen
- All six times, with the current or next one highlighted
- A small badge showing where the times come from (e.g. "A · MUIS")
- The bottom tab bar (Prayer, Qibla, Falak, Masjid, Settings) stays as it is

It must work in **light and dark** (the app follows the sky by default: light by day, dark at night),
on small and large phones, and with bigger text turned on.

## What makes a good look

- **Readable from the back of the hall.** Big numbers, strong contrast, no thin grey text on busy backgrounds.
- **Calm.** Nothing flashing or moving fast. Jemaah should not be distracted.
- **Fits the device.** For the masjid screen, design for a landscape TV (16:9); a portrait (standing) TV version is a bonus.
  For the app, design for a phone held upright.
- **Respectful.** No pictures of people or animals, no music symbols, no adverts, no logos you don't own.
  Islamic geometric patterns, calligraphy-style ornaments, architecture and nature are all welcome.
- **Your own.** Only use fonts, photos and patterns that you made or that are free to share
  (e.g. Google Fonts, or patterns you drew).

It helps to look at the current looks first: [app styles](../web/docs/screenshots) (files 01 to 13) and
[masjid screen looks](../web/docs/screenshots/screen).

---

## Way 1: Send a picture or idea

1. Sketch it on paper, or make it in Canva, Figma, PowerPoint, anything. A rough sketch is fine.
2. Take a photo or screenshot.
3. Open the [**New look** form](https://github.com/aarif86/PrayerTimesAsia/issues/new?template=new-look.yml),
   give it a name, drag the picture in and describe the feeling in a sentence. Press **Submit**.

## Way 2: Ask an AI to make a mock-up

An AI chat can turn your idea into a working web page you can open on any computer or TV browser. You don't need to understand the code.

1. Open ChatGPT, Claude or Gemini.
2. Copy the prompt for the app or for the masjid screen below, and change the line that starts with **My idea**. If you have a sketch or a photo
   for inspiration (tiles, a masjid's colours), attach it too.
3. The AI gives you an HTML file (or a block of code). Save it as `my-look.html`
   (in ChatGPT/Claude you can usually download it, or paste the code into Notepad and save with that name).
4. Double-click the file to open it in your browser. Ask the AI for changes until you like it
   ("make the numbers bigger", "show the azan moment", "show the dark version").
5. Take screenshots of each moment, then send them **and** the file in the
   [**New look** form](https://github.com/aarif86/PrayerTimesAsia/issues/new?template=new-look.yml).
   GitHub doesn't accept `.html` attachments, so zip the file first (right-click → *Compress* / *Send to → Compressed folder*),
   or paste the code into the form.

### Prompt for a masjid screen look (copy everything in the box)

```text
Make me a single self-contained HTML file (inline CSS and JavaScript, no external files except Google Fonts)
that mocks up a new look for a masjid prayer-times TV screen. It is for Prayer Times Asia, a free open-source
app used by mosques in Singapore, Malaysia and Indonesia.

My idea: [DESCRIBE YOUR LOOK HERE, e.g. "warm cream and deep green like old kampung masjid tiles,
with a soft geometric border, for a bright foyer"]

The page must:
- Fill a 16:9 landscape TV (1920x1080) and scale to any screen size. Use sizes relative to the screen
  (vh/vw or a CSS variable), never fixed pixels, so it looks the same on a 32" or 75" TV.
- Show: masjid name "Masjid Al-Islah" and area "Punggol, Singapore"; the date "Tuesday 27 October 2026" and
  Hijri date "16 Jumada al-Ula 1448"; a live clock.
- Show six prayer times with iqamah underneath:
  Subuh 05:28 (iqamah 05:48), Syuruk 06:46, Zohor 12:50 (iqamah 13:00), Asar 16:09 (iqamah 16:19),
  Maghrib 18:52 (iqamah 18:57), Isyak 20:02 (iqamah 20:12). Syuruk has no iqamah.
- Highlight the next prayer and show a big countdown to it, for example "Asar in 41m".
- Show one notice line at the bottom: "Kuliah Maghrib every Tuesday with Ustaz Ahmad", and a small footer
  "Times: MUIS" and "prayertimes.asia".
- Have four buttons in a corner (small, can be hidden with the H key) to preview each moment:
  1. Waiting (normal view)
  2. Azan: "Asar" very large, "Azan" and a countdown "Iqamah in 9:59"
  3. In prayer: screen almost black, only "Asar", "In prayer" and the clock, very dim
  4. Friday: Zohor renamed "Jumu'ah" and its iqamah label renamed "Khutbah"
- Have a fifth button to switch to portrait (1080x1920) to show how it would look on a standing TV.

Design rules:
- Readable from 10 metres: big numbers, strong contrast, no thin light-grey text.
- Calm: no flashing, no fast animation. Slow, gentle movement at most.
- No pictures of people or animals, no musical symbols, no adverts, no brand logos.
- Only use Google Fonts or system fonts, and only shapes/patterns drawn in CSS or SVG (no photos from the web).
- Keep the code tidy, with the colours as CSS variables at the top so they are easy to change.
```

### Prompt for an app look (copy everything in the box)

```text
Make me a single self-contained HTML file (inline CSS and JavaScript, no external files except Google Fonts)
that mocks up a new style for the main "Prayer" screen of a prayer-times phone app. It is for Prayer Times Asia,
a free open-source app for Muslims living and travelling across Asia.

My idea: [DESCRIBE YOUR LOOK HERE, e.g. "a calm Ramadan night theme with a crescent and lantern-gold
highlights" or "the five prayers as stacked arches like a masjid window"]

The page must:
- Show a phone screen 390x844 centred on the page (like an iPhone), with the rest of the page plain.
- Show: place "Pasir Ris, Singapore"; date "Tuesday 27 October 2026" and Hijri date "16 Jumada al-Ula 1448";
  a small badge "A · MUIS" showing where the times come from.
- Make the next prayer and its countdown the biggest thing on the screen, for example "Asr in 41m".
- Show six times with the next one highlighted: Fajr 05:28, Sunrise 06:46, Dhuhr 12:50, Asr 16:09,
  Maghrib 18:52, Isha 20:02.
- Keep a bottom tab bar with five tabs: Prayer (selected), Qibla, Falak, Masjid, Settings.
- Have small buttons outside the phone to switch Light / Dark, and to switch the next prayer
  (Fajr, Dhuhr, Asr, Maghrib, Isha) so I can see how the highlight and colours change through the day.

Design rules:
- Easy to read at a glance, good contrast in both light and dark.
- Calm: no flashing, no fast animation. Slow, gentle movement at most.
- No pictures of people or animals, no musical symbols, no adverts, no brand logos.
- Only use Google Fonts or system fonts, and only shapes/patterns drawn in CSS or SVG (no photos from the web).
- Keep the code tidy, with the colours as CSS variables at the top so they are easy to change.
```

## Way 3: Build it in the code

For people comfortable with web code.

### A masjid screen look

The screen is a small Preact + TypeScript page; a look is mostly CSS.

1. Fork the repo, then:
   ```sh
   cd web
   npm install
   npm run dev
   ```
   Open <http://localhost:5173/PrayerTimesAsia/screen/#setup>, pick a place in step 1 and use the preview.
2. Add your look (use a short lowercase id, e.g. `marble`):
   - `web/src/screen/config.ts`: add the id to `ScreenLook` and `LOOKS`.
   - `web/src/screen/Setup.tsx`: add an `<option>` in step 4 with a one-line description.
   - `web/src/screen/screen.css`: add a `/* MARK: Look: Marble */` section styling `.scr-look-marble`.
     Copy `.scr-look-day` or `.scr-look-board` as a starting point. Size everything in `var(--u)`
     (1% of the screen height) so it scales to any TV, and keep the per-prayer colours (`--tint`, `--t-fajr` ...).
   - Only touch `Display.tsx` if the look needs new elements (as Day Dial and Sun Path do).
3. Check all four moments, landscape and portrait. The preview follows the real clock, so the quickest way to see
   the azan and in-prayer views is to search for a place where a prayer is due in a few minutes.
4. Run `npm run typecheck` and `npm test`.
5. Open a pull request with landscape and portrait screenshots, and link the **New look** issue if there is one.

### An app look

The app is built three times (SwiftUI for iPhone, Jetpack Compose for Android, Preact for the web), and every style
exists on all three. You only need to build **one**, usually the web one, which is easiest to try. We port it to the others.

- **Web:** `web/src/services/prefs.ts` (add to `TodayStyle`, `TODAY_STYLES`, `TODAY_STYLE_LABEL`),
  `web/src/ui/Today.tsx` (the Prayer screen) and `web/src/ui/screens.css` / `app.css`. Run `npm run dev` in `web/`
  and open <http://localhost:5173/PrayerTimesAsia/>.
- **iPhone:** `ios/PrayerTimesAsia/Shared/TodayStyle.swift` and `ios/PrayerTimesAsia/Features/Today/`.
- **Android:** `android/app/src/main/kotlin/com/prayertimesasia/app/ui/` (`theme/` for colours).

Keep the prayer colours (`--t-fajr` ... on web, `Prayer.tint` on iPhone) and check light, dark and large text.
Open a pull request with light and dark screenshots.

## What happens next

1. We reply on your submission, usually within a week, sometimes with small questions or tweaks.
2. Chosen looks are built (or your pull request is merged) and tested on a real TV.
3. The look appears in the app's **Prayer screen** menu or the masjid screen's **Look** menu for everyone, free, and you're thanked by name in
   [What's new](website/changelog.md) unless you'd rather stay anonymous.

Not every design is picked, often because it's close to an existing look or hard to read at a distance.
We'll always say why.
