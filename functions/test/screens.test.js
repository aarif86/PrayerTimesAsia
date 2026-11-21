'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validId, sgParts, summarize, parseDays } = require('../screens');

test('screen ids are random letters only', () => {
  assert.ok(validId('aB3_-xYz0123456789abcdef'));
  assert.ok(!validId('short'));
  assert.ok(!validId('Masjid Al Falah, Pasir Ris 123'));
  assert.ok(!validId({}));
});

test('Singapore date and 15 minute slot', () => {
  // 2026-11-21 15:14 UTC is 23:14 in Singapore.
  const p = sgParts(Date.parse('2026-11-21T15:14:00Z'));
  assert.equal(p.date, '2026-11-21');
  assert.equal(p.slot, '2300');
  // 16:05 UTC is 00:05 the next day in Singapore.
  assert.equal(sgParts(Date.parse('2026-11-21T16:05:00Z')).date, '2026-11-22');
  assert.equal(sgParts(Date.parse('2026-11-21T16:05:00Z')).slot, '0000');
  assert.equal(p.dayStart, Date.parse('2026-11-20T16:00:00Z'));
});

test('a day summary', () => {
  const s = summarize('2026-11-21', { slots: { '0500': 4, '0515': 6, '1300': 10, '1315': 10, bad: 99 }, seen: 12 });
  assert.equal(s.peak, 10);
  assert.equal(s.peakAt, '1300');
  assert.equal(s.seen, 12);
  assert.equal(s.screenHours, Math.round((30 * 15) / 60));
  assert.equal(s.hours[13], 5);
  assert.equal(s.hours[5], 2.5);
  assert.equal(s.avg, Math.round((30 / 96) * 10) / 10);
});

test('days asked for are kept between 1 and about 3 years', () => {
  assert.equal(parseDays('90'), 90);
  assert.equal(parseDays('0'), 1);
  assert.equal(parseDays('99999'), 3 * 366 + 1);
  assert.equal(parseDays('x'), 90);
});
