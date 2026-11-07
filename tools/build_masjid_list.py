#!/usr/bin/env python3
"""Builds the ready-made masjid and surau lists the apps download once a week.

    python3 tools/build_masjid_list.py OUT_DIR

Asks OpenStreetMap (Overpass) once per country for every Muslim place of
worship and writes OUT_DIR/<cc>.json plus OUT_DIR/index.json. The apps read
these instead of asking the busy Overpass servers live, so the Masjid tab fills
at once, even on a weak signal.

A country whose fetch fails, or comes back with far fewer places than last
week's file already in OUT_DIR, keeps last week's file, so one bad night on the
servers can never empty the list.

Format of <cc>.json, kept small (arrays, five decimals is about 1 m):
    {"country": "MY", "updated": "2026-11-07",
     "places": [[id, lat, lon, name, address, musollah 0/1], ...]}
An empty name means OpenStreetMap has none; the apps call it Masjid or Musollah.
"""
import datetime
import json
import os
import sys
import time
import urllib.parse
import urllib.request

COUNTRIES = ["SG", "MY", "BN"]
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
# Same words the apps use to tell a surau or prayer room from a masjid.
MUSOLLAH_WORDS = ["musolla", "musalla", "musholla", "surau", "prayer room", "prayer space", "mushola", "prayer hall"]
MUSOLLAH_KINDS = {"musalla", "musholla", "surau", "prayer_room", "musallah"}
# Keep last week's list when the new one has less than this share of it.
MIN_SHARE = 0.7


def query(cc: str) -> str:
    return (f'[out:json][timeout:600];area["ISO3166-1"="{cc}"][admin_level=2]->.a;'
            'nwr["amenity"="place_of_worship"]["religion"="muslim"](area.a);out center tags;')


def fetch(cc: str) -> dict | None:
    body = urllib.parse.urlencode({"data": query(cc)}).encode()
    for attempt in range(3):
        for url in MIRRORS:
            try:
                req = urllib.request.Request(url, data=body, headers={"User-Agent": "PrayerTimesAsia weekly masjid list"})
                with urllib.request.urlopen(req, timeout=700) as r:
                    data = json.load(r)
                if isinstance(data.get("elements"), list) and "remark" not in data:
                    return data
                print(f"{cc}: {url} answered with a remark: {data.get('remark')}", file=sys.stderr)
            except Exception as e:  # busy, timed out, bad JSON: try the next server
                print(f"{cc}: {url} failed: {e}", file=sys.stderr)
        time.sleep(30 * (attempt + 1))
    return None


def is_musollah(name: str, tags: dict) -> bool:
    lower = name.lower()
    kind = (tags.get("place_of_worship:type") or tags.get("place_of_worship") or "").lower()
    return any(w in lower for w in MUSOLLAH_WORDS) or kind in MUSOLLAH_KINDS


def places(data: dict) -> list:
    out, seen = [], set()
    for e in data["elements"]:
        mid = e.get("center") or {}
        lat, lon = e.get("lat", mid.get("lat")), e.get("lon", mid.get("lon"))
        if lat is None or lon is None:
            continue
        tags = e.get("tags") or {}
        name = next((n for n in (tags.get("name:en"), tags.get("name")) if n), "")
        street = " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x)
        address = ", ".join(x for x in (street, tags.get("addr:suburb") or tags.get("addr:city")) if x)
        pid = f'{e.get("type", "node")[0]}{e.get("id", 0)}'
        if pid in seen:
            continue
        seen.add(pid)
        out.append([pid, round(lat, 5), round(lon, 5), name, address, 1 if is_musollah(name, tags) else 0])
    out.sort(key=lambda p: (p[1], p[2]))
    return out


def previous_count(path: str) -> int:
    try:
        with open(path) as f:
            return len(json.load(f)["places"])
    except Exception:
        return 0


def main(out_dir: str) -> int:
    os.makedirs(out_dir, exist_ok=True)
    today = datetime.date.today().isoformat()
    index = {"updated": today, "countries": {}}
    for cc in COUNTRIES:
        path = os.path.join(out_dir, f"{cc.lower()}.json")
        before = previous_count(path)
        data = fetch(cc)
        found = places(data) if data else []
        if found and len(found) >= before * MIN_SHARE:
            with open(path, "w") as f:
                json.dump({"country": cc, "updated": today, "places": found}, f, ensure_ascii=False, separators=(",", ":"))
            print(f"{cc}: {len(found)} places (last week {before})")
        else:
            print(f"::warning::{cc}: kept last week's list ({before} places); new fetch gave {len(found)}")
        if os.path.exists(path):
            with open(path) as f:
                saved = json.load(f)
            index["countries"][cc] = {"updated": saved["updated"], "places": len(saved["places"])}
    with open(os.path.join(out_dir, "index.json"), "w") as f:
        json.dump(index, f, indent=1)
    return 0 if index["countries"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "masjids"))
