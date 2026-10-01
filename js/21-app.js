/* ============================================================
   21) APP — نقطة الإقلاع + تحميل البيانات (نسخة نهائية آمنة)
============================================================ */

async function loadProfilesAndFiles(retry = 3){
  try{
    const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    DB.files = data || [];
  }catch(err){
    console.warn('load files failed:', err && err.message);
    if(retry > 0){
      await new Promise(r => setTimeout(r, 400 * (4 - retry)));
      return loadProfilesAndFiles(retry - 1);
    }
    DB.files = [];
  }

  if(currentUserObj && currentUserObj.role === 'admin'){
    try{
      const { data: usersData } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
      DB.users = (usersData || []).filter(u => u.role !== 'admin');
    }catch(e){}
  }
  try{ renderFiles(); renderRecent(); renderHomeStats(); renderAdmin(); }catch(e){}
  const nc = $('#navCount'); if(nc) nc.textContent = DB.files.length;
}

async function loadVideos(retry = 3){
  try{
    const { data, error } = await sb.from('videos').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    DB.videos = data || [];
  }catch(err){
    console.warn('load videos failed:', err && err.message);
    if(retry > 0){ await new Promise(r => setTimeout(r, 400)); return loadVideos(retry - 1); }
    DB.videos = [];
  }
  if(typeof renderVideos === 'function') renderVideos();
  if(typeof renderAdminVideos === 'function') renderAdminVideos();
  if(typeof renderFiles === 'function' && DB.files.length) renderFiles();
}

async function loadProducts(retry = 2){
  try{
    const { data, error } = await sb.from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if(error) throw error;
    DB.products = data || [];
  }catch(err){
    console.warn('load products failed:', err && err.message);
    if(retry > 0){ await new Promise(r => setTimeout(r, 400)); return loadProducts(retry - 1); }
    DB.products = [];
  }
  if(typeof renderProducts === 'function') renderProducts();
  if(typeof renderAdminProducts === 'function') renderAdminProducts();
}

async function loadStoreSettings(retry = 2){
  try{
    const { data, error } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
    if(error) throw error;
    DB.storeSettings = data || null;
  }catch(err){
    console.warn('load store_settings failed:', err && err.message);
    if(retry > 0){ await new Promise(r => setTimeout(r, 400)); return loadStoreSettings(retry - 1); }
    DB.storeSettings = null;
  }
  if(typeof applyStoreSettings === 'function') applyStoreSettings();
  if(typeof renderStoreSettings === 'function') renderStoreSettings();
}

async function loadMyProgress(){
  if(!currentUserObj || currentUserObj.role === 'admin'){ return; }
  try{
    const { data, error } = await sb.from('user_progress').select('*').eq('user_id', currentUserObj.id);
    if(error) throw error;
    userData.progress = {};
    (data || []).forEach(r => {
      userData.progress[r.file_id] = { pct: r.pct || 0, maxPage: r.max_page || 0, lastPage: r.last_page || 1 };
    });
    savePrefs();
    refreshAll();
  }catch(e){ console.warn('progress load failed', e); }
}

async function loadMyVideoProgress(){
  if(!currentUserObj || currentUserObj.role === 'admin'){ userData.videoProgress = {}; return; }
  try{
    const { data, error } = await sb.from('video_progress').select('*').eq('user_id', currentUserObj.id);
    if(error) throw error;
    userData.videoProgress = {};
    (data || []).forEach(r => {
      userData.videoProgress[r.video_id] = {
        last_position: r.last_position || 0,
        pct: r.pct || 0,
        max_watched: r.last_position || 0,
        completed: !!r.completed
      };
      if(r.completed){
        if(!userData.awardedVideoXp) userData.awardedVideoXp = {};
        userData.awardedVideoXp[r.video_id] = true;
      }
    });
  }catch(e){ userData.videoProgress = userData.videoProgress || {}; }
}

/* ============================================================
   دوال التحكم بالشاشات — آمنة ومستقلة
============================================================ */

/* إخفاء كل الشاشات */
function hideAllScreens(){
  try{ const w = document.getElementById('welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); } }catch(e){}
  try{ const a = document.getElementById('auth'); if(a) a.classList.remove('open'); }catch(e){}
  try{ const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); } }catch(e){}
}

