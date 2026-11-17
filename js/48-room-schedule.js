/* ============================================================
   48) ROOM SCHEDULE — جدول غرفة المذاكرة 📅
   - عند إنشاء غرفة: كم جلسة؟ كم مدة كل جلسة؟ كم البريك؟ متى تبدأ؟
   - لكل جدول: عنوان + ثيم (ألوان وإيموجي) + عبارة + صورة
   - الغرفة تمشي تلقائياً: جلسة ← بريك ← جلسة ... للجميع بنفس الوقت
   - «نسخ الجدول» بنفس الستايل المزخرف للمشاركة في واتساب وتويتر
============================================================ */

const SCH_THEMES = {
  saudi:  { name: 'وطني',  emoji: '🇸🇦', heart: '💚', c1: '#0b6b3a', c2: '#14a05c', ink: '#fff', art: '🌴💚⚔️' },
  love:   { name: 'حب',    emoji: '🇸🇦', heart: '❤️', c1: '#9f1239', c2: '#f43f5e', ink: '#fff', art: '❤️🌹❤️' },
  night:  { name: 'ليلي',  emoji: '🌙', heart: '✨', c1: '#0b1250', c2: '#4338ca', ink: '#fff', art: '🌙⭐✨' },
  coffee: { name: 'قهوة',  emoji: '☕', heart: '🤎', c1: '#4a2c1a', c2: '#a0673d', ink: '#fff', art: '☕📚🤎' },
  sky:    { name: 'سماء',  emoji: '☁️', heart: '💙', c1: '#0369a1', c2: '#38bdf8', ink: '#fff', art: '☁️🕊️💙' },
  bloom:  { name: 'ورد',   emoji: '🌸', heart: '💜', c1: '#6d28d9', c2: '#d946ef', ink: '#fff', art: '🌸🦋💜' }
};

const SCH_QUOTES = [
  'لو تامرين الرمل عنّك نلمّه … لو تعطشين الدم لك منّا مسكوب 🩸',
  'وأن ليس للإنسان إلا ما سعى ۝ وأن سعيه سوف يُرى',
  'اللي يزرع اليوم تعب، يحصد بكرة فرح 🌱',
  'الدرجة الكاملة ما تجي صدفة، تجي من جلسات مثل هذي 💪',
  'كل دقيقة تذاكرها الحين، تقرّبك من حلمك خطوة',
  'ركّز… أنت أقرب للهدف مما تتوقع 🎯',
  'تعب ساعة ولا ندم سنة ⏳',
  'ومن يتهيّب صعود الجبال … يعش أبد الدهر بين الحفر'
];

/* ================== الحساب ================== */
function schPhases(s){
  const out = [];
  const n = Math.max(1, Math.min(12, parseInt(s.sessions, 10) || 1));
  const f = Math.max(5, Math.min(180, parseInt(s.focus, 10) || 25));
  const b = Math.max(0, Math.min(60, parseInt(s.brk, 10) || 0));
  for(let i = 1; i <= n; i++){
    out.push({ type: 'focus', n: i, min: f });
    if(i < n && b > 0) out.push({ type: 'break', n: i, min: b });
  }
  return out;
}
window.schPhases = schPhases;

/* أوقات كل مرحلة: من وقت البداية، أو من الوقت الفعلي للمرحلة الحالية لو الغرفة شغالة */
function schTimeline(room){
  const s = room.schedule;
  const phases = schPhases(s);
  const idx = Math.max(0, Math.min(phases.length - 1, room.phase_index || 0));
  let anchorStart, anchorIdx;
  if((room.status === 'running' || room.status === 'paused') && room.ends_at){
    const end = room.status === 'paused'
      ? Date.now() + (room.paused_remaining || 0) * 1000
      : Date.parse(room.ends_at);
    anchorStart = end - phases[idx].min * 60000;
    anchorIdx = idx;
  } else {
    let start = s.start_at ? Date.parse(s.start_at) : 0;
    if(!start || start < Date.now()) start = Date.now();
    anchorStart = start; anchorIdx = 0;
  }
  const times = phases.map(() => ({}));
  let t = anchorStart;
  for(let i = anchorIdx; i < phases.length; i++){ times[i].start = t; t += phases[i].min * 60000; times[i].end = t; }
  t = anchorStart;
  for(let i = anchorIdx - 1; i >= 0; i--){ times[i].end = t; t -= phases[i].min * 60000; times[i].start = t; }
  return phases.map((p, i) => Object.assign({}, p, times[i], { i }));
}
window.schTimeline = schTimeline;

