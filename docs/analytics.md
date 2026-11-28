# Usage counts: who uses Prayer Times Asia, and where

One dashboard (TelemetryDeck) shows the website, the web app, the masjid screens
and both phone apps. Official install numbers stay in App Store Connect and
Google Play Console (see the end of this page).

Nothing is counted until you finish the sign-up below. The code is already in every app.

## Turn it on (about 5 minutes, once)

1. **Sign up** at https://dashboard.telemetrydeck.com/register (free; email and password).
   The free plan includes 50,000 events a month. See "How far the free plan goes" below.
2. **Create an app** called `Prayer Times Asia`. Use one app for everything: iPhone,
   Android, web and masjid screens all go into it, and the charts can split them apart.
3. **Copy its App ID** (it looks like `B3F1A2C4-1234-5678-9ABC-DEF012345678`).
4. **Paste it into the repo.** On GitHub, open
   [config/analytics.json](../config/analytics.json), tap the pencil, and put the ID
   between the quotes after `"telemetryDeckAppID":`. Commit to main.

That's all. The website picks it up on the next publish, which this commit starts by
itself. The web app, the masjid screens and the phone apps check the file about twice a
day, so counts start within a day. No app update is needed.

To **stop all counting**, change `"enabled": true` to `"enabled": false` in the same
file and commit.

## What you can see

