/* ============================================================
   20) PROTECTION — الحماية والاختصارات
============================================================ */

const isEditable = el => {
  if(!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};

document.addEventListener('contextmenu', e => {
  if($('#reader').classList.contains('open')){ e.preventDefault(); return; }
  if(isEditable(e.target)) return;
  if(e.target.closest('.pdf-page')){ e.preventDefault(); }
});

document.addEventListener('keydown', e => {
  const k = e.key;
  const readerOpen = $('#reader').classList.contains('open');
  const editing = isEditable(e.target);
  if(k === 'F12'){ e.preventDefault(); flashShield(); return false; }
  if(e.ctrlKey && e.shiftKey && ['I','J','C','K','i','j','c','k'].includes(k)){ e.preventDefault(); flashShield(); return false; }
  if(e.ctrlKey && !e.shiftKey && ['u','U','s','S','p','P'].includes(k)){ e.preventDefault(); flashShield(); return false; }
  if(e.ctrlKey && (k === 'z' || k === 'Z') && readerOpen && !editing){ e.preventDefault(); undoDraw(); return; }
  if(e.ctrlKey && (k === 'k' || k === 'K')){ e.preventDefault(); const s = $('#searchInput'); if(s && $('#app').classList.contains('open')){ s.focus(); s.select(); } return; }
  if(readerOpen && !editing){
    if(k === '+' || k === '='){ e.preventDefault(); setZoom(RS.zoom + 0.15); return; }
    if(k === '-' || k === '_'){ e.preventDefault(); setZoom(RS.zoom - 0.15); return; }
    if(k === 'ArrowLeft'){ e.preventDefault(); scrollToPage(RS.current + 1, true); return; }
    if(k === 'ArrowRight'){ e.preventDefault(); scrollToPage(RS.current - 1, true); return; }
    if(k === 'Home'){ e.preventDefault(); scrollToPage(1, true); return; }
    if(k === 'End'){ e.preventDefault(); scrollToPage(RS.numPages, true); return; }
    if(k === 'p' || k === 'P'){ e.preventDefault(); toggleDrawMode(); return; }
    if(k === 'w' || k === 'W'){ e.preventDefault(); toggleWhiteboard(); return; }
  }
  if(k === 'Escape'){
    if($('#modal').classList.contains('open')){ $('#modal').classList.remove('open'); return; }
    const mum = $('#mobileUserMenu'); if(mum && mum.classList.contains('open')){ mum.classList.remove('open'); return; }
    if(readerOpen){ closeReader(); return; }
    const th = $('#rdThumbs'); if(th) th.classList.remove('open');
    return;
  }
  if(editing) return;
  if(e.ctrlKey || e.altKey || e.metaKey) return;
  if(k === '1') go('home');
  if(k === '2') go('files');
  if(k === '3') go('progress');
  if(k === 'l' || k === 'L') go('leaderboard');
  if(k === 'p' || k === 'P') go('profile');
  if(k === '4') go('features');
  if(k === '5') go('settings');
  if(k === '6' && currentUserObj && currentUserObj.role === 'admin') go('admin');
});

document.addEventListener('dragstart', e => { if($('#reader').classList.contains('open')) e.preventDefault(); });
document.addEventListener('copy', e => {
  if($('#reader').classList.contains('open') && !isEditable(e.target)){ e.preventDefault(); toast('النسخ غير مسموح داخل القارئ', 'warn'); }
});
document.addEventListener('cut', e => { if($('#reader').classList.contains('open') && !isEditable(e.target)) e.preventDefault(); });

let shieldTimer = null;
function flashShield(){
  const s = $('#shield'); s.classList.add('on');
  clearTimeout(shieldTimer);
  shieldTimer = setTimeout(() => s.classList.remove('on'), 2200);
}
function devtoolsOpen(){
  if(window.innerWidth <= 720) return false;
  const wDiff = window.outerWidth - window.innerWidth;
  const hDiff = window.outerHeight - window.innerHeight;
  return (wDiff > 260 || hDiff > 280);
}
let shieldCheck = 0;
setInterval(() => {
  if(!$('#app').classList.contains('open')) return;
  if(devtoolsOpen()){ shieldCheck++; if(shieldCheck >= 2){ $('#shield').classList.add('on'); stopReadClock(); } }
  else { shieldCheck = 0; $('#shield').classList.remove('on'); if($('#reader').classList.contains('open') && !RS.clockId) startReadClock(); }
}, 1200);
