/* ============================================================
   13) READER — قارئ PDF فائق السرعة
============================================================ */

const RS = {
  doc:null, file:null, numPages:0,
  pageW: 612, pageH: 792,
  zoom:1, baseWidth:800, token:0, current:1,
  rendered:new Set(), inView:new Set(),
  pageEls:[], observer:null, restoring:false, clockId:null,
  signedUrl: null,
  renderQueue: new Map(),
  pendingQueue: [],
  isProcessing: false,
  fastScrolling: false,
  fastScrollTimer: null,
  scrollRAF: null,
  watermarkEmail: ''
};

let currentFile = null;
const rdBody = document.getElementById('rdBody');

function pageWidth(){ return Math.round(RS.baseWidth * RS.zoom); }
function pageHeight(){ return Math.round(RS.pageH * (pageWidth() / RS.pageW)); }

function showLoading(txt, pct){
  const l = document.getElementById('rdLoading');
  if(!l) return;
  l.style.display = 'flex';
  const t = document.getElementById('rdLoadingTxt');
  if(t && txt) t.textContent = txt;
  if(typeof pct === 'number'){
    const b = document.getElementById('rdLoadingBar');
    if(b) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
}
function hideLoading(){
  const l = document.getElementById('rdLoading');
  if(l) l.style.display = 'none';
}

async function openFile(id){
  if(!currentUserObj) return;
  if(!isSubscribed()){ showLockMessage(); return; }
  const f = DB.files.find(x => x.id === id);
  if(!f) return;

  currentFile = f; RS.file = f;

  /* ⭐ العلامة المائية: رقم الجوال بدل الإيميل */
  RS.watermarkEmail = currentUserObj.phone || currentUserObj.email || '';

  userData.opened = [id, ...userData.opened.filter(x => x !== id)].slice(0, 14);
  savePrefs();

  const icon = f.icon || 'fa-file-pdf';
  const color = f.color || '#5b6cff';
  const iconEl = document.getElementById('rdIcon');
  if(iconEl){
    iconEl.innerHTML = `<i class="fas ${icon}" style="color:${color}"></i>`;
    iconEl.style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
  }
  const titleEl = document.getElementById('rdTitle'); if(titleEl) titleEl.textContent = f.title;
  const metaEl = document.getElementById('rdMeta'); if(metaEl) metaEl.textContent = `PDF • ${f.category}${f.important ? ' • مهم' : ''}`;

  updateFavBtn(); updateBookmarkBtn();

  const readerEl = document.getElementById('reader');
  if(readerEl) readerEl.classList.add('open');
  document.body.style.overflow = 'hidden';

  applyReaderTheme(); applySnapClass();
  RS.token++; const token = RS.token;
  teardownReader(false);

  showLoading('جاري تجهيز القارئ...', 15);
  const stage = document.getElementById('rdStage');
  if(stage) stage.innerHTML = '';
  RS.baseWidth = Math.max(220, Math.min(980, rdBody.clientWidth - 30));

  try{
    const { data: signed, error: sErr } = await sb.storage
      .from('pdfs')
      .createSignedUrl(f.storage_path, 3600);
    if(sErr || !signed || !signed.signedUrl){
      throw new Error(sErr ? sErr.message : 'تعذّر إنشاء رابط الملف');
    }
    if(token !== RS.token) return;
    RS.signedUrl = signed.signedUrl;
    showLoading('جاري تجهيز القارئ...', 35);

    const doc = await pdfjsLib.getDocument({
      url: signed.signedUrl,
      disableAutoFetch: false,
      disableStream: false,
      rangeChunkSize: 1048576,
      disableRange: false,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
      verbosity: 0,
      stopAtErrors: false
    }).promise;

    if(token !== RS.token){ try{doc.destroy();}catch(e){} return; }
    RS.doc = doc; RS.numPages = doc.numPages;

    const p1 = await doc.getPage(1);
    const vp0 = p1.getViewport({ scale: 1 });
    RS.pageW = vp0.width || 612;
    RS.pageH = vp0.height || 792;
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
      if(prog.bookmark) startPage = prog.bookmark;
      else if(prog.lastPage) startPage = prog.lastPage;
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
      renderPageNow(startPage);
      if(startPage > 1) renderPageNow(startPage - 1);
      if(startPage < RS.numPages) renderPageNow(startPage + 1);
    });

    if(!userData.badges.includes('first')){
      userData.badges.push('first');
      savePrefs();
      setTimeout(() => toast('حصلت على شارة «البداية الموفقة»', 'ok'), 600);
      renderBadges();
    }

    startReadClock();
    refreshAll();

    if(typeof loadDrawingsForFile === 'function'){
      loadDrawingsForFile(f.id).then(() => {
        if(typeof redrawVisiblePdfDrawings === 'function') redrawVisiblePdfDrawings();
      });
    }

  }catch(err){
    console.error(err);
    hideLoading();
    if(stage) stage.innerHTML = `<div class="pdf-loading" style="position:relative;display:flex">
      <i class="fas fa-circle-exclamation" style="color:var(--danger)"></i>
      <p>تعذّر تحميل الملف</p>
      <small style="color:var(--muted);font-size:.78rem">${escapeHtml(err.message || 'خطأ غير معروف')}</small>
      <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openFile('${id}')">
        <i class="fas fa-rotate"></i> إعادة المحاولة
      </button>
    </div>`;
    toast('تعذّر تحميل الملف: ' + err.message, 'err');
  }
}
window.openFile = openFile;

