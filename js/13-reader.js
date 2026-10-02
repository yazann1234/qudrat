/* ============================================================
   13) READER v2 — قارئ PDF سريع وخفيف
   - عرض متزامن (2 صفحات بالتوازي) مع أولوية للصفحة الحالية
   - تحرير ذاكرة الـ canvas فعلياً للصفحات البعيدة
   - جودة تتكيف مع الجهاز (موبايل / ضعيف) وحد أقصى للبكسلات
   - تكبير بالقرص (Pinch) + Ctrl+Wheel
   - مزامنة تقدم مخففة (تناسب آلاف المستخدمين)
   - تجديد الرابط الموقّع تلقائياً إذا انتهى
   - تغطية الصفحات (blur) عند مغادرة النافذة
============================================================ */

const RS = {
  doc:null, file:null, numPages:0,
  pageW:612, pageH:792,
  zoom:1, baseWidth:800, token:0, current:1,
  rendered:new Set(), inView:new Set(),
  pageEls:[], offsets:[], observer:null, restoring:false, clockId:null,
  signedUrl:null, signedAt:0,
  renderQueue:new Map(), pendingQueue:[], active:0,
  fastScrolling:false, fastScrollTimer:null,
  watermarkEmail:''
};

const MAX_PARALLEL = 2;
const MAX_CANVAS_PIXELS = 12e6;          // آمن لـ iOS / أجهزة ضعيفة
const KEEP_RADIUS = 8;                   // صفحات تبقى مرسومة حول الحالية
const SYNC_DELAY = 5000;                 // مزامنة التقدم كل 5 ثوان كحد أقصى

let currentFile = null;
const rdBody = document.getElementById('rdBody');

const pageWidth  = () => Math.round(RS.baseWidth * RS.zoom);
const pageHeight = () => Math.round(RS.pageH * (pageWidth() / RS.pageW));

