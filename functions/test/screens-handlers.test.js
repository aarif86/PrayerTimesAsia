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
    update: async (d) => { docs.set(path, merge(docs.get(path), d)) },
  });
  const query = (col, filters = []) => ({
    where: (f, op, v) => query(col, [...filters, [f, op, v]]),
    orderBy: () => query(col, filters),
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
    fn({ method, body, query, ip }, res);
  });
}

test('pings, live count, history and limits', async () => {
  const db = fakeDb();
  const h = handlers({ onRequest, db, FieldValue, Timestamp: TS, hash: (s) => 'h' + s });
  assert.equal((await call(h.screenPing)).code, 405);
  assert.equal((await call(h.screenPing, { method: 'POST', body: { id: 'nope' } })).code, 400);
  const ids = Array.from({ length: 3 }, (_, i) => `screen-id-0000000000000000${i}`)
  for (const id of ids) assert.equal((await call(h.screenPing, { method: 'POST', body: JSON.stringify({ id }) })).code, 200);
  // Same screen again: still three.
  assert.equal((await call(h.screenPing, { method: 'POST', body: { id: ids[0] } })).code, 200);
  // The count is kept for a minute per server; a fresh server sees all three.
  const fresh = handlers({ onRequest, db, FieldValue, Timestamp: TS, hash: (s) => 'h' + s });
  assert.deepEqual((await call(fresh.screenCount)).body, { running: 3 });
  const stats = (await call(fresh.screenStats, { query: { days: '7' } })).body;
  assert.equal(stats.running, 3);
  assert.equal(stats.days.length, 1);
  assert.ok(stats.days[0].peak >= 1 && stats.days[0].seen >= 1);
  // One network cannot add more than 12 new screens a day.
  let last
  for (let i = 0; i < 13; i++) last = await call(h.screenPing, { method: 'POST', body: { id: `flood-id-00000000000000000${String(i).padStart(2, '0')}` }, ip: '9.9.9.9' });
  assert.equal(last.code, 429);
  // Nothing personal stored: screens hold only times.
  for (const [p, d] of db.docs) if (p.startsWith('screens/')) assert.deepEqual(Object.keys(d).sort(), ['firstSeen', 'lastSeen']);
});
