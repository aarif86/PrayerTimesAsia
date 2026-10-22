# Falak Mode F1: review sheet

Falak Mode is the classical, offline layer of Prayer Times Asia: reading the qibla and the prayer times from the sun and its shadow. This sheet is for a falak practitioner to check the method and the numbers before launch. Everything in Falak Mode is labelled **Grade F (observed)** and **pending shariah review**. It never replaces the authority's timetable; it only teaches and checks.

Open it in the app from **Qibla → Sun & shadow**, or **Settings → Falak Mode**.

## What F1 contains

| Card | What it shows | How it is worked out |
|---|---|---|
| The shadow right now | A live dial: where an upright stick's shadow points now, against the qibla line | Sun altitude and azimuth from the app's solar model, every 30 seconds |
| Qibla Day (istiwa' a'zam) | A countdown to the next noon when the sun is directly over the Ka'bah, in your local time, and whether the sun is up where you are | The Makkah solar noon on the day the sun's declination is closest to the Ka'bah's latitude (21.4225° N) |
| Rashdul qiblat today | The moments today the sun lines up with the qibla bearing (shadow points away from the qibla) or its opposite (shadow points to the qibla) | A minute-by-minute scan of the sun's azimuth, interpolated to the second; only with the sun at least 5° up. If none today, the next date is shown |
| Tongkat istiwa' | For a stick of any height: zawal time, the noon shadow and its direction, the Asr shadow and time (Shafi'i +1×, Hanafi +2×). Enter a measured shadow and time to read the sun's time with ± minutes | Asr shadow = noon shadow (fay' al-zawal) + 1× or 2× the stick. A reading turns the stick and shadow into a sun altitude and finds when the computed sun reaches it |
| Signs in the sky | What Maghrib, Isha and Subuh look like, with today's timetable time | Informational text only (below) |

## Numbers to check by hand

From `python3 tools/falak_reference.py 2026` and the app's unit tests (`PrayerTimesAsiaTests/FalakTests.swift`).

**Qibla Days** (sun over the Ka'bah at Makkah noon):

| Year | Date | UTC | Makkah | Singapore |
|---|---|---|---|---|
| 2026 | 28 May | 09:17:59 | 12:17:59 | 17:17:59 |
| 2026 | 15 Jul | 09:26:42 | 12:26:42 | 17:26:42 |
| 2027 | 28 May | 09:17:57 | 12:17:57 | 17:17:57 |
| 2027 | 16 Jul | 09:26:46 | 12:26:46 | 17:26:46 |

These agree with the commonly published 12:18 and 12:27 Makkah time.

**Singapore, 22 Oct 2026** (1.3521° N, 103.8198° E; qibla 293.0°):

- Rashdul qiblat 10:48 SGT. The sun is opposite the qibla, so shadows point towards it.
- Zawal 12:49:13. With a 100 cm stick, the noon shadow is 22.0 cm, pointing north.
- Asr (Shafi'i) when the shadow reaches 122.0 cm, at 16:06:53. That is MUIS's published 16:08 minus its ihtiyat and rounding.
- Asr (Hanafi) when the shadow reaches 222.0 cm.

**Other cities, 22 Oct 2026:**

- Kuala Lumpur: rashdul 10:38, zawal 12:57:45.
- Jakarta: rashdul 10:55, zawal 11:37:07.
- Hanoi: no rashdul with the sun 5° up that day.

## Method notes and choices to confirm

1. **Solar model.** This is the same low-precision model the app uses for prayer times (praytimes.org formulation): good to about 0.01° in declination and a few seconds in time. Altitudes are geometric, with no refraction. Refraction is under 0.1° once the sun is 10° or more up, which is why rashdul needs the sun at least 5° up and readings are best taken well above the horizon.
2. **Qibla Day window.** The app says the day before and after "also work within about half a degree". Is that the right guidance? Should we also show the ±5-minute window either side of the Makkah noon?
3. **Rashdul qiblat.** Do we show both alignments (sun in the qibla, and sun opposite it)? We do now, saying in each case which way to face along the shadow. Is a 5° minimum sun altitude right, and is "good for about ±2 minutes" a fair tolerance?
4. **Zuhur.** The card says Zuhur begins once the shadow stops shrinking and starts to grow (after zawal). It gives no minute of its own beyond zawal; the timetable's ihtiyat is shown alongside.
5. **Asr.** The shadow equals fay' al-zawal plus 1× the stick (Shafi'i, Maliki, Hanbali), or plus 2× (Hanafi). The app uses the user's Asr setting for the "has Asr begun" verdict and shows both lengths.
6. **The ± on a reading.** This assumes the shadow is measured to the nearest 0.5 cm, plus 1 minute for the model. Is that honest for a hand measurement with a pen or ruler?
7. **Sky-sign wording, to review word by word:**
   - **Maghrib:** the whole disc of the sun has gone below the horizon. If hills or buildings hide it early, don't pray by that.
   - **Isha:** the red glow (shafaq ahmar) has gone; this is the Shafi'i, Maliki and Hanbali view. Abu Hanifah held it is the white glow (shafaq abyad). Timetables use the sun about 17°–18° below the horizon.
   - **Subuh:** true dawn (fajr sadiq) is a whiteness spreading sideways along the horizon, not the false dawn (fajr kazib), which is an upright column that fades. The app says the depth of the sun at true dawn is still debated, so this stays informational.
8. **Labels.** Should "Grade F" carry a different name in Malay or Indonesian, for example *cerapan falak*? The app uses "tongkat istiwa'", "rashdul qiblat" and "istiwa' a'zam" as written here.

## Not in F1 (planned for F2/F3)

- Camera shadow session
- Find-my-place-from-the-sun
- Digital rubu' mujayyab
- Printable sundial kit
- Sky logger

These need the companion spec (`prayertimesasia-falak-mode-spec-v01.md`) and this review first.
