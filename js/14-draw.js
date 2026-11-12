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
  drawing: false, targetCanvas: null, current: null, lastKey: null,
  penMode: false, penAsked: false, redo: {}, wbBg: 'plain'
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
  drawingsSaveTimer = setTimeout(pushDrawingsToDB, 2500);
}
/* لو قفل الصفحة قبل الحفظ → احفظ فوراً */
document.addEventListener('visibilitychange', () => {
  if(document.hidden && drawingsSaveTimer){ clearTimeout(drawingsSaveTimer); drawingsSaveTimer = null; pushDrawingsToDB(); }
});

let drawingsPushing = false, drawingsPushAgain = false;
async function pushDrawingsToDB(){
  if(!currentUserObj || currentUserObj.role === 'admin') return;
  drawingsSaveTimer = null;
  /* طلب واحد في نفس الوقت (ما تتكدس الطلبات على النت الضعيف) */
  if(drawingsPushing){ drawingsPushAgain = true; return; }
  drawingsPushing = true;
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
  finally{
    drawingsPushing = false;
    if(drawingsPushAgain){ drawingsPushAgain = false; saveDrawings(); }
  }
}

/* ============================================================
   ✍️ محرك الحبر v2 — كتابة سلسة بدون تعليق
   - أثناء الكتابة نرسم «القطعة الجديدة» فقط على طبقة خفيفة فوق الصفحة
     (سابقاً كل حركة تمسح الصفحة وتعيد رسمها كاملة → تعليق)
   - نلتقط كل نقاط القلم (حتى اللي بين الإطارات) + تنعيم المنحنيات
   - وضع القلم: اكتب بالقلم ومرّر بإصبعك • إصبعين للتمرير أثناء الرسم
   - أشكال: خط / سهم / مستطيل / دائرة • تراجع وإعادة
============================================================ */
const INK_SHAPES = ['line', 'arrow', 'rect', 'ellipse'];

function inkSetStyle(ctx, s, w, live){
  const scale = w / 800;
  let lw = Math.max(1, (s.size || 4) * scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color || '#000'; ctx.fillStyle = s.color || '#000';
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if(s.tool === 'marker'){ lw *= 3; if(!live) ctx.globalAlpha = 0.35; }   /* الطبقة الحية شفافيتها من CSS */
  else if(s.tool === 'eraser'){ ctx.globalCompositeOperation = 'destination-out'; lw *= 3; }
  ctx.lineWidth = lw;
  return lw;
}

/* مسار منعّم: خط لمنتصف أول قطعة ثم منحنيات بين المنتصفات */
function inkSmoothPath(ctx, pts, w, h, from){
  const X = i => pts[i].x * w, Y = i => pts[i].y * h;
  const MX = i => (pts[i].x + pts[i + 1].x) / 2 * w, MY = i => (pts[i].y + pts[i + 1].y) / 2 * h;
  const n = pts.length;
  let i = Math.max(1, from || 1);
  if(i === 1){ ctx.moveTo(X(0), Y(0)); ctx.lineTo(MX(0), MY(0)); i = 2; }
  else ctx.moveTo(MX(i - 2), MY(i - 2));
  for(; i < n; i++) ctx.quadraticCurveTo(X(i - 1), Y(i - 1), MX(i - 1), MY(i - 1));
}

function inkShape(ctx, s, w, h, lw){
  const a = s.points[0], b = s.points[s.points.length - 1];
  const x1 = a.x * w, y1 = a.y * h, x2 = b.x * w, y2 = b.y * h;
  ctx.beginPath();
  if(s.tool === 'rect') ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  else if(s.tool === 'ellipse') ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
  else {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    if(s.tool === 'arrow'){
      const ang = Math.atan2(y2 - y1, x2 - x1), hl = Math.max(10, lw * 4);
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45));
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45));
    }
  }
  ctx.stroke();
}

function drawStrokeOnCtx(ctx, s, w, h){
  if(!s || !s.points || s.points.length < 1) return;
  ctx.save();
  const lw = inkSetStyle(ctx, s, w, false);
  const pts = s.points;
  if(INK_SHAPES.includes(s.tool)){ if(pts.length >= 2) inkShape(ctx, s, w, h, lw); }
  else if(pts.length === 1){ ctx.beginPath(); ctx.arc(pts[0].x * w, pts[0].y * h, lw / 2, 0, Math.PI * 2); ctx.fill(); }
  else {
    ctx.beginPath();
    inkSmoothPath(ctx, pts, w, h, 1);
    ctx.lineTo(pts[pts.length - 1].x * w, pts[pts.length - 1].y * h);
    ctx.stroke();
  }
  ctx.restore();
}

