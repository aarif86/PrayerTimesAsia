'use strict';
// POST https://asia-southeast1-prayertimes-asia.cloudfunctions.net/submit
// Stores a community submission for review: the record in Firestore
// (submissions/{id}, status "submitted") and any timetable photo in Storage
// (submissions/{id}.jpg|png). Nothing is ever served back to clients.

const crypto = require('node:crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { validate } = require('./validate');

initializeApp();
const db = getFirestore();

const PER_SOURCE_PER_HOUR = 10;
const GLOBAL_PER_DAY = 500;

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32);

/** Counts a submission; false when a limit is hit. */
async function underLimits(sourceHash) {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const src = db.doc(`limits/src-${sourceHash}-${hour}`);
  const all = db.doc(`limits/all-${day}`);
  return db.runTransaction(async (tx) => {
    const [a, b] = await Promise.all([tx.get(src), tx.get(all)]);
    if ((a.data()?.n || 0) >= PER_SOURCE_PER_HOUR || (b.data()?.n || 0) >= GLOBAL_PER_DAY) return false;
    const expires = new Date(now.getTime() + 2 * 86400e3);
    tx.set(src, { n: FieldValue.increment(1), expires }, { merge: true });
    tx.set(all, { n: FieldValue.increment(1), expires }, { merge: true });
    return true;
  });
}

exports.submit = onRequest(
  { region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 30, maxInstances: 3, cors: false },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    let parsed;
    try {
      parsed = validate(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    // Anonymous source: hashed IP + hashed install token, never stored raw.
    const source = hash(`${req.ip}|${req.get('x-install-token') || ''}`);
    if (!(await underLimits(source))) {
      return res.status(429).json({ error: 'Too many submissions - please try again later.' });
    }
    const ref = db.collection('submissions').doc();
    const record = {
      ...parsed.record,
      status: 'submitted',
      licence: 'CC-BY-4.0',
      source,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (parsed.photo) {
      const ext = parsed.record.photoType === 'image/png' ? 'png' : 'jpg';
      const path = `submissions/${ref.id}.${ext}`;
      await getStorage().bucket().file(path).save(parsed.photo, {
        contentType: parsed.record.photoType,
        resumable: false,
        metadata: { metadata: { submission: ref.id } },
      });
      record.photoPath = path;
    }
    await ref.set(record);
    return res.status(201).json({ id: ref.id });
  },
);
