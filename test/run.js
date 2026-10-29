'use strict';
// בדיקות לוגיקה: זיהוי פרשה, זמנים, זרימת הקו (עם שיחה מדומה), יצירת מודעה
const path = require('path');
const fs = require('fs');
const os = require('os');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-test-'));

const assert = require('assert');
const { matchParsha } = require('../src/parshiot');
const { parseFourDigits, parseTimeText, speakTime } = require('../src/times');
const store = require('../src/store');
const { ivrFlow } = require('../src/ivr');

let passed = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log('  ✓', name); },
  (e) => { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; });

class ExitError extends Error {}
class FakeCall {
  constructor(replies) { this.replies = replies.slice(); this.log = []; this.pending = []; }
  async read(msgs, mode, opts) {
    this.log.push({ kind: 'read', mode, text: [...this.pending, ...msgs].map((m) => m.data).join(' | '), opts });
    this.pending = [];
    if (!this.replies.length) throw new Error('נגמרו התשובות המתוכנתות');
    return this.replies.shift();
  }
  id_list_message(msgs, opts = {}) {
    if (opts.prependToNextAction) { this.pending.push(...msgs); return; }
    this.log.push({ kind: 'end', text: msgs.map((m) => m.data).join(' | ') });
    throw new ExitError('exit');
  }
}
async function runCall(replies, deps) {
  const call = new FakeCall(replies);
  try { await ivrFlow(call, deps); } catch (e) { if (!(e instanceof ExitError)) throw e; }
  return call;
}

