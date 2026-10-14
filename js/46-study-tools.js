/* ============================================================
   46) STUDY TOOLS — أدوات مذاكرة للطلاب
   🚩 دفتر المراجعة: علّم أي صفحة فيها سؤال صعب/غلطت فيه + ملاحظة،
      وارجع لها بضغطة من الرئيسية (مع «راجع سؤال عشوائي»)
   ⏱️ مؤقت الأسئلة: يحسب وقتك لكل سؤال داخل الملف ويعطيك المعدل
      (القدرات ≈ دقيقة لكل سؤال) — أخضر/برتقالي/أحمر حسب سرعتك
============================================================ */

const REVIEW_TAGS = {
  hard:  { label: 'سؤال صعب',   icon: 'fa-brain',          color: '#8b5cf6' },
  wrong: { label: 'أخطأت فيه',  icon: 'fa-circle-xmark',   color: '#ef4444' },
  idea:  { label: 'فكرة مهمة',  icon: 'fa-lightbulb',      color: '#f59e0b' },
  later: { label: 'أرجع له',    icon: 'fa-clock-rotate-left', color: '#3b82f6' }
};

function reviewList(){
  if(!userData) return [];
  if(!Array.isArray(userData.reviewList)) userData.reviewList = [];
  return userData.reviewList;
}

function reviewFind(fileId, page){
  return reviewList().find(r => r.fileId === fileId && r.page === page);
}

