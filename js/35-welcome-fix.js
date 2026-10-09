/* ============================================================
   35) WELCOME & AUTH FIX v2 — إصلاح نهائي
   - شاشة الترحيب تظهر دائماً لأي زائر بدون جلسة
   - زر الرجوع يعرض الترحيب بشكل موثوق
   - لا شاشة بيضاء مهما حدث
============================================================ */
(function(){
'use strict';

console.log('🔧 Welcome fix v2 loading...');

let _lastShow = 0;

/* ⭐ إظهار شاشة الترحيب */
window.showWelcomeSafe = function(){
  try{
    _lastShow = Date.now();
    window._APP_SCREEN = 'welcome';
    window._appInitialized = false;
    window._lastInitializedUserId = null;

    const w  = document.getElementById('welcome');
    const a  = document.getElementById('auth');
    const ap = document.getElementById('app');

    if(a)  a.classList.remove('open');
    if(ap) ap.classList.remove('open', 'store-only', 'ready');

    if(w){
      w.dataset.firstVisit = 'true';
      w.classList.remove('exit');
      w.style.display    = 'flex';
      w.style.opacity    = '1';
      w.style.visibility = 'visible';
      w.style.pointerEvents = 'auto';
    }

    /* شارة "تسجيل خروج" في الترحيب */
    const wl = document.getElementById('welcomeLogout');
    if(wl){
      try{
        sb.auth.getSession().then(r => {
          if(wl) wl.style.display = r.data.session ? 'inline-flex' : 'none';
        }).catch(() => { if(wl) wl.style.display = 'none'; });
      }catch(e){ if(wl) wl.style.display = 'none'; }
    }
  }catch(e){ console.warn('showWelcomeSafe error:', e); }
};

/* ⭐ إظهار شاشة الدخول */
window.showAuthSafe = function(){
  try{
    window._APP_SCREEN = 'auth';
    const w  = document.getElementById('welcome');
    const a  = document.getElementById('auth');
    const ap = document.getElementById('app');

    if(w){ w.classList.add('exit'); w.style.display = 'none'; }
    if(ap) ap.classList.remove('open', 'store-only', 'ready');
    if(a)  a.classList.add('open');

    if(typeof window.showAuthForm === 'function') window.showAuthForm('login');
  }catch(e){ console.warn('showAuthSafe error:', e); }
};

/* ⭐ استبدال كل الدوال القديمة */
function overrideAll(){
  window.showWelcome      = window.showWelcomeSafe;
  window.forceShowWelcome = window.showWelcomeSafe;
  window.showAuthScreen   = window.showAuthSafe;
  window.showWelcomeSafe  = window.showWelcomeSafe; /* حماية من overwrite */
  window.showAuthSafe     = window.showAuthSafe;
}
overrideAll();
[50, 200, 500, 1000, 2000, 3000, 5000, 8000].forEach(t => setTimeout(overrideAll, t));

/* ⭐⭐⭐ معالج زر "رجوع" من شاشة الدخول */
document.addEventListener('click', function(e){
  const backBtn = e.target.closest('#authBack');
  if(!backBtn) return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation) e.stopImmediatePropagation();
  window.showWelcomeSafe();
}, true);

/* ⭐⭐⭐ معالج زر "ابدأ رحلتك" */
document.addEventListener('click', async function(e){
  const enterBtn = e.target.closest('#enterBtn');
  if(!enterBtn) return;
  e.preventDefault();
  e.stopPropagation();

  if(enterBtn.disabled) return;
  enterBtn.disabled = true;
  const orig = enterBtn.innerHTML;
  enterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

  try{
    const r = await sb.auth.getSession();
    const s = r.data.session;

    if(s){
      session = s;
      if(typeof window.enterApp === 'function'){
        try{
          await Promise.race([
            window.enterApp(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
          ]);
        }catch(err){
          console.warn('enterApp failed:', err);
          try{ await sb.auth.signOut(); }catch(x){}
          session = null;
          window.showAuthSafe();
        }
      } else {
        window.showAuthSafe();
      }
    } else {
      window.showAuthSafe();
    }
  }catch(err){
    window.showAuthSafe();
  } finally {
    setTimeout(() => {
      if(enterBtn){ enterBtn.disabled = false; enterBtn.innerHTML = orig; }
    }, 400);
  }
}, true);

/* ⭐⭐⭐ حراسة الترحيب: لا تسمح بإخفائه إلا لو app/auth مفتوح */
setInterval(() => {
  if(window._APP_SCREEN !== 'welcome') return;
  if(Date.now() - _lastShow < 300) return;

  const w  = document.getElementById('welcome');
  const a  = document.getElementById('auth');
  const ap = document.getElementById('app');
  if(!w) return;
  if(a && a.classList.contains('open')) return;
  if(ap && ap.classList.contains('open')) return;

  if(w.style.display === 'none' || w.style.display === ''){
    w.classList.remove('exit');
    w.style.display = 'flex';
    w.style.opacity = '1';
    w.style.visibility = 'visible';
  }
}, 700);

/* ⭐⭐⭐ عند الإقلاع: تأكد من الشاشة الصحيحة */
setTimeout(async () => {
  const ap = document.getElementById('app');
  const a  = document.getElementById('auth');
  if(ap && ap.classList.contains('open')) return;
  if(a && a.classList.contains('open')) return;

  try{
    const r = await sb.auth.getSession();
    const s = r.data.session;

    if(s && typeof window.enterApp === 'function'){
      session = s;
      try{
        await Promise.race([
          window.enterApp(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
        ]);
      }catch(err){
        console.warn('boot enterApp failed:', err);
        window.showWelcomeSafe();
      }
    } else {
      window.showWelcomeSafe();
    }
  }catch(e){
    window.showWelcomeSafe();
  }
}, 1500);

console.log('✅ Welcome & Auth fix v2 loaded');
})();