function teardownReader(closeUI){
  try{ if(RS.observer){ RS.observer.disconnect(); RS.observer = null; } }catch(e){}
  RS.renderQueue.forEach(t => { try{ t.cancel(); }catch(e){} });
  RS.renderQueue.clear();
  RS.pendingQueue = [];
  RS.rendered.clear();
  RS.inView.clear();
  RS.pageEls = [];
  stopReadClock();
  if(closeUI){
    try{ if(RS.doc) RS.doc.destroy(); }catch(e){}
    RS.doc = null; RS.file = null; RS.numPages = 0; currentFile = null;
    RS.signedUrl = null;
  }
}

function buildPages(){
  const stage = document.getElementById('rdStage');
  if(!stage) return;

  stage.innerHTML = '';
  RS.pageEls = [];
  const w = pageWidth();
  const h = pageHeight();
  stage.style.width = w + 'px';

  const frag = document.createDocumentFragment();
  for(let i = 0; i < RS.numPages; i++){
    const el = document.createElement('div');
    el.className = 'pdf-page';
    el.dataset.page = String(i + 1);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.innerHTML = `<div class="pg-num">صفحة ${i+1} / ${RS.numPages}</div><div class="pg-inner"></div><div class="pg-diag-wm">${escapeHtml(RS.watermarkEmail)}</div><div class="pg-wm">عباقرة القدرات © محتوى محمي</div>`;
    frag.appendChild(el);
    RS.pageEls.push(el);
  }
  stage.appendChild(frag);

  RS.observer = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const idx = parseInt(en.target.dataset.page, 10);
      if(en.isIntersecting){
        RS.inView.add(idx);
        requestRender(idx);
      } else {
        RS.inView.delete(idx);
        if(Math.abs(idx - RS.current) > 10) cancelRender(idx);
      }
    });
  }, {
    root: rdBody,
    rootMargin: '500px 0px',
    threshold: 0
  });

  RS.pageEls.forEach(el => RS.observer.observe(el));
  computeOffsets();
  applyMarksVisibility();
}

function computeOffsets(){
  const body = rdBody;
  RS.offsets = RS.pageEls.map(el => {
    const r = el.getBoundingClientRect();
    return r.top + body.scrollTop;
  });
}

function requestRender(num){
  const holder = RS.pageEls[num - 1];
  if(!holder || holder.dataset.done === '1') return;
  if(RS.renderQueue.has(num)) return;
  if(!RS.doc) return;
  if(RS.pendingQueue.includes(num)) return;

  RS.pendingQueue.push(num);
  processQueue();
}

