/* ============================================================
   21) APP — نقطة الإقلاع (نسخة محسّنة v2.3.0)
============================================================ */
window._appVersion = '2.3.0';
window._lastInitializedUserId = null;
window._appInitialized = false;

/* ============================================================
   تحميل البيانات
============================================================ */
async function loadProfilesAndFiles(retry){
  retry = (typeof retry === 'number') ? retry : 3;
  try{
    const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    DB.files = data || [];
  }catch(err){
    if(retry > 0){ await new Promise(r => setTimeout(r, 400 * (4 - retry))); return loadProfilesAndFiles(retry - 1); }
    DB.files = [];
  }

  if(typeof isPrivileged === 'function' && isPrivileged()){
    try{
      const { data: usersData } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
      DB.users = usersData || [];
    }catch(e){}
  }
  try{ renderFiles(); renderRecent(); renderHomeStats(); renderAdmin(); }catch(e){}
  const nc = document.getElementById('navCount');
  if(nc) nc.textContent = DB.files.length;
}

async function loadVideos(retry){
  retry = (typeof retry === 'number') ? retry : 3;
  try{
    const { data, error } = await sb.from('videos').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    DB.videos = data || [];
  }catch(err){
    if(retry > 0){ await new Promise(r => setTimeout(r, 400)); return loadVideos(retry - 1); }
    DB.videos = [];
  }
  if(typeof renderVideos === 'function'){ try{ renderVideos(); }catch(e){} }
  if(typeof renderAdminVideos === 'function'){ try{ renderAdminVideos(); }catch(e){} }
}

async function loadProducts(retry){
  retry = (typeof retry === 'number') ? retry : 2;
  try{
    const { data, error } = await sb.from('products').select('*').order('sort_order', { ascending: true });
    if(error) throw error;
    DB.products = data || [];
  }catch(err){
    if(retry > 0){ await new Promise(r => setTimeout(r, 400)); return loadProducts(retry - 1); }
    DB.products = [];
  }
  if(typeof renderProducts === 'function'){ try{ renderProducts(); }catch(e){} }
  if(typeof renderAdminProducts === 'function'){ try{ renderAdminProducts(); }catch(e){} }
}

async function loadStoreSettings(retry){
  retry = (typeof retry === 'number') ? retry : 2;
  try{
    const { data, error } = await sb.from('store_settings').select('*').eq('id', 1).maybeSingle();
    if(error) throw error;
    DB.storeSettings = data || null;
  }catch(err){
    if(retry > 0){ await new Promise(r => setTimeout(r, 400)); return loadStoreSettings(retry - 1); }
    DB.storeSettings = null;
  }
  if(typeof applyStoreSettings === 'function'){ try{ applyStoreSettings(); }catch(e){} }
  if(typeof renderStoreSettings === 'function'){ try{ renderStoreSettings(); }catch(e){} }
}

async function loadMyProgress(){
  if(!currentUserObj) return;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
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
  if(!currentUserObj) return;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner'){ userData.videoProgress = {}; return; }
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
   إدارة الشاشات
============================================================ */
function hideAllScreens(){
  try{ const w = document.getElementById('welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); } }catch(e){}
  try{ const a = document.getElementById('auth'); if(a) a.classList.remove('open'); }catch(e){}
  try{ const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); } }catch(e){}
}

async function showWelcome(){
  try{
    window._appInitialized = false;
    window._lastInitializedUserId = null;

    const a = document.getElementById('auth'); if(a) a.classList.remove('open');
    const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }

    const w = document.getElementById('welcome');
    if(w){
      /* ⭐ اعرضها فقط في حالة تسجيل الخروج أو الزيارة الأولى */
      if(w.dataset.firstVisit === 'true'){
        w.style.display = 'flex';
        w.classList.remove('exit');
      }
    }

    const wl = document.getElementById('welcomeLogout');
    if(wl){
      try{
        const r = await sb.auth.getSession();
        wl.style.display = r.data.session ? 'inline-flex' : 'none';
      }catch(e){ wl.style.display = 'none'; }
    }
  }catch(e){ console.warn('showWelcome error:', e); }
}
window.showWelcome = showWelcome;

/* ⭐ إظهار شاشة الترحيب (بعد تسجيل الخروج فقط) */
function forceShowWelcome(){
  const w = document.getElementById('welcome');
  if(w){
    w.dataset.firstVisit = 'true';
    w.style.display = 'flex';
    w.classList.remove('exit');
  }
  const a = document.getElementById('auth'); if(a) a.classList.remove('open');
  const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }
}
window.forceShowWelcome = forceShowWelcome;

/* ⭐ عرض شاشة الدخول مباشرة (بدون ترحيب) */
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
   enterApp
