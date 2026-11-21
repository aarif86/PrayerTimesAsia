'use strict';
// Masjid screens that are on right now, and their history, with no personal data.
//
// POST /screenPing   {"id":"<random 22-40 letters made on the TV>", "cc":"SG", "look":"night", "lang":"en"}   every 15 minutes
// GET  /screenCount  -> {"running": 24}                              the setup page's "on right now" line
// GET  /screenStats?days=90 -> daily history for the dashboard
//
// Stored: screens/{id} {firstSeen, lastSeen, cc, look, lang} and screenDays/{YYYY-MM-DD}
// {slots: {"HHMM": n}, seen, mix: {"HH": {cc: {SG: n}, look: {...}, lang: {...}}}} (Singapore time).
// Country only (never the city), no IP address, no masjid name. Brand-new IDs are limited per
// hashed network per day, so one person cannot inflate the count.

const SLOT_MIN = 15;                       // one history point every 15 minutes
const LIVE_WINDOW_MS = 31 * 60_000;        // "on right now" = checked in within the last 31 minutes (one missed ping allowed)
const NEW_IDS_PER_NETWORK_PER_DAY = 12;
const NEW_IDS_PER_DAY = 300;              // all networks together, in case a network address is faked
const TZ_OFFSET_MS = 8 * 3_600_000;        // Singapore time, no daylight saving
/** The ranges the dashboard offers; anything else is rounded up to one of them, so the cache works. */
const RANGES = [7, 30, 92, 183, 274, 366, 731, 1097];

const ID_RE = /^[A-Za-z0-9_-]{22,40}$/;
const LOOKS = ['night', 'day', 'board', 'bands', 'dial', 'sunpath', 'simple'];
const LANGS = ['en', 'ms', 'id'];

/** The country, look and language a screen sent, each only if it is one we know; anything else is left out. */
function screenFacts(body) {
  const out = {};
  if (body && typeof body.cc === 'string' && /^[A-Z]{2}$/.test(body.cc)) out.cc = body.cc;
  if (body && LOOKS.includes(body.look)) out.look = body.look;
  if (body && LANGS.includes(body.lang)) out.lang = body.lang;
  return out;
}

/** Live screens -> how many in each country, look and language. */
function tally(rows) {
  const mix = { cc: {}, look: {}, lang: {} };
  for (const r of rows) for (const k of ['cc', 'look', 'lang']) { const v = r[k] || '?'; mix[k][v] = (mix[k][v] || 0) + 1; }
  return mix;
}
const validId = (id) => typeof id === 'string' && ID_RE.test(id);

/** Singapore date "YYYY-MM-DD" and the 15-minute slot "HHMM" for a time. */
function sgParts(ms) {
  const d = new Date(ms + TZ_OFFSET_MS);
  const date = d.toISOString().slice(0, 10);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const slot = Math.floor(mins / SLOT_MIN) * SLOT_MIN;
  const hhmm = String(Math.floor(slot / 60)).padStart(2, '0') + String(slot % 60).padStart(2, '0');
  return { date, slot: hhmm, dayStart: Date.parse(date + 'T00:00:00Z') - TZ_OFFSET_MS };
}

/** One day's record -> the numbers the dashboard shows. */
function summarize(date, data) {
  const slots = (data && data.slots) || {};
  const keys = Object.keys(slots).filter((k) => /^\d{4}$/.test(k)).sort();
  let peak = 0, peakAt = null, sum = 0;
  const hours = new Array(24).fill(0);
  for (const k of keys) {
    const n = Number(slots[k]) || 0;
    sum += n;
    if (n > peak) { peak = n; peakAt = k; }
    hours[Number(k.slice(0, 2))] += n;
  }
  // Slots with no record had no screens on (nobody pinged), so the day always has 96 slots.
  const perDay = (24 * 60) / SLOT_MIN;
  return {
    date,
    peak, peakAt,
    avg: Math.round((sum / perDay) * 10) / 10,
    seen: Number(data && data.seen) || 0,
    screenHours: Math.round((sum * SLOT_MIN) / 60),
    hours: hours.map((h) => Math.round((h / (60 / SLOT_MIN)) * 10) / 10),
    mix: dayMix(data && data.mix),
  };
}

