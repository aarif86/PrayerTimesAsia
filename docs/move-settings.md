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
off, the prayer tracker with its history, and the Ramadan record (how each
day's fast went, and the days Tarawih was prayed and the juz read).

Left behind on purpose: whether alerts are on (each phone must ask permission
again), travel-mode memory (last country, arrival day, trip log) and one-off
prompts.

Bringing settings in replaces the ones on the new phone. Tracker history and the
Ramadan record are the exception: they are added to what the new phone already
has, so nothing is lost (a fast marked on both phones takes the moved one). An
older code made before the Ramadan record travelled simply leaves the new phone's
record as it is.

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
| `reminderMinutesBefore` | minutes before each prayer for "Reminder before prayer" (0 = off) |
| `musafirThresholdKm` | km |
| `prayedLog` | `{"yyyy-MM-dd": [prayers]}` |
| `excusedDays` | list of `yyyy-MM-dd` |
| `trackerPausedSince` | `yyyy-MM-dd` the tracker was paused (haid, nifas, illness); every day from then until the pause ends counts as excused |
| `wakeUp` | `atFajr`, `fajrPlus15`, `sunriseMinus30`, `sunriseMinus15` (phones only; the web keeps it if present) |
| `dhuhrAlarm`, `asrAlarm`, `maghribAlarm`, `ishaAlarm` | `atStart`, `plus5`, `plus10`, `plus15`, `plus30`, `endMinus30` (not for Isyak) |
| `fastLog` | `{"yyyy-MM-dd": mark}`, mark is `fasted`, `period`, `sick`, `travel`, `other`, `qadha` (a replaced fast) or `syawal` |
| `tarawihLog`, `quranLog` | lists of `yyyy-MM-dd`: the days Tarawih was prayed, and the days the day's juz was read |
| `alarmSound` | `classic`, `chime`, `bells`, `beeps`, `phone` (a ringtone picked on Android; the ringtone itself stays on that phone, elsewhere it plays `classic`) |

A place is `{name, region?, countryCode?, countryName?, timeZoneID, lat, lon, district?}`.
It has no id; the receiving app makes a new one.

A value an app doesn't understand is skipped, not fatal. A QR code is kept under
1,500 characters so phone cameras read it easily. If everything doesn't fit, the QR
code first carries only this year's Ramadan record (the 330 days up to its newest
day, so the month, Syawal and the replaced fasts after it), then, if a long tracker
history still doesn't fit, the most recent tracker days that do, and says so. Share
and Copy link always carry everything.

## Where it lives

| | Code | Screens | Tests |
|---|---|---|---|
| Web | `web/src/services/move.ts` | `web/src/ui/Move.tsx` | `web/tests/move.test.ts` |
| iPhone | `ios/.../Services/MoveSettings.swift` | `ios/.../Features/Settings/MoveSettingsView.swift` | `ios/PrayerTimesAsiaTests/MoveSettingsTests.swift` |
| Android | `android/core/.../MoveSettings.kt` | `android/app/.../ui/settings/MoveSettings.kt` | `android/core/src/test/.../MoveSettingsTest.kt` |

All three read the same codes from `testdata/move-settings.json`, so a change to
the format that one app can't read fails that app's build.