function inkMetrics(canvas){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
  return { dpr, rect, w, h, bw: Math.round(w * dpr), bh: Math.round(h * dpr) };
}

/* رسم كامل للطبقة (عند التحميل / التراجع / تغيير الحجم فقط — مو أثناء الكتابة) */
function paintCanvas(canvas, strokes, current){
  if(!canvas) return;
  const m = inkMetrics(canvas);
  if(canvas.width !== m.bw || canvas.height !== m.bh){ canvas.width = m.bw; canvas.height = m.bh; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
  ctx.clearRect(0, 0, m.w, m.h);
  (strokes || []).forEach(s => { try{ drawStrokeOnCtx(ctx, s, m.w, m.h); }catch(e){} });
  if(current){ try{ drawStrokeOnCtx(ctx, current, m.w, m.h); }catch(e){} }
}
window.paintCanvas = paintCanvas;

function redrawCanvas(canvas, key){
  if(!canvas) return;
  paintCanvas(canvas, userData.drawings && userData.drawings[key]);
}

/* الطبقة الحية فوق لوحة الرسم */
function inkLive(canvas, m){
  let l = canvas._inkLive;
  if(!l || !l.isConnected){
    l = document.createElement('canvas');
    l.className = 'ink-live';
    canvas.parentNode.insertBefore(l, canvas.nextSibling);
    canvas._inkLive = l;
  }
  if(l.width !== m.bw || l.height !== m.bh){ l.width = m.bw; l.height = m.bh; }
  return l;
}

function inkPoint(e, k){
  const x = Math.max(0, Math.min(1, (e.clientX - k.rect.left) / Math.max(1, k.rect.width)));
  const y = Math.max(0, Math.min(1, (e.clientY - k.rect.top) / Math.max(1, k.rect.height)));
  return { x: Math.round(x * 2000) / 2000, y: Math.round(y * 2000) / 2000 };
}

/* يرسم ما استجد فقط */
function inkFlush(k){
  k.raf = 0;
  const s = k.s, pts = s.points, ctx = k.ctx;
  if(k.shape){
    ctx.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
    ctx.clearRect(0, 0, k.w, k.h);
    if(pts.length >= 2){ ctx.save(); const lw = inkSetStyle(ctx, s, k.w, true); inkShape(ctx, s, k.w, k.h, lw); ctx.restore(); }
    return;
  }
  if(pts.length - 1 <= k.drawn) return;
  ctx.save();
  ctx.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
  inkSetStyle(ctx, s, k.w, true);
  ctx.beginPath();
  inkSmoothPath(ctx, pts, k.w, k.h, k.drawn + 1);
  ctx.stroke();
  ctx.restore();
  k.drawn = pts.length - 1;
}

function inkPanStop(st){ if(st.inertia){ cancelAnimationFrame(st.inertia); st.inertia = 0; } }
let inkLastPen = 0;   /* آخر وقت انكتب فيه بالقلم (لتجاهل راحة اليد) */

/* يربط عنصراً بمحرك الحبر
   o.enabled()  → هل الرسم مفعّل الآن
   o.resolve(e) → { canvas, key } اللوحة المستهدفة
   o.style()    → { tool, color, size }
   o.scrollEl   → عنصر التمرير (للتمرير بالإصبع) — اختياري
   o.onCommit(key, canvas) */
function inkBind(el, o){
  const st = { k: null, touches: new Map(), pan: false, vy: 0, vx: 0, lastT: 0, inertia: 0 };

  const discard = () => {
    const k = st.k; if(!k) return;
    if(k.raf) cancelAnimationFrame(k.raf);
    if(k.s.tool === 'eraser') redrawCanvas(k.canvas, k.key);
    else { const c = k.live.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.live.width, k.live.height); }
    st.k = null; DRAW.drawing = false; DRAW.current = null; DRAW.targetCanvas = null;
  };

  el.addEventListener('pointerdown', e => {
    if(!o.enabled()) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    inkPanStop(st);

    if(e.pointerType === 'pen') inkLastPen = performance.now();
    if(e.pointerType === 'pen' && !DRAW.penMode && !DRAW.penAsked){
      DRAW.penAsked = true;
      setPenMode(true);
      toast('✍️ وضع القلم: اكتب بالقلم ومرّر الصفحة بإصبعك', 'ok');
    }

    if(e.pointerType === 'touch'){
      st.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const wantPan = o.scrollEl && (DRAW.penMode || st.touches.size >= 2);
      if(wantPan){
        e.preventDefault();
        discard();
        st.pan = true; st.vx = 0; st.vy = 0; st.lastT = performance.now();
        o.scrollEl.style.scrollSnapType = 'none';   /* وضع الصفحة الواحدة ما يقاوم السحب */
        try{ el.setPointerCapture(e.pointerId); }catch(x){}
        return;
      }
      /* راحة اليد ما ترسم أثناء الكتابة بالقلم */
      if(DRAW.penMode && (o.scrollEl || performance.now() - inkLastPen < 3000)) return;
    }
    if(st.k || st.pan) return;

    const t = o.resolve(e);
    if(!t || !t.canvas) return;
    e.preventDefault();
    try{ el.setPointerCapture(e.pointerId); }catch(x){}

    const canvas = t.canvas, m = inkMetrics(canvas);
    if(canvas.width !== m.bw || canvas.height !== m.bh) redrawCanvas(canvas, t.key);
    const sty = o.style();
    const s = { tool: sty.tool, color: sty.color, size: sty.size, points: [] };
    const k = { id: e.pointerId, canvas, key: t.key, rect: m.rect, w: m.w, h: m.h, dpr: m.dpr, s, drawn: 0, raf: 0,
                shape: INK_SHAPES.includes(s.tool), live: null, ctx: null };
    if(s.tool === 'eraser') k.ctx = canvas.getContext('2d');
    else {
      k.live = inkLive(canvas, m);
      k.live.style.opacity = s.tool === 'marker' ? '0.35' : '1';
      k.ctx = k.live.getContext('2d');
      k.ctx.setTransform(1, 0, 0, 1, 0, 0);
      k.ctx.clearRect(0, 0, k.live.width, k.live.height);
    }
    const p = inkPoint(e, k);
    s.points.push(p);
    if(!k.shape){
      k.ctx.save();
      k.ctx.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
      const lw = inkSetStyle(k.ctx, s, k.w, true);
      k.ctx.beginPath(); k.ctx.arc(p.x * k.w, p.y * k.h, lw / 2, 0, Math.PI * 2); k.ctx.fill();
      k.ctx.restore();
    }
    st.k = k;
    DRAW.drawing = true; DRAW.current = s; DRAW.targetCanvas = canvas;
    if(o.track !== false) DRAW.lastKey = t.key;   /* مفتاح التراجع في القارئ */
  });

  el.addEventListener('pointermove', e => {
    /* تمرير بالإصبع */
    if(st.pan && st.touches.has(e.pointerId)){
      e.preventDefault();
      const prev = st.touches.get(e.pointerId);
      const n = st.touches.size || 1;
      const dx = (e.clientX - prev.x) / n, dy = (e.clientY - prev.y) / n;
      prev.x = e.clientX; prev.y = e.clientY;
      o.scrollEl.scrollTop -= dy; o.scrollEl.scrollLeft -= dx;
      const now = performance.now(), dt = Math.max(1, now - st.lastT);
      st.vy = 0.7 * st.vy + 0.3 * (dy * n / dt); st.vx = 0.7 * st.vx + 0.3 * (dx * n / dt);
      st.lastT = now;
      return;
    }
    const k = st.k;
    if(!k || k.id !== e.pointerId) return;
    e.preventDefault();
    if(e.pointerType === 'pen') inkLastPen = performance.now();
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    const list = evs.length ? evs : [e];
    const pts = k.s.points;
    for(const ev of list){
      const p = inkPoint(ev, k);
      if(k.shape){ pts[1] = p; continue; }
      const last = pts[pts.length - 1];
      if(Math.abs(last.x - p.x) * k.w < 0.7 && Math.abs(last.y - p.y) * k.h < 0.7) continue;
      pts.push(p);
    }
    if(!k.raf) k.raf = requestAnimationFrame(() => inkFlush(k));
  });

  const finish = e => {
    if(st.touches.has(e.pointerId)){
      st.touches.delete(e.pointerId);
      if(st.pan && st.touches.size === 0){
        st.pan = false;
        const unsnap = () => { o.scrollEl.style.scrollSnapType = ''; };
        /* قصور ذاتي بسيط بعد رفع الإصبع */
        if(performance.now() - st.lastT < 80 && (Math.abs(st.vy) > 0.25 || Math.abs(st.vx) > 0.25)){
          let vy = st.vy, vx = st.vx, t0 = performance.now();
          const step = t => {
            const dt = Math.min(40, t - t0); t0 = t;
            o.scrollEl.scrollTop -= vy * dt; o.scrollEl.scrollLeft -= vx * dt;
            vy *= 0.94; vx *= 0.94;
            st.inertia = (Math.abs(vy) > 0.03 || Math.abs(vx) > 0.03) ? requestAnimationFrame(step) : 0;
            if(!st.inertia) unsnap();
          };
          st.inertia = requestAnimationFrame(step);
        } else unsnap();
        return;
      }
    }
    const k = st.k;
    if(!k || k.id !== e.pointerId) return;
    if(k.raf) cancelAnimationFrame(k.raf);
    inkFlush(k);
    st.k = null;
    DRAW.drawing = false; DRAW.current = null; DRAW.targetCanvas = null;
    try{ el.releasePointerCapture(e.pointerId); }catch(x){}

    const s = k.s, pts = s.points;
    if(k.live){ const c = k.live.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, k.live.width, k.live.height); }
    if(k.shape){
      const a = pts[0], b = pts[1];
      if(!b || (Math.abs(a.x - b.x) * k.w < 4 && Math.abs(a.y - b.y) * k.h < 4)) return;   /* ضغطة بدون سحب */
    }
    /* نثبّت الخط على اللوحة (خط واحد فقط — بدون إعادة رسم الكل) */
    const ctx = k.canvas.getContext('2d');
    ctx.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
    if(s.tool === 'eraser'){
      if(pts.length > 1){
        ctx.save(); inkSetStyle(ctx, s, k.w, false);
        ctx.beginPath();
        ctx.moveTo((pts[pts.length - 2].x + pts[pts.length - 1].x) / 2 * k.w, (pts[pts.length - 2].y + pts[pts.length - 1].y) / 2 * k.h);
        ctx.lineTo(pts[pts.length - 1].x * k.w, pts[pts.length - 1].y * k.h);
        ctx.stroke(); ctx.restore();
      }
    } else drawStrokeOnCtx(ctx, s, k.w, k.h);

    if(!userData.drawings) userData.drawings = {};
    if(!userData.drawings[k.key]) userData.drawings[k.key] = [];
    const arr = userData.drawings[k.key];
    if(arr.length > 600) arr.shift();
    arr.push(s);
    delete DRAW.redo[k.key];
    saveDrawings();
    if(o.onCommit) try{ o.onCommit(k.key, k.canvas); }catch(x){}
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  return st;
}
window.inkBind = inkBind;