function schTotalFocus(s){
  const m = schPhases(s).filter(p => p.type === 'focus').reduce((a, p) => a + p.min, 0);
  return m;
}

function schFmtClock(ms){
  const d = new Date(ms);
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ap;
}
function schFmtClockAr(ms){
  return schFmtClock(ms).replace('AM', 'ص').replace('PM', 'م');
}
function schHours(min){
  const h = Math.round(min / 6) / 10;
  return String(h).replace('.', '،');
}

/* خط عريض مزخرف (𝐀𝐁𝐂 𝟏𝟐𝟑) */
function schBold(str){
  return Array.from(String(str)).map(ch => {
    const c = ch.codePointAt(0);
    if(c >= 65 && c <= 90) return String.fromCodePoint(0x1D400 + c - 65);
    if(c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97);
    if(c >= 48 && c <= 57) return String.fromCodePoint(0x1D7CE + c - 48);
    return ch;
  }).join('');
}

/* نص الجدول للنسخ — بنفس الستايل */
function schShareText(room){
  const s = room.schedule;
  const th = SCH_THEMES[s.theme] || SCH_THEMES.saudi;
  const tl = schTimeline(room);
  const total = schTotalFocus(s);
  const lines = [];
  lines.push(schBold('Today’s Schedule') + ' ' + th.emoji);
  if(s.title) lines.push(s.title);
  lines.push(th.heart + ' ' + schBold('Total Focus Time: ') + schBold(schHours(total) + 'h'));
  lines.push('- ' + th.art);
  lines.push('〰️〰️〰️〰️〰️〰️');
  lines.push('');
  tl.forEach(p => {
    if(p.type === 'focus'){
      lines.push(`⊹ ࣪ ˖ ${schBold('Session ' + p.n)} ⊹ ࣪ ˖ ${schBold(schFmtClock(p.start))} – ${schBold(schFmtClock(p.end))} (${schBold(p.min + ' min')})`);
    } else {
      lines.push(`${th.heart} ${schBold('Break: ' + p.min + ' min')}`);
      lines.push('');
    }
  });
  lines.push('〰️〰️〰️〰️〰️〰️');
  if(s.quote){ lines.push(''); lines.push('"' + s.quote + '"'); }
  lines.push('');
  lines.push(th.heart + schBold('Finish: ' + schFmtClock(tl[tl.length - 1].end)) + ' ' + th.emoji);
  lines.push('');
  lines.push('📚 عباقرة القدرات — غرفة ' + room.code);
  return lines.join('\n');
}

window.schCopy = () => {
  if(!SR.room || !SR.room.schedule) return;
  const txt = schShareText(SR.room);
  try{ navigator.clipboard.writeText(txt); toast('✓ تم نسخ الجدول — الصقه في واتساب أو تويتر', 'ok'); }
  catch(e){ toast('تعذّر النسخ', 'err'); }
};
window.schShare = async () => {
  if(!SR.room || !SR.room.schedule) return;
  const txt = schShareText(SR.room);
  if(navigator.share){ try{ await navigator.share({ text: txt }); return; }catch(e){ return; } }
  window.schCopy();
};

/* ================== بطاقة الجدول داخل الغرفة ================== */
function schCardHTML(room){
  const s = room.schedule;
  const th = SCH_THEMES[s.theme] || SCH_THEMES.saudi;
  const tl = schTimeline(room);
  const cur = room.status === 'running' || room.status === 'paused' ? (room.phase_index || 0) : -1;
  const done = room.status === 'finished';
  const total = schTotalFocus(s);
  return `
    <div class="sch-card" style="--c1:${th.c1};--c2:${th.c2}">
      <div class="sch-cover" ${s.image_url ? `style="background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.55)),url('${escapeHtml(s.image_url)}')"` : ''}>
        ${s.image_url ? '' : `<div class="sch-art">${th.art}</div>`}
        <div class="sch-cover-txt">
          <small>${schBold('Today’s Schedule')} ${th.emoji}</small>
          <h3>${escapeHtml(s.title || 'جدول اليوم')}</h3>
          <div class="sch-total">${th.heart} مجموع التركيز: <b>${schHours(total)} ساعة</b> • ${schPhases(s).filter(p => p.type === 'focus').length} جلسات</div>
        </div>
      </div>
      <div class="sch-list">
        ${tl.map(p => {
          const state = done || (cur > -1 && p.i < cur) ? 'past' : p.i === cur ? 'now' : '';
          return p.type === 'focus'
            ? `<div class="sch-row focus ${state}">
                <span class="sch-dot">${state === 'past' ? '<i class="fas fa-check"></i>' : p.n}</span>
                <b>الجلسة ${p.n}</b>
                <span class="sch-time"><bdi>${schFmtClockAr(p.start)}</bdi> – <bdi>${schFmtClockAr(p.end)}</bdi></span>
                <small>${p.min} د</small>
                ${state === 'now' ? '<em class="sch-live">الآن</em>' : ''}
              </div>`
            : `<div class="sch-row brk ${state}"><span>${th.heart}</span> بريك ${p.min} دقائق ${state === 'now' ? '<em class="sch-live">الآن</em>' : ''}</div>`;
        }).join('')}
      </div>
      ${s.quote ? `<blockquote class="sch-quote">${escapeHtml(s.quote)}</blockquote>` : ''}
      <div class="sch-foot">
        <span>${th.heart} النهاية: <b><bdi>${schFmtClockAr(tl[tl.length - 1].end)}</bdi></b> ${th.emoji}</span>
        <div>
          <button class="btn btn-ghost btn-sm" onclick="schCopy()"><i class="fas fa-copy"></i> نسخ الجدول</button>
          ${navigator.share ? '<button class="btn btn-ghost btn-sm" onclick="schShare()"><i class="fas fa-share-nodes"></i></button>' : ''}
        </div>
      </div>
    </div>`;
}
window.schCardHTML = schCardHTML;

