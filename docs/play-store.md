# Google Play listing - Prayer Times Asia

Copy-paste ready for Play Console. Character limits checked. The App Store
version is in [app-store.md](app-store.md); the build steps are in
[android/README.md](../android/README.md) → *Google Play releases*.

## Account and app

| Field | Value |
|---|---|
| Developer account | Organisation: NASAR PTE. LTD. (D-U-N-S 599628730) |
| Developer website | https://nasardigital.com |
| App name | Prayer Times Asia |
| Package name | com.prayertimesasia.app (fixed forever after the first upload) |
| Default language | English (United Kingdom) - en-GB |
| App or game | App |
| Free or paid | Free |
| Category | Lifestyle |
| Tags | Religion, Travel, Reference (pick up to 5 that Play offers) |
| Contact email | salam@prayertimes.asia |
| Website | https://aarif86.github.io/PrayerTimesAsia/ (prayertimes.asia once the domain is set up) |
| Privacy policy | https://aarif86.github.io/PrayerTimesAsia/privacy.html |

## Short description (78 / 80)

```
Prayer times & qibla across Asia. Official MUIS & JAKIM times, offline, no ads
```

## Full description (about 1,900 / 4,000)

```
Prayer times and qibla for Muslims living and travelling across Asia.

Most prayer apps either stop working when you cross a border, or use one global setting for everyone. Prayer Times Asia knows how each country calculates its prayer times, and switches for you the moment you land.

AT HOME, EXACT
• Singapore: the official MUIS timetable
• Malaysia: the official JAKIM e-Solat timetable for your zone (found automatically, or pick it yourself)
• Indonesia: Kemenag's method
Downloaded once a year and kept on your phone, so it works offline.

ON THE ROAD, READY
• Vietnam, Thailand, Japan, Korea, India, Türkiye, the Gulf and the rest of Asia, each with its local method, Asr school and prayer names
• Calculated on your phone: no data roaming needed
• A welcome card when you arrive tells you what changed

MUSAFIR MADE SIMPLE
• See how far you are from home and whether you may shorten (qasar) and combine (jamak) your prayers
• Shafi'i (81 or 89 km, up to 3 days) and Hanafi (78 km, up to 15 days)
• A log of the countries you've prayed in

QIBLA IN ONE GLANCE
• A calm compass that lights up and buzzes when you face the Kaaba
• Bearing and distance to Makkah
• Falak tools: Qibla Day, rashdul qiblat and the shadow stick

YOUR MASJID
• Find a masjid or surau nearby (OpenStreetMap)
• Set your own masjid to see its jamaah times and a countdown to iqamah

A SKY THAT MOVES WITH YOU
• Five Prayer screen styles, with a background that follows the real sun where you are
• Home screen widgets: next prayer with a live countdown, and today's timetable

ALSO
• Prayer alerts on time, early reminders and a Subuh wake-up, even after a restart
• Jumaat on Fridays, Hijri date with ±2 day adjustment, 24-hour time
• Move your settings to a new phone with a QR code

PRIVATE BY DESIGN
No ads. No account. No tracking. Your exact location never leaves your phone. Free, and open source.

Musafir guidance is general information, not a fatwa. When unsure, follow your local religious authority.
```

## Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512 × 512 PNG | `design/store/play/icon-512.png` |
| Feature graphic | 1024 × 500 PNG | `design/store/play/feature-graphic.png` |
| Phone screenshots (2 to 8) | 1080 × 1920 | `design/store/play/phone-*.png` |

Captions on the screenshots, in order:
1. "Know when to pray, wherever you land"
2. "Switches the moment you arrive"
3. "Jamak & qasar, worked out for you"
4. "Face the Kaaba in one glance"
5. "Find your masjid, see its iqamah"
6. "Five looks for your Prayer screen"

## App content (Policy → App content)

Answer each card like this:

- **Privacy policy:** the link above.
- **App access:** *All functionality is available without special access.* (No login.)
- **Ads:** *No, my app does not contain ads.*
- **Content rating:** start the questionnaire, category *Reference, News, or Educational*. Answer **No** to everything (violence, sexual content, language, drugs, gambling, user-generated content shared with others, location shared with other users). Expected result: Everyone / PEGI 3.
- **Target audience:** *13-15, 16-17 and 18 and over*. Leave the under-13 boxes unticked: ticking them adds the Families programme rules, which an all-ages religious app doesn't need. *Appeal to children:* No.
- **News app:** No.
- **COVID-19 tracing:** Not a tracing app.
- **Government app:** No (it shows official timetables but isn't made by MUIS or JAKIM).
- **Financial features:** None.
- **Health:** None.
- **Data safety:** see below.

### Data safety

*Does your app collect or share any of the required user data types?* **Yes**
*Is all of the user data collected by your app encrypted in transit?* **Yes**
*Which account creation methods does your app support?* **My app does not allow users to create an account.**
*Data deletion:* not needed (no accounts; counts are anonymous).

Data types collected (for each: **Collected** yes, **Shared** no, **Processed ephemerally** no, **Required or optional** *Users can choose whether this data is collected*, **Purpose** *Analytics*):

| Section | Data type | Why |
|---|---|---|
| Location | Approximate location | The city and country of the place in use, sent with the usage counts. Never coordinates. |
| App activity | App interactions | Anonymous app-open counts (TelemetryDeck). |
| Device or other IDs | Device or other IDs | The random number made on the phone to count people, not visits. |

Not collected: precise location (used on the phone only), personal info, photos (the camera is used only on the phone for the Falak shadow stick and scanning a settings QR code), contacts, messages, files, health, financial info.

Counts are only sent once `config/analytics.json` has a TelemetryDeck App ID, and never when Settings → Privacy → *Share anonymous usage counts* is off. If counts stay off for good, answer *No* to the first question instead.

### Permissions Play may ask about

- **Exact alarms (`SCHEDULE_EXACT_ALARM`):** prayer alerts must fire on the minute. This is the user-granted permission, so no declaration form is needed. If Play asks, the answer is "Prayer time alerts the user sets up".
- **Location (foreground only):** to pick the right official timetable and work out times and qibla. No background location.
- **Camera:** Falak shadow stick and scanning the "Move my settings" QR code. Nothing is saved or sent.

## Testing tracks

- **Internal testing** (up to 100 people, no Google check): family and friends. Testers → Create email list → add their Gmail addresses → copy the join link.
- **Production:** the public release. An organisation account can go straight here; a personal account would first need 12 testers in closed testing for 14 days.
