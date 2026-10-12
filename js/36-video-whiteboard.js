/* ============================================================
   36) VIDEO WHITEBOARD — سبورة مصغّرة داخل مشغل الفيديو
   - تعمل مع وضع الانقسام (فيديو + ملف) أو مع الفيديو فقط
   - تتحرك بالسحب، وتكبر/تصغر بالسحب من الزاوية أو بأزرار الحجم
   - قلم / هايلايت / ممحاة + ألوان + أحجام + تراجع + مسح
   - تنحفظ لكل فيديو (تُزامن مع رسوماتك في الحساب)
============================================================ */

const VWB = {
  open: false,
  tool: 'pen',
  color: '#ef4444',
  size: 4,
  drawing: false,
  current: null,
  key: null,
  panel: null,
  canvas: null,
  ro: null
};

const VWB_SIZES = { s: [300, 220], m: [440, 320], l: [640, 460] };
const VWB_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#000000'];

function vwbKey(){
  return 'vwb:' + (typeof VP !== 'undefined' && VP.video ? VP.video.id : 'default');
}

function vwbBuild(){
  if(VWB.panel) return VWB.panel;
  const host = document.querySelector('#videoPlayer .vp-box');
  if(!host) return null;

  const p = document.createElement('div');
  p.className = 'vwb-panel';
  p.id = 'vwbPanel';
  p.innerHTML = `
    <div class="vwb-head" id="vwbHead">
      <i class="fas fa-grip-vertical vwb-grip"></i>
      <b><i class="fas fa-chalkboard"></i> السبورة</b>
      <div class="vwb-sizes">
        <button data-sz="s" title="صغيرة">S</button>
        <button data-sz="m" title="متوسطة" class="on">M</button>
        <button data-sz="l" title="كبيرة">L</button>
      </div>
      <button class="vwb-x" id="vwbClose" title="إغلاق"><i class="fas fa-xmark"></i></button>
    </div>
    <div class="vwb-tools">
      <button class="vwb-t on" data-tool="pen" title="قلم"><i class="fas fa-pen"></i></button>
      <button class="vwb-t" data-tool="marker" title="هايلايت"><i class="fas fa-highlighter"></i></button>
      <button class="vwb-t" data-tool="eraser" title="ممحاة"><i class="fas fa-eraser"></i></button>
      <span class="vwb-sep"></span>
      ${VWB_COLORS.map((c, i) => `<button class="vwb-c ${i === 0 ? 'on' : ''}" data-c="${c}" style="--c:${c}" title="لون"></button>`).join('')}
      <span class="vwb-sep"></span>
      <select class="vwb-w" title="سُمك القلم">
        <option value="2">رفيع</option><option value="4" selected>عادي</option><option value="8">عريض</option><option value="14">عريض جداً</option>
      </select>
      <span class="vwb-sep"></span>
      <button class="vwb-t" id="vwbUndo" title="تراجع"><i class="fas fa-rotate-left"></i></button>
      <button class="vwb-t danger" id="vwbClear" title="مسح الكل"><i class="fas fa-trash"></i></button>
    </div>
    <div class="vwb-canvas-wrap"><canvas id="vwbCanvas"></canvas></div>
    <div class="vwb-resize" id="vwbResize" title="اسحب لتغيير الحجم"><i class="fas fa-up-right-and-down-left-from-center"></i></div>
  `;
  host.appendChild(p);
  VWB.panel = p;
  VWB.canvas = p.querySelector('#vwbCanvas');

  /* الأدوات */
  p.querySelectorAll('.vwb-t[data-tool]').forEach(b => b.addEventListener('click', () => {
    VWB.tool = b.dataset.tool;
    p.querySelectorAll('.vwb-t[data-tool]').forEach(x => x.classList.toggle('on', x === b));
  }));
  p.querySelectorAll('.vwb-c').forEach(b => b.addEventListener('click', () => {
    VWB.color = b.dataset.c;
    p.querySelectorAll('.vwb-c').forEach(x => x.classList.toggle('on', x === b));
    if(VWB.tool === 'eraser'){ VWB.tool = 'pen'; p.querySelectorAll('.vwb-t[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === 'pen')); }
  }));
  p.querySelector('.vwb-w').addEventListener('change', e => { VWB.size = parseInt(e.target.value, 10) || 4; });
  p.querySelector('#vwbUndo').addEventListener('click', vwbUndo);
  p.querySelector('#vwbClear').addEventListener('click', vwbClear);
  p.querySelector('#vwbClose').addEventListener('click', () => vwbToggle(false));
  p.querySelectorAll('.vwb-sizes button').forEach(b => b.addEventListener('click', () => vwbSetSize(b.dataset.sz)));

  vwbBindDraw();
  vwbBindDrag(p.querySelector('#vwbHead'));
  vwbBindResize(p.querySelector('#vwbResize'));

  if(window.ResizeObserver){
    VWB.ro = new ResizeObserver(() => vwbRedraw());
    VWB.ro.observe(p.querySelector('.vwb-canvas-wrap'));
  }
  return p;
}

/* ================== فتح/إغلاق/حجم ================== */
async function vwbToggle(force){
  const want = typeof force === 'boolean' ? force : !VWB.open;
  const p = vwbBuild();
  if(!p) return;
  VWB.open = want;
  p.classList.toggle('open', want);
  const btn = document.getElementById('vpWbBtn'); if(btn) btn.classList.toggle('on', want);
  if(want){
    VWB.key = vwbKey();
    try{ if(typeof loadDrawingsForFile === 'function') await loadDrawingsForFile(null); }catch(e){}
    if(!p.dataset.placed){ p.dataset.placed = '1'; vwbSetSize(window.innerWidth < 720 ? 's' : 'm', true); }
    vwbClamp();
    setTimeout(vwbRedraw, 30);
  }
}
window.vwbToggle = vwbToggle;

function vwbSetSize(sz, initial){
  const p = VWB.panel; if(!p) return;
  const host = p.parentNode.getBoundingClientRect();
  let [w, h] = VWB_SIZES[sz] || VWB_SIZES.m;
  w = Math.min(w, host.width - 20); h = Math.min(h, host.height - 90);
  p.style.width = w + 'px';
  p.style.height = h + 'px';
  if(initial){
    p.style.left = '14px';
    p.style.top = Math.max(70, host.height - h - 90) + 'px';
  }
  p.querySelectorAll('.vwb-sizes button').forEach(b => b.classList.toggle('on', b.dataset.sz === sz));
  vwbClamp();
  setTimeout(vwbRedraw, 20);
}

function vwbClamp(){
  const p = VWB.panel; if(!p) return;
  const host = p.parentNode.getBoundingClientRect();
  const w = p.offsetWidth, h = p.offsetHeight;
  let left = parseFloat(p.style.left) || 0, top = parseFloat(p.style.top) || 0;
  left = Math.min(Math.max(0, left), Math.max(0, host.width - w));
  top = Math.min(Math.max(0, top), Math.max(0, host.height - h));
  p.style.left = left + 'px'; p.style.top = top + 'px';
}

/* سحب اللوحة من الشريط العلوي */
function vwbBindDrag(handle){
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
  handle.addEventListener('pointerdown', e => {
    if(e.target.closest('button')) return;
    dragging = true;
    const p = VWB.panel;
    sx = e.clientX; sy = e.clientY;
    ox = parseFloat(p.style.left) || 0; oy = parseFloat(p.style.top) || 0;
    try{ handle.setPointerCapture(e.pointerId); }catch(x){}
    p.classList.add('dragging');
  });
  handle.addEventListener('pointermove', e => {
    if(!dragging) return;
    const p = VWB.panel;
    p.style.left = (ox + e.clientX - sx) + 'px';
    p.style.top = (oy + e.clientY - sy) + 'px';
    vwbClamp();
  });
  const end = () => { dragging = false; if(VWB.panel) VWB.panel.classList.remove('dragging'); };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* تغيير الحجم بسحب الزاوية */
function vwbBindResize(grip){
  let sx = 0, sy = 0, ow = 0, oh = 0, active = false;
  grip.addEventListener('pointerdown', e => {
    e.preventDefault();
    active = true;
    const p = VWB.panel;
    sx = e.clientX; sy = e.clientY; ow = p.offsetWidth; oh = p.offsetHeight;
    try{ grip.setPointerCapture(e.pointerId); }catch(x){}
    p.classList.add('dragging');
    p.querySelectorAll('.vwb-sizes button').forEach(b => b.classList.remove('on'));
  });
  grip.addEventListener('pointermove', e => {
    if(!active) return;
    const p = VWB.panel;
    const host = p.parentNode.getBoundingClientRect();
    const left = parseFloat(p.style.left) || 0, top = parseFloat(p.style.top) || 0;
    const w = Math.min(Math.max(240, ow + (e.clientX - sx)), host.width - left);
    const h = Math.min(Math.max(180, oh + (e.clientY - sy)), host.height - top);
    p.style.width = w + 'px'; p.style.height = h + 'px';
  });
  const end = () => { active = false; if(VWB.panel) VWB.panel.classList.remove('dragging'); vwbRedraw(); };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

/* ================== الرسم ================== */
function vwbStrokes(){
  if(!userData.drawings) userData.drawings = {};
  return userData.drawings[VWB.key] || [];
}

function vwbRedraw(){
  const c = VWB.canvas; if(!c || !VWB.open) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = c.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
  if(c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)){ c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const list = vwbStrokes().slice();
  if(VWB.current) list.push(VWB.current);
  list.forEach(s => { try{ drawStrokeOnCtx(ctx, s, w, h); }catch(e){} });
}

function vwbPoint(e){
  const r = VWB.canvas.getBoundingClientRect();
  return {
    x: Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * 1000) / 1000,
    y: Math.round(Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height))) * 1000) / 1000
  };
}