function showLoading(txt, pct){
  const l = document.getElementById('rdLoading'); if(!l) return;
  l.style.display = 'flex';
  const t = document.getElementById('rdLoadingTxt'); if(t && txt) t.textContent = txt;
  if(typeof pct === 'number'){
    const b = document.getElementById('rdLoadingBar');
    if(b) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
}
function hideLoading(){
  const l = document.getElementById('rdLoading'); if(l) l.style.display = 'none';
}

/* ---------- رابط موقّع (مع تجديد) ---------- */
async function getSignedUrl(path, force){
  if(!force && RS.signedUrl && Date.now() - RS.signedAt < 40 * 60 * 1000) return RS.signedUrl;
  const { data, error } = await sb.storage.from('pdfs').createSignedUrl(path, 3600);
  if(error || !data || !data.signedUrl) throw new Error(error ? error.message : 'تعذّر إنشاء رابط الملف');
  RS.signedUrl = data.signedUrl; RS.signedAt = Date.now();
  return RS.signedUrl;
}

/* ============================================================
   فتح ملف
============================================================ */
async function openFile(id){
  if(!currentUserObj) return;
  if(!isSubscribed()){ showLockMessage(); return; }
  const f = DB.files.find(x => x.id === id);
  if(!f) return;

  currentFile = f; RS.file = f;
  RS.watermarkEmail = currentUserObj.email || '';

  userData.opened = [id, ...userData.opened.filter(x => x !== id)].slice(0, 14);
  savePrefs();

  const color = f.color || '#5b6cff';
  const iconEl = document.getElementById('rdIcon');
  if(iconEl){
    iconEl.innerHTML = `<i class="fas ${f.icon || 'fa-file-pdf'}" style="color:${color}"></i>`;
    iconEl.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
  }
  const titleEl = document.getElementById('rdTitle'); if(titleEl) titleEl.textContent = f.title;
  const metaEl = document.getElementById('rdMeta');
  if(metaEl) metaEl.textContent = `PDF • ${f.category}${f.important ? ' • مهم' : ''}`;

  updateFavBtn(); updateBookmarkBtn();

  const readerEl = document.getElementById('reader');
  if(readerEl){ readerEl.classList.remove('closing'); readerEl.classList.add('open'); }
  document.body.style.overflow = 'hidden';

  applyReaderTheme(); applySnapClass();
  RS.token++; const token = RS.token;
  teardownReader(false);

  showLoading('جاري تجهيز القارئ...', 15);
  const stage = document.getElementById('rdStage'); if(stage) stage.innerHTML = '';
  computeBaseWidth();
  RS.zoom = parseFloat(userData.defaultZoom) || 1;
  updateZoomLabel();

  try{
    const url = await getSignedUrl(f.storage_path, true);
    if(token !== RS.token) return;
    showLoading('جاري تحميل الملف...', 35);

    const loadingTask = pdfjsLib.getDocument({
      url,
      rangeChunkSize: 1048576,
      disableAutoFetch: true,          // لا يحمّل الملف كله مقدماً → أخف على الخادم
      disableStream: false,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      isEvalSupported: false,          // أمان
      enableXfa: false,
      verbosity: 0
    });
    loadingTask.onProgress = p => {
      if(p && p.total) showLoading('جاري تحميل الملف...', 35 + Math.round(p.loaded / p.total * 55));
    };
    const doc = await loadingTask.promise;

    if(token !== RS.token){ try{ doc.destroy(); }catch(e){} return; }
    RS.doc = doc; RS.numPages = doc.numPages;

    const p1 = await doc.getPage(1);
    const vp0 = p1.getViewport({ scale: 1 });
    RS.pageW = vp0.width || 612; RS.pageH = vp0.height || 792;
    try{ p1.cleanup(); }catch(e){}

    if(f.page_count !== RS.numPages) f.page_count = RS.numPages;
    if(metaEl) metaEl.textContent = `PDF • ${f.category} • ${RS.numPages} صفحة${f.important ? ' • مهم' : ''}`;
    const pt = document.getElementById('rdPagesTotal'); if(pt) pt.textContent = RS.numPages;
    const pi = document.getElementById('rdPageInput'); if(pi) pi.max = RS.numPages;

    buildPages();
    hideLoading();

    const prog = userData.progress[id];
    let startPage = 1;
    if(userData.autoResume && prog && typeof prog === 'object'){
      startPage = prog.bookmark || prog.lastPage || 1;
    }
    startPage = Math.max(1, Math.min(startPage, RS.numPages));
    RS.current = startPage;
    if(pi) pi.value = startPage;
    renderThumbs();

    if(startPage > 1){
      RS.restoring = true;
      scrollToPage(startPage, false);
      setTimeout(() => { RS.restoring = false; }, 400);
    }
    updateReaderUI();

    requestAnimationFrame(() => {
      requestRender(startPage); requestRender(startPage + 1); requestRender(startPage - 1);
    });

    if(!userData.badges.includes('first')){
      userData.badges.push('first'); savePrefs();
      setTimeout(() => toast('حصلت على شارة «البداية الموفقة»', 'ok'), 600);
      renderBadges();
    }

    startReadClock();
    refreshAll();

    if(typeof loadDrawingsForFile === 'function'){
      loadDrawingsForFile(f.id).then(() => {
        if(typeof redrawVisiblePdfDrawings === 'function') redrawVisiblePdfDrawings();
      }).catch(()=>{});
    }
  }catch(err){
    if(token !== RS.token) return;
    console.error(err);
    hideLoading();
    if(stage) stage.innerHTML = `<div class="pdf-loading" style="position:relative;display:flex">
      <i class="fas fa-circle-exclamation" style="color:var(--danger)"></i>
      <p>تعذّر تحميل الملف</p>
      <small style="color:var(--muted);font-size:.78rem">${escapeHtml(err.message || 'خطأ غير معروف')}</small>
      <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openFile('${escapeHtml(String(id))}')">
        <i class="fas fa-rotate"></i> إعادة المحاولة
      </button></div>`;
    toast('تعذّر تحميل الملف', 'err');
  }
}
window.openFile = openFile;

/* ============================================================
   teardown
============================================================ */
function teardownReader(closeUI){
  try{ if(RS.observer){ RS.observer.disconnect(); RS.observer = null; } }catch(e){}
  RS.renderQueue.forEach(t => { try{ t.cancel(); }catch(e){} });
  RS.renderQueue.clear();
  RS.pendingQueue = []; RS.active = 0;
  RS.rendered.clear(); RS.inView.clear();
  RS.pageEls = []; RS.offsets = [];
  _lastCurrentClass = 0;
  stopReadClock();
  if(closeUI){
    try{ if(RS.doc) RS.doc.destroy(); }catch(e){}
    RS.doc = null; RS.file = null; RS.numPages = 0; currentFile = null;
    RS.signedUrl = null;
  }
}

/* ============================================================
   بناء الصفحات
============================================================ */
function buildPages(){
  const stage = document.getElementById('rdStage'); if(!stage) return;
  stage.innerHTML = ''; RS.pageEls = [];
  const w = pageWidth(), h = pageHeight();
  stage.style.width = w + 'px';

  const wm = escapeHtml(RS.watermarkEmail);
  const frag = document.createDocumentFragment();
  for(let i = 0; i < RS.numPages; i++){
    const el = document.createElement('div');
    el.className = 'pdf-page';
    el.dataset.page = String(i + 1);
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.innerHTML = `<div class="pg-num">صفحة ${i+1} / ${RS.numPages}</div><div class="pg-inner"></div><div class="pg-diag-wm">${wm}</div><div class="pg-wm">العباقرة للقدرات © محتوى محمي</div>`;
    frag.appendChild(el);
    RS.pageEls.push(el);
  }
  stage.appendChild(frag);

  RS.observer = new IntersectionObserver(entries => {
    for(const en of entries){
      const idx = parseInt(en.target.dataset.page, 10);
      if(en.isIntersecting){ RS.inView.add(idx); requestRender(idx); }
      else RS.inView.delete(idx);
    }
  }, { root: rdBody, rootMargin: '600px 0px', threshold: 0 });

  RS.pageEls.forEach(el => RS.observer.observe(el));
  computeOffsets();
  applyMarksVisibility();
}

function computeOffsets(){
  RS.offsets = RS.pageEls.map(el => el.offsetTop);
}

/* ============================================================
   طابور العرض — بالتوازي مع أولوية القرب
============================================================ */
function requestRender(num){
  if(!RS.doc || num < 1 || num > RS.numPages) return;
  const holder = RS.pageEls[num - 1];
  if(!holder || holder.dataset.done === '1') return;
  if(RS.renderQueue.has(num) || RS.pendingQueue.includes(num)) return;
  RS.pendingQueue.push(num);
  pumpQueue();
}

function pumpQueue(){
  while(RS.active < MAX_PARALLEL && RS.pendingQueue.length && RS.doc){
    RS.pendingQueue.sort((a, b) => Math.abs(a - RS.current) - Math.abs(b - RS.current));
    const num = RS.pendingQueue.shift();
    RS.active++;
    renderPageNow(num).finally(() => { RS.active = Math.max(0, RS.active - 1); pumpQueue(); });
  }
}

function renderPageNow(num){
  const holder = RS.pageEls[num - 1];
  if(!holder || holder.dataset.done === '1' || !RS.doc) return Promise.resolve();

  return (async () => {
    const token = RS.token;
    let page;
    try{
      page = await RS.doc.getPage(num);
      if(token !== RS.token || holder.dataset.done === '1') return;

      const cssW = pageWidth(), cssH = pageHeight();
      const scale = cssW / RS.pageW;

      let dprCap = 1.6;
      if(RS.numPages > 300) dprCap = 1.0;
      else if(RS.numPages > 150) dprCap = 1.15;
      else if(RS.numPages > 60) dprCap = 1.35;
      if(navigator.deviceMemory && navigator.deviceMemory <= 2) dprCap = Math.min(dprCap, 1.1);
      let dpr = Math.min(window.devicePixelRatio || 1, dprCap);

      /* حد أقصى للبكسلات */
      const px = cssW * cssH * dpr * dpr;
      if(px > MAX_CANVAS_PIXELS) dpr *= Math.sqrt(MAX_CANVAS_PIXELS / px);

      const vp = page.getViewport({ scale: scale * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));
      canvas.style.width = '100%'; canvas.style.height = '100%';
      const ctx = canvas.getContext('2d', { alpha: false });

      const task = page.render({ canvasContext: ctx, viewport: vp });
      RS.renderQueue.set(num, task);
      await task.promise;
      RS.renderQueue.delete(num);
      if(token !== RS.token){ canvas.width = canvas.height = 0; return; }

      const inner = holder.querySelector('.pg-inner');
      if(inner){ inner.replaceChildren(canvas); }
      holder.dataset.done = '1';
      RS.rendered.add(num);
      holder.classList.add('ready');
      if(typeof redrawVisiblePdfDrawings === 'function' && RS.inView.has(num)){
        try{ redrawVisiblePdfDrawings(); }catch(e){}
      }
    }catch(e){
      RS.renderQueue.delete(num);
      if(e && (e.name === 'RenderingCancelledException' || /cancel|destroy/i.test(e.message || ''))) return;
      console.warn('render error', num);
    }finally{
      try{ if(page) page.cleanup(); }catch(e){}
    }
  })();
}

function cancelRender(num){
  const task = RS.renderQueue.get(num);
  if(task){ try{ task.cancel(); }catch(e){} RS.renderQueue.delete(num); }
  const i = RS.pendingQueue.indexOf(num);
  if(i > -1) RS.pendingQueue.splice(i, 1);
}

/* تحرير الذاكرة للصفحات البعيدة (يصفّر الـ canvas فعلاً) */
function cleanupFarPages(){
  if(!RS.file) return;
  const cur = RS.current;
  RS.rendered.forEach(n => {
    if(Math.abs(n - cur) <= KEEP_RADIUS || RS.inView.has(n)) return;
    const el = RS.pageEls[n - 1]; if(!el) return;
    const c = el.querySelector('canvas:not(.pg-draw)');
    if(c){ c.width = 0; c.height = 0; }
    const inner = el.querySelector('.pg-inner'); if(inner) inner.replaceChildren();
    el.dataset.done = '0'; el.classList.remove('ready');
    RS.rendered.delete(n);
  });
}

function rebuildPageSizes(){
  const w = pageWidth(), h = pageHeight();
  RS.renderQueue.forEach(t => { try{ t.cancel(); }catch(e){} });
  RS.renderQueue.clear(); RS.pendingQueue = []; RS.active = 0;

  RS.pageEls.forEach((el, i) => {
    el.style.width = w + 'px'; el.style.height = h + 'px';
    if(el.dataset.done === '1'){
      const c = el.querySelector('canvas:not(.pg-draw)'); if(c){ c.width = 0; c.height = 0; }
      const inner = el.querySelector('.pg-inner'); if(inner) inner.replaceChildren();
      el.dataset.done = '0'; el.classList.remove('ready');
      RS.rendered.delete(i + 1);
    }
  });
  const stage = document.getElementById('rdStage'); if(stage) stage.style.width = w + 'px';
  computeOffsets();
  RS.inView.forEach(n => requestRender(n));
  if(typeof redrawVisiblePdfDrawings === 'function') redrawVisiblePdfDrawings();
}

/* ============================================================
   التنقل
============================================================ */
function scrollToPage(num, smooth){
  num = Math.max(1, Math.min(num, RS.numPages || 1));
  const el = RS.pageEls[num - 1]; if(!el) return;
  const top = el.offsetTop - 8;
  try{ rdBody.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }); }
  catch(e){ rdBody.scrollTop = top; }

  RS.current = num;
  const pi = document.getElementById('rdPageInput'); if(pi) pi.value = num;
  updateReaderUI(); highlightThumb(num);
  requestRender(num); requestRender(num + 1); requestRender(num - 1);
}

