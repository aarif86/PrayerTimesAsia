# Keeping Prayer Times Asia free

How the project handles buy-out offers, sponsors and copies, and what happens if the
owner can no longer look after it. Written 29 October 2026. Background and research:
the plan page shared in the project ("Keeping Prayer Times Asia free").

This is a working guide, not legal or religious advice.

## Our promises

These are on the website and in the apps. Changing any of them should be treated as
breaking a promise to every user and masjid.

1. **Free forever.** No subscriptions, no paid features, no in-app purchases.
2. **No ads.** Not in the apps, not on the masjid screen, not in notifications or the azan.
3. **Your data stays yours.** No accounts, location stays on the phone, nothing sold or
   shared. Only anonymous counts (city and country), which anyone can switch off.
4. **Always open source.** The code stays public under the GNU AGPL ([NOTICE.md](../NOTICE.md)).

## What must be protected

The code cannot be "bought": it is already public. These can, so they stay with the
project and are never transferred to a business:

- the App Store and Google Play listings (whoever owns them can push an update to
  every phone),
- the name, icon and prayertimes.asia ([TRADEMARKS.md](../TRADEMARKS.md)),
- the trust of masjid committees.

## If this happens, do this

| If | Then |
|---|---|
| A company offers money for the app, name or listings | Decline with the reply below. Offer collaboration or sponsorship instead. |
| Someone offers money per user to add their code (SDK, analytics, ads, "audience partnership") | No, every time. Do not negotiate. |
| An authority or non-profit wants to take over or adopt the app | Welcome, only with written terms: stays free, no ads, no data sales, stays open source, name kept under a non-profit asset lock. A lawyer reads it first. |
| An authority wants its own branded version | Yes. The licence allows it. Ask them to share improvements back and use their own name. |
| A sponsor wants their logo in the app | About page and website only. Never on prayer screens, azan, notifications or the masjid TV. |
| A company offers the owner a job because of the app | Fine personally. The app, name and listings stay where they are. |
| Running costs grow beyond what the owner pays comfortably | Open optional donations (GitHub Sponsors or LaunchGood) and publish a yearly costs page. |
| Sponsor money passes about S$5,000 a year, a formal deal with an authority or masjid network, or a second person shares the work | Set up a non-profit company limited by guarantee and move the listings, domain, trademark and repo into it. |
| A copy with ads appears using the name or icon | Report it to Apple or Google as impersonation. If it hides its changed code, ask it to publish the code (AGPL). |
| The owner can no longer look after it | Hand it to the non-profit body or the backup person below. Never sell or give the listings to a business. |

## Reply for buy-out offers

> Assalamualaikum, and thank you for your interest in Prayer Times Asia.
>
> The app is a non-profit effort and is not for sale. It will stay free, with no ads
> and no collection or sale of personal data, and its code is open for anyone to use
> under its licence.
>
> If you would like to support it, we welcome sponsorship of running costs (credited on
> our website), help with translations or testing, or working with us to bring the
> masjid screen to more masjids. Happy to talk about any of those.
>
> Salam, Aarif · salam@prayertimes.asia

## Backup access and handover

So the app does not disappear if the owner is ill, busy or locked out. Keep this list
current. Write **who** has access here, never passwords.

| Account | What it controls | Backup person added? |
|---|---|---|
| Domain registrar (prayertimes.asia) | The website, web app, masjid screens and email | ☐ Auto-renew on ☐ Backup contact added |
| Apple Developer / App Store Connect | The iPhone app and its updates | ☐ Backup person invited (Admin role) |
| Google Play Console | The Android app and its updates | ☐ Backup person invited (Admin) |
| GitHub (aarif86/prayertimesasia) | The code, website hosting and release workflows | ☐ Backup person added as collaborator (Admin) |
| Firebase / Google Cloud | "Help verify times" submissions | ☐ Backup person added as Owner |
| TelemetryDeck | Usage counts | ☐ Backup person invited |
| Email (salam@prayertimes.asia) | Contact from users and masjids | ☐ Forwards to a second inbox |

**Backup person:** _name and contact, agreed with them in person_

If the backup person has to take over, they should: keep the apps live and unchanged,
read this page, reply to masjids that rely on the screen, and then decide with family
and trusted people whether to continue or hand over to a non-profit body. The rules
above still apply.

## When to ask a professional

- Trademark filing for the icon: an IP agent, or IPOS directly.
- Setting up the non-profit company or a charity: a corporate secretary, and the
  Commissioner of Charities guidance.
- Any sponsor agreement above a few thousand dollars, and any takeover talk: a lawyer.
- Waqf, accepting zakat or sadaqah, or paying a salary from donations: a syariah adviser,
  and MUIS (or the state council in Malaysia) for waqf.
