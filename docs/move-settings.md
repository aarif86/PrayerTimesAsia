# Move my settings

People change phones, or use the iPhone app and the web app side by side. There
are no accounts, so their settings travel the simple way: inside a code they
carry over themselves.

## How people use it

1. On the old phone (or browser): **Settings › Move my settings**. It shows a QR
   code, plus Share link and Copy link.
2. On the new phone: **Settings › Bring in settings** (also on the first screen,
   "Bring in settings from another phone"). Scan the QR code, or paste the link.
3. It shows what will come across, then **Bring in settings**.

No app on the new phone yet? Pointing the phone's own camera at the QR code opens
the web app, which brings the settings in straight away.

Phone backups already carry everything too: restoring a new iPhone from iCloud,
or setting up a new Android phone from a Google backup, brings the settings with
it (iOS keeps them in UserDefaults and Android in SharedPreferences, both included
in backups).

## What travels

Places (home, chosen place, saved places, and whether to use GPS), calculation
choices (method, Asr, JAKIM zone, Ramadan/Eid authority, Hijri adjustment),
prayer names, look (appearance, Prayer screen style, 24-hour time), which prayers
to alert and the early reminder, the wake-up alarm, musafir settings, offers on or
off, and the prayer tracker with its history.

Left behind on purpose: whether alerts are on (each phone must ask permission
again), travel-mode memory (last country, arrival day, trip log) and one-off
prompts.

Bringing settings in replaces the ones on the new phone. Tracker history is the
exception: it is added to what the new phone already has, so nothing is lost.

## The code

    PTA1.<base64url, no padding, of raw DEFLATE (RFC 1951) of a JSON object>

The QR code and links hold `https://aarif86.github.io/PrayerTimesAsia/app/#move=` +
the code. Every app finds `PTA1.` anywhere in the text, so a pasted message or a
future address (prayertimes.asia) still works.

The JSON uses the web app's names and only lists settings that differ from a fresh
install; a missing key means the default. `"v": 1` is always there.

| Key | Value |
|---|---|
| `v` | `1` |
| `useGPS`, `use24Hour`, `musafirEnabled`, `showOffers`, `showLocalNames`, `trackerEnabled` | true / false |
| `home`, `manualPlace` | a place (below) |
| `savedPlaces` | list of places |
| `methodOverrideID`, `jakimZoneOverride`, `communityAuthority` | text |
| `asrOverride` | `standard`, `hanafi` |
| `namingOverride` | `arabic`, `malay`, `indonesian`, `southAsian`, `turkish` |
| `appearance` | `system`, `light`, `dark` |
| `todayStyle` | `centre`, `list`, `dial`, `sunPath`, `bands` |
| `hijriAdjustment` | -2 to 2 |
| `notifyPrayers` | list of `fajr`, `sunrise`, `dhuhr`, `asr`, `maghrib`, `isha` |
| `reminderMinutesBefore` | minutes |
| `musafirThresholdKm` | km |
| `prayedLog` | `{"yyyy-MM-dd": [prayers]}` |
| `excusedDays` | list of `yyyy-MM-dd` |
| `wakeUp` | `atFajr`, `fajrPlus15`, `sunriseMinus30`, `sunriseMinus15` (phones only; the web keeps it if present) |

A place is `{name, region?, countryCode?, countryName?, timeZoneID, lat, lon, district?}`.
It has no id; the receiving app makes a new one.

A value an app doesn't understand is skipped, not fatal. A QR code is kept under
1,500 characters so phone cameras read it easily: if a long tracker history doesn't
fit, the QR code carries the most recent days that do and says so; Share and Copy
link always carry everything.

## Where it lives

| | Code | Screens | Tests |
|---|---|---|---|
| Web | `web/src/services/move.ts` | `web/src/ui/Move.tsx` | `web/tests/move.test.ts` |
| iPhone | `ios/.../Services/MoveSettings.swift` | `ios/.../Features/Settings/MoveSettingsView.swift` | `ios/PrayerTimesAsiaTests/MoveSettingsTests.swift` |
| Android | `android/core/.../MoveSettings.kt` | `android/app/.../ui/settings/MoveSettings.kt` | `android/core/src/test/.../MoveSettingsTest.kt` |

All three read the same codes from `testdata/move-settings.json`, so a change to
the format that one app can't read fails that app's build.
