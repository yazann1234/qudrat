/* ============================================================
   21) APP — نقطة الإقلاع + تحميل البيانات (محسّن ضد التعليق)
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
  renderFiles(); renderRecent(); renderHomeStats(); renderAdmin();
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
   إخفاء كل الشاشات — دوال آمنة
============================================================ */
function hideAllScreens(){
  try{ const w = $('#welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); } }catch(e){}
  try{ const a = $('#auth'); if(a) a.classList.remove('open'); }catch(e){}
  try{ const ap = $('#app'); if(ap) ap.classList.remove('open'); }catch(e){}
}

async function enterApp(){
  try{
    /* ⭐ الأهم: اخفِ كل الشاشات فوراً */
    hideAllScreens();

    if(!session){
      showWelcome();
      return;
    }

    /* جلب الملف الشخصي */
    let profileData = null;
    try{
      const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if(error) throw error;
      profileData = data;
    }catch(err){
      console.error('profile fetch error:', err);
      toast('تعذّر تحميل الملف الشخصي — جاري تسجيل الخروج', 'err');
      try{ await sb.auth.signOut(); }catch(e){}
      setTimeout(() => { showWelcome(); showAuth(); }, 600);
      return;
    }

    if(!profileData){
      toast('لم يتم العثور على ملفك الشخصي', 'err');
      try{ await sb.auth.signOut(); }catch(e){}
      setTimeout(() => { showWelcome(); showAuth(); }, 600);
      return;
    }

    currentUserObj = profileData;

    /* حمّل التفضيلات */
    try{ loadPrefs(); }catch(e){ console.warn('loadPrefs failed', e); }
    try{ loadPrefsFromDB(); }catch(e){ console.warn('loadPrefsFromDB failed', e); }
    try{ loadDrawings(); }catch(e){ console.warn('loadDrawings failed', e); }

    /* طبّق الثيمات والواجهة */
    try{ applyTheme(); }catch(e){}
    try{ applyUserUI(); }catch(e){ console.warn('applyUserUI failed', e); }

    /* ⭐ افتح التطبيق */
    const appEl = $('#app');
    if(appEl) appEl.classList.add('open');
    const mainScroll = $('#mainScroll');
    if(mainScroll) mainScroll.scrollTop = 0;

    /* حمّل إعدادات المتجر والمنتجات دائماً */
    try{ if(typeof loadStoreSettings === 'function') await loadStoreSettings(); }catch(e){ console.warn(e); }
    try{ if(typeof loadProducts === 'function') await loadProducts(); }catch(e){ console.warn(e); }

    /* حمّل حسب حالة الحساب */
    if(currentUserObj.role === 'admin' || currentUserObj.status === 'approved'){
      try{ await loadProfilesAndFiles(); }catch(e){ console.warn(e); }
      try{ await loadMyProgress(); }catch(e){ console.warn(e); }
      try{ await loadVideos(); }catch(e){ console.warn(e); }
      try{ await loadMyVideoProgress(); }catch(e){ console.warn(e); }
    } else {
      DB.files = [];
      try{ renderFiles(); renderRecent(); }catch(e){}
    }

    /* هل نعرض المتجر؟ */
    const _showStore = typeof shouldShowStore === 'function' ? shouldShowStore() : false;
    const storeEl = document.getElementById('view-store');
    const titlesOk = (typeof TITLES !== 'undefined' && TITLES.store);

    console.log('🛒 showStore:', _showStore, '| status:', currentUserObj.status);

    if(_showStore && storeEl && titlesOk){
      /* وضع المتجر فقط */
      if(appEl) appEl.classList.add('store-only');
      try{ if(typeof renderProducts === 'function') renderProducts(); }catch(e){}
      try{ if(typeof applyStoreSettings === 'function') applyStoreSettings(); }catch(e){}
      try{ if(typeof renderStoreUserBadge === 'function') renderStoreUserBadge(); }catch(e){}
      try{ go('store'); }catch(e){}
      setTimeout(() => {
        try{ toast('🛒 فعّل اشتراكك للوصول إلى الملفات والفيديوهات', 'ok'); }catch(e){}
      }, 800);
    } else {
      if(appEl) appEl.classList.remove('store-only');
      try{ goFromHash(); }catch(e){ console.warn('goFromHash failed', e); }
    }

    /* باقي التهيئة */
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

    setTimeout(() => {
      try{ toast(`أهلاً بك ${currentUserObj.name}`, 'ok'); }catch(e){}
    }, 400);

    /* اشتراكات realtime */
    try{ subscribeMyProfile(); }catch(e){}
    try{ subscribeFiles(); }catch(e){}
    try{ if(typeof subscribeVideos === 'function') subscribeVideos(); }catch(e){}
    try{ if(typeof subscribeProductsAndSettings === 'function') subscribeProductsAndSettings(); }catch(e){}
    try{ if(currentUserObj.role === 'admin') subscribeProfilesForAdmin(); }catch(e){}

    /* فتح فيديو من الرابط */
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

  }catch(err){
    /* ⭐ أي خطأ غير متوقع — لا تترك المستخدم معلقاً */
    console.error('❌ enterApp fatal error:', err);
    toast('حدث خطأ غير متوقع: ' + (err.message || 'غير معروف'), 'err');

    /* جرّب الإصلاح التلقائي */
    try{
      await sb.auth.signOut();
    }catch(e){}

    setTimeout(() => {
      try{ showWelcome(); showAuth(); }catch(e){}
    }, 800);
  }
}

function refreshAll(){
  renderFiles(); renderHomeStats(); updateSidebar();
  if($('#view-progress').classList.contains('active')) renderProgress();
  checkBadges();
}

function showWelcome(){
  try{
    const w = $('#welcome');
    if(w){ w.style.display = 'flex'; w.classList.remove('exit'); }
    const a = $('#auth'); if(a) a.classList.remove('open');
    const ap = $('#app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }
  }catch(e){ console.warn('showWelcome error', e); }
}
window.showWelcome = showWelcome;

window.addEventListener('beforeunload', () => {
  clearTimeout(prefsSaveTimer);
  try{ sessionStorage.setItem(prefsKey(), JSON.stringify(pickLocalFields(userData))); }catch(e){}
  saveDrawings(); flushProgressSync();
  if(typeof pushVideoProgress === 'function'){ try{ pushVideoProgress(); }catch(e){} }
});

/* ============================================================
   شارة بيانات المستخدم في وضع المتجر فقط
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

document.addEventListener('DOMContentLoaded', () => {
  const fab = document.getElementById('storeLogoutFab');
  if(fab){
    fab.addEventListener('click', () => {
      const btn = document.getElementById('logoutBtn');
      if(btn) btn.click();
    });
  }
});

/* ============================================================
   الإقلاع
============================================================ */
(async function init(){
  try{
    userData = defaultUD();
    applyTheme();

    /* اجلب الجلسة */
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
        try{ cleanupChannels(); }catch(e){}
        try{
          const ap = $('#app');
          if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }
        }catch(e){}
        showWelcome();
      }
    });

    /* ⭐ قرر العرض الأولي */
    if(session){
      try{ await enterApp(); }
      catch(e){
        console.error('init enterApp failed:', e);
        showWelcome();
      }
    } else {
      showWelcome();
    }

    /* رابط استعادة كلمة المرور */
    if(window.location.hash && window.location.hash.includes('type=recovery')){
      setTimeout(() => {
        if(typeof showRecoveryModal === 'function') showRecoveryModal();
      }, 900);
    }

    /* زر الدخول */
    const enterBtn = $('#enterBtn');
    if(enterBtn){
      enterBtn.addEventListener('click', async () => {
        /* ⭐ إذا كانت هناك جلسة محفوظة، حاول الدخول مباشرة */
        if(session){
          try{
            const { data: { session: s } } = await sb.auth.getSession();
            if(s){
              session = s;
              await enterApp();
              return;
            }
          }catch(e){ console.warn('retry enterApp failed', e); }
        }
        /* وإلا، اعرض شاشة تسجيل الدخول */
        const w = $('#welcome');
        if(w) w.classList.add('exit');
        setTimeout(() => {
          if(w) w.style.display = 'none';
          showAuth();
          showAuthForm('login');
        }, 900);
      });
    }

    /* Enter للدخول */
    document.addEventListener('keydown', function onEnter(e){
      if(e.key === 'Enter'){
        const w = $('#welcome');
        if(w && w.style.display !== 'none' && !w.classList.contains('exit')){
          const btn = $('#enterBtn');
          if(btn) btn.click();
        }
      }
    });

    let rotTimer = null;
    window.addEventListener('orientationchange', () => {
      clearTimeout(rotTimer);
      rotTimer = setTimeout(() => { computeBaseWidth(); }, 350);
    });

         /* ⭐ زر خروج احتياطي في شاشة الترحيب */
    const welcomeLogout = document.getElementById('welcomeLogout');
    if(welcomeLogout){
      welcomeLogout.addEventListener('click', async () => {
        try{
          await sb.auth.signOut();
        }catch(e){}
        currentUserObj = null;
        session = null;
        try{ cleanupChannels(); }catch(e){}
        try{
          sessionStorage.clear();
        }catch(e){}
        toast('تم تسجيل الخروج بنجاح', 'ok');
        setTimeout(() => location.reload(), 500);
      });
    }

    /* تحقق: هل هناك جلسة؟ اظهر الزر */
    async function checkAndShowLogout(){
      try{
        const { data: { session: s } } = await sb.auth.getSession();
        if(s && welcomeLogout){
          welcomeLogout.style.display = 'inline-flex';
        } else if(welcomeLogout){
          welcomeLogout.style.display = 'none';
        }
      }catch(e){}
    }
    checkAndShowLogout();
    setInterval(checkAndShowLogout, 3000);

    setupDrawUI();

  }catch(err){
    console.error('❌ init fatal error:', err);
    /* ⭐ لا تترك المستخدم معلقاً */
    try{ showWelcome(); }catch(e){}
  }
})();