/* ================== لوحات الصفحات ================== */
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
  const pageEl = RS.pageEls[pageNum - 1];
  if(!pageEl) return;
  let c = pageEl.querySelector('.pg-draw');
  if(!has && !c) return;
  if(!c) c = ensureDrawCanvas(pageEl, pageNum);
  if(c) redrawCanvas(c, key);
}
function ensureDrawCanvas(pageEl, pageNum){
  if(!pageEl) return null;
  let c = pageEl.querySelector('.pg-draw');
  if(!c){
    c = document.createElement('canvas');
    c.className = 'pg-draw';
    c.dataset.page = String(pageNum);
    pageEl.appendChild(c);
    if(RS.file) redrawCanvas(c, drawKeyPdf(RS.file.id, pageNum));
  }
  return c;
}
function redrawWhiteboard(){
  const c = $('#wbCanvas'); if(!c) return;
  redrawCanvas(c, drawKeyWb(RS.file ? RS.file.id : 'default'));
  updateWbEmpty();
}
function updateWbEmpty(){
  const empty = $('#wbEmpty'); if(!empty) return;
  const key = drawKeyWb(RS.file ? RS.file.id : 'default');
  const has = userData.drawings && userData.drawings[key] && userData.drawings[key].length;
  empty.style.display = has ? 'none' : 'flex';
}
function refreshDrawSurface(){ redrawVisiblePdfDrawings(); redrawWhiteboard(); }

