# Masjid screen: what we learned from other screens

The masjid screen is a TV on the wall that shows today's prayer times, the
countdown to the next one, the iqamah, and the masjid's notices. Other places
have used screens like this for a long time. This page lists what they learned
and what we took from each.

## Where similar screens are used

| Setting | What the screen does | What we take from it |
|---|---|---|
| **Airports and train stations** (departure boards) | One "next" item large, the rest in a fixed grid. The status changes (Boarding, Final call, Departed). Many airports switch languages every few seconds instead of cramming two onto one line. Long lists page, they don't scroll. | The next prayer is the biggest thing. The six times sit in fixed places that never move. Each prayer has a clear status: coming up, azan now, iqamah, in prayer. Names switch between the masjid's languages (Malay, then Arabic) rather than showing both at once. Notices change page by page. There is no scrolling ticker. |
| **Bank, clinic and post office queues** | A chime and a colour change when the number changes. People look up only when something changes. | The screen changes colour when the azan time arrives, so people across the hall notice. There is no sound by default, because the masjid has its own muazzin. |
| **Sports shot clocks and exam-hall clocks** | The last seconds are huge and change colour, and nobody has to do sums. | Between azan and iqamah the screen shows a large iqamah countdown. In the last minute the seconds are shown large in a warm colour. |
| **Churches, theatres and cinemas** | The screen goes dark or quiet during the service or film. | Once iqamah starts the screen dims to a near-black "Prayer in progress" for ten minutes (forty on Friday), so it does not distract the rows in front of it. |
| **Synagogue zmanim boards** | Daily times are calculated automatically, and the committee overrides only what differs (minyan times). The board shows memorial notices. There is a mode for Shabbat, when nobody touches it. | Times come from the official timetable automatically. The committee sets only the iqamah gap or a fixed jamaah time per prayer, plus the Jumu'ah time. It never types the five daily times. Notices are a simple list, which leaves room for death notices (khairat kematian) and kuliah schedules. |
| **Restaurant menu boards** ("dayparting") | Content changes with the time of day: breakfast, lunch, dinner. | The layout changes by itself on Friday (Jumu'ah, khutbah time) and in Ramadan (Imsak and Iftar are added and highlighted). |
| **Digital signage products** (ScreenCloud, Yodeck, OptiSigns, piSignage) | Setup is done from a phone, never with a TV remote. Everything is cached so the screen keeps playing when the internet drops, and the player restarts itself after a power cut. Built-in smart TV browsers are called unreliable; a small media player plugged into the TV is recommended. Burn-in is avoided by moving content slightly. | The committee sets up the screen on a phone and gets one link. The TV opens that link once and remembers it. Prayer times are calculated on the device, so they need no internet; the official table is downloaded once a year and kept. The screen refreshes itself quietly at 3 am, keeps the TV awake, and shifts its content a few pixels every few minutes to protect the panel. We recommend a cheap Android TV box or Fire TV stick over the TV's own browser. |
| **Road and wayfinding signs** | Letter height follows reading distance: about 25 mm of letter height for every 10 m. Use high contrast and plain shapes. | Sizes are set relative to the screen, not in fixed pixels. On a 55" TV the next-prayer countdown is about 15 cm tall and the daily times about 6 cm, readable from the back of a large hall. The screen uses a dark background with light text, which also suits a dim prayer hall at Subuh and Isyak. |
| **Mosque products today** (Mawaqit, Masjidi, Malaysian "jam informasi digital" panels) | Free screens with iqamah times, announcements, multi-screen sync and portrait or landscape layouts. The Malaysian panels are fixed LED clocks, often donated. | Free is expected. Portrait and landscape both work. Our edge is the official MUIS, JAKIM and Kemenag timetables, local prayer names, and Hijri dates that follow the local authority's adjustment. |

## What the first version does

- **Times:** official table first (MUIS, JAKIM by zone, Kemenag by regency), then calculation. It works offline. The source is shown small at the bottom, as on the app.
- **Next prayer:** a large countdown. It turns into "Azan now", then an iqamah countdown with "Please silence your phone", then a dimmed "Prayer in progress".
- **Six times in fixed places:** Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak, each with its iqamah time. The current one is highlighted.
- **Friday:** Zohor becomes Jumaat and shows the khutbah time.
- **Ramadan:** Imsak (10 minutes before Subuh) is added and Maghrib is labelled Iftar.
- **Languages:** prayer names in Malay, Indonesian, English (International), South Asian or Turkish, optionally switching every 8 seconds with Arabic. Labels in English, Malay or Indonesian.
- **Notices:** up to 8 short notices, shown one at a time, changing every 12 seconds.
- **Unattended running:** keeps the TV awake where the browser allows it, shifts slightly every few minutes against burn-in, reloads at 3 am when online, and remembers its settings after a power cut.
- **Setup:** a form on a phone (masjid name, place, iqamah per prayer, Jumu'ah time, notices, language). It gives one link to open on the TV, and a live preview.
- **Portrait or landscape:** the layout follows the screen.
- **QR code for jemaah:** a small code in the bottom-right corner ("Scan for iqamah times"; on by default, can be turned off in setup). Scanning it opens the web app, which asks before adding the masjid as "your masjid". From then on its iqamah times show as "Jamaah" under each prayer, with a countdown between azan and iqamah, whenever the phone is within 10 km of the masjid. The iPhone and Android apps read the same link (`prayertimesasia://masjid?...`), and the web app offers "Open this in the app". Idea taken from Al-Harameen's QR stickers for mosques.

## After a power cut, and without internet (checked 21 Nov 2026)

Tested with a fresh browser profile: set up the screen online, closed the browser (the "power cut"),
opened it again with the network off, and went to `/app/screen/` with no link. The masjid's name and the
MUIS official times came back. What makes that true, and where it stops:

- The settings are inside the link and are also saved in the TV browser's storage, so the plain
  `/app/screen/` address shows the same masjid.
- The page itself is kept by the service worker after the first visit with internet.
- The year's official timetable is downloaded once and kept. Next year's is fetched from December.
  If the TV has no internet across New Year, the screen falls back to calculated times and the label says so.
- The TV does not open the browser by itself after a power cut. Someone opens the browser again, or a
  TV box is set to open the page when it starts (most "kiosk" or "start up app" settings can do this).
- The clock comes from the TV. Many TV boxes set their clock from the internet, so after a power cut
  with no internet the clock (and so the countdown) can be wrong until the internet comes back.
- Ramadan and Raya announcements and app updates need internet; the screen keeps what it last had.

Public wording on the setup page: "The TV keeps your settings. After a power cut, open the browser again
and your screen comes back. Once it has opened with internet, it keeps showing the times even when the
internet drops."

## Live screen count and dashboard

- Each TV (when "Count this screen as on" is ticked) sends a random code made on the TV to
  `screenPing` every 15 minutes. No masjid name, no place, no IP address kept.
- `screenCount` answers how many codes were heard in the last 31 minutes. The setup page shows
  "24 masjid screens are on right now" (hidden when zero or unreachable).
- Every 15 minutes the first ping writes that count into `screenDays/{date}` (Singapore time), with how
  many screens were seen that day. `screenStats?days=` returns the daily summaries for the dashboard.
- Dashboard: `/app/screen/stats/` (not linked, not indexed). Ranges 7 and 30 days, 3, 6, 9 months, 1, 2, 3 years.
  `?demo` draws example data for screenshots.
- The ping also returns the server time; a TV clock more than 30 seconds out is corrected on screen while
  online, and more than 2 minutes out shows a small note for the committee.
- Limits: a network can add 12 new screens a day. `limits/` docs carry `expires`; turning on a Firestore TTL
  policy on `expires` (collection group `limits`) clears them automatically.
- Cost: about 96 writes a day per screen, inside the free allowance up to roughly 200 screens, cents beyond.

## Later (not in this version)

- **Pairing code:** the TV shows a 6-letter code, the committee types it on a phone, and notices update on the TV within a minute without opening a new link. This needs a small backend (the Firebase project already exists).
- **Several screens in one masjid** kept in step (main hall, women's section, foyer).
- **Optional chime** at azan and one minute before iqamah, for masjids that want it.
- **Store-listed Android TV app** that opens the screen at power-on, if masjids find the kiosk browser fiddly.
- **Masjid's own timetable** (Grade B) from `data/mosques.json`, once a masjid shares its printed timetable.

## Recommended hardware

A 43" to 65" TV, plus an Android TV box or a Fire TV stick (about S$40 to S$90).
Install a kiosk browser that opens one page at power-on (for example Fully Kiosk
Browser), or use Chrome and add the page to the home screen. Set the TV to turn
on with power and to keep the same input. An old tablet on a stand works for a
small surau.

## Sources

- piSignage, [Offline digital signage guide](https://blog.pisignage.com/offline-digital-signage-how-to-keep-your-screens-running-when-the-internet-doesnt-guide/): local caching, boot without network, auto-restart, emergency override.
- ScreenCloud, [Web player](https://help.screencloud.com/en/articles/10119973-screencloud-web-player): pairing codes, start at boot, smart TV browsers unreliable.
- Studio Matrx, [Legibility, size and viewing distance](https://www.studiomatrx.org/students/wayfinding-and-environmental-graphics/legibility-size-and-viewing-distance): about 25 mm letter height per 10 m.
- FAA Human Factors, [general guidance on displays](https://hfcc.dot.gov/publications/docs/GeneralGuidance/zz_FAA_GeneralGuidanceDoc_Chapter_03_Section_01.html).
- The CJN, [Synagogue memorial displays](https://thecjn.ca/podcasts/synagogue-yahrzeit-memorials-are-going-digital): Shabbat-safe settings, memorial notices.
- [Mawaqit](https://www.mawaqit.net/) and [Masjidi](https://masjidi.app/index-en.php): free mosque screens, iqamah and announcements.
- Pahang state government, [digital information clocks for masjids](https://www.pahang.gov.my/pahang/resources/PDF/Berita/2022/(17_HB)_SEPULUH_LAGI_MASJID_TERIMA_JAM_INFORMASI_DIGITAL.pdf) (2022).
