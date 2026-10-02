/* ============================================================
   20) PROTECTION v2
   - فتح أدوات المطوّر → الصفحة تصبح بيضاء بالكامل فوراً
   - عند إغلاق الأدوات تُعاد الصفحة تلقائياً
   - كشف متعدد الطرق (حجم + توقيت debugger + console)
   - منع النسخ/الطباعة/الحفظ/المصدر/السحب/التحديد
   - تعطيل console وإخفاء المعلومات
   ملاحظة: حماية المتصفح تُصعّب الوصول ولا تلغيه 100%،
   الحماية الحقيقية تكون في Supabase (RLS + bucket خاص + روابط قصيرة).
============================================================ */
(function(){
'use strict';

let tripped = false;
let cleanTicks = 0;
const _dbg = console.debug.bind(console);   // نسخة أصلية للكشف قبل تعطيل الـ console

const isEditable = el => {
  if(!el) return false;
  const t = (el.tagName || '').toLowerCase();
  return t === 'input' || t === 'textarea' || t === 'select' || el.isContentEditable;
};
const warn = (m) => { try{ toast(m, 'warn'); }catch(e){} };
const appOpen = () => { const a = document.getElementById('app'); return !!(a && a.classList.contains('open')); };

/* ============================================================
   1) الصفحة البيضاء
============================================================ */
function goWhite(){
  if(tripped) return;
  tripped = true;
  try{ if(window.RS && RS.clockId) clearInterval(RS.clockId); }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}
  try{
    const root = document.documentElement;
    root.style.cssText = 'background:#fff!important;';
    document.body.replaceChildren();
    document.body.style.cssText = 'background:#fff!important;margin:0;overflow:hidden';
    document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(n => n.remove());
    document.title = ' ';
  }catch(e){}
  const block = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  ['keydown','click','contextmenu','mousedown','touchstart'].forEach(ev => window.addEventListener(ev, block, true));
}
window.triggerShield = goWhite;   // للتوافق مع بقية الملفات

/* ============================================================
   2) كشف أدوات المطوّر
============================================================ */
function bySize(){
  if(window.innerWidth <= 820) return false;          // الجوال/التابلت: لا نعتمد على الحجم
  const dpr = window.devicePixelRatio || 1;
  const wd = window.outerWidth - window.innerWidth;
  const hd = window.outerHeight - window.innerHeight;
  return (wd > 200 * Math.max(1, dpr * 0.6)) || (hd > 230 * Math.max(1, dpr * 0.6));
}

function byTiming(){
  const t = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return performance.now() - t > 120;
}

function byConsole(){
  let hit = false;
  const probe = new Error();
  Object.defineProperty(probe, 'stack', { configurable:true, get(){ hit = true; return ''; } });
  try{ _dbg(probe); }catch(e){}
  return hit;
}

function devtoolsOpen(){
  return bySize() || byTiming() || byConsole();
}

function tick(){
  const open = devtoolsOpen();
  if(open){
    cleanTicks = 0;
    if(!tripped) goWhite();
  } else if(tripped){
    /* تأكد 3 مرات متتالية أن الأدوات أُغلقت ثم أعد التحميل */
    if(++cleanTicks >= 3) location.reload();
  }
}
/* المؤقت يعيش خارج الـ DOM فيستمر بعد مسح الصفحة */
setInterval(tick, 700);
window.addEventListener('resize', () => setTimeout(tick, 150));
document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(tick, 200); });

/* ============================================================
   3) منع الأحداث
============================================================ */
document.addEventListener('contextmenu', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
});
['dragstart','drop','selectstart','copy','cut'].forEach(ev => {
  document.addEventListener(ev, e => {
    if(isEditable(e.target)) return;
    e.preventDefault();
    if(ev === 'copy') warn('النسخ غير مسموح');
  });
});

/* حماية الصور من السحب */
document.addEventListener('mousedown', e => { if(e.target && e.target.tagName === 'IMG') e.preventDefault(); });

