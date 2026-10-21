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

## What's in v1

- **Today** - "Living Sky" background that follows the real sun at your location,
  next-prayer countdown, sun arc, per-prayer reminder bells, Friday shows Jumaat.
- **Travel mode** - detects a new country (offline via the phone's time zone if
  there's no data), switches method/Asr/names automatically, shows a welcome card.
- **Journey** - home vs current distance, musafir status with jamak & qasar
  guidance (Shafi'i 81/89 km, 3 days; Hanafi 78 km, 15 days), trip log.
- **Qibla** - compass dial with haptic "aligned" moment, bearing and distance.
- **Settings** - method/Asr/name-style overrides, 24-hour, Hijri ±2 days,
  local notifications (12 days ahead).

## Accuracy

`PrayerTimesAsia/Core/PrayerEngine.swift` is a pure-Foundation solar calculation;
`tools/reference_engine.py` is a line-by-line port used to check it against
official timetables (MUIS 2026 and JAKIM WLY01 reference days). Times are rounded
**up** to the minute after each authority's precautionary minutes, so any
difference is on the safe side: prayers at most 1 minute later, sunrise at most
1 minute earlier. `python3 tools/reference_engine.py` runs the check; CI runs it too.

Country defaults live in `Core/AsiaRegions.swift` - one line per country.

## Building

No Mac needed: GitHub Actions does it (same pipeline as Nasar Flow).

- **CI** (`ci.yml`) - every push: XcodeGen → Simulator build → unit tests. No secrets.
- **Release** (`release.yml`) - manual: archive, sign, upload to TestFlight.

Locally on a Mac: `brew install xcodegen && xcodegen generate && open PrayerTimesAsia.xcodeproj`.

## TestFlight releases

One-time setup in the Apple Developer portal:

1. **Identifiers → +** App ID `com.prayertimesasia.app` (no extra capabilities needed).
2. **Profiles → +** App Store Connect distribution profile for that App ID, named
   exactly **`Prayer Times Asia`**. Download it.
3. **App Store Connect → Apps → +** new app "Prayer Times Asia" with that bundle ID.
4. Repo **Settings → Secrets → Actions**: reuse the Nasar Flow values for
   `APPLE_DISTRIBUTION_CERTIFICATE_BASE64`, `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`,
   `CI_KEYCHAIN_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`,
   `APPLE_API_KEY_BASE64`, and add the new profile:
   `base64 -i "Prayer_Times_Asia.mobileprovision" | pbcopy` → `APPLE_PROVISIONING_PROFILE_BASE64`.
5. **Actions → Release to TestFlight → Run workflow.**

## Roadmap

Home/Lock Screen widgets and a Live Activity countdown; official JAKIM e-Solat
zone tables when online; nearby masjid & musollah; Apple Watch.
