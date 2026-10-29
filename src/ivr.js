'use strict';
// זרימת השיחה בקו ימות המשיח. הפונקציה מקבלת אובייקט call של yemot-router2
const { SLOTS, parseFourDigits, speakTime, toDigits } = require('./times');
const { matchParsha } = require('./parshiot');

// ימות לא מקבלת נקודה, מקף, גרש, גרשיים ו-& בטקסט להקראה
const clean = (t) => String(t).replace(/[.\-'"&]/g, ' ').replace(/\s+/g, ' ').trim();
const T = (text) => ({ type: 'text', data: clean(text) });
const isEmpty = (v) => v === undefined || v === null || v === '' || v === 'None';

async function askDigit(call, msgs, allowed) {
  const r = await call.read(msgs, 'tap', {
    max_digits: 1, min_digits: 1, digits_allowed: allowed, sec_wait: 8, amount_attempts: 3,
  });
  return isEmpty(r) ? null : String(r);
}

function finish(call, text) {
  return call.id_list_message([T(text), { type: 'go_to_folder', data: 'hangup' }]);
}

function currentAdMessages(ad) {
  const msgs = [T(`זמני התפילות לשבת פרשת ${ad.parsha}`)];
  for (const s of SLOTS) msgs.push(T(s.say), T(speakTime(ad.times[s.key])));
  return msgs;
}

async function askTimes(call, draft) {
  for (const slot of SLOTS) {
    for (let tries = 0; tries < 3; tries++) {
      const cur = draft.times[slot.key];
      const r = await call.read([
        T(`${slot.say}. הזמן הנוכחי ${speakTime(cur)}.`),
        T(`להקשת זמן חדש הקש ארבע ספרות, שעה ודקות. לדוגמה ${toDigits(cur).split('').join(' ')}. להשארת הזמן הנוכחי הקש סולמית.`),
      ], 'tap', { max_digits: 4, min_digits: 1, sec_wait: 10, allow_empty: true, empty_val: 'None', amount_attempts: 1 });
      if (isEmpty(r)) break;                                // משאירים את הקיים
      const parsed = parseFourDigits(r);
      if (parsed) { draft.times[slot.key] = parsed; break; }
      call.id_list_message([T('הזמן שהוקש אינו תקין. יש להקיש בדיוק ארבע ספרות, שעה בין אחת לשתים עשרה ודקות.')],
        { prependToNextAction: true });
    }
  }
}

async function askParsha(call, draft) {
  for (let tries = 0; tries < 3; tries++) {
    const heard = await call.read([
      T(`הפרשה הנוכחית ${draft.parsha}. לשינוי אמור את שם הפרשה, למשל וישב חנוכה. להשארת הפרשה הנוכחית הקש אפס.`),
    ], 'stt', { allow_empty: true, empty_val: 'None' });
    if (/^\d+$/.test(String(heard || '').trim())) return;      // הוקשה ספרה: משאירים
    const match = isEmpty(heard) ? null : matchParsha(heard);
    if (!match) {
      call.id_list_message([T('לא זוהתה פרשה. נסה שוב.')], { prependToNextAction: true });
      continue;
    }
    const ok = await askDigit(call, [T(`הפרשה שזוהתה ${match}. לאישור הקש 1, לאמירה מחדש הקש 2.`)], [1, 2]);
    if (ok === '1') { draft.parsha = match; return; }
    if (ok === null) return;
  }
}

async function updateFlow(call, deps) {
  const { store, sendAd } = deps;
  const cur = store.getAd();
  const draft = { parsha: cur.parsha, times: { ...cur.times }, suffix: { ...cur.suffix } };

  await askTimes(call, draft);
  await askParsha(call, draft);

  const auto = store.getSettings().autoSendOnPhone;
  const choice = await askDigit(call, [
    ...currentAdMessages(draft),
    T(auto
      ? 'לשמירה ושליחה למייל הקש 1. לשמירה בלבד הקש 2. לביטול הקש 3.'
      : 'לשמירה הקש 1. לשמירה ושליחה למייל הקש 2. לביטול הקש 3.'),
  ], [1, 2, 3]);

  if (choice === null || choice === '3') return finish(call, 'העדכון בוטל, לא נשמרו שינויים. להתראות.');

  store.setAd(draft);
  const send = auto ? choice === '1' : choice === '2';
  if (!send) return finish(call, 'הנתונים נשמרו. להתראות.');
  const res = await sendAd(store.getAd());
  return finish(call, res.ok ? 'הנתונים נשמרו והמודעה נשלחה למייל. להתראות.' : 'הנתונים נשמרו, אך שליחת המייל נכשלה. נסה שוב מהאתר. להתראות.');
}

async function ivrFlow(call, deps) {
  const { store, sendAd } = deps;
  let greeting = true;
  for (let round = 0; round < 10; round++) {
    const msgs = [];
    if (greeting) msgs.push(T('שלום, מערכת עדכון זמני תפילות לשבת.'));
    msgs.push(T('לעדכון הזמנים והפרשה הקש 1. לשמיעת הנתונים הנוכחיים הקש 2. לשליחת המודעה הנוכחית למייל הקש 3. ליציאה הקש 9.'));
    greeting = false;
    const choice = await askDigit(call, msgs, [1, 2, 3, 9]);
    if (choice === '1') return updateFlow(call, deps);
    if (choice === '2') {
      call.id_list_message(currentAdMessages(store.getAd()), { prependToNextAction: true });
      continue;
    }
    if (choice === '3') {
      const res = await sendAd(store.getAd());
      return finish(call, res.ok ? 'המודעה נשלחה למייל. להתראות.' : 'שליחת המייל נכשלה. בדוק את ההגדרות באתר. להתראות.');
    }
    return finish(call, 'להתראות.');
  }
  return finish(call, 'להתראות.');
}

module.exports = { ivrFlow, clean };
