'use strict';
const { SLOTS } = require('./times');
const { ALL_NAMES, ALL_MODIFIERS } = require('./parshiot');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;background:#f4efe6;color:#2b2118;line-height:1.5}
header{background:#5b3a1e;color:#fff;padding:12px 20px;display:flex;align-items:center;gap:20px}
header h1{font-size:18px;margin:0;flex:1}
header a,header button{color:#fff;background:none;border:0;font:inherit;cursor:pointer;text-decoration:underline;padding:0}
main{max-width:1000px;margin:20px auto;padding:0 16px}
.grid{display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.card{background:#fff;border:1px solid #e3d8c6;border-radius:12px;padding:18px;margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:16px}
label{display:block;font-size:14px;margin:10px 0 4px;font-weight:600}
input[type=text],input[type=password],input[type=email]{width:100%;padding:9px 10px;border:1px solid #cdbfa8;border-radius:8px;font:inherit;background:#fffdf9}
input:focus{outline:2px solid #b98b52;border-color:#b98b52}
input.bad{border-color:#c0392b;background:#fdf0ee}
.row{display:grid;grid-template-columns:1fr 110px 110px;gap:8px;align-items:center;margin-bottom:8px}
.row span{font-size:15px}
.row input{text-align:center;direction:ltr}
.row input.sfx{direction:rtl}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
button.b,a.b{display:inline-block;padding:10px 16px;border-radius:8px;border:1px solid #5b3a1e;background:#fff;color:#5b3a1e;font:inherit;font-weight:600;cursor:pointer}
button.b.primary,a.b.primary{background:#5b3a1e;color:#fff}
button.b:disabled{opacity:.5;cursor:wait}
#msg{margin-top:12px;padding:10px 12px;border-radius:8px;display:none;font-size:14px}
#msg.ok{display:block;background:#e6f4ea;color:#1e5c2e}
#msg.err{display:block;background:#fdecea;color:#8a1f17}
.sheet{position:relative;width:100%;aspect-ratio:210/297;background:url(/assets/blank.jpg) center/100% 100%;container-type:inline-size;box-shadow:0 2px 14px #0003;border-radius:2px;overflow:hidden;direction:rtl;font-family:"Times New Roman",serif;color:#000}
.sheet .in{position:absolute;top:23.2%;right:15.1%;left:15.1%}
.sheet .t{text-align:center;font-weight:700;text-decoration:underline;font-size:5.4cqw;margin-bottom:3.4cqw;line-height:1.25}
.sheet .r{display:grid;grid-template-columns:4300fr 1800fr 2206fr;align-items:center;padding:1.1cqw 0;font-size:5.7cqw}
.sheet .r .s{text-align:center;font-size:3.7cqw}
.sheet .r .m{direction:ltr;text-align:right}
.sheet .g{text-align:center;margin-top:4cqw}
.sheet .g div{line-height:1.3}
.hint{font-size:13px;color:#6b5b48;margin:6px 0 0}
pre{background:#2b2118;color:#f4efe6;padding:12px;border-radius:8px;direction:ltr;text-align:left;overflow:auto;font-size:13px}
.chk{display:flex;gap:8px;align-items:center;margin:10px 0;font-weight:400}
.chk input{width:auto}
`;

function layout(title, body, { nav = true } = {}) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body>
${nav ? `<header><h1>מודעות זמני תפילות</h1><a href="/">עריכת מודעה</a><a href="/settings">הגדרות</a>
<form method="post" action="/logout" style="margin:0"><button>יציאה</button></form></header>` : ''}
<main>${body}</main></body></html>`;
}

function loginPage(error, googleEnabled) {
  return layout('כניסה', `<div class="card" style="max-width:380px;margin:60px auto">
<h2>כניסה למערכת</h2>${error ? `<p style="color:#8a1f17">${esc(error)}</p>` : ''}
<form method="post" action="/login"><label for="p">סיסמה</label>
<input id="p" type="password" name="password" autofocus autocomplete="current-password">
<div class="btns"><button class="b primary">כניסה</button></div></form>
${googleEnabled ? '<p style="text-align:center;margin:18px 0 6px">או</p><div class="btns" style="justify-content:center"><a class="b" href="/auth/google" style="text-decoration:none">כניסה עם Google</a></div>' : ''}</div>`, { nav: false });
}

function editorPage(data) {
  const rows = SLOTS.map((s) => `<div class="row"><span>${esc(s.label)}</span>
<input type="text" inputmode="numeric" data-time="${s.key}" placeholder="5:50" maxlength="5" aria-label="${esc(s.label)}">
${s.hasSuffix ? `<input type="text" class="sfx" data-sfx="${s.key}" maxlength="12" aria-label="מילת פתיחה">` : '<span></span>'}</div>`).join('');
  const preview = SLOTS.map((s) => `<div class="r"><div>${esc(s.label)}</div><div class="s" data-psfx="${s.key}"></div><div class="m" data-ptime="${s.key}"></div></div>`).join('');
  return layout('עריכת מודעה', `
<div class="grid"><div>
<div class="card"><h2>פרטי המודעה</h2>
<label for="parsha">שם הפרשה</label>
<input type="text" id="parsha" list="plist" maxlength="40" autocomplete="off">
<datalist id="plist">${ALL_NAMES.concat(ALL_MODIFIERS).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
<p class="hint">לשבת מיוחדת אפשר לכתוב עם מקף, למשל: וישב-חנוכה</p>
<label>זמני התפילות</label>${rows}
<p class="hint">שעה:דקות, למשל 5:50. העמודה השנייה היא המילה שליד הזמן (ברכות / הודו), אפשר לשנות או לרוקן.</p>
<div class="btns"><button class="b primary" id="save">שמירה</button>
<button class="b" id="pdf">הורדת PDF</button><button class="b" id="docx">הורדת Word</button>
<button class="b" id="send">שמירה ושליחה למייל</button></div>
<div id="msg" role="status"></div></div></div>
<div><div class="sheet"><div class="in"><div class="t" id="ptitle"></div>${preview}
<div class="g"><div style="font-size:3.7cqw">בברכת</div><div style="font-size:4.4cqw;font-weight:700">שבת שלום ומבורך</div><div style="font-size:4cqw">הגבאים</div></div></div></div>
<p class="hint">התצוגה המקדימה משוערת. הקבצים שנשלחים נוצרים בעיצוב הסופי.</p></div></div>
<script>
const D=${JSON.stringify(data).replace(/</g, '\\u003c')};
const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
const okTime=(v)=>{const m=v.trim().match(/^(\\d{1,2})[:.](\\d{2})$/);return !!m&&+m[1]>=1&&+m[1]<=12&&+m[2]<60};
function fill(){ $('#parsha').value=D.ad.parsha; $$('[data-time]').forEach(i=>i.value=D.ad.times[i.dataset.time]||''); $$('[data-sfx]').forEach(i=>i.value=D.ad.suffix[i.dataset.sfx]||''); preview(); }
function preview(){
  $('#ptitle').textContent='זמני התפילות לשבת פרשת '+$('#parsha').value;
  $$('[data-time]').forEach(i=>{ $('[data-ptime="'+i.dataset.time+'"]').textContent=i.value; i.classList.toggle('bad', i.value!==''&&!okTime(i.value)); });
  $$('[data-sfx]').forEach(i=>{ $('[data-psfx="'+i.dataset.sfx+'"]').textContent=i.value; });
}
function collect(){ const times={},suffix={}; $$('[data-time]').forEach(i=>times[i.dataset.time]=i.value.trim()); $$('[data-sfx]').forEach(i=>suffix[i.dataset.sfx]=i.value.trim()); return {parsha:$('#parsha').value.trim(),times,suffix}; }
function show(t,ok){ const m=$('#msg'); m.textContent=t; m.className=ok?'ok':'err'; }
async function post(url,body){ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}); const j=await r.json().catch(()=>({})); if(!r.ok||j.ok===false) throw new Error(j.error||'שגיאה'); return j; }
async function save(){ const j=await post('/api/ad',collect()); D.ad=j.ad; fill(); }
function busy(b,on){ $$('button.b').forEach(x=>x.disabled=on); }
async function act(fn,okText){ busy(0,true); try{ await fn(); if(okText) show(okText,true);}catch(e){ show(e.message,false);} finally{ busy(0,false);} }
$('#save').onclick=()=>act(save,'נשמר');
$('#send').onclick=()=>act(async()=>{ await save(); show('יוצר מודעה ושולח...',true); await post('/api/send'); },'המודעה נשלחה למייל');
$('#pdf').onclick=()=>act(async()=>{ await save(); location.href='/download/pdf'; },'מוריד PDF...');
$('#docx').onclick=()=>act(async()=>{ await save(); location.href='/download/docx'; },'מוריד Word...');
document.addEventListener('input',preview); fill();
</script>`);
}

function settingsPage(s, origin, g = {}) {
  const ini = `type=api\napi_link=${origin}/ivr/${s.ivrToken}\napi_url_post=no\napi_wait_answer_music_on_hold=yes\napi_log=yes`;
  return layout('הגדרות', `
<div class="card"><h2>קו ימות המשיח</h2>
<label for="yn">מספר הקו / המערכת</label><input type="text" id="yn" data-f="yemotNumber" value="${esc(s.yemotNumber)}" inputmode="numeric" autocomplete="off">
<label for="yk">מפתח API (סיסמת המערכת)</label><input type="password" id="yk" data-f="yemotApiKey" placeholder="${s.yemotApiKeySet ? 'שמור. השאר ריק כדי לא לשנות' : ''}" autocomplete="new-password">
<p class="hint">הקו פונה לאתר דרך שלוחת API. הגדרת השלוחה (קובץ ext.ini בשלוחה שתבחר):</p>
<pre>${esc(ini)}</pre>
<p class="hint">כתובת השלוחה כוללת מפתח סודי, כך שרק הקו שלך יכול לעדכן. מומלץ להגדיר גם סיסמה לשלוחה בצד ימות.</p>
<label class="chk"><input type="checkbox" data-f="autoSendOnPhone" ${s.autoSendOnPhone ? 'checked' : ''}> שליחה אוטומטית למייל אחרי עדכון בקו (אפשרות 1 בתפריט האישור)</label></div>
<div class="card"><h2>שליחת מייל</h2>
<label for="gu">כתובת Gmail שולחת</label><input type="email" id="gu" data-f="gmailUser" value="${esc(s.gmailUser)}" autocomplete="off" dir="ltr">
<label for="gp">סיסמת אפליקציה של Gmail</label><input type="password" id="gp" data-f="gmailAppPassword" placeholder="${s.gmailAppPasswordSet ? 'שמורה. השאר ריק כדי לא לשנות' : '16 תווים'}" autocomplete="new-password" dir="ltr">
<p class="hint">יוצרים בחשבון Google תחת אבטחה, אימות דו-שלבי, סיסמאות אפליקציה. זו לא סיסמת החשבון הרגילה.</p>
<label for="sn">שם השולח</label><input type="text" id="sn" data-f="senderName" value="${esc(s.senderName)}">
<label for="rc">כתובות יעד (מופרדות בפסיק)</label><input type="text" id="rc" data-f="recipients" value="${esc(s.recipients)}" dir="ltr">
<label class="chk"><input type="checkbox" data-f="attachPdf" ${s.attachPdf ? 'checked' : ''}> לצרף PDF</label>
<label class="chk"><input type="checkbox" data-f="attachDocx" ${s.attachDocx ? 'checked' : ''}> לצרף Word</label></div>
<div class="card"><h2>הרשאות כניסה עם Google</h2>
<label for="ae">כתובות Gmail שמורשות להיכנס (מופרדות בפסיק)</label>
<input type="text" id="ae" data-f="allowedEmails" value="${esc(s.allowedEmails)}" dir="ltr" autocomplete="off">
${g.googleEnabled
    ? `<p class="hint">כניסה עם Google פעילה. בהגדרות OAuth ב-Google יש להוסיף כתובת הפניה: <b dir="ltr">${esc(g.redirectUri)}</b></p>`
    : '<p class="hint">כניסה עם Google עדיין לא הופעלה: יש להגדיר בשרת את GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET (ראה README).</p>'}</div>
<div class="btns"><button class="b primary" id="save">שמירת הגדרות</button><button class="b" id="test">שמירה ושליחת מייל בדיקה</button></div>
<div id="msg" role="status"></div>
<script>
const $$=(s)=>[...document.querySelectorAll(s)];
function collect(){const o={};$$('[data-f]').forEach(i=>o[i.dataset.f]=i.type==='checkbox'?i.checked:i.value);return o}
function show(t,ok){const m=document.getElementById('msg');m.textContent=t;m.className=ok?'ok':'err'}
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.error||'שגיאה');return j}
async function act(fn,t){$$('button.b').forEach(b=>b.disabled=true);try{await fn();show(t,true)}catch(e){show(e.message,false)}finally{$$('button.b').forEach(b=>b.disabled=false)}}
document.getElementById('save').onclick=()=>act(()=>post('/api/settings',collect()),'ההגדרות נשמרו');
document.getElementById('test').onclick=()=>act(async()=>{await post('/api/settings',collect());await post('/api/test-email')},'ההגדרות נשמרו ומייל בדיקה נשלח');
</script>`);
}

module.exports = { loginPage, editorPage, settingsPage };
