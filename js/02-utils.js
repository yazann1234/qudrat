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

/* ============================================================
   💰 رمز الريال السعودي (صورة SVG بدل «ر.س»)
============================================================ */
function sarIcon(){ return '<i class="sar" role="img" aria-label="ريال سعودي"></i>'; }
function isSarCurrency(c){
  const s = String(c == null ? '' : c).trim().toLowerCase();
  return !s || s === 'ر.س' || s === 'رس' || s === 'ريال' || s === 'sar' || s === 'sr' || s === '﷼';
}
/* يعرض السعر مع رمز الريال (أو العملة المكتوبة إن كانت غير الريال) */
function priceHTML(amount, currency){
  const n = Number(amount) || 0;
  const num = Number.isInteger(n) ? String(n) : n.toFixed(2);
  const cur = isSarCurrency(currency) ? sarIcon() : `<span class="cur-txt">${escapeHtml(currency)}</span>`;
  return `<span class="price-wrap"><b class="price-num">${num}</b>${cur}</span>`;
}
window.sarIcon = sarIcon;
window.priceHTML = priceHTML;
window.isSarCurrency = isSarCurrency;

/* ============================================================
   🛡️ كتابة آمنة في Supabase: لو عمود غير موجود بالجدول
   نحذفه من الـ payload ونعيد المحاولة بدل ما تفشل العملية كلها
============================================================ */
async function sbSafeWrite(run, payload){
  let p = Object.assign({}, payload);
  let r = null;
  for(let i = 0; i < 8; i++){
    r = await run(p);
    if(!r || !r.error) return r;
    const msg = r.error.message || '';
    const m = /'([^']+)' column/.exec(msg) || /column "?([\w]+)"? (?:of relation \S+ )?does not exist/i.exec(msg);
    if(m && Object.prototype.hasOwnProperty.call(p, m[1])){
      console.warn('[sbSafeWrite] عمود غير موجود، تم تجاهله:', m[1]);
      delete p[m[1]];
      continue;
    }
    return r;
  }
  return r;
}
window.sbSafeWrite = sbSafeWrite;

function debounce(fn, ms){
  let t = null;
  return function(){ const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); };
}
window.debounce = debounce;