function vwbBindDraw(){
  const c = VWB.canvas;
  c.addEventListener('pointerdown', e => {
    e.preventDefault();
    try{ c.setPointerCapture(e.pointerId); }catch(x){}
    VWB.drawing = true;
    VWB.key = vwbKey();
    VWB.current = { tool: VWB.tool, color: VWB.color, size: VWB.size, points: [vwbPoint(e)] };
    vwbRedraw();
  });
  c.addEventListener('pointermove', e => {
    if(!VWB.drawing || !VWB.current) return;
    e.preventDefault();
    const p = vwbPoint(e);
    const last = VWB.current.points[VWB.current.points.length - 1];
    if(last && Math.abs(last.x - p.x) < 0.002 && Math.abs(last.y - p.y) < 0.002) return;
    VWB.current.points.push(p);
    vwbRedraw();
  });
  const end = () => {
    if(!VWB.drawing || !VWB.current) return;
    VWB.drawing = false;
    if(!userData.drawings) userData.drawings = {};
    if(!userData.drawings[VWB.key]) userData.drawings[VWB.key] = [];
    const arr = userData.drawings[VWB.key];
    if(arr.length > 400) arr.shift();
    arr.push(VWB.current);
    VWB.current = null;
    try{ saveDrawings(); }catch(e){}
    vwbRedraw();
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
}

function vwbUndo(){
  const arr = vwbStrokes();
  if(!arr.length){ toast('لا يوجد رسم للتراجع عنه', 'warn'); return; }
  arr.pop();
  try{ saveDrawings(); }catch(e){}
  vwbRedraw();
}
function vwbClear(){
  if(!vwbStrokes().length){ toast('السبورة فاضية', 'warn'); return; }
  confirmBox('مسح السبورة', 'مسح كل ما في السبورة لهذا الفيديو؟', () => {
    delete userData.drawings[VWB.key];
    try{ saveDrawings(); }catch(e){}
    vwbRedraw();
  }, true);
}

/* ================== الربط بالمشغل ================== */
document.addEventListener('DOMContentLoaded', () => {
  const tools = document.querySelector('#videoPlayer .rh-tools');
  if(tools && !document.getElementById('vpWbBtn')){
    const b = document.createElement('button');
    b.className = 'rh-btn';
    b.id = 'vpWbBtn';
    b.title = 'سبورة مصغّرة';
    b.innerHTML = '<i class="fas fa-chalkboard"></i> <span class="vp-tool-label">سبورة</span>';
    b.addEventListener('click', () => vwbToggle());
    tools.insertBefore(b, tools.firstChild);
  }
  window.addEventListener('resize', debounce(() => { if(VWB.open){ vwbClamp(); vwbRedraw(); } }, 150));
});

/* أغلق السبورة مع إغلاق المشغل + غيّر المفتاح عند تغيير الفيديو */
(function hookVideoPlayer(){
  const wrap = () => {
    if(typeof window.closeVideoPlayer !== 'function' || window._vwbHooked) return;
    window._vwbHooked = true;
    /* إغلاق المشغل (من أي زر) → نقفل السبورة */
    const vp = document.getElementById('videoPlayer');
    if(vp) new MutationObserver(() => {
      if(VWB.open && !vp.classList.contains('open')) vwbToggle(false);
    }).observe(vp, { attributes: true, attributeFilter: ['class'] });
    const origOpen = window.openVideo;
    if(typeof origOpen === 'function'){
      window.openVideo = async function(){
        const r = await origOpen.apply(this, arguments);
        if(VWB.open){ VWB.key = vwbKey(); vwbRedraw(); }
        return r;
      };
    }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap); else wrap();
})();
