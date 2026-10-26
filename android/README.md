# Prayer Times Asia for Android

The Android version of [Prayer Times Asia](https://github.com/aarif86/PrayerTimesAsia): accurate, offline prayer times for Muslims living and travelling across Asia. Kotlin, Jetpack Compose and Material 3. No ad networks, no analytics, no accounts, no Google Play services; location stays on the phone.

Lives in `android/` of the Prayer Times Asia project, next to `ios/` and `web/`. (If it ever needs its own repository, `git subtree split --prefix=android` gives it its full history.) Previously:

```sh
git push git@github.com:<owner>/<new-repo>.git android:main
```

## Structure

| Path | What it is |
| --- | --- |
| `core/` | Pure Kotlin/JVM: the prayer engine and everything that decides a time. A line-by-line port of the iOS `Core/` folder: the praytimes.org solar model with each authority's fitted offsets (MUIS, JAKIM, Kemenag and 10 others), country profiles and naming styles, the Umm al-Qura calendar, blessed times, Falak (Qibla Day, rashdul qiblat, shadow stick), musafir rules, JAKIM zones, the MUIS/JAKIM/Kemenag parsers, mosque profiles, the calendar sanad, preferences, and the resolver (official table > masjid > calculation). Also the Overpass parser and an offline list of Asian cities. |
| `core/src/test/` | JUnit tests: the iOS test suite's expected values, plus exact-minute matches with the iOS app's own screenshots (Hanoi and Makkah) and a full-century check of the Hijri calendar. |
| `app/` | The Android app (`com.prayertimesasia.app`, minSdk 26, target/compile SDK 35). |
| `app/.../ui/today/` | The Prayer screen in all five styles: Centre Dial (default), Side Dial, Day Dial, Sun Path, Colour Bands. |
| `app/.../ui/{qibla,falak,masjid,settings,journey,onboarding,makers}/` | The other tabs and sheets. |
| `app/.../data/` | Official timetable downloads and disk cache, `mosques.json` / `calendar.json`, location (platform `LocationManager` + `Geocoder`), preferences. |
| `app/.../alarms/` | Exact prayer alerts with `AlarmManager`, early reminders, Subuh wake-up, reschedule on boot / time change. |
| `app/.../widget/` | Glance home-screen widgets: Next prayer (small and medium, live countdown) and Today's timetable (Side Dial, Colour Bands or Day Dial, following the Prayer screen style). |
| `app/src/test/` | Roborazzi JVM screenshots of every screen (Robolectric, no emulator) and the alarm-plan test. |
| `.github/workflows/android.yml` | CI: core tests, debug APK, unsigned release (checks R8), screenshots. |

## Build and install

Needs JDK 17 and the Android SDK (Android Studio Ladybug or newer, or the command-line tools).

```sh
./gradlew :core:test                 # the engine's tests (JVM only, no Android SDK needed)
./gradlew :app:assembleDebug         # app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:recordRoborazziDebug  # screenshots -> app/build/outputs/roborazzi/
```

Every push to `main` that touches `android/` runs CI, which uploads the debug APK as the `prayer-times-asia-debug-apk` artifact of the run (Actions tab) and force-pushes the screenshots to the `screenshots-android` branch:

```sh
git fetch origin screenshots-android
git show origin/screenshots-android:01-today-list-night.png > today.png
```

### Demo mode (screenshots, store listing)

A fixed place and, optionally, a fixed clock. Nothing is saved or scheduled in demo mode.

```sh
adb shell am start -n com.prayertimesasia.app/.MainActivity \
  --ez demo true --es variant home --es style bands --es appearance dark \
  --es tab prayer --es now 2026-10-25T04:49:00+08:00 --ez more false
```

`variant`: `home` (Pasir Ris, Singapore), `travel` (just landed in Hanoi), `visitor` (from Sydney in Kuala Lumpur), `makkah`. `style`: `list`, `centre`, `dial`, `sunpath`, `bands`. `appearance`: `auto`, `light`, `dark`. `tab`: `prayer`, `qibla`, `falak`, `masjid`, `settings`. `--ez aligned true` shows the Qibla compass aligned.

## Parity with iOS

| Feature | Android | Notes |
| --- | --- | --- |
| Prayer engine, methods, offsets, Asr schools, high-latitude rule | Same | Ported line by line; the iOS test values pass, and calculated days match the iOS app to the minute. |
| Official MUIS / JAKIM / Kemenag tables, cached for offline | Same | Same endpoints and parsers; MUIS dataset ids also read from `config/official-sources.json` on `main`. |
| Masjid (Grade B) profiles and jamaah, second-source disagreements | Same | From `data/mosques.json` on `main`. |
| Five Prayer screen styles, palette button (tap cycles, hold to pick, remembered) | Same | |
| Automatic / Light / Dark button; Automatic follows the sky with the soft night | Same | |
| Living Sky on every tab, stars, breathing sun and clouds in light mode | Same | Clouds are soft gradients rather than blurred shapes (blur needs Android 12). |
| Show more: Dhuha, middle and last third of the night (Imsak in Ramadan), in English | Same | |
| Day navigation (‹ › and swipe), Hijri date with ± adjustment, calendar sanad sheet | Same | |
| Source badge and sanad sheet with the grades | Same | The "Help verify" submission forms link to CONTRIBUTING.md instead of in-app forms. |
| Names follow the user, local name when travelling | Same | |
| Tabs: Prayer, Qibla, Falak, Masjid, Settings; Journey optional | Same | Musafir features offered on the arrival card. |
| Prayer tracker with streak and excused days | Same | |
| Alerts at the exact time, early reminder, Syuruk alert, Subuh wake-up | Same idea | `AlarmManager` exact alarms (asks for "Alarms & reminders" on Android 12+, falls back to inexact if refused), rescheduled on boot, update, time and time-zone change. The wake-up is an alarm-channel notification rather than iOS 26's AlarmKit alarm. |
| Qibla compass, green aligned state with haptic, steps, calibration hint | Same | Rotation-vector sensor, corrected to true north with the magnetic declination for where you are. |
| Falak cards, level | Same | |
| Falak AR | Different | A camera view with a compass overlay (qibla, sun, shadow direction) instead of ARKit's floor-anchored stick; no ARCore, so it works on any phone with a camera and compass. |
| Masjid & musollah search, directions | Different | OpenStreetMap (Overpass API) on a radar around you, instead of Apple Maps. Directions open in whatever maps app the phone has (`geo:` intent, OSM web fallback). |
| City search | Different | Built-in list of ~100 Asian cities (offline) plus the phone's own geocoder when it has one; no third-party search service. |
| Makers: Badal.sg (Singapore) / NasarDigital, under Show more, (i) on Masjid, Settings with Show offers | Same | Same URLs and utm parameters. |
| Widgets | Mostly | Next prayer (small, medium) and Today's timetable in Side Dial, Colour Bands and Day Dial. No Lock Screen widget or Live Activity (Android has no equivalent); Sun Path uses the list layout in the widget. |
| Subscribe to the official calendar feed | Mostly | Opens the `webcal://` feed; calendar apps that accept URL subscriptions handle it. |

## Known gaps and things not verified

- **Not run on a device in this build session.** CI compiles, runs the unit tests and renders every screen under Robolectric, but sensors (compass, level), the camera view, location and geocoding, notifications/alarms firing, and Glance widgets on a real launcher were not exercised. Please try them on a phone first.
- Screenshots are JVM renders (Robolectric native graphics), so the status bar and system navigation bar are not shown, and system fonts can differ slightly from a phone.
- The screenshot tests seed the published MUIS times for 25 October 2026 (from the iOS app's download) so the "Official · MUIS" badge shows offline; other days in screenshots are calculated.
- Display font is Nunito (SIL OFL, bundled) in place of SF Pro Rounded.
- The app is English only, like the iOS app.

## Publishing on Google Play (owner steps)

1. Create a Google Play developer account (one-time fee) and the app with package `com.prayertimesasia.app`.
2. Create an upload key and keep it safe (never commit it):
   `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`
   Enrol in Play App Signing so Google holds the app signing key.
3. Add a `signingConfigs { create("release") { ... } }` block to `app/build.gradle.kts` that reads the keystore path and passwords from environment variables or `~/.gradle/gradle.properties`, and set `signingConfig` on the `release` build type. Build with `./gradlew :app:bundleRelease` and upload the `.aab`.
4. Bump `versionCode` (and `versionName`) in `app/build.gradle.kts` for every upload.
5. Play Console declarations: Data safety (no data collected or shared; location used on device only; network requests send only a year, zone code, regency name, or for the Masjid tab the search area), the **exact alarm** permission (prayer alerts are user-requested alarms at a specific time), location permission (foreground only), camera (Falak view, nothing recorded), and a privacy policy URL (the website's).
6. Store listing: reuse the copy in `docs/app-store.md` on `main`, the icon (`icon-1024.png`, downscaled to 512 px) and screenshots from demo mode on a real phone.

## Licence and credits

MIT, like the iOS app. Official timetables: MUIS via data.gov.sg (Singapore Open Data Licence v1.0), JAKIM e-Solat, Kemenag via api.myquran.com. JAKIM zone points from mptwaktusolat/malaysia.geojson. Places © OpenStreetMap contributors (ODbL). Nunito font © The Nunito Project Authors (SIL Open Font License 1.1).