============================================================ */
async function enterApp(){
  try{
    if(session && session.user){
      window._lastInitializedUserId = session.user.id;
      window._appInitialized = true;
    }

    hideAllScreens();

    if(!session){ await showWelcome(); return false; }

    let profileData = null;
    try{
      const r = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if(r.error) throw r.error;
      profileData = r.data;
    }catch(err){
      console.error('profile fetch error:', err);
      try{ toast('تعذّر تحميل الملف الشخصي', 'err'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      session = null; currentUserObj = null;
      window._appInitialized = false;
      window._lastInitializedUserId = null;
      forceShowWelcome();
      return false;
    }

    if(!profileData){
      try{ toast('لم يتم العثور على ملفك الشخصي', 'err'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      session = null; currentUserObj = null;
      window._appInitialized = false;
      window._lastInitializedUserId = null;
      forceShowWelcome();
      return false;
    }

    currentUserObj = profileData;

    try{ loadPrefs(); }catch(e){}
    try{ loadPrefsFromDB(); }catch(e){}
    try{ loadDrawings(); }catch(e){}
    try{ applyTheme(); }catch(e){}
    try{ applyUserUI(); }catch(e){}

    const appEl = document.getElementById('app');
    if(appEl) appEl.classList.add('open');
    const mainScroll = document.getElementById('mainScroll');
    if(mainScroll) mainScroll.scrollTop = 0;

    try{ if(typeof loadStoreSettings === 'function') await loadStoreSettings(); }catch(e){}
    try{ if(typeof loadProducts === 'function') await loadProducts(); }catch(e){}

    const privileged = typeof isPrivileged === 'function' && isPrivileged();

    if(privileged || currentUserObj.status === 'approved'){
      try{ await loadProfilesAndFiles(); }catch(e){}
      try{ await loadMyProgress(); }catch(e){}
      try{ await loadVideos(); }catch(e){}
      try{ await loadMyVideoProgress(); }catch(e){}
    } else {
      DB.files = [];
      try{ renderFiles(); renderRecent(); }catch(e){}
    }

    const _showStore = typeof shouldShowStore === 'function' ? shouldShowStore() : false;
    const storeEl = document.getElementById('view-store');
    const titlesOk = (typeof TITLES !== 'undefined' && TITLES.store);

    if(_showStore && storeEl && titlesOk){
      if(appEl) appEl.classList.add('store-only');
      try{ if(typeof renderProducts === 'function') renderProducts(); }catch(e){}
      try{ if(typeof applyStoreSettings === 'function') applyStoreSettings(); }catch(e){}
      try{ if(typeof renderStoreUserBadge === 'function') renderStoreUserBadge(); }catch(e){}
      try{ go('store'); }catch(e){}
    } else {
      if(appEl) appEl.classList.remove('store-only');
      try{ goFromHash(); }catch(e){}
    }

         /* ⭐ تحميل خطة الدراسة */
    try{
      if(typeof loadPlanLocally === 'function') loadPlanLocally();
    }catch(e){}
    /* ⭐ تحديث العد التنازلي في الرئيسية */
    try{
      if(typeof updateHomeCountdown === 'function') updateHomeCountdown();
    }catch(e){}
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
    }, 300);

    try{ subscribeMyProfile(); }catch(e){}
    try{ subscribeFiles(); }catch(e){}
    try{ if(typeof subscribeVideos === 'function') subscribeVideos(); }catch(e){}
    try{ if(typeof subscribeProductsAndSettings === 'function') subscribeProductsAndSettings(); }catch(e){}
    try{ if(privileged && typeof subscribeProfilesForAdmin === 'function') subscribeProfilesForAdmin(); }catch(e){}

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
    console.error('enterApp fatal error:', err);
    try{ toast('حدث خطأ غير متوقع', 'err'); }catch(e){}
    try{ await sb.auth.signOut(); }catch(e){}
    session = null;
    currentUserObj = null;
    window._appInitialized = false;
    window._lastInitializedUserId = null;
    forceShowWelcome();
    return false;
  }
}

function refreshAll(){
  try{
    renderFiles(); renderHomeStats(); updateSidebar();
    if(document.getElementById('view-progress') && document.getElementById('view-progress').classList.contains('active')){
      renderProgress();
    }
    checkBadges();
  }catch(e){}
}

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
   الأزرار الطارئة
============================================================ */
function bindEmergencyButtons(){
  const btn = document.getElementById('emergencyReset');
  if(btn && !btn.dataset.bound){
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      if(!confirm('سيتم مسح كل الجلسات والبيانات. متابعة؟')) return;
      try{ await sb.auth.signOut(); }catch(e){}
      try{ sessionStorage.clear(); }catch(e){}
      try{ localStorage.clear(); }catch(e){}
      setTimeout(() => location.reload(), 300);
    });
  }

  const enterBtn = document.getElementById('enterBtn');
  if(enterBtn && !enterBtn.dataset.bound){
    enterBtn.dataset.bound = '1';
    enterBtn.addEventListener('click', async () => {
      if(enterBtn.disabled) return;
      enterBtn.disabled = true;
      const orig = enterBtn.innerHTML;
      enterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';

      try{
        let s = null;
        try{ const r = await sb.auth.getSession(); s = r.data.session; }catch(e){}

        if(s){
          session = s;
          try{
            await Promise.race([
              enterApp(),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
            ]);
          }catch(err){
            console.error('enterApp failed:', err);
            try{ await sb.auth.signOut(); }catch(e){}
            session = null; currentUserObj = null;
            window._appInitialized = false;
            window._lastInitializedUserId = null;
            showAuthScreen();
          }
        } else {
          showAuthScreen();
        }
      }catch(e){
        console.error('enterBtn error:', e);
        showAuthScreen();
      }finally{
        setTimeout(() => {
          if(enterBtn){ enterBtn.disabled = false; enterBtn.innerHTML = orig; }
        }, 800);
      }
    });
  }

  const wl = document.getElementById('welcomeLogout');
  if(wl && !wl.dataset.bound){
    wl.dataset.bound = '1';
    wl.addEventListener('click', async () => {
      try{ await sb.auth.signOut(); }catch(e){}
      try{ sessionStorage.clear(); }catch(e){}
      try{ localStorage.clear(); }catch(e){}
      window._appInitialized = false;
      window._lastInitializedUserId = null;
      forceShowWelcome();
    });
  }
}
window.bindEmergencyButtons = bindEmergencyButtons;