/* ============================================================
   4) لوحة المفاتيح
============================================================ */
document.addEventListener('keydown', e => {
  if(tripped) return;
  const k = e.key, lk = (k || '').toLowerCase();
  const editing = isEditable(e.target);
  const readerOpen = document.getElementById('reader')?.classList.contains('open');
  const videoOpen = document.getElementById('videoPlayer')?.classList.contains('open');
  const ctrl = e.ctrlKey || e.metaKey;

  /* اختصارات أدوات المطوّر والمصدر */
  if(k === 'F12'){ e.preventDefault(); goWhite(); return; }
  if(ctrl && e.shiftKey && ['i','j','c','k','e','m'].includes(lk)){ e.preventDefault(); goWhite(); return; }
  if(e.metaKey && e.altKey && ['i','j','c','u'].includes(lk)){ e.preventDefault(); goWhite(); return; }   // Mac
  if(ctrl && !e.shiftKey && ['u','s','p'].includes(lk)){ e.preventDefault(); warn('هذا الإجراء غير مسموح'); return; }
  if(ctrl && lk === 'a' && !editing){ e.preventDefault(); return; }

  /* PrintScreen: امسح الحافظة */
  if(k === 'PrintScreen'){
    try{ navigator.clipboard.writeText(' '); }catch(x){}
    warn('لقطات الشاشة غير مسموحة');
    return;
  }

  /* اختصارات القارئ */
  if(readerOpen && !editing && !ctrl){
    if(k === '+' || k === '='){ e.preventDefault(); setZoom(RS.zoom + 0.15); return; }
    if(k === '-' || k === '_'){ e.preventDefault(); setZoom(RS.zoom - 0.15); return; }
    if(k === 'ArrowLeft' || k === 'PageDown'){ e.preventDefault(); scrollToPage(RS.current + 1, true); return; }
    if(k === 'ArrowRight' || k === 'PageUp'){ e.preventDefault(); scrollToPage(RS.current - 1, true); return; }
    if(k === 'Home'){ e.preventDefault(); scrollToPage(1, true); return; }
    if(k === 'End'){ e.preventDefault(); scrollToPage(RS.numPages, true); return; }
    if(lk === 'p'){ e.preventDefault(); if(typeof toggleDrawMode === 'function') toggleDrawMode(); return; }
    if(lk === 'w'){ e.preventDefault(); if(typeof toggleWhiteboard === 'function') toggleWhiteboard(); return; }
  }

  if(k === 'Escape'){
    const modal = document.getElementById('modal');
    if(modal?.classList.contains('open')){ modal.classList.remove('open'); return; }
    const mum = document.getElementById('mobileUserMenu');
    if(mum?.classList.contains('open')){ mum.classList.remove('open'); return; }
    if(videoOpen){ if(typeof closeVideoPlayer === 'function') closeVideoPlayer(); return; }
    if(readerOpen){ closeReader(); return; }
    document.getElementById('rdThumbs')?.classList.remove('open');
    return;
  }

  if(ctrl && lk === 'k'){
    e.preventDefault();
    const s = document.getElementById('searchInput');
    if(s && appOpen()){ s.focus(); s.select(); }
    return;
  }

  if(editing || ctrl || e.altKey || !appOpen()) return;
  if(readerOpen || videoOpen) return;

  if(k === '1') go('home');
  else if(k === '2') go('files');
  else if(k === '3') go('progress');
  else if(lk === 'v') go('videos');
  else if(lk === 'l') go('leaderboard');
  else if(lk === 'p') go('profile');
  else if(k === '4') go('features');
  else if(k === '5') go('settings');
  else if(k === '6' && currentUserObj && (currentUserObj.role === 'admin' || currentUserObj.role === 'owner')) go('admin');
}, true);

/* ============================================================
   5) منع التضمين في iframe + الطباعة
============================================================ */
try{
  if(window.top !== window.self){
    document.documentElement.replaceChildren();
    window.top.location = window.self.location;
  }
}catch(e){ goWhite(); }

window.addEventListener('beforeprint', () => { goWhite(); });

/* ============================================================
   6) تعطيل الـ console (لا يكشف معلومات)
============================================================ */
try{
  const noop = function(){};
  ['log','info','warn','error','debug','table','trace','dir','dirxml','group','groupEnd','time','timeEnd'].forEach(m => {
    try{ console[m] = noop; }catch(e){}
  });
}catch(e){}

/* ============================================================
   7) تنظيف
============================================================ */
})();
