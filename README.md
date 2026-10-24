# Prayer Times Asia - Web

The web version of **Prayer Times Asia**, the iOS app for Muslims living and travelling across Asia: accurate prayer
times with their source, qibla, falak (sun-and-shadow) tools and nearby masjids. An installable, offline-capable
PWA (Preact + TypeScript + Vite), no accounts, no ads, no analytics.

- Live (GitHub Pages): **https://aarif86.github.io/PrayerTimesAsia/**
- This branch (`web`) is an orphan branch of `aarif86/PrayerTimesAsia`: it shares no history or files with the iOS app on `main`.

## Run it

```sh
npm ci
npm run dev          # http://localhost:5173/PrayerTimesAsia/
npm test             # unit tests (vitest)
npm run typecheck
npm run build        # dist/, base path /PrayerTimesAsia/ (override with BASE_PATH=/)
npm run screenshots  # after a build: docs/screenshots/*.png at iPhone size
```

Demo mode, as used for the screenshots (nothing is saved): `?demo&now=2026-10-25T00:49:00%2B08:00&style=list&appearance=dark`
with `style` = `list | centre | dial | sunPath | bands`, `appearance` = `system | light | dark`, `tab` = `today | qibla | falak | masjid | settings`,
`more=1` (Show more), `aligned=1` (qibla aligned), `demo=visitor|travel|makkah` (the iOS demo variants).

## How it is built

| Folder | What |
| --- | --- |
| `src/core/` | The prayer engine and domain logic, a line-by-line port of the iOS `Core/*.swift`: `engine.ts` (PrayerEngine), `methods.ts`, `regions.ts` (country profiles, naming), `prayer.ts`, `hijri.ts` (Umm al-Qura via `Intl`), `blessed.ts`, `falak.ts`, `geo.ts`, `musafir.ts`, `jakimZones.ts`, `sources.ts` (grades, masjid profiles), `calendarSanad.ts`, `official.ts` (MUIS/JAKIM/Kemenag parsers and source choice). No DOM, fully tested. |
| `src/services/` | The app model (`store.ts`, the port of `AppModel`: resolver official table > masjid > calculation, travel mode, tracker), preferences, official-table download and cache, built-in city list, alerts and `.ics` export, compass and motion sensors. |
| `src/ui/` | Every screen: Prayer (five styles), Qibla, Falak (+ camera and level), Masjid (OpenStreetMap), Settings, and the sheets (place, source, calendar, journey, makers). `LivingSky.tsx` and `sky.ts` port the Living Sky; `Dials.tsx` the Day Dial, the hero dial and the sun path. |
| `tests/` | Vitest: the iOS expected values (MUIS, JAKIM, Kemenag, Hijri, blessed times, Falak, qibla), plus every day of 2026 for Singapore, Kuala Lumpur and Jakarta against the iOS repo's Python reference engine. |
| `scripts/screenshots.mjs` | Playwright screenshots at 393×852 @3x with a fixed place (Pasir Ris) and clock. |
| `.github/workflows/web.yml` | Type-check, test, build and deploy to GitHub Pages on every push to `web`. |

## Accuracy and official timetables

The engine is the same maths as the iOS app (praytimes.org solar model, two refinement passes, each authority's
precautionary offsets, rounded *up* to the minute). The tests check it against the official MUIS and JAKIM days used by
the iOS tests and against the iOS reference engine for every day of 2026, so the web inherits the iOS guarantee:
offline, Singapore times are never earlier than MUIS (at most 2 minutes later); Malaysia and Indonesia are within about
2 minutes.

Browsers can only read another site's API when it allows it (CORS). So the web app reads **the app's own calendar
feeds** on the `feeds` branch (`raw.githubusercontent.com`, which allows any origin), which `feeds.yml` rebuilds
every week from MUIS (data.gov.sg) and every JAKIM e-Solat zone. They carry the five prayers; Syuruk then comes from
the calculation (at most a minute early, never late). The authorities' own APIs (data.gov.sg, e-Solat, myquran for
Kemenag) are tried as well in case they allow browser access; the CI job prints which ones do. Without any table the
calculation is used and the source badge says "Calculated". Tables are kept in the browser for offline use.

## What is at parity with iOS

