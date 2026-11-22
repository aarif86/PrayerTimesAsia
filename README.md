# Prayer Times Asia

Prayer times and qibla on iPhone, Android and the web. Asia first, now worldwide
(143 countries, each following its local religious authority first). Free, built
fisabilillah in Singapore.
No outside ads, no sign up, no tracking, and your exact location stays on your phone.

## Where it stands (20 November 2026)

- **Web app** live at [prayertimes.asia/app/](https://prayertimes.asia/app/), and the
  masjid display screen at [prayertimes.asia/app/screen/](https://prayertimes.asia/app/screen/).
- **iPhone** on TestFlight (build 40). The App Store listing is filled in and waits
  only for Apple to move the developer account to Nasar Pte Ltd.
- **Android** sent to Google Play review on 17 November, as Nasar Pte Ltd. Testers
  use the Play internal test. Samsung Galaxy Store follows after Google approves.
- **What's new** in every build: [docs/website/changelog.md](docs/website/changelog.md).
  **Where it's heading**: [docs/website/roadmap.md](docs/website/roadmap.md).

## Where it's heading

Phones launch first. Then the other screens join one by one as each passes testing,
all built from the code that already exists, so the times always match.

| Device | Built from | State |
|---|---|---|
| Mac | The iPhone app (Mac Catalyst). No qibla compass, as Macs have none | First trial build (draft PR #137) |
| Apple Watch, Apple TV | The iPhone app's shared `Core` | Planned |
| Wear OS, Android TV, Google TV | The Android app's `core` | Planned |
| Windows | The web app in a small Windows shell, Microsoft Store only | Planned |

Also in progress: the whole app in Malay and Indonesian, and one screen for every
alert and alarm (Off, Notify or Alarm for each prayer).

## What's where

| Folder | What it is | Status |
|---|---|---|
| [`ios/`](ios/) | The iPhone app (SwiftUI) with widgets, Live Activity and alarms | On TestFlight, App Store listing ready |
| [`android/`](android/) | The Android app (Kotlin + Jetpack Compose) with widgets and alarms | In Google Play review |
| [`web/`](web/) | The web app: installable, works offline | Live at prayertimes.asia/app/ |
| [`site/`](site/) | The website for prayertimes.asia, in 8 languages (English, Malay, Indonesian, Arabic, Urdu, Bangla, Turkish, French) | Live at prayertimes.asia |
| `data/`, `config/` | Shared data every app downloads: masjid profiles, Ramadan/Eid announcements, official-source settings. **Don't move these** - apps already on phones read them from these paths. | |
| `design/` | App icon and design sources | |
| `docs/` | What's new and roadmap (`docs/website/`), store guides, falak review sheet, worldwide sources, promises | |
| `tools/` | The Python reference engine and data checks every app is measured against | |
| [`testdata/`](testdata/) | The one set of expected prayer times the iPhone, Android and web tests all read | |
| `functions/` | Firebase backend for "Help verify times" submissions | |

Each app has its own README with how to build and run it.

## How work is organised

- **`main`** is always working and shippable.
- **Changes** happen on short branches named for what they are (`ios/...`, `android/...`, `web/...`, `all/...`), merged when approved.
- **The to-do list** is the GitHub Project board "Prayer Times Asia" (Issues, labelled `ios`, `android`, `web`, `all-apps`, `badal`, `design`; `waiting-on-owner` marks what needs the owner).
- **What's still open** is summarised in [PENDING.md](PENDING.md).

## Builds

How often to send updates to the stores, and how to test first: [docs/releasing.md](docs/releasing.md).

| Workflow | Runs when | Does |
|---|---|---|
| CI | `ios/` or `testdata/` changes, every pull request | Builds and tests the iPhone app, takes simulator screenshots |
| Release to TestFlight | By hand only | Signs and uploads the iPhone app, then fills in TestFlight's "What to Test" from [`ios/TestFlight/WhatToTest.en-US.txt`](ios/TestFlight/WhatToTest.en-US.txt) |
| TestFlight words | By hand only | Puts the current "What to Test" on the latest build and refreshes the beta description, without a new build |
| Release to Google Play | By hand only | Signs and uploads the Android app to Google Play |
| Android | `android/` or `testdata/` changes (pull requests too) | Tests, builds the APK, takes screenshots |
| Web | `web/`, `site/` or `testdata/` changes (pull requests too) | Tests, builds, deploys the promo site and web app to GitHub Pages (from `main` only) |
| Validate, Calendar feeds, Masjid lists, Firebase, TestFlight status, Crash check, Store screenshots, Backup | Their own files change, on a schedule or by hand | Data checks, calendar feeds, weekly masjid lists, backend, crash logs, store pictures, weekly backup |

## Thanks

The Colour Bands look and the prayer colours are inspired by prayertimes.sg & my
by [Awsam Tech LLP](https://www.awsamtech.com/), the Singapore and Malaysia app many of us
grew up with. It was built by a team at Awsam Tech LLP and redesigned by Ustaz Shahib Amin Syukran, with thanks to them both.
The prayertimes.sg & my logo is not used.

Brunei's times are the official timetable of the Ministry of Religious Affairs, Brunei
(Kementerian Hal Ehwal Ugama), read from its printed Taqwim by Faruq Rasid's
[prayertimes-database](https://github.com/ruqqq/prayertimes-database) (GPL 3.0), with thanks.

## Licence and promises

Free forever, no outside ads, no selling data, always open source: [docs/stewardship.md](docs/stewardship.md).
Code: GNU AGPL 3.0 with an app store permission ([NOTICE.md](NOTICE.md)). Data in `data/`: CC-BY 4.0.
The name and icon: [TRADEMARKS.md](TRADEMARKS.md).
