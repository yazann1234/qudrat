/* ============================================================
   45) STUDY MODE — وضع المذاكرة (فيديو مصغّر + ملف + سبورة)
   داخل مشغل الفيديو:
   - الفيديو يصغر لنافذة عائمة: تتحرك بالسحب، تكبر/تصغر من الزاوية،
     أحجام جاهزة (S/M/L) وزر «طيّ» يخليه شريط صغير والصوت شغال
   - الملف والسبورة ياخذون الشاشة كاملة جنب بعض
   - فاصل بينهم تسحبه لتكبير الملف أو السبورة
   - الفيديو ما يعيد التحميل (نفس المشغل، فقط يتغير مكانه)
   وفي قارئ الملفات: فاصل لتكبير/تصغير السبورة البيضاء
============================================================ */

const SM = {
  on: false,
  collapsed: false,
  size: 'm',
  ratio: 0.5,          /* نسبة الملف من المساحة */
  vwbWasOpen: false
};
const SM_SIZES = { s: 260, m: 360, l: 520 };
const SM_KEY = 'abq_study_mode';

function smLoad(){
  try{ Object.assign(SM, JSON.parse(localStorage.getItem(SM_KEY) || '{}'), { on: false }); }catch(e){}
}
function smSave(){
  try{
    const pane = document.getElementById('vpVideoPane');
    localStorage.setItem(SM_KEY, JSON.stringify({
      size: SM.size, ratio: SM.ratio, collapsed: SM.collapsed,
      left: pane ? pane.style.left : '', top: pane ? pane.style.top : ''
    }));
  }catch(e){}
}
function smSaved(){ try{ return JSON.parse(localStorage.getItem(SM_KEY) || '{}'); }catch(e){ return {}; } }

/* ================== بناء العناصر مرة واحدة ================== */
function smBuild(){
  const pane = document.getElementById('vpVideoPane');
  const main = document.querySelector('#videoPlayer .vp-main');
  if(!pane || !main) return false;

  if(!document.getElementById('vpMiniBar')){
    const bar = document.createElement('div');
    bar.className = 'vp-mini-bar';
    bar.id = 'vpMiniBar';
    bar.innerHTML = `
      <i class="fas fa-grip-vertical"></i>
      <b><i class="fas fa-play-circle"></i> الفيديو</b>
      <div class="vp-mini-sizes">
        <button data-sz="s" title="صغير">S</button>
        <button data-sz="m" title="متوسط">M</button>
        <button data-sz="l" title="كبير">L</button>
      </div>
      <button class="vp-mini-btn" id="vpMiniCollapse" title="طيّ الفيديو (الصوت يستمر)"><i class="fas fa-window-minimize"></i></button>
      <button class="vp-mini-btn" id="vpMiniExpand" title="تكبير الفيديو (إنهاء وضع المذاكرة)"><i class="fas fa-expand"></i></button>`;
    pane.insertBefore(bar, pane.firstChild);
    bar.querySelectorAll('[data-sz]').forEach(b => b.addEventListener('click', () => smSetSize(b.dataset.sz)));
    bar.querySelector('#vpMiniCollapse').addEventListener('click', () => smCollapse(!SM.collapsed));
    bar.querySelector('#vpMiniExpand').addEventListener('click', () => smToggle(false));
    smBindDrag(bar);

    const grip = document.createElement('div');
    grip.className = 'vp-mini-resize';
    grip.id = 'vpMiniResize';
    grip.title = 'اسحب لتغيير الحجم';
    grip.innerHTML = '<i class="fas fa-up-right-and-down-left-from-center"></i>';
    pane.appendChild(grip);
    smBindResize(grip);
  }

  if(!document.getElementById('vpStudyDivider')){
    const div = document.createElement('div');
    div.className = 'vp-study-divider';
    div.id = 'vpStudyDivider';
    div.title = 'اسحب لتكبير الملف أو السبورة';
    div.innerHTML = '<span></span>';
    main.appendChild(div);
    smBindDivider(div);

    const dock = document.createElement('div');
    dock.className = 'vp-study-dock';
    dock.id = 'vpStudyDock';
    main.appendChild(dock);
  }
  return true;
}

