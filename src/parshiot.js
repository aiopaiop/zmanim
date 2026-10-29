'use strict';
// זיהוי שם פרשה מתוך תמלול דיבור, עם התאמה מטושטשת לרשימת הפרשיות

const PARSHIOT = [
  ['בראשית'], ['נח', ['נוח']], ['לך לך', ['לכלך']], ['וירא'], ['חיי שרה'], ['תולדות'], ['ויצא'],
  ['וישלח'], ['וישב'], ['מקץ'], ['ויגש'], ['ויחי'], ['שמות'], ['וארא'], ['בא'], ['בשלח'],
  ['יתרו'], ['משפטים'], ['תרומה'], ['תצוה', ['תצווה']], ['כי תשא'], ['ויקהל'], ['פקודי'],
  ['ויקרא'], ['צו'], ['שמיני'], ['תזריע'], ['מצורע'], ['אחרי מות', ['אחרי']], ['קדושים'],
  ['אמור'], ['בהר'], ['בחוקותי', ['בחקותי']], ['במדבר'], ['נשא'], ['בהעלותך', ['בהעלתך']],
  ['שלח', ['שלח לך']], ['קרח'], ['חוקת'], ['בלק'], ['פינחס', ['פנחס']], ['מטות'], ['מסעי'],
  ['דברים'], ['ואתחנן'], ['עקב'], ['ראה'], ['שופטים'], ['כי תצא', ['כי תצה']], ['כי תבוא'],
  ['נצבים', ['ניצבים']], ['וילך'], ['האזינו'], ['וזאת הברכה', ['זאת הברכה']],
];

// שבתות מיוחדות / תוספות שמצטרפות לשם הפרשה (למשל: וישב-חנוכה)
const MODIFIERS = [
  ['חנוכה'], ['שובה', ['תשובה']], ['שקלים'], ['זכור'], ['פרה'], ['החודש'], ['הגדול'],
  ['חזון'], ['נחמו'], ['שירה'], ['ראש חודש', ['ראש חדש']],
];

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

function norm(s) {
  return String(s || '')
    .replace(/[\u0591-\u05C7]/g, '')          // ניקוד וטעמים
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^א-ת\s]/g, ' ')                 // כל מה שאינו אות עברית (כולל מקף, גרשיים)
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function similarity(a, b) {
  const m = Math.max(a.length, b.length);
  return m ? 1 - lev(a, b) / m : 0;
}

function threshold(len) {
  if (len <= 3) return 1;      // שמות קצרים (נח, בא, צו, עקב...) רק התאמה מדויקת
  if (len <= 5) return 0.8;
  return 0.72;
}

function findMatches(tokens, list) {
  const found = [];
  list.forEach(([name, aliases = []], idx) => {
    for (const alias of [name, ...aliases]) {
      const key = norm(alias).replace(/ /g, '');
      for (let size = 1; size <= 2; size++) {
        for (let i = 0; i + size <= tokens.length; i++) {
          const cand = tokens.slice(i, i + size).join('');
          const score = similarity(cand, key);
          if (score >= threshold(key.length)) {
            found.push({ idx, name, score, start: i, end: i + size, len: key.length });
          }
        }
      }
    }
  });
  return found;
}

function pick(found) {
  // בוחרים התאמות לפי ציון (ואז אורך), בלי חפיפה בין מילים
  found.sort((a, b) => b.score - a.score || b.len - a.len);
  const used = new Set();
  const chosen = [];
  for (const f of found) {
    let clash = false;
    for (let i = f.start; i < f.end; i++) if (used.has(i)) clash = true;
    if (clash || chosen.some((c) => c.idx === f.idx && c.list === f.list)) continue;
    for (let i = f.start; i < f.end; i++) used.add(i);
    chosen.push(f);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

// מחזיר מחרוזת כמו "וישב-חנוכה" או null אם לא זוהתה אף פרשה
function matchParsha(transcript) {
  const tokens = norm(transcript).split(' ').filter(Boolean);
  if (!tokens.length) return null;

  const parshaHits = pick(findMatches(tokens, PARSHIOT).map((f) => ({ ...f, list: 'p' })));
  if (!parshaHits.length) return null;

  const usedTokens = new Set();
  parshaHits.forEach((h) => { for (let i = h.start; i < h.end; i++) usedTokens.add(i); });
  const modHits = pick(findMatches(tokens, MODIFIERS).map((f) => ({ ...f, list: 'm' })))
    .filter((h) => { for (let i = h.start; i < h.end; i++) if (usedTokens.has(i)) return false; return true; });

  // קודם הפרשה/ות, ואז התוספת (וישב-חנוכה), בלי קשר לסדר שבו נאמרו
  return [...parshaHits, ...modHits].map((h) => h.name).join('-');
}

const ALL_NAMES = PARSHIOT.map((p) => p[0]);
const ALL_MODIFIERS = MODIFIERS.map((m) => m[0]);

module.exports = { matchParsha, ALL_NAMES, ALL_MODIFIERS, norm };
