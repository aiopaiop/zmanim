'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const store = require('./store');
const mailer = require('./mailer');
const { renderFiles, fileBase } = require('./render');
const { SLOTS, parseTimeText } = require('./times');
const views = require('./views');
const google = require('./google');

const COOKIE = 'pa_session';
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function safeEqual(a, b) { return crypto.timingSafeEqual(sha(a), sha(b)); }

function sign(exp) {
  const mac = crypto.createHmac('sha256', store.getSettings().sessionSecret).update(String(exp)).digest('hex');
  return `${exp}.${mac}`;
}
function validToken(tok) {
  const [exp, mac] = String(tok || '').split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const want = sign(exp).split('.')[1];
  return mac.length === want.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want));
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 0, reset: now + 15 * 60 * 1000 }); return false; }
  return a.n >= 10;
}

const HEBREW_TEXT = /^[\u0590-\u05FF\s\-'"״׳]+$/;

function validateAd(body) {
  const parsha = String(body.parsha || '').trim();
  if (!parsha || parsha.length > 40 || !HEBREW_TEXT.test(parsha)) throw new Error('שם הפרשה חייב להיות בעברית (עד 40 תווים)');
  const times = {};
  for (const s of SLOTS) {
    const t = parseTimeText((body.times || {})[s.key]);
    if (!t) throw new Error(`הזמן של "${s.label}" אינו תקין. יש לכתוב שעה:דקות, למשל 5:50`);
    times[s.key] = t;
  }
  const suffix = {};
  for (const s of SLOTS.filter((x) => x.hasSuffix)) {
    const v = String((body.suffix || {})[s.key] || '').trim();
    if (v && (v.length > 12 || !HEBREW_TEXT.test(v))) throw new Error('המילה שליד הזמן חייבת להיות בעברית (עד 12 תווים)');
    suffix[s.key] = v;
  }
  return { parsha, times, suffix };
}

const wrapPage = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).send('שגיאה בכניסה עם Google');
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ ok: false, error: e.message || 'שגיאה' });
});

function createApp({ adminPassword, ivrHandler }) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => { res.set({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' }); next(); });

  app.get('/healthz', (req, res) => res.send('ok'));
  app.use('/assets', express.static(path.join(__dirname, '..', 'assets'), { maxAge: '7d' }));

  // הקו של ימות המשיח: הכתובת כוללת מפתח סודי
  app.use('/ivr/:token', (req, res, next) => {
    if (!safeEqual(req.params.token, store.getSettings().ivrToken)) return res.status(404).end();
    next();
  }, ivrHandler);

  function startSession(req, res) {
    const exp = Date.now() + SESSION_MS;
    res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(exp))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${req.secure ? '; Secure' : ''}`);
  }
  const redirectUri = (req) => `${process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/auth/google/callback`;

  app.get('/login', (req, res) => res.send(views.loginPage('', google.enabled())));

  app.get('/auth/google', (req, res) => {
    if (!google.enabled()) return res.redirect('/login');
    const state = crypto.randomBytes(16).toString('hex');
    res.append('Set-Cookie', `pa_oauth=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${req.secure ? '; Secure' : ''}`);
    res.redirect(google.authUrl(redirectUri(req), state));
  });

  app.get('/auth/google/callback', wrapPage(async (req, res) => {
    const fail = (msg) => res.status(403).send(views.loginPage(msg, google.enabled()));
    if (!google.enabled()) return res.redirect('/login');
    if (!req.query.code || !req.query.state || req.query.state !== cookies(req).pa_oauth) return fail('הכניסה עם Google נכשלה, נסה שוב');
    const claims = await google.exchangeCode(String(req.query.code), redirectUri(req));
    const email = google.allowedEmail(claims, store.getSettings().allowedEmails);
    if (!email) return fail('לכתובת הזו אין הרשאת כניסה. בקש ממנהל המערכת להוסיף אותך.');
    res.append('Set-Cookie', 'pa_oauth=; HttpOnly; Path=/; Max-Age=0');
    startSession(req, res);
    res.redirect('/');
  }));
  app.post('/login', (req, res) => {
    if (limited(req.ip)) return res.status(429).send(views.loginPage('יותר מדי ניסיונות. נסה שוב בעוד רבע שעה.', google.enabled()));
    if (!safeEqual(req.body.password || '', adminPassword)) {
      attempts.get(req.ip).n++;
      return res.status(401).send(views.loginPage('סיסמה שגויה', google.enabled()));
    }
    attempts.delete(req.ip);
    startSession(req, res);
    res.redirect('/');
  });
  app.post('/logout', (req, res) => {
    res.set('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.redirect('/login');
  });

  // כל מה שמתחת מוגן בסיסמה
  app.use((req, res, next) => {
    if (validToken(cookies(req)[COOKIE])) { res.set('Cache-Control', 'no-store'); return next(); }
    if (req.path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'פג תוקף הכניסה, יש להיכנס מחדש' });
    res.redirect('/login');
  });

  app.get('/', (req, res) => res.send(views.editorPage({ ad: store.getAd() })));
  app.get('/settings', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.send(views.settingsPage(store.publicSettings(), origin, { googleEnabled: google.enabled(), redirectUri: redirectUri(req) }));
  });

  app.post('/api/ad', wrap((req, res) => {
    let ad;
    try { ad = validateAd(req.body); } catch (e) { return res.status(400).json({ ok: false, error: e.message }); }
    res.json({ ok: true, ad: store.setAd(ad) });
  }));

  app.post('/api/send', wrap(async (req, res) => {
    const r = await mailer.sendAd(store.getAd());
    res.status(r.ok ? 200 : 500).json(r);
  }));

  app.post('/api/settings', wrap((req, res) => {
    store.setSettings(req.body || {});
    res.json({ ok: true });
  }));

  app.post('/api/test-email', wrap(async (req, res) => {
    const r = await mailer.sendTest();
    res.status(r.ok ? 200 : 500).json(r);
  }));

  app.get('/download/:type(pdf|docx)', wrap(async (req, res) => {
    const ad = store.getAd();
    const files = await renderFiles(ad);
    const isPdf = req.params.type === 'pdf';
    res.set({
      'Content-Type': isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileBase(ad) + (isPdf ? '.pdf' : '.docx'))}`,
    });
    res.send(isPdf ? files.pdf : files.docx);
  }));

  return app;
}

module.exports = { createApp, validateAd };
