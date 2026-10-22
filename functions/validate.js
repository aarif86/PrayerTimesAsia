'use strict';
// Validation for community submissions. Kept free of Firebase so it can be
// unit-tested with plain `node --test`.

const TYPES = ['timetable', 'method', 'spotcheck'];
const METHODS = ['MUIS', 'JAKIM', 'Kemenag', 'MWL', 'Karachi', 'UmmAlQura', 'Diyanet', 'Other'];
const ASR = ['shafii', 'hanafi', 'unsure'];
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function text(v, max) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new Error('bad field');
  const t = v.trim().replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  if (t.length > max) throw new Error(`field too long (max ${max})`);
  return t || null;
}

/**
 * Returns a clean submission record, or throws Error with a user-facing message.
 * Coordinates are never accepted: only what the contributor typed or picked.
 */
function validate(body) {
  if (!body || typeof body !== 'object') throw new Error('empty submission');
  if (body.consent !== true) throw new Error('please agree to share under CC-BY 4.0');
  const type = body.type;
  if (!TYPES.includes(type)) throw new Error('unknown submission type');

  const out = {
    type,
    place: text(body.place, 200),
    countryCode: text(body.countryCode, 2),
    appMethod: text(body.appMethod, 200),
    appVersion: text(body.appVersion, 40),
    note: text(body.note, 1000),
  };
  if (!out.place) throw new Error('where is this?');
  if (out.countryCode && !/^[A-Za-z]{2}$/.test(out.countryCode)) throw new Error('bad country');

  if (type === 'timetable') {
    out.mosque = text(body.mosque, 200);
    out.mapsLink = text(body.mapsLink, 500);
    out.jamaah = text(body.jamaah, 1000);
    if (!out.mosque) throw new Error('which mosque?');
    if (typeof body.photo !== 'string' || !body.photo) throw new Error('please add a photo of the timetable');
    const photo = Buffer.from(body.photo, 'base64');
    if (photo.length < 1000) throw new Error('photo is empty');
    if (photo.length > MAX_PHOTO_BYTES) throw new Error('photo too large (max 3 MB)');
    // JPEG or PNG magic numbers only.
    const isJpeg = photo[0] === 0xff && photo[1] === 0xd8;
    const isPng = photo[0] === 0x89 && photo[1] === 0x50;
    if (!isJpeg && !isPng) throw new Error('photo must be JPEG or PNG');
    out.photoType = isJpeg ? 'image/jpeg' : 'image/png';
    return { record: out, photo };
  }
  if (type === 'method') {
    out.method = text(body.method, 40);
    out.asr = text(body.asr, 10) || 'unsure';
    out.how = text(body.how, 1000);
    if (!METHODS.includes(out.method)) throw new Error('pick a method');
    if (!ASR.includes(out.asr)) throw new Error('bad asr');
    if (!out.how) throw new Error('how do you know?');
    return { record: out, photo: null };
  }
  // spotcheck
  out.mosque = text(body.mosque, 200);
  out.prayer = text(body.prayer, 10);
  out.heardAt = text(body.heardAt, 40);
  if (!out.mosque) throw new Error('which mosque?');
  if (!PRAYERS.includes(out.prayer)) throw new Error('which prayer?');
  if (!out.heardAt || Number.isNaN(Date.parse(out.heardAt))) throw new Error('when was the adhan?');
  return { record: out, photo: null };
}

module.exports = { validate, MAX_PHOTO_BYTES };
