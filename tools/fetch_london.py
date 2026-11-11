"""London Unified Prayer Timetable (East London Mosque) for the apps.

    LONDON_PRAYER_TIMES_KEY=... python3 tools/fetch_london.py OUTDIR

Writes OUTDIR/gb-london.json, which the feeds.yml workflow publishes on the
`feeds` branch. The apps download that file, so the API key stays in the
repository's Actions secrets and never ships inside an app or this public repo.

Format (local London times, 24 hour clock, clocks already changed for summer):
    {"source": "London Unified Prayer Timetable", "generated": "...",
     "times": {"2026-11-11": {"fajr": "05:43", "sunrise": "07:13", "dhuhr": "11:53",
                              "asr": "13:57", "maghrib": "16:17", "isha": "17:51"}}}

If the key is missing or the API is down, the file already on the feeds branch
is carried over, so one bad week never takes London's times away.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request

API = 'https://www.londonprayertimes.com/api/times/'
PUBLISHED = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/feeds/gb-london.json'
UA = {'User-Agent': 'PrayerTimesAsia-feeds/1.0 (+https://prayertimes.asia)'}
FIELDS = [('fajr', ('fajr',)), ('sunrise', ('sunrise',)), ('dhuhr', ('dhuhr', 'zuhr')),
          ('asr', ('asr',)), ('maghrib', ('magrib', 'maghrib')), ('isha', ('isha',))]


def hhmm(value, prayer):
    m = re.fullmatch(r'\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*', str(value or ''))
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    # Guard against a 12 hour afternoon value ("1:10" for 13:10), as for MUIS.
    if prayer not in ('fajr', 'sunrise') and h < 11:
        h += 12
    if not (0 <= h < 24 and 0 <= mi < 60):
        return None
    return f'{h:02d}:{mi:02d}'


def parse(data):
    """The API's {"times": {"yyyy-mm-dd": {"fajr": ..., "magrib": ...}}} (a list of days is accepted too)."""
    days = data.get('times', data) if isinstance(data, dict) else data
    if isinstance(days, dict):
        days = [dict(v, date=v.get('date', k)) for k, v in days.items() if isinstance(v, dict)]
    out = {}
    for day in days or []:
        try:
            date = dt.date.fromisoformat(str(day.get('date', ''))[:10]).isoformat()
        except ValueError:
            continue
        row = {}
        for prayer, names in FIELDS:
            t = next((hhmm(day[n], prayer) for n in names if n in day), None)
            if t:
                row[prayer] = t
        if len(row) == len(FIELDS):
            out[date] = row
    return out


def fetch_year(key, year):
    query = urllib.parse.urlencode({'format': 'json', 'key': key, 'year': year, '24hours': 'true'})
    req = urllib.request.Request(f'{API}?{query}', headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return parse(json.loads(r.read().decode('utf-8')))


def published():
    try:
        with urllib.request.urlopen(urllib.request.Request(PUBLISHED, headers=UA), timeout=30) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:  # noqa: BLE001
        return None


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    key = os.environ.get('LONDON_PRAYER_TIMES_KEY', '').strip()
    times = {}
    if key:
        this_year = dt.date.today().year
        for year in (this_year, this_year + 1):
            try:
                got = fetch_year(key, year)
                print(f'gb-london {year}: {len(got)} days')
                times.update(got)
            except Exception as e:  # noqa: BLE001
                # Never print the request URL: it carries the key.
                print(f'gb-london {year}: failed ({type(e).__name__})')
    else:
        print('gb-london: no LONDON_PRAYER_TIMES_KEY secret, carrying over the published file')
    old = published()
    if len(times) < 300 and old and old.get('times'):
        print(f'gb-london: keeping the published file ({len(old["times"])} days)')
        doc = old
    elif len(times) >= 300:
        # Keep days already published that the API no longer returns (the rest of a year in progress).
        merged = dict((old or {}).get('times') or {})
        merged.update(times)
        cutoff = (dt.date.today() - dt.timedelta(days=40)).isoformat()
        doc = dict(source='London Unified Prayer Timetable', authority='East London Mosque',
                   generated=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                   times={d: merged[d] for d in sorted(merged) if d >= cutoff})
    else:
        print('gb-london: nothing to publish yet')
        return
    with open(os.path.join(out, 'gb-london.json'), 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'))
    days = sorted(doc['times'])
    print(f'gb-london: {len(days)} days {days[0]} to {days[-1]}')


if __name__ == '__main__':
    main()
