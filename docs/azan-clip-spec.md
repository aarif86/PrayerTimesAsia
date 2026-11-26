# Azan clip spec

How every azan sound in the app is cut, so they all start, end and sound alike.
Our own clips are made by `tools/make_azan.sh`. "Your own azan" files are shaped
on the phone by `AudioClip` (iOS `Core/AudioClip.swift`, Android core
`AudioClip.kt`) with the same numbers.

## Two lengths

Every app has a **Short call** (the default) and a **Full azan**, chosen in
Alerts and alarms, Sound. Fajr always plays the short call, because the full
recording is the ordinary azan without the Fajr line (an `azan-subuh` file, if
one is ever added, is used for Fajr instead). Made with:

    tools/make_azan.sh RECORDING SHORT_END [IOS_END]

Today's azan: Asim Javed, ICR Friday 2nd adhan (CC0),
`tools/make_azan.sh asim-javed-2nd-adhan.flac 11.9 24.3`. Short call 11.9 s; full
74.9 s on Android and the web, 24.3 s on iPhone (the last phrase that ends before
iOS's 30 second limit).

## Short call (the default alert)

- **Length 10 to 15 seconds.** Start at the first "Allahu akbar", end after the
  second, then a **0.5 second fade-out**.
- **Loudness evened out** to about -16 LUFS (EBU R128 `loudnorm I=-16`), peaks no
  higher than -1 dB, so no clip is much louder than another.
- Quiet lead-in removed; no echo, music or effects added.
- Credit every clip that needs it in Sources and credits (see `AUDIO_LICENSES.csv`).

## Formats

| Where | File | Why |
|---|---|---|
| iPhone | `.caf`, Linear PCM or IMA4, mono, under 30 s, in the app bundle (ours) or `Library/Sounds` ("Your own azan") | iOS ignores alert sounds over 30 s and plays the default instead. MP3 does not work as an alert sound. |
| Android | `.ogg` in `res/raw` (ours) or WAV in Notifications/Prayer Times Asia ("Your own azan"), set as the notification channel's sound | A channel's sound is fixed when the channel is made, so each sound has its own channel. |
| Web | `.mp3` | Plays only while the page is open. |

## Your own azan

The person picks any audio file on their phone (Settings, Your own azan). The app:

1. reads at most the first 45 seconds;
2. removes the quiet start;
3. keeps at most **29 seconds**;
4. evens out the loudness to the same level as our clips (never boosting more than
   about +18 dB, so a hissy file is not made worse);
5. adds a 0.5 s fade at the end;
6. saves it on that phone only and uses it for every prayer, Fajr too.

We never upload, receive or ship these files. The page reminds people to use only
a recording they have the right to use. The web app does not have this yet.