/* ================== إضافة صفحة للدفتر ================== */
function reviewAddCurrent(){
  if(typeof RS === 'undefined' || !RS.file || !RS.current){ toast('افتح ملفاً أولاً', 'warn'); return; }
  const fileId = RS.file.id, page = RS.current, title = RS.file.title;
  const ex = reviewFind(fileId, page);
  const tag0 = ex ? ex.tag : 'hard';
  openModal({
    title: ex ? 'تعديل في دفتر المراجعة' : 'أضف لدفتر المراجعة',
    text: `«${escapeHtml(title)}» — صفحة ${page}`,
    bodyHTML: `
      <div class="rv-tags" id="rvTags">
        ${Object.entries(REVIEW_TAGS).map(([k, t]) => `
          <button type="button" class="rv-tag ${k === tag0 ? 'on' : ''}" data-tag="${k}" style="--tc:${t.color}">
            <i class="fas ${t.icon}"></i> ${t.label}
          </button>`).join('')}
      </div>
      <textarea id="rvNote" maxlength="300" placeholder="ملاحظة (اختياري): مثلاً رقم السؤال أو وين كان خطأك..." class="rv-note">${escapeHtml(ex ? ex.note || '' : '')}</textarea>
      ${ex ? `<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);margin-top:8px" onclick="reviewRemove('${ex.id}', true)"><i class="fas fa-trash"></i> إزالة من الدفتر</button>` : ''}
    `,
    okText: ex ? 'حفظ' : 'أضف للدفتر 🚩',
    onOk: () => {
      const on = document.querySelector('#rvTags .rv-tag.on');
      const tag = on ? on.dataset.tag : 'hard';
      const note = ((document.getElementById('rvNote') || {}).value || '').trim();
      if(ex){ ex.tag = tag; ex.note = note; ex.at = Date.now(); }
      else {
        const list = reviewList();
        list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fileId, fileTitle: title, page, tag, note, at: Date.now(), done: false });
        if(list.length > 300) list.length = 300;
      }
      savePrefs();
      reviewRefreshUI();
      toast(ex ? '✓ تم التعديل' : '🚩 أُضيفت لدفتر المراجعة', 'ok');
    }
  });
  setTimeout(() => {
    document.querySelectorAll('#rvTags .rv-tag').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#rvTags .rv-tag').forEach(x => x.classList.toggle('on', x === b));
    }));
  }, 30);
}
window.reviewAddCurrent = reviewAddCurrent;

window.reviewRemove = (id, fromModal) => {
  userData.reviewList = reviewList().filter(r => r.id !== id);
  savePrefs();
  if(fromModal){ const m = document.getElementById('modal'); if(m) m.classList.remove('open'); }
  reviewRefreshUI();
  renderReviewBook();
};

window.reviewToggleDone = id => {
  const r = reviewList().find(x => x.id === id);
  if(!r) return;
  r.done = !r.done;
  savePrefs();
  reviewRefreshUI();
  renderReviewBook();
  if(r.done) toast('👏 ممتاز! راجعتها', 'ok');
};

/* فتح الصفحة المعلّمة */
window.reviewOpen = id => {
  const r = reviewList().find(x => x.id === id);
  if(!r) return;
  const f = (DB.files || []).find(x => x.id === r.fileId);
  if(!f){ toast('هذا الملف لم يعد متاحاً', 'warn'); return; }
  closeReviewBook();
  if(typeof RS !== 'undefined' && RS.file && RS.file.id === r.fileId && typeof scrollToPage === 'function'){
    scrollToPage(r.page, true);
    return;
  }
  window._openAtPage = r.page;
  openFile(r.fileId);
};

window.reviewRandom = () => {
  const pending = reviewList().filter(r => !r.done && (DB.files || []).some(f => f.id === r.fileId));
  if(!pending.length){ toast('ما عندك صفحات للمراجعة حالياً 🎉', 'ok'); return; }
  const r = pending[Math.floor(Math.random() * pending.length)];
  toast(`🎲 راجع: ${r.fileTitle} — صفحة ${r.page}`, 'ok');
  window.reviewOpen(r.id);
};

/* ================== نافذة الدفتر ================== */
let _rvFilter = 'pending';

function openReviewBook(){
  let m = document.getElementById('reviewBook');
  if(!m){
    m = document.createElement('div');
    m.id = 'reviewBook';
    m.className = 'cart-overlay rv-overlay';
    m.addEventListener('click', e => { if(e.target === m) closeReviewBook(); });
    document.body.appendChild(m);
  }
  m.classList.add('open');
  renderReviewBook();
}
window.openReviewBook = openReviewBook;

function closeReviewBook(){
  const m = document.getElementById('reviewBook');
  if(m) m.classList.remove('open');
}
window.closeReviewBook = closeReviewBook;

window.reviewFilter = f => { _rvFilter = f; renderReviewBook(); };

function renderReviewBook(){
  const m = document.getElementById('reviewBook');
  if(!m || !m.classList.contains('open')) return;
  const all = reviewList();
  const pendingN = all.filter(r => !r.done).length;
  let list = all;
  if(_rvFilter === 'pending') list = all.filter(r => !r.done);
  else if(_rvFilter === 'done') list = all.filter(r => r.done);
  else if(REVIEW_TAGS[_rvFilter]) list = all.filter(r => r.tag === _rvFilter);

  const chip = (k, label) => `<button class="rv-chip ${_rvFilter === k ? 'on' : ''}" onclick="reviewFilter('${k}')">${label}</button>`;
  m.innerHTML = `
    <div class="cart-box rv-box">
      <div class="cart-head">
        <b><i class="fas fa-flag" style="color:#ef4444"></i> دفتر المراجعة <small>(${pendingN} للمراجعة)</small></b>
        <button class="cart-x" onclick="closeReviewBook()"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="rv-hint"><i class="fas fa-lightbulb"></i> داخل أي ملف اضغط <b><i class="fas fa-flag"></i></b> لتعليم الصفحة اللي فيها سؤال صعب أو غلطت فيه — وارجع لها هنا قبل الاختبار.</div>
      <div class="rv-chips">
        ${chip('pending', 'للمراجعة')}${chip('all', 'الكل')}${chip('done', 'تمت ✓')}
        ${Object.entries(REVIEW_TAGS).map(([k, t]) => chip(k, `<i class="fas ${t.icon}" style="color:${t.color}"></i> ${t.label}`)).join('')}
      </div>
      ${pendingN ? '<button class="btn btn-primary rv-random" onclick="reviewRandom()"><i class="fas fa-dice"></i> راجع سؤال عشوائي</button>' : ''}
      <div class="rv-list">
        ${!list.length ? `<div class="cart-empty"><i class="fas fa-flag"></i><b>${all.length ? 'لا يوجد شيء هنا' : 'الدفتر فاضي'}</b><small>علّم الصفحات المهمة من داخل الملفات</small></div>` :
          list.map(r => {
            const t = REVIEW_TAGS[r.tag] || REVIEW_TAGS.hard;
            const exists = (DB.files || []).some(f => f.id === r.fileId);
            return `
            <div class="rv-item ${r.done ? 'done' : ''}" style="--tc:${t.color}">
              <button class="rv-check" onclick="reviewToggleDone('${r.id}')" title="${r.done ? 'إرجاع للمراجعة' : 'تمت مراجعتها'}"><i class="fas ${r.done ? 'fa-check' : 'fa-circle'}"></i></button>
              <div class="rv-info" onclick="reviewOpen('${r.id}')">
                <b>${escapeHtml(r.fileTitle || 'ملف')} <span>صفحة ${r.page}</span></b>
                <small><i class="fas ${t.icon}"></i> ${t.label} • ${new Date(r.at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' })}${exists ? '' : ' • <span style="color:var(--danger)">الملف غير متاح</span>'}</small>
                ${r.note ? `<p>${escapeHtml(r.note)}</p>` : ''}
              </div>
              <div class="rv-acts">
                ${exists ? `<button onclick="reviewOpen('${r.id}')" title="افتح الصفحة"><i class="fas fa-arrow-up-left-from-circle"></i></button>` : ''}
                <button onclick="reviewRemove('${r.id}')" title="حذف" class="del"><i class="fas fa-trash-can"></i></button>
              </div>
            </div>`;
          }).join('')}
      </div>
    </div>`;
}

/* تحديث زر العلم في القارئ + بطاقة الرئيسية */
function reviewRefreshUI(){
  const btn = document.getElementById('rdReviewBtn');
  if(btn && typeof RS !== 'undefined' && RS.file){
    const on = !!reviewFind(RS.file.id, RS.current);
    btn.classList.toggle('on', on);
    btn.innerHTML = `<i class="${on ? 'fas' : 'far'} fa-flag"></i>`;
    btn.title = on ? 'الصفحة في دفتر المراجعة (اضغط للتعديل)' : 'أضف الصفحة لدفتر المراجعة 🚩';
  }
  const card = document.getElementById('homeReviewCard');
  if(card){
    const n = reviewList().filter(r => !r.done).length;
    const total = reviewList().length;
    card.innerHTML = `
      <div class="hrc-ic"><i class="fas fa-flag"></i></div>
      <div class="hrc-info">
        <b>دفتر المراجعة</b>
        <small>${total ? `${n} صفحة تنتظر مراجعتك من ${total}` : 'علّم الأسئلة الصعبة داخل الملفات بعلامة 🚩 وراجعها هنا'}</small>
      </div>
      ${n ? '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();reviewRandom()"><i class="fas fa-dice"></i> عشوائي</button>' : ''}
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openReviewBook()">افتح</button>`;
  }
}
window.reviewRefreshUI = reviewRefreshUI;

