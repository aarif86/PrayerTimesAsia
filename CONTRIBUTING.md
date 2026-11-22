# Contributing times and places

**Every time has a source. We show it.** Submissions are how a place moves from
*D - Calculated* to *B - Masjid-confirmed* or *C - Community-verified*.

## What you can send

From the app: tap the source badge → **Help verify times here**, or open
[prayertimes.asia/verify.html](https://prayertimes.asia/verify.html). No account needed.
It is a form that thanks you straight away and emails a confirmation. Ramadan, Eid and new
year announcements go through [prayertimes.asia/announcement.html](https://prayertimes.asia/announcement.html).

| Form | Effort | What it unlocks |
|---|---|---|
| Mosque timetable | Photo or PDF of a printed/monthly timetable | Grade B for that mosque and its surroundings |
| Which method mosques here use | Pick from a list + how you know | Grade C for a city once two people independently agree |
| Adhan time I heard | One time, one prayer | A spot check that catches drift |

## How a submission is checked

1. **Submitted** - stored privately for review (a Prayer Times Asia form, photos kept with it).
   Nothing a contributor types is published before a person checks it.
2. **Auto-check** - the timetable is fingerprinted (`tools/fingerprint.py`); anything more
   than 10 minutes from every known method is flagged.
3. **Corroborated** - a second independent submission or a spot check agrees within ±2 minutes.
4. **Steward-verified** - a trusted local (e.g. a mosque committee member) confirms.
5. **Published** - added to `data/mosques.json` in a pull request; the git history is the public change log.

Photos are evidence only and are not republished without the mosque's permission.
Submitted data is shared under **CC-BY 4.0**.

# Designing a new look

Designers, artists and anyone with an idea can suggest the next look for the app's Prayer screen or the masjid screen, with or without code:
send a sketch, an AI-made mock-up (there is a ready-made prompt), or a pull request.
See **[Design a new look](docs/design-a-look.md)** and the [new look form](https://prayertimes.asia/new-look.html).
Looks are shared under the project's licence (below).

# Licence for what you send

The code is under the **GNU AGPL 3.0** ([NOTICE.md](NOTICE.md)). By sending code, a design
or a translation (pull request, form or email), you agree that it is shared under
the GNU AGPL 3.0 with the app store permission in NOTICE.md, so it can go into the
App Store and Google Play. Timetable and masjid data is shared under CC-BY 4.0 (above).

Copies of the app are welcome under their own name. See [TRADEMARKS.md](TRADEMARKS.md).