/* ================== تراجع / إعادة / مسح ================== */
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
    const page = parseInt(key.split(':')[2], 10);
    const el = RS.pageEls[page - 1];
    if(el){ const c = el.querySelector('.pg-draw'); if(c) redrawCanvas(c, key); }
  }
}
function undoDraw(){
  const key = currentDrawKey();
  const arr = key && userData.drawings ? userData.drawings[key] : null;
  if(!arr || !arr.length){ toast('لا يوجد رسم للتراجع عنه', 'warn'); return; }
  (DRAW.redo[key] = DRAW.redo[key] || []).push(arr.pop());
  saveDrawings(); redrawSurfaceByKey(key);
}
function redoDraw(){
  const key = currentDrawKey();
  const stack = key ? DRAW.redo[key] : null;
  if(!stack || !stack.length){ toast('لا يوجد شيء لإعادته', 'warn'); return; }
  if(!userData.drawings[key]) userData.drawings[key] = [];
  userData.drawings[key].push(stack.pop());
  saveDrawings(); redrawSurfaceByKey(key);
}
window.redoDraw = redoDraw;
function clearDraw(){
  const key = currentDrawKey();
  const arr = key && userData.drawings ? userData.drawings[key] : null;
  if(!arr || !arr.length){ toast('لا يوجد رسم لمسحه', 'warn'); return; }
  confirmBox('مسح الرسم', 'سيتم مسح كل الرسم على هذه الصفحة/الصبورة. هل أنت متأكد؟', () => {
    delete userData.drawings[key];
    delete DRAW.redo[key];
    saveDrawings(); redrawSurfaceByKey(key);
    if(key.startsWith('wb:')) updateWbEmpty();
    toast('تم مسح الرسم', 'ok');
  }, true);
}

