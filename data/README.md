# data/mosques.json - masjid-confirmed timetables (Grade B)

The app downloads this whole file (nothing about the user's location is sent),
caches it, and uses the closest profile whose `radiusKm` covers the user:
its fingerprint replaces the country default (Grade B), and its jamaah rules
show "Jamaah 5:45 AM" under each prayer.

Every record must come from real evidence (a submitted timetable, a mosque's
own website or board). Never add a mosque from memory or from an aggregator.

## Adding a mosque

1. Type the photographed timetable into a CSV: `date,fajr,sunrise,dhuhr,asr,maghrib,isha` (24h).
2. Fingerprint it:
   `python3 tools/fingerprint.py month.csv --lat 10.7626 --lng 106.6957 --tz 7 --name "Mosque name"`
3. Paste the JSON into a record (below), fill in `source`, `verifiedAt`, `grade`.
4. `python3 tools/check_mosques.py` - CI runs it too.

```json
{
  "id": "vn-hcm-jamiul-islamiyah",
  "name": "Jamiul Islamiyah Mosque",
  "lat": 10.7626, "lng": 106.6957, "country": "VN",
  "radiusKm": 3,
  "fingerprint": { "fajrAngle": 18, "ishaAngle": 17, "ishaInterval": null, "asrFactor": 1,
                   "offsets": { "fajr": 2, "sunrise": 0, "dhuhr": 2, "asr": 2, "maghrib": 2, "isha": 2 } },
  "jamaah": { "fajr": { "afterMinutes": 20 }, "dhuhr": { "fixed": "13:00" } },
  "jumuah": "13:00",
  "source": "Printed monthly timetable, photographed Oct 2026 (issue #12)",
  "verifiedAt": "2026-10-22",
  "grade": "B"
}
```

`grade` is `"B"` (from the mosque's own timetable) or `"C"` (method confirmed by
two or more independent locals, no timetable). Licence: CC-BY 4.0.

# data/calendar.json - Ramadan, Eid and new-year dates per authority

The calendar sanad. Before an authority speaks, the app shows only the
astronomical estimate (Umm al-Qura calendar), labelled as one. Each record here
is one authority's date for one event:

```json
{
  "event": "1_ramadan",
  "hijri_year": 1448,
  "authority": "MUIS",
  "country": "SG",
  "date": "2027-02-08",
  "status": "announced",
  "basis": "hisab",
  "source_url": "https://www.muis.gov.sg/...",
  "announced_at": "2027-02-07T20:00:00+08:00"
}
```

- `event`: `1_ramadan`, `1_syawal`, `10_zulhijjah` or `1_muharram`.
- `status`: `expected` (the authority's own published projection) or `announced` (its decision).
- `basis`: `rukyah`, `hisab`, `umm_al_qura` or `following_other_authority`.
- `authority`: an id from `CalendarSanad.authorities` in `PrayerTimesAsia/Core/CalendarSanad.swift` (MUIS, JAKIM, KEMENAG, MUHAMMADIYAH, KHEU, CHULARAJMONTRI, KMF, UMMALQURA, DIYANET).

## Calendar

Announcements come the evening before. To publish one fast, a steward edits
this file on GitHub (pencil icon → commit to `main`). There is no build step:
phones pick it up within three hours. Always fill in `source_url` with the
authority's own announcement. `python3 tools/check_calendar.py` checks the
file; CI runs it too.
