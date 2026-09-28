/* ============================================================
   14) DRAW — الرسم على الملف والصبورة
============================================================ */

const DRAW_COLORS = [
  { c:'#ef4444', n:'أحمر' }, { c:'#f97316', n:'برتقالي' }, { c:'#facc15', n:'أصفر' },
  { c:'#22c55e', n:'أخضر' }, { c:'#06b6d4', n:'سماوي' }, { c:'#3b82f6', n:'أزرق' },
  { c:'#8b5cf6', n:'بنفسجي' }, { c:'#ec4899', n:'وردي' }, { c:'#78350f', n:'بني' },
  { c:'#000000', n:'أسود' }, { c:'#94a3b8', n:'رمادي' }, { c:'#ffffff', n:'أبيض' }
];
const DRAW_SIZES = [2, 4, 7, 12, 20, 32];
const DRAW = {
  active: false, wb: false, tool: 'pen', color: '#ef4444', size: 4,
  drawing: false, targetCanvas: null, current: null, lastKey: null
};

function drawKeyPdf(fileId, page){ return 'pdf:' + fileId + ':' + page; }
function drawKeyWb(fileId){ return 'wb:' + (fileId || 'default'); }

let drawingsCache = {};
let drawingsLoadedFor = null;
let drawingsSaveTimer = null;

function loadDrawings(){
  if(!drawingsCache || typeof drawingsCache !== 'object') drawingsCache = {};
  userData.drawings = drawingsCache;
}

async function loadDrawingsForFile(fileId){
  if(!currentUserObj || currentUserObj.role === 'admin'){
    drawingsCache = {}; userData.drawings = drawingsCache; return;
  }
  if(drawingsLoadedFor === 'ALL'){ userData.drawings = drawingsCache; return; }
  try{
    const { data, error } = await sb
      .from('user_drawings')
      .select('data')
      .eq('user_id', currentUserObj.id)
      .maybeSingle();
    if(error) throw error;
    drawingsCache = (data && data.data && typeof data.data === 'object') ? data.data : {};
    userData.drawings = drawingsCache;
    drawingsLoadedFor = 'ALL';
  }catch(e){
    console.warn('drawings load failed:', e && e.message);
    drawingsCache = drawingsCache || {};
    userData.drawings = drawingsCache;
  }
}

function saveDrawings(){
  if(!currentUserObj || currentUserObj.role === 'admin') return;
  clearTimeout(drawingsSaveTimer);
  drawingsSaveTimer = setTimeout(pushDrawingsToDB, 1000);
}

