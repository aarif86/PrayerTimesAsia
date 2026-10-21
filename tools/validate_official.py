"""Compare the engine against whole-year official timetables.

Runs in CI (GitHub's runners can reach the official sites; dev sandboxes often
can't). Prints the raw response shape so parsing can be checked, then per-prayer
error statistics for every day of the year.

    python3 tools/validate_official.py
"""
import datetime as dt
import json
import math
import os
import sys
import urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from reference_engine import METHODS, compute, final_minutes  # noqa: E402

KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
UA = {'User-Agent': 'PrayerTimesAsia-validation/1.0 (+https://github.com/aarif86/PrayerTimesAsia)'}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


MALAY_MONTHS = {'Jan': 1, 'Feb': 2, 'Mac': 3, 'Mar': 3, 'Apr': 4, 'Mei': 5, 'May': 5, 'Jun': 6, 'Jul': 7,
                'Ogos': 8, 'Ogo': 8, 'Aug': 8, 'Sep': 9, 'Okt': 10, 'Oct': 10, 'Nov': 11, 'Dis': 12, 'Dec': 12}


def jakim_date(s):
    d, m, y = s.split('-')
    return dt.date(int(y), MALAY_MONTHS[m], int(d))


def hm(s):
    p = s.strip().split(':')
    return int(p[0]) * 60 + int(p[1])


def stats(label, diffs):
    out = []
    for k in KEYS:
        c = Counter(diffs[k])
        if not c:
            continue
        exact = c[0] / sum(c.values()) * 100
        out.append(f"{k}: exact {exact:.0f}% range [{min(c)}, {max(c)}] {dict(sorted(c.items()))}")
    print(f"  {label}")
    for line in out:
        print('    ' + line)


def fit(label, official, method, points):
    """Search the precautionary offset per prayer (ceil rounding) at candidate points.
    Reports the best offset with no early times, and the best overall."""
    p = METHODS[method]
    print(f"  {label} offset fit (offsets in minutes, ceil rounding):")
    for lat, lng in points:
        raw = [(compute(day, lat, lng, 8, p['fajr'], p['isha']), o) for day, o in official]
        line = []
        for k in KEYS:
            best_any, best_safe = None, None
            for step in range(-12, 41):
                off = step / 8
                d = [math.ceil(round(r[k] * 60 + off, 9)) - o[k] for r, o in raw]
                exact = sum(1 for x in d if x == 0)
                safe = all(x <= 0 for x in d) if k == 'sunrise' else all(x >= 0 for x in d)
                if best_any is None or exact > best_any[1]:
                    best_any = (off, exact, min(d), max(d))
                if safe and (best_safe is None or exact > best_safe[1]):
                    best_safe = (off, exact, min(d), max(d))
            n = len(raw)
            line.append(f"{k} any:{best_any[0]:+.3f}({best_any[1]*100//n}% [{best_any[2]},{best_any[3]}])"
                        + (f" safe:{best_safe[0]:+.3f}({best_safe[1]*100//n}% [{best_safe[2]},{best_safe[3]}])" if best_safe else ' safe:none'))
        print(f"    @({lat}, {lng})")
        for l in line:
            print('      ' + l)


def jakim():
    points = json.load(open(os.path.join(os.path.dirname(__file__), 'jakim_reference_points.json')))
    by_zone = defaultdict(list)
    for code, name, lat, lng in points:
        by_zone[code].append((name, lat, lng))
    zones = sys.argv[1:] or ['WLY01', 'SGR01', 'JHR02', 'PNG01', 'KTN01', 'SBH07', 'SWK08', 'MLK01']
    for zone in zones:
        url = f"https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone={zone}"
        try:
            data = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"JAKIM {zone}: fetch failed: {e}")
            continue
        rows = data.get('prayerTime') or []
        if zone == zones[0]:
            print('JAKIM response keys:', sorted(data.keys()))
            print('JAKIM first row:', json.dumps(rows[0]) if rows else None)
        print(f"JAKIM {zone}: {len(rows)} days")
        best = None
        for name, lat, lng in by_zone[zone]:
            diffs = defaultdict(list)
            for r in rows:
                day = jakim_date(r['date'])
                got = final_minutes(day, lat, lng, 8, 'jakim')
                official = dict(fajr=r['fajr'], sunrise=r['syuruk'], dhuhr=r['dhuhr'], asr=r['asr'],
                                maghrib=r['maghrib'], isha=r['isha'])
                for k in KEYS:
                    diffs[k].append(got[k] - hm(official[k]))
            score = sum(abs(v) for k in KEYS for v in diffs[k])
            if best is None or score < best[0]:
                best = (score, name, lat, lng, diffs)
        if best:
            stats(f"best reference point: {best[1]} ({best[2]}, {best[3]})", best[4])
            official = []
            for r in rows:
                official.append((jakim_date(r['date']), dict(
                    fajr=hm(r['fajr']), sunrise=hm(r['syuruk']), dhuhr=hm(r['dhuhr']), asr=hm(r['asr']),
                    maghrib=hm(r['maghrib']), isha=hm(r['isha']))))
            fit(f'JAKIM {zone}', official, 'jakim', [(best[2], best[3])])


def muis():
    url = 'https://data.gov.sg/api/action/datastore_search?resource_id=d_d441e7242e78efc566024dd5b0d9829c&limit=400'
    try:
        data = fetch(url)
    except Exception as e:  # noqa: BLE001
        print(f"MUIS: fetch failed: {e}")
        return
    rows = data.get('result', {}).get('records', [])
    print('MUIS first row:', json.dumps(rows[0]) if rows else None)
    if not rows:
        return
    keys = {k.lower(): k for k in rows[0]}

    def col(*names):
        for n in names:
            for k_low, k in keys.items():
                if n in k_low:
                    return k
        return None
    c = dict(date=col('date'), fajr=col('subuh'), sunrise=col('syuruk'), dhuhr=col('zohor', 'zuhur'),
             asr=col('asar'), maghrib=col('maghrib'), isha=col('isyak'))
    print('MUIS columns:', c)
    diffs = defaultdict(list)
    for r in rows:
        day = dt.date.fromisoformat(r[c['date']][:10])
        got = final_minutes(day, 1.3521, 103.8198, 8, 'muis')
        for k in KEYS:
            v = r[c[k]].strip()
            m = hm(v)
            # Dataset uses 12-hour clock for afternoon times without am/pm.
            if k in ('dhuhr', 'asr', 'maghrib', 'isha') and m < 12 * 60 - 60:
                m += 12 * 60
            diffs[k].append(got[k] - m)
    stats(f"MUIS {len(rows)} days at Singapore centre", diffs)
    official = []
    for r in rows:
        day = dt.date.fromisoformat(r[c['date']][:10])
        o = {}
        for k in KEYS:
            m = hm(r[c[k]])
            if k in ('dhuhr', 'asr', 'maghrib', 'isha') and m < 11 * 60:
                m += 12 * 60
            o[k] = m
        official.append((day, o))
    fit('MUIS', official, 'muis', [(1.3521, 103.8198), (1.2905, 103.8520), (1.3667, 103.8), (1.35, 103.7), (1.4, 103.9)])


if __name__ == '__main__':
    muis()
    jakim()
