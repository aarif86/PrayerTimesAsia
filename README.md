# Prayer Times Asia

Prayer times and qibla for Muslims living and travelling across Asia: on iPhone,
Android and the web. Free, built fisabilillah by Nasar Pte Ltd. No third-party ads,
no accounts, no tracking; location never leaves the device.

## What's where

| Folder | What it is | Status |
|---|---|---|
| [`ios/`](ios/) | The iPhone app (SwiftUI) with widgets and Live Activity | On TestFlight |
| [`android/`](android/) | The Android app (Kotlin + Jetpack Compose) with widgets | Debug APK from CI |
| [`web/`](web/) | The web app: installable, works offline | Live at aarif86.github.io/PrayerTimesAsia/app/ |
| [`site/`](site/) | The promo website for prayertimes.asia: features, how to try it, masjid partners | Live at aarif86.github.io/PrayerTimesAsia/ |
| `data/`, `config/` | Shared data every app downloads: masjid profiles, Ramadan/Eid announcements, official-source settings. **Don't move these** - apps already on phones read them from these paths. | |
| `design/` | App icon and design sources | |
| `docs/` | Changelog, roadmap, build log (for the website), App Store copy, falak review sheet | |
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

| Workflow | Runs when | Does |
|---|---|---|
| CI | `ios/` or `testdata/` changes, every pull request | Builds and tests the iPhone app, takes simulator screenshots |
| Release to TestFlight | By hand only | Signs and uploads the iPhone app |
| Android | `android/` or `testdata/` changes (pull requests too) | Tests, builds the APK, takes screenshots |
| Web | `web/`, `site/` or `testdata/` changes (pull requests too) | Tests, builds, deploys the promo site and web app to GitHub Pages (from `main` only) |
| Validate, Feeds, Firebase, TestFlight status | Their own files change / on a schedule | Data checks, calendar feeds, backend |

## Licence and promises

Free forever, no ads, no selling data, always open source: [docs/stewardship.md](docs/stewardship.md).
Code: GNU AGPL 3.0 with an app store permission ([NOTICE.md](NOTICE.md)). Data in `data/`: CC-BY 4.0.
The name and icon: [TRADEMARKS.md](TRADEMARKS.md).
