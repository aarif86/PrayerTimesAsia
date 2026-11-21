"""Brunei's official prayer times for the apps.

    python3 tools/fetch_brunei.py OUTDIR

Writes OUTDIR/bn-brn01.json, bn-brn02.json and bn-brn03.json, which the
feeds.yml workflow publishes on the `feeds` branch, in the same format as
gb-london.json (local Brunei times, 24 hour clock):
    {"source": "...", "authority": "...", "zone": "BRN01", "generated": "...",
     "times": {"2026-11-21": {"fajr": "04:48", "sunrise": "06:10", ...}}}

The times are the Ministry of Religious Affairs (KHEU) timetable, the printed
Taqwim, as read and checked by ruqqq/prayertimes-database (GPL 3.0,
https://github.com/ruqqq/prayertimes-database). Zones follow KHEU's own note:
BRN01 Brunei-Muara and Temburong as printed, BRN02 Tutong one minute later,
BRN03 Belait three minutes later.

If a year can't be read, or fails the checks, the file already on the feeds
branch is carried over, so one bad week never takes Brunei's times away.
"""
import datetime as dt
import json
import os
import sys
import urllib.request

SOURCE = 'https://raw.githubusercontent.com/ruqqq/prayertimes-database/master/data/BN/{zone}/{year}.json'
PUBLISHED = 'https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/feeds/{name}.json'
UA = {'User-Agent': 'PrayerTimesAsia-feeds/1.0 (+https://prayertimes.asia)'}
ZONES = ['BRN01', 'BRN02', 'BRN03']
PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
BRUNEI = dt.timezone(dt.timedelta(hours=8))


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def parse(data, year):
    """ruqqq's [[{"date": 1, "month": 1, "year": 2026, "times": [six UTC ISO times]}, ...], ...] by month."""
    out = {}
    rows = [r for month in data for r in month] if data and isinstance(data[0], list) else data
    for r in rows or []:
        try:
            date = dt.date(int(r['year']), int(r['month']), int(r['date']))
            times = [dt.datetime.fromisoformat(t.replace('Z', '+00:00')).astimezone(BRUNEI) for t in r['times']]
        except (KeyError, TypeError, ValueError):
            continue
        if date.year != year or len(times) != 6 or any(t.date() != date for t in times):
            continue
        minutes = [t.hour * 60 + t.minute for t in times]
        # In order, and each in a sane window for Brunei (about 4.5 degrees north).
        windows = [(4 * 60, 5 * 60 + 30), (5 * 60 + 30, 7 * 60), (11 * 60 + 30, 13 * 60),
                   (14 * 60 + 30, 16 * 60 + 30), (17 * 60 + 30, 19 * 60), (18 * 60 + 30, 20 * 60 + 30)]
        if minutes != sorted(minutes) or any(not lo <= m <= hi for m, (lo, hi) in zip(minutes, windows)):
            continue
        out[date.isoformat()] = {p: f'{m // 60:02d}:{m % 60:02d}' for p, m in zip(PRAYERS, minutes)}
    return out


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    this_year = dt.date.today().year
    for zone in ZONES:
        name = f'bn-{zone.lower()}'
        times = {}
        for year in (this_year, this_year + 1):
            try:
                got = parse(get_json(SOURCE.format(zone=zone, year=year)), year)
            except Exception as e:  # noqa: BLE001
                print(f'{name} {year}: not available ({type(e).__name__})')
                continue
            if len(got) < 300:
                print(f'{name} {year}: only {len(got)} good days, skipped')
                continue
            print(f'{name} {year}: {len(got)} days')
            times.update(got)
        try:
            old = get_json(PUBLISHED.format(name=name))
        except Exception:  # noqa: BLE001
            old = None
        merged = dict((old or {}).get('times') or {})
        merged.update(times)
        cutoff = (dt.date.today() - dt.timedelta(days=40)).isoformat()
        merged = {d: merged[d] for d in sorted(merged) if d >= cutoff}
        if not merged:
            print(f'{name}: nothing to publish yet')
            continue
        if not times:
            print(f'{name}: keeping the published file')
        doc = dict(source="Ministry of Religious Affairs, Brunei (Taqwim)",
                   authority='Ministry of Religious Affairs, Brunei',
                   via='ruqqq/prayertimes-database (GPL 3.0)', zone=zone,
                   generated=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                   times=merged)
        with open(os.path.join(out, f'{name}.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, separators=(',', ':'))
        days = sorted(merged)
        print(f'{name}: {len(days)} days {days[0]} to {days[-1]}')


if __name__ == '__main__':
    main()
