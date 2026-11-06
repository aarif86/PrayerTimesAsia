#!/usr/bin/env python3
"""Build a translated home page (ms/, id/, ar/, ur/, bn/, tr/, fr/) from the English one.

    python3 tools/build_site_lang.py ms site/index.html site/i18n/ms.json _site/ms/index.html
    python3 tools/build_site_lang.py id site/index.html site/i18n/id.json _site/id/index.html

Every piece of visible text, every alt/aria-label and the page title and link
previews are looked up in site/i18n/<lang>.json (English -> that language). The
build fails and lists what is missing when the English page gains text the
language file doesn't have yet, so they never drift apart silently. Keys that
start with "_" are settings, not page text ("_share" is the WhatsApp link,
"_label" the short name on the language button, "_appnote" a line saying the app
itself is still in English, "_head" extra tags for the <head>, such as a font).
Arabic and Urdu pages are built right to left. Anything between <!--notr--> and
<!--/notr--> is left as it is (the language menu, where each name is in its own
language).
"""
RTL = {'ar', 'ur', 'fa'}
import html
import json
import re
import sys

lang, src, table_path, out_path = sys.argv[1:5]
page = open(src, encoding='utf-8').read()
table = json.load(open(table_path, encoding='utf-8'))
missing = []
used = set()


def tr(text):
    key = html.unescape(text.strip())
    if not key or not any(c.isalpha() for c in key):
        return text
    if key not in table:
        missing.append(key)
        return text
    used.add(key)
    lead = text[: len(text) - len(text.lstrip())]
    tail = text[len(text.rstrip()):]
    out = html.escape(table[key], quote=False)
    return lead + out + tail


# Keep code and drawings out of the way while translating text.
kept = []


def keep(m):
    kept.append(m.group(0))
    return f'\x00{len(kept) - 1}\x00'


head_end = page.index('<body')
work = re.sub(r'<!--notr-->[\s\S]*?<!--/notr-->|<(script|style|svg)\b[\s\S]*?</\1>', keep, page)

# Text between tags (the <title> and everything in <body>).
title_re = re.compile(r'(<title>)([^<]*)(</title>)')
work = title_re.sub(lambda m: m.group(1) + tr(m.group(2)) + m.group(3), work)
body_at = work.index('<body')
body = re.sub(r'>([^<\x00]+)<', lambda m: '>' + tr(m.group(1)) + '<', work[body_at:])
work = work[:body_at] + body


# Attributes people read or hear.
def attr(m):
    return f'{m.group(1)}="{html.escape(html.unescape(tr(m.group(2))), quote=True)}"'


work = re.sub(r'\b(alt|aria-label)="([^"]*)"', attr, work)
work = re.sub(r'(<meta (?:name="description"|property="og:(?:title|description)") content)="([^"]*)"',
              attr, work)

if missing:
    sys.stderr.write(f'Missing {lang} text in ' + table_path + ':\n' + '\n'.join('  ' + m for m in missing) + '\n')
    sys.exit(1)

work = re.sub(r'\x00(\d+)\x00', lambda m: kept[int(m.group(1))], work)

# The page lives one folder down: fix relative links (not #anchors, mailto or full URLs).
work = re.sub(r'\b(href|src)="(?!https?:|mailto:|#|/|data:)([^"]*)"',
              lambda m: f'{m.group(1)}="../{m.group(2)}"', work)
work = work.replace('url("fonts/', 'url("../fonts/')
work = work.replace('<html lang="en">', f'<html lang="{lang}"' + (' dir="rtl"' if lang in RTL else '') + '>', 1)
if table.get('_head'):
    work = work.replace('</head>', table['_head'] + '\n</head>', 1)


def must_replace(old, new):
    global work
    if old not in work:
        sys.exit(f'build_site_lang.py: expected to find {old!r} in {src}')
    work = work.replace(old, new)


must_replace('href=".././" hreflang="en" aria-current="page"', 'href="../" hreflang="en" lang="en"')
must_replace('<span class="cur">EN</span>', f'<span class="cur">{table.get("_label", lang.upper())}</span>')
# Language switch: English is one folder up, this language is here.
must_replace(f'href="../{lang}/" hreflang="{lang}" lang="{lang}"', f'href="./" hreflang="{lang}" lang="{lang}" aria-current="page"')
# A short line under the hero saying the app itself is in English for now.
if table.get('_appnote'):
    m = re.search(r'<p class="note">[\s\S]*?</p>', work)
    work = work[:m.end()] + f'\n        <p class="app-lang">{html.escape(table["_appnote"], quote=False)}</p>' + work[m.end():]
# WhatsApp share text.
must_replace(
    'https://wa.me/?text=A%20free%20prayer%20app%20made%20by%20Ustaz%20Aarif%2C%20no%20ads%20https%3A%2F%2Fprayertimes.asia',
    table['_share'])

import os
os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
open(out_path, 'w', encoding='utf-8').write(work)
unused = [k for k in table if k not in used and not k.startswith('_')]
if unused:
    print(f'Note, {len(unused)} lines in {table_path} are no longer on the English page')
print(f'Built {out_path}')