/* ================== شريط الأدوات ================== */
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
  $$('#drawBar .dtool[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
}
/* ✍️ وضع القلم: القلم يكتب والإصبع يمرّر */
function setPenMode(on){
  DRAW.penMode = !!on;
  try{ localStorage.setItem('abq_pen_mode', on ? '1' : '0'); }catch(e){}
  const b = $('#drawPenMode'); if(b) b.classList.toggle('on', DRAW.penMode);
}
window.setPenMode = setPenMode;
function updateDrawBarVisibility(){
  const bar = $('#drawBar'); if(!bar) return;
  bar.classList.toggle('on', DRAW.active || DRAW.wb);
}
function toggleDrawMode(){
  DRAW.active = !DRAW.active;
  const btn = $('#rdDraw'); if(btn) btn.classList.toggle('on', DRAW.active);
  if(rdBody){
    rdBody.classList.toggle('draw-on', DRAW.active);
    if(DRAW.active) rdBody.classList.remove('ink-hidden');
  }
  const hb = $('#drawHide'); if(hb && DRAW.active) hb.classList.remove('on');
  updateDrawBarVisibility();
  if(DRAW.active){
    DRAW.lastKey = null;
    toast(DRAW.penMode ? 'وضع الرسم مُفعّل — اكتب بالقلم ومرّر بإصبعك' : 'وضع الرسم مُفعّل — ارسم على الصفحة (إصبعين للتمرير)', 'ok');
  }
}
function toggleWhiteboard(){
  DRAW.wb = !DRAW.wb;
  const btn = $('#rdWb'); if(btn) btn.classList.toggle('on', DRAW.wb);
  const panel = $('#wbPanel'); if(panel) panel.classList.toggle('open', DRAW.wb);
  updateDrawBarVisibility();
  if(DRAW.wb){ if(!DRAW.active) DRAW.lastKey = null; setTimeout(() => { redrawWhiteboard(); }, 320); toast('الصبورة البيضاء مفتوحة', 'ok'); }
}

/* 🖼️ خلفية السبورة: سادة / مربعات / سطور */
const WB_BGS = ['plain', 'grid', 'lines'];
function setWbBg(bg){
  if(!WB_BGS.includes(bg)) bg = 'plain';
  DRAW.wbBg = bg;
  try{ localStorage.setItem('abq_wb_bg', bg); }catch(e){}
  const stage = document.querySelector('#wbPanel .wb-stage');
  if(stage){ WB_BGS.forEach(x => stage.classList.toggle('bg-' + x, x === bg)); }
}
/* 💾 حفظ السبورة كصورة */
function downloadWhiteboard(){
  const c = $('#wbCanvas');
  const key = drawKeyWb(RS.file ? RS.file.id : 'default');
  if(!c || !(userData.drawings && userData.drawings[key] && userData.drawings[key].length)){ toast('السبورة فاضية', 'warn'); return; }
  const out = document.createElement('canvas');
  out.width = c.width; out.height = c.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0);
  out.toBlob(b => {
    if(!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'سبورة-' + String(RS.file ? RS.file.title : 'عباقرة-القدرات').replace(/\s+/g, '-') + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('✓ تم حفظ السبورة كصورة', 'ok');
  }, 'image/png');
}