function processQueue(){
  if(RS.isProcessing) return;
  RS.isProcessing = true;

  const step = () => {
    if(!RS.doc){ RS.isProcessing = false; return; }
    if(!RS.pendingQueue.length){ RS.isProcessing = false; return; }

    RS.pendingQueue.sort((a, b) => Math.abs(a - RS.current) - Math.abs(b - RS.current));
    const num = RS.pendingQueue.shift();

    renderPageNow(num).finally(() => {
      if(RS.pendingQueue.length){
        if(window.requestIdleCallback){
          window.requestIdleCallback(step, { timeout: 100 });
        } else {
          setTimeout(step, 16);
        }
      } else {
        RS.isProcessing = false;
      }
    });
  };

  step();
}

function renderPageNow(num){
  const holder = RS.pageEls[num - 1];
  if(!holder || holder.dataset.done === '1') return Promise.resolve();
  if(RS.renderQueue.has(num)) return RS.renderQueue.get(num);
  if(!RS.doc) return Promise.resolve();

  const promise = (async () => {
    const token = RS.token;
    try{
      const page = await RS.doc.getPage(num);
      if(token !== RS.token) return;
      if(holder.dataset.done === '1') return;

      const cssW = pageWidth();
      const scale = cssW / RS.pageW;

      let dprCap = 1.6;
      if(RS.numPages > 300) dprCap = 1.0;
      else if(RS.numPages > 150) dprCap = 1.15;
      else if(RS.numPages > 60) dprCap = 1.35;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

      const vp = page.getViewport({ scale: scale * dpr });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const ctx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });

      const task = page.render({ canvasContext: ctx, viewport: vp });
      RS.renderQueue.set(num, task);

      await task.promise;
      RS.renderQueue.delete(num);

      if(token !== RS.token) return;

      const inner = holder.querySelector('.pg-inner');
      if(inner){
        inner.innerHTML = '';
        inner.appendChild(canvas);
      }
      holder.dataset.done = '1';
      try{ page.cleanup(); }catch(e){}
    }catch(e){
      RS.renderQueue.delete(num);
      if(e && (e.name === 'RenderingCancelledException' || /cancel/i.test(e.message || ''))) return;
      console.warn('render error', num, e);
    }
  })();

  return promise;
}

function cancelRender(num){
  const task = RS.renderQueue.get(num);
  if(task){
    try{ task.cancel(); }catch(e){}
    RS.renderQueue.delete(num);
  }
  const idx = RS.pendingQueue.indexOf(num);
  if(idx > -1) RS.pendingQueue.splice(idx, 1);
}

function cleanupFarPages(){
  if(!RS.file) return;
  const cur = RS.current;
  RS.pageEls.forEach((el, i) => {
    const n = i + 1;
    if(Math.abs(n - cur) <= 12) return;
    if(RS.inView.has(n)) return;

    cancelRender(n);

    if(el.dataset.done === '1'){
      const inner = el.querySelector('.pg-inner');
      if(inner) inner.innerHTML = '';
      el.dataset.done = '0';
      RS.rendered.delete(n);
    }
  });
}

function rebuildPageSizes(){
  const w = pageWidth();
  const h = pageHeight();

  RS.pageEls.forEach((el, i) => {
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    if(el.dataset.done === '1'){
      const inner = el.querySelector('.pg-inner');
      if(inner) inner.innerHTML = '';
      el.dataset.done = '0';
      RS.rendered.delete(i + 1);
    }
  });

  const stage = document.getElementById('rdStage');
  if(stage) stage.style.width = w + 'px';

  computeOffsets();
  RS.inView.forEach(n => requestRender(n));
  if(typeof redrawVisiblePdfDrawings === 'function') redrawVisiblePdfDrawings();
}

function scrollToPage(num, smooth){
  num = Math.max(1, Math.min(num, RS.numPages || 1));
  const el = RS.pageEls[num - 1];
  if(!el) return;

  const top = el.offsetTop - 8;
  try{
    rdBody.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }catch(e){
    rdBody.scrollTop = top;
  }

  RS.current = num;
  const pi = document.getElementById('rdPageInput');
  if(pi) pi.value = num;

  updateReaderUI();
  highlightThumb(num);

  requestRender(num);
  requestRender(num + 1);
  requestRender(num - 1);
  requestRender(num + 2);
}

