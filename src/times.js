'use strict';
// הגדרת שעות התפילה במודעה, בסדר שבו הן מופיעות
const SLOTS = [
  { key: 'minchaErev',    label: 'מנחה ערש"ק',     say: 'מנחה ערב שבת קודש', hasSuffix: false },
  { key: 'shacharit1',    label: "שחרית מנין א'",  say: 'שחרית מנין אלף',    hasSuffix: true },
  { key: 'shacharit2',    label: "שחרית מנין ב'",  say: 'שחרית מנין בית',    hasSuffix: true },
  { key: 'avot',          label: 'אבות ובנים',     say: 'אבות ובנים',        hasSuffix: false },
  { key: 'minchaShabbat', label: 'מנחה שב"ק',      say: 'מנחה שבת קודש',     hasSuffix: false },
  { key: 'maariv',        label: 'מעריב מוצ"ש',    say: 'מעריב מוצאי שבת',   hasSuffix: false },
];

function fmt(h, m) {
  if (!(h >= 1 && h <= 12 && m >= 0 && m <= 59)) return null;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// "0550" -> "5:50" (ארבע ספרות מהקו)
function parseFourDigits(d) {
  const s = String(d || '').trim();
  if (!/^\d{4}$/.test(s)) return null;
  return fmt(Number(s.slice(0, 2)), Number(s.slice(2)));
}

// "5:50" / "05:50" / "5.50" -> "5:50" (הקלדה באתר)
function parseTimeText(t) {
  const m = String(t || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  return m ? fmt(Number(m[1]), Number(m[2])) : null;
}

// ניסוח להקראה בקו (בלי תווים אסורים של ימות)
function speakTime(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]), min = Number(m[2]);
  return min === 0 ? `שעה ${h} בדיוק` : `שעה ${h} ו ${min} דקות`;
}

// מחרוזת ספרות לדוגמה לשמיעה: "5:50" -> "0550"
function toDigits(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? m[1].padStart(2, '0') + m[2] : '';
}

module.exports = { SLOTS, parseFourDigits, parseTimeText, speakTime, toDigits };