function pageFromScroll(){
  const st = rdBody.scrollTop + rdBody.clientHeight * 0.35;
  const offs = RS.offsets.length === RS.pageEls.length ? RS.offsets : RS.pageEls.map(e => e.offsetTop);
  let lo = 0, hi = offs.length - 1, page = 1;
  while(lo <= hi){                       // بحث ثنائي بدل حلقة كاملة
    const mid = (lo + hi) >> 1;
    if(offs[mid] <= st){ page = mid + 1; lo = mid + 1; } else hi = mid - 1;
  }
  return page;
}

function updateReaderUI(){
  if(!RS.file || !RS.numPages) return;
  const pct = Math.max(getPct(RS.file.id), Math.round((RS.current / RS.numPages) * 100));
  const pctTxt = document.getElementById('rdPctTxt'); if(pctTxt) pctTxt.textContent = pct + '%';
  const pageInfo = document.getElementById('rdPageInfo'); if(pageInfo) pageInfo.textContent = `الصفحة ${RS.current} من ${RS.numPages}`;
  const barTop = document.getElementById('rdBarTop'); if(barTop) barTop.style.width = pct + '%';

  const btn = document.getElementById('rdComplete');
  if(btn){
    const done = pct >= 100;
    btn.innerHTML = done ? '<i class="fas fa-circle-check"></i> أُنجز الملف' : '<i class="fas fa-check"></i> أنهيت الملف';
    btn.classList.toggle('achieved', done);
  }
  const fab = document.getElementById('rdTop');
  if(fab) fab.classList.toggle('show', rdBody.scrollTop > 400);
  updateCurrentClass(RS.current);
}

