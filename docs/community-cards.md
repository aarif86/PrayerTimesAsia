# Barakah Picks, our community cards and their rules

Barakah Picks is not a normal ad. Prayer Times Asia never shows Google, Facebook,
Instagram or any other outside ads, so nobody else decides what shows up next to your
salah. Instead there is one small card that we fill ourselves, with our own services
and, from time to time, a halal Muslim business or cause we checked by hand. It is safe
for the whole family. Agreed by Ustaz Aarif Raziff on 17 November 2026.

The name lives in one place in each app (`PICKS_NAME` in Makers.tsx and Makers.kt,
`picksName` in Makers.swift), so it is easy to change. In Malay it is Pilihan Barakah.

## Where the card shows

- On the Prayer screen, below the five times, and only when Show more is open.
- In Settings, under Barakah Picks (our own services only).
- One card a day. It changes at midnight, in turn, so no one card takes over.
- Anyone can turn the cards off in Settings with Show Barakah Picks.

It never shows on the azan, prayer alerts, alarms, the masjid TV screen, or the
Ramadan Berbuka moment. It never sits above the prayer times.

## Different cards for each country

Every card lists the countries it is for (`countries` in
[data/community-cards.json](../data/community-cards.json)). Someone whose home is in
Singapore sees the Singapore cards, someone in Malaysia sees the Malaysia cards, and
everyone sees the cards marked `*`. The app works out the country from the home the
user set, or where they are now. Nothing is sent anywhere to choose the card.

Right now every country sees our two cards for everywhere, Badal Haji & Umrah
(badal.sg, which takes orders from anywhere) and NasarDigital.

## Our rules for a sponsor card

Every card is read and approved by Ustaz Aarif Raziff before it goes in. We say no to
anything that breaks one of these.

1. **Halal only.** The product, the business and how it makes its money.
2. **No riba.** No conventional loans, credit cards, buy now pay later or interest
   based investments. Islamic finance that is certified by a recognised body is fine.
3. **No gambling or speculation.** No betting, lotteries, crypto trading or get rich
   schemes.
4. **Nothing immodest.** No images at all on the card, and no words that would not sit
   well in a masjid.
5. **Nothing that misleads.** No miracle cures, fake urgency or claims we cannot check.
6. **No tracking of people.** The card is a plain link built into the app. We never
   add a sponsor's code, pixel or tracker. Sponsors get totals only (see below), never
   anything about a person.
7. **Respect the scholars.** No paid religious rulings, no attacks on other groups or
   authorities, no politics.
8. **Real and reachable.** A registered business or charity with a working website and
   a way to contact it.

## How a sponsor joins

1. The sponsor writes to salam@prayertimes.asia with what they offer and which
   countries they want.
2. Ustaz Aarif checks it against the rules above.
3. If approved, the card is added to `data/community-cards.json` with `kind: "sponsor"`,
   `approvedBy`, `approvedOn` and an `until` date. The build refuses a sponsor card
   without them.
4. The fee is a flat amount for a set time (for example one month). Never per view,
   per tap or per user. The counts below are a report for the sponsor, not a bill.
5. The card shows a small Sponsored tag, and the link is marked `rel="sponsored"`.

A card has a title of up to 28 letters, one line of up to 80 letters, the website name
and an icon from our own set (kaaba, globe, shop, heart). No logos or photos, so every
card looks calm and the same.

## Counting, and the report for sponsors

So sponsors (and we) can see how a card does, each app sends two anonymous counts
through the same TelemetryDeck counter as the app-open counts ([analytics.md](analytics.md)).

| Count | When | What it carries |
|---|---|---|
| `Card.seen` | At least half the card is on screen. Once a day per card on each device, however often it scrolls past. | `Card.id`, `Card.kind` (ours or sponsor), `Card.placement` (prayer, settings, masjid), plus the usual anonymous keys (platform, version, language, city and country of the place in use, the random device number) |
| `Card.tapped` | Every tap | The same |

Never sent: names, accounts, coordinates, IP addresses (TelemetryDeck does not keep
them), or anything from the sponsor. When Settings, Privacy, Share anonymous usage counts
is off, nothing is counted, the same as for app opens. Nothing is counted until
`config/analytics.json` has the TelemetryDeck App ID.

**Seeing the numbers.** In the TelemetryDeck dashboard, make three charts (Insights),
each filtered to the right signal type.

1. **Seen by card.** Signal `Card.seen`, last 30 days, users, broken down by `Card.id`.
   "Users" means different devices, which is the fairest number to give a sponsor.
2. **Taps by card.** Signal `Card.tapped`, last 30 days, count, broken down by `Card.id`.
3. **By country.** Either signal, filter `Card.id` to one card, broken down by `Place.country`.

**Monthly sponsor report** (one page, by hand from those charts).

> Barakah Picks report for *(sponsor)*, *(month)*
> Your card was shown to *N* people in *(countries)*, and tapped *T* times
> (*T ÷ N* percent). Visits from the app show in your own website analytics as
> source `prayertimesasia`, medium `app`.

Taps open the sponsor's website with `utm_source=prayertimesasia&utm_medium=app`, so the
sponsor can see the visits, and any sales, in their own Google Analytics or shop
dashboard. We never see what happens after the tap.

**Honest numbers for a pitch.** The card sits under Show more, so only some users see it.
Expect perhaps 20 to 40 percent of monthly users to see a given card, and 1 to 5 percent
of them to tap. Quote the real numbers from the dashboard, never a guess.

## Before the first sponsor card goes live

These say "no ads" today, which is still true while only our own cards show. Change
them when the first paid card is added.

- Google Play Console, App content, Ads. Change to "Yes, my app contains ads".
- App Store and Google Play text in [app-store.md](app-store.md) and
  [play-store.md](play-store.md) that says "no ads" or "tanpa iklan".
- Paid cards reach a new app version only with the next release, so agree the start
  date with the sponsor after the build is out. The web app updates the same day.

## Adding or changing a card

1. Edit `data/community-cards.json`.
2. Run `python3 tools/build_community_cards.py`. It checks the rules it can (no colons
   or dashes, lengths, countries, dates, approval for sponsors) and writes the list into
   the web, iPhone and Android apps.
3. Open a pull request. CI runs `python3 tools/build_community_cards.py --check`.
