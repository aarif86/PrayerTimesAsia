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
No third-party ads. No account. No tracking. Your exact location never leaves your phone.

Musafir guidance is general information, not a fatwa - when unsure, follow your local religious authority.

## App Privacy (nutrition label)

**Data Not Linked to You**, none used for tracking:
- *Usage Data → Product Interaction*, purpose **Analytics**: anonymous app-open
  counts (UsageCounter.swift, TelemetryDeck), unless the user turns them off in
  Settings → Privacy.
- *Location → Coarse Location*, purpose **Analytics**: the city and country of the
  place in use, sent with those counts. Never coordinates.
- Only if someone submits: *User Content → Photos* and *Other User Content* (a
  mosque timetable photo and what they type), purpose App Functionality.

Precise location is used on-device only. Network requests: official timetables (year,
JAKIM zone code or Kemenag regency name), data/mosques.json, config/analytics.json,
Apple Maps search, the anonymous counts, and voluntary submissions. No analytics or
crash SDKs (the counts are a plain HTTPS request). Privacy policy URL:
https://aarif86.github.io/PrayerTimesAsia/privacy.html (prayertimes.asia/privacy.html
once the domain is set up).

## Screenshots

Apple needs two sets because the app also runs on iPad: 6.9" iPhone
(1320 × 2868) and 13" iPad (2064 × 2752). Captioned, ready to drag in:
`design/store/app-store/iphone-*.png` and `ipad-*.png`.

To redo them: Actions → **Store screenshots** → Run workflow (takes the raw
shots on a Pro Max and an iPad Pro 13" simulator and puts them on the
`store-screenshots-raw` branch), then
`python3 tools/store_frames.py iphone RAW_DIR design/store/app-store` (and `ipad`).

Captions, in order:
1. "Know when to pray, wherever you land"
2. "Switches the moment you arrive"
3. "Jamak & qasar, worked out for you"
4. "Face the Kaaba in one glance"
5. "Find a masjid or musollah nearby"
6. "Qibla Day and the shadow stick"
7. "A sky that follows the sun"

## App Review Information

Sign-in required: **No**. Contact: Aarif Raziff, phone and email.

Notes (paste as is):

```
Prayer Times Asia shows the five daily Muslim prayer times and the qibla (direction of Makkah) for Asia. It is free, has no account, no ads and no in-app purchases.

Location: the app asks for location while in use, to pick the official timetable for the user's country and zone (MUIS in Singapore, JAKIM in Malaysia) and to point the qibla compass. Times are worked out or looked up on the device; exact coordinates are never sent anywhere. If location is declined, the user can pick a city from the list.

To see travel mode without travelling: Prayer tab → tap the place name → pick a city in Vietnam or Japan. A welcome card explains how the times changed, and the Journey tab shows the traveller (musafir) rules.

Notifications are optional prayer alerts the user turns on.

The app is open source (GNU AGPL 3.0), published by NASAR PTE. LTD.
```

## What to test (TestFlight notes)

- Allow location; check times against your mosque or the MUIS/JAKIM app.
- Settings → Live countdown, then lock the phone.
- Add the "Next prayer" widget (Home Screen and Lock Screen).
- Pick a city in Vietnam or Japan from the place menu to see travel mode.
