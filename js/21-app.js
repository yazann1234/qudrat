/* ============================================================
   21) APP — الإقلاع السريع v3.0.0
============================================================ */
window._appVersion = '3.0.0';
window._lastInitializedUserId = null;
window._appInitialized = false;

/* ================== التحميلات ================== */
async function loadProfilesAndFiles(retry){
  retry = (typeof retry === 'number') ? retry : 3;
  try{
    const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    DB.files = data || [];
  }catch(err){
    if(retry > 0){ await new Promise(r => setTimeout(r, 300)); return loadProfilesAndFiles(retry - 1); }
    DB.files = [];
  }
  if(typeof isPrivileged === 'function' && isPrivileged()){
    try{
      const r = await sb.from('profiles').select('*').order('created_at', { ascending: false });
      DB.users = r.data || [];
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
    if(retry > 0){ await new Promise(r => setTimeout(r, 300)); return loadVideos(retry - 1); }
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
    if(retry > 0){ await new Promise(r => setTimeout(r, 300)); return loadProducts(retry - 1); }
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
    if(retry > 0){ await new Promise(r => setTimeout(r, 300)); return loadStoreSettings(retry - 1); }
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
  }catch(e){}
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

/* ================== الشاشات ================== */
function hideAllScreens(){
  try{ const w = document.getElementById('welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); } }catch(e){}
  try{ const a = document.getElementById('auth'); if(a) a.classList.remove('open'); }catch(e){}
  try{ const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open','store-only','ready'); } }catch(e){}
}

async function showWelcome(){
  try{
    window._appInitialized = false;
    window._lastInitializedUserId = null;

    const a = document.getElementById('auth'); if(a) a.classList.remove('open');
    const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open','store-only','ready'); }

    const w = document.getElementById('welcome');
    if(w && w.dataset.firstVisit === 'true'){ w.style.display = 'flex'; w.classList.remove('exit'); }

    const wl = document.getElementById('welcomeLogout');
    if(wl){
      try{
        const r = await sb.auth.getSession();
        wl.style.display = r.data.session ? 'inline-flex' : 'none';
      }catch(e){ wl.style.display = 'none'; }
    }
  }catch(e){}
}
window.showWelcome = showWelcome;

function forceShowWelcome(){
  const w = document.getElementById('welcome');
  if(w){ w.dataset.firstVisit = 'true'; w.style.display = 'flex'; w.classList.remove('exit'); }
  const a = document.getElementById('auth'); if(a) a.classList.remove('open');
  const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open','store-only','ready'); }
}
window.forceShowWelcome = forceShowWelcome;

function showAuthScreen(){
  try{
    const w = document.getElementById('welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); }
    const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open','store-only','ready'); }
    const a = document.getElementById('auth'); if(a) a.classList.add('open');
    if(typeof showAuthForm === 'function') showAuthForm('login');
  }catch(e){}
}
window.showAuthScreen = showAuthScreen;

/* ================== enterApp — سريع ================== */
async function enterApp(){
  try{
    if(session && session.user){
      window._lastInitializedUserId = session.user.id;
      window._appInitialized = true;
    }

    hideAllScreens();
    if(!session){ await showWelcome(); return false; }

    /* جلب الملف الشخصي */
    let profileData = null;
    try{
      const r = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if(r.error) throw r.error;
      profileData = r.data;
    }catch(err){
      console.error('profile fetch:', err);
      try{ toast('تعذّر تحميل الملف', 'err'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      session = null; currentUserObj = null;
      window._appInitialized = false;
      window._lastInitializedUserId = null;
      forceShowWelcome();
      return false;
    }

    if(!profileData){
      try{ await sb.auth.signOut(); }catch(e){}
      session = null; currentUserObj = null;
      forceShowWelcome();
      return false;
    }

    currentUserObj = profileData;

    /* ⭐ فحص الاشتراك في الخلفية - لا يوقف التحميل */
    if(typeof checkSubscriptionOnLogin === 'function'){
      checkSubscriptionOnLogin().then(wasExpired => {
        if(wasExpired){
          sb.from('profiles').select('*').eq('id', session.user.id).single().then(r => {
            if(r.data){
              currentUserObj = r.data;
              applyUserUI();
              const appEl = document.getElementById('app');
              if(appEl) appEl.classList.remove('store-only');
              go('store');
            }
          });
        }
      }).catch(()=>{});
    }

    /* التفضيلات */
    try{ loadPrefs(); }catch(e){}
    try{ loadPrefsFromDB(); }catch(e){}
    try{ loadDrawings(); }catch(e){}
    try{ applyTheme(); }catch(e){}
    try{ applyUserUI(); }catch(e){}

    const appEl = document.getElementById('app');
    if(appEl) appEl.classList.add('open');
    const mainScroll = document.getElementById('mainScroll');
    if(mainScroll) mainScroll.scrollTop = 0;

    /* تحميل الدورات + الإعدادات */
    const privileged = typeof isPrivileged === 'function' && isPrivileged();

    /* بالتوازي */
    await Promise.all([
      (async () => { try{ if(typeof loadStoreSettings === 'function') await loadStoreSettings(); }catch(e){} })(),
      (async () => { try{ if(typeof loadProducts === 'function') await loadProducts(); }catch(e){} })(),
      (async () => { try{ if(typeof loadCourses === 'function') await loadCourses(); }catch(e){} })()
    ]);

    if(privileged || currentUserObj.status === 'approved'){
      /* حمّل الباقي في الخلفية */
      Promise.all([
        loadProfilesAndFiles(),
        loadMyProgress(),
        loadVideos(),
        loadMyVideoProgress(),
        (async () => { try{ if(typeof loadNotifications === 'function') await loadNotifications(); }catch(e){} })()
      ]).then(() => {
        try{ refreshAll(); }catch(e){}
      }).catch(()=>{});
    } else {
      DB.files = [];
      try{ renderFiles(); renderRecent(); }catch(e){}
    }

    /* قرار المتجر */
    const _showStore = typeof shouldShowStore === 'function' ? shouldShowStore() : false;
    const storeEl = document.getElementById('view-store');
    const titlesOk = (typeof TITLES !== 'undefined' && TITLES.store);

    if(_showStore && storeEl && titlesOk){
      if(appEl) appEl.classList.add('store-only');
      try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
      try{ if(typeof renderProducts === 'function') renderProducts(); }catch(e){}
      try{ if(typeof applyStoreSettings === 'function') applyStoreSettings(); }catch(e){}
      try{ if(typeof renderStoreUserBadge === 'function') renderStoreUserBadge(); }catch(e){}
      try{ if(typeof renderTestimonials === 'function') renderTestimonials(); }catch(e){}
      try{ go('store'); }catch(e){}
      setTimeout(() => { try{ toast('🛒 اختر دورتك ومدتها', 'ok'); }catch(e){} }, 600);
    } else {
      if(appEl) appEl.classList.remove('store-only');
      try{ goFromHash(); }catch(e){}
    }

    /* رندر عناصر فورية */
    try{ renderTasks(); }catch(e){}
    try{ renderBadges(); }catch(e){}
    try{ renderFeatures(); }catch(e){}
    try{ renderThemesGrid(); }catch(e){}
    if(typeof notesArea !== 'undefined' && notesArea) notesArea.value = userData.notes || '';
    try{ if(typeof TIMER !== 'undefined'){ TIMER.mode = 'focus'; TIMER.remain = timerTotalSec('focus'); updateTimerUI(); } }catch(e){}
    try{ applyReaderTheme(); }catch(e){}
    try{ applySnapClass(); }catch(e){}
    try{ syncSettingsUI(); }catch(e){}
    try{ renderDrawToolbar(); }catch(e){}

    /* الخلفية */
    try{ syncMyXp(); }catch(e){}
    sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUserObj.id).then(()=>{}).catch(()=>{});

    setTimeout(() => { try{ toast(`أهلاً بك ${currentUserObj.name}`, 'ok'); }catch(e){} }, 300);

    /* اشتراكات realtime */
    try{ subscribeMyProfile(); }catch(e){}
    try{ subscribeFiles(); }catch(e){}
    try{ if(typeof subscribeVideos === 'function') subscribeVideos(); }catch(e){}
    try{ if(typeof subscribeProductsAndSettings === 'function') subscribeProductsAndSettings(); }catch(e){}
    try{ if(typeof subscribeNotifications === 'function') subscribeNotifications(); }catch(e){}
    try{ if(privileged && typeof subscribeProfilesForAdmin === 'function') subscribeProfilesForAdmin(); }catch(e){}

    /* ميزات الرئيس */
    try{ if(typeof initOwnerFeatures === 'function') await initOwnerFeatures(); }catch(e){}
    try{ if(typeof renderSubscriptionInfo === 'function') renderSubscriptionInfo(); }catch(e){}

    /* ⭐ اطلب فتح الهدايا غير المفتوحة فور الدخول */
    try{ if(typeof checkAndShowUnopenedGifts === 'function') await checkAndShowUnopenedGifts(); }catch(e){}

    /* watch hash */
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

    /* أظهر التطبيق */
    if(appEl) appEl.classList.add('ready');

    return true;
  }catch(err){
    console.error('enterApp fatal:', err);
    try{ toast('خطأ غير متوقع', 'err'); }catch(e){}
    try{ await sb.auth.signOut(); }catch(e){}
    session = null; currentUserObj = null;
    window._appInitialized = false;
    window._lastInitializedUserId = null;
    forceShowWelcome();
    return false;
  }
}

function refreshAll(){
  try{
    renderFiles(); renderHomeStats(); updateSidebar();
    if(document.getElementById('view-progress') && document.getElementById('view-progress').classList.contains('active')) renderProgress();
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

/* ================== الأزرار ================== */
function bindEmergencyButtons(){
  const enterBtn = document.getElementById('enterBtn');
  if(enterBtn && !enterBtn.dataset.bound){
    enterBtn.dataset.bound = '1';
    enterBtn.addEventListener('click', async () => {
      if(enterBtn.disabled) return;
      enterBtn.disabled = true;
      const orig = enterBtn.innerHTML;
      enterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

      try{
        const r = await sb.auth.getSession();
        const s = r.data.session;

        if(s){
          session = s;
          try{
            await Promise.race([
              enterApp(),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
            ]);
          }catch(err){
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
        showAuthScreen();
      }finally{
        setTimeout(() => {
          if(enterBtn){ enterBtn.disabled = false; enterBtn.innerHTML = orig; }
        }, 500);
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

/* ================== الإقلاع ================== */
(async function init(){
  try{
    userData = defaultUD();
    applyTheme();
    bindEmergencyButtons();

    let s = null;
    try{ const r = await sb.auth.getSession(); s = r.data.session; }catch(e){}
    session = s;

    sb.auth.onAuthStateChange(async (event, newSession) => {
      session = newSession;

      if(event === 'PASSWORD_RECOVERY'){
        setTimeout(() => { if(typeof showRecoveryModal === 'function') showRecoveryModal(); }, 500);
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
        if(window._appInitialized && window._lastInitializedUserId === uid) return;

        window._lastInitializedUserId = uid;
        window._appInitialized = true;

        try{
          await Promise.race([
            enterApp(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
          ]);
        }catch(e){
          try{ await sb.auth.signOut(); }catch(err){}
          window._appInitialized = false;
          window._lastInitializedUserId = null;
          forceShowWelcome();
        }
        return;
      }

      if(event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
    });

    if(session){
      try{
        await Promise.race([
          enterApp(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
      }catch(e){
        try{ await sb.auth.signOut(); }catch(err){}
        session = null;
        currentUserObj = null;
        forceShowWelcome();
      }
    } else {
      let hasVisited = false;
      try{ hasVisited = !!localStorage.getItem('abdq_has_visited'); }catch(e){}

      if(hasVisited){
        showAuthScreen();
      } else {
        try{ localStorage.setItem('abdq_has_visited', '1'); }catch(e){}
        const w = document.getElementById('welcome');
        if(w){ w.dataset.firstVisit = 'true'; w.style.display = 'flex'; }
      }
    }

    if(window.location.hash && window.location.hash.includes('type=recovery')){
      setTimeout(() => { if(typeof showRecoveryModal === 'function') showRecoveryModal(); }, 800);
    }

    let rotTimer = null;
    window.addEventListener('orientationchange', () => {
      clearTimeout(rotTimer);
      rotTimer = setTimeout(() => { try{ computeBaseWidth(); }catch(e){} }, 350);
    });

    try{ setupDrawUI(); }catch(e){}

  }catch(err){
    console.error('❌ init:', err);
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
  try{ if(window._giftsChannel) sb.removeChannel(window._giftsChannel); }catch(e){}
  try{ if(NOTIF.channel) sb.removeChannel(NOTIF.channel); }catch(e){}
});
