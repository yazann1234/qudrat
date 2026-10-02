/* ============================================================
   20) PROTECTION — حماية شاملة
============================================================ */

const isEditable = el => {
  if(!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};

/* ============================================================
   1) منع قائمة السياق (Right-Click)
============================================================ */
document.addEventListener('contextmenu', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
  try{ toast('قائمة السياق معطّلة لحماية المحتوى', 'warn'); }catch(x){}
});

/* ============================================================
   2) منع السحب والسحب-والإفلات
============================================================ */
document.addEventListener('dragstart', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
});
document.addEventListener('drop', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
});

/* ============================================================
   3) منع النسخ والقص
============================================================ */
document.addEventListener('copy', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
  try{ toast('النسخ غير مسموح', 'warn'); }catch(x){}
});
document.addEventListener('cut', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
});

/* ============================================================
   4) منع السيلكت
============================================================ */
document.addEventListener('selectstart', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
});

/* ============================================================
   5) اختصارات لوحة المفاتيح
============================================================ */
document.addEventListener('keydown', e => {
  const k = e.key;
  const editing = isEditable(e.target);
  const readerOpen = document.getElementById('reader')?.classList.contains('open');
  const videoOpen = document.getElementById('videoPlayer')?.classList.contains('open');

  /* منع DevTools */
  if(k === 'F12'){ e.preventDefault(); triggerShield(); return false; }

  if(e.ctrlKey && e.shiftKey){
    const bad = ['I','J','C','K','i','j','c','k'].includes(k);
    if(bad){ e.preventDefault(); triggerShield(); return false; }
  }

  if(e.ctrlKey && !e.shiftKey){
    if(['u','U','s','S'].includes(k)){ e.preventDefault(); triggerShield(); return false; }
  }

  /* Ctrl+P (طباعة) */
  if(e.ctrlKey && (k === 'p' || k === 'P')){ e.preventDefault(); triggerShield(); return false; }

  /* Ctrl+A خارج الحقول */
  if(e.ctrlKey && (k === 'a' || k === 'A') && !editing){ e.preventDefault(); return false; }

  /* اختصارات القارئ */
  if(readerOpen && !editing){
    if(k === '+' || k === '='){ e.preventDefault(); setZoom(RS.zoom + 0.15); return; }
    if(k === '-' || k === '_'){ e.preventDefault(); setZoom(RS.zoom - 0.15); return; }
    if(k === 'ArrowLeft'){ e.preventDefault(); scrollToPage(RS.current + 1, true); return; }
    if(k === 'ArrowRight'){ e.preventDefault(); scrollToPage(RS.current - 1, true); return; }
    if(k === 'Home'){ e.preventDefault(); scrollToPage(1, true); return; }
    if(k === 'End'){ e.preventDefault(); scrollToPage(RS.numPages, true); return; }
    if(k === 'p' || k === 'P'){ e.preventDefault(); if(typeof toggleDrawMode === 'function') toggleDrawMode(); return; }
    if(k === 'w' || k === 'W'){ e.preventDefault(); if(typeof toggleWhiteboard === 'function') toggleWhiteboard(); return; }
  }

  /* ESC */
  if(k === 'Escape'){
    const modal = document.getElementById('modal');
    if(modal && modal.classList.contains('open')){ modal.classList.remove('open'); return; }
    const mum = document.getElementById('mobileUserMenu');
    if(mum && mum.classList.contains('open')){ mum.classList.remove('open'); return; }
    if(videoOpen){ if(typeof closeVideoPlayer === 'function') closeVideoPlayer(); return; }
    if(readerOpen){ closeReader(); return; }
    const th = document.getElementById('rdThumbs');
    if(th) th.classList.remove('open');
    return;
  }

  /* Ctrl+K للبحث */
  if(e.ctrlKey && (k === 'k' || k === 'K')){
    e.preventDefault();
    const s = document.getElementById('searchInput');
    if(s && document.getElementById('app').classList.contains('open')){
      s.focus(); s.select();
    }
    return;
  }

  if(editing) return;
  if(e.ctrlKey || e.altKey || e.metaKey) return;

  /* اختصارات التنقل */
  if(k === '1') go('home');
  if(k === '2') go('files');
  if(k === '3') go('progress');
  if(k === 'v' || k === 'V') go('videos');
  if(k === 'l' || k === 'L') go('leaderboard');
  if(k === 'p' || k === 'P') go('profile');
  if(k === '4') go('features');
  if(k === '5') go('settings');
  if(k === '6' && currentUserObj && (currentUserObj.role === 'admin' || currentUserObj.role === 'owner')) go('admin');
});

