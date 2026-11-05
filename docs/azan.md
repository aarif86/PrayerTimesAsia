# The azan in prayer alerts

Prayer time alerts can play the azan instead of the phone's alert sound, with a
separate Subuh azan at Subuh. The switch, **Play the azan**, sits under Alerts in
Settings on iPhone, Android and the web. It only appears once the recordings
are in the app; until then alerts use the phone's own sound.

- **iPhone** plays the first 30 seconds (Apple's limit for an alert sound).
- **Android** plays the whole azan through its own notification channels
  ("Prayer times with azan", "Subuh with azan"), which people can change in
  Android's settings like any other.
- **Web** plays it while the app is open (some browsers need one tap on the page first).
- Reminders before prayer stay a gentle chime; the azan is only for the time itself.

## Adding or changing a recording

1. Record in a quiet room, phone about an arm's length away, no echo effects.
2. Run `tools/make_azan.sh azan.m4a subuh.m4a` (the Subuh file is optional).
3. Fill in the table below, commit, and open a pull request.

## Where each recording comes from

Every recording needs written permission from the person whose voice it is.
Collections found online mostly copy famous muezzins without permission, so
they are not used.

| File | Muezzin | Recorded | Permission |
|---|---|---|---|
| azan | *(waiting for the recording)* | | |
| azan-subuh | *(waiting for the recording)* | | |