/* ================== تشغيل / إيقاف ================== */
async function smToggle(force){
  const want = typeof force === 'boolean' ? force : !SM.on;
  const vp = document.getElementById('videoPlayer');
  if(!vp || !smBuild()) return;
  if(want === SM.on) return;
  SM.on = want;
  const btn = document.getElementById('vpStudyBtn'); if(btn) btn.classList.toggle('on', want);
  const pane = document.getElementById('vpVideoPane');

  if(want){
    vp.classList.add('vp-study');
    /* السبورة تنتقل للمساحة الكبيرة */
    SM.vwbWasOpen = typeof VWB !== 'undefined' && VWB.open;
    if(typeof vwbToggle === 'function') await vwbToggle(true);
    const dock = document.getElementById('vpStudyDock');
    if(typeof VWB !== 'undefined' && VWB.panel && dock){
      VWB.panel.classList.add('docked');
      dock.appendChild(VWB.panel);
    }
    /* حجم ومكان الفيديو المصغّر */
    const saved = smSaved();
    smSetSize(SM.size || 'm', true);
    if(saved.left && saved.top){ pane.style.left = saved.left; pane.style.top = saved.top; }
    else smPlaceDefault();
    smCollapse(!!SM.collapsed, true);
    smApplyRatio();
    smClamp();
    if(!(typeof VP !== 'undefined' && VP.linkedFileId)){
      toast('📄 افتح ملف من زر «ملف» عشان يطلع جنب السبورة', 'ok');
    }
  } else {
    vp.classList.remove('vp-study', 'vp-mini-collapsed', 'vp-has-file');
    ['left', 'top', 'width', 'height'].forEach(k => pane.style[k] = '');
    /* السبورة ترجع عائمة كما كانت */
    const box = document.querySelector('#videoPlayer .vp-box');
    if(typeof VWB !== 'undefined' && VWB.panel && box){
      VWB.panel.classList.remove('docked');
      box.appendChild(VWB.panel);
      if(!SM.vwbWasOpen && typeof vwbToggle === 'function') vwbToggle(false);
      else if(typeof vwbClamp === 'function'){ vwbClamp(); }
    }
    const fp = document.getElementById('vpFilePane'); if(fp) fp.style.flex = '';
  }
  setTimeout(() => {
    smRelayoutFile();
    try{ if(typeof vwbRedraw === 'function') vwbRedraw(); }catch(e){}
  }, 60);
  smSave();
}
window.smToggle = smToggle;

function smPlaceDefault(){
  const pane = document.getElementById('vpVideoPane');
  const box = document.querySelector('#videoPlayer .vp-box');
  if(!pane || !box) return;
  const r = box.getBoundingClientRect();
  pane.style.left = '14px';
  pane.style.top = Math.max(70, r.height - pane.offsetHeight - 16) + 'px';
}

function smSetSize(sz, silent){
  const pane = document.getElementById('vpVideoPane');
  const box = document.querySelector('#videoPlayer .vp-box');
  if(!pane || !box) return;
  SM.size = sz;
  const r = box.getBoundingClientRect();
  const w = Math.min(SM_SIZES[sz] || SM_SIZES.m, r.width - 24);
  pane.style.width = w + 'px';
  pane.style.height = Math.round(w * 9 / 16 + 34 + 52) + 'px';   /* الشريط + الفيديو + أزرار التحكم */
  document.querySelectorAll('.vp-mini-sizes button').forEach(b => b.classList.toggle('on', b.dataset.sz === sz));
  if(SM.collapsed && !silent) smCollapse(false, true);
  smClamp();
  if(!silent) smSave();
}