function pageFromScroll(){
  const st = rdBody.scrollTop + 60;
  let page = 1;
  const offs = RS.offsets && RS.offsets.length === RS.pageEls.length
    ? RS.offsets
    : RS.pageEls.map(el => el.offsetTop);
  for(let i = 0; i < offs.length; i++){
    if(offs[i] <= st) page = i + 1;
    else break;
  }
  return page;
}

function updateReaderUI(){
  if(!RS.file || !RS.numPages) return;
  const pct = Math.max(getPct(RS.file.id), Math.round((RS.current / RS.numPages) * 100));

  const pctTxt = document.getElementById('rdPctTxt');
  if(pctTxt) pctTxt.textContent = pct + '%';
  const pageInfo = document.getElementById('rdPageInfo');
  if(pageInfo) pageInfo.textContent = `الصفحة ${RS.current} من ${RS.numPages}`;
  const barTop = document.getElementById('rdBarTop');
  if(barTop) barTop.style.width = pct + '%';

  const btn = document.getElementById('rdComplete');
  if(btn){
    if(pct >= 100){
      btn.innerHTML = '<i class="fas fa-circle-check"></i> أُنجز الملف';
      btn.classList.add('achieved');
    } else {
      btn.innerHTML = '<i class="fas fa-check"></i> أنهيت الملف';
      btn.classList.remove('achieved');
    }
  }

  const fab = document.getElementById('rdTop');
  if(fab) fab.classList.toggle('top', rdBody.scrollTop > 400);

  updateCurrentClass(RS.current);
}

let _lastCurrentClass = 0;
function updateCurrentClass(n){
  if(_lastCurrentClass === n) return;
  if(_lastCurrentClass){
    const prev = RS.pageEls[_lastCurrentClass - 1];
    if(prev) prev.classList.remove('current');
  }
  const cur = RS.pageEls[n - 1];
  if(cur) cur.classList.add('current');
  _lastCurrentClass = n;
}

let scrollScheduled = false;
let lastScrollY = 0;

rdBody.addEventListener('scroll', () => {
  if(!RS.doc) return;

  const now = performance.now();
  const diff = Math.abs(rdBody.scrollTop - lastScrollY);
  lastScrollY = rdBody.scrollTop;

  if(diff > 500){
    RS.fastScrolling = true;
    clearTimeout(RS.fastScrollTimer);
    RS.fastScrollTimer = setTimeout(() => { RS.fastScrolling = false; }, 200);
  }

  if(scrollScheduled) return;
  scrollScheduled = true;

  RS.scrollRAF = requestAnimationFrame(() => {
    scrollScheduled = false;
    handleScroll();
  });
}, { passive: true });

function handleScroll(){
  if(!RS.doc || !RS.file || !RS.numPages) return;

  const page = pageFromScroll();

  if(page !== RS.current){
    RS.current = page;
    const pi = document.getElementById('rdPageInput');
    if(pi) pi.value = page;
    highlightThumb(page);
    updateCurrentClass(page);

    requestRender(page + 1);
    requestRender(page - 1);
  }

  const oldPct = getPct(RS.file.id);
  const oldMax = getMaxPage(RS.file.id);
  const pct = Math.round((page / RS.numPages) * 100);
  const newPct = Math.max(oldPct, pct);
  const newMax = Math.max(oldMax, page);

  const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object')
    ? userData.progress[RS.file.id] : {};

  userData.progress[RS.file.id] = Object.assign({}, prev, {
    pct: newPct, maxPage: newMax, lastPage: page, at: Date.now()
  });

  if(newMax > oldMax) addPagesToday(newMax - oldMax);
  else savePrefs();

  scheduleProgressSync(RS.file.id, newPct, newMax, page);

  const fab = document.getElementById('rdTop');
  if(fab) fab.classList.toggle('top', rdBody.scrollTop > 400);

  if(newPct >= 100 && oldPct < 100 && typeof onFileCompleted === 'function') onFileCompleted(RS.file);

  const pctTxt = document.getElementById('rdPctTxt');
  if(pctTxt) pctTxt.textContent = newPct + '%';
  const barTop = document.getElementById('rdBarTop');
  if(barTop) barTop.style.width = newPct + '%';
  const pageInfo = document.getElementById('rdPageInfo');
  if(pageInfo) pageInfo.textContent = `الصفحة ${page} من ${RS.numPages}`;

  checkBadges();

  if(!RS.restoring && !RS.fastScrolling){
    cleanupFarPages();
  }
}

