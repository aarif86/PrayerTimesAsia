# Selangor 2027: nine district timetables

Checked 29 Nov 2026 (Singapore time). Plain summary first, steps after.

## What is changing

From 1 January 2027, Selangor stops using three zones (SGR01, SGR02, SGR03) and uses nine district timetables, one each for Gombak, Hulu Langat, Hulu Selangor, Klang, Kuala Langat, Kuala Selangor, Petaling, Sabak Bernam and Sepang. The Selangor Mufti Department (Balai Cerap Selangor) announced it on 10 Nov 2026 after the Sultan's consent on 17 Nov 2025. The new way uses several reference points per district, which narrows the gap inside a zone from 4 to 6 minutes down to about 1.3 to 2.7 minutes.

Sources read: Media Selangor (10 Nov 2026), takbir.my guide, Harian Metro, Newswav.

## What our apps do today

- Malaysia times come from JAKIM e-Solat by zone code. The app picks the nearest zone from one reference point per district (tools/jakim_reference_points.json, generated into web, iPhone and Android).
- Selangor is SGR01 (Gombak, Hulu Langat, Hulu Selangor, Petaling, Sepang), SGR02 (Kuala Selangor, Sabak Bernam) and SGR03 (Klang, Kuala Langat).
- If e-Solat has no table, the app falls back to its own calendar feed, then to its own calculation, and says "Calculated" or "Formula" on the source line. It never shows a blank.

## What we found

- e-Solat has NOT published new codes. SGR04 to SGR09 return "NO_RECORD". Nobody has announced which codes JAKIM will use, or whether SGR01 to SGR03 are reused.
- So we cannot wire the nine zones in today. Doing it by guessing codes could show wrong times that look official.
- Risk on 1 Jan 2027: if e-Solat keeps SGR01 to SGR03 as they are, our times stay the same as before but no longer match the district timetables masjids use (up to a few minutes). If e-Solat reuses a code for a different district, times could be wrong without any warning.

## What this change does

- Adds a plain notice for people in Selangor's old zones from 1 Jan 2027 (a card on the Prayer screen and a line on the source sheet). It says the nine district change has started, the times follow the old zone for now, and to follow the masjid.
- Adds `tools/check_selangor_2027.py`: one command that shows whether e-Solat returns data for SGR01 to SGR09.

## Steps when JAKIM publishes the new codes

1. Run `python3 tools/check_selangor_2027.py`. Move on only when the new codes return days for 2027.
2. In tools/jakim_reference_points.json, change the zone code for each Selangor district to its new code (district names are already one row each). Keep the Federal Territories (WLY01, WLY02) as they are.
3. Run `python3 tools/gen_jakim_zones.py` (writes the iPhone file). The web copy (web/src/core/jakimZones.ts) and the Android copy (JakimZones.kt) are made from the iPhone file, so bring them in line with it. The Settings zone list reads the same files.
4. Delete the Selangor notice: `selangorNotice` in web/src/services/store.ts, `SelangorNote` in web/src/ui/Today.tsx, and the `source.selangor2027` line in data/app-words.
5. Check the feeds branch builds my-sgr04 to my-sgr09 (the feeds workflow builds one file per JAKIM zone).
6. Check the zone nearest Rawang, KLIA, Shah Alam, Klang and Sabak Bernam against the Mufti's own 2027 takwim (muftiselangor.gov.my).

## Still needs a person

- Ask the Selangor Mufti Department or JAKIM which codes e-Solat will use and when (salam@ can send this).
- Real-phone check on 1 Jan 2027 in Rawang, Shah Alam and Klang.
