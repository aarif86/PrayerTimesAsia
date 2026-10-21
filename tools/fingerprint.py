"""Method fingerprinting: recover the rule behind any prayer timetable.

Give it a few weeks of a mosque's printed timetable (one photographed month is
plenty) and the mosque's location. It fits the Fajr angle, the Isha angle or
fixed interval, the Asr school and each prayer's precautionary minutes against
the same engine the app uses, then prints the fingerprint as JSON (ready for
data/mosques.json) plus a plain-words summary.

    python3 tools/fingerprint.py timetable.csv --lat 10.7626 --lng 106.6957 --tz 7

CSV columns (24-hour HH:MM): date,fajr,sunrise,dhuhr,asr,maghrib,isha
"""
import argparse
import csv
import datetime as dt
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from reference_engine import compute  # noqa: E402

KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
PRESETS = {  # name: (fajr, isha angle or None, isha interval or None)
    'MUIS / Southeast Asia 20°/18°': (20, 18, None), 'JAKIM 18°/18°': (18, 18, None),
    'Muslim World League 18°/17°': (18, 17, None), 'Karachi 18°/18°': (18, 18, None),
    'Umm al-Qura 18.5° / +90 min': (18.5, None, 90), 'Egyptian 19.5°/17.5°': (19.5, 17.5, None),
    'ISNA 15°/15°': (15, 15, None), 'Diyanet 18°/17°': (18, 17, None),
}
OFFSETS = [x / 4 for x in range(-12, 25)]  # -3 .. +6 minutes
# Over a few weeks a 1° change in a twilight angle looks almost exactly like a
# few minutes of safety margin, so angle fits only allow realistic margins
# (-0.5 .. +3 min) and break ties towards the angles authorities actually use.
ANGLE_OFFSETS = [x / 4 for x in range(-2, 13)]
STANDARD_ANGLES = [15, 17, 17.5, 18, 18.5, 19, 19.5, 20]


def angle_key(t):
    angle, off, exact, worst, _ = t
    return (exact, -worst, -min(abs(angle - a) for a in STANDARD_ANGLES))


def hm(s):
    h, m = s.strip().split(':')[:2]
    return int(h) * 60 + int(m)


def best_offset(raw_minutes, official, offsets=OFFSETS):
    """Offset (ceil rounding) with the most exact matches, ties -> smaller max error."""
    best = None
    for off in offsets:
        d = [math.ceil(round(r + off, 9)) - o for r, o in zip(raw_minutes, official)]
        score = (sum(1 for x in d if x == 0), -max(abs(x) for x in d))
        if best is None or score > best[0]:
            best = (score, off, d)
    (exact, neg_max), off, d = best
    return off, exact, -neg_max, d


def fingerprint(rows, lat, lng, tz):
    days = [(dt.date.fromisoformat(r['date']), {k: hm(r[k]) for k in KEYS}) for r in rows]
    n = len(days)
    result = {}

    def series(fajr=18, isha=17, asr_factor=1, key='fajr', isha_minutes=None):
        return [compute(d, lat, lng, tz, fajr, isha, isha_minutes=isha_minutes, asr_factor=asr_factor)[key] * 60
                for d, _ in days]

    # Fajr angle
    fajr_fit = max(((a / 4,) + best_offset(series(fajr=a / 4, key='fajr'), [o['fajr'] for _, o in days],
                                           ANGLE_OFFSETS)
                    for a in range(48, 85)), key=angle_key)
    result['fajrAngle'], result['fajr'] = fajr_fit[0], fajr_fit[1:]
    # Isha: angle or fixed interval after Maghrib
    isha_angle = max(((a / 4,) + best_offset(series(isha=a / 4, key='isha'), [o['isha'] for _, o in days],
                                             ANGLE_OFFSETS)
                      for a in range(48, 85)), key=angle_key)
    isha_interval = max(((m,) + best_offset(series(isha_minutes=m, key='isha'), [o['isha'] for _, o in days])
                         for m in range(60, 125, 5)), key=lambda t: (t[2], -t[3]))
    use_interval = (isha_interval[2], -isha_interval[3]) > (isha_angle[2], -isha_angle[3])
    isha_fit = isha_interval if use_interval else isha_angle
    # Asr school
    asr_fit = max(((f,) + best_offset(series(asr_factor=f, key='asr'), [o['asr'] for _, o in days]) for f in (1, 2)),
                  key=lambda t: (t[2], -t[3]))
    fits = {'fajr': fajr_fit[1:], 'isha': isha_fit[1:], 'asr': asr_fit[1:]}
    for k in ('sunrise', 'dhuhr', 'maghrib'):
        fits[k] = best_offset(series(key=k), [o[k] for _, o in days])

    fp = {
        'fajrAngle': fajr_fit[0],
        'ishaAngle': None if use_interval else isha_fit[0],
        'ishaInterval': isha_fit[0] if use_interval else None,
        'asrFactor': asr_fit[0],
        'offsets': {k: fits[k][0] for k in KEYS},
        'fit': {k: {'exactPct': round(fits[k][1] * 100 / n), 'maxErrorMin': fits[k][2]} for k in KEYS},
        'days': n,
    }
    return fp


def nearest_preset(fp):
    def dist(p):
        fajr, isha, interval = p
        d = abs(fajr - fp['fajrAngle'])
        if fp['ishaInterval'] is not None:
            d += 0 if interval is None else abs(interval - fp['ishaInterval']) / 10
            d += 3 if interval is None else 0
        else:
            d += 3 if isha is None else abs(isha - fp['ishaAngle'])
        return d
    name = min(PRESETS, key=lambda k: dist(PRESETS[k]))
    return name, dist(PRESETS[name])


def describe(fp, mosque='This timetable'):
    isha = f"Isha {fp['ishaAngle']}°" if fp['ishaAngle'] is not None else f"Isha {fp['ishaInterval']} min after Maghrib"
    asr = 'Hanafi Asr' if fp['asrFactor'] == 2 else "Shafi'i Asr"
    margin = sorted(set(math.ceil(v) for k, v in fp['offsets'].items() if k != 'sunrise'))
    preset, d = nearest_preset(fp)
    near = f"≈ {preset}" if d < 0.6 else f"closest preset {preset}, but a distinct rule"
    worst = max(v['maxErrorMin'] for v in fp['fit'].values())
    return (f"{mosque} follows Fajr {fp['fajrAngle']}° · {isha} · {asr}, safety margin "
            f"{'/'.join(str(m) for m in margin)} min ({near}). Fits {fp['days']} days to within {worst} min.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('csv')
    ap.add_argument('--lat', type=float, required=True)
    ap.add_argument('--lng', type=float, required=True)
    ap.add_argument('--tz', type=float, required=True, help='UTC offset in hours, e.g. 7 for Vietnam')
    ap.add_argument('--name', default='This timetable')
    a = ap.parse_args()
    rows = list(csv.DictReader(open(a.csv)))
    fp = fingerprint(rows, a.lat, a.lng, a.tz)
    print(json.dumps(fp, indent=2))
    print(describe(fp, a.name))


if __name__ == '__main__':
    main()