/* عرض شاشة الترحيب فقط */
async function showWelcome(){
  try{
    // أخفِ الباقي
    const a = document.getElementById('auth'); if(a) a.classList.remove('open');
    const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }

    // اعرض الترحيب
    const w = document.getElementById('welcome');
    if(w){
      w.style.display = 'flex';
      w.classList.remove('exit');
    }

    // زر الخروج الاحتياطي: أظهره فقط لو فيه جلسة
    const welcomeLogout = document.getElementById('welcomeLogout');
    if(welcomeLogout){
      try{
        const { data: { session: s } } = await sb.auth.getSession();
        welcomeLogout.style.display = s ? 'inline-flex' : 'none';
      }catch(e){
        welcomeLogout.style.display = 'none';
      }
    }
  }catch(e){ console.warn('showWelcome error:', e); }
}
window.showWelcome = showWelcome;

/* عرض شاشة تسجيل الدخول فقط */
function showAuthScreen(){
  try{
    const w = document.getElementById('welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); }
    const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }
    const a = document.getElementById('auth'); if(a) a.classList.add('open');
    if(typeof showAuthForm === 'function') showAuthForm('login');
  }catch(e){ console.warn('showAuthScreen error:', e); }
}
window.showAuthScreen = showAuthScreen;

/* ============================================================
   enterApp — ترجع true عند النجاح، false عند الفشل
============================================================ */
async function enterApp(){
  try{
    /* 1) أخفِ كل الشاشات فوراً */
    hideAllScreens();

    /* 2) لا توجد جلسة → اعرض الترحيب */
    if(!session){
      await showWelcome();
      return false;
    }

    /* 3) جلب الملف الشخصي */
    let profileData = null;
    try{
      const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if(error) throw error;
      profileData = data;
    }catch(err){
      console.error('❌ profile fetch error:', err);
      try{ toast('تعذّر تحميل الملف الشخصي', 'err'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      session = null;
      currentUserObj = null;
      await showWelcome();
      return false;
    }

    if(!profileData){
      try{ toast('لم يتم العثور على ملفك الشخصي', 'err'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      session = null;
      currentUserObj = null;
      await showWelcome();
      return false;
    }

    currentUserObj = profileData;

    /* 4) حمّل التفضيلات */
    try{ loadPrefs(); }catch(e){ console.warn('loadPrefs failed', e); }
    try{ loadPrefsFromDB(); }catch(e){ console.warn('loadPrefsFromDB failed', e); }
    try{ loadDrawings(); }catch(e){ console.warn('loadDrawings failed', e); }

    /* 5) طبّق الثيمات */
    try{ applyTheme(); }catch(e){}
    try{ applyUserUI(); }catch(e){ console.warn('applyUserUI failed', e); }

    /* 6) افتح التطبيق */
    const appEl = document.getElementById('app');
    if(appEl) appEl.classList.add('open');
    const mainScroll = document.getElementById('mainScroll');
    if(mainScroll) mainScroll.scrollTop = 0;

    /* 7) حمّل إعدادات المتجر والمنتجات */
    try{ if(typeof loadStoreSettings === 'function') await loadStoreSettings(); }catch(e){ console.warn(e); }
    try{ if(typeof loadProducts === 'function') await loadProducts(); }catch(e){ console.warn(e); }

    /* 8) حمّل حسب حالة الحساب */
    if(currentUserObj.role === 'admin' || currentUserObj.status === 'approved'){
      try{ await loadProfilesAndFiles(); }catch(e){ console.warn(e); }
      try{ await loadMyProgress(); }catch(e){ console.warn(e); }
      try{ await loadVideos(); }catch(e){ console.warn(e); }
      try{ await loadMyVideoProgress(); }catch(e){ console.warn(e); }
    } else {
      DB.files = [];
      try{ renderFiles(); renderRecent(); }catch(e){}
    }

    /* 9) هل نعرض المتجر فقط؟ */
    const _showStore = typeof shouldShowStore === 'function' ? shouldShowStore() : false;
    const storeEl = document.getElementById('view-store');
    const titlesOk = (typeof TITLES !== 'undefined' && TITLES.store);

    console.log('🛒 showStore:', _showStore, '| status:', currentUserObj.status);

    if(_showStore && storeEl && titlesOk){
      if(appEl) appEl.classList.add('store-only');
      try{ if(typeof renderProducts === 'function') renderProducts(); }catch(e){}
      try{ if(typeof applyStoreSettings === 'function') applyStoreSettings(); }catch(e){}
      try{ if(typeof renderStoreUserBadge === 'function') renderStoreUserBadge(); }catch(e){}
      try{ go('store'); }catch(e){}
      setTimeout(() => { try{ toast('🛒 فعّل اشتراكك للوصول إلى الملفات والفيديوهات', 'ok'); }catch(e){} }, 800);
    } else {
      if(appEl) appEl.classList.remove('store-only');
      try{ goFromHash(); }catch(e){ console.warn('goFromHash failed', e); }
    }

    /* 10) باقي التهيئة */
    try{ renderTasks(); }catch(e){}
    try{ renderBadges(); }catch(e){}
    try{ renderFeatures(); }catch(e){}
    try{ renderThemesGrid(); }catch(e){}

    if(typeof notesArea !== 'undefined' && notesArea) notesArea.value = userData.notes || '';

    try{
      if(typeof TIMER !== 'undefined'){
        TIMER.mode = 'focus';
        TIMER.remain = timerTotalSec('focus');
        updateTimerUI();
      }
    }catch(e){}

    try{ applyReaderTheme(); }catch(e){}
    try{ applySnapClass(); }catch(e){}
    try{ syncSettingsUI(); }catch(e){}
    try{ renderDrawToolbar(); }catch(e){}

    try{ syncMyXp(); }catch(e){}
    try{ await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUserObj.id); }catch(e){}

    setTimeout(() => { try{ toast(`أهلاً بك ${currentUserObj.name}`, 'ok'); }catch(e){} }, 400);

    /* 11) Realtime */
    try{ subscribeMyProfile(); }catch(e){}
    try{ subscribeFiles(); }catch(e){}
    try{ if(typeof subscribeVideos === 'function') subscribeVideos(); }catch(e){}
    try{ if(typeof subscribeProductsAndSettings === 'function') subscribeProductsAndSettings(); }catch(e){}
    try{ if(currentUserObj.role === 'admin') subscribeProfilesForAdmin(); }catch(e){}

    /* 12) فتح فيديو من الرابط */
    const m = location.hash.match(/^#watch=(.+)$/);
    if(m && m[1]){
      const vid = m[1];
      setTimeout(() => {
        try{
          if((DB.videos || []).some(v => v.id === vid)){
            go('videos', true);
            if(typeof openVideo === 'function') openVideo(vid);
          }
        }catch(e){}
      }, 700);
    }

    return true;

  }catch(err){
    console.error('❌ enterApp fatal error:', err);
    try{ toast('حدث خطأ غير متوقع', 'err'); }catch(e){}
    try{ await sb.auth.signOut(); }catch(e){}
    session = null;
    currentUserObj = null;
    await showWelcome();
    return false;
  }
}

/* ============================================================
   تحديث شامل
============================================================ */
function refreshAll(){
  try{
    renderFiles(); renderHomeStats(); updateSidebar();
    if($('#view-progress').classList.contains('active')) renderProgress();
    checkBadges();
  }catch(e){}
}

/* ============================================================
   شارة المستخدم في وضع المتجر
============================================================ */
function renderStoreUserBadge(){
  if(!currentUserObj) return;
  const av = document.getElementById('subUserAv');
  const nm = document.getElementById('subUserName');
  if(!av || !nm) return;

  const initial = String(currentUserObj.name || '؟').trim().charAt(0) || '؟';
  if(currentUserObj.avatar_url){
    av.textContent = '';
    av.style.backgroundImage = `url('${currentUserObj.avatar_url}')`;
  } else {
    av.textContent = initial;
    av.style.backgroundImage = '';
  }
  nm.textContent = currentUserObj.name || '—';
}
window.renderStoreUserBadge = renderStoreUserBadge;

/* ============================================================
   زر «ابدأ رحلتك»
============================================================ */
function bindEnterButton(){
  const enterBtn = document.getElementById('enterBtn');
  if(!enterBtn) return;
  if(enterBtn.dataset.bound === '1') return;
  enterBtn.dataset.bound = '1';

  enterBtn.addEventListener('click', async () => {
    if(enterBtn.disabled) return;
    enterBtn.disabled = true;
    const orig = enterBtn.innerHTML;
    enterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';

    let navigated = false;

    try{
      /* 1) هل هناك جلسة؟ */
      let s = null;
      try{
        const r = await sb.auth.getSession();
        s = r.data.session;
      }catch(e){}

      /* 2) نعم → جرّب الدخول مباشرة */
      if(s){
        session = s;
        const ok = await enterApp();
        if(ok){ navigated = true; return; }
        // enterApp فشلت → ستُظهر الشاشة الترحيبية تلقائياً
        navigated = true;
        return;
      }

      /* 3) لا → اعرض شاشة تسجيل الدخول */
      const w = document.getElementById('welcome');
      if(w){
        w.classList.add('exit');
        setTimeout(() => {
          if(w){ w.style.display = 'none'; w.classList.remove('exit'); }
          showAuthScreen();
        }, 500);
      } else {
        showAuthScreen();
      }
      navigated = true;

    }catch(e){
      console.error('start journey error:', e);
      /* أي خطأ → اعرض شاشة الدخول فوراً */
      try{
        const w = document.getElementById('welcome');
        if(w){ w.style.display = 'none'; w.classList.remove('exit'); }
        showAuthScreen();
      }catch(err){}
      navigated = true;

    }finally{
      // أعد الزر لشكله الأصلي بعد فترة
      setTimeout(() => {
        try{
          enterBtn.disabled = false;
          enterBtn.innerHTML = orig;
        }catch(e){}
      }, 1200);
    }
  });
}

/* ============================================================
   زر الخروج الاحتياطي في شاشة الترحيب
============================================================ */
function bindWelcomeLogout(){
  const btn = document.getElementById('welcomeLogout');
  if(!btn) return;
  if(btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async () => {
    if(btn.disabled) return;
    btn.disabled = true;
    try{ await sb.auth.signOut(); }catch(e){}
    currentUserObj = null;
    session = null;
    try{ cleanupChannels(); }catch(e){}
    try{ sessionStorage.clear(); }catch(e){}
    try{ localStorage.removeItem('sb-auth-session'); }catch(e){}
    toast('تم تسجيل الخروج بنجاح ✓', 'ok');
    setTimeout(() => location.reload(), 500);
  });
}

/* ============================================================
   الإقلاع
============================================================ */
(async function init(){
  try{
    userData = defaultUD();
    applyTheme();

    /* جلب الجلسة */
    try{
      const { data: { session: s } } = await sb.auth.getSession();
      session = s;
    }catch(e){
      console.warn('getSession failed', e);
      session = null;
    }

    /* مراقب تغيّر حالة المصادقة */
    sb.auth.onAuthStateChange(async (event, newSession) => {
      session = newSession;
      if(event === 'PASSWORD_RECOVERY'){
        setTimeout(() => {
          if(typeof showRecoveryModal === 'function') showRecoveryModal();
        }, 600);
        return;
      }
      if(event === 'SIGNED_IN' && newSession){
        try{ await enterApp(); }catch(e){ console.error('SIGNED_IN error', e); }
      }
      else if(event === 'SIGNED_OUT'){
        currentUserObj = null;
        session = null;
        try{ cleanupChannels(); }catch(e){}
        await showWelcome();
      }
    });

    /* ⭐ قرر العرض الأولي */
    if(session){
      try{
        const ok = await enterApp();
        if(!ok) await showWelcome();
      }catch(e){
        console.error('init enterApp failed:', e);
        await showWelcome();
      }
    } else {
      await showWelcome();
    }

    /* رابط استعادة كلمة المرور */
    if(window.location.hash && window.location.hash.includes('type=recovery')){
      setTimeout(() => {
        if(typeof showRecoveryModal === 'function') showRecoveryModal();
      }, 900);
    }

    /* اربط الأزرار */
    bindEnterButton();
    bindWelcomeLogout();

    /* Enter للدخول */
    document.addEventListener('keydown', function onEnter(e){
      if(e.key === 'Enter'){
        const w = document.getElementById('welcome');
        if(w && w.style.display !== 'none' && !w.classList.contains('exit')){
          const btn = document.getElementById('enterBtn');
          if(btn && !btn.disabled) btn.click();
        }
      }
    });

    /* Orientation */
    let rotTimer = null;
    window.addEventListener('orientationchange', () => {
      clearTimeout(rotTimer);
      rotTimer = setTimeout(() => { computeBaseWidth(); }, 350);
    });

    setupDrawUI();

  }catch(err){
    console.error('❌ init fatal error:', err);
    try{ await showWelcome(); }catch(e){}
  }
})();

/* ============================================================
   beforeunload
============================================================ */
window.addEventListener('beforeunload', () => {
  try{
    clearTimeout(prefsSaveTimer);
    sessionStorage.setItem(prefsKey(), JSON.stringify(pickLocalFields(userData)));
  }catch(e){}
  try{ saveDrawings(); }catch(e){}
  try{ flushProgressSync(); }catch(e){}
  try{ if(typeof pushVideoProgress === 'function') pushVideoProgress(); }catch(e){}
});
