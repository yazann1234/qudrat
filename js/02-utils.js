/* ============================================================
   02) UTILS — أدوات عامة
============================================================ */

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function uuidv4(){
  if(window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function togglePassVis(inputId, btn){
  const inp = document.getElementById(inputId);
  if(!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if(icon){ icon.className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye'; }
}
window.togglePassVis = togglePassVis;

function toast(msg, type=''){
  const box = $('#toast'); if(!box) return;
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  let ic = 'fa-circle-info';
  if(type === 'ok') ic = 'fa-circle-check';
  else if(type === 'warn') ic = 'fa-triangle-exclamation';
  else if(type === 'err') ic = 'fa-circle-xmark';
  el.innerHTML = `<i class="fas ${ic}"></i><span>${escapeHtml(msg)}</span>`;
  box.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 420); }, 3200);
  while(box.children.length > 4) box.removeChild(box.firstChild);
}

function beep(){
  try{
    if(!userData.sound) return;
    const Ctx = window.AudioContext || window.webkitAudioContext; if(!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    o.start(); o.stop(ctx.currentTime + 0.95);
    setTimeout(()=>{ try{ctx.close();}catch(e){} }, 1200);
  }catch(e){}
}

function dayKey(d){ const dt = d || new Date(); return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0'); }
function fmtTime(s){ const m = Math.floor(Math.max(0,s)/60), ss = Math.max(0,s)%60; return String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0'); }

function openModal({title, text, bodyHTML, okText, onOk, danger}){
  const m = $('#modal');
  $('#modalTitle').innerHTML = `<i class="fas ${danger?'fa-triangle-exclamation':'fa-circle-info'}"></i> <span>${escapeHtml(title||'')}</span>`;
  $('#modalText').innerHTML = text || '';
  $('#modalBody').innerHTML = bodyHTML || '';
  const ok = $('#modalOk'), cancel = $('#modalCancel');
  ok.textContent = okText || 'تأكيد';
  ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
  cancel.textContent = 'إلغاء';
  cancel.style.display = onOk ? '' : 'none';
  m.classList.add('open');
  const close = () => { m.classList.remove('open'); ok.onclick = null; };
  ok.onclick = () => { close(); if(onOk) onOk($('#modalBody')); };
  cancel.onclick = close;
  m.onclick = e => { if(e.target === m) close(); };
}
function confirmBox(title, text, onOk, danger){ openModal({title, text, okText: danger ? 'تأكيد الحذف' : 'تأكيد', onOk, danger}); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