(async () => {
  console.log('זיהוי פרשה');
  for (const [input, want] of [
    ['בראשית', 'בראשית'], ['נוח', 'נח'], ['לך לך', 'לך לך'], ['לכלך', 'לך לך'],
    ['וישב חנוכה', 'וישב-חנוכה'], ['פרשת תזריע מצורע', 'תזריע-מצורע'], ['שבת שובה האזינו', 'האזינו-שובה'],
    ['וישלח', 'וישלח'], ['ויגש', 'ויגש'], ['בא', 'בא'], ['חיי שרה', 'חיי שרה'], ['פנחס', 'פינחס'],
    ['ויקרה', 'ויקרא'], ['אחרי מות קדושים', 'אחרי מות-קדושים'],
  ]) await ok(`"${input}" -> ${want}`, () => assert.strictEqual(matchParsha(input), want));
  for (const bad of ['', 'שלום מה נשמע', 'None', 'אבגדהוז'])
    await ok(`"${bad}" לא מזוהה`, () => assert.strictEqual(matchParsha(bad), null));

  console.log('זמנים');
  await ok('0550 -> 5:50', () => assert.strictEqual(parseFourDigits('0550'), '5:50'));
  await ok('1030 -> 10:30', () => assert.strictEqual(parseFourDigits('1030'), '10:30'));
  await ok('0000 / 1360 / 550 לא תקינים', () => ['0000', '1360', '550', '05500'].forEach((x) => assert.strictEqual(parseFourDigits(x), null)));
  await ok('הקלדה באתר', () => { assert.strictEqual(parseTimeText('05:50'), '5:50'); assert.strictEqual(parseTimeText('5.5'), null); });
  await ok('הקראה', () => assert.strictEqual(speakTime('6:00'), 'שעה 6 בדיוק'));

  console.log('זרימת הקו');
  store.load();
  let sent = 0;
  const deps = { store, sendAd: async () => { sent++; return { ok: true }; } };

  await ok('עדכון מלא + שמירה ושליחה', async () => {
    // תפריט=1, שישה זמנים (אחד לא תקין ואז תקין, אחד נשאר), פרשה בקול, אישור, שמירה ושליחה
    const call = await runCall(['1', '0405', '0555', '0900', '999', '0430', 'None', '0725', 'וישב חנוכה', '1', '1'], deps);
    const ad = store.getAd();
    assert.strictEqual(ad.times.minchaErev, '4:05');
    assert.strictEqual(ad.times.shacharit1, '5:55');
    assert.strictEqual(ad.times.shacharit2, '9:00');
    assert.strictEqual(ad.times.avot, '4:30');
    assert.strictEqual(ad.times.minchaShabbat, '5:15');   // נשאר
    assert.strictEqual(ad.times.maariv, '7:25');
    assert.strictEqual(ad.parsha, 'וישב-חנוכה');
    assert.strictEqual(sent, 1);
    assert.ok(call.log.some((l) => /אינו תקין/.test(l.text)), 'הודעת שגיאה על זמן לא תקין');
    assert.ok(call.log.some((l) => l.mode === 'stt'), 'נעשה שימוש בזיהוי דיבור');
    assert.match(call.log.at(-1).text, /נשלחה למייל/);
  });

  await ok('ביטול לא שומר', async () => {
    const before = JSON.stringify(store.getAd());
    await runCall(['1', '0101', '0101', '0101', '0101', '0101', '0101', '0', '3'], deps);
    assert.strictEqual(JSON.stringify(store.getAd()), before);
  });

  await ok('שמירה בלבד לא שולחת', async () => {
    sent = 0;
    await runCall(['1', 'None', 'None', 'None', 'None', 'None', 'None', '0', '2'], deps);
    assert.strictEqual(sent, 0);
  });

  await ok('תמלול שגוי 3 פעמים משאיר את הפרשה', async () => {
    const before = store.getAd().parsha;
    await runCall(['1', 'None', 'None', 'None', 'None', 'None', 'None', 'בלה בלה', 'None', 'אבגד', '1'], deps);
    assert.strictEqual(store.getAd().parsha, before);
  });

  await ok('אישור פרשה: 2 = אמירה מחדש', async () => {
    await runCall(['1', 'None', 'None', 'None', 'None', 'None', 'None', 'נח', '2', 'שמות', '1', '2'], deps);
    assert.strictEqual(store.getAd().parsha, 'שמות');
  });

  await ok('שליחה מהתפריט (3)', async () => {
    sent = 0;
    const call = await runCall(['3'], deps);
    assert.strictEqual(sent, 1);
    assert.match(call.log.at(-1).text, /נשלחה/);
  });

  await ok('אף הודעה לא כוללת תווים אסורים לימות', async () => {
    const call = await runCall(['2', '9'], deps);
    for (const l of call.log) assert.ok(!/[.\-'"&]/.test(l.text), 'תו אסור: ' + l.text);
  });

  await ok('סיסמאות לא נחשפות בהגדרות הציבוריות', () => {
    store.setSettings({ gmailAppPassword: 'secret-pass', gmailUser: 'a@b.c' });
    const pub = store.publicSettings();
    assert.strictEqual(pub.gmailAppPassword, ''); assert.strictEqual(pub.gmailAppPasswordSet, true);
    assert.ok(!('sessionSecret' in pub));
    store.setSettings({ gmailAppPassword: '' });            // ריק = משאירים
    assert.strictEqual(store.getSettings().gmailAppPassword, 'secret-pass');
  });

  console.log('כניסה עם Google');
  process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
  const google = require('../src/google');
  const good = { aud: 'cid', iss: 'https://accounts.google.com', email_verified: true, exp: Date.now() / 1000 + 600, email: 'Gabai@Gmail.com' };
  await ok('מייל מורשה נכנס (בלי רגישות לאותיות)', () => assert.strictEqual(google.allowedEmail(good, 'a@x.com, gabai@gmail.com'), 'gabai@gmail.com'));
  await ok('מייל לא ברשימה נדחה', () => assert.strictEqual(google.allowedEmail(good, 'a@x.com'), null));
  await ok('טוקן לא תקין נדחה', () => {
    for (const bad of [{ aud: 'other' }, { iss: 'evil.com' }, { email_verified: false }, { exp: 1 }])
      assert.strictEqual(google.allowedEmail({ ...good, ...bad }, 'gabai@gmail.com'), null);
  });
  await ok('קישור הכניסה', () => assert.match(google.authUrl('https://x/cb', 's1'), /client_id=cid.*state=s1/));

  console.log('יצירת מודעה');
  const { renderFiles } = require('../src/render');
  await ok('docx ו-PDF בעמוד אחד', async () => {
    const f = await renderFiles(store.getAd());
    assert.ok(f.docx.length > 1000 && f.pdf.slice(0, 4).toString() === '%PDF');
    const pages = (f.pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.strictEqual(pages, 1);
  });

  console.log(`\n${passed} בדיקות עברו${process.exitCode ? ' (יש כשלונות)' : ''}`);
})();