/* ================== منشئ الجدول ================== */
const SCHB = { theme: 'saudi', imageFile: null, imageUrl: null };

function srOpenScheduleBuilder(){
  if(typeof srCanUse === 'function' && !srCanUse()) return;
  if(SR.room){ toast('أنت داخل غرفة الآن', 'warn'); return; }
  let m = document.getElementById('schBuilder');
  if(!m){
    m = document.createElement('div');
    m.id = 'schBuilder';
    m.className = 'cart-overlay';
    m.addEventListener('click', e => { if(e.target === m) m.classList.remove('open'); });
    document.body.appendChild(m);
  }
  SCHB.imageFile = null; SCHB.imageUrl = null;
  const now = new Date(Date.now() + 10 * 60000);
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5);
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const q = SCH_QUOTES[Math.floor(Math.random() * SCH_QUOTES.length)];
  m.innerHTML = `
    <div class="cart-box sch-builder">
      <div class="cart-head">
        <b><i class="fas fa-calendar-days" style="color:var(--primary)"></i> إعداد جدول الغرفة</b>
        <button class="cart-x" onclick="document.getElementById('schBuilder').classList.remove('open')"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="schb-grid">
        <label>عنوان الجدول<input type="text" id="schTitle" maxlength="40" value="جدول اليوم"></label>
        <label>كم جلسة؟<input type="number" id="schSessions" min="1" max="12" value="5"></label>
        <label>مدة كل جلسة (دقيقة)<input type="number" id="schFocus" min="5" max="180" step="5" value="90"></label>
        <label>البريك بين الجلسات (دقيقة)<input type="number" id="schBrk" min="0" max="60" step="5" value="10"></label>
        <label class="schb-start">تبدأ
          <select id="schStartMode"><option value="manual">لما المضيف يضغط «ابدأ»</option><option value="time">في وقت محدد</option></select>
          <input type="time" id="schStartTime" value="${hhmm}" style="display:none">
        </label>
      </div>
      <div class="schb-sec">الثيم</div>
      <div class="schb-themes">
        ${Object.entries(SCH_THEMES).map(([k, t]) => `
          <button type="button" class="schb-theme ${k === SCHB.theme ? 'on' : ''}" data-k="${k}" style="--c1:${t.c1};--c2:${t.c2}">
            <span>${t.art}</span><b>${t.name}</b>
          </button>`).join('')}
      </div>
      <div class="schb-sec">العبارة <button type="button" class="schb-rand" id="schRandQ"><i class="fas fa-dice"></i> عبارة عشوائية</button></div>
      <textarea id="schQuote" maxlength="300" rows="3">${escapeHtml(q)}</textarea>
      <div class="schb-sec">الصورة <small>(اختياري — بدونها نستخدم رسمة الثيم)</small></div>
      <label class="schb-img" id="schImgLbl">
        <input type="file" id="schImg" accept="image/*" hidden>
        <i class="fas fa-image"></i> <span id="schImgName">اختر صورة للغلاف</span>
      </label>
      <div class="schb-sec">معاينة</div>
      <div id="schPreview"></div>
      <div class="sr-privacy" style="margin:10px 0">
        <label class="sr-priv-opt"><input type="radio" name="schPrivacy" value="private" checked><span><i class="fas fa-lock"></i> خاصة</span></label>
        <label class="sr-priv-opt"><input type="radio" name="schPrivacy" value="public"><span><i class="fas fa-globe"></i> عامة</span></label>
      </div>
      <button class="btn btn-primary cart-checkout" id="schCreateBtn"><i class="fas fa-door-open"></i> إنشاء الغرفة بالجدول</button>
    </div>`;
  m.classList.add('open');

  const upd = () => schbPreview();
  ['schTitle', 'schSessions', 'schFocus', 'schBrk', 'schQuote', 'schStartTime'].forEach(id => {
    const el = document.getElementById(id); if(el) el.addEventListener('input', upd);
  });
  document.getElementById('schStartMode').addEventListener('change', e => {
    document.getElementById('schStartTime').style.display = e.target.value === 'time' ? '' : 'none'; upd();
  });
  m.querySelectorAll('.schb-theme').forEach(b => b.addEventListener('click', () => {
    SCHB.theme = b.dataset.k;
    m.querySelectorAll('.schb-theme').forEach(x => x.classList.toggle('on', x === b));
    upd();
  }));
  document.getElementById('schRandQ').addEventListener('click', () => {
    document.getElementById('schQuote').value = SCH_QUOTES[Math.floor(Math.random() * SCH_QUOTES.length)]; upd();
  });
  document.getElementById('schImg').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    if(!/^image\//.test(f.type)){ toast('اختر صورة', 'warn'); return; }
    if(f.size > 8 * 1024 * 1024){ toast('الصورة كبيرة (8 ميجا كحد أقصى)', 'warn'); return; }
    SCHB.imageFile = f;
    if(SCHB.imageUrl) URL.revokeObjectURL(SCHB.imageUrl);
    SCHB.imageUrl = URL.createObjectURL(f);
    document.getElementById('schImgName').textContent = f.name;
    upd();
  });
  document.getElementById('schCreateBtn').addEventListener('click', schbCreate);
  upd();
}
window.srOpenScheduleBuilder = srOpenScheduleBuilder;