let progressSyncTimer = null, progressSyncQueue = {};

function scheduleProgressSync(fileId, pct, maxPage, lastPage){
  progressSyncQueue[fileId] = { pct, max_page: maxPage, last_page: lastPage };
  clearTimeout(progressSyncTimer);
  progressSyncTimer = setTimeout(flushProgressSync, 2000);
}

let progressSyncRetries = 0;

async function flushProgressSync(){
  clearTimeout(progressSyncTimer);
  if(!currentUserObj || currentUserObj.role === 'admin' || currentUserObj.role === 'owner'){ progressSyncQueue = {}; return; }
  const queue = progressSyncQueue;
  progressSyncQueue = {};
  const rows = Object.keys(queue).map(fid => ({
    user_id: currentUserObj.id,
    file_id: fid,
    pct: queue[fid].pct,
    max_page: queue[fid].max_page,
    last_page: queue[fid].last_page,
    updated_at: new Date().toISOString()
  }));
  if(!rows.length) return;

  let ok = false;
  try{
    const { error } = await sb.from('user_progress').upsert(rows, { onConflict: 'user_id,file_id' });
    if(!error) ok = true;
    else {
      /* ⭐ غالباً السبب: لا يوجد unique(user_id,file_id) في الجدول → نكتب صف صف */
      console.warn('progress upsert failed → fallback:', error.message);
      ok = await fallbackProgressWrite(rows);
    }
  }catch(e){ ok = false; }

  if(ok){
    progressSyncRetries = 0;
  } else if(progressSyncRetries < 5){
    /* أعِد الصفوف للطابور (بدون الكتابة فوق قيم أحدث) وحاول لاحقاً */
    progressSyncRetries++;
    Object.keys(queue).forEach(fid => { if(!progressSyncQueue[fid]) progressSyncQueue[fid] = queue[fid]; });
    progressSyncTimer = setTimeout(flushProgressSync, 15000);
  }

  /* XP يُحسب من التقدم المحلي (المحفوظ أيضاً في user_data) — نزامنه دائماً */
  try{ if(typeof syncMyXp === 'function') syncMyXp(); }catch(e){}
}

async function fallbackProgressWrite(rows){
  let allOk = true;
  for(const row of rows){
    try{
      const { data: ex, error: selErr } = await sb.from('user_progress')
        .select('file_id').eq('user_id', row.user_id).eq('file_id', row.file_id).limit(1);
      if(selErr) throw selErr;
      const r = (ex && ex.length)
        ? await sb.from('user_progress')
            .update({ pct: row.pct, max_page: row.max_page, last_page: row.last_page, updated_at: row.updated_at })
            .eq('user_id', row.user_id).eq('file_id', row.file_id)
        : await sb.from('user_progress').insert(row);
      if(r.error){ allOk = false; console.warn('progress write failed:', r.error.message); }
    }catch(e){ allOk = false; console.warn('progress write failed:', e && e.message); }
  }
  return allOk;
}

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
      const btn = e.target.closest('.thumb-btn');
      if(!btn) return;
      scrollToPage(parseInt(btn.dataset.p, 10), true);
      if(window.innerWidth <= 720) box.classList.remove('open');
    });
  }
}