let _lastCurrentClass = 0;
function updateCurrentClass(n){
  if(_lastCurrentClass === n) return;
  if(_lastCurrentClass){ const p = RS.pageEls[_lastCurrentClass - 1]; if(p) p.classList.remove('current'); }
  const c = RS.pageEls[n - 1]; if(c) c.classList.add('current');
  _lastCurrentClass = n;
}

/* ============================================================
   Scroll — يعمل فقط عند تغيّر الصفحة
============================================================ */
let scrollScheduled = false, lastScrollY = 0, cleanupTimer = null;

rdBody.addEventListener('scroll', () => {
  if(!RS.doc) return;
  const y = rdBody.scrollTop;
  if(Math.abs(y - lastScrollY) > 500){
    RS.fastScrolling = true;
    clearTimeout(RS.fastScrollTimer);
    RS.fastScrollTimer = setTimeout(() => { RS.fastScrolling = false; }, 200);
  }
  lastScrollY = y;
  if(scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => { scrollScheduled = false; handleScroll(); });
}, { passive: true });

function handleScroll(){
  if(!RS.doc || !RS.file || !RS.numPages) return;
  const fab = document.getElementById('rdTop');
  if(fab) fab.classList.toggle('show', rdBody.scrollTop > 400);

  const page = pageFromScroll();
  if(page === RS.current) return;

  RS.current = page;
  const pi = document.getElementById('rdPageInput'); if(pi) pi.value = page;
  highlightThumb(page); updateCurrentClass(page);
  requestRender(page + 1); requestRender(page - 1);

  const id = RS.file.id;
  const oldPct = getPct(id), oldMax = getMaxPage(id);
  const newPct = Math.max(oldPct, Math.round((page / RS.numPages) * 100));
  const newMax = Math.max(oldMax, page);
  const prev = (userData.progress[id] && typeof userData.progress[id] === 'object') ? userData.progress[id] : {};
  userData.progress[id] = Object.assign({}, prev, { pct:newPct, maxPage:newMax, lastPage:page, at:Date.now() });

  if(newMax > oldMax) addPagesToday(newMax - oldMax); else savePrefs();
  scheduleProgressSync(id, newPct, newMax, page);

  const pctTxt = document.getElementById('rdPctTxt'); if(pctTxt) pctTxt.textContent = newPct + '%';
  const barTop = document.getElementById('rdBarTop'); if(barTop) barTop.style.width = newPct + '%';
  const pageInfo = document.getElementById('rdPageInfo'); if(pageInfo) pageInfo.textContent = `الصفحة ${page} من ${RS.numPages}`;

  if(newPct >= 100 && oldPct < 100) toast('أكملت الملف بالكامل!', 'ok');
  checkBadges();

  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => { if(!RS.restoring && !RS.fastScrolling) cleanupFarPages(); }, 400);
}

