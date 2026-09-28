/* ============================================================
   13) READER — قارئ PDF (Streaming للملفات الضخمة)
============================================================ */

const RS = {
  doc:null, file:null, numPages:0,
  pageW: 612, pageH: 792,
  zoom:1, baseWidth:800, token:0, current:1,
  rendered:new Set(), rendering:new Set(), inView:new Set(),
  pageEls:[], observer:null, restoring:false, clockId:null,
  signedUrl: null
};
let currentFile = null;
const rdBody = $('#rdBody');

function pageWidth(){ return Math.round(RS.baseWidth * RS.zoom); }
function pageHeight(){ return Math.round(RS.pageH * (pageWidth() / RS.pageW)); }
function showLoading(txt, pct){
  const l = $('#rdLoading'); if(!l) return;
  l.style.display = 'flex';
  if(txt) $('#rdLoadingTxt').textContent = txt;
  if(typeof pct === 'number') $('#rdLoadingBar').style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function hideLoading(){ const l = $('#rdLoading'); if(l) l.style.display = 'none'; }

async function openFile(id){
  if(!currentUserObj) return;
  if(!isSubscribed()){ showLockMessage(); return; }
  const f = DB.files.find(x => x.id === id);
  if(!f) return;
  currentFile = f; RS.file = f;
  userData.opened = [id, ...userData.opened.filter(x => x !== id)].slice(0, 14);
  savePrefs();
  const icon = f.icon || 'fa-file-pdf';
  const color = f.color || '#5b6cff';
  $('#rdIcon').innerHTML = `<i class="fas ${icon}" style="color:${color}"></i>`;
  $('#rdIcon').style.background = `color-mix(in srgb, ${color} 16%, transparent)`;
  $('#rdTitle').textContent = f.title;
  $('#rdMeta').textContent = `PDF • ${f.category}${f.important ? ' • مهم' : ''}`;
  updateFavBtn(); updateBookmarkBtn();
  $('#reader').classList.add('open');
  document.body.style.overflow = 'hidden';
  applyReaderTheme(); applySnapClass();
  RS.token++; const token = RS.token;
  teardownReader(false);
  showLoading('جاري تجهيز القارئ...', 15);
  $('#rdStage').innerHTML = '';
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
      disableAutoFetch: true,
      disableStream: false,
      rangeChunkSize: 262144,
      disableRange: false,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    }).promise;
    if(token !== RS.token){ try{doc.destroy();}catch(e){} return; }
    RS.doc = doc; RS.numPages = doc.numPages;

    const p1 = await doc.getPage(1);
    const vp0 = p1.getViewport({ scale: 1 });
    RS.pageW = vp0.width || 612;
    RS.pageH = vp0.height || 792;
    try{ p1.cleanup(); }catch(e){}

    if(f.page_count !== RS.numPages){ f.page_count = RS.numPages; }
    $('#rdMeta').textContent = `PDF • ${f.category} • ${RS.numPages} صفحة${f.important ? ' • مهم' : ''}`;
    $('#rdPagesTotal').textContent = RS.numPages;
    $('#rdPageInput').max = RS.numPages;

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
    $('#rdPageInput').value = startPage;
    renderThumbs();
    if(startPage > 1){ RS.restoring = true; scrollToPage(startPage, false); setTimeout(()=>{ RS.restoring = false; }, 500); }
    updateReaderUI();
    if(!userData.badges.includes('first')){ userData.badges.push('first'); savePrefs(); setTimeout(()=> toast('حصلت على شارة «البداية الموفقة»', 'ok'), 700); renderBadges(); }
    startReadClock();
    refreshAll();
    loadDrawingsForFile(f.id).then(() => redrawVisiblePdfDrawings());
  }catch(err){
    console.error(err); hideLoading();
    $('#rdStage').innerHTML = `<div class="pdf-loading" style="position:relative;display:flex"><i class="fas fa-circle-exclamation" style="color:var(--danger)"></i><p>تعذّر تحميل الملف</p><small style="color:var(--muted);font-size:.78rem">${escapeHtml(err.message || 'خطأ غير معروف')}</small><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="openFile('${id}')"><i class="fas fa-rotate"></i> إعادة المحاولة</button></div>`;
    toast('تعذّر تحميل الملف: ' + err.message, 'err');
  }
}
window.openFile = openFile;

