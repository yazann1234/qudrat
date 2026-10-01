/* ============================================================
   21) APP — نقطة الإقلاع + تحميل البيانات
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
  if(typeof renderFiles === 'function' && DB.files.length) renderFiles(); // لتحديث زر «شرح الملف»
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

async function enterApp(){
  hideAuth();
  $('#welcome').style.display = 'none';
  if(!session){ showAuth(); return; }
  const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if(error || !data){ toast('تعذّر تحميل الملف الشخصي', 'err'); return; }
  currentUserObj = data;
  loadPrefs();
  loadPrefsFromDB();
  loadDrawings();
  applyTheme();
  applyUserUI();
  $('#app').classList.add('open');
  $('#mainScroll').scrollTop = 0;

  // حمّل إعدادات المتجر والمنتجات دائماً
  try{ if(typeof loadStoreSettings === 'function') await loadStoreSettings(); }catch(e){ console.warn(e); }
  try{ if(typeof loadProducts === 'function') await loadProducts(); }catch(e){ console.warn(e); }

  if(currentUserObj.role === 'admin' || currentUserObj.status === 'approved'){
    await loadProfilesAndFiles();
    await loadMyProgress();
    await loadVideos();
    await loadMyVideoProgress();
  } else {
    DB.files = [];
    renderFiles(); renderRecent();
  }

  // هل نعرض المتجر؟
  const _showStore = typeof shouldShowStore === 'function' ? shouldShowStore() : false;
  const storeEl = document.getElementById('view-store');
  const titlesOk = (typeof TITLES !== 'undefined' && TITLES.store);

  console.log('🛒 showStore:', _showStore, '| status:', currentUserObj.status);

  if(_showStore && storeEl && titlesOk){
    // ⭐ فعّل وضع المتجر فقط
    document.getElementById('app').classList.add('store-only');
    if(typeof renderProducts === 'function') renderProducts();
    if(typeof applyStoreSettings === 'function') applyStoreSettings();
    if(typeof renderStoreUserBadge === 'function') renderStoreUserBadge();
    go('store');
    setTimeout(() => {
      toast('🛒 فعّل اشتراكك للوصول إلى الملفات والفيديوهات', 'ok');
    }, 800);
  } else {
    document.getElementById('app').classList.remove('store-only');
    goFromHash();
  }
  renderTasks(); renderBadges(); renderFeatures(); renderThemesGrid();
  notesArea.value = userData.notes || '';
  TIMER.mode = 'focus';
  TIMER.remain = timerTotalSec('focus');
  updateTimerUI();
  applyReaderTheme(); applySnapClass(); syncSettingsUI();
  renderDrawToolbar();
  try{ syncMyXp(); }catch(e){}
  try{ await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUserObj.id); }catch(e){}
  setTimeout(() => toast(`أهلاً بك ${currentUserObj.name}`, 'ok'), 400);
  subscribeMyProfile();
  subscribeFiles();
  if(typeof subscribeVideos === 'function') subscribeVideos();
  if(currentUserObj.role === 'admin') subscribeProfilesForAdmin();

  // فتح فيديو من الرابط #watch=...
  const m = location.hash.match(/^#watch=(.+)$/);
  if(m && m[1]){
    const vid = m[1];
    setTimeout(() => {
      if((DB.videos || []).some(v => v.id === vid)){
        go('videos', true);
        if(typeof openVideo === 'function') openVideo(vid);
      }
    }, 700);
  }
}

function refreshAll(){
  renderFiles(); renderHomeStats(); updateSidebar();
  if($('#view-progress').classList.contains('active')) renderProgress();
  checkBadges();
}

function showWelcome(){
  $('#welcome').style.display = 'flex';
  $('#welcome').classList.remove('exit');
  $('#auth').classList.remove('open');
  $('#app').classList.remove('open');
}

window.addEventListener('beforeunload', () => {
  clearTimeout(prefsSaveTimer);
  try{ sessionStorage.setItem(prefsKey(), JSON.stringify(pickLocalFields(userData))); }catch(e){}
  saveDrawings(); flushProgressSync();
  if(typeof pushVideoProgress === 'function'){ try{ pushVideoProgress(); }catch(e){} }
});

/* ===== الإقلاع ===== */
(async function init(){
  userData = defaultUD();
  applyTheme();
  try{ const { data: { session: s } } = await sb.auth.getSession(); session = s; }catch(e){ session = null; }

  sb.auth.onAuthStateChange(async (event, newSession) => {
    session = newSession;
    if(event === 'PASSWORD_RECOVERY'){
      setTimeout(() => {
        if(typeof showRecoveryModal === 'function') showRecoveryModal();
      }, 600);
      return;
    }
    if(event === 'SIGNED_IN' && newSession){ await enterApp(); }
    else if(event === 'SIGNED_OUT'){ currentUserObj = null; cleanupChannels(); $('#app').classList.remove('open'); showWelcome(); }
  });

  if(session){ await enterApp(); } else { showWelcome(); }

  // إذا في رابط استعادة في الـ hash
  if(window.location.hash && window.location.hash.includes('type=recovery')){
    setTimeout(() => {
      if(typeof showRecoveryModal === 'function') showRecoveryModal();
    }, 900);
  }

  $('#enterBtn').addEventListener('click', () => {
    const w = $('#welcome'); w.classList.add('exit');
    setTimeout(() => { w.style.display = 'none'; showAuth(); showAuthForm('login'); }, 900);
  });

  document.addEventListener('keydown', function onEnter(e){
    if(e.key === 'Enter' && $('#welcome').style.display !== 'none' && !$('#welcome').classList.contains('exit')){ $('#enterBtn').click(); }
  });

  let rotTimer = null;
  window.addEventListener('orientationchange', () => { clearTimeout(rotTimer); rotTimer = setTimeout(() => { computeBaseWidth(); }, 350); });

  setupDrawUI();
})();
