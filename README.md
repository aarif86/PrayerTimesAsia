# Prayer Times Asia

Prayer times and qibla for Muslims living and travelling across Asia.
Native SwiftUI, iOS 17+. No ads, no accounts, no tracking. Location never leaves the phone.

## Why it exists

Apps like prayertime.sg download official MUIS/JAKIM tables, so they stop working
the moment you cross into Vietnam or Japan. Global apps calculate anywhere, but
use one convention for everyone, which puts Malaysian Subuh about 8 minutes early
(Malaysia moved to 18° in 2019; Singapore stays on 20°). This app calculates on
the phone using **each country's own method**, so it works offline, everywhere,
and matches the official tables at home.

## What's in the app

- **Today** - "Living Sky" background that follows the real sun at your location,
  next-prayer countdown, sun arc, per-prayer reminder bells, Friday shows Jumaat.
- **Travel mode** - detects a new country (offline via the phone's time zone if
  there's no data), switches method/Asr/names automatically, shows a welcome card.
- **Journey** - home vs current distance, musafir status with jamak & qasar
  guidance (Shafi'i 81/89 km, 3 days; Hanafi 78 km, 15 days), trip log.
- **Qibla** - compass dial with haptic "aligned" moment, bearing and distance.
- **Official timetables** - in Singapore and Malaysia, the year's official MUIS
  (data.gov.sg) or JAKIM e-Solat table is downloaded once (only the year or the
  zone code is sent) and kept for offline use; the nearest JAKIM zone is found on
  the phone and can be pinned in Settings.
- **Masjid** - masjids and musollahs within 15 km via Apple Maps search, with
  walking/driving directions.
- **Widgets** - Home Screen (small/medium, Living Sky background) and Lock Screen
  (rectangular/circular/inline); **Live Activity** countdown on the Lock Screen and
  Dynamic Island (Settings → Live countdown).
- **Settings** - method/Asr/name-style overrides, JAKIM zone, 24-hour, Hijri ±2
  days, local notifications (12 days ahead).

## Accuracy

Online in Singapore/Malaysia the app shows the official table itself. Offline (and
everywhere else) it calculates: `PrayerTimesAsia/Core/PrayerEngine.swift` is a
pure-Foundation solar calculation and `tools/reference_engine.py` a line-by-line
Python port. The **Validate against official timetables** workflow
(`tools/validate_official.py`) downloads the full 2026 MUIS and JAKIM tables and
compares every day; the precautionary offsets were fitted on that data. For MUIS
the calculation is **never earlier than the official time** (prayers at most 2
minutes later, sunrise at most 1 minute earlier) on all 365 days; for JAKIM, whose
54 zones each use their own reference point, it is within about 2 minutes.

Country defaults live in `Core/AsiaRegions.swift` - one line per country.

## Building

No Mac needed: GitHub Actions does it (same pipeline as Nasar Flow).

- **CI** (`ci.yml`) - every push: XcodeGen → Simulator build → unit tests. No secrets.
- **Release** (`release.yml`) - manual: archive, sign, upload to TestFlight.

Locally on a Mac: `brew install xcodegen && xcodegen generate && open PrayerTimesAsia.xcodeproj`.

## TestFlight releases

One-time setup in the Apple Developer portal (same pattern as Nasar Flow's
keyboard and widgets):

1. **Identifiers → +** App Group `group.com.prayertimesasia.app`.
2. **Identifiers → +** App ID `com.prayertimesasia.app` with **App Groups** enabled
   (assign the group above).
3. **Identifiers → +** App ID `com.prayertimesasia.app.widgets` with **App Groups**
   enabled (same group).
4. **Profiles → +** two App Store Connect distribution profiles, named exactly
   **`Prayer Times Asia`** (main app ID) and **`Prayer Times Asia Widgets`**
   (widgets ID). Download both.
5. **App Store Connect → Apps → +** new app "Prayer Times Asia", bundle ID
   `com.prayertimesasia.app`.
6. Repo **Settings → Secrets → Actions**: reuse the Nasar Flow values for
   `APPLE_DISTRIBUTION_CERTIFICATE_BASE64`, `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`,
   `CI_KEYCHAIN_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`,
   `APPLE_API_KEY_BASE64`, and add the two new profiles:
   - `base64 -i "Prayer_Times_Asia.mobileprovision" | pbcopy` → `APPLE_PROVISIONING_PROFILE_BASE64`
   - `base64 -i "Prayer_Times_Asia_Widgets.mobileprovision" | pbcopy` → `APPLE_WIDGETS_PROVISIONING_PROFILE_BASE64`
7. **Actions → Release to TestFlight → Run workflow.** If anything is missing the
   first step names the missing secrets and stops.

## Credits

- JAKIM zone reference points (`tools/jakim_reference_points.json`) are derived
  from the district-to-zone mapping in
  [mptwaktusolat/malaysia.geojson](https://github.com/mptwaktusolat/malaysia.geojson).
  Only one coordinate per district is kept; the polygons are not shipped.
- Official timetables: MUIS via data.gov.sg, JAKIM via e-solat.gov.my.

## Roadmap

Official Kemenag (Indonesia) tables; Apple Watch; home-screen widget
configuration (pick a place other than the current one).
