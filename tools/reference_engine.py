"""Reference port of PrayerEngine.swift, used to validate the maths on any machine.

Run: python3 tools/reference_engine.py
Keep this file in step with PrayerTimesAsia/Core/PrayerEngine.swift.
"""
import math, datetime as dt

def dsin(d): return math.sin(math.radians(d))
def dcos(d): return math.cos(math.radians(d))
def dtan(d): return math.tan(math.radians(d))
def darcsin(x): return math.degrees(math.asin(x))
def darccos(x): return math.degrees(math.acos(max(-1, min(1, x))))
def darctan2(y, x): return math.degrees(math.atan2(y, x))
def darccot(x): return math.degrees(math.atan(1 / x))
def fix(a, b): a = a - b * math.floor(a / b); return a + b if a < 0 else a

def julian(y, m, d):
    if m <= 2: y -= 1; m += 12
    A = y // 100; B = 2 - A + A // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + d + B - 1524.5

def sun(jd):
    D = jd - 2451545.0
    g = fix(357.529 + 0.98560028 * D, 360)
    q = fix(280.459 + 0.98564736 * D, 360)
    L = fix(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g), 360)
    e = 23.439 - 0.00000036 * D
    RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15
    eqt = q / 15 - fix(RA, 24)
    decl = darcsin(dsin(e) * dsin(L))
    return decl, eqt

def compute(date, lat, lng, tz, fajr, isha, isha_minutes=None, asr_factor=1, maghrib_angle=None, offsets=None):
    jd0 = julian(date.year, date.month, date.day) - lng / (15 * 24)
    def noon(t): return fix(12 - sun(jd0 + t)[1], 24)
    def angle_time(angle, t, ccw):
        decl = sun(jd0 + t)[0]
        T = darccos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15
        return noon(t) + (-T if ccw else T)
    def asr_time(t):
        decl = sun(jd0 + t)[0]
        a = -darccot(asr_factor + dtan(abs(lat - decl)))
        return angle_time(a, t, False)
    t = dict(fajr=5, sunrise=6, dhuhr=12, asr=13, maghrib=18, isha=18)
    for _ in range(2):
        p = {k: v / 24 for k, v in t.items()}
        t = dict(fajr=angle_time(fajr, p['fajr'], True),
                 sunrise=angle_time(0.833, p['sunrise'], True),
                 dhuhr=noon(p['dhuhr']), asr=asr_time(p['asr']),
                 maghrib=angle_time(maghrib_angle or 0.833, p['maghrib'], False),
                 isha=angle_time(isha, p['isha'], False) if isha_minutes is None else 0)
    if isha_minutes is not None: t['isha'] = t['maghrib'] + isha_minutes / 60
    out = {}
    for k, v in t.items():
        v = v + tz - lng / 15 + (offsets or {}).get(k, 0) / 60
        out[k] = v
    return out

METHODS = {
    'muis': dict(fajr=20, isha=18, offsets=dict(fajr=0.625, sunrise=-0.375, dhuhr=1.5, asr=0.5, maghrib=0.875, isha=0.5)),
    'kemenag': dict(fajr=20, isha=18, offsets=dict(fajr=2.25, sunrise=-4.5, dhuhr=3.25, asr=2.5, maghrib=3.25, isha=2.5)),
    'jakim': dict(fajr=18, isha=18, offsets=dict(fajr=2.375, sunrise=-1.375, dhuhr=3, asr=2.25, maghrib=2.25, isha=2.375)),
}

def final_minutes(date, lat, lng, tz, method):
    """Mirror of the Swift output: ceil(time + offset) to the minute, local clock minutes."""
    p = METHODS[method]
    r = compute(date, lat, lng, tz, p['fajr'], p['isha'], offsets=p['offsets'])
    return {k: math.ceil(round(v * 60, 9)) for k, v in r.items()}

def hm(h, mode='round'):
    m = h * 60
    m = math.ceil(m) if mode == 'ceil' else round(m)
    return f"{m // 60:02d}:{m % 60:02d}"

if __name__ == '__main__':
    # Official reference days. SG = MUIS (data.gov.sg / user screenshot), KL = JAKIM WLY01.
    cases = [
        ('muis', dt.date(2026, 1, 1), 1.3521, 103.8198, ['05:44', '07:08', '13:10', '16:34', '19:11', '20:25']),
        ('muis', dt.date(2026, 8, 1), 1.3521, 103.8198, ['05:46', '07:06', '13:13', '16:34', '19:17', '20:29']),
        ('muis', dt.date(2026, 10, 21), 1.3521, 103.8198, ['05:29', '06:47', '12:51', '16:07', '18:52', '20:02']),
        ('jakim', dt.date(2026, 1, 1), 3.1472, 101.6894, ['06:06', '07:18', '13:19', '16:42', '19:17', '20:31']),
    ]
    keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
    worst = 0
    early = 0
    for method, d, la, lo, ref in cases:
        got = final_minutes(d, la, lo, 8, method)
        diffs = []
        for k, r in zip(keys, ref):
            h, m = map(int, r.split(':')); diff = got[k] - (h * 60 + m); worst = max(worst, abs(diff))
            if (k == 'sunrise' and diff > 0) or (k != 'sunrise' and diff < 0):
                early += 1
            diffs.append(f"{k}:{got[k]//60:02d}:{got[k]%60:02d}({diff:+d})")
        print(method, d, ' '.join(diffs))
    print('worst difference vs official (min):', worst, '| on the unsafe side:', early)
    raise SystemExit(1 if worst > 3 or early else 0)
