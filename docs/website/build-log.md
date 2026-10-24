# Build log

Every change to Prayer Times Asia, oldest first, straight from the git history.
The public, plain-English version is [changelog.md](changelog.md). This file is the
behind-the-scenes record for the website's "How it was built" story.


## 2026-10-21

- **Prayer Times Asia v1: offline prayer times, qibla and travel mode** (`7366fd5`)
  Native SwiftUI app for Muslims living and travelling across Asia.
  - Pure-Foundation prayer engine with per-country methods (MUIS, JAKIM
    18deg Subuh, Kemenag, regional and international presets), checked
    against official MUIS/JAKIM timetables within one safe-side minute
  - Living Sky Today screen, countdown, sun arc, reminders
  - Travel mode: auto country switch (offline via time zone), musafir
    jamak/qasar guidance, trip log
  - Qibla compass with aligned haptic
  - XcodeGen project, CI (simulator build + tests) and TestFlight workflow
- **Add demo launch mode and simulator screenshots in CI** (`473b837`)
- **CI: publish simulator screenshots to a screenshots branch** (`b1dc626`)
- **Journey: don't repeat the distance in the musafir guidance** (`9a2c1d2`)
- **Add whole-year validation against official MUIS and JAKIM tables** (`b1853fa`)
  JAKIM zone reference points are derived (one point per district) from
  mptwaktusolat/malaysia.geojson's district-to-zone mapping.
- **Validation: parse Malay month names, fit precautionary offsets over a full year** (`9547b65`)
- **Official MUIS/JAKIM timetables when online, nearby masjid & musollah** (`10590e6`)
  - Download the year's official table (MUIS via data.gov.sg, JAKIM e-Solat
    by zone code only), cache on disk for offline use, fall back to the
    calculation. Nearest JAKIM zone is found on the phone; zone can be pinned.
  - Recalibrate MUIS/JAKIM offsets on every day of the 2026 tables so the
    offline calculation is never earlier than official (at most 2 min later).
  - Masjid tab: Apple Maps search for masjid/musollah/surau within 15 km.
