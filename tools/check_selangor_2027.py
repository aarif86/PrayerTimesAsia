#!/usr/bin/env python3
"""Has JAKIM e-Solat published Selangor's new district zones for 2027 yet?

    python3 tools/check_selangor_2027.py

Selangor moves from three zones (SGR01 to SGR03) to nine district timetables
on 1 January 2027. Until e-Solat publishes the new zone codes and a 2027 table
for them, the apps keep using the old three zones. This prints what e-Solat
returns now for the old codes and for the likely new ones (SGR04 to SGR09), so
the owner or a thread can see in one command whether it is time to wire the
new zones in (see docs/selangor-2027.md).
"""
import json
import sys
import urllib.request

ZONES = [f"SGR{n:02d}" for n in range(1, 10)]
URL = "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone={zone}"


def fetch(zone: str):
    req = urllib.request.Request(URL.format(zone=zone), headers={"User-Agent": "PrayerTimesAsia-check"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    published = 0
    for zone in ZONES:
        try:
            data = fetch(zone)
        except Exception as e:  # network or JSON problem: say so, keep going
            print(f"{zone}: could not read ({e})")
            continue
        rows = data.get("prayerTime")
        if isinstance(rows, list) and rows:
            years = sorted({r.get("date", "")[-4:] for r in rows if isinstance(r, dict)})
            print(f"{zone}: {len(rows)} days, year {', '.join(years)}")
            published += 1
        else:
            print(f"{zone}: no data ({data.get('status', 'unknown')})")
    print()
    print(f"{published} of {len(ZONES)} zones return a table right now.")
    print("Wire the nine zones in only when SGR04 to SGR09 (or whatever codes JAKIM announces) return 2027 days.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