/* ============================================================
   مزامنة التقدم
============================================================ */
let progressSyncTimer = null, progressSyncQueue = {};

function scheduleProgressSync(fileId, pct, maxPage, lastPage){
  progressSyncQueue[fileId] = { pct, max_page: maxPage, last_page: lastPage };
  clearTimeout(progressSyncTimer);
  progressSyncTimer = setTimeout(flushProgressSync, SYNC_DELAY);
}

async function flushProgressSync(){
  clearTimeout(progressSyncTimer);
  if(!currentUserObj || currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
  const keys = Object.keys(progressSyncQueue);
  if(!keys.length) return;
  const snapshot = progressSyncQueue; progressSyncQueue = {};
  const now = new Date().toISOString();
  const rows = keys.map(fid => ({
    user_id: currentUserObj.id, file_id: fid,
    pct: snapshot[fid].pct, max_page: snapshot[fid].max_page, last_page: snapshot[fid].last_page,
    updated_at: now
  }));
  try{
    const { error } = await sb.from('user_progress').upsert(rows, { onConflict: 'user_id,file_id' });
    if(error) throw error;
    if(typeof syncMyXp === 'function') syncMyXp();
  }catch(e){
    keys.forEach(k => { if(!progressSyncQueue[k]) progressSyncQueue[k] = snapshot[k]; }); // أعد المحاولة لاحقاً
    progressSyncTimer = setTimeout(flushProgressSync, 15000);
  }
}
window.addEventListener('pagehide', () => { try{ savePrefs(); flushProgressSync(); }catch(e){} });
window.addEventListener('online', () => { flushProgressSync(); });

/* ============================================================
   أزرار القارئ
============================================================ */
function updateFavBtn(){
  const b = document.getElementById('rdFav'); if(!b || !RS.file) return;
  const on = userData.favs.includes(RS.file.id);
  b.classList.toggle('on', on);
  b.innerHTML = `<i class="${on ? 'fas' : 'far'} fa-star"></i>`;
}
function updateBookmarkBtn(){
  const b = document.getElementById('rdBookmark'); if(!b || !RS.file) return;
  const p = userData.progress[RS.file.id];
  const has = p && typeof p === 'object' && p.bookmark;
  b.classList.toggle('on', !!has);
  b.innerHTML = `<i class="${has ? 'fas' : 'far'} fa-bookmark"></i>`;
}
function applyReaderTheme(){
  const body = document.getElementById('rdBody'); if(!body) return;
  body.classList.remove('read-light','read-sepia','read-dark');
  body.classList.add('read-' + (userData.readTheme || 'light'));
  applyMarksVisibility();
}
function applySnapClass(){
  const body = document.getElementById('rdBody'); if(!body) return;
  body.classList.toggle('snap', !!userData.snap);
  const btn = document.getElementById('rdSnap');
  if(btn) btn.innerHTML = `<i class="fas fa-scroll"></i> <span>${userData.snap ? 'صفحة واحدة' : 'مستمر'}</span>`;
}
function applyMarksVisibility(){
  const body = document.getElementById('rdBody'); if(!body) return;
  body.classList.toggle('hide-marks', !userData.showMarks);
}

function renderThumbs(){
  const box = document.getElementById('rdThumbs'); if(!box) return;
  if(!RS.numPages){ box.innerHTML = ''; return; }
  const parts = new Array(RS.numPages);
  for(let i = 1; i <= RS.numPages; i++){
    parts[i-1] = `<button class="thumb-btn${i === RS.current ? ' on' : ''}" data-p="${i}"><i class="fas fa-file-lines"></i> صفحة ${i}</button>`;
  }
  box.innerHTML = parts.join('');
  if(!box.dataset.bound){
    box.dataset.bound = '1';
    box.addEventListener('click', e => {
      const btn = e.target.closest('.thumb-btn'); if(!btn) return;
      scrollToPage(parseInt(btn.dataset.p, 10), true);
      if(window.innerWidth <= 720) box.classList.remove('open');
    });
  }
}
function highlightThumb(n){
  const box = document.getElementById('rdThumbs'); if(!box) return;
  const prev = box.querySelector('.thumb-btn.on'); if(prev) prev.classList.remove('on');
  const next = box.querySelector(`.thumb-btn[data-p="${n}"]`);
  if(next){
    next.classList.add('on');
    if(box.classList.contains('open')){
      const r = next.getBoundingClientRect(), br = box.getBoundingClientRect();
      if(r.top < br.top || r.bottom > br.bottom) next.scrollIntoView({ block:'nearest', behavior:'auto' });
    }
  }
}

function startReadClock(){
  stopReadClock();
  RS.clockId = setInterval(() => {
    if(document.hidden) return;
    const r = document.getElementById('reader');
    if(!r || !r.classList.contains('open')) return;
    addMinutesToday(0.5);
  }, 30000);
}
function stopReadClock(){ if(RS.clockId){ clearInterval(RS.clockId); RS.clockId = null; } }

document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    try{ savePrefs(); flushProgressSync(); if(typeof saveDrawings === 'function') saveDrawings(); }catch(e){}
  }
  /* تغطية المحتوى عند مغادرة التبويب (يصعّب تصوير الشاشة) */
  const r = document.getElementById('reader');
  if(r) r.classList.toggle('blurred', document.hidden);
});
window.addEventListener('blur', () => { const r = document.getElementById('reader'); if(r && r.classList.contains('open')) r.classList.add('blurred'); });
window.addEventListener('focus', () => { const r = document.getElementById('reader'); if(r) r.classList.remove('blurred'); });