/* ============================================================
   ⏱️ مؤقت الأسئلة داخل القارئ
============================================================ */
const QT = { on: false, running: false, start: 0, acc: 0, laps: [], tick: null };
const QT_TARGET = 60;   /* ثانية لكل سؤال (معدل القدرات تقريباً) */

function qtElapsed(){ return QT.acc + (QT.running ? (Date.now() - QT.start) / 1000 : 0); }
function qtFmt(s){ s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function qtToggle(force){
  const want = typeof force === 'boolean' ? force : !QT.on;
  if(want === QT.on) return;
  const body = document.querySelector('#reader .reader-body') || document.getElementById('rdBody');
  let el = document.getElementById('qtWidget');
  if(want){
    if(!el){
      el = document.createElement('div');
      el.id = 'qtWidget';
      el.className = 'qt-widget';
      (document.querySelector('#reader .reader-main') || document.body).appendChild(el);
    }
    Object.assign(QT, { on: true, running: true, start: Date.now(), acc: 0, laps: [] });
    el.style.display = 'flex';
    clearInterval(QT.tick);
    QT.tick = setInterval(qtRender, 250);
    qtRender();
    toast('⏱️ بدأ المؤقت — اضغط «التالي» بعد كل سؤال', 'ok');
  } else {
    clearInterval(QT.tick);
    if(QT.laps.length){
      const avg = QT.laps.reduce((a, b) => a + b, 0) / QT.laps.length;
      toast(`⏱️ حليت ${QT.laps.length} سؤال بمعدل ${Math.round(avg)} ثانية للسؤال ${avg <= QT_TARGET ? '— سرعة ممتازة 🔥' : '— حاول تسرّع شوي 💪'}`, avg <= QT_TARGET ? 'ok' : 'warn');
      try{
        const hist = JSON.parse(localStorage.getItem('abq_qt_hist') || '[]');
        hist.unshift({ at: Date.now(), n: QT.laps.length, avg: Math.round(avg), file: RS && RS.file ? RS.file.title : '' });
        localStorage.setItem('abq_qt_hist', JSON.stringify(hist.slice(0, 30)));
      }catch(e){}
    }
    QT.on = false; QT.running = false;
    if(el) el.style.display = 'none';
  }
  const b = document.getElementById('rdQtBtn'); if(b) b.classList.toggle('on', QT.on);
}
window.qtToggle = qtToggle;

window.qtLap = () => {
  if(!QT.on) return;
  const t = qtElapsed();
  if(t < 2) return;
  QT.laps.push(t);
  QT.acc = 0; QT.start = Date.now(); QT.running = true;
  qtRender();
  const el = document.getElementById('qtWidget');
  if(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
};

window.qtPause = () => {
  if(!QT.on) return;
  if(QT.running){ QT.acc = qtElapsed(); QT.running = false; }
  else { QT.start = Date.now(); QT.running = true; }
  qtRender();
};

function qtRender(){
  const el = document.getElementById('qtWidget');
  if(!el || !QT.on) return;
  const t = qtElapsed();
  const lvl = t <= QT_TARGET ? 'ok' : t <= QT_TARGET * 1.5 ? 'mid' : 'bad';
  const avg = QT.laps.length ? Math.round(QT.laps.reduce((a, b) => a + b, 0) / QT.laps.length) : null;
  const html = `
    <div class="qt-time ${lvl}"><i class="fas fa-stopwatch"></i> <b>${qtFmt(t)}</b></div>
    <div class="qt-stats"><span>سؤال ${QT.laps.length + 1}</span>${avg !== null ? `<span>المعدل ${avg}ث</span>` : ''}</div>
    <button class="qt-btn" onclick="qtPause()" title="${QT.running ? 'إيقاف مؤقت' : 'استئناف'}"><i class="fas ${QT.running ? 'fa-pause' : 'fa-play'}"></i></button>
    <button class="qt-btn next" onclick="qtLap()" title="السؤال التالي"><i class="fas fa-forward-step"></i> التالي</button>
    <button class="qt-btn" onclick="qtToggle(false)" title="إنهاء"><i class="fas fa-xmark"></i></button>`;
  if(el._last !== html){ el.innerHTML = html; el._last = html; }
}

/* ================== الربط ================== */
document.addEventListener('DOMContentLoaded', () => {
  const tools = document.querySelector('#reader .rh-tools');
  if(tools){
    const ref = document.getElementById('rdBookmark');
    if(!document.getElementById('rdReviewBtn')){
      const b = document.createElement('button');
      b.className = 'rh-btn'; b.id = 'rdReviewBtn';
      b.title = 'أضف الصفحة لدفتر المراجعة 🚩';
      b.innerHTML = '<i class="far fa-flag"></i>';
      b.addEventListener('click', reviewAddCurrent);
      tools.insertBefore(b, ref ? ref.nextSibling : null);
    }
    if(!document.getElementById('rdQtBtn')){
      const q = document.createElement('button');
      q.className = 'rh-btn'; q.id = 'rdQtBtn';
      q.title = 'مؤقت الأسئلة ⏱️';
      q.innerHTML = '<i class="fas fa-stopwatch"></i>';
      q.addEventListener('click', () => qtToggle());
      tools.insertBefore(q, document.getElementById('rdReviewBtn').nextSibling);
    }
  }

  /* بطاقة الرئيسية */
  const anchor = document.getElementById('examCountdownCard');
  if(anchor && !document.getElementById('homeReviewCard')){
    const card = document.createElement('div');
    card.id = 'homeReviewCard';
    card.className = 'home-review-card';
    card.addEventListener('click', openReviewBook);
    anchor.parentNode.insertBefore(card, anchor.nextSibling);
  }

  /* إغلاق القارئ → نوقف المؤقت */
  const reader = document.getElementById('reader');
  if(reader) new MutationObserver(() => {
    if(!reader.classList.contains('open') && QT.on) qtToggle(false);
  }).observe(reader, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ const m = document.getElementById('reviewBook'); if(m && m.classList.contains('open')) closeReviewBook(); }
  });

  /* تحديث زر العلم مع تغيّر الصفحة + البطاقة بعد الدخول */
  let lastKey = '';
  setInterval(() => {
    const k = (typeof RS !== 'undefined' && RS.file ? RS.file.id + ':' + RS.current : '') + '|' + (userData ? reviewList().length : 0);
    if(k !== lastKey){ lastKey = k; reviewRefreshUI(); }
  }, 700);
});
