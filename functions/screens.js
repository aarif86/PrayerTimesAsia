'use strict';
// Masjid screens that are on right now, and their history, with no personal data.
//
// POST /screenPing   {"id":"<random 22-40 letters made on the TV>"}   every 15 minutes from each TV
// GET  /screenCount  -> {"running": 24}                              the setup page's "on right now" line
// GET  /screenStats?days=90 -> daily history for the dashboard
//
// Stored: screens/{id} {firstSeen, lastSeen} and screenDays/{YYYY-MM-DD} {slots: {"HHMM": n}, seen}
// (Singapore time). No IP address, no masjid name, no place. Brand-new IDs are limited per
// hashed network per day, so one person cannot inflate the count.

const SLOT_MIN = 15;                       // one history point every 15 minutes
const LIVE_WINDOW_MS = 31 * 60_000;        // "on right now" = checked in within the last 31 minutes (one missed ping allowed)
const NEW_IDS_PER_NETWORK_PER_DAY = 12;
const TZ_OFFSET_MS = 8 * 3_600_000;        // Singapore time, no daylight saving
const MAX_DAYS = 3 * 366 + 1;

const ID_RE = /^[A-Za-z0-9_-]{22,40}$/;
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
  };
}

function parseDays(q) {
  const n = parseInt(String(q || '90'), 10);
  return Number.isFinite(n) ? Math.min(MAX_DAYS, Math.max(1, n)) : 90;
}

module.exports = { SLOT_MIN, LIVE_WINDOW_MS, NEW_IDS_PER_NETWORK_PER_DAY, validId, sgParts, summarize, parseDays };

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
    await db.doc(`screenDays/${date}`).set({ date, slots: { [slot]: live }, seen }, { merge: true });
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
      const lim = db.doc(`limits/scr-${hash(`screens|${day}|${req.ip}`)}`);
      const ok = await db.runTransaction(async (tx) => {
        const l = await tx.get(lim);
        if ((l.data()?.n || 0) >= NEW_IDS_PER_NETWORK_PER_DAY) return false;
        tx.set(lim, { n: FieldValue.increment(1), expires: new Date(now + 2 * 86400e3) }, { merge: true });
        return true;
      });
      if (!ok) return res.status(429).json({ error: 'too many new screens today' });
      await ref.set({ firstSeen: Timestamp.fromMillis(now), lastSeen: Timestamp.fromMillis(now) });
    } else {
      await ref.update({ lastSeen: Timestamp.fromMillis(now) });
    }
    await recordSlot(now).catch(() => undefined);
    // The server time, so the TV can tell when its own clock is wrong.
    return res.status(200).json({ now: Date.now() });
  });

  const screenCount = onRequest(opts, async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const running = await liveCount(Date.now());
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ running });
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

  return { screenPing, screenCount, screenStats };
};