/* ============================================================
   إغلاق
============================================================ */
function closeReader(){
  const r = document.getElementById('reader');
  if(!r || !r.classList.contains('open') || r.classList.contains('closing')) return;
  r.classList.add('closing');

  try{
    if(typeof DRAW !== 'undefined'){ DRAW.active = false; DRAW.wb = false; DRAW.drawing = false; DRAW.current = null; }
    if(typeof saveDrawings === 'function') saveDrawings();
    document.getElementById('drawBar')?.classList.remove('on');
    document.getElementById('wbPanel')?.classList.remove('open');
    document.getElementById('rdDraw')?.classList.remove('on');
    document.getElementById('rdWb')?.classList.remove('on');
    rdBody.classList.remove('draw-on');
  }catch(e){}

  RS.token++;
  const id = RS.file ? RS.file.id : null, page = RS.current;
  if(id && page){
    const prev = (userData.progress[id] && typeof userData.progress[id] === 'object') ? userData.progress[id] : {};
    userData.progress[id] = Object.assign({}, prev, { lastPage: page, at: Date.now() });
    scheduleProgressSync(id, getPct(id), Math.max(getMaxPage(id), page), page);
    savePrefs(); flushProgressSync();
  }

  teardownReader(true);
  hideLoading();

  setTimeout(() => {
    r.classList.remove('open', 'closing', 'blurred');
    document.body.style.overflow = '';
    const stage = document.getElementById('rdStage'); if(stage) stage.replaceChildren();
    const thumbs = document.getElementById('rdThumbs'); if(thumbs){ thumbs.innerHTML = ''; thumbs.classList.remove('open'); }
    document.getElementById('rdThumbsBtn')?.classList.remove('on');
    renderFiles(); renderBadges(); renderRecent(); updateSidebar(); checkBadges();
  }, 260);
}
window.closeReader = closeReader;