/* ============================================================
   الإقلاع
============================================================ */
(async function init(){
  try{
    userData = defaultUD();
    applyTheme();
    bindEmergencyButtons();

    let s = null;
    try{
      const r = await sb.auth.getSession();
      s = r.data.session;
    }catch(e){}

    session = s;

    /* ⭐ منع إعادة التحميل عند نفس المستخدم */
    sb.auth.onAuthStateChange(async (event, newSession) => {
      session = newSession;

      if(event === 'PASSWORD_RECOVERY'){
        setTimeout(() => {
          if(typeof showRecoveryModal === 'function') showRecoveryModal();
        }, 600);
        return;
      }

      if(event === 'SIGNED_OUT'){
        window._lastInitializedUserId = null;
        window._appInitialized = false;
        currentUserObj = null;
        session = null;
        try{ cleanupChannels(); }catch(e){}
        forceShowWelcome();
        return;
      }

      if(event === 'SIGNED_IN' && newSession){
        const uid = newSession.user ? newSession.user.id : null;
        if(window._appInitialized && window._lastInitializedUserId === uid){
          return;
        }

        window._lastInitializedUserId = uid;
        window._appInitialized = true;

        try{
          await Promise.race([
            enterApp(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
          ]);
        }catch(e){
          console.error('SIGNED_IN error:', e);
          try{ await sb.auth.signOut(); }catch(err){}
          window._appInitialized = false;
          window._lastInitializedUserId = null;
          forceShowWelcome();
        }
        return;
      }

      if(event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'){
        return;
      }
    });

    /* ⭐ قرر الشاشة الابتدائية */
    if(session){
      try{
        await Promise.race([
          enterApp(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
        ]);
      }catch(e){
        try{ await sb.auth.signOut(); }catch(err){}
        session = null;
        currentUserObj = null;
        forceShowWelcome();
      }
    } else {
      /* ⭐ لا جلسة → هل المستخدم زار سابقاً؟ */
      let hasVisited = false;
      try{ hasVisited = !!localStorage.getItem('abdq_has_visited'); }catch(e){}

      if(hasVisited){
        /* زار سابقاً → اذهب لشاشة الدخول مباشرة */
        showAuthScreen();
      } else {
        /* زيارة أولى → اعرض الترحيب */
        try{ localStorage.setItem('abdq_has_visited', '1'); }catch(e){}
        const w = document.getElementById('welcome');
        if(w){
          w.dataset.firstVisit = 'true';
          w.style.display = 'flex';
        }
      }
    }

    if(window.location.hash && window.location.hash.includes('type=recovery')){
      setTimeout(() => {
        if(typeof showRecoveryModal === 'function') showRecoveryModal();
      }, 900);
    }

    let rotTimer = null;
    window.addEventListener('orientationchange', () => {
      clearTimeout(rotTimer);
      rotTimer = setTimeout(() => { try{ computeBaseWidth(); }catch(e){} }, 350);
    });

    try{ setupDrawUI(); }catch(e){}

  }catch(err){
    console.error('❌ init fatal:', err);
    try{ bindEmergencyButtons(); }catch(e){}
    const w = document.getElementById('welcome');
    if(w){ w.dataset.firstVisit = 'true'; w.style.display = 'flex'; }
  }
})();

window.addEventListener('beforeunload', () => {
  try{
    clearTimeout(prefsSaveTimer);
    sessionStorage.setItem(prefsKey(), JSON.stringify(pickLocalFields(userData)));
  }catch(e){}
  try{ saveDrawings(); }catch(e){}
  try{ flushProgressSync(); }catch(e){}
});