/** The day's hourly counts by country, look and language -> the average and highest across the day. */
function dayMix(mix) {
  const out = { cc: {}, look: {}, lang: {} };
  const hours = Object.values(mix || {});
  for (const k of ['cc', 'look', 'lang']) {
    for (const h of hours) for (const [v, n] of Object.entries((h && h[k]) || {})) {
      const o = out[k][v] || (out[k][v] = { sum: 0, peak: 0 });
      o.sum += Number(n) || 0;
      o.peak = Math.max(o.peak, Number(n) || 0);
    }
    for (const v of Object.keys(out[k])) out[k][v] = { avg: Math.round((out[k][v].sum / 24) * 10) / 10, peak: out[k][v].peak };
  }
  return out;
}

function parseDays(q) {
  const n = parseInt(String(q || '92'), 10);
  if (!Number.isFinite(n)) return 92;
  return RANGES.find((r) => r >= n) || RANGES[RANGES.length - 1];
}

/** The caller's address as the Google front end saw it (the last forwarded entry), not the first, which a caller can write. */
function callerAddress(req) {
  const fwd = String((req.get && req.get('x-forwarded-for')) || '').split(',').map((s) => s.trim()).filter(Boolean);
  return fwd.length ? fwd[fwd.length - 1] : String(req.ip || '');
}

// Short screen links: POST /screenLinkSave {"c":"<the settings, base64url>"} -> {"code":"k3x9Qm2aB"},
// GET /screenLink?code=k3x9Qm2aB -> {"c":"..."}. The settings are stored under the short code, so the link
// on the TV is prayertimes.asia/app/screen/#k=k3x9Qm2aB. The same settings always give the same code.
const LINK_CODE_RE = /^[A-Za-z0-9]{9}$/;
const LINK_MAX_CHARS = 6000;
const LINKS_PER_NETWORK_PER_DAY = 40;
const LINKS_PER_DAY = 3000;
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Is this a masjid screen settings string (base64url JSON of an object with v: 1)? Anything else is refused, so the store only holds settings. */
function validLinkConfig(c) {
  if (typeof c !== 'string' || c.length < 8 || c.length > LINK_MAX_CHARS || !/^[A-Za-z0-9_-]+$/.test(c)) return false;
  try {
    const j = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    return !!j && typeof j === 'object' && !Array.isArray(j) && j.v === 1;
  } catch { return false; }
}

/** A 9 letter and number code from the settings; `salt` makes another one in the rare case two settings share a code. */
function linkCode(c, salt, createHash) {
  const bytes = createHash('sha256').update(`${salt}|${c}`).digest();
  let out = '';
  for (let i = 0; i < 9; i++) out += B62[bytes[i] % 62];
  return out;
}

// Pairing a TV (like signing in to a TV app, with no account):
// POST /screenPairStart            TV -> {"code":"K7M3QX","tvKey":"...","rev":0}   the TV shows the code
// POST /screenPairClaim {code, c}  phone -> {"editKey":"..."}                    the committee's settings, for that code
// GET  /screenPairSync?code=&key=&rev=  TV -> {"rev":n} or {"rev":n,"c":"..."}    when the settings are newer than rev
// POST /screenPairUpdate {code, editKey, c}  phone -> {"rev":n}                  later changes, no new link
// The TV holds `tvKey` and the phone holds `editKey`; only a hash of the phone's key is stored. An unclaimed code lasts 15 minutes.
const PAIR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0 O 1 I L
const PAIR_RE = /^[A-Z2-9]{6}$/;
const PAIR_KEY_RE = /^[A-Za-z0-9_-]{24,48}$/;
const PAIR_WAIT_MS = 15 * 60_000;
const PAIR_STARTS_PER_NETWORK_PER_DAY = 30;
const PAIR_STARTS_PER_DAY = 3000;
const PAIR_TRIES_PER_NETWORK_PER_DAY = 60;   // claims, updates, wrong codes included
const PAIR_TRIES_PER_DAY = 20000;

/** What a person typed, tidied: capitals, no spaces or dashes. */
const tidyPairCode = (v) => String(v || '').toUpperCase().replace(/[\s-]/g, '');

