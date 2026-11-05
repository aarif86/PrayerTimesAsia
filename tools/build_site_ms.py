#!/usr/bin/env python3
"""Build the Bahasa Melayu home page (ms/index.html) from the English one.

    python3 tools/build_site_ms.py site/index.html site/i18n/ms.json _site/ms/index.html

Every piece of visible text, every alt/aria-label and the page title and link
previews are looked up in site/i18n/ms.json (English -> Malay). The build fails
and lists what is missing when the English page gains text the Malay file
doesn't have yet, so the two never drift apart silently.
"""
import html
import json
import re
import sys

src, table_path, out_path = sys.argv[1:4]
page = open(src, encoding='utf-8').read()
table = json.load(open(table_path, encoding='utf-8'))
missing = []


def tr(text):
    key = html.unescape(text.strip())
    if not key or not any(c.isalpha() for c in key):
        return text
    if key not in table:
        missing.append(key)
        return text
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
work = re.sub(r'<(script|style|svg)\b[\s\S]*?</\1>', keep, page)

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
    sys.stderr.write('Missing Malay text in ' + table_path + ':\n' + '\n'.join('  ' + m for m in missing) + '\n')
    sys.exit(1)

work = re.sub(r'\x00(\d+)\x00', lambda m: kept[int(m.group(1))], work)

# The page lives one folder down: fix relative links (not #anchors, mailto or full URLs).
work = re.sub(r'\b(href|src)="(?!https?:|mailto:|#|/|data:)([^"]*)"',
              lambda m: f'{m.group(1)}="../{m.group(2)}"', work)
work = work.replace('<html lang="en">', '<html lang="ms">', 1)
# Language switch: English is one folder up, Malay is here.
def must_replace(old, new):
    global work
    if old not in work:
        sys.exit(f'build_site_ms.py: expected to find {old!r} in {src}')
    work = work.replace(old, new)


must_replace('href=".././" hreflang="en" aria-current="page"', 'href="../" hreflang="en"')
must_replace('href="../ms/" hreflang="ms" lang="ms"', 'href="./" hreflang="ms" lang="ms" aria-current="page"')
# WhatsApp share text.
must_replace(
    'https://wa.me/?text=A%20free%20prayer%20app%20made%20by%20Ustaz%20Aarif%2C%20no%20ads%20https%3A%2F%2Fprayertimes.asia',
    'https://wa.me/?text=Aplikasi%20solat%20percuma%20oleh%20Ustaz%20Aarif%2C%20tiada%20iklan%20https%3A%2F%2Fprayertimes.asia%2Fms%2F')

import os
os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
open(out_path, 'w', encoding='utf-8').write(work)
print(f'Built {out_path}')
