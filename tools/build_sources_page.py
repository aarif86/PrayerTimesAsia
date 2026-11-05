#!/usr/bin/env python3
"""Build the public "Where our times come from" page from data/countries.json.

    python3 tools/build_sources_page.py data/countries.json _site/sources.html

The same table the apps are generated from, so the page can never say something
different from what the app does. Public copy rule: no colons or dashes in the text.
"""
import html
import json
import os
import sys

src, out = sys.argv[1:3]
data = json.load(open(src, encoding='utf-8'))
countries = sorted(data['countries'], key=lambda c: c['name'])

METHOD_NAMES = {'muis': 'MUIS timetable', 'jakim': 'JAKIM timetable', 'kemenag': 'Kemenag timetable',
                'sea': 'Southeast Asia method (20° and 18°)', 'mwl': 'Muslim World League',
                'karachi': 'University of Islamic Sciences, Karachi', 'ummalqura': 'Umm al‑Qura',
                'dubai': 'UAE General Authority', 'qatar': 'Qatar Ministry of Awqaf', 'kuwait': 'Kuwait Ministry of Awqaf',
                'diyanet': 'Diyanet', 'tehran': 'University of Tehran', 'egyptian': 'Egyptian General Authority of Survey',
                'isna': 'ISNA', 'moonsighting': 'Moonsighting Committee', 'uoif': 'France 12°',
                'russia': 'Spiritual Administration of Muslims of Russia', 'algeria': 'Algeria Ministry of Religious Affairs',
                'tunisia': 'Tunisia Ministry of Religious Affairs', 'morocco': 'Morocco Ministry of Habous',
                'jordan': 'Jordan Ministry of Awqaf'}
WHO = {'table': ('Official times', 'The authority publishes the times and the app shows them exactly as they are.'),
       'authority': ('Follows the local authority', 'The app works out the times on your phone, the same way this authority does.'),
       'standard': ("What most masjids use", 'There is no national authority the app can follow, so it uses what most masjids there use.')}


def flag(code):
    return ''.join(chr(0x1F1E6 + ord(ch) - 65) for ch in code.upper()) if len(code) == 2 else ''


def e(s):
    return html.escape(s or '', quote=True)


counts = {k: sum(1 for c in countries if c['source'] == k) for k in WHO}
rows = []
for c in countries:
    who = c.get('authority') or 'No single national authority'
    who = who[0].upper() + who[1:]
    rows.append(
        f'<tr data-s="{e(c["source"])}" data-q="{e((c["name"] + " " + who + " " + METHOD_NAMES.get(c["method"], "")).lower())}">'
        f'<td class="c"><span class="f">{flag(c["code"])}</span>{e(c["name"])}</td>'
        f'<td><span class="tag {e(c["source"])}">{e(WHO[c["source"]][0])}</span><div class="who">{e(who)}</div></td>'
        f'<td>{e(METHOD_NAMES.get(c["method"], c["method"]))}</td>'
        f'<td>{"Hanafi" if c["asr"] == "hanafi" else "Shafi&#39;i"}</td>'
        f'<td class="n">{e(c.get("note", ""))}</td></tr>')

