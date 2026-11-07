#!/usr/bin/env python3
"""Builds the ready-made masjid and surau lists the apps download once a week.

    python3 tools/build_masjid_list.py OUT_DIR [CC ...]

For every country the app supports (data/countries.json), asks OpenStreetMap
(Overpass) for every Muslim place of worship, then cuts the world into small
squares of one degree (about 110 km) so a phone downloads only the few squares
around it, never a whole country. The apps read these instead of asking the busy
Overpass servers live, so the Masjid tab fills at once, even on a weak signal.

OUT_DIR/countries/<cc>.json  every place in a country (what the squares are cut from)
OUT_DIR/tiles/<lat>_<lon>.json  places in one square, south-west corner, e.g. 3_101
OUT_DIR/index.json  which squares exist and which countries are covered

Big countries are fetched in pieces (the country's box, split in four until the
servers answer). A country whose fetch fails, or comes back with far fewer
places than last week's file, keeps last week's file, so one bad night on the
servers never empties a list.

Place format, kept small (arrays; five decimals is about 1 m):
    [id, lat, lon, name, address, musollah 0/1]
An empty name means OpenStreetMap has none; the apps call it Masjid or Musollah.
"""
import datetime
import glob
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
# How far a box is split in four before giving up on that piece.
MAX_DEPTH = 4
PAUSE = 3  # seconds between requests, to be gentle with volunteer servers


def ask(q: str, timeout: int, servers: int = len(MIRRORS)) -> dict | None:
    """One Overpass question, tried on each server in turn."""
    body = urllib.parse.urlencode({"data": q}).encode()
    for url in MIRRORS[:servers]:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": "PrayerTimesAsia weekly masjid list"})
            with urllib.request.urlopen(req, timeout=timeout + 60) as r:
                data = json.load(r)
            time.sleep(PAUSE)
            # A "remark" means the server ran out of time or memory: the answer is partial.
            if isinstance(data.get("elements"), list) and "remark" not in data:
                return data
            print(f"  {url}: {str(data.get('remark'))[:120]}", file=sys.stderr)
        except Exception as e:  # busy, timed out, bad JSON: try the next server
            print(f"  {url}: {str(e)[:120]}", file=sys.stderr)
            time.sleep(PAUSE)
    return None


def area(cc: str) -> str:
    return f'area["ISO3166-1"="{cc}"][admin_level=2]->.a;'


def fetch_box(cc: str, box: tuple, depth: int) -> list | None:
    s, w, n, e = box
    q = (f"[out:json][timeout:180];{area(cc)}"
         f'nwr["amenity"="place_of_worship"]["religion"="muslim"](area.a)({s},{w},{n},{e});out center tags;')
    data = ask(q, 180)
    if data is not None:
        return data["elements"]
    if depth >= MAX_DEPTH:
        return None
    mid_lat, mid_lon = (s + n) / 2, (w + e) / 2
    found = []
    for part in [(s, w, mid_lat, mid_lon), (s, mid_lon, mid_lat, e), (mid_lat, w, n, mid_lon), (mid_lat, mid_lon, n, e)]:
        got = fetch_box(cc, part, depth + 1)
        if got is None:
            return None
        found += got
    return found


def fetch(cc: str) -> list | None:
    """Every Muslim place of worship in a country, or None if the servers wouldn't say."""
    q = (f"[out:json][timeout:300];{area(cc)}"
         'nwr["amenity"="place_of_worship"]["religion"="muslim"](area.a);out center tags;')
    # One try for the whole country; a big one is quicker in pieces than retried.
    data = ask(q, 300, servers=1)
    if data is not None:
        return data["elements"]
    # Too big in one go: find the country's box and ask piece by piece.
    bb = ask(f'[out:json][timeout:60];rel["ISO3166-1"="{cc}"][admin_level=2];out bb;', 60)
    bounds = next((el.get("bounds") for el in (bb or {}).get("elements", []) if el.get("bounds")), None)
    if not bounds:
        return None
    box = (bounds["minlat"], bounds["minlon"], bounds["maxlat"], bounds["maxlon"])
    print(f"  {cc}: fetching in pieces within {box}", file=sys.stderr)
    return fetch_box(cc, box, 1)


def is_musollah(name: str, tags: dict) -> bool:
    lower = name.lower()
    kind = (tags.get("place_of_worship:type") or tags.get("place_of_worship") or "").lower()
    return any(w in lower for w in MUSOLLAH_WORDS) or kind in MUSOLLAH_KINDS


def places(elements: list) -> list:
    out, seen = [], set()
    for e in elements:
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


def tile_key(lat: float, lon: float) -> str:
    return f"{math.floor(lat)}_{math.floor(lon)}"


def load(path: str) -> dict | None:
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def main(out_dir: str, only: list[str]) -> int:
    codes = only or [c["code"] for c in json.load(open(os.path.join(ROOT, "data", "countries.json")))["countries"]]
    os.makedirs(os.path.join(out_dir, "countries"), exist_ok=True)
    today = datetime.date.today().isoformat()
    kept = []
    for cc in codes:
        path = os.path.join(out_dir, "countries", f"{cc.lower()}.json")
        before = len((load(path) or {}).get("places", []))
        started = time.time()
        elements = fetch(cc)
        found = places(elements) if elements is not None else None
        took = int(time.time() - started)
        # An empty answer is fine for a country with none mapped, but not when last week had some.
        if found is not None and len(found) >= before * MIN_SHARE:
            with open(path, "w") as f:
                json.dump({"country": cc, "updated": today, "places": found}, f, ensure_ascii=False, separators=(",", ":"))
            print(f"{cc}: {len(found)} places (last week {before}), {took}s")
        else:
            kept.append(cc)
            print(f"::warning::{cc}: kept last week's list ({before} places); new fetch gave {'nothing' if found is None else len(found)}")

    # Cut every country into one-degree squares. A place on a border may be in
    # two countries' answers; its OpenStreetMap id keeps it to one pin.
    tiles: dict[str, dict[str, list]] = {}
    countries = {}
    for path in sorted(glob.glob(os.path.join(out_dir, "countries", "*.json"))):
        data = load(path)
        if not data:
            continue
        countries[data["country"]] = {"updated": data["updated"], "places": len(data["places"])}
        for p in data["places"]:
            tiles.setdefault(tile_key(p[1], p[2]), {})[p[0]] = p
    tile_dir = os.path.join(out_dir, "tiles")
    for old in glob.glob(os.path.join(tile_dir, "*.json")):
        os.remove(old)
    os.makedirs(tile_dir, exist_ok=True)
    for key, by_id in tiles.items():
        rows = sorted(by_id.values(), key=lambda p: (p[1], p[2]))
        with open(os.path.join(tile_dir, f"{key}.json"), "w") as f:
            json.dump({"tile": key, "updated": today, "places": rows}, f, ensure_ascii=False, separators=(",", ":"))
    index = {"updated": today, "countries": countries, "tiles": sorted(tiles)}
    with open(os.path.join(out_dir, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    total = sum(c["places"] for c in countries.values())
    print(f"{len(countries)} countries, {total} places, {len(tiles)} squares; kept last week for: {' '.join(kept) or 'none'}")
    return 0 if countries else 1


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else "masjids", [a.upper() for a in args[1:]]))
