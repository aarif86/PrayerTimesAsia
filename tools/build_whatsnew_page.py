#!/usr/bin/env python3
"""Build the public "What's new" page from docs/website/changelog.json.

    python3 tools/build_whatsnew_page.py docs/website/changelog.json _site/whatsnew.html

The same file the GitHub changelog.md is made from (tools/website_docs.py), so the page
can never say something different. English only for now. Public copy rule: no colons or
dashes in the text the page adds itself.
"""
import datetime
import html
import json
import os
import re
import sys

src, out = sys.argv[1:3]
data = json.load(open(src, encoding='utf-8'))
releases = data['releases']
LABEL = {'new': 'New', 'improved': 'Improved', 'fixed': 'Fixed'}
GITHUB = 'https://github.com/aarif86/PrayerTimesAsia/blob/main/docs/website/changelog.md'
SHOWN = 6  # newest releases open on the page, the rest sit under "Earlier releases"


def plain(s):
    """Public copy rule, no colons or dashes. Older lines written as "Name: what it does" become two sentences."""
    s = (s or '').replace('\u2014', ',').replace('\u2013', ',')
    return re.sub(r':\s+(\w)', lambda m: '. ' + m.group(1).upper(), s)


def e(s):
    return html.escape(plain(s), quote=True)


def pretty(d):
    t = datetime.date.fromisoformat(d)
    return f'{t.day} {t.strftime("%B %Y")}'


def card(r, latest=False):
    groups = ''
    for kind in ('new', 'improved', 'fixed'):
        items = [c['text'] for c in r['changes'] if c['type'] == kind]
        if items:
            lis = ''.join(f'<li>{e(t)}</li>' for t in items)
            groups += f'<div class="grp {kind}"><span class="tag {kind}">{LABEL[kind]}</span><ul>{lis}</ul></div>'
    kinds = ' '.join(sorted({c['type'] for c in r['changes']}))
    badge = '<span class="latest">Latest</span>' if latest else ''
    return (f'<article class="rel{" top" if latest else ""}" data-kinds="{kinds}">'
            f'<div class="meta"><time datetime="{e(r["date"])}">{pretty(r["date"])}</time>'
            f'<span class="build">Build {r["build"]}</span>{badge}</div>'
            f'<h3>{e(r["title"])}</h3><p class="sum">{e(r["summary"])}</p>{groups}</article>')


newest = ''.join(card(r, i == 0) for i, r in enumerate(releases[:SHOWN]))
earlier = ''.join(card(r) for r in releases[SHOWN:])
earlier_block = (f'<details class="earlier"><summary>Earlier releases ({len(releases) - SHOWN})</summary>{earlier}</details>'
                 if earlier else '')
