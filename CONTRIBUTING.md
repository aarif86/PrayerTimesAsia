# Contributing times and places

**Every time has a source. We show it.** Submissions are how a place moves from
*D - Calculated* to *B - Masjid-confirmed* or *C - Community-verified*.

## What you can send (from the app: tap the source badge → "Help verify times here")

| Form | Effort | What it unlocks |
|---|---|---|
| Mosque timetable | Photo or PDF of a printed/monthly timetable | Grade B for that mosque and its surroundings |
| Which method mosques here use | Pick from a list + how you know | Grade C for a city once two people independently agree |
| Adhan time I heard | One time, one prayer | A spot check that catches drift |

## How a submission is checked

1. **Submitted** - the issue is the record: source, evidence, timestamp.
2. **Auto-check** - the timetable is fingerprinted (`tools/fingerprint.py`); anything more
   than 10 minutes from every known method is flagged.
3. **Corroborated** - a second independent submission or a spot check agrees within ±2 minutes.
4. **Steward-verified** - a trusted local (e.g. a mosque committee member) confirms.
5. **Published** - added to `data/mosques.json` in a pull request; the git history is the public change log.

Photos are evidence only and are not republished without the mosque's permission.
Submitted data is shared under **CC-BY 4.0**.
