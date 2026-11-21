'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validId, sgParts, summarize, parseDays, callerAddress } = require('../screens');

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

test('days asked for snap to the dashboard ranges', () => {
  assert.equal(parseDays('92'), 92);
  assert.equal(parseDays('90'), 92);
  assert.equal(parseDays('0'), 7);
  assert.equal(parseDays('99999'), 1097);
  assert.equal(parseDays('x'), 92);
});

test('the caller address is the last forwarded entry, which the caller cannot write', () => {
  const req = (xff, ip) => ({ ip, get: (h) => (h === 'x-forwarded-for' ? xff : undefined) });
  assert.equal(callerAddress(req('6.6.6.6, 1.2.3.4', '6.6.6.6')), '1.2.3.4');
  assert.equal(callerAddress(req('', '1.2.3.4')), '1.2.3.4');
});
