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
