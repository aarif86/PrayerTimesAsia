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
    [id, lat, lon, name, address, musollah 0/1, facilities, opening_hours, details]
An empty name means OpenStreetMap has none; the apps call it Masjid or Musollah.
The last two are left off when OpenStreetMap has neither. facilities is a short
string of letters, one for each thing the map says the place has:
    w  space for women      a  wheelchair access
    p  parking              t  toilets
opening_hours is OpenStreetMap's own text ("Mo-Su 10:00-22:00"), mostly on
prayer rooms in malls and offices.
"""
import datetime
import glob
import json
import math
import re
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

# A second, community-kept list of musollahs and masjids (mostly Singapore
# prayer rooms in malls, schools and sports centres that OpenStreetMap lacks).
# Only its prayer rooms are used (see musolla_db_places).
# https://github.com/ruqqq/musolla-database, LGPL 3.0: we credit it in the apps
# and send any fixes we make back to it. Started by the KalamApps and
# PrayerTime.SG / Fivecalling teams.
# Our fork first (checked suggestions and fixes go there), then the original.
MUSOLLA_DB = [
    "https://raw.githubusercontent.com/aarif86/musolla-database/master/data.json",
    "https://raw.githubusercontent.com/ruqqq/musolla-database/master/data.json",
]
# A place from that list is skipped when OpenStreetMap already has one this close (metres).
SAME_PRAYER_ROOM_M = 60
SAME_MASJID_M = 400
# ...or this close with the same name (a mall's room pinned at the mall's middle).
SAME_NAME_M = 300


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


YES = {"yes", "designated", "limited", "separate", "only"}


def facilities(tags: dict) -> str:
    """What the map says the place has, as letters (see the place format above)."""
    f = ""
    if any((tags.get(k) or "").lower() in YES for k in ("female", "women", "prayer_room:female", "female_prayer_room")):
        f += "w"
    if (tags.get("wheelchair") or "").lower() in YES:
        f += "a"
    if (tags.get("parking") or "").lower() not in ("", "no") or (tags.get("capacity:parking") or "").strip("0 "):
        f += "p"
    if (tags.get("toilets") or "").lower() in YES:
        f += "t"
    return f


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
        row = [pid, round(lat, 5), round(lon, 5), name, address, 1 if is_musollah(name, tags) else 0]
        extra, hours = facilities(tags), (tags.get("opening_hours") or "").strip()[:120]
        if extra or hours:
            row.append(extra)
        if hours:
            row.append(hours)
        out.append(row)
    out.sort(key=lambda p: (p[1], p[2]))
    return out


def metres(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    x = math.radians(b_lon - a_lon) * math.cos(math.radians((a_lat + b_lat) / 2))
    return 6371000 * math.hypot(x, math.radians(b_lat - a_lat))


def fetch_musolla_db() -> dict | None:
    for url in MUSOLLA_DB:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PrayerTimesAsia weekly masjid list"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            if isinstance(data, dict) and data:
                print(f"musolla-database: {len(data)} entries from {url}")
                return data
        except Exception as e:
            print(f"  musolla-database {url}: {str(e)[:120]}", file=sys.stderr)
    print("::warning::musolla-database: no copy could be read, using last week's", file=sys.stderr)
    return None


def clean(x, n=300) -> str:
    t = " ".join(str(x or "").replace("\xa0", " ").split())
    return "" if t.lower() in ("null", "none", "-", "n/a") else t[:n]


def room_details(v: dict, address: str) -> dict:
    """The extra facts the community list holds for a prayer room, short keys, empty ones left out.
    f how to find it, l level, m nearest MRT, p what is provided, t level of the toilet,
    c who it fits, n notes, g shared or separate. Never filled in from guesses."""
    d = {}
    how = clean(v.get("directions"))
    if how and len(how) > 3:
        d["f"] = how
    level = clean(v.get("level"), 20)
    if level and level not in ("0",):
        d["l"] = level
    mrt = clean(v.get("mrt") or v.get("nearestMrt"), 40)
    if mrt:
        d["m"] = mrt
    prov = clean(v.get("provision") or v.get("provisions"), 120)
    if prov:
        d["p"] = prov
    toilet = clean(v.get("toiletLevel") or v.get("nearestToilet"), 40)
    if toilet:
        d["t"] = toilet
    cap = []
    for key, label in (("femaleCapacity", "women"), ("maleCapacity", "men"), ("unisexCapacity", "shared"), ("sharedCapacity", "shared")):
        n = v.get(key)
        if isinstance(n, (int, float)) and n > 0:
            cap.append(f"{label} {int(n)}")
    if cap:
        d["c"] = ", ".join(cap)
    notes = clean(v.get("remarks") or v.get("additionalInfo"), 300)
    if notes:
        d["n"] = notes
    return d


def musolla_db_places(data: dict) -> list:
    """The community list in our place format; ids start with "m" so they never meet an OSM id."""
    out = []
    for key, v in data.items():
        if not isinstance(v, dict):
            continue
        loc = v.get("location") or {}
        try:
            lat, lon = float(loc["latitude"]), float(loc["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
            continue
        # Only the prayer rooms for now. Its masjids are either on OpenStreetMap
        # already (Singapore) or a 2018 bulk import from addresses (Kelantan)
        # whose pins we haven't checked.
        if v.get("type") != "Musolla":
            continue
        name = " ".join(str(v.get("name") or "").split())[:120]
        musollah = True
        address = " ".join(str(v.get("address") or "").split())
        details = room_details(v, address)
        row = [f"m{str(v.get('uuid') or key)[:13]}", round(lat, 5), round(lon, 5), name, address[:160], 1 if musollah else 0]
        women = (v.get("femaleCapacity") or 0) not in (0, "0", "") or "female" in str(v.get("remarks") or "").lower() and "no female" not in str(v.get("remarks") or "").lower()
        row.append("w" if women else "")
        if details:
            row += ["", details]  # no opening hours in this list; the 9th slot is the details
        elif not women:
            row.pop()
        out.append(row)
    return out


GENERIC_NAMES = {"surau", "musolla", "musollah", "musalla", "prayerroom", "masjid", "mosque", "muslimprayerroom", "praying room".replace(" ", "")}


def same_name(a: str, b: str) -> bool:
    a, b = ("".join(ch for ch in x.lower() if ch.isalnum()) for x in (a, b))
    if a in GENERIC_NAMES or b in GENERIC_NAMES:
        return False  # "Surau" next to another "Surau" may well be a different room
    return len(a) >= 5 and len(b) >= 5 and (a in b or b in a)


def add_extras(tiles: dict, extras: list) -> int:
    """Puts community places into the squares, unless OpenStreetMap already has them."""
    added = 0
    for p in extras:
        near = []
        for dlat in (-1, 0, 1):
            for dlon in (-1, 0, 1):
                near += tiles.get(f"{math.floor(p[1]) + dlat}_{math.floor(p[2]) + dlon}", {}).values()
        limit = SAME_PRAYER_ROOM_M if p[5] else SAME_MASJID_M
        # A room this close to any OpenStreetMap place (masjid or room) is that place.
        if any(q[0][0] != "m" and metres(p[1], p[2], q[1], q[2]) < (limit if q[5] == p[5] else SAME_PRAYER_ROOM_M) for q in near):
            continue
        if any(same_name(p[3], q[3]) and metres(p[1], p[2], q[1], q[2]) < SAME_NAME_M for q in near):
            continue
        if any(q[0][0] == "m" and metres(p[1], p[2], q[1], q[2]) < 15 for q in near):
            continue  # two rooms on one pin can't be told apart on the map; keep the first
        tiles.setdefault(tile_key(p[1], p[2]), {})[p[0]] = p
        added += 1
    return added


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
    # Keep last week's copy, so a bad day at GitHub doesn't drop these pins.
    saved = os.path.join(out_dir, "extra", "musolla-database.json")
    extras = fetch_musolla_db()
    if extras:
        os.makedirs(os.path.dirname(saved), exist_ok=True)
        with open(saved, "w") as f:
            json.dump(extras, f, ensure_ascii=False, separators=(",", ":"))
        with open(os.path.join(os.path.dirname(saved), "README.txt"), "w") as f:
            f.write("musolla-database.json is a copy of https://github.com/aarif86/musolla-database\n"
                    "(fork of https://github.com/ruqqq/musolla-database), shared under the GNU LGPL 3.0.\n"
                    "Started by the KalamApps and PrayerTime.SG teams, kept by volunteers.\n")
    else:
        extras = load(saved)
    extra_count = add_extras(tiles, musolla_db_places(extras)) if extras else 0
    print(f"musolla-database: {extra_count} places added that OpenStreetMap lacks")
    tile_dir = os.path.join(out_dir, "tiles")
    for old in glob.glob(os.path.join(tile_dir, "*.json")):
        os.remove(old)
    os.makedirs(tile_dir, exist_ok=True)
    for key, by_id in tiles.items():
        rows = sorted(by_id.values(), key=lambda p: (p[1], p[2]))
        with open(os.path.join(tile_dir, f"{key}.json"), "w") as f:
            json.dump({"tile": key, "updated": today, "places": rows}, f, ensure_ascii=False, separators=(",", ":"))
    index = {"updated": today, "countries": countries, "tiles": sorted(tiles),
             "extra": {"musolla-database": extra_count}}
    with open(os.path.join(out_dir, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    total = sum(c["places"] for c in countries.values())
    print(f"{len(countries)} countries, {total} places, {len(tiles)} squares; kept last week for: {' '.join(kept) or 'none'}")
    return 0 if countries else 1


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else "masjids", [a.upper() for a in args[1:]]))
