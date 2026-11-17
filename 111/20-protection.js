/* ============================================================
   20) PROTECTION v3 — حماية قوية بدون شاشة بيضاء نهائياً
   - أُلغي كشف أدوات المطور (byConsole + bySize) لأنه كان
     يسبب شاشة بيضاء كاذبة مع الإضافات و autofill.
   - لا يوجد أي شيء يمحو الصفحة مهما حدث.
============================================================ */
(function(){
'use strict';

/* ⭐ تعطيل أي شاشة بيضاء قديمة */
window.triggerShield = function(){ /* no-op */ };
window.goWhite = function(){ /* no-op */ };

let warnedOnce = false;

const isEditable = el => {
  if(!el) return false;
  const t = (el.tagName || '').toLowerCase();
  return t === 'input' || t === 'textarea' || t === 'select' || el.isContentEditable;
};

/* ⭐ منع القائمة اليمنى (لكن اسمح بالحقول) */
document.addEventListener('contextmenu', e => {
  if(isEditable(e.target)) return;
  e.preventDefault();
});

/* ⭐ منع السحب والنسخ والتحديد (لكن اسمح بالحقول) */
['dragstart','drop','selectstart','copy','cut'].forEach(ev => {
  document.addEventListener(ev, e => {
    if(isEditable(e.target)) return;
    e.preventDefault();
    if(ev === 'copy' && !warnedOnce){
      warnedOnce = true;
      try{ toast('النسخ غير مسموح', 'warn'); }catch(x){}
    }
  });
});

/* ⭐ منع سحب الصور */
document.addEventListener('mousedown', e => {
  if(e.target && e.target.tagName === 'IMG') e.preventDefault();
});

/* ⭐ اختصارات لوحة المفاتيح — بدون أي شاشة بيضاء */
document.addEventListener('keydown', e => {
  const k = e.key, lk = (k || '').toLowerCase();
  const editing = isEditable(e.target);
  const ctrl = e.ctrlKey || e.metaKey;
  const readerEl = document.getElementById('reader');
  const videoEl = document.getElementById('videoPlayer');
  const readerOpen = readerEl ? readerEl.classList.contains('open') : false;
  const videoOpen = videoEl ? videoEl.classList.contains('open') : false;

  /* منع أدوات المطوّر (بصمت، بدون شاشة بيضاء) */
  if(k === 'F12'){ e.preventDefault(); return; }
  if(ctrl && e.shiftKey && ['i','j','c','k','e','m'].includes(lk)){ e.preventDefault(); return; }
  if(e.metaKey && e.altKey && ['i','j','c','u'].includes(lk)){ e.preventDefault(); return; }
  if(ctrl && !e.shiftKey && ['u','s'].includes(lk) && !editing){ e.preventDefault(); return; }
  if(ctrl && lk === 'a' && !editing){ e.preventDefault(); return; }

  /* PrintScreen — امسح الحافظة */
  if(k === 'PrintScreen'){
    try{ navigator.clipboard.writeText(' '); }catch(x){}
    return;
  }

  /* اختصارات القارئ */
  if(readerOpen && !editing && !ctrl){
    if(k === '+' || k === '='){ e.preventDefault(); try{ setZoom(RS.zoom + 0.15); }catch(x){} return; }
    if(k === '-' || k === '_'){ e.preventDefault(); try{ setZoom(RS.zoom - 0.15); }catch(x){} return; }
    if(k === 'ArrowLeft' || k === 'PageDown'){ e.preventDefault(); try{ scrollToPage(RS.current + 1, true); }catch(x){} return; }
    if(k === 'ArrowRight' || k === 'PageUp'){ e.preventDefault(); try{ scrollToPage(RS.current - 1, true); }catch(x){} return; }
    if(k === 'Home'){ e.preventDefault(); try{ scrollToPage(1, true); }catch(x){} return; }
    if(k === 'End'){ e.preventDefault(); try{ scrollToPage(RS.numPages, true); }catch(x){} return; }
    if(lk === 'p'){ e.preventDefault(); try{ toggleDrawMode(); }catch(x){} return; }
    if(lk === 'w'){ e.preventDefault(); try{ toggleWhiteboard(); }catch(x){} return; }
  }

  /* Escape */
  if(k === 'Escape'){
    const modal = document.getElementById('modal');
    if(modal && modal.classList.contains('open')){ modal.classList.remove('open'); return; }
    const mum = document.getElementById('mobileUserMenu');
    if(mum && mum.classList.contains('open')){ mum.classList.remove('open'); return; }
    if(videoOpen){ try{ closeVideoPlayer(); }catch(x){} return; }
    if(readerOpen){ try{ closeReader(); }catch(x){} return; }
    const thumbs = document.getElementById('rdThumbs');
    if(thumbs) thumbs.classList.remove('open');
    return;
  }

  /* Ctrl+K — فتح البحث */
  if(ctrl && lk === 'k'){
    e.preventDefault();
    const s = document.getElementById('searchInput');
    const appEl = document.getElementById('app');
    if(s && appEl && appEl.classList.contains('open')){ s.focus(); s.select(); }
    return;
  }

  /* اختصارات التنقل السريع */
  if(editing || ctrl || e.altKey) return;
  const appEl = document.getElementById('app');
  if(!appEl || !appEl.classList.contains('open')) return;
  if(readerOpen || videoOpen) return;
  const authEl = document.getElementById('auth');
  if(authEl && authEl.classList.contains('open')) return;

  if(k === '1') go('home');
  else if(k === '2') go('files');
  else if(k === '3') go('progress');
  else if(lk === 'v') go('videos');
  else if(lk === 'l') go('leaderboard');
  else if(lk === 'p') go('profile');
  else if(k === '4') go('features');
  else if(k === '5') go('settings');
  else if(k === '6' && window.currentUserObj &&
          (window.currentUserObj.role === 'admin' || window.currentUserObj.role === 'owner')) go('admin');
}, true);

/* ⭐ منع التضمين في iframe */
try{
  if(window.top !== window.self){
    window.top.location = window.self.location;
  }
}catch(e){ /* تجاهل */ }

/* ⭐ لا نعطّل console (كان يسبب مشاكل مع بعض الإضافات) */

console.log('✅ Protection v3 loaded — no white page');
})();
