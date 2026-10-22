"""Calendar feeds (brief v03 §7.3): one .ics per official zone, generated from
the authority's own published table (Grade A), for Apple/Google/Outlook
calendar subscriptions.

Run: python3 tools/gen_ics.py OUTDIR [YEAR]
Writes OUTDIR/sg-muis.ics, OUTDIR/my-<zone>.ics (every JAKIM zone) and a
"-jumuah" Friday-only feed for each, plus OUTDIR/index.json. The feeds.yml
workflow publishes them on the `feeds` branch; the app links to them as
webcal://raw.githubusercontent.com/aarif86/PrayerTimesAsia/feeds/<name>.ics
"""
import datetime as dt
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from validate_official import fetch, hm, jakim_date  # noqa: E402

PRAYERS = [('fajr', 'Subuh'), ('dhuhr', 'Zohor'), ('asr', 'Asar'), ('maghrib', 'Maghrib'), ('isha', 'Isyak')]
HERE = os.path.dirname(__file__)


def esc(s):
    return s.replace('\\', '\\\\').replace(',', '\\,').replace(';', '\\;').replace('\n', '\\n')


def fold(line):
    """RFC 5545: lines over 75 octets continue on the next line after a space."""
    out, b = [], line.encode('utf-8')
    while len(b) > 75:
        cut = 75
        while (b[cut] & 0xC0) == 0x80:  # don't split a UTF-8 sequence
            cut -= 1
        out.append(b[:cut].decode('utf-8'))
        b = b' ' + b[cut:]
    out.append(b.decode('utf-8'))
    return '\r\n'.join(out)


def calendar(feed, title, source, days, tz_hours, friday_only=False):
    """days: [(date, {prayer: minutes after local midnight})]"""
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prayer Times Asia//Calendar feeds//EN',
             'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', f'X-WR-CALNAME:{esc(title)}',
             f'X-WR-CALDESC:{esc("Source: " + source + " (Grade A). Prayer Times Asia, CC-BY 4.0.")}',
             'REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D']
    for day, times in days:
        friday = day.weekday() == 4
        if friday_only and not friday:
            continue
        for key, name in PRAYERS:
            if friday_only and key != 'dhuhr':
                continue
            if key == 'dhuhr' and friday:
                name = "Jumu'ah"
            local = dt.datetime.combine(day, dt.time()) + dt.timedelta(minutes=times[key])
            start = local - dt.timedelta(hours=tz_hours)
            lines += ['BEGIN:VEVENT',
                      f'UID:{feed}-{day.isoformat()}-{key}@prayertimes.asia',
                      f'DTSTAMP:{stamp}',
                      f'DTSTART:{start.strftime("%Y%m%dT%H%M%SZ")}',
                      'DURATION:PT15M' if not (friday and key == 'dhuhr') else 'DURATION:PT60M',
                      f'SUMMARY:{esc(name)}',
                      f'DESCRIPTION:{esc(f"{name} begins {local.strftime("%H:%M")}. Source: {source}.")}',
                      'TRANSP:TRANSPARENT', 'END:VEVENT']
    lines.append('END:VCALENDAR')
    return '\r\n'.join(fold(l) for l in lines) + '\r\n'


def muis_days():
    cfg = json.load(open(os.path.join(HERE, '..', 'config', 'official-sources.json')))
    year = max(int(y) for y in cfg['muisDatasets'])
    data = fetch(f"https://data.gov.sg/api/action/datastore_search?resource_id={cfg['muisDatasets'][str(year)]}&limit=400")
    rows = data['result']['records']
    keys = {k.lower(): k for k in rows[0]}

    def col(*names):
        return next(k for n in names for low, k in keys.items() if n in low)
    c = dict(date=col('date'), fajr=col('subuh'), dhuhr=col('zohor', 'zuhur'), asr=col('asar'),
             maghrib=col('maghrib'), isha=col('isyak'))
    days = []
    for r in rows:
        o = {}
        for k, _ in PRAYERS:
            m = hm(r[c[k]])
            if k != 'fajr' and m < 11 * 60:  # afternoon times are on a 12-hour clock
                m += 12 * 60
            o[k] = m
        days.append((dt.date.fromisoformat(r[c['date']][:10]), o))
    return sorted(days)


def jakim_days(zone):
    data = fetch(f"https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone={zone}")
    return sorted((jakim_date(r['date']), dict(fajr=hm(r['fajr']), dhuhr=hm(r['dhuhr']), asr=hm(r['asr']),
                                               maghrib=hm(r['maghrib']), isha=hm(r['isha'])))
                  for r in data.get('prayerTime') or [])


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    index, failures = [], []

    def write(feed, title, source, days, tz):
        if len(days) < 300:
            failures.append(f'{feed}: only {len(days)} days')
            return
        for suffix, friday_only, label in (('', False, title), ('-jumuah', True, f"{title} · Jumu'ah")):
            with open(os.path.join(out, f'{feed}{suffix}.ics'), 'w', newline='') as f:
                f.write(calendar(feed + suffix, label, source, days, tz, friday_only))
        index.append(dict(feed=feed, title=title, source=source, first=days[0][0].isoformat(), last=days[-1][0].isoformat()))
        print(f'{feed}: {len(days)} days {days[0][0]} to {days[-1][0]}')

    try:
        write('sg-muis', 'Prayer times · Singapore (MUIS)', 'MUIS via data.gov.sg', muis_days(), 8)
    except Exception as e:  # noqa: BLE001
        failures.append(f'sg-muis: {e}')

    zones = sorted({p[0] for p in json.load(open(os.path.join(HERE, 'jakim_reference_points.json')))})
    for zone in zones:
        try:
            write(f'my-{zone.lower()}', f'Prayer times · Malaysia {zone} (JAKIM)', f'JAKIM e-Solat zone {zone}', jakim_days(zone), 8)
        except Exception as e:  # noqa: BLE001
            failures.append(f'my-{zone.lower()}: {e}')
        time.sleep(1)  # be gentle with e-Solat

    with open(os.path.join(out, 'index.json'), 'w') as f:
        json.dump(dict(generated=dt.datetime.now(dt.timezone.utc).isoformat(), licence='CC-BY-4.0', feeds=index), f, indent=1)
    if failures:
        print('FAILED:\n' + '\n'.join(failures))
    # Publish what worked; fail the run only if nothing did.
    sys.exit(0 if index else 1)


if __name__ == '__main__':
    main()
