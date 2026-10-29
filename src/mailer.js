'use strict';
const store = require('./store');
const { renderFiles, fileBase } = require('./render');

function transporterFor(settings) {
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: settings.gmailUser, pass: settings.gmailAppPassword.replace(/\s+/g, '') },
  });
}

function checkSettings(s) {
  if (!s.gmailUser || !s.gmailAppPassword) return 'לא הוגדרו כתובת Gmail וסיסמת אפליקציה (בעמוד ההגדרות)';
  if (!s.recipients) return 'לא הוגדרה כתובת יעד לשליחה (בעמוד ההגדרות)';
  return null;
}

// שולח את המודעה הנוכחית למייל. מחזיר { ok, error? } ולא זורק
async function sendAd(ad = store.getAd()) {
  const s = store.getSettings();
  const problem = checkSettings(s);
  if (problem) return { ok: false, error: problem };
  try {
    const files = await renderFiles(ad);
    const base = fileBase(ad);
    const attachments = [];
    if (s.attachPdf) attachments.push({ filename: `${base}.pdf`, content: files.pdf, contentType: 'application/pdf' });
    if (s.attachDocx) attachments.push({
      filename: `${base}.docx`, content: files.docx,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await transporterFor(s).sendMail({
      from: { name: s.senderName || 'זמני תפילות', address: s.gmailUser },
      to: s.recipients,
      subject: `זמני התפילות לשבת פרשת ${ad.parsha}`,
      text: `מצורפת מודעת זמני התפילות לשבת פרשת ${ad.parsha}.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif">מצורפת מודעת זמני התפילות לשבת פרשת <b>${ad.parsha.replace(/[<>&]/g, '')}</b>.</div>`,
      attachments,
    });
    return { ok: true };
  } catch (e) {
    console.error('שליחת מייל נכשלה:', e.message);
    return { ok: false, error: e.message };
  }
}

async function sendTest() {
  const s = store.getSettings();
  const problem = checkSettings(s);
  if (problem) return { ok: false, error: problem };
  try {
    await transporterFor(s).sendMail({
      from: { name: s.senderName || 'זמני תפילות', address: s.gmailUser },
      to: s.recipients, subject: 'בדיקת מערכת זמני תפילות',
      text: 'אם קיבלת הודעה זו, שליחת המייל מוגדרת נכון.',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendAd, sendTest };
