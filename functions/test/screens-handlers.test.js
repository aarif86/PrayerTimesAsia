'use strict';
// The three screen functions against a small in-memory stand-in for Firestore.
const test = require('node:test');
const assert = require('node:assert');
const { handlers } = require('../screens');

class TS { constructor(ms) { this.ms = ms } static fromMillis(ms) { return new TS(ms) } toMillis() { return this.ms } }
const val = (v) => (v instanceof TS ? v.ms : v instanceof Date ? v.getTime() : v);
function fakeDb() {
  const docs = new Map();
  const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !(v instanceof TS) && !(v instanceof Date) && !v.__inc ? merge(o[k] || {}, v) : v && v.__inc ? (o[k] || 0) + v.__inc : v; return o };
  const ref = (path) => ({
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (d, o) => { docs.set(path, o && o.merge ? merge(docs.get(path) || {}, d) : merge({}, d)) },
    update: async (d) => {
      const cur = { ...docs.get(path) }
      for (const [k, v] of Object.entries(d)) {
        if (!k.includes('.')) { cur[k] = v && v.__inc ? (cur[k] || 0) + v.__inc : v; continue }
        const [a, b] = k.split('.'); cur[a] = { ...(cur[a] || {}), [b]: v }
      }
      docs.set(path, cur)
    },
  });
  const query = (col, filters = []) => ({
    where: (f, op, v) => query(col, [...filters, [f, op, v]]),
    orderBy: () => query(col, filters),
    select: () => query(col, filters),
    _rows: () => [...docs].filter(([p]) => p.startsWith(col + '/') && p.split('/').length === 2)
      .filter(([, d]) => filters.every(([f, op, v]) => { const a = val(d[f]), b = val(v); return op === '>' ? a > b : op === '>=' ? a >= b : a === b }))
      .sort((x, y) => (x[1].date > y[1].date ? 1 : -1)),
    count: () => ({ get: async () => ({ data: () => ({ count: query(col, filters)._rows().length }) }) }),
    get: async () => ({ forEach: (fn) => query(col, filters)._rows().forEach(([, d]) => fn({ data: () => d })) }),
  });
  return {
    docs,
    doc: ref,
    collection: (c) => query(c),
    runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }),
  };
}
const FieldValue = { increment: (n) => ({ __inc: n }) };
const onRequest = (_opts, fn) => fn;
function call(fn, { method = 'GET', body, query = {}, ip = '1.2.3.4' } = {}) {
  return new Promise((resolve) => {
    const res = { code: 200, headers: {}, status(c) { this.code = c; return this }, set(k, v) { this.headers[k] = v; return this },
      json(b) { resolve({ code: this.code, body: b }) }, end() { resolve({ code: this.code }) } };
    fn({ method, body, query, ip, get: () => undefined }, res);
  });
}

test('pings, live count, history and limits', async () => {
  const db = fakeDb();
  const h = handlers({ onRequest, db, FieldValue, Timestamp: TS, hash: (s) => 'h' + s });
  assert.equal((await call(h.screenPing)).code, 405);
  assert.equal((await call(h.screenPing, { method: 'POST', body: { id: 'nope' } })).code, 400);
  const ids = Array.from({ length: 3 }, (_, i) => `screen-id-0000000000000000${i}`)
  for (const id of ids) assert.equal((await call(h.screenPing, { method: 'POST', body: JSON.stringify({ id, cc: 'SG', look: 'night', lang: 'en', city: 'Pasir Ris' }) })).code, 200);
  // Same screen again: still three.
  assert.equal((await call(h.screenPing, { method: 'POST', body: { id: ids[0] } })).code, 200);
  // The count is kept for a minute per server; a fresh server sees all three.
  const fresh = handlers({ onRequest, db, FieldValue, Timestamp: TS, hash: (s) => 'h' + s });
  assert.equal((await call(fresh.screenCount)).body.running, 3);
  const stats = (await call(fresh.screenStats, { query: { days: '7' } })).body;
  assert.equal(typeof (await call(fresh.screenCount)).body.now, 'number');
  assert.equal(stats.running, 3);
  assert.equal(stats.days.length, 1);
  assert.ok(stats.days[0].peak >= 1 && stats.days[0].seen >= 1);
  // One network cannot add more than 12 new screens a day.
  let last
  for (let i = 0; i < 13; i++) last = await call(h.screenPing, { method: 'POST', body: { id: `flood-id-00000000000000000${String(i).padStart(2, '0')}` }, ip: '9.9.9.9' });
  assert.equal(last.code, 429);
  // The day summary carries the country mix when the first ping fell in an hour's first slot.
  assert.ok(stats.days[0].mix && typeof stats.days[0].mix.cc === 'object');
  // Nothing personal stored: screens hold only times.
  for (const [p, d] of db.docs) if (p.startsWith('screens/')) for (const k of Object.keys(d)) assert.ok(['firstSeen', 'lastSeen', 'cc', 'look', 'lang'].includes(k), k);
});

