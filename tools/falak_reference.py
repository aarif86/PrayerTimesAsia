"""Reference port of ios/PrayerTimesAsia/Core/Falak.swift (Falak Mode F1).

Run: python3 tools/falak_reference.py [year]
Prints the two Qibla Days (sun directly over the Ka'bah) for the year, and
today's rashdul qiblat and shadow-stick targets for a few Asian cities, so the
Swift unit tests and a falak practitioner can check the numbers by hand.
Keep this file in step with Falak.swift.
"""
import sys, datetime as dt
from reference_engine import dsin, dcos, dtan, darcsin, darctan2, fix, sun

KAABA = (21.422487, 39.826206)

def jd_of(t):  # t: aware UTC datetime
    return t.timestamp() / 86400 + 2440587.5

def position(t, lat, lng):
    """Sun altitude and azimuth (degrees, azimuth clockwise from true north)."""
    decl, eqt = sun(jd_of(t))
    utc_hours = fix(t.timestamp() / 3600, 24)
    H = 15 * (utc_hours + lng / 15 + eqt - 12)
    alt = darcsin(dsin(lat) * dsin(decl) + dcos(lat) * dcos(decl) * dcos(H))
    az = fix(darctan2(-dcos(decl) * dsin(H), dsin(decl) * dcos(lat) - dcos(decl) * dsin(lat) * dcos(H)), 360)
    return alt, az

def transit(y, m, d, lng):
    """UTC instant of local solar noon (the sun crosses the meridian)."""
    midnight = dt.datetime(y, m, d, tzinfo=dt.timezone.utc)
    hours = 12 - lng / 15
    for _ in range(3):
        eqt = sun(jd_of(midnight + dt.timedelta(hours=hours)))[1]
        hours = 12 - eqt - lng / 15
    return midnight + dt.timedelta(hours=hours)

def qibla_days(year):
    """Istiwa' a'zam: the Makkah noons when the sun's declination equals the
    Ka'bah's latitude. Returns the noon on the day closest to each crossing."""
    lat, lng = KAABA
    out, prev = [], None
    day = dt.date(year, 1, 1)
    while day.year == year:
        t = transit(day.year, day.month, day.day, lng)
        diff = sun(jd_of(t))[0] - lat
        if prev and (prev[1] < 0) != (diff < 0):
            out.append(prev[0] if abs(prev[1]) < abs(diff) else t)
        prev = (t, diff)
        day += dt.timedelta(days=1)
    return out

def bearing(a, b):
    import math
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    return fix(math.degrees(math.atan2(math.sin(dl) * math.cos(p2),
               math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))), 360)

def rashdul(day, lat, lng, tz):
    """Minutes (local) on `day` when the sun's azimuth lines up with the qibla,
    as (time, kind): 'towards' = sun in the qibla, shadows point away from it;
    'away' = sun opposite, shadows point to the qibla. Sun must be >= 5 deg up."""
    q = bearing((lat, lng), KAABA)
    start = dt.datetime(day.year, day.month, day.day, tzinfo=dt.timezone.utc) - dt.timedelta(hours=tz)
    targets = ((q, 'towards'), (fix(q + 180, 360), 'away'))
    hits, prev = [], None
    for minute in range(0, 24 * 60 + 1):
        t = start + dt.timedelta(minutes=minute)
        alt, az = position(t, lat, lng)
        deltas = {kind: ((az - tg + 540) % 360) - 180 for tg, kind in targets}
        if prev is not None and alt >= 5:
            for kind, d in deltas.items():
                pd = prev[kind]
                if (pd < 0) != (d < 0) and abs(pd - d) < 90:
                    hits.append(((t + dt.timedelta(hours=tz)).strftime('%H:%M'), kind))
        prev = deltas
    return q, hits

def shadow_targets(day, lat, lng, tz, height=100.0):
    """Noon (shortest) shadow and the Asr shadow lengths for a stick."""
    t = transit(day.year, day.month, day.day, lng)
    alt, _ = position(t, lat, lng)
    noon_shadow = height / dtan(alt)
    return dict(noon=(t + dt.timedelta(hours=tz)).strftime('%H:%M:%S'),
                noon_shadow=round(noon_shadow, 1),
                asr_shafii=round(noon_shadow + height, 1),
                asr_hanafi=round(noon_shadow + 2 * height, 1))

if __name__ == '__main__':
    year = int(sys.argv[1]) if len(sys.argv) > 1 else dt.date.today().year
    for t in qibla_days(year):
        print('Qibla Day', t.strftime('%Y-%m-%d %H:%M UTC'),
              '| Makkah', (t + dt.timedelta(hours=3)).strftime('%H:%M'),
              '| Singapore', (t + dt.timedelta(hours=8)).strftime('%H:%M'),
              '| overhead by', round(sun(jd_of(t))[0] - KAABA[0], 3), 'deg')
    today = dt.date(year, 10, 22)
    for name, lat, lng, tz in [('Singapore', 1.3521, 103.8198, 8), ('Kuala Lumpur', 3.139, 101.6869, 8),
                               ('Jakarta', -6.2088, 106.8456, 7), ('Hanoi', 21.0278, 105.8342, 7),
                               ('Tokyo', 35.6762, 139.6503, 9)]:
        q, hits = rashdul(today, lat, lng, tz)
        print(f'{name}: qibla {q:.2f} deg, rashdul {today}: {hits}, shadow {shadow_targets(today, lat, lng, tz)}')