function setupDrawUI(){
  renderDrawToolbar();
  try{ DRAW.penMode = localStorage.getItem('abq_pen_mode') === '1'; DRAW.penAsked = localStorage.getItem('abq_pen_mode') !== null; }catch(e){}
  setPenMode(DRAW.penMode);
  try{ setWbBg(localStorage.getItem('abq_wb_bg') || 'plain'); }catch(e){ setWbBg('plain'); }

  const style = () => ({ tool: DRAW.tool, color: DRAW.color, size: DRAW.size });

  /* الكتابة على الصفحات: مستمع واحد على جسم القارئ (يشتغل على أي صفحة حتى اللي ظهرت بعد التمرير) */
  if(typeof rdBody !== 'undefined' && rdBody && !rdBody.dataset.ink){
    rdBody.dataset.ink = '1';
    inkBind(rdBody, {
      enabled: () => DRAW.active && !!RS.file,
      scrollEl: rdBody,
      style,
      resolve: e => {
        const pageEl = e.target && e.target.closest ? e.target.closest('.pdf-page') : null;
        if(!pageEl) return null;
        const num = RS.pageEls.indexOf(pageEl) + 1;
        if(num < 1) return null;
        return { canvas: ensureDrawCanvas(pageEl, num), key: drawKeyPdf(RS.file.id, num) };
      }
    });
  }

  const wbCanvas = $('#wbCanvas');
  if(wbCanvas && !wbCanvas.dataset.init){
    wbCanvas.dataset.init = '1';
    inkBind(wbCanvas, {
      enabled: () => !!RS.file,
      style,
      resolve: () => ({ canvas: wbCanvas, key: drawKeyWb(RS.file.id) }),
      onCommit: () => updateWbEmpty()
    });
  }

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
  if(bar) bar.querySelectorAll('.dtool[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  const und = $('#drawUndo'); if(und) und.addEventListener('click', undoDraw);
  const red = $('#drawRedo'); if(red) red.addEventListener('click', redoDraw);
  const clr = $('#drawClear'); if(clr) clr.addEventListener('click', clearDraw);
  const pm = $('#drawPenMode');
  if(pm) pm.addEventListener('click', () => {
    DRAW.penAsked = true;
    setPenMode(!DRAW.penMode);
    toast(DRAW.penMode ? '✍️ وضع القلم: القلم يكتب والإصبع يمرّر الصفحة' : 'وضع القلم مُطفأ — الإصبع يكتب (إصبعين للتمرير)', 'ok');
  });
  const hide = $('#drawHide');
  if(hide) hide.addEventListener('click', () => {
    const off = rdBody.classList.toggle('ink-hidden');
    hide.classList.toggle('on', off);
    toast(off ? 'تم إخفاء كتابتك مؤقتاً' : 'تم إظهار كتابتك', 'ok');
  });
  const wbBg = $('#wbBgBtn');
  if(wbBg) wbBg.addEventListener('click', () => {
    setWbBg(WB_BGS[(WB_BGS.indexOf(DRAW.wbBg) + 1) % WB_BGS.length]);
    toast({ plain: 'سبورة سادة', grid: 'سبورة مربعات', lines: 'سبورة سطور' }[DRAW.wbBg], 'ok');
  });
  const wbSave = $('#wbSaveBtn'); if(wbSave) wbSave.addEventListener('click', downloadWhiteboard);

  /* اختصارات: Ctrl+Z تراجع • Ctrl+Y إعادة */
  document.addEventListener('keydown', e => {
    if(!(DRAW.active || DRAW.wb) || !(e.ctrlKey || e.metaKey)) return;
    const tag = (e.target && e.target.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = String(e.key).toLowerCase();
    if(k === 'z' && !e.shiftKey){ e.preventDefault(); undoDraw(); }
    else if(k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); redoDraw(); }
  });

  let wbResizeTimer = null;
  window.addEventListener('resize', () => {
    if(!DRAW.wb) return;
    clearTimeout(wbResizeTimer);
    wbResizeTimer = setTimeout(() => redrawWhiteboard(), 220);
  });
}