function teardownReader(closeUI){
  try{ if(RS.observer){ RS.observer.disconnect(); RS.observer = null; } }catch(e){}
  RS.rendered.clear(); RS.rendering.clear(); RS.inView.clear();
  RS.pageEls = []; RS.offsets = [];
  stopReadClock();
  if(closeUI){
    if(RS.doc){ try{ RS.doc.destroy(); }catch(e){} }
    RS.doc = null; RS.file = null; RS.numPages = 0; currentFile = null;
    RS.signedUrl = null;
  }
}

function buildPages(){
  const stage = $('#rdStage');
  stage.innerHTML = ''; RS.pageEls = [];
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
    el.innerHTML = `<div class="pg-num">صفحة ${i+1} / ${RS.numPages}</div><div class="pg-inner"></div><div class="pg-wm">العباقرة للقدرات © محتوى محمي</div>`;
    frag.appendChild(el); RS.pageEls.push(el);
  }
  stage.appendChild(frag);

  RS.observer = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const idx = parseInt(en.target.dataset.page, 10);
      if(en.isIntersecting){
        RS.inView.add(idx);
        renderPage(idx);
        ensureDrawCanvasIfNeeded(idx);
      } else RS.inView.delete(idx);
    });
  }, { root: rdBody, rootMargin: '800px 0px', threshold: 0 });
  RS.pageEls.forEach(el => RS.observer.observe(el));
  computeOffsets();
  applyMarksVisibility();
}

function computeOffsets(){
  RS.offsets = RS.pageEls.map(el => {
    const r = el.getBoundingClientRect();
    return r.top + rdBody.scrollTop;
  });
}

