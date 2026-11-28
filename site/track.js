/*
 * Website counts, the part TelemetryDeck's page script does not do: which buttons
 * people press (App Store, Google Play, web app, Join, notes), where a visit came
 * from when a link says so (?from=iphone-app), and when a form on the page says it
 * was sent. It also tags the Google Play links so the Play Console can show how many
 * installs came from this website.
 *
 * Loaded only when config/analytics.json has an App ID (see tools/inject_visitor_counts.py
 * and site/index.html), never for browsers that send Global Privacy Control. Sends no
 * cookies and nothing about the person: a random number kept only for this tab, the
 * page path (no query), and the name of the button. See docs/analytics.md.
 */
(function () {
  var id = window.PTA_TD;
  if (!id || navigator.globalPrivacyControl) return;
  var ENDPOINT = 'https://nom.telemetrydeck.com/v2/';
  var user;
  try {
    user = sessionStorage.getItem('pta.td');
    if (!user) { user = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); sessionStorage.setItem('pta.td', user); }
  } catch (e) { user = 'tab'; }
  var test = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  var path = location.pathname.replace(/index\.html$/, '').slice(0, 80) || '/';
  var key = (location.pathname.split('/').filter(Boolean)[0] || 'home').replace(/\.html$/, '').replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'home';

  function send(type, payload) {
    payload['Page.path'] = path;
    try {
      fetch(ENDPOINT, {
        method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify([{ appID: id, clientUser: user, type: type, isTestMode: test, payload: payload }])
      });
    } catch (e) { /* counting is best effort */ }
  }

  function target(a) {
    var u;
    try { u = new URL(a.href, location.href); } catch (e) { return null; }
    var h = u.hostname, p = u.pathname;
    if (h === 'apps.apple.com') return /write-review/.test(u.search) ? 'review-ios' : 'store-ios';
    if (h === 'play.google.com') return /showAllReviews/.test(u.search) ? 'review-android' : 'store-android';
    if (h === 'testflight.apple.com') return 'testflight';
    if (h === 'www.instagram.com') return 'social-instagram';
    if (h === 'www.facebook.com') return 'social-facebook';
    if (u.origin !== location.origin && h !== 'prayertimes.asia') return null;
    if (/\/app\/print\/?$/.test(p) || /\/app\/print\//.test(p)) return 'print';
    if (/\/app\/?(index\.html)?$/.test(p)) return 'web-app';
    var m = p.match(/\/(join|leave|note|verify|announcement|new-look|masjid|tv|ramadan|barakah-picks)(\.html)?\/?$/);
    return m ? m[1] : null;
  }

  // Tag Google Play links so the Play Console shows installs that came from this website.
  var links = document.querySelectorAll('a[href*="play.google.com/store/apps/details"]');
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    if (/referrer=|showAllReviews/.test(l.href)) continue;
    l.href += (l.href.indexOf('?') < 0 ? '?' : '&') + 'referrer=' + encodeURIComponent('utm_source=website&utm_medium=' + key);
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var t = target(a);
    if (t) send('Web.click', { 'Click.target': t });
  }, true);

  // A visit that says where it came from, for example from the iPhone or Android app.
  var from = new URLSearchParams(location.search).get('from');
  if (from && /^[a-z-]{2,24}$/.test(from)) send('Web.landed', { 'Page.from': from });

  // The form on this page says it was sent (the form is GoHighLevel's, shown inside the page).
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://api.nasardigital.com') return;
    var d = e.data, s = '';
    try { s = typeof d === 'string' ? d : JSON.stringify(d); } catch (err) { return; }
    if (/submitted|form-submit|survey-submit|thank/i.test(s.slice(0, 400))) {
      if (window.__ptaFormSent) return;
      window.__ptaFormSent = true;
      send('Web.formSent', { 'Form.page': key });
    }
  });
})();
