# The azan in prayer alerts

Prayer time alerts can play the azan instead of the phone's alert sound, with a
separate Subuh azan at Subuh. The switch, **Play the azan**, sits under Alerts in
Settings on iPhone, Android and the web. It only appears once the recordings
are in the app; until then alerts use the phone's own sound.

- **Short call (26 Nov 2026, owner's choice):** the alert is a short call, the first
  two "Allahu akbar" (about 9 seconds), on all three platforms. A longer or full azan
  that people can choose in Settings is the next step, not built yet. Make the short
  version with `AZAN_SECONDS=9.4 tools/make_azan.sh azan.mp3`.
- **iPhone** plays at most 30 seconds (Apple's limit for an alert sound).
- **Android** plays the whole file through its own notification channels
  ("Prayer times with azan", "Subuh with azan"), which people can change in
  Android's settings like any other.
- **Web** plays it while the app is open (some browsers need one tap on the page first).
- Reminders before prayer stay a gentle chime; the azan is only for the time itself.

## Adding or changing a recording

1. Record in a quiet room, phone about an arm's length away, no echo effects.
2. Run `tools/make_azan.sh azan.m4a subuh.m4a` (the Subuh file is optional).
3. Fill in the table below, commit, and open a pull request.

## Where each recording comes from

Every recording needs written permission or a clear open licence from the person
whose voice it is. Collections found online mostly copy famous muezzins without
permission, so they are not used.

**Starting point (26 Nov 2026):** one free recording is used for all five prayers
until a Subuh azan (with "As-salatu khayrun minan-nawm") and a masjid in Asia give
permission for theirs. Subuh falls back to this azan on all three platforms. The
owner is asking a Singapore masjid and a Malaysian or Indonesian source for
permission. Candidates and licences are in the shared project folder
(research/azan-licensing-2026-11-26.md).

| File | Muezzin | Recorded | Permission |
|---|---|---|---|
| azan | Asim Javed, ICR (Friday 1st adhan, 17 May 2024, 3 min 40 s, "Called by: Asim Javed") | 2024, uploaded by Asim Javed | CC0 1.0 public domain dedication on the Internet Archive: https://archive.org/details/icr-friday-prayer-1st-adhan-17th-may-2024-9th-dhul-qadah-1445-by-asim-javed (https://creativecommons.org/publicdomain/zero/1.0/). No credit required; courtesy credit welcome. Volume evened out, silence trimmed, cut to the first 9.4 s (two Allahu akbar) with a short fade, same on all platforms. The cut point comes from the volume dip after the second takbir and still needs a listen. |
| azan-subuh | *(none yet, Subuh uses the azan above)* | | Wanted: a proper Fajr azan with "As-salatu khayrun minan-nawm". Best open candidate: Besim Azemi, Islamic Center Malmo, CC BY 3.0 (credit needed, licence checked by a bot only). |