test('short screen links: save, same settings same code, fetch, refuse junk', async () => {
  const db = fakeDb();
  const h = handlers({ onRequest, db, FieldValue, Timestamp: TS, hash: (s) => 'h' + s });
  const c = Buffer.from(JSON.stringify({ v: 1, name: 'Masjid Test', look: 'bands' })).toString('base64url');
  const a = await call(h.screenLinkSave, { method: 'POST', body: JSON.stringify({ c }) });
  assert.equal(a.code, 200);
  assert.match(a.body.code, /^[A-Za-z0-9]{9}$/);
  const b = await call(h.screenLinkSave, { method: 'POST', body: { c } });
  assert.equal(b.body.code, a.body.code);
  const got = await call(h.screenLink, { query: { code: a.body.code } });
  assert.equal(got.body.c, c);
  assert.equal((await call(h.screenLink, { query: { code: 'abcdefghi' } })).code, 404);
  assert.equal((await call(h.screenLink, { query: { code: 'x' } })).code, 400);
  assert.equal((await call(h.screenLinkSave, { method: 'POST', body: { c: 'not-settings' } })).code, 400);
  const notV1 = Buffer.from(JSON.stringify({ hello: 1 })).toString('base64url');
  assert.equal((await call(h.screenLinkSave, { method: 'POST', body: { c: notV1 } })).code, 400);
  assert.equal((await call(h.screenLinkSave, { method: 'GET' })).code, 405);
});

test('pairing a TV: code, claim, sync, update, wrong keys, run out', async () => {
  const db = fakeDb();
  const h = handlers({ onRequest, db, FieldValue, Timestamp: TS, hash: (s) => 'h' + s });
  const c1 = Buffer.from(JSON.stringify({ v: 1, name: 'One' })).toString('base64url');
  const c2 = Buffer.from(JSON.stringify({ v: 1, name: 'Two' })).toString('base64url');
  const start = await call(h.screenPairStart, { method: 'POST' });
  assert.equal(start.code, 200);
  const { code, tvKey } = start.body;
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  // Waiting: nothing yet.
  assert.deepEqual((await call(h.screenPairSync, { query: { code, key: tvKey, rev: '0' } })).body, { rev: 0 });
  // A wrong TV key is told nothing.
  assert.equal((await call(h.screenPairSync, { query: { code, key: 'x'.repeat(30), rev: '0' } })).code, 404);
  // The phone types the code in lower case with a space; it still works.
  const claim = await call(h.screenPairClaim, { method: 'POST', body: JSON.stringify({ code: code.toLowerCase().slice(0, 3) + ' ' + code.slice(3).toLowerCase(), c: c1 }) });
  assert.equal(claim.code, 200);
  const { editKey } = claim.body;
  // Claimed once only.
  assert.equal((await call(h.screenPairClaim, { method: 'POST', body: { code, c: c2 } })).code, 404);
  // The TV now gets the settings, then nothing new.
  const got = await call(h.screenPairSync, { query: { code, key: tvKey, rev: '0' } });
  assert.equal(got.body.c, c1);
  assert.deepEqual((await call(h.screenPairSync, { query: { code, key: tvKey, rev: String(got.body.rev) } })).body, { rev: 1 });
  // Updates need the phone's key.
  assert.equal((await call(h.screenPairUpdate, { method: 'POST', body: { code, editKey: 'y'.repeat(30), c: c2 } })).code, 403);
  assert.equal((await call(h.screenPairUpdate, { method: 'POST', body: { code, editKey: tvKey, c: c2 } })).code, 403);
  assert.equal((await call(h.screenPairUpdate, { method: 'POST', body: { code, editKey, c: c2 } })).body.rev, 2);
  assert.equal((await call(h.screenPairSync, { query: { code, key: tvKey, rev: '1' } })).body.c, c2);
  // Junk is refused.
  assert.equal((await call(h.screenPairClaim, { method: 'POST', body: { code: 'nope', c: c1 } })).code, 400);
  assert.equal((await call(h.screenPairClaim, { method: 'POST', body: { code: 'ABCDEF', c: 'not-settings' } })).code, 400);
  // An unclaimed code runs out after 15 minutes.
  const s2 = await call(h.screenPairStart, { method: 'POST' });
  const id2 = s2.body.code;
  const d = db.docs.get(`screenPairs/${id2}`);
  d.created = TS.fromMillis(Date.now() - 16 * 60_000);
  assert.equal((await call(h.screenPairClaim, { method: 'POST', body: { code: id2, c: c1 } })).code, 404);
  assert.equal((await call(h.screenPairSync, { query: { code: id2, key: s2.body.tvKey, rev: '0' } })).code, 410);
});