- Prayer screen: Classic list (Day Dial beside the list), Centre Dial, Day Dial, Sun Path and Colour Bands; the palette
  button cycles them (touch and hold / right-click to pick) and remembers the choice; Automatic / Light / Dark button,
  with Automatic following the sky (light from sunrise to Maghrib, the soft night after); a toast names the new style.
- Living Sky behind every tab (keyframes pinned to the day's prayer times, stars at night, the breathing sun and
  drifting clouds in light mode, the soft night in Automatic).
- Show more with Dhuha, the middle and last third of the night (Imsak in Ramadan), in English; day navigation with
  ‹ › and swipe; tap the date for the Ramadan/Eid calendar sanad, or to come back to today.
- Source badge and source sheet (grades A/B/C/D/F), masjid profiles (Grade B) and "show both" when sources differ.
- Hijri date with the ±2 day adjustment; names that follow the user (home country, then browser language) with the
  local word beside them when travelling; Friday names (Jumaat, Jumu'ah...).
- Travel mode: country method switches automatically, arrival card, optional Musafir features and the Journey sheet
  (qasar/jamak guidance, combined windows, home, trip log).
- Prayer tracker with streak and excused days.
- Qibla: compass with the green aligned state (ring, tick, ripple, vibration where supported), turn instructions and
  steps; asks for compass permission on iPhone Safari; without a compass, the bearing plus **the qibla line on a map**.
- Falak: shadow right now, Qibla Day, rashdul qiblat, shadow stick (tongkat istiwa') with readings, sky signs; camera
  view and spirit level.
- Masjid: OpenStreetMap map and list (Overpass), All/Masjid/Musollah, walking directions in the phone's maps app,
  the (i) "Built fisabilillah" sheet.
- From the makers: Badal.sg for Singapore users, NasarDigital otherwise; on the Prayer screen only under Show more; (i)
  on Masjid; Settings "From the makers" with the Show offers switch. Same links and utm parameters as iOS. Nothing is tracked.
- Settings as a tab, with the same sections (location, travel, calculation, names, tracker, display, alerts, accuracy,
  privacy, makers, credits).

## Web limitations (and what the app does instead)

- **Alerts when the app is closed.** A web page cannot schedule a notification for later without a push server, and
  this app has none (no accounts, no tracking). Alerts ring at the exact time **while the app is open** (tab or installed
  window, through the service worker). For alerts that ring when it's closed, Settings has **"Add the next 30 days to a
  calendar"** (an `.ics` with an alarm on every prayer) and, in Singapore and Malaysia, a subscription to the official
  calendar feed. The UI says this plainly.
- **iPhone/iPad:** notifications only work after *Add to Home Screen*; the compass needs a tap to grant permission
  (the Qibla tab shows a button).
- **No widgets, Live Activity, Lock Screen countdown or Subuh alarm** (AlarmKit) - those are iOS-only.
- **Camera view:** the web has no plane detection (ARKit), so the floor overlay is drawn from the compass and the
  phone's tilt: a guide, less exact than iOS AR.
- **Compass accuracy** depends on the browser: Android Chrome gives an absolute heading; iPhone Safari gives
  `webkitCompassHeading`; desktops have none (the map line is the fallback).
- **Place search** uses a built-in list of Asian cities (offline, nothing sent) and, on request, OpenStreetMap
  Nominatim (only the typed words are sent). Apple Maps' on-device search isn't available on the web. A GPS fix is
  named from the built-in list; it never leaves the browser.
- **Masjid search** uses OpenStreetMap, whose coverage differs from Apple Maps; the map tiles (CARTO) and Overpass see
  the area you look at.
- **Help verify times** links to the contribution guide instead of the in-app photo form.

## Moving it to its own repository later

```sh
git clone --branch web --single-branch https://github.com/aarif86/PrayerTimesAsia.git prayertimesasia-web
cd prayertimesasia-web
git remote add new https://github.com/<owner>/<new-repo>.git
git push new web:main
```

Then in the new repo: Settings → Pages → Source: **GitHub Actions**, change the workflow trigger from `web` to `main`,
and set `BASE_PATH` in `web.yml` (e.g. `/<new-repo>/`, or `/` for a custom domain).

## Licence

MIT, like the iOS app. Official timetables: MUIS (Singapore Open Data Licence), JAKIM e-Solat, Kemenag via myquran.
Map data © OpenStreetMap contributors. Fonts: Inter and Nunito (SIL OFL). Icons: Lucide (ISC) and the app's own set.