module.exports = { PAIR_ALPHABET, PAIR_RE, PAIR_WAIT_MS, tidyPairCode, LINK_CODE_RE, validLinkConfig, linkCode, SLOT_MIN, LIVE_WINDOW_MS, NEW_IDS_PER_NETWORK_PER_DAY, NEW_IDS_PER_DAY, RANGES, validId, screenFacts, tally, dayMix, sgParts, summarize, parseDays, callerAddress };

/** The HTTPS functions; index.js passes in what it already has. */
module.exports.handlers = function handlers({ onRequest, db, FieldValue, Timestamp, hash }) {
  const CORS = [/^https:\/\/prayertimes\.asia$/, /^https:\/\/aarif86\.github\.io$/, /^http:\/\/localhost(:\d+)?$/];
  const opts = { region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 20, maxInstances: 5, cors: CORS };

  let cachedCount = null; // { n, at }
  async function liveCount(now) {
    if (cachedCount && now - cachedCount.at < 60_000) return cachedCount.n;
    const snap = await db.collection('screens').where('lastSeen', '>', Timestamp.fromMillis(now - LIVE_WINDOW_MS)).count().get();
    cachedCount = { n: snap.data().count, at: now };
    return cachedCount.n;
  }

  // Writes the 15-minute history point at most once per slot per server instance.
  let lastSlot = '';
  async function recordSlot(now) {
    const { date, slot, dayStart } = sgParts(now);
    const key = date + slot;
    if (key === lastSlot) return;
    lastSlot = key;
    cachedCount = null;
    const [live, seen] = await Promise.all([
      liveCount(now),
      db.collection('screens').where('lastSeen', '>=', Timestamp.fromMillis(dayStart)).count().get().then((s) => s.data().count),
    ]);
    const ref = db.doc(`screenDays/${date}`);
    await ref.set({ date, slots: { [slot]: live }, seen }, { merge: true });
    // Once an hour: how many live screens in each country, look and language (replacing that hour whole).
    if (slot.endsWith('00')) {
      const rows = await db.collection('screens').where('lastSeen', '>', Timestamp.fromMillis(now - LIVE_WINDOW_MS)).select('cc', 'look', 'lang').get();
      const list = [];
      rows.forEach((d) => list.push(d.data()));
      await ref.update({ [`mix.${slot.slice(0, 2)}`]: tally(list) });
    }
  }

  const screenPing = onRequest(opts, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const id = body && body.id;
    if (!validId(id)) return res.status(400).json({ error: 'bad id' });
    const now = Date.now();
    const ref = db.doc(`screens/${id}`);
    const doc = await ref.get();
    if (!doc.exists) {
      // A new screen: limit how many new ones one network can add in a day.
      const day = sgParts(now).date;
      const lim = db.doc(`limits/scr-${hash(`screens|${day}|${callerAddress(req)}`)}`);
      const all = db.doc(`limits/scr-all-${day}`);
      const ok = await db.runTransaction(async (tx) => {
        const [l, a] = await Promise.all([tx.get(lim), tx.get(all)]);
        if ((l.data()?.n || 0) >= NEW_IDS_PER_NETWORK_PER_DAY || (a.data()?.n || 0) >= NEW_IDS_PER_DAY) return false;
        const expires = new Date(now + 2 * 86400e3);
        tx.set(lim, { n: FieldValue.increment(1), expires }, { merge: true });
        tx.set(all, { n: FieldValue.increment(1), expires }, { merge: true });
        return true;
      });
      if (!ok) return res.status(429).json({ error: 'too many new screens today' });
      await ref.set({ firstSeen: Timestamp.fromMillis(now), lastSeen: Timestamp.fromMillis(now), ...screenFacts(body) });
    } else {
      await ref.update({ lastSeen: Timestamp.fromMillis(now), ...screenFacts(body) });
    }
    await recordSlot(now).catch(() => undefined);
    // The server time, so the TV can tell when its own clock is wrong.
    return res.status(200).json({ now: Date.now() });
  });

  const screenCount = onRequest(opts, async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const running = await liveCount(Date.now());
    res.set('Cache-Control', 'no-store');
    // The server time too, so a screen that is not counted can still check the TV clock.
    return res.json({ running, now: Date.now() });
  });

  const statsCache = new Map(); // days -> { body, at }
  const screenStats = onRequest(opts, async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const days = parseDays(req.query.days);
    const now = Date.now();
    const hit = statsCache.get(days);
    if (hit && now - hit.at < 5 * 60_000) return res.json(hit.body);
    const from = sgParts(now - (days - 1) * 86400e3).date;
    const snap = await db.collection('screenDays').where('date', '>=', from).orderBy('date').get();
    const out = [];
    const recent = [];
    const recentFrom = sgParts(now - 2 * 86400e3).date;
    snap.forEach((d) => {
      const data = d.data();
      out.push(summarize(data.date, data));
      if (data.date >= recentFrom) for (const [k, n] of Object.entries(data.slots || {})) recent.push([data.date, k, n]);
    });
    const body = { generatedAt: new Date(now).toISOString(), running: await liveCount(now), slotMinutes: SLOT_MIN, days: out, recent: recent.sort() };
    statsCache.set(days, { body, at: now });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(body);
  });

  const crypto = require('node:crypto');
  const screenLinkSave = onRequest(opts, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const c = body && body.c;
    if (!validLinkConfig(c)) return res.status(400).json({ error: 'bad settings' });
    const now = Date.now();
    // Settings already saved give the same code back and cost nothing.
    for (let salt = 0; salt < 5; salt++) {
      const code = linkCode(c, salt, crypto.createHash);
      const ref = db.doc(`screenLinks/${code}`);
      const doc = await ref.get();
      if (doc.exists) {
        if (doc.data().c === c) return res.status(200).json({ code });
        continue;
      }
      const day = sgParts(now).date;
      const lim = db.doc(`limits/lnk-${hash(`links|${day}|${callerAddress(req)}`)}`);
      const all = db.doc(`limits/lnk-all-${day}`);
      const ok = await db.runTransaction(async (tx) => {
        const [l, a] = await Promise.all([tx.get(lim), tx.get(all)]);
        if ((l.data()?.n || 0) >= LINKS_PER_NETWORK_PER_DAY || (a.data()?.n || 0) >= LINKS_PER_DAY) return false;
        const expires = new Date(now + 2 * 86400e3);
        tx.set(lim, { n: FieldValue.increment(1), expires }, { merge: true });
        tx.set(all, { n: FieldValue.increment(1), expires }, { merge: true });
        return true;
      });
      if (!ok) return res.status(429).json({ error: 'too many new links today' });
      await ref.set({ c, created: Timestamp.fromMillis(now) });
      return res.status(200).json({ code });
    }
    return res.status(500).json({ error: 'try again' });
  });

  const screenLink = onRequest(opts, async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const code = req.query.code;
    if (typeof code !== 'string' || !LINK_CODE_RE.test(code)) return res.status(400).json({ error: 'bad code' });
    const doc = await db.doc(`screenLinks/${code}`).get();
    if (!doc.exists) return res.status(404).json({ error: 'no such link' });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ c: doc.data().c });
  });

  const randomKey = () => crypto.randomBytes(18).toString('base64url');
  const sha = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
  const sameKey = (key, storedHash) => {
    if (typeof key !== 'string' || !PAIR_KEY_RE.test(key) || typeof storedHash !== 'string') return false;
    const a = Buffer.from(sha(key)), b = Buffer.from(storedHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const bodyOf = (req) => {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    return body && typeof body === 'object' ? body : {};
  };
  /** Counts one pairing call for this network, and says whether it is still within the daily limits. */
  async function withinLimit(prefix, req, now, perNetwork, all) {
    const day = sgParts(now).date;
    const lim = db.doc(`limits/${prefix}-${hash(`${prefix}|${day}|${callerAddress(req)}`)}`);
    const tot = db.doc(`limits/${prefix}-all-${day}`);
    return db.runTransaction(async (tx) => {
      const [l, a] = await Promise.all([tx.get(lim), tx.get(tot)]);
      if ((l.data()?.n || 0) >= perNetwork || (a.data()?.n || 0) >= all) return false;
      const expires = new Date(now + 2 * 86400e3);
      tx.set(lim, { n: FieldValue.increment(1), expires }, { merge: true });
      tx.set(tot, { n: FieldValue.increment(1), expires }, { merge: true });
      return true;
    });
  }

  const screenPairStart = onRequest(opts, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const now = Date.now();
    if (!(await withinLimit('pst', req, now, PAIR_STARTS_PER_NETWORK_PER_DAY, PAIR_STARTS_PER_DAY))) return res.status(429).json({ error: 'too many codes today' });
    for (let i = 0; i < 8; i++) {
      const bytes = crypto.randomBytes(6);
      let code = '';
      for (let j = 0; j < 6; j++) code += PAIR_ALPHABET[bytes[j] % PAIR_ALPHABET.length];
      const ref = db.doc(`screenPairs/${code}`);
      const doc = await ref.get();
      // A code is free when nobody has it, or when it was never claimed and has run out.
      if (doc.exists && !(doc.data().c == null && now - doc.data().created.toMillis() > PAIR_WAIT_MS)) continue;
      const tvKey = randomKey();
      await ref.set({ tvHash: sha(tvKey), c: null, rev: 0, created: Timestamp.fromMillis(now) });
      return res.status(200).json({ code, tvKey, rev: 0, validMinutes: PAIR_WAIT_MS / 60_000 });
    }
    return res.status(500).json({ error: 'try again' });
  });

  const screenPairClaim = onRequest(opts, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const body = bodyOf(req);
    const code = tidyPairCode(body.code);
    if (!PAIR_RE.test(code) || !validLinkConfig(body.c)) return res.status(400).json({ error: 'bad code or settings' });
    const now = Date.now();
    if (!(await withinLimit('pcl', req, now, PAIR_TRIES_PER_NETWORK_PER_DAY, PAIR_TRIES_PER_DAY))) return res.status(429).json({ error: 'too many tries today' });
    const ref = db.doc(`screenPairs/${code}`);
    const doc = await ref.get();
    const d = doc.exists ? doc.data() : null;
    if (!d || d.c != null || now - d.created.toMillis() > PAIR_WAIT_MS) return res.status(404).json({ error: 'no such code, or it ran out' });
    const editKey = randomKey();
    await ref.update({ c: body.c, rev: 1, editHash: sha(editKey), claimed: Timestamp.fromMillis(now) });
    return res.status(200).json({ editKey, rev: 1 });
  });

  const screenPairSync = onRequest(opts, async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const code = tidyPairCode(req.query.code);
    const rev = Number(req.query.rev) || 0;
    if (!PAIR_RE.test(code)) return res.status(400).json({ error: 'bad code' });
    const doc = await db.doc(`screenPairs/${code}`).get();
    const d = doc.exists ? doc.data() : null;
    if (!d || !sameKey(req.query.key, d.tvHash)) return res.status(404).json({ error: 'not paired' });
    res.set('Cache-Control', 'no-store');
    if (d.c != null && d.rev > rev) return res.json({ rev: d.rev, c: d.c });
    if (d.c == null && Date.now() - d.created.toMillis() > PAIR_WAIT_MS) return res.status(410).json({ error: 'code ran out' });
    return res.json({ rev: d.rev });
  });

  const screenPairUpdate = onRequest(opts, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const body = bodyOf(req);
    const code = tidyPairCode(body.code);
    if (!PAIR_RE.test(code) || !validLinkConfig(body.c)) return res.status(400).json({ error: 'bad code or settings' });
    const now = Date.now();
    if (!(await withinLimit('pcl', req, now, PAIR_TRIES_PER_NETWORK_PER_DAY, PAIR_TRIES_PER_DAY))) return res.status(429).json({ error: 'too many tries today' });
    const ref = db.doc(`screenPairs/${code}`);
    const doc = await ref.get();
    const d = doc.exists ? doc.data() : null;
    if (!d || d.c == null || !sameKey(body.editKey, d.editHash)) return res.status(403).json({ error: 'not allowed' });
    const rev = (d.rev || 1) + 1;
    await ref.update({ c: body.c, rev });
    return res.status(200).json({ rev });
  });

  return { screenPing, screenCount, screenStats, screenLinkSave, screenLink, screenPairStart, screenPairClaim, screenPairSync, screenPairUpdate };
};