/* ============================================================
   الأحداث
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  $('rdClose')?.addEventListener('click', closeReader);
  $('reader')?.addEventListener('click', e => { if(e.target.id === 'reader') closeReader(); });
  $('rdPrev')?.addEventListener('click', () => scrollToPage(RS.current - 1, true));
  $('rdNext')?.addEventListener('click', () => scrollToPage(RS.current + 1, true));
  $('rdPageInput')?.addEventListener('change', e => {
    const v = parseInt(e.target.value, 10); if(!isNaN(v)) scrollToPage(v, true);
  });
  $('rdZoomIn')?.addEventListener('click', () => setZoom(RS.zoom + 0.15));
  $('rdZoomOut')?.addEventListener('click', () => setZoom(RS.zoom - 0.15));
  $('rdFit')?.addEventListener('click', () => setZoom(1));
  $('rdTop')?.addEventListener('click', () => { if(RS.numPages) rdBody.scrollTo({ top:0, behavior:'smooth' }); });

  $('rdSnap')?.addEventListener('click', () => {
    userData.snap = !userData.snap; savePrefs(); applySnapClass();
    if(typeof syncSettingsUI === 'function') syncSettingsUI();
    toast(userData.snap ? 'وضع الصفحة الواحدة' : 'وضع التمرير المستمر', 'ok');
  });

  const tb = $('rdThumbsBtn');
  tb?.addEventListener('click', () => {
    const box = $('rdThumbs'); if(!box) return;
    box.classList.toggle('open');
    tb.classList.toggle('on', box.classList.contains('open'));
    if(box.classList.contains('open')) highlightThumb(RS.current);
  });

  $('rdFav')?.addEventListener('click', () => {
    if(!RS.file) return;
    const i = userData.favs.indexOf(RS.file.id);
    if(i > -1) userData.favs.splice(i, 1); else userData.favs.push(RS.file.id);
    savePrefs(); updateFavBtn();
    toast(i > -1 ? 'أُزيل من المفضلة' : 'أُضيف إلى المفضلة', 'ok');
  });

  $('rdBookmark')?.addEventListener('click', () => {
    if(!RS.file) return;
    const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
    if(prev.bookmark){ delete prev.bookmark; toast('تم حذف العلامة', 'warn'); }
    else { prev.bookmark = RS.current; toast(`علامة عند الصفحة ${RS.current}`, 'ok'); }
    userData.progress[RS.file.id] = prev; savePrefs(); updateBookmarkBtn();
  });

  $('rdRestart')?.addEventListener('click', () => { if(RS.numPages) scrollToPage(1, true); });

  $('rdComplete')?.addEventListener('click', () => {
    if(!RS.file) return;
    const total = RS.numPages || RS.file.page_count || 1;
    const oldPct = getPct(RS.file.id), oldMax = getMaxPage(RS.file.id);
    const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
    userData.progress[RS.file.id] = Object.assign({}, prev, { pct:100, maxPage:total, lastPage:total, at:Date.now() });
    if(total > oldMax) addPagesToday(total - oldMax); else savePrefs();
    scheduleProgressSync(RS.file.id, 100, total, total);
    RS.current = total;
    updateReaderUI(); refreshAll(); checkBadges(); renderBadges();
    if(oldPct < 100) toast('رائع! أنهيت الملف بالكامل', 'ok');
  });

  /* Ctrl + عجلة الماوس = تكبير */
  rdBody.addEventListener('wheel', e => {
    if(!e.ctrlKey) return;
    e.preventDefault();
    setZoom(RS.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive:false });

  /* قرص الإصبعين (Pinch) على الجوال */
  let pinchStart = 0, pinchZoom = 1, pinching = false;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  rdBody.addEventListener('touchstart', e => {
    if(e.touches.length === 2){ pinching = true; pinchStart = dist(e.touches); pinchZoom = RS.zoom; }
  }, { passive:true });
  rdBody.addEventListener('touchmove', e => {
    if(pinching && e.touches.length === 2){
      e.preventDefault();
      const z = Math.max(0.5, Math.min(3, pinchZoom * dist(e.touches) / pinchStart));
      const stage = $('rdStage');
      if(stage) stage.style.transform = `scale(${(z / RS.zoom).toFixed(3)})`, stage.style.transformOrigin = 'top center';
      rdBody._pz = z;
    }
  }, { passive:false });
  rdBody.addEventListener('touchend', e => {
    if(pinching && e.touches.length < 2){
      pinching = false;
      const stage = $('rdStage'); if(stage) stage.style.transform = '';
      if(rdBody._pz){ setZoom(rdBody._pz); rdBody._pz = 0; }
    }
  }, { passive:true });
});

/* ============================================================
   Zoom (مع debounce لإعادة الرسم)
============================================================ */
let zoomTimer = null;
function setZoom(z){
  if(!RS.numPages) return;
  z = Math.max(0.4, Math.min(3, Math.round(z * 100) / 100));
  if(z === RS.zoom){ updateZoomLabel(); return; }
  const cur = RS.current;
  RS.zoom = z;
  updateZoomLabel();
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => { rebuildPageSizes(); scrollToPage(cur, false); }, 120);
}
function updateZoomLabel(){
  const el = document.getElementById('rdZoomVal'); if(el) el.textContent = Math.round(RS.zoom * 100) + '%';
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  const r = document.getElementById('reader');
  if(!r || !r.classList.contains('open') || !RS.numPages) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const cur = RS.current;
    computeBaseWidth(); rebuildPageSizes(); scrollToPage(cur, false); updateZoomLabel();
  }, 250);
});

function computeBaseWidth(){
  RS.baseWidth = Math.max(220, Math.min(980, rdBody.clientWidth - 30));
}