- **CI: screenshot the Masjid tab** (`25dce59`)
- **Widgets and Live Activity countdown** (`578b4a4`)
  - WidgetKit extension: Home Screen small/medium (Living Sky background,
    countdown, today's times) and Lock Screen rectangular/circular/inline.
  - Live Activity: next-prayer countdown on the Lock Screen and Dynamic
    Island, moved on by the app (Settings > Live countdown).
  - App Group snapshot of the next 7 days (official tables merged).
  - Preferences decode field-by-field so new settings never reset old ones.
  - Release workflow signs the widget extension with its own profile and
    names any missing secret up front. README: setup steps and credits.
- **Accuracy wording per authority; JAKIM Dhuhr offset; MUIS dataset discovery probe** (`115bd28`)
  Full-year results: MUIS calculation never earlier than official on all 365
  days; JAKIM zones each use their own reference point, so offline Malaysian
  times are within about 2 minutes (official table is used when online).
- **Add App Store listing copy** (`ab3e01f`)
- **Polish: compass no longer spins across north, VoiceOver countdown, masjid search filters bus stops and streets** (`402d68d`)
- **Learn future MUIS datasets from config/official-sources.json** (`b2de7cf`)
  data.gov.sg rate-limits listing and its search ignores the query, so the
  new yearly dataset id is published in this repo instead.
- **Release: check signing secrets on a Linux job before using macOS minutes** (`b683887`)
- **Ideas from Pillars, done our way** (`e77da61`)
  - Sun path: the sun's real altitude through the local day at this exact
    place, every prayer marked on it (replaces the sunrise-to-sunset arc).
  - Browse days with arrows or a swipe; tap the label to return to today.
  - Arrival card: switch-automatically toggle and Asr choice inline.
  - Optional prayer tracker with streak; 'excused' days keep it going.
  - Subuh wake-up: a real AlarmKit alarm on iOS 26 (rings in Silent mode),
    notification fallback earlier. Free.
  - Static star field that fades in as the sky darkens.
- **Probe myquran (Kemenag) and waktusolat response shapes in CI** (`5aeb8f6`)
- **Validate Kemenag (Jakarta, Surabaya, Makassar) against the calculation** (`c316752`)
- **Brief v02 phase 1: source grades, Kemenag, masjid profiles, fingerprinting, submissions** (`453e1e7`)
  - Sanad: every day shows its grade (A official, B masjid, C community,
    D calculated) with a sheet explaining the source and method.
  - Indonesia Grade A: Kemenag schedules via api.myquran.com v2, matched on
    the phone by regency name (only the name is sent); offline offsets fitted
    on full-year Jakarta, Surabaya and Makassar tables.
  - Resolver: official table > nearby mosque profile > calculation.
  - data/mosques.json (starts empty, CC-BY 4.0) with fingerprint + jamaah and
    Jumu'ah rules; validated in CI by tools/check_mosques.py.
  - tools/fingerprint.py recovers a timetable's angles, Asr school and safety
    minutes; recognises MUIS, JAKIM and Kemenag months in self-tests.
  - Submissions v0: GitHub issue forms (timetable, method, adhan heard),
    prefilled from the app's source sheet; CONTRIBUTING.md verification ladder.
  - Sources & credits screen (Singapore Open Data Licence attribution), MIT
    LICENSE, accuracy report published on each validation run.
- **CI: reuse the simulator build for screenshots; 45 min timeout for slow Mac runners** (`ce3c6ec`)

## 2026-10-22

- **Community submissions via Firebase: submit function, locked rules, in-app form** (`a1c1300`)
  - functions/: HTTPS 'submit' (asia-southeast1) validates a timetable photo,
    method confirmation or adhan spot check, rate-limits by hashed source,
    stores the record in Firestore and the photo in Storage for review.
    Never accepts coordinates. Unit-tested validation (node --test).
  - Firestore and Storage rules deny all client access.
  - Deploy workflow (GitHub Actions, FIREBASE_SERVICE_ACCOUNT secret).
  - App: native 'Help verify times' form (photo picker, no account) replaces
    the GitHub links in the source sheet; privacy manifest declares
    user-submitted photos and content, not linked, no tracking.
- **Add TestFlight status workflow (App Store Connect API)** (`2720477`)
- **Firebase deploy: smoke-test the live submit endpoint** (`72bb782`)
- **Falak Mode F1: Qibla Day, rashdul qiblat, shadow stick, sky signs (Grade F)** (`8a91e5b`)
  Classical sun-and-shadow layer from brief v03 section 8, labelled Grade F
  and pending shariah review. Core maths in Core/Falak.swift with a Python
  port (tools/falak_reference.py), unit tests, and a review sheet for a
  falak practitioner (docs/falak-review.md).
- **Calendar sanad, calendar feeds, show-both, jama' windows; Falak polish** (`c0dd6b6`)
  - Calendar sanad (brief v03 7.1): Umm al-Qura estimate plus per-authority
    announcements from data/calendar.json, 'My community follows' setting.
  - Calendar feeds (7.3): tools/gen_ics.py + feeds.yml publish MUIS and every
    JAKIM zone as .ics on the feeds branch; Settings links to the zone's feed.
  - Show both times when the official table and a masjid differ by >2 min.
  - Journey: today's combined (jamak) windows for travellers, pending review.
  - Qibla: move the Sun & shadow chip under the instruction; stronger shadow.
- **Redesign: times-first Today, light mode, Falak tab with AR and level** (`77c55d5`)
  - Today: small 'now' status top left, colour-coded prayer rows with large
    times (AM/PM fixed on the same line), Show more / Show less with Dhuha,
    middle and last third of the night (Imsak in Ramadan).
  - Appearance: Automatic / Light / Dark.
  - Falak is a main tab with its own icon; Settings moves to a gear on Today.
  - Falak tools: AR camera view (qibla line + stick shadow on the floor) and a
    spirit level for the ground and the stick.
  - CI publishes branch screenshots to screenshots-<branch>.
- **Redesign polish: readable qibla gold in light mode, even tool tiles, pin icon, shorter Dhuha note** (`0ec5789`)
- **Redesign round 2: calmer colours, animated bright sky, new icon set** (`12a9d78`)
  - Softer prayer palette; the current prayer is tinted glass, not a solid block;
    date and 'now' title in plain text with colour as an accent only.
  - Light mode: a softly breathing sun (moon after dark) and slow-drifting clouds,
    still under Reduce Motion.
  - One outline icon set (24 pt, 1.6 pt stroke, vector): prayer mat (tab renamed
    Prayer), compass, telescope for Falak, masjid, plane.
- **Redesign round 3: smooth day arc, aligned header, big timetable widget** (`edf345a`)
  - Sun path is one smooth arc, edge to edge, peach above the horizon.
  - Header: prayer and countdown left, streak and settings right; one centred
    'TODAY | place' chip under the arc; date centred below.
  - New large Home Screen widget 'Today's timetable': colour bands in the calmer
    palette, Hijri date, current prayer marked. Shared TimetableCard also drives
    an in-app preview (Settings) and the CI screenshot.
- **Light sky: move the sun/moon glow up behind the top-right corner, clear of the day arc** (`cc79506`)
- **Big widget: a mini version of the Prayer screen's list, under the Living Sky** (`82d332b`)
- **CI: give the widget preview time to draw; light sky orb below the status bar** (`499c5a2`)
- **Qibla: green 'aligned' state with ring, tick, ripple and tap; step-by-step instructions** (`531d195`)
- **Qibla demo screenshots show the real instructions** (`c65a565`)
- **Prayer list without the circles: colour bar, name, time; tap a passed prayer to tick it** (`1d65fe4`)
- **Prayer names follow you, with the local word underneath when you travel** (`46ca4fa`)
  - Names come from your home country, else your phone's language/region, else
    International (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) - not from where you are.
  - When the local words differ, each row shows them small ('Subuh here').
  - Malay spelling follows MUIS/JAKIM (Zohor); Turkish (Diyanet) added; the old
    'arabic' choice decodes as International.
  - Labels that said Subuh/Zuhur follow your names.
- **Prayer time alerts: at the exact time, optional early reminder and Syuruk, one-tap prompt** (`eb4c5eb`)
  - Alert at each chosen prayer's exact time ('Subuh · 5:29 AM' / 'It's time for
    Subuh in Pasir Ris'); the early reminder is now an extra, not a replacement.
  - Optional Syuruk alert ('Subuh has ended'); bell on every row.
  - A slim 'Get an alert when each prayer begins' bar on the Prayer screen until
    alerts are on or it is dismissed.
  - Pending alerts sorted by time before the 60-alert cap, so the soonest are kept.
- **Design: four clock app-icon options (SVG sources + previews)** (`f186a34`)
- **Design: Kaabah-centred clock icon options (E1-E3)** (`4fa5f72`)
- **Design: compass + qibla clock icon options (F1-F3)** (`778778e`)
- **Design: G1 icon - clock numbers with compass letters, qibla marker, 5:30** (`f46bd09`)
- **Design: H1/H2 icon - Explorer-style dial, compass and qibla arrow on the bezel** (`bbf1030`)

## 2026-10-23

- **Design: H3 icon - Explorer-style steel bezel and hands, 8:02, no logo** (`7719d9a`)
- **Design: H1/H2 with rounded Rolex-style hands at 8:02 and a wider compass bezel** (`46f18dd`)
- **Design: clean H1/H2 at 8:02 with a balanced bezel (dial 80% of the watch)** (`53c3b8f`)
- **Design: H1 v2 - outer rim, minute track, larger front-facing Kaabah, outward qibla arrow** (`08cb939`)
- **Design: H1 v2 uses the Gemini-style Kaabah** (`711079a`)
- **Design: H1 v2 uses the Gemini-style diagonal hands** (`36d171e`)
- **Design: H1 v2 hands match the Gemini reference (white-bordered line, navy ring pivot)** (`1b50e1a`)
- **Design: H1 v2 seamless hand pivot (ring as thick as the hands)** (`d8ac272`)
- **Design: before/after comparison of H1 and H1 v2** (`ef076fc`)
- **Design: three luxury hand styles for H1 v2 (Mercedes, skeleton sword, dauphine)** (`9a11c1c`)
- **New app icon: compass-bezel watch with the Kaabah and skeleton sword hands** (`fe2066f`)
- **One colour palette across the app; Qibla centre is a single arrow to the qibla** (`941e961`)
  - Theme palette: accent (brand peach), gold (qibla), north, success, warning;
    prayer colours only on prayer rows. Falak tools, Grade F, Nearby pins, the
    arrival toggle and the sun-safety card use it instead of one-off colours.
  - Qibla: the centre shows an arrow that points at the qibla (a tick when
    aligned) instead of a second moving number.
- **Prayer screen: Day Dial header and a one-screen layout (preview)** (`f346b11`)
  - The Day Dial: a 24-hour ring, noon at the top, each prayer's period a
    coloured segment, a glowing dot for now, the current prayer and countdown
    inside - our own signature, echoing the watch icon, instead of the sun arc.
  - Place, date (with ‹ ›) and the source badge sit beside it; tighter rows, so
    the list and Show more fit on one screen.
- **Day Dial in the colours of the sky; travel layout fits one screen** (`d955d5d`)
  - Prayer colours follow the day: dawn blue (Subuh), morning gold, hot noon,
    afternoon amber, sunset red (Maghrib), night indigo (Isyak). The dial is one
    conic sky gradient with gaps at each prayer; rows and widget match.
  - Local names sit on the same line as the prayer name; the Musafir note is a
    small plane chip beside the gear.
- **Prayer screen fills the screen: rows stretch into the free height (scrolls only when it can't fit)** (`be5a5bb`)
- **Demo screenshots start with Show more closed unless -more is passed** (`b894ae0`)
- **Prayer screen styles: Classic list (default) or Day Dial, in Settings > Display** (`a7c8396`)
- **From the makers: Badal.sg and NasarDigital on the Prayer, Masjid and Settings screens, with a switch to hide them** (`5257590`)
  Only the makers' own services, linking to their websites; nothing tracked.
- **Makers card: one line on the Prayer screen, frosted so it reads on any sky; CI screenshot of Settings > From the makers** (`7d2fce9`)
- **Third Prayer screen style: Sun Path (the released layout with the sun's arc)** (`278ca23`)
- **Makers card on the Prayer screen only under Show more; Ka'bah icon for Badal, globe for NasarDigital** (`9ee6748`)

## 2026-10-24

- **Fourth Prayer screen style: Colour Bands, each prayer a full-width band like the classic Singapore timetable** (`f9f66a8`)
- **Tidy a blank line** (`8c113f3`)
## How the decisions were made

The commits say *what* changed. These notes keep *why*, for the website's story.

### Built without a Mac
- The whole app is written on a Linux machine: XcodeGen generates the project,
  GitHub Actions builds and tests on macOS, takes simulator screenshots of every
  screen, and uploads to TestFlight. Every design was reviewed from those
  screenshots before it shipped.

### Accuracy first (21 Oct)
- The prayer engine was checked against the full-year official MUIS and JAKIM
  timetables (later Kemenag too). Rule: offline times are never earlier than the
  official time, and at most about 2 minutes later.
- Every day shows where its times come from (A official, B masjid, C community,
  D calculated, F falak) - the "sanad" of the timetable.

### Falak Mode (22 Oct)
- Classical sun-and-shadow methods (Qibla Day, rashdul qiblat, shadow stick) as
  a separate, clearly labelled layer, sent for review by a member of the falak
  committee in Singapore before anyone relies on it.

### Feedback rounds (22-23 Oct)
1. **"Too cluttered; the times are the product."** The big countdown became a
   small status at the top left; large times with AM/PM on the same line;
   Show more / Show less with the blessed times, free.
2. **"Too colourful - make it feel like Apple made it."** One notch calmer
   colours; light mode with a breathing sun and drifting clouds; one consistent
   outline icon set (prayer mat, compass, telescope, masjid, plane).
3. **"Make the curve seamless."** The sun path became one smooth arc.
4. **"The big widget should be a mini version of the app."** Not colour bands.
5. **Qibla:** a green "you're facing the qibla" state with a tick, ripple and
   tap, plain step-by-step instructions, then a single arrow in the centre
   instead of moving numbers.
6. **"Remove the circles."** Rows became a thin colour bar, name and time.
7. **"Subuh or Fajr?"** Names follow the user (home country, then phone
   language), with the local word shown small when travelling.
8. **"Every prayer app tells you when it's time."** Alerts at the exact time.

### The app icon (22-23 Oct)
- Brief: a clock, with the Ka'bah inside, not an astrology look.
- Rounds: four clock ideas -> Ka'bah at the centre (E) -> compass bezel and
  qibla marker (F, G) -> a clean watch dial with 3-6-9 and the compass on the
  bezel (H1/H2) -> refined from an outside AI render (H1 v2) -> three luxury
  hand styles. Chosen: H1 v2 with skeleton sword hands, set to 8:02 (Isyak).

### One look, then four (23-24 Oct)
- One colour palette across the whole app (brand peach, qibla gold).
- To stop looking like other prayer apps, the Day Dial was created as the
  app's own signature (a 24-hour ring echoing the watch icon), coloured like
  the sky through the day: bright dawn, hot noon, sunset red, night indigo.
- The full-screen Day Dial was loved but its numbering confused some people,
  so instead of choosing, the Prayer screen got styles: Classic list
  (default), Day Dial, Sun Path, and Colour Bands - a tribute to the classic
  Singapore timetable that many grew up with.

### Fisabilillah, no sponsors (23-24 Oct)
- No ad networks and no sponsors. The only promotion is for the makers' own
  services (Badal.sg, NasarDigital, by Nasar Pte Ltd), linked to their
  websites, never on first look (only under Show more), with a switch to
  hide them. Nothing is tracked in the app.