async function renderPage(num){
  const holder = RS.pageEls[num - 1];
  if(!holder || holder.dataset.done === '1') return;
  if(RS.rendering.has(num)) return;
  if(!RS.doc) return;
  const token = RS.token;
  RS.rendering.add(num);
  try{
    const page = await RS.doc.getPage(num);
    if(token !== RS.token) return;
    const cssW = pageWidth();
    const scale = cssW / RS.pageW;
    const dprCap = RS.numPages > 200 ? 1.2 : (RS.numPages > 100 ? 1.4 : 1.6);
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const vp = page.getViewport({ scale: scale * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    canvas.style.width = '100%'; canvas.style.height = '100%';
    const ctx = canvas.getContext('2d', { alpha:false });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    if(token !== RS.token) return;
    const inner = holder.querySelector('.pg-inner');
    if(inner){ inner.innerHTML = ''; inner.appendChild(canvas); }
    holder.dataset.done = '1';
    try{ page.cleanup(); }catch(e){}
  }catch(e){ console.warn(e); }
  finally{ RS.rendering.delete(num); }
}

function cleanupFarPages(){
  if(!RS.file) return;
  const cur = RS.current;
  RS.pageEls.forEach((el, i) => {
    const n = i + 1;
    if(Math.abs(n - cur) <= 6) return;
    if(RS.inView.has(n)) return;
    if(el.dataset.done === '1'){
      const inner = el.querySelector('.pg-inner');
      if(inner) inner.innerHTML = '';
      el.dataset.done = '0';
      RS.rendered.delete(n);
    }
    const c = el.querySelector('.pg-draw');
    if(c){
      const key = drawKeyPdf(RS.file.id, n);
      const has = userData.drawings && userData.drawings[key] && userData.drawings[key].length;
      if(!has) c.remove();
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
  const stage = $('#rdStage');
  if(stage) stage.style.width = w + 'px';
  computeOffsets();
  RS.inView.forEach(n => renderPage(n));
  redrawVisiblePdfDrawings();
}

function scrollToPage(num, smooth){
  num = Math.max(1, Math.min(num, RS.numPages || 1));
  const el = RS.pageEls[num - 1]; if(!el) return;
  const top = el.offsetTop - 8;
  try{ rdBody.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }); }
  catch(e){ rdBody.scrollTop = top; }
  RS.current = num;
  $('#rdPageInput').value = num;
  updateReaderUI(); highlightThumb(num);
}

function pageFromScroll(){
  const st = rdBody.scrollTop + 60;
  let page = 1;
  const offs = RS.pageEls.map(el => {
    const r = el.getBoundingClientRect();
    return r.top + rdBody.scrollTop;
  });
  for(let i = 0; i < offs.length; i++){ if(offs[i] <= st) page = i + 1; else break; }
  return page;
}

function updateReaderUI(){
  if(!RS.file || !RS.numPages) return;
  const pct = Math.max(getPct(RS.file.id), Math.round((RS.current / RS.numPages) * 100));
  $('#rdPctTxt').textContent = pct + '%';
  $('#rdPageInfo').textContent = `الصفحة ${RS.current} من ${RS.numPages}`;
  $('#rdBarTop').style.width = pct + '%';
  const btn = $('#rdComplete');
  if(pct >= 100){ btn.innerHTML = '<i class="fas fa-circle-check"></i> أُنجز الملف'; btn.classList.add('achieved'); }
  else { btn.innerHTML = '<i class="fas fa-check"></i> أنهيت الملف'; btn.classList.remove('achieved'); }
  const fab = $('#rdTop');
  if(fab) fab.classList.toggle('top', rdBody.scrollTop > 400);
}

let scrollTick = null;
rdBody.addEventListener('scroll', () => {
  if(!RS.doc){ updateReaderUI(); return; }
  const fab = $('#rdTop');
  if(fab) fab.classList.toggle('top', rdBody.scrollTop > 400);
  if(scrollTick) return;
  scrollTick = requestAnimationFrame(() => { scrollTick = null; handleReaderScroll(); });
}, { passive:true });

function handleReaderScroll(){
  if(!RS.doc || !RS.file || !RS.numPages) return;
  const page = pageFromScroll();
  if(page !== RS.current){ RS.current = page; $('#rdPageInput').value = page; highlightThumb(page); }
  const oldPct = getPct(RS.file.id);
  const oldMax = getMaxPage(RS.file.id);
  const pct = Math.round((page / RS.numPages) * 100);
  const newPct = Math.max(oldPct, pct);
  const newMax = Math.max(oldMax, page);
  const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
  userData.progress[RS.file.id] = Object.assign({}, prev, { pct: newPct, maxPage: newMax, lastPage: page, at: Date.now() });
  if(newMax > oldMax) addPagesToday(newMax - oldMax); else savePrefs();
  scheduleProgressSync(RS.file.id, newPct, newMax, page);
  updateReaderUI(); updateSidebar(); renderHomeStats();
  if(newPct >= 100 && oldPct < 100) toast('أكملت الملف بالكامل!', 'ok');
  checkBadges();
  if(!RS.restoring) cleanupFarPages();
}

let progressSyncTimer = null, progressSyncQueue = {};
function scheduleProgressSync(fileId, pct, maxPage, lastPage){
  progressSyncQueue[fileId] = { pct, max_page: maxPage, last_page: lastPage };
  clearTimeout(progressSyncTimer);
  progressSyncTimer = setTimeout(flushProgressSync, 1200);
}
async function flushProgressSync(){
  if(!currentUserObj || currentUserObj.role === 'admin') return;
  const rows = Object.keys(progressSyncQueue).map(fid => ({
    user_id: currentUserObj.id, file_id: fid,
    pct: progressSyncQueue[fid].pct, max_page: progressSyncQueue[fid].max_page, last_page: progressSyncQueue[fid].last_page,
    updated_at: new Date().toISOString()
  }));
  progressSyncQueue = {};
  if(!rows.length) return;
  const { error } = await sb.from('user_progress').upsert(rows, { onConflict: 'user_id,file_id' });
  if(error) console.warn('progress sync failed', error);
  try{ if(typeof syncMyXp === 'function') syncMyXp(); }catch(e){}
}

function updateFavBtn(){
  const b = $('#rdFav'); if(!b || !RS.file) return;
  const on = userData.favs.includes(RS.file.id);
  b.classList.toggle('on', on);
  b.innerHTML = `<i class="${on ? 'fas' : 'far'} fa-star"></i>`;
}
function updateBookmarkBtn(){
  const b = $('#rdBookmark'); if(!b || !RS.file) return;
  const p = userData.progress[RS.file.id];
  const has = p && typeof p === 'object' && p.bookmark;
  b.classList.toggle('on', !!has);
  b.innerHTML = `<i class="${has ? 'fas' : 'far'} fa-bookmark"></i>`;
}
function applyReaderTheme(){
  const body = $('#rdBody'); if(!body) return;
  body.classList.remove('read-light','read-sepia','read-dark');
  body.classList.add('read-' + (userData.readTheme || 'light'));
  applyMarksVisibility();
}
function applySnapClass(){
  const body = $('#rdBody'); if(!body) return;
  body.classList.toggle('snap', !!userData.snap);
  const btn = $('#rdSnap');
  if(btn) btn.innerHTML = `<i class="fas fa-scroll"></i> <span>${userData.snap ? 'صفحة واحدة' : 'مستمر'}</span>`;
}
function applyMarksVisibility(){
  const body = $('#rdBody'); if(!body) return;
  body.classList.toggle('hide-marks', !userData.showMarks);
}
function renderThumbs(){
  const box = $('#rdThumbs'); if(!box) return;
  if(!RS.numPages){ box.innerHTML = ''; return; }
  let html = '';
  for(let i = 1; i <= RS.numPages; i++) html += `<button class="thumb-btn ${i === RS.current ? 'on' : ''}" data-p="${i}"><i class="fas fa-file-lines"></i> صفحة ${i}</button>`;
  box.innerHTML = html;
  box.querySelectorAll('.thumb-btn').forEach(b => {
    b.addEventListener('click', () => {
      scrollToPage(parseInt(b.dataset.p, 10), true);
      if(window.innerWidth <= 720) box.classList.remove('open');
    });
  });
}
function highlightThumb(n){
  const box = $('#rdThumbs'); if(!box) return;
  box.querySelectorAll('.thumb-btn').forEach(b => b.classList.toggle('on', parseInt(b.dataset.p,10) === n));
}
function startReadClock(){
  stopReadClock();
  RS.clockId = setInterval(() => {
    if(document.hidden) return;
    if(!$('#reader').classList.contains('open')) return;
    addMinutesToday(0.5);
  }, 30000);
}
function stopReadClock(){ if(RS.clockId){ clearInterval(RS.clockId); RS.clockId = null; } }

document.addEventListener('visibilitychange', () => {
  if(document.hidden){ savePrefs(); flushProgressSync(); saveDrawings(); }
});

function closeReader(){
  if(!$('#reader').classList.contains('open')) return;
  try{
    DRAW.active = false; DRAW.wb = false; DRAW.drawing = false; DRAW.current = null;
    saveDrawings();
    const bar = $('#drawBar'); if(bar) bar.classList.remove('on');
    const panel = $('#wbPanel'); if(panel) panel.classList.remove('open');
    const dbtn = $('#rdDraw'); if(dbtn) dbtn.classList.remove('on');
    const wbtn = $('#rdWb'); if(wbtn) wbtn.classList.remove('on');
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
  $('#reader').classList.remove('open');
  document.body.style.overflow = '';
  $('#rdStage').innerHTML = '';
  $('#rdThumbs').innerHTML = '';
  $('#rdThumbs').classList.remove('open');
  hideLoading();
  renderFiles(); renderBadges(); renderRecent(); updateSidebar(); checkBadges();
}

$('#rdClose').addEventListener('click', closeReader);
$('#reader').addEventListener('click', e => { if(e.target.id === 'reader') closeReader(); });
$('#rdPrev').addEventListener('click', () => scrollToPage(RS.current - 1, true));
$('#rdNext').addEventListener('click', () => scrollToPage(RS.current + 1, true));
$('#rdPageInput').addEventListener('change', e => { const v = parseInt(e.target.value, 10); if(!isNaN(v)) scrollToPage(v, true); });
$('#rdZoomIn').addEventListener('click', () => setZoom(RS.zoom + 0.15));
$('#rdZoomOut').addEventListener('click', () => setZoom(RS.zoom - 0.15));
$('#rdFit').addEventListener('click', () => setZoom(1));
$('#rdTop').addEventListener('click', () => {
  if(!RS.numPages) return;
  if(RS.current <= 1) rdBody.scrollTo({ top:0, behavior:'smooth' }); else scrollToPage(1, true);
});
$('#rdSnap').addEventListener('click', () => {
  userData.snap = !userData.snap;
  savePrefs(); applySnapClass(); syncSettingsUI();
  toast(userData.snap ? 'وضع الصفحة الواحدة مُفعّل' : 'وضع التمرير المستمر مُفعّل', 'ok');
});
$('#rdThumbsBtn').addEventListener('click', () => {
  const box = $('#rdThumbs');
  box.classList.toggle('open');
  $('#rdThumbsBtn').classList.toggle('on', box.classList.contains('open'));
  if(box.classList.contains('open')) highlightThumb(RS.current);
});
$('#rdFav').addEventListener('click', () => {
  if(!RS.file) return;
  const i = userData.favs.indexOf(RS.file.id);
  if(i > -1) userData.favs.splice(i,1); else userData.favs.push(RS.file.id);
  savePrefs(); updateFavBtn();
  toast(i > -1 ? 'أُزيل من المفضلة' : 'أُضيف إلى المفضلة', 'ok');
});
$('#rdBookmark').addEventListener('click', () => {
  if(!RS.file) return;
  const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
  if(prev.bookmark){ delete prev.bookmark; toast('تم حذف العلامة المرجعية', 'warn'); }
  else { prev.bookmark = RS.current; toast(`تم حفظ علامة عند الصفحة ${RS.current}`, 'ok'); }
  userData.progress[RS.file.id] = prev;
  savePrefs(); updateBookmarkBtn();
});
$('#rdRestart').addEventListener('click', () => { if(RS.numPages) scrollToPage(1, true); });
$('#rdComplete').addEventListener('click', () => {
  if(!RS.file) return;
  const total = RS.numPages || RS.file.page_count || 1;
  const oldPct = getPct(RS.file.id);
  const oldMax = getMaxPage(RS.file.id);
  const prev = (userData.progress[RS.file.id] && typeof userData.progress[RS.file.id] === 'object') ? userData.progress[RS.file.id] : {};
  userData.progress[RS.file.id] = Object.assign({}, prev, { pct:100, maxPage:total, lastPage:total, at:Date.now() });
  if(total > oldMax) addPagesToday(total - oldMax); else savePrefs();
  scheduleProgressSync(RS.file.id, 100, total, total);
  RS.current = total;
  updateReaderUI(); refreshAll(); checkBadges(); renderBadges();
  if(oldPct < 100) toast('رائع! أنهيت الملف بالكامل', 'ok');
});

function setZoom(z){
  if(!RS.numPages) return;
  z = Math.max(0.4, Math.min(3, Math.round(z * 100) / 100));
  if(z === RS.zoom){ updateZoomLabel(); return; }
  RS.zoom = z;
  const cur = RS.current;
  rebuildPageSizes();
  updateZoomLabel();
  scrollToPage(cur, false);
}
function updateZoomLabel(){ const el = $('#rdZoomVal'); if(el) el.textContent = Math.round(RS.zoom * 100) + '%'; }

let resizeTimer = null;
window.addEventListener('resize', () => {
  if(!$('#reader').classList.contains('open') || !RS.numPages) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const cur = RS.current;
    computeBaseWidth(); rebuildPageSizes(); scrollToPage(cur, false); updateZoomLabel();
  }, 250);
});
function computeBaseWidth(){
  const avail = rdBody.clientWidth - 30;
  const maxW = 980;
  RS.baseWidth = Math.max(220, Math.min(maxW, avail));
}