/* ============================================================
   6) كشف DevTools — متعدد الطرق
============================================================ */
let devtoolsOpen = false;
let shieldActive = false;

function detectBySize(){
  if(window.innerWidth <= 720) return false;
  const wDiff = window.outerWidth - window.innerWidth;
  const hDiff = window.outerHeight - window.innerHeight;
  return (wDiff > 260 || hDiff > 280);
}

/* كشف بـ timing — دقة عالية */
function detectByTiming(){
  const start = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  const end = performance.now();
  return (end - start) > 100;
}

/* كشف بـ console.log getter */
function detectByConsole(){
  let detected = false;
  const el = new Image();
  Object.defineProperty(el, 'id', {
    get(){
      detected = true;
      return 'x';
    }
  });
  try{
    console.log(el);
    console.clear();
  }catch(e){}
  return detected;
}

function checkDevtools(){
  if(detectBySize() || detectByTiming()){
    if(!shieldActive) triggerShield();
    return true;
  }
  return false;
}

let devtoolsInterval = null;
function startDevtoolsDetection(){
  if(devtoolsInterval) clearInterval(devtoolsInterval);
  devtoolsInterval = setInterval(() => {
    const app = document.getElementById('app');
    if(!app || !app.classList.contains('open')) return;
    checkDevtools();
  }, 800);
}

/* ============================================================
   7) العقوبة — شاشة بيضاء
============================================================ */
function triggerShield(){
  if(shieldActive) return;
  shieldActive = true;
  devtoolsOpen = true;

  try{
    const shield = document.getElementById('shield');
    if(shield) shield.classList.add('on');
  }catch(e){}

  /* ⭐ اجعل الصفحة بيضاء */
  try{
    /* أوقف كل شيء */
    if(typeof RS !== 'undefined' && RS.clockId){
      clearInterval(RS.clockId);
    }
    if(typeof stopReadClock === 'function') stopReadClock();

    /* أخفِ كل المحتوى */
    document.body.style.background = '#fff';
    document.body.innerHTML = '';
    document.documentElement.style.background = '#fff';

    /* امسح الجلسة أيضاً */
    try{ sessionStorage.clear(); }catch(e){}
  }catch(e){}

  /* امنع أي تفاعل */
  document.addEventListener('keydown', e => {
    if(shieldActive){ e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('click', e => {
    if(shieldActive){ e.preventDefault(); e.stopPropagation(); }
  }, true);
}

window.triggerShield = triggerShield;

/* ============================================================
   8) منع التضمين في iframe
============================================================ */
try{
  if(window.top !== window.self){
    /* في iframe → امنع */
    document.documentElement.innerHTML = '';
    window.top.location = window.self.location;
  }
}catch(e){}

/* ============================================================
   9) منع حفظ الصفحة (Ctrl+S)
============================================================ */
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){
    e.preventDefault();
    try{ toast('حفظ الصفحة معطّل', 'warn'); }catch(x){}
    return false;
  }
}, true);

/* ============================================================
   10) منع الطباعة
============================================================ */
window.addEventListener('beforeprint', e => {
  try{ triggerShield(); }catch(x){}
});

/* ============================================================
   11) تشغيل المراقبة
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  startDevtoolsDetection();

  /* فحص إضافي عند visibility change */
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden) setTimeout(checkDevtools, 300);
  });

  /* فحص عند تغيير الحجم (فتح/إغلاق devtools يغير الأحجام) */
  let resizeCheck;
  window.addEventListener('resize', () => {
    clearTimeout(resizeCheck);
    resizeCheck = setTimeout(checkDevtools, 500);
  });

  /* منع تحميل الصفحة في tab آخر لأخذ screenshot */
  window.addEventListener('blur', () => {
    /* لا نعاقب، فقط نراقب */
  });
});

/* ============================================================
   12) تنظيف
============================================================ */
window.addEventListener('beforeunload', () => {
  try{
    if(devtoolsInterval) clearInterval(devtoolsInterval);
    if(typeof RS !== 'undefined' && RS.clockId) clearInterval(RS.clockId);
  }catch(e){}
});