cards = ''.join(
    f'<div class="card"><b>{counts[k]}</b><h3>{e(WHO[k][0])}</h3><p>{e(WHO[k][1])}</p></div>' for k in ('table', 'authority', 'standard'))

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Where our times come from | Prayer Times Asia</title>
<meta name="description" content="Every country in Prayer Times Asia, whose prayer times it follows and the method it uses. Your local religious authority first." />
<link rel="icon" href="img/favicon-32.png" sizes="32x32" />
<style>
  @font-face {{ font-family: "Twemoji Country Flags"; src: url("fonts/TwemojiCountryFlags.woff2") format("woff2"); unicode-range: U+1F1E6-1F1FF; font-display: swap; }}
  :root {{ --night: #0b0f2a; --card: rgba(255,255,255,0.05); --line: rgba(255,255,255,0.12); --text: #eef0fb; --muted: #a9b0d6; --gold: #f2b65a;
    --font: "Twemoji Country Flags", -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--night); color: var(--text); font-family: var(--font); line-height: 1.55; }}
  .wrap {{ max-width: 1100px; margin: 0 auto; padding: 0 20px; }}
  header {{ padding: 22px 0; border-bottom: 1px solid var(--line); }}
  header a {{ color: var(--text); text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 10px; }}
  header img {{ width: 30px; height: 30px; border-radius: 8px; }}
  h1 {{ font-size: clamp(1.9rem, 4vw, 2.8rem); margin: 44px 0 10px; letter-spacing: -0.02em; }}
  .lead {{ color: var(--muted); max-width: 760px; font-size: 1.08rem; }}
  .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 28px 0; }}
  .card {{ background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px 20px; }}
  .card b {{ font-size: 2rem; color: var(--gold); }}
  .card h3 {{ margin: 2px 0 6px; font-size: 1.05rem; }}
  .card p {{ margin: 0; color: var(--muted); font-size: 0.93rem; }}
  .tools {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 14px; }}
  input, select {{ font: inherit; color: var(--text); background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; }}
  input {{ flex: 1; min-width: 220px; }}
  .table {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.93rem; }}
  th, td {{ text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }}
  th {{ color: var(--muted); font-weight: 600; background: rgba(255,255,255,0.03); position: sticky; top: 0; }}
  tr:last-child td {{ border-bottom: 0; }}
  td.c {{ font-weight: 600; white-space: nowrap; }}
  .f {{ margin-right: 8px; }}
  .who {{ margin-top: 4px; }}
  td.n {{ color: var(--muted); min-width: 260px; }}
  .tag {{ display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 9px; border-radius: 999px; }}
  .tag.table {{ background: rgba(92, 200, 140, 0.18); color: #8fe3b4; }}
  .tag.authority {{ background: rgba(242, 182, 90, 0.18); color: var(--gold); }}
  .tag.standard {{ background: rgba(255,255,255,0.08); color: var(--muted); }}
  footer {{ color: var(--muted); padding: 34px 0 50px; font-size: 0.92rem; }}
  footer a, .lead a {{ color: var(--gold); }}
  @media (max-width: 700px) {{ td.n {{ display: none; }} th.n {{ display: none; }} }}
</style>
</head>
<body>
<header><div class="wrap"><a href="./"><img src="img/icon-192.png" alt="" />Prayer Times Asia</a></div></header>
<main class="wrap">
  <h1>Where our times come from</h1>
  <p class="lead">Prayer Times Asia follows your local religious authority first. Here is every country in the app, whose times it follows there, and how it works them out. This list comes straight from the app, so what you read here is exactly what the app does. If your masjid follows something different, please <a href="mailto:salam@prayertimes.asia?subject=Prayer%20time%20source">tell us</a>.</p>
  <div class="cards">{cards}</div>
  <div class="tools">
    <input id="q" type="search" placeholder="Search a country or authority" aria-label="Search a country or authority" />
    <select id="s" aria-label="Show">
      <option value="">All {len(countries)} countries</option>
      <option value="table">Official times</option>
      <option value="authority">Follows the local authority</option>
      <option value="standard">What most masjids use</option>
    </select>
  </div>
  <div class="table"><table>
    <thead><tr><th>Country</th><th>Whose times</th><th>Method</th><th>Asr</th><th class="n">Note</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table></div>
</main>
<footer class="wrap">Anywhere not listed uses the Muslim World League method. You can always change this in the app's Settings. <a href="./">Back to Prayer Times Asia</a></footer>
<script>
  var q = document.getElementById('q'), s = document.getElementById('s'), rows = document.querySelectorAll('tbody tr');
  function f() {{ var t = q.value.trim().toLowerCase(), k = s.value;
    rows.forEach(function (r) {{ r.hidden = (t && r.dataset.q.indexOf(t) < 0) || (k && r.dataset.s !== k); }}); }}
  q.addEventListener('input', f); s.addEventListener('change', f);
</script>
</body>
</html>
'''
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
open(out, 'w', encoding='utf-8').write(page)
print(f'Built {out} ({len(countries)} countries)')
