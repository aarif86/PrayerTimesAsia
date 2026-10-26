# Still pending

The same items are on the GitHub Project board (Issues). Ticked off here and there as they're done.

## Waiting on you (the owner)

- [ ] **Put the web app online** - GitHub: Settings → Pages → Build and deployment → Source: *GitHub Actions*. The next change to `web/` on main publishes it to https://aarif86.github.io/PrayerTimesAsia/ (or Actions → Web → Run workflow to publish straight away). (Or ask to host it on nsd.sg instead.)
- [ ] **Buy prayertimes.asia and point it at the website** - steps in [site/README.md](site/README.md) (about 10 minutes, plus waiting for DNS). Includes turning on email forwarding for hello@prayertimes.asia, which the website's buttons use.
- [ ] **Public TestFlight link** - App Store Connect → TestFlight → External Testing → a group → Public Link. Send it to Claude to put on the website instead of "ask for an invite".
- [ ] **Try the Android app on a phone** - Actions → Android → newest green run → download *prayer-times-asia-debug-apk*, install, report what works.
- [ ] **Badal Haji order dates** - when orders open and the last day to order for Hajj 1448, so the Badal card can say "orders now open" in season.
- [ ] **Prayer alerts through Focus (Time Sensitive)** - Apple Developer → Identifiers → com.prayertimesasia.app → tick *Time Sensitive Notifications* → Save. Then tell Claude.
- [ ] **Falak committee review** - send docs/falak-review.md to the falak committee member; their notes go on the board.
- [ ] **Google Play account** - US$25 one-time at play.google.com/console (personal or Nasar Pte Ltd).
- [ ] *(Optional)* Move the repo into a Nasar Pte Ltd GitHub organisation.

## Waiting on Claude (do when asked)

- [ ] Badal Haji season wording on the Prayer screen (after the dates arrive).
- [ ] Badal.my for Malaysian users (when the site is ready).
- [ ] Time Sensitive alerts in the app (after the Apple setting is on).
- [ ] Google Play release build (after the account exists).
- [ ] App Store release (listing, screenshots, review).
- [ ] One shared set of "expected prayer times" in a shared folder that the iPhone, Android and web tests all read (today each has its own copy of the same numbers).
- [ ] Tidy old work branches once the owner is happy (keep `design-dial-header`, the saved earlier design).
