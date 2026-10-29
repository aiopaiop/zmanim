# מערכת מודעות זמני תפילות

עדכון זמני תפילות ושם פרשה דרך קו ימות המשיח או דרך האתר, יצירת מודעה (PDF + Word) בעיצוב הבלנק, ושליחה למייל.

## פריסה בענן (Render)
1. מעלים את התיקייה למאגר GitHub פרטי.
2. ב-Render: New → Blueprint, בוחרים את המאגר (הקובץ `render.yaml` מגדיר הכל, כולל דיסק לשמירת הנתונים).
3. ממלאים משתני סביבה:
   - `ADMIN_PASSWORD` – סיסמת הכניסה לאתר. **מומלץ סיסמה ארוכה, לא 1234**: האתר שומר סיסמת Gmail ושולח מיילים.
   - `PUBLIC_URL` – כתובת האתר אחרי הפריסה, למשל `https://prayer-ads.onrender.com` (בלי / בסוף).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` – לכניסה עם Google (ראה למטה, אופציונלי).
4. נכנסים לכתובת האתר, ובעמוד "הגדרות" ממלאים את פרטי הקו והמייל.

אפשר גם להריץ בכל שרת עם Docker: `docker build -t prayer-ads . && docker run -p 3000:3000 -v prayer-data:/data -e ADMIN_PASSWORD=... prayer-ads`

## כניסה עם Google
1. ב-Google Cloud Console: APIs & Services → Credentials → Create OAuth client ID (Web application).
2. ב-Authorized redirect URIs מוסיפים: `<PUBLIC_URL>/auth/google/callback`.
3. מעתיקים Client ID ו-Client secret למשתני הסביבה למעלה ומפעילים את האתר מחדש.
4. בעמוד "הגדרות" → "הרשאות כניסה עם Google" כותבים את כתובות ה-Gmail שמורשות. רק הן ייכנסו.

## חיבור הקו (ימות המשיח)
בעמוד "הגדרות" מופיע קטע מוכן. מעתיקים אותו לקובץ `ext.ini` של שלוחה חדשה במערכת:
```
type=api
api_link=https://<הכתובת שלך>/ivr/<מפתח סודי>
api_url_post=no
api_wait_answer_music_on_hold=yes
api_log=yes
```
מומלץ להגדיר סיסמה לשלוחה בצד ימות, כך שרק מי שמכיר אותה יוכל לעדכן.

תפריט הקו: 1 עדכון (6 זמנים בארבע ספרות, שם הפרשה בקול, הקראה ואישור) · 2 שמיעת הנתונים · 3 שליחה למייל.

## Gmail
בחשבון Google: אבטחה → אימות דו-שלבי → סיסמאות אפליקציה. את הסיסמה (16 תווים) מדביקים בעמוד ההגדרות.

## בדיקות
`npm install && npm test` (ליצירת PDF נדרש LibreOffice; ב-Docker הוא כבר מותקן).