function highlightThumb(n){
  const box = document.getElementById('rdThumbs'); if(!box) return;
  const prev = box.querySelector('.thumb-btn.on');
  if(prev) prev.classList.remove('on');
  const next = box.querySelector(`.thumb-btn[data-p="${n}"]`);
  if(next){
    next.classList.add('on');
    const r = next.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    if(r.top < br.top || r.bottom > br.bottom){
      next.scrollIntoView({ block: 'nearest', behavior: 'auto' });
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
function stopReadClock(){
  if(RS.clockId){ clearInterval(RS.clockId); RS.clockId = null; }
}

document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    savePrefs();
    flushProgressSync();
    if(typeof saveDrawings === 'function') saveDrawings();
  }
});

function closeReader(){
  const r = document.getElementById('reader');
  if(!r || !r.classList.contains('open')) return;

  r.classList.add('closing');

  try{
    if(typeof DRAW !== 'undefined'){
      DRAW.active = false; DRAW.wb = false; DRAW.drawing = false; DRAW.current = null;
    }
    if(typeof saveDrawings === 'function') saveDrawings();

    const bar = document.getElementById('drawBar'); if(bar) bar.classList.remove('on');
    const panel = document.getElementById('wbPanel'); if(panel) panel.classList.remove('open');
    const dbtn = document.getElementById('rdDraw'); if(dbtn) dbtn.classList.remove('on');
    const wbtn = document.getElementById('rdWb'); if(wbtn) wbtn.classList.remove('on');
    if(rdBody) rdBody.classList.remove('draw-on');
  }catch(e){}

  RS.token++;

  const id = RS.file ? RS.file.id : null;
  const page = RS.current;
  if(id && page){
    const prev = (userData.progress[id] && typeof userData.progress[id] === 'object') ? userData.progress[id] : {};
    userData.progress[id] = Object.assign({}, prev, { lastPage: page, at: Date.now() });
    scheduleProgressSync(id, getPct(id), Math.max(getMaxPage(id), page), page);
    savePrefs();
  }

  teardownReader(true);
  hideLoading();

  setTimeout(() => {
    r.classList.remove('open');
    r.classList.remove('closing');
    document.body.style.overflow = '';

    const stage = document.getElementById('rdStage'); if(stage) stage.innerHTML = '';
    const thumbs = document.getElementById('rdThumbs'); if(thumbs) thumbs.innerHTML = '';
    if(thumbs) thumbs.classList.remove('open');

    renderFiles(); renderBadges(); renderRecent(); updateSidebar(); checkBadges();
  }, 480);
}

