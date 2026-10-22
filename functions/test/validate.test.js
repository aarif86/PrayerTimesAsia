'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validate } = require('../validate');

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2000, 1)]).toString('base64');

test('accepts a timetable with a JPEG photo', () => {
  const { record, photo } = validate({ type: 'timetable', consent: true, place: 'District 1, HCMC, Vietnam',
    countryCode: 'VN', mosque: 'Jamiul Islamiyah', photo: jpeg });
  assert.equal(record.mosque, 'Jamiul Islamiyah');
  assert.equal(record.photoType, 'image/jpeg');
  assert.ok(photo.length > 1000);
});

test('rejects without consent, photo, or with a non-image', () => {
  assert.throws(() => validate({ type: 'timetable', place: 'x', mosque: 'y', photo: jpeg }), /CC-BY/);
  assert.throws(() => validate({ type: 'timetable', consent: true, place: 'x', mosque: 'y' }), /photo/);
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(2000)]).toString('base64');
  assert.throws(() => validate({ type: 'timetable', consent: true, place: 'x', mosque: 'y', photo: gif }), /JPEG or PNG/);
});

test('method and spot check', () => {
  assert.equal(validate({ type: 'method', consent: true, place: 'Hanoi', method: 'MWL', how: 'board at the masjid' })
    .record.method, 'MWL');
  assert.throws(() => validate({ type: 'method', consent: true, place: 'Hanoi', method: 'Made up', how: 'x' }), /method/);
  assert.equal(validate({ type: 'spotcheck', consent: true, place: 'Tokyo', mosque: 'Tokyo Camii',
    prayer: 'maghrib', heardAt: '2026-10-22T17:12:00+09:00' }).record.prayer, 'maghrib');
  assert.throws(() => validate({ type: 'spotcheck', consent: true, place: 'Tokyo', mosque: 'x', prayer: 'maghrib',
    heardAt: 'yesterday-ish' }), /adhan/);
});

test('never accepts coordinates or unknown fields', () => {
  const { record } = validate({ type: 'method', consent: true, place: 'Hanoi', method: 'MWL', how: 'x',
    lat: 21.03, lng: 105.85, email: 'a@b.c' });
  assert.equal(record.lat, undefined);
  assert.equal(record.email, undefined);
});

test('length limits', () => {
  assert.throws(() => validate({ type: 'method', consent: true, place: 'x'.repeat(201), method: 'MWL', how: 'x' }), /too long/);
});
