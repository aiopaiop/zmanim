'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'data.json');

function defaults() {
  return {
    ad: {
      parsha: 'בראשית',
      times: {
        minchaErev: '6:00', shacharit1: '5:50', shacharit2: '9:00',
        avot: '4:30', minchaShabbat: '5:15', maariv: '7:10',
      },
      suffix: { shacharit1: 'ברכות', shacharit2: 'הודו' },
      updatedAt: null,
    },
    settings: {
      yemotNumber: '',
      yemotApiKey: '',
      ivrToken: crypto.randomBytes(16).toString('hex'),
      sessionSecret: crypto.randomBytes(32).toString('hex'),
      gmailUser: '',
      gmailAppPassword: '',
      senderName: 'זמני תפילות',
      recipients: '',
      allowedEmails: '',
      autoSendOnPhone: true,
      attachPdf: true,
      attachDocx: true,
    },
  };
}

let state = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const base = defaults();
  if (fs.existsSync(FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      state = {
        ad: { ...base.ad, ...saved.ad, times: { ...base.ad.times, ...(saved.ad || {}).times }, suffix: { ...base.ad.suffix, ...(saved.ad || {}).suffix } },
        settings: { ...base.settings, ...saved.settings },
      };
    } catch (e) {
      console.error('data.json פגום, מתחיל מחדש:', e.message);
      state = base;
    }
  } else {
    state = base;
  }
  save();
  return state;
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

const clone = (o) => JSON.parse(JSON.stringify(o));

function getAd() { return clone(state.ad); }

function setAd(ad) {
  state.ad = {
    parsha: String(ad.parsha || '').trim(),
    times: { ...state.ad.times, ...ad.times },
    suffix: { ...state.ad.suffix, ...ad.suffix },
    updatedAt: new Date().toISOString(),
  };
  save();
  return getAd();
}

function getSettings() { return clone(state.settings); }

// שדות סודיים: ערך ריק = משאירים את הקיים
const SECRET_FIELDS = ['yemotApiKey', 'gmailAppPassword'];
const EDITABLE = ['yemotNumber', 'yemotApiKey', 'gmailUser', 'gmailAppPassword', 'senderName',
  'recipients', 'allowedEmails', 'autoSendOnPhone', 'attachPdf', 'attachDocx'];

function setSettings(patch) {
  for (const k of EDITABLE) {
    if (!(k in patch)) continue;
    if (SECRET_FIELDS.includes(k) && !String(patch[k] || '').trim()) continue;
    state.settings[k] = typeof state.settings[k] === 'boolean' ? !!patch[k] : String(patch[k]).trim();
  }
  save();
}

// הגדרות לתצוגה באתר, בלי הסודות
function publicSettings() {
  const s = getSettings();
  const out = { ...s };
  delete out.sessionSecret;
  for (const k of SECRET_FIELDS) { out[k + 'Set'] = !!s[k]; out[k] = ''; }
  return out;
}

module.exports = { load, getAd, setAd, getSettings, setSettings, publicSettings, DATA_DIR };