document.addEventListener('DOMContentLoaded', () => {
  const rdClose = document.getElementById('rdClose');
  if(rdClose) rdClose.addEventListener('click', closeReader);

  const readerEl = document.getElementById('reader');
  if(readerEl) readerEl.addEventListener('click', e => {
    if(e.target.id === 'reader') closeReader();
  });

  const rdPrev = document.getElementById('rdPrev');
  if(rdPrev) rdPrev.addEventListener('click', () => scrollToPage(RS.current - 1, true));

  const rdNext = document.getElementById('rdNext');
  if(rdNext) rdNext.addEventListener('click', () => scrollToPage(RS.current + 1, true));

  const rdPageInput = document.getElementById('rdPageInput');
  if(rdPageInput) rdPageInput.addEventListener('change', e => {
    const v = parseInt(e.target.value, 10);
    if(!isNaN(v)) scrollToPage(v, true);
  });

  const rdZoomIn = document.getElementById('rdZoomIn');
  if(rdZoomIn) rdZoomIn.addEventListener('click', () => setZoom(RS.zoom + 0.15));

  const rdZoomOut = document.getElementById('rdZoomOut');
  if(rdZoomOut) rdZoomOut.addEventListener('click', () => setZoom(RS.zoom - 0.15));

  const rdFit = document.getElementById('rdFit');
  if(rdFit) rdFit.addEventListener('click', () => setZoom(1));

  const rdTop = document.getElementById('rdTop');
  if(rdTop) rdTop.addEventListener('click', () => {
    if(!RS.numPages) return;
    if(RS.current <= 1) rdBody.scrollTo({ top: 0, behavior: 'smooth' });
    else scrollToPage(1, true);
  });

  const rdSnap = document.getElementById('rdSnap');
  if(rdSnap) rdSnap.addEventListener('click', () => {
    userData.snap = !userData.snap;
    savePrefs(); applySnapClass();
    if(typeof syncSettingsUI === 'function') syncSettingsUI();
    toast(userData.snap ? 'وضع الصفحة الواحدة' : 'وضع التمرير المستمر', 'ok');
  });

  const rdThumbsBtn = document.getElementById('rdThumbsBtn');
  if(rdThumbsBtn) rdThumbsBtn.addEventListener('click', () => {
    const box = document.getElementById('rdThumbs');
    if(!box) return;
    box.classList.toggle('open');
    rdThumbsBtn.classList.toggle('on', box.classList.contains('open'));
    if(box.classList.contains('open')) highlightThumb(RS.current);
  });

  const rdFav = document.getElementById('rdFav');
  if(rdFav) rdFav.addEventListener('click', () => {
    if(!RS.file) return;
    const i = userData.favs.indexOf(RS.file.id);
    if(i > -1) userData.favs.splice(i, 1); else userData.favs.push(RS.file.id);
    savePrefs(); updateFavBtn();
    toast(i > -1 ? 'أُزيل من المفضلة' : 'أُضيف إلى المفضلة', 'ok');
  });

  const rdBookmark = document.getElementById('rdBookmark');
  if(rdBookmark) rdBookmark.addEventListener('click', () => {
    if(!RS.file) return;
    const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
    if(prev.bookmark){ delete prev.bookmark; toast('تم حذف العلامة', 'warn'); }
    else { prev.bookmark = RS.current; toast(`علامة عند الصفحة ${RS.current}`, 'ok'); }
    userData.progress[RS.file.id] = prev;
    savePrefs(); updateBookmarkBtn();
  });

  const rdRestart = document.getElementById('rdRestart');
  if(rdRestart) rdRestart.addEventListener('click', () => { if(RS.numPages) scrollToPage(1, true); });

  const rdComplete = document.getElementById('rdComplete');
  if(rdComplete) rdComplete.addEventListener('click', () => {
    if(!RS.file) return;
    const total = RS.numPages || RS.file.page_count || 1;
    const oldPct = getPct(RS.file.id);
    const oldMax = getMaxPage(RS.file.id);
    const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
    userData.progress[RS.file.id] = Object.assign({}, prev, { pct: 100, maxPage: total, lastPage: total, at: Date.now() });
    if(total > oldMax) addPagesToday(total - oldMax); else savePrefs();
    scheduleProgressSync(RS.file.id, 100, total, total);
    RS.current = total;
    updateReaderUI(); refreshAll(); checkBadges(); renderBadges();
    if(oldPct < 100 && typeof onFileCompleted === 'function') onFileCompleted(RS.file);
  });
});

function setZoom(z){
  if(!RS.numPages) return;
  z = Math.max(0.4, Math.min(3, Math.round(z * 100) / 100));
  if(z === RS.zoom){ updateZoomLabel(); return; }
  RS.zoom = z;
  const cur = RS.current;

  RS.renderQueue.forEach(t => { try{ t.cancel(); }catch(e){} });
  RS.renderQueue.clear();
  RS.pendingQueue = [];

  rebuildPageSizes();
  updateZoomLabel();
  scrollToPage(cur, false);
}
function updateZoomLabel(){
  const el = document.getElementById('rdZoomVal');
  if(el) el.textContent = Math.round(RS.zoom * 100) + '%';
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  const r = document.getElementById('reader');
  if(!r || !r.classList.contains('open') || !RS.numPages) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const cur = RS.current;
    computeBaseWidth();
    rebuildPageSizes();
    scrollToPage(cur, false);
    updateZoomLabel();
  }, 250);
});

function computeBaseWidth(){
  const avail = rdBody.clientWidth - 30;
  const maxW = 980;
  RS.baseWidth = Math.max(220, Math.min(maxW, avail));
}
