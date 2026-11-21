#!/usr/bin/env python3
"""Build the public Credits page in English, Malay and Indonesian.

    python3 tools/build_credits_page.py site/i18n/credits.json _site

Writes _site/credits.html (English), _site/ms/credits.html and _site/id/credits.html from
the one file site/i18n/credits.json, so the three can never drift apart. Fails if a language
is missing a line the English has. Public copy rule: no colons or dashes in the text.

The design thanks (prayertime.sg by AwsamTech) was added on the owner's say so, 21 Nov 2026.
"""
import html
import json
import os
import re
import sys

src, out = sys.argv[1:3]
T = json.load(open(src, encoding='utf-8'))
EN = T['en']
LANGS = ['en', 'ms', 'id']
LANG_NAMES = {'en': 'English', 'ms': 'Bahasa Melayu', 'id': 'Bahasa Indonesia'}


def e(s):
    return html.escape(s, quote=True)


def md(s, prefix):
    """Text with [label](url) links, escaped."""
    parts, last = [], 0
    for m in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', s):
        parts.append(e(s[last:m.start()]))
        parts.append(f'<a href="{e(link(m.group(2), prefix))}" target="_blank" rel="noopener">{e(m.group(1))}</a>')
        last = m.end()
    parts.append(e(s[last:]))
    return ''.join(parts)


def link(url, prefix):
    return url if re.match(r'(https?:|mailto:|#)', url) else prefix + url


def cards(items, prefix):
    rows = []
    for title, text, label, url in items:
        ext = url.startswith('http')
        attrs = ' target="_blank" rel="noopener"' if ext else ''
        rows.append(f'<div class="card"><h3>{e(title)}</h3><p>{e(text)}</p>'
                    f'<a href="{e(link(url, prefix))}"{attrs}>{e(label)}</a></div>')
    return '\n    '.join(rows)


def page(lang):
    L = T[lang]
    for k in EN:
        if k not in L:
            sys.exit(f'build_credits_page.py: {lang} is missing "{k}" in {src}')
    for k in ('times', 'built', 'community'):
        if len(L[k]) != len(EN[k]):
            sys.exit(f'build_credits_page.py: {lang} "{k}" has {len(L[k])} cards, English has {len(EN[k])}')
    prefix = '' if lang == 'en' else '../'
    home = './' if lang == 'en' else '../'
    switch = ' · '.join(
        f'<a href="{"credits.html" if lang == "en" else "../credits.html"}" hreflang="en" lang="en">{LANG_NAMES["en"]}</a>' if t == 'en' and lang != 'en'
        else f'<span aria-current="page">{LANG_NAMES[t]}</span>' if t == lang
        else f'<a href="{("" if lang == "en" else "../")}{t}/credits.html" hreflang="{t}" lang="{t}">{LANG_NAMES[t]}</a>'
        for t in LANGS)
    design = f'\n  <h2>{e(L["design_h"])}</h2>\n    {cards([L["design"]], prefix)}\n'
    return f'''<!doctype html>
<html lang="{L["html_lang"]}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{e(L["title"])}</title>
<meta name="description" content="{e(L["description"])}" />
<meta name="theme-color" content="#0b0f2a" />
<meta name="color-scheme" content="dark light" />
<link rel="icon" type="image/png" sizes="32x32" href="{prefix}img/favicon-32.png" />
<style>
  :root {{ --night: #0b0f2a; --card: rgba(255,255,255,0.05); --line: rgba(255,255,255,0.12); --text: #eef0fb; --muted: #a9b0d6; --gold: #f2b65a;
    --font: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color-scheme: dark; }}
  :root[data-theme="light"] {{ --night: #F2EEE9; --card: #ffffff; --line: rgba(21,26,69,0.13); --text: #151A45; --muted: #4c5380; --gold: #8a5a00; color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--night); color: var(--text); font: 17px/1.6 var(--font); }}
  main {{ max-width: 760px; margin: 0 auto; padding: 24px 20px 72px; }}
  .bar {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 28px; }}
  .bar a.home {{ color: var(--text); text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 10px; }}
  .bar a.home img {{ width: 30px; height: 30px; border-radius: 8px; }}
  .bar .right {{ display: flex; align-items: center; gap: 10px; }}
  a.back {{ white-space: nowrap; font-weight: 600; font-size: 0.92rem; color: var(--muted); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; transition: color .2s, border-color .2s; }}
  a.back:hover {{ color: var(--gold); border-color: var(--gold); }}
  a.back .short {{ display: none; }}
  @media (max-width: 520px) {{ a.back .long {{ display: none; }} a.back .short {{ display: inline; }} }}
  h1 {{ font-size: clamp(2rem, 5vw, 2.8rem); line-height: 1.15; margin: 8px 0 12px; letter-spacing: -0.02em; }}
  h2 {{ font-size: 1.25rem; margin: 40px 0 12px; color: var(--gold); }}
  h3 {{ font-size: 1.05rem; margin: 0 0 6px; }}
  p {{ color: var(--muted); margin: 0 0 12px; }}
  .lead {{ font-size: 1.1rem; }}
  a {{ color: var(--gold); }}
  .made {{ background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 20px 22px; }}
  .made p {{ color: var(--text); margin: 0; }}
  .card {{ background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px 20px; margin-bottom: 12px; }}
  .card p {{ font-size: 0.97rem; margin-bottom: 8px; }}
  .card a {{ font-size: 0.93rem; overflow-wrap: anywhere; }}
  .note {{ margin-top: 40px; padding-top: 22px; border-top: 1px solid var(--line); }}
  .note p.warm {{ color: var(--text); }}
  .langs {{ font-size: 0.93rem; margin-top: 24px; }}
  .langs span[aria-current] {{ color: var(--text); font-weight: 600; }}
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
    <a class="home" href="{home}"><img src="{prefix}img/icon-192.png" alt="" />{e(L["home"])}</a>
    <div class="right"><button class="mode" type="button" hidden aria-label="{e(L["mode"])}"><svg class="moon-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a.7.7 0 0 0-.9-.8A9.9 9.9 0 1 0 21.3 15.1a.7.7 0 0 0-.8-.9z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg></button>
    <a class="back" href="{home}">&#8592; <span class="long">{e(L["back"])}</span><span class="short">{e(L["back_short"])}</span></a></div>
  </div>
  <h1>{e(L["h1"])}</h1>
  <p class="lead">{e(L["lead"])}</p>

  <h2>{e(L["makers_h"])}</h2>
  <div class="made"><p>{md(L["makers"], prefix)}</p></div>

  <h2>{e(L["times_h"])}</h2>
    {cards(L["times"], prefix)}

  <h2>{e(L["built_h"])}</h2>
    {cards(L["built"], prefix)}

  <h2>{e(L["community_h"])}</h2>
    {cards(L["community"], prefix)}
{design}
  <div class="note">
    <p class="warm">{e(L["note"])}</p>
    <p>{e(L["contact"])} <a href="mailto:salam@prayertimes.asia">salam@prayertimes.asia</a>.</p>
    <p class="langs">{e(L["other_lang"])} {switch}</p>
  </div>
</main>
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


for lang in LANGS:
    path = os.path.join(out, 'credits.html' if lang == 'en' else f'{lang}/credits.html')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(page(lang))
    print('Built', path)
