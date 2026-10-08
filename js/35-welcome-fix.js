/* ============================================================
   35) WELCOME & AUTH FIX
   - شاشة الترحيب تعمل بشكل موثوق
   - زر "رجوع" من auth يعرض الترحيب (بدل بياض)
   - الكتابة في البريد لا تسبب إعادة تحميل / بياض
============================================================ */

(function(){
  'use strict';

  /* الحالة الحالية للشاشة: welcome | auth | app */
  window._APP_SCREEN = 'welcome';

  /* آخر وقت عرضنا فيه الترحيب (حماية من السباقات) */
  let _lastWelcomeShow = 0;

  /* ⭐⭐⭐ إظهار شاشة الترحيب */
  window.showWelcomeSafe = function(){
    _lastWelcomeShow = Date.now();
    window._APP_SCREEN = 'welcome';

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
  };

  /* ⭐⭐⭐ إظهار شاشة تسجيل الدخول */
  window.showAuthSafe = function(){
    window._APP_SCREEN = 'auth';

    const w  = document.getElementById('welcome');
    const a  = document.getElementById('auth');
    const ap = document.getElementById('app');

    if(w){
      w.classList.add('exit');
      w.style.display = 'none';
    }
    if(ap) ap.classList.remove('open', 'store-only', 'ready');
    if(a)  a.classList.add('open');

    if(typeof window.showAuthForm === 'function') window.showAuthForm('login');
  };

  /* ⭐ استبدال الدوال القديمة */
  function overrideFunctions(){
    window.showWelcome      = window.showWelcomeSafe;
    window.forceShowWelcome = window.showWelcomeSafe;
    window.showAuthScreen   = window.showAuthSafe;
  }

  overrideFunctions();
  setTimeout(overrideFunctions, 100);
  setTimeout(overrideFunctions, 500);
  setTimeout(overrideFunctions, 1500);
  setTimeout(overrideFunctions, 3000);

  /* ⭐⭐⭐ معالج زر "رجوع" — يشتغل قبل أي handler ثاني */
  document.addEventListener('click', function(e){
    const backBtn = e.target.closest('#authBack');
    if(!backBtn) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.showWelcomeSafe();
  }, true);

  /* ⭐⭐⭐ حماية: ما نسمح للترحيب يختفي بدون سبب */
  function installWelcomeGuard(){
    const w = document.getElementById('welcome');
    if(!w || w._guardInstalled) return;
    w._guardInstalled = true;

    const obs = new MutationObserver(() => {
      if(Date.now() - _lastWelcomeShow < 400) return;
      if(window._APP_SCREEN !== 'welcome') return;

      if(w.style.display === 'none'){
        const a  = document.getElementById('auth');
        const ap = document.getElementById('app');
        /* مسموح الإخفاء فقط لو auth أو app مفتوحين */
        if(a  && a.classList.contains('open'))  return;
        if(ap && ap.classList.contains('open')) return;
        /* وإلا — أعِد الترحيب */
        w.classList.remove('exit');
        w.style.display = 'flex';
      }
    });
    obs.observe(w, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  setTimeout(installWelcomeGuard, 500);

  /* ⭐⭐⭐ حماية صفحة auth من أي submit أو تنقل غير مقصود */
  function protectAuthForm(){
    const authEl = document.getElementById('auth');
    if(!authEl || authEl._protected) return;
    authEl._protected = true;

    /* امنع أي submit */
    authEl.addEventListener('submit', e => {
      e.preventDefault();
      e.stopPropagation();
    }, true);

    /* حماية مدخلات auth */
    const inputs = authEl.querySelectorAll('input');
    inputs.forEach(inp => {
      if(inp._protected) return;
      inp._protected = true;

      /* اسمح فقط بـ Enter (يستخدمه doLogin) */
      inp.addEventListener('keydown', function(e){
        if(e.key === 'Enter') return;
        e.stopPropagation();
      }, true);

      inp.addEventListener('paste',  e => e.stopPropagation(), true);
      inp.addEventListener('change', e => e.stopPropagation(), true);
      inp.addEventListener('input',  e => e.stopPropagation(), true);
    });
  }
  setTimeout(protectAuthForm, 300);
  setTimeout(protectAuthForm, 1500);

  /* ⭐⭐⭐ مزامنة الحالة دورياً */
  function syncState(){
    const ap = document.getElementById('app');
    const a  = document.getElementById('auth');
    const w  = document.getElementById('welcome');

    if(ap && ap.classList.contains('open')){ window._APP_SCREEN = 'app'; return; }
    if(a  && a.classList.contains('open')) { window._APP_SCREEN = 'auth'; return; }
    if(w  && w.style.display !== 'none')   { window._APP_SCREEN = 'welcome'; }
  }
  setInterval(syncState, 800);

  console.log('✅ Welcome & Auth fix loaded');
})();
