"""Prints the real response shapes of candidate official-data APIs, so parsers
are written against what the servers actually return. Run in CI."""
import json
import urllib.request

UA = {'User-Agent': 'PrayerTimesAsia-probe/1.0 (+https://github.com/aarif86/PrayerTimesAsia)'}


def show(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=40) as r:
            body = r.read().decode('utf-8', 'replace')
        print(f"\n=== {url}\n{body[:1500]}")
    except Exception as e:  # noqa: BLE001
        print(f"\n=== {url}\nFAILED: {e}")


for u in [
    'https://api.myquran.com/v3/sholat/kabkota/cari/jakarta',
    'https://api.myquran.com/v3/sholat/kota/cari/jakarta',
    'https://api.myquran.com/v2/sholat/kota/cari/jakarta',
    'https://api.myquran.com/v2/sholat/kota/semua',
    'https://api.myquran.com/v2/sholat/jadwal/1301/2026/10',
    'https://api.myquran.com/v3/sholat/jadwal/1301/2026-10',
    'https://api.myquran.com/v3/sholat/jadwal/1301/2026/10',
    'https://api.waktusolat.app/v2/solat/WLY01',
]:
    show(u)