total_new = sum(1 for r in releases for c in r['changes'] if c['type'] == 'new')

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>What's new | Prayer Times Asia</title>
<meta name="description" content="Every update to Prayer Times Asia, newest first, in plain words." />
<meta name="theme-color" content="#0b0f2a" />
<meta name="color-scheme" content="dark light" />
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png" />
<style>
  :root {{ --night: #0b0f2a; --card: rgba(255,255,255,0.05); --line: rgba(255,255,255,0.12); --text: #eef0fb; --muted: #a9b0d6; --gold: #f2b65a;
    --green: #8fe3b4; --green-bg: rgba(92,200,140,.18); --blue: #a9c4ff; --blue-bg: rgba(120,160,255,.18); --coral: #ffb09f; --coral-bg: rgba(224,99,79,.2);
    --font: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color-scheme: dark; }}
  :root[data-theme="light"] {{ --night: #F2EEE9; --card: #ffffff; --line: rgba(21,26,69,0.13); --text: #151A45; --muted: #4c5380; --gold: #8a5a00;
    --green: #14693f; --green-bg: rgba(28,138,85,.14); --blue: #2a4fa8; --blue-bg: rgba(60,100,200,.12); --coral: #a8321f; --coral-bg: rgba(224,99,79,.14); color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--night); color: var(--text); font: 17px/1.6 var(--font); }}
  main {{ max-width: 780px; margin: 0 auto; padding: 24px 20px 72px; }}
  .bar {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 28px; }}
  .bar a.home {{ color: var(--text); text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 10px; }}
  .bar a.home img {{ width: 30px; height: 30px; border-radius: 8px; }}
  .bar .right {{ display: flex; align-items: center; gap: 10px; }}
  a.back {{ white-space: nowrap; font-weight: 600; font-size: 0.92rem; color: var(--muted); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; transition: color .2s, border-color .2s; }}
  a.back:hover {{ color: var(--gold); border-color: var(--gold); }}
  a.back .short {{ display: none; }}
  @media (max-width: 520px) {{ a.back .long {{ display: none; }} a.back .short {{ display: inline; }} }}
  h1 {{ font-size: clamp(2rem, 5vw, 2.8rem); line-height: 1.15; margin: 8px 0 12px; letter-spacing: -0.02em; }}
  .lead {{ color: var(--muted); font-size: 1.1rem; margin: 0 0 22px; }}
  a {{ color: var(--gold); }}
  .filters {{ display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 26px; }}
  .filters button {{ font: inherit; font-size: 0.92rem; font-weight: 600; color: var(--muted); background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 7px 16px; cursor: pointer; transition: color .2s, border-color .2s; }}
  .filters button:hover {{ border-color: var(--gold); color: var(--text); }}
  .filters button[aria-pressed="true"] {{ color: var(--night); background: var(--gold); border-color: var(--gold); }}
  .timeline {{ position: relative; padding-left: 26px; }}
  .timeline::before {{ content: ""; position: absolute; left: 6px; top: 8px; bottom: 8px; width: 2px; background: linear-gradient(var(--gold), var(--line) 30%); border-radius: 2px; }}
  .rel {{ position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px 20px; margin-bottom: 14px; }}
  .rel::before {{ content: ""; position: absolute; left: -26px; top: 24px; width: 14px; height: 14px; border-radius: 50%; background: var(--night); border: 3px solid var(--gold); }}
  .rel.top {{ border-color: var(--gold); }}
  .rel[hidden] {{ display: none; }}
  .meta {{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 0.88rem; color: var(--muted); }}
  .build {{ border: 1px solid var(--line); border-radius: 999px; padding: 0 10px; }}
  .latest {{ background: var(--gold); color: var(--night); font-weight: 700; border-radius: 999px; padding: 0 10px; }}
  .rel h3 {{ font-size: 1.2rem; margin: 6px 0 4px; line-height: 1.3; }}
  .sum {{ color: var(--muted); margin: 0 0 10px; }}
  .grp {{ margin-top: 12px; }}
  .grp ul {{ margin: 6px 0 0; padding-left: 20px; }}
  .grp li {{ margin: 0 0 6px; font-size: 0.97rem; }}
  .tag {{ display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 1px 10px; border-radius: 999px; }}
  .tag.new {{ background: var(--green-bg); color: var(--green); }}
  .tag.improved {{ background: var(--blue-bg); color: var(--blue); }}
  .tag.fixed {{ background: var(--coral-bg); color: var(--coral); }}
  details.earlier {{ margin-top: 6px; }}
  details.earlier summary {{ cursor: pointer; font-weight: 600; color: var(--gold); padding: 8px 0 16px; }}
  .none {{ color: var(--muted); margin: 0 0 14px; }}
  .note {{ margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.95rem; }}
  :focus-visible {{ outline: 3px solid var(--gold); outline-offset: 3px; border-radius: 6px; }}
  /* Light and dark button (sun and moon). */
  .mode {{ width: 40px; height: 40px; flex: none; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--gold); cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; padding: 0; transition: border-color .2s, transform .2s; }}
  .mode[hidden] {{ display: none; }}
  .mode:hover {{ border-color: var(--gold); transform: rotate(12deg); }}
  .mode svg {{ width: 20px; height: 20px; }}
  .mode .sun {{ display: none; }}
  [data-theme="light"] .mode .sun {{ display: block; }}
  [data-theme="light"] .mode .moon-icon {{ display: none; }}
  @media (prefers-reduced-motion: reduce) {{ * {{ transition: none !important; }} }}
</style>
<script>
  // Pick light or dark before the page paints: the visitor's saved choice first, then the device setting.
  (function () {{
    var t = null;
    try {{ t = localStorage.getItem('pta-theme'); }} catch (e) {{}}
    if (t !== 'light' && t !== 'dark') {{ t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }}
    document.documentElement.setAttribute('data-theme', t);
  }})();