async function pushDrawingsToDB(){
  if(!currentUserObj || currentUserObj.role === 'admin') return;
  const payload = userData.drawings || {};
  try{
    const { error } = await sb
      .from('user_drawings')
      .upsert(
        { user_id: currentUserObj.id, data: payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if(error) console.warn('drawings save failed:', error.message);
  }catch(e){}
}

function drawStrokeOnCtx(ctx, s, w, h){
  if(!s.points || s.points.length < 1) return;
  const base = 800;
  const scale = w / base;
  let lw = Math.max(1, (s.size || 4) * scale);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color || '#000'; ctx.fillStyle = s.color || '#000';
  if(s.tool === 'marker'){ ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; lw *= 3; }
  else if(s.tool === 'eraser'){ ctx.globalCompositeOperation = 'destination-out'; lw *= 3; }
  ctx.lineWidth = lw;
  const pts = s.points;
  if(pts.length === 1){ const p = pts[0]; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, lw / 2, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(pts[0].x * w, pts[0].y * h); for(let i = 1; i < pts.length; i++){ const p = pts[i]; ctx.lineTo(p.x * w, p.y * h); } ctx.stroke(); }
  ctx.restore();
}
function redrawCanvas(canvas, key, includeCurrent){
  if(!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if(canvas.width !== bw || canvas.height !== bh){ canvas.width = bw; canvas.height = bh; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const strokes = ((userData.drawings && userData.drawings[key]) || []).slice();
  if(includeCurrent && DRAW.current) strokes.push(DRAW.current);
  strokes.forEach(s => drawStrokeOnCtx(ctx, s, w, h));
}
function redrawAllPdfDrawings(){
  if(!RS.file) return;
  RS.inView.forEach(n => ensureDrawCanvasIfNeeded(n));
}
function redrawVisiblePdfDrawings(){
  if(!RS.file) return;
  RS.inView.forEach(n => ensureDrawCanvasIfNeeded(n));
  if(RS.current) ensureDrawCanvasIfNeeded(RS.current);
}
function ensureDrawCanvasIfNeeded(pageNum){
  if(!RS.file) return;
  const key = drawKeyPdf(RS.file.id, pageNum);
  const has = userData.drawings && userData.drawings[key] && userData.drawings[key].length;
  if(!has) return;
  ensureDrawCanvas(RS.pageEls[pageNum - 1], pageNum);
  const c = RS.pageEls[pageNum - 1] ? RS.pageEls[pageNum - 1].querySelector('.pg-draw') : null;
  if(c) redrawCanvas(c, key, false);
}
function ensureDrawCanvas(pageEl, pageNum){
  if(!pageEl) return null;
  let c = pageEl.querySelector('.pg-draw');
  if(!c){
    c = document.createElement('canvas');
    c.className = 'pg-draw';
    c.dataset.page = String(pageNum);
    pageEl.appendChild(c);
    attachPdfDrawEvents(c, pageNum);
  }
  return c;
}
function redrawWhiteboard(){
  const c = $('#wbCanvas'); if(!c) return;
  const key = drawKeyWb(RS.file ? RS.file.id : 'default');
  redrawCanvas(c, key, false); updateWbEmpty();
}
function updateWbEmpty(){
  const empty = $('#wbEmpty'); if(!empty) return;
  const key = drawKeyWb(RS.file ? RS.file.id : 'default');
  const has = userData.drawings && userData.drawings[key] && userData.drawings[key].length;
  empty.style.display = has ? 'none' : 'flex';
}
function refreshDrawSurface(){ redrawVisiblePdfDrawings(); redrawWhiteboard(); }

function attachPdfDrawEvents(canvas, pageNum){
  canvas.addEventListener('pointerdown', e => {
    if(!DRAW.active || !RS.file) return;
    e.preventDefault();
    startStroke(e, canvas, drawKeyPdf(RS.file.id, pageNum));
  });
  canvas.addEventListener('pointermove', e => { if(!DRAW.drawing || DRAW.targetCanvas !== canvas) return; e.preventDefault(); moveStroke(e, canvas); });
  canvas.addEventListener('pointerup', e => { if(DRAW.targetCanvas !== canvas) return; endStroke(e, canvas); });
  canvas.addEventListener('pointercancel', e => { if(DRAW.targetCanvas !== canvas) return; endStroke(e, canvas); });
}
function attachWbDrawEvents(canvas){
  canvas.addEventListener('pointerdown', e => { if(!RS.file) return; e.preventDefault(); startStroke(e, canvas, drawKeyWb(RS.file.id)); });
  canvas.addEventListener('pointermove', e => { if(!DRAW.drawing || DRAW.targetCanvas !== canvas) return; e.preventDefault(); moveStroke(e, canvas); });
  canvas.addEventListener('pointerup', e => { if(DRAW.targetCanvas !== canvas) return; endStroke(e, canvas); });
  canvas.addEventListener('pointercancel', e => { if(DRAW.targetCanvas !== canvas) return; endStroke(e, canvas); });
}
function getNormCoords(e, canvas){
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}
function startStroke(e, canvas, key){
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  const p = getNormCoords(e, canvas);
  DRAW.drawing = true; DRAW.targetCanvas = canvas; DRAW.lastKey = key;
  DRAW.current = { tool: DRAW.tool, color: DRAW.color, size: DRAW.size, points: [p] };
  redrawCanvas(canvas, key, true);
}
function moveStroke(e, canvas){
  if(!DRAW.current) return;
  const p = getNormCoords(e, canvas);
  const last = DRAW.current.points[DRAW.current.points.length - 1];
  if(last && Math.abs(last.x - p.x) < 0.0015 && Math.abs(last.y - p.y) < 0.0015) return;
  DRAW.current.points.push(p);
  redrawCanvas(canvas, DRAW.lastKey, true);
}
function endStroke(e, canvas){
  if(!DRAW.drawing || !DRAW.current) return;
  const key = DRAW.lastKey;
  if(!userData.drawings) userData.drawings = {};
  if(!userData.drawings[key]) userData.drawings[key] = [];
  if(userData.drawings[key].length > 500) userData.drawings[key].shift();
  userData.drawings[key].push(DRAW.current);
  DRAW.drawing = false; DRAW.current = null; DRAW.targetCanvas = null;
  saveDrawings();
  redrawCanvas(canvas, key, false);
  if(key && key.startsWith('wb:')) updateWbEmpty();
}
function currentDrawKey(){
  if(DRAW.lastKey) return DRAW.lastKey;
  if(DRAW.wb && RS.file) return drawKeyWb(RS.file.id);
  if(DRAW.active && RS.file) return drawKeyPdf(RS.file.id, RS.current);
  return null;
}
function redrawSurfaceByKey(key){
  if(!key) return;
  if(key.startsWith('wb:')) redrawWhiteboard();
  else if(key.startsWith('pdf:')){
    const parts = key.split(':');
    const page = parseInt(parts[2], 10);
    const el = RS.pageEls[page - 1];
    if(el){ const c = el.querySelector('.pg-draw'); if(c) redrawCanvas(c, key, false); }
  }
}
function undoDraw(){
  const key = currentDrawKey();
  if(!key){ toast('لا يوجد رسم للتراجع عنه', 'warn'); return; }
  const arr = userData.drawings[key];
  if(!arr || !arr.length){ toast('لا يوجد رسم للتراجع عنه', 'warn'); return; }
  arr.pop();
  saveDrawings(); redrawSurfaceByKey(key);
}
function clearDraw(){
  const key = currentDrawKey();
  if(!key){ toast('لا يوجد رسم لمسحه', 'warn'); return; }
  const arr = userData.drawings[key];
  if(!arr || !arr.length){ toast('لا يوجد رسم لمسحه', 'warn'); return; }
  confirmBox('مسح الرسم', 'سيتم مسح كل الرسم على هذه الصفحة/الصبورة. هل أنت متأكد؟', () => {
    delete userData.drawings[key];
    saveDrawings(); redrawSurfaceByKey(key);
    if(key.startsWith('wb:')) updateWbEmpty();
    toast('تم مسح الرسم', 'ok');
  }, true);
}
function renderDrawToolbar(){
  const colorsBox = $('#drawColors');
  if(colorsBox && !colorsBox.dataset.init){
    colorsBox.dataset.init = '1';
    colorsBox.innerHTML = DRAW_COLORS.map(c => `<button class="color-dot ${c.c === DRAW.color ? 'on' : ''}" data-c="${c.c}" style="--cc:${c.c}" title="${c.n}"></button>`).join('');
    colorsBox.addEventListener('click', e => {
      const b = e.target.closest('.color-dot'); if(!b) return;
      DRAW.color = b.dataset.c;
      colorsBox.querySelectorAll('.color-dot').forEach(x => x.classList.toggle('on', x === b));
      if(DRAW.tool === 'eraser') setTool('pen');
    });
  }
  const sizesBox = $('#drawSizes');
  if(sizesBox && !sizesBox.dataset.init){
    sizesBox.dataset.init = '1';
    sizesBox.innerHTML = DRAW_SIZES.map(s => {
      const v = Math.min(s, 16);
      return `<button class="size-dot ${s === DRAW.size ? 'on' : ''}" data-s="${s}" title="حجم ${s}"><i style="width:${v}px;height:${v}px"></i></button>`;
    }).join('');
    sizesBox.addEventListener('click', e => {
      const b = e.target.closest('.size-dot'); if(!b) return;
      DRAW.size = parseInt(b.dataset.s, 10);
      sizesBox.querySelectorAll('.size-dot').forEach(x => x.classList.toggle('on', x === b));
    });
  }
}
function setTool(tool){
  DRAW.tool = tool;
  $$('#drawBar .dtool').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
}
function updateDrawBarVisibility(){
  const bar = $('#drawBar'); if(!bar) return;
  bar.classList.toggle('on', DRAW.active || DRAW.wb);
}
function toggleDrawMode(){
  DRAW.active = !DRAW.active;
  const btn = $('#rdDraw'); if(btn) btn.classList.toggle('on', DRAW.active);
  if(rdBody) rdBody.classList.toggle('draw-on', DRAW.active);
  updateDrawBarVisibility();
  if(DRAW.active){
    RS.inView.forEach(n => {
      ensureDrawCanvas(RS.pageEls[n - 1], n);
      const c = RS.pageEls[n - 1].querySelector('.pg-draw');
      if(c) redrawCanvas(c, drawKeyPdf(RS.file.id, n), false);
    });
    toast('وضع الرسم مُفعّل — ارسم على الصفحة', 'ok');
  }
}
function toggleWhiteboard(){
  DRAW.wb = !DRAW.wb;
  const btn = $('#rdWb'); if(btn) btn.classList.toggle('on', DRAW.wb);
  const panel = $('#wbPanel'); if(panel) panel.classList.toggle('open', DRAW.wb);
  updateDrawBarVisibility();
  if(DRAW.wb){ setTimeout(() => { redrawWhiteboard(); }, 320); toast('الصبورة البيضاء مفتوحة', 'ok'); }
}
function setupDrawUI(){
  renderDrawToolbar();
  const wbCanvas = $('#wbCanvas');
  if(wbCanvas && !wbCanvas.dataset.init){ wbCanvas.dataset.init = '1'; attachWbDrawEvents(wbCanvas); }
  const rdDraw = $('#rdDraw'); if(rdDraw) rdDraw.addEventListener('click', toggleDrawMode);
  const rdWb = $('#rdWb'); if(rdWb) rdWb.addEventListener('click', toggleWhiteboard);
  const wbClose = $('#wbClose');
  if(wbClose) wbClose.addEventListener('click', () => {
    DRAW.wb = false;
    const b = $('#rdWb'); if(b) b.classList.remove('on');
    const p = $('#wbPanel'); if(p) p.classList.remove('open');
    updateDrawBarVisibility();
  });
  const bar = $('#drawBar');
  if(bar) bar.querySelectorAll('.dtool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  const und = $('#drawUndo'); if(und) und.addEventListener('click', undoDraw);
  const clr = $('#drawClear'); if(clr) clr.addEventListener('click', clearDraw);
  let wbResizeTimer = null;
  window.addEventListener('resize', () => {
    if(!DRAW.wb) return;
    clearTimeout(wbResizeTimer);
    wbResizeTimer = setTimeout(() => redrawWhiteboard(), 220);
  });
}
