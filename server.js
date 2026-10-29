'use strict';
const crypto = require('crypto');
const store = require('./src/store');
const { sendAd } = require('./src/mailer');
const { ivrFlow, clean } = require('./src/ivr');
const { createApp } = require('./src/web');

async function main() {
  store.load();

  let adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    adminPassword = crypto.randomBytes(5).toString('hex');
    console.warn(`לא הוגדר ADMIN_PASSWORD. סיסמה זמנית עד הפעלה מחדש: ${adminPassword}`);
  }

  // yemot-router2 מנהל את מצב השיחה בין הבקשות של ימות
  const { YemotRouter } = await import('yemot-router2');
  const router = YemotRouter({
    printLog: process.env.IVR_LOG === '1',
    timeout: '10m',
    uncaughtErrorHandler: async (error, call) => {
      console.error('שגיאה בשיחה:', error);
      try {
        call.id_list_message([{ type: 'text', data: clean('אירעה שגיאה במערכת. נסה שוב מאוחר יותר.') }, { type: 'go_to_folder', data: 'hangup' }]);
      } catch (e) { /* ExitError פנימי של הספרייה */ }
    },
  });
  const handler = (call) => ivrFlow(call, { store, sendAd });
  router.get('/', handler);
  if (typeof router.post === 'function') router.post('/', handler);

  const app = createApp({ adminPassword, ivrHandler: router.asExpressRouter || router });
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`האתר פועל על פורט ${port}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