</script>
</head>
<body>
<main>
  <div class="bar">
    <a class="home" href="./"><img src="img/icon-192.png" alt="" />Prayer Times Asia</a>
    <div class="right"><button class="mode" type="button" hidden aria-label="Switch between light and dark"><svg class="moon-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a.7.7 0 0 0-.9-.8A9.9 9.9 0 1 0 21.3 15.1a.7.7 0 0 0-.8-.9z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg></button>
    <a class="back" href="./">&#8592; <span class="long">Back to home</span><span class="short">Home</span></a></div>
  </div>
  <h1>What's new</h1>
  <p class="lead">Every update to Prayer Times Asia, newest first, in plain words. {total_new} new things so far, and we keep adding more.</p>
  <div class="filters" role="group" aria-label="Show">
    <button type="button" data-f="all" aria-pressed="true">Everything</button>
    <button type="button" data-f="new" aria-pressed="false">New</button>
    <button type="button" data-f="improved" aria-pressed="false">Improved</button>
    <button type="button" data-f="fixed" aria-pressed="false">Fixed</button>
  </div>
  <div class="timeline" id="log">
    {newest}
    {earlier_block}
  </div>
  <p class="none" id="none" hidden>Nothing here yet.</p>
  <div class="note">
    <p>Prayer Times Asia helps you pray on time. Please always follow your local religious authority.</p>
    <p>Want the plain list as it is kept for the project? <a href="{GITHUB}" target="_blank" rel="noopener">See the full change log on GitHub</a>.</p>
  </div>
</main>
<button class="totop" type="button" aria-label="Back to top" title="Back to top">&#8593;</button>
<style>
  .totop {{ position: fixed; right: 20px; bottom: 20px; width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgba(255,255,255,.18); background: #1a1f45; color: #f2c063; font-size: 1.3rem; cursor: pointer; display: grid; place-items: center; opacity: 0; transform: translateY(12px); pointer-events: none; transition: opacity .3s, transform .3s; box-shadow: 0 6px 20px rgba(0,0,0,.35); z-index: 50; }}
  .totop.show {{ opacity: 1; transform: none; pointer-events: auto; }}
  .totop:hover {{ border-color: #f2c063; }}
  .totop:focus-visible {{ outline: 3px solid #f2c063; outline-offset: 3px; }}
  [data-theme="light"] .totop {{ background: #ffffff; color: #8a5a00; border-color: rgba(21,26,69,.18); box-shadow: 0 6px 20px rgba(21,26,69,.18); }}
  [data-theme="light"] .totop:hover {{ border-color: #8a5a00; }}
  @media (prefers-reduced-motion: reduce) {{ .totop {{ transition: none; }} }}
</style>
<script>
  // Back to top button: appears after scrolling down a screen or so.
  (function () {{
    var tb = document.querySelector('.totop');
    window.addEventListener('scroll', function () {{ tb.classList.toggle('show', window.scrollY > 500); }}, {{ passive: true }});
    tb.addEventListener('click', function () {{ window.scrollTo({{ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }}); }});
  }})();
  // Filter by New, Improved or Fixed. Shows only matching lines inside each release.
  (function () {{
    var btns = document.querySelectorAll('.filters button'), rels = document.querySelectorAll('.rel'), none = document.getElementById('none'), earlier = document.querySelector('details.earlier');
    btns.forEach(function (b) {{
      b.addEventListener('click', function () {{
        var f = b.dataset.f, shown = 0;
        btns.forEach(function (x) {{ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }});
        rels.forEach(function (r) {{
          var ok = f === 'all' || r.dataset.kinds.split(' ').indexOf(f) >= 0;
          r.hidden = !ok; if (ok) shown++;
          r.querySelectorAll('.grp').forEach(function (g) {{ g.hidden = !(f === 'all' || g.classList.contains(f)); }});
        }});
        if (earlier) earlier.open = f !== 'all';
        none.hidden = shown > 0;
      }});
    }});
  }})();
</script>
<script>
  // Light and dark button: remembers the choice on this device for every page of the website.
  (function () {{
    var root = document.documentElement, btn = document.querySelector('.mode'), meta = document.querySelector('meta[name="theme-color"]');
    function paint() {{
      var light = root.getAttribute('data-theme') === 'light';
      if (meta) meta.setAttribute('content', light ? '#F2EEE9' : '#0b0f2a');
      if (btn) btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    }}
    if (btn) {{
      btn.hidden = false;
      btn.addEventListener('click', function () {{
        var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        try {{ localStorage.setItem('pta-theme', next); }} catch (e) {{}}
        paint();
      }});
    }}
    paint();
  }})();
</script>
</body>
</html>
'''
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
open(out, 'w', encoding='utf-8').write(page)
print(f'Built {out} ({len(releases)} releases)')