function smCollapse(on, silent){
  SM.collapsed = !!on;
  const vp = document.getElementById('videoPlayer');
  if(vp) vp.classList.toggle('vp-mini-collapsed', SM.collapsed);
  const b = document.getElementById('vpMiniCollapse');
  if(b){
    b.innerHTML = SM.collapsed ? '<i class="fas fa-window-restore"></i>' : '<i class="fas fa-window-minimize"></i>';
    b.title = SM.collapsed ? 'إظهار الفيديو' : 'طيّ الفيديو (الصوت يستمر)';
  }
  smClamp();
  if(!silent) smSave();
}

function smClamp(){
  const pane = document.getElementById('vpVideoPane');
  const box = document.querySelector('#videoPlayer .vp-box');
  if(!SM.on || !pane || !box) return;
  const r = box.getBoundingClientRect();
  const w = pane.offsetWidth, h = pane.offsetHeight;
  let left = parseFloat(pane.style.left) || 0, top = parseFloat(pane.style.top) || 0;
  left = Math.min(Math.max(0, left), Math.max(0, r.width - w));
  top = Math.min(Math.max(0, top), Math.max(0, r.height - h));
  pane.style.left = left + 'px'; pane.style.top = top + 'px';
}

/* ================== سحب / تغيير الحجم ================== */
function smBindDrag(handle){
  let sx = 0, sy = 0, ox = 0, oy = 0, on = false, moved = false;
  handle.addEventListener('pointerdown', e => {
    if(!SM.on || e.target.closest('button')) return;
    const pane = document.getElementById('vpVideoPane');
    on = true; moved = false;
    sx = e.clientX; sy = e.clientY;
    ox = parseFloat(pane.style.left) || 0; oy = parseFloat(pane.style.top) || 0;
    try{ handle.setPointerCapture(e.pointerId); }catch(x){}
    document.getElementById('videoPlayer').classList.add('vp-dragging');
  });
  handle.addEventListener('pointermove', e => {
    if(!on) return;
    const pane = document.getElementById('vpVideoPane');
    if(Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
    pane.style.left = (ox + e.clientX - sx) + 'px';
    pane.style.top = (oy + e.clientY - sy) + 'px';
    smClamp();
  });
  const end = () => {
    if(!on) return;
    on = false;
    document.getElementById('videoPlayer').classList.remove('vp-dragging');
    if(moved) smSave();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  /* ضغطتين على الشريط = طيّ/إظهار */
  handle.addEventListener('dblclick', e => { if(SM.on && !e.target.closest('button')) smCollapse(!SM.collapsed); });
}

function smBindResize(grip){
  let sx = 0, ow = 0, on = false;
  grip.addEventListener('pointerdown', e => {
    if(!SM.on) return;
    e.preventDefault(); e.stopPropagation();
    const pane = document.getElementById('vpVideoPane');
    on = true; sx = e.clientX; ow = pane.offsetWidth;
    try{ grip.setPointerCapture(e.pointerId); }catch(x){}
    document.getElementById('videoPlayer').classList.add('vp-dragging');
    document.querySelectorAll('.vp-mini-sizes button').forEach(b => b.classList.remove('on'));
  });
  grip.addEventListener('pointermove', e => {
    if(!on) return;
    const pane = document.getElementById('vpVideoPane');
    const box = document.querySelector('#videoPlayer .vp-box').getBoundingClientRect();
    /* الزاوية يسار-تحت: السحب لليسار يكبّر (واجهة عربية) */
    const left = parseFloat(pane.style.left) || 0;
    let w = ow + (sx - e.clientX);
    w = Math.max(220, Math.min(w, box.width - 10));
    const newLeft = left + (pane.offsetWidth - w);
    pane.style.width = w + 'px';
    pane.style.height = Math.round(w * 9 / 16 + 34 + 52) + 'px';
    pane.style.left = Math.max(0, newLeft) + 'px';
  });
  const end = () => {
    if(!on) return;
    on = false;
    document.getElementById('videoPlayer').classList.remove('vp-dragging');
    smClamp(); smSave();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

/* ================== الفاصل بين الملف والسبورة ================== */
function smApplyRatio(){
  const fp = document.getElementById('vpFilePane');
  if(!fp) return;
  const vp = document.getElementById('videoPlayer');
  if(vp) vp.classList.toggle('vp-has-file', fp.style.display !== 'none');
  const r = Math.max(0.2, Math.min(0.8, SM.ratio || 0.5));
  fp.style.flex = SM.on ? `0 0 ${Math.round(r * 1000) / 10}%` : '';
}

function smBindDivider(div){
  let on = false, rect = null, vertical = false;
  div.addEventListener('pointerdown', e => {
    if(!SM.on) return;
    e.preventDefault();
    on = true;
    const main = document.querySelector('#videoPlayer .vp-main');
    rect = main.getBoundingClientRect();
    vertical = getComputedStyle(main).flexDirection === 'column';
    try{ div.setPointerCapture(e.pointerId); }catch(x){}
    document.getElementById('videoPlayer').classList.add('vp-dragging');
  });
  div.addEventListener('pointermove', e => {
    if(!on) return;
    /* الملف على اليمين (RTL): نسبته = المسافة من اليمين */
    SM.ratio = vertical
      ? (e.clientY - rect.top) / rect.height
      : (rect.right - e.clientX) / rect.width;
    smApplyRatio();
    try{ if(typeof vwbRedraw === 'function') vwbRedraw(); }catch(x){}
  });
  const end = () => {
    if(!on) return;
    on = false;
    document.getElementById('videoPlayer').classList.remove('vp-dragging');
    smSave();
    smRelayoutFile();
  };
  div.addEventListener('pointerup', end);
  div.addEventListener('pointercancel', end);
  div.addEventListener('dblclick', () => { SM.ratio = 0.5; smApplyRatio(); smRelayoutFile(); smSave(); });
}

/* إعادة رسم صفحات الملف بعرض المساحة الجديدة (يملى العرض) */
function smRelayoutFile(){
  if(typeof VP === 'undefined' || !VP.linkedFileDoc || !VP.linkedFilePages || !VP.linkedFilePages.length) return;
  const body = document.getElementById('vpFileBody');
  const scroll = document.getElementById('vpFileScroll');
  const stage = document.getElementById('vpFileStage');
  if(!body || !stage || body.clientWidth < 50) return;
  const first = VP.linkedFilePages[0];
  const ratio = (parseFloat(first.style.height) || 1) / Math.max(1, parseFloat(first.style.width) || 1);
  const avail = body.clientWidth - 24;
  const newBase = Math.max(180, Math.min(SM.on ? 1100 : 560, avail));
  if(Math.abs(newBase - VP.linkedFileBaseWidth) < 6) return;

  /* نحافظ على مكان القراءة */
  const pct = scroll ? scroll.scrollTop / Math.max(1, scroll.scrollHeight) : 0;
  VP.linkedFileBaseWidth = newBase;
  const w = Math.round(newBase * (VP.linkedFileZoom || 1));
  const h = Math.round(w * ratio);
  stage.style.width = w + 'px';
  VP.linkedFilePages.forEach(el => {
    el.style.width = w + 'px'; el.style.height = h + 'px';
    if(el.dataset.done === '1'){ el.dataset.done = '0'; const inner = el.querySelector('.pg-inner'); if(inner) inner.innerHTML = ''; }
  });
  if(scroll) scroll.scrollTop = pct * scroll.scrollHeight;
  /* نرسم الصفحات الظاهرة */
  const st = scroll ? scroll.scrollTop : 0;
  const vh = scroll ? scroll.clientHeight : 800;
  VP.linkedFilePages.forEach((el, i) => {
    if(el.offsetTop + h > st - 400 && el.offsetTop < st + vh + 400 && typeof renderLinkedPage === 'function') renderLinkedPage(i + 1);
  });
}

/* ================== الربط بالمشغل ================== */
document.addEventListener('DOMContentLoaded', () => {
  smLoad();
  const tools = document.querySelector('#videoPlayer .rh-tools');
  if(tools && !document.getElementById('vpStudyBtn')){
    const b = document.createElement('button');
    b.className = 'rh-btn vp-study-btn';
    b.id = 'vpStudyBtn';
    b.title = 'وضع المذاكرة: فيديو مصغّر + ملف + سبورة';
    b.innerHTML = '<i class="fas fa-person-chalkboard"></i> <span class="vp-tool-label">وضع المذاكرة</span>';
    b.addEventListener('click', () => smToggle());
    tools.insertBefore(b, tools.firstChild);
  }

  /* إغلاق المشغل → نطلع من وضع المذاكرة */
  const vp = document.getElementById('videoPlayer');
  if(vp) new MutationObserver(() => {
    if(SM.on && !vp.classList.contains('open')) smToggle(false);
  }).observe(vp, { attributes: true, attributeFilter: ['class'] });

  /* فتح/إغلاق ملف أثناء الوضع → نحدّث النسب */
  const fp = document.getElementById('vpFilePane');
  if(fp) new MutationObserver(() => {
    if(!SM.on) return;
    smApplyRatio();
    setTimeout(() => { smRelayoutFile(); try{ vwbRedraw(); }catch(e){} }, 80);
  }).observe(fp, { attributes: true, attributeFilter: ['style'] });

  window.addEventListener('resize', debounce(() => {
    if(!SM.on) return;
    smClamp(); smRelayoutFile();
    try{ vwbRedraw(); }catch(e){}
  }, 200));

  /* Esc يطلع من وضع المذاكرة قبل إغلاق المشغل */
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && SM.on){ e.stopImmediatePropagation(); smToggle(false); }
  }, true);

  rdWbBindDivider();
});

/* ============================================================
   📐 قارئ الملفات: فاصل لتكبير/تصغير السبورة البيضاء
============================================================ */
function rdWbBindDivider(){
  const panel = document.getElementById('wbPanel');
  if(!panel || document.getElementById('wbDivider')) return;
  const div = document.createElement('div');
  div.className = 'wb-divider';
  div.id = 'wbDivider';
  div.title = 'اسحب لتكبير السبورة أو الملف (ضغطتين = النص)';
  div.innerHTML = '<span></span>';
  panel.appendChild(div);

  let saved = 0;
  try{ saved = parseFloat(localStorage.getItem('abq_wb_width')) || 0; }catch(e){}
  const apply = pct => {
    pct = Math.max(25, Math.min(75, pct));
    panel.style.setProperty('--wb-w', pct + '%');
    return pct;
  };
  if(saved) apply(saved);

  let on = false, rect = null, pct = saved || 44;
  div.addEventListener('pointerdown', e => {
    if(!panel.classList.contains('open')) return;
    e.preventDefault();
    on = true;
    rect = panel.parentNode.getBoundingClientRect();
    try{ div.setPointerCapture(e.pointerId); }catch(x){}
    panel.classList.add('resizing');
  });
  div.addEventListener('pointermove', e => {
    if(!on) return;
    /* السبورة على اليسار (RTL): عرضها = المسافة من اليسار */
    pct = apply(((e.clientX - rect.left) / rect.width) * 100);
  });
  const end = () => {
    if(!on) return;
    on = false;
    panel.classList.remove('resizing');
    try{ localStorage.setItem('abq_wb_width', String(pct)); }catch(e){}
    try{ window.dispatchEvent(new Event('resize')); }catch(e){}
  };
  div.addEventListener('pointerup', end);
  div.addEventListener('pointercancel', end);
  div.addEventListener('dblclick', () => {
    pct = apply(50);
    try{ localStorage.setItem('abq_wb_width', '50'); }catch(e){}
    try{ window.dispatchEvent(new Event('resize')); }catch(e){}
  });
}
