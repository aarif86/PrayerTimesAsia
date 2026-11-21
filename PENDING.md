# Still pending

Updated 20 November 2026. The same items are on the GitHub Project board (Issues).
What's already in the app is in [docs/website/changelog.md](docs/website/changelog.md),
and where it's heading is in [docs/website/roadmap.md](docs/website/roadmap.md).

## Waiting on you (the owner)

### Launch (phones first)

- [ ] **Apple, move the developer account to Nasar Pte Ltd** - requested 17 November. The director signs the authorisation letter. If Apple hasn't replied by 3 December, chase them at developer.apple.com/contact. Apple's emails go to the Hotmail address on the account.
- [ ] **Apple, send the app for review** - after the switch, press Add for Review and then Submit in App Store Connect. Everything else (text in English, Malay and Indonesian, screenshots, privacy, build) is already filled in.
- [ ] **Google Play review** - sent 17 November as Nasar Pte Ltd (can take up to 7 days). Google's emails go to the nasarpteltd inbox.
- [ ] **Samsung Galaxy Store** - after Google approves, upload Play's signed APK. Steps in the thread "Publish on Samsung Galaxy Store".
- [ ] **Time Sensitive prayer alerts on iPhone** - Apple Developer, Identifiers, com.prayertimesasia.app, tick *Time Sensitive Notifications*, Save. Then tell Claude. Alarms already ring through Focus; this is for the notifications.
- [ ] **Read and OK the open pull requests** - store listings (#118), masjid screen extras (#115), Malay and Indonesian app (#132, #133), one place for alerts and alarms (#136), Mac trial (#137), Android update message (#56).

### Other devices

- [ ] **Microsoft Store account for Nasar Pte Ltd** - free for companies. Needed for the Windows app. Claude can walk you through it step by step.
- [ ] **Someone with a recent Mac** - to try the Mac app once the trial build works. Your own Mac is too old to run it.
- [ ] **A quick real-device check** - when the watch and TV apps exist, a friend or a TestFlight tester checks that the alarm really rings, the wrist tap and the compass.

### Checks by people

- [ ] **Falak committee review** - send [docs/falak-review.md](docs/falak-review.md) to the MUIS Falak Committee. Their notes go on the board.
- [ ] **Worldwide sources** - read [docs/worldwide-times.md](docs/worldwide-times.md) (ideally with the falak committee) and tell Claude anything to change.
- [ ] **Native speakers** - Malay and Indonesian for the app, website and store text; Arabic, Urdu, Bangla, Turkish and French for the website pages and prayer names.
- [x] **prayertimes.sg & my designer** - credit lines added on the owner's say so (Settings, README, website Credits page). Still to hear from Ustaz Shahib Amin (Awsam Tech LLP) on how he wants to be credited. Keep "shared with the blessing of its maker" off until he agrees.

### Information Claude needs

- [ ] **Badal Haji order dates** - when orders open and the last day to order for Hajj 1448, so the Badal card can say "orders now open" in season.
- [ ] **A Vietnam masjid timetable** - to check the times in Vietnam against a real masjid.

### Accounts and safety

- [ ] **Backup person on every account** - one trusted person on the domain, Apple Developer, Google Play, GitHub, Firebase and the salam@ mailbox. Tick them off in [docs/stewardship.md](docs/stewardship.md) (who, never passwords).
- [ ] **Second contact on the domain** - auto-renew is on. Add a second contact email in Hostinger.
- [ ] *(Optional)* **Usage counts (TelemetryDeck)** - paste an App ID into `config/analytics.json`. Steps in [docs/analytics.md](docs/analytics.md).
- [ ] *(Optional)* Move the repo into a Nasar Pte Ltd GitHub organisation.
- [ ] *(Later)* **Diyanet timetable account** - a free account at awqatsalah.diyanet.gov.tr gives Diyanet's exact tables for Türkiye.
- [ ] OK to tidy old work branches.

## Waiting on Claude (do when asked)

- [ ] Mac, Apple Watch, Wear OS, Windows and TV apps, one by one after the phones launch (plan agreed 20 November).
- [ ] Time Sensitive alerts in the app (after the Apple setting is on): add the capability and a fresh signing profile.
- [ ] Retake store screenshots in Malay and Indonesian once the whole app is translated.
- [ ] Badal Haji season wording on the Prayer screen (after the dates arrive), and Badal.my for Malaysian users (when that site is ready).
- [ ] Hari Raya Aidilfitri 1448 prayer sessions: when MUIS posts its list (about early March 2027), type it into `data/eid-sg.json`. Also recheck `data/friday-sg.json` against the MUIS Friday prayers page.
- [ ] Masjid screen pilot with two or three masjids in Singapore.

## Done

- [x] Web app and website online, on prayertimes.asia with HTTPS (prayertimesasia.com forwards). Search engines let in on 19 November (soft launch).
- [x] salam@prayertimes.asia mailbox, with a thank-you reply and forwarding.
- [x] Google Play account for Nasar Pte Ltd, verified, D-U-N-S 599628730.
- [x] Apple licence agreement accepted, TestFlight working (build 40 on 20 November).
- [x] App Store listing, screenshots and privacy answers filled in (not submitted).
- [x] London Unified Prayer Timetable key added as a secret.
- [x] One shared set of expected prayer times for iPhone, Android and web tests ([`testdata/`](testdata/)).
