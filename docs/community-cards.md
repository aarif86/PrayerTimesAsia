# Community cards and our ad rules

Prayer Times Asia never uses Google or any other ad network, so nobody else decides
what shows up next to your salah. Instead there is one small card that we fill
ourselves, with our own services and, from time to time, a Muslim business or cause
we picked by hand. Agreed by Ustaz Aarif Raziff on 17 November 2026.

## Where the card shows

- On the Prayer screen, below the five times, and only when Show more is open.
- In Settings, under From the makers (our own services only).
- One card a day. It changes at midnight, in turn, so no one card takes over.
- Anyone can turn the cards off in Settings with Show offers on Prayer and Masjid.

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
6. **No tracking.** The card is a plain link built into the app. We never add a
   sponsor's code, pixel or tracker, and we never share anything about users.
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
   per tap or per user, because we do not count those.
5. The card shows a small Sponsored tag, and the link is marked `rel="sponsored"`.

A card has a title of up to 28 letters, one line of up to 80 letters, the website name
and an icon from our own set (kaaba, globe, shop, heart). No logos or photos, so every
card looks calm and the same.

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
