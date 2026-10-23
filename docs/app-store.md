# App Store listing - Prayer Times Asia

Copy-paste ready. Character limits checked.

| Field | Value | Limit |
|---|---|---|
| Name | Prayer Times Asia | 30 |
| Subtitle | Prayer times & qibla in Asia | 28 / 30 |
| Category | Primary: Reference · Secondary: Travel | |
| Age rating | 4+ (no objectionable content) | |
| Price | Free, no in-app purchases | |

## Keywords (93 / 100)

```
waktu solat,azan,adhan,kiblat,qiblat,muis,jakim,salah,solat,namaz,masjid,musollah,surau,hijri
```

(Apple already indexes the name and subtitle, so "prayer", "times", "qibla" and
"Asia" are deliberately not repeated.)

## Promotional text (125 / 170)

Land anywhere in Asia and know when to pray and which way to face. Official MUIS and JAKIM timetables, works offline, no ads.

## Description

Prayer times and qibla for Muslims living and travelling across Asia.

Most prayer apps either stop working when you cross a border, or use one global setting for everyone. Prayer Times Asia knows how each country calculates its prayer times - and switches for you the moment you land.

AT HOME, EXACT
• Singapore: the official MUIS timetable
• Malaysia: the official JAKIM e-Solat timetable for your zone (found automatically, or pick it yourself)
• Indonesia: Kemenag's method
Downloaded once a year and kept on your phone, so it works offline.

ON THE ROAD, READY
• Vietnam, Thailand, Japan, Korea, India, Türkiye, the Gulf and the rest of Asia - each with its local method, Asr school and prayer names
• Calculated on your phone: no data roaming needed
• A welcome card when you arrive tells you what changed

MUSAFIR MADE SIMPLE
• See how far you are from home and whether you may shorten (qasar) and combine (jamak) your prayers
• Shafi'i (81 or 89 km, up to 3 days) and Hanafi (78 km, up to 15 days)
• A log of the countries you've prayed in

QIBLA IN ONE GLANCE
• A calm compass that lights up and taps when you face the Kaaba
• Bearing and distance to Makkah

A SKY THAT MOVES WITH YOU
• The background follows the real sun where you are - dawn rose at Subuh, gold at Asar, ember at Maghrib
• Home Screen and Lock Screen widgets, and a Live Activity countdown in the Dynamic Island

ALSO
• Nearby masjid and musollah via Apple Maps
• Prayer reminders, Jumaat on Fridays, Hijri date with ±2 day adjustment, 24-hour time

PRIVATE BY DESIGN
No third-party ads. No account. No tracking. Your location never leaves your phone.

Musafir guidance is general information, not a fatwa - when unsure, follow your local religious authority.

## App Privacy (nutrition label)

**Data Not Linked to You** - only if someone submits: *User Content → Photos* and
*Other User Content* (a mosque timetable photo and what they type), purpose App
Functionality, not linked to identity, no tracking. Everyone else: nothing collected.
Location is used on-device only. Network requests: official timetables (year, JAKIM
zone code or Kemenag regency name), data/mosques.json, Apple Maps search, and
voluntary submissions. No analytics or crash SDKs.

## Screenshots

From the CI `screenshots` branch (6.9" iPhone): 1 Today (Singapore), 2 Today
(just landed in Hanoi, welcome card), 3 Journey (musafir), 4 Qibla, 6 Masjid.
Suggested captions:
1. "Know when to pray, wherever you land"
2. "Switches the moment you arrive"
3. "Jamak & qasar, worked out for you"
4. "Face the Kaaba in one glance"
5. "Find a masjid or musollah nearby"

## What to test (TestFlight notes)

- Allow location; check times against your mosque or the MUIS/JAKIM app.
- Settings → Live countdown, then lock the phone.
- Add the "Next prayer" widget (Home Screen and Lock Screen).
- Pick a city in Vietnam or Japan from the place menu to see travel mode.