function schbRead(){
  const v = id => (document.getElementById(id) || {}).value;
  const s = {
    title: (v('schTitle') || '').trim().slice(0, 40),
    sessions: Math.max(1, Math.min(12, parseInt(v('schSessions'), 10) || 1)),
    focus: Math.max(5, Math.min(180, parseInt(v('schFocus'), 10) || 25)),
    brk: Math.max(0, Math.min(60, parseInt(v('schBrk'), 10) || 0)),
    theme: SCHB.theme,
    quote: (v('schQuote') || '').trim().slice(0, 300),
    start_at: null
  };
  if(v('schStartMode') === 'time' && v('schStartTime')){
    const [h, mi] = v('schStartTime').split(':').map(Number);
    const d = new Date(); d.setHours(h, mi, 0, 0);
    if(d.getTime() < Date.now() - 60000) d.setDate(d.getDate() + 1);   /* وقت فات → بكرة */
    s.start_at = d.toISOString();
  }
  return s;
}

function schbPreview(){
  const box = document.getElementById('schPreview');
  if(!box) return;
  const s = schbRead();
  s.image_url = SCHB.imageUrl;
  box.innerHTML = schCardHTML({ schedule: s, status: 'waiting', phase_index: 0, code: '------' })
    .replace(/<div class="sch-foot">[\s\S]*$/, '</div>');
}

/* ضغط الصورة قبل الرفع (خفيفة على الموقع) */
function schCompress(file, max, q){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', q || 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
window.schCompress = schCompress;

async function schbCreate(){
  const btn = document.getElementById('schCreateBtn');
  if(btn.disabled) return;
  const s = schbRead();
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
  try{
    if(SCHB.imageFile){
      try{
        const blob = await schCompress(SCHB.imageFile, 1200, 0.8);
        const path = currentUserObj.id + '/rooms/' + Date.now() + '.jpg';
        const { error } = await sb.storage.from('community').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if(!error){ const { data } = sb.storage.from('community').getPublicUrl(path); s.image_url = data ? data.publicUrl : null; }
        else toast('تعذّر رفع الصورة — بنكمل بدونها', 'warn');
      }catch(e){ toast('تعذّر تجهيز الصورة — بنكمل بدونها', 'warn'); }
    }
    const priv = document.querySelector('input[name="schPrivacy"]:checked');
    await srCreateRoom({ schedule: s, isPublic: priv && priv.value === 'public' });
    if(SR.room) document.getElementById('schBuilder').classList.remove('open');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-door-open"></i> إنشاء الغرفة بالجدول';
  }
}
