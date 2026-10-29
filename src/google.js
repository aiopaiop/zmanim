'use strict';
// כניסה עם Google (OAuth). דורש GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET
const clientId = () => process.env.GOOGLE_CLIENT_ID || '';
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || '';
const enabled = () => !!(clientId() && clientSecret());

function authUrl(redirectUri, state) {
  const p = new URLSearchParams({
    client_id: clientId(), redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid email', state, prompt: 'select_account',
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}

function decodeJwt(token) {
  return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
}

// ההחלפה מתבצעת ישירות מול Google בחיבור מאובטח, לכן אפשר לסמוך על התוכן של הטוקן
async function exchangeCode(code, redirectUri) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.id_token) throw new Error('Google דחה את הכניסה');
  return decodeJwt(j.id_token);
}

function parseEmails(text) {
  return String(text || '').toLowerCase().split(/[\s,;]+/).filter((e) => e.includes('@'));
}

// מחזיר את כתובת המייל אם מותר להיכנס, אחרת null
function allowedEmail(claims, allowedText, now = Date.now()) {
  if (!claims || claims.aud !== clientId()) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) return null;
  if (!claims.email_verified || !claims.exp || claims.exp * 1000 < now) return null;
  const email = String(claims.email || '').toLowerCase();
  return parseEmails(allowedText).includes(email) ? email : null;
}

module.exports = { enabled, authUrl, exchangeCode, allowedEmail, parseEmails };
