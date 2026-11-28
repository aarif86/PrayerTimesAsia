# Google Play listing - Prayer Times Asia

The text to paste (English, Malay, Indonesian) is in
[store-listings/](store-listings/README.md). This page keeps the Play Console
settings, graphics and policy answers. The App Store
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
| Website | https://prayertimes.asia/ |
| Privacy policy | https://prayertimes.asia/privacy.html |

## Short and full description

Moved to [store-listings/en.md](store-listings/en.md),
[ms.md](store-listings/ms.md) and [id.md](store-listings/id.md), including the
Ramadan swap.

## Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512 × 512 PNG | `design/store/play/en/icon-512.png` |
| Feature graphic | 1024 × 500 PNG | `design/store/play/<en|ms|id>/feature-graphic.png` |
| Phone screenshots (up to 8) | 1080 × 2160 | `design/store/play/<en|ms|id>/phone-*.png` |

The same files work for the Samsung Galaxy Store.

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

Data types collected (for each: **Collected** yes, **Shared** no (sponsors only get totals, which is not sharing user data), **Processed ephemerally** no, **Required or optional** *Users can choose whether this data is collected*, **Purpose** *Analytics*):

| Section | Data type | Why |
|---|---|---|
| Location | Approximate location | The city and country of the place in use, sent with the usage counts. Never coordinates. |
| App activity | App interactions | Anonymous app-open counts, a daily total of minutes used, opens and which screens were used, which Barakah Picks card was shown or tapped, and a daily note of short setup words (look, theme, alerts and alarms count, azan voice and length, own azan yes or no, big text, tracker, My masjid, widgets count) and whether the Qibla compass and Falak tools were used (TelemetryDeck). |
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