| Question | Where it comes from |
|---|---|
| How many people visit the website, from which countries, on phone or computer, from which link | Every public website page (TelemetryDeck's web script: page views with country and referrer), added to each page when the site is published (`tools/inject_visitor_counts.py`). Left out: the three form pages that carry details in their link (verify, note, announcement), the 404 page, the web app and the TV screen (which count themselves) |
| How many people use the apps each day and month | `App.opened` events, counted by user |
| How many times it is used | `App.opened` (counts once per hour per device, so a quick check and a re-open don't count twice) |
| Which city and country people pray in | `Place.city` and `Place.country` on every event |
| iPhone, Android or web; app version; language | `App.platform`, `App.version`, `App.language` |
| New installs (including people adding the web app to their Home Screen) | `App.installed` (the first open on a device), plus `Web.installedToHomeScreen` |
| Which masjids run the screen, and whether each is still on | `Screen.running` with `Masjid.name` (sent at start and every 6 hours; a masjid missing for a day means its TV is off or offline) |
| How masjids set up their screen | `Screen.look`, `Screen.language`, `Screen.orientation` |
| How many minutes a day people use it, how many times a day they open it, and which screens they use | `App.daySummary`, one per device per day used, sent on the next open: `Day.date`, `Day.minutes`, `Day.minutesBand` (under 1, 1 to 5, 5 to 15, 15 to 30, 30 to 60, over 60), `Day.opens` (every time the app comes on screen), `Day.screens` and `Used.prayer`, `Used.qibla`, `Used.falak`, `Used.masjid`, `Used.settings` (true or false) |
| How people set the app up (changes daily, so a chart shows what most people choose) | `App.daySummary` also carries `Pref.look`, `Pref.theme`, `Pref.language` (`auto` unless they chose one), `Pref.alertPrayers` (0 to 5) and `Pref.alertsOn`, `Pref.azanSound`, `Pref.azanVoice`, `Pref.azanLength`, `Pref.ownAzan`, `Pref.alarms` (how many), `Pref.largeText`, `Pref.tracker`, `Pref.myMasjid`, `Pref.widgets` (how many on the phone; iPhone and Android only, the web is 0). Short words and yes or no only |
| Whether Qibla and Falak are really used, not just opened | `Did.qiblaCompass` (compass working), `Did.qiblaFaced` (turned to face the Qibla), `Did.falakShadow`, `Did.falakLevel`, `Did.falakAR`, true or false, in the same daily note |
| How many TVs get paired, and whether setup finishes | `Screen.paired`, sent once by the TV when a phone pairs with it (same keys as `Screen.running`). Compare with `Screen.running` for TVs that carry on |
| Which buttons on the website get pressed | `Web.click` with `Click.target`: `store-ios`, `store-android`, `review-ios`, `review-android`, `testflight`, `web-app`, `print`, `join`, `leave`, `note`, `verify`, `announcement`, `new-look`, `masjid`, `tv`, `ramadan`, `barakah-picks`, `social-instagram`, `social-facebook`, with `Page.path`. From `site/track.js` |
| Where a website visit came from | `Web.landed` with `Page.from` (`iphone-app`, `android-app`, `web-app`), sent when a link from an app carries `?from=` (Join and Help verify links) |
| Whether a website form was sent | `Web.formSent` with `Form.page` (`join`, `leave`, `note`, `verify`, `masjid`, `announcement`), from the form's own message to the page. Check that it fires before relying on it |
| Installs that came from the website | Not in TelemetryDeck. The Google Play links on the website carry `referrer=utm_source=website`, so the Play Console shows them under acquisition |
| Taps on Join, Help verify, Note to the makers, Rate and review inside the apps | `Did.tapJoin`, `Did.tapVerify`, `Did.tapNote`, `Did.tapReview` in the daily note |
| Where masjid screen setup stops | `Screen.setup` with `Setup.step`: `opened`, `linkMade`, `sentToTv`, `tvCodeFailed` |
| Roughly how many people have it open now | `App.opened` in the last hour (the nearest to live; nothing is sent while the app sits open) |
| How often each Barakah Picks card is seen and tapped | `Card.seen` (once a day per card per device) and `Card.tapped`, with `Card.id`, `Card.kind`, `Card.placement` |

### Charts worth making first

In the TelemetryDeck dashboard, add an Insight for each. Filter by **signal type** and
**break down by** a payload key:

1. **Daily users**: signal type `App.opened`, users per day, broken down by `App.platform`.
2. **Where people pray**: `App.opened`, users in the last 30 days, broken down by `Place.country`
   (then a second chart by `Place.city`).
3. **New installs**: `App.installed`, count per week, broken down by `App.platform`.
4. **Masjid screens on today**: `Screen.running`, last 24 hours, broken down by `Masjid.name`.
5. **App versions in use**: `App.opened`, broken down by `App.version`.

6. **Barakah Picks**: `Card.seen` and `Card.tapped`, broken down by `Card.id`. How to
   turn these into a sponsor report is in [community-cards.md](community-cards.md).
7. **Minutes a day**: `App.daySummary`, last 30 days, average of `Day.minutes`, and a
   second chart counted by user and broken down by `Day.minutesBand`.
8. **Opens a day**: `App.daySummary`, average of `Day.opens`.
9. **Which screens get used**: `App.daySummary`, users, filtered to `Used.qibla` is
   `true` (one chart per screen), or broken down by `Day.screens`.
10. **Open in the last hour**: `App.opened`, last hour, users. This is as close to
    "open right now" as the counts get.

Events from test builds and from a computer on your home network are marked as tests.
TelemetryDeck hides them unless you switch on "Test mode".

## What is never sent

No coordinates or street, no IP address kept, no names, emails, phone numbers or
Apple or Google accounts. The ID is a random number made on the device, which
TelemetryDeck scrambles again before storing. People can switch counting off in
**Settings → Privacy → Share anonymous usage counts**. Masjid committees can untick
"Let Prayer Times Asia know this screen is running" on the setup page. Browsers set to
Global Privacy Control are never counted. All of this is on the public
[privacy page](../site/privacy.html).

## How far the free plan goes

Each app open is one event (two on the very first open), each day of use adds one
`App.daySummary`, a Barakah Picks card adds about one more, and each masjid screen sends
about 4 a day. As a rough guide, 50,000 a month covers about 500 people opening the
app most days plus 30 masjid screens. Past that a paid plan is needed (see
telemetrydeck.com/pricing). When the limit is reached, TelemetryDeck stops
counting until the next month or an upgrade. Nothing breaks in the apps.

## Official install numbers

- **iPhone:** App Store Connect → Apps → Prayer Times Asia → **Analytics**: downloads,
  first-time downloads, active devices and country. While it is in testing,
  **TestFlight** → Testers shows who installed which build.
- **Android:** Play Console → Prayer Times Asia → **Statistics** (or the Dashboard):
  installs, active devices, country, Android version. Available once the app is on Google Play.

These count store downloads. TelemetryDeck counts people who actually open the app.
The two numbers will differ.

## For developers

The code is in `web/src/services/usage.ts`, `ios/PrayerTimesAsia/Services/UsageCounter.swift`
and `android/app/src/main/kotlin/com/prayertimesasia/app/data/UsageCounter.kt`. They use
the same event names and payload keys. There's no SDK, just one HTTPS POST to
`https://nom.telemetrydeck.com/v2/` ([Ingest API v2](https://telemetrydeck.com/docs/ingest/v2/)).
Keep the three in step, and update the App Store privacy label (docs/app-store.md), the
Play Data safety form (android/README.md) and `site/privacy.html` when what is sent changes.
