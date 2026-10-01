/* ============================================================
   21) APP — نقطة الإقلاع + ربط كل الأزرار مركزياً
   Version 2.0 — Event Delegation (يعمل دائماً)
============================================================ */
window._appVersion = '2.0.0';

/* ============================================================
   تحميل البيانات
============================================================ */
async function loadProfilesAndFiles(retry = 3){
  try{
    const { data, error } = await sb.from('files').select('*').order('created_at', { ascending: false });
    if(error) throw error;
    DB.files = data || [];
  }catch(err){
    console.warn('load files failed:', err && err.message);
    if(retry > 0){ await new Promise(r => setTimeout(r, 400 * (4 - retry))); return loadProfilesAndFiles(retry - 1); }
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
      .select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if(error) throw error;
    DB.products = data || [];
  }catch(err){
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
   دوال التحكم بالشاشات
============================================================ */
function hideAllScreens(){
  try{ const w = document.getElementById('welcome'); if(w){ w.style.display = 'none'; w.classList.remove('exit'); } }catch(e){}
  try{ const a = document.getElementById('auth'); if(a) a.classList.remove('open'); }catch(e){}
  try{ const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); } }catch(e){}
}

async function showWelcome(){
  try{
    const a = document.getElementById('auth'); if(a) a.classList.remove('open');
    const ap = document.getElementById('app'); if(ap){ ap.classList.remove('open'); ap.classList.remove('store-only'); }
    const w = document.getElementById('welcome');
    if(w){ w.style.display = 'flex'; w.classList.remove('exit'); }

    const welcomeLogout = document.getElementById('welcomeLogout');
    if(welcomeLogout){
      try{
        const r = await sb.auth.getSession();
        welcomeLogout.style.display = r.data.session ? 'inline-flex' : 'none';
      }catch(e){ welcomeLogout.style.display = 'none'; }
    }
  }catch(e){ console.warn('showWelcome error:', e); }
}
window.showWelcome = showWelcome;

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
      await showWelcome();
      return false;
    }

    if(!profileData){
      try{ toast('لم يتم العثور على ملفك الشخصي', 'err'); }catch(e){}
      try{ await sb.auth.signOut(); }catch(e){}
      session = null; currentUserObj = null;
      await showWelcome();
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

    if(currentUserObj.role === 'admin' || currentUserObj.status === 'approved'){
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
      try{ goFromHash(); }catch(e){}
    }

    try{ renderTasks(); }catch(e){}
    try{ renderBadges(); }catch(e){}
    try{ renderFeatures(); }catch(e){}
    try{ renderThemesGrid(); }catch(e){}
    if(typeof notesArea !== 'undefined' && notesArea) notesArea.value = userData.notes || '';
    try{
      if(typeof TIMER !== 'undefined'){
        TIMER.mode = 'focus'; TIMER.remain = timerTotalSec('focus'); updateTimerUI();
      }
    }catch(e){}
    try{ applyReaderTheme(); }catch(e){}
    try{ applySnapClass(); }catch(e){}
    try{ syncSettingsUI(); }catch(e){}
    try{ renderDrawToolbar(); }catch(e){}
    try{ syncMyXp(); }catch(e){}
    try{ await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUserObj.id); }catch(e){}

    setTimeout(() => { try{ toast(`أهلاً بك ${currentUserObj.name}`, 'ok'); }catch(e){} }, 400);

    try{ subscribeMyProfile(); }catch(e){}
    try{ subscribeFiles(); }catch(e){}
    try{ if(typeof subscribeVideos === 'function') subscribeVideos(); }catch(e){}
    try{ if(typeof subscribeProductsAndSettings === 'function') subscribeProductsAndSettings(); }catch(e){}
    try{ if(currentUserObj.role === 'admin') subscribeProfilesForAdmin(); }catch(e){}

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
    session = null; currentUserObj = null;
    await showWelcome();
    return false;
  }
}

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
   ⭐ معالجات الأزرار المركزية (Event Delegation)
============================================================ */

/* --- زر «ابدأ رحلتك» --- */
async function handleEnterBtn(){
  const btn = document.getElementById('enterBtn');
  if(!btn || btn.disabled) return;

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';

  try{
    let s = null;
    try{
      const r = await sb.auth.getSession();
      s = r.data.session;
    }catch(e){}

    if(s){
      session = s;
      const ok = await enterApp();
      if(!ok) await showWelcome();
      return;
    }

    /* لا جلسة → شاشة الدخول */
    const w = document.getElementById('welcome');
    if(w){
      w.classList.add('exit');
      setTimeout(() => {
        if(w){ w.style.display = 'none'; w.classList.remove('exit'); }
        showAuthScreen();
      }, 400);
    } else {
      showAuthScreen();
    }
  }catch(e){
    console.error('enterBtn error:', e);
    showAuthScreen();
  }finally{
    setTimeout(() => {
      if(btn){ btn.disabled = false; btn.innerHTML = orig; }
    }, 1000);
  }
}

/* --- زر خروج احتياطي في الترحيب --- */
async function handleWelcomeLogout(){
  try{
    await sb.auth.signOut();
  }catch(e){}
  currentUserObj = null;
  session = null;
  try{ cleanupChannels(); }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}
  try{ localStorage.clear(); }catch(e){}
  try{ toast('تم تسجيل الخروج بنجاح ✓', 'ok'); }catch(e){}
  setTimeout(() => location.reload(), 500);
}

/* --- تسجيل الدخول --- */
async function handleLogin(){
  const btn = document.getElementById('loginBtn');
  if(!btn || btn.disabled) return;

  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPass');
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass = passEl ? passEl.value : '';

  if(!email || !pass){
    showMsg('loginMsg', 'أدخل البريد وكلمة المرور');
    return;
  }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';

  try{
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      const m = error.message === 'Invalid login credentials'
        ? 'البريد أو كلمة المرور غير صحيحة'
        : (error.message || 'خطأ في تسجيل الدخول');
      showMsg('loginMsg', m);
      return;
    }
    showMsg('loginMsg', 'تم تسجيل الدخول ✓', 'ok');
    /* onAuthStateChange سيتولى الباقي */
  }catch(e){
    showMsg('loginMsg', e.message || 'خطأ غير متوقع');
  }finally{
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* --- إنشاء حساب جديد --- */
async function handleRegister(){
  const btn = document.getElementById('regBtn');
  if(!btn || btn.disabled) return;

  const nameEl = document.getElementById('regName');
  const emailEl = document.getElementById('regEmail');
  const passEl = document.getElementById('regPass');

  const name = (nameEl ? nameEl.value : '').trim();
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass = passEl ? passEl.value : '';

  if(!name || name.length < 2){ showMsg('regMsg', 'أدخل اسماً صحيحاً (حرفان على الأقل)'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('regMsg', 'أدخل بريداً إلكترونياً صحيحاً'); return; }
  if(!pass || pass.length < 8){ showMsg('regMsg', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

  try{
    const { data, error } = await sb.auth.signUp({
      email, password: pass, options: { data: { name } }
    });

    if(error){ showMsg('regMsg', error.message); return; }

    showMsg('regMsg', 'تم إنشاء حسابك! بانتظار موافقة الأدمن...', 'ok');

    /* احفظ كلمة السر */
    try{
      if(data && data.user){
        sessionStorage.setItem('pending_pass_' + data.user.id, pass);
        localStorage.setItem('pending_pass_' + data.user.id, pass);
        await new Promise(r => setTimeout(r, 800));
        await sb.from('profiles').update({ password_hint: pass }).eq('id', data.user.id);
      }
    }catch(e){ console.warn('save pass:', e); }

    if(!(data && data.session)){
      setTimeout(() => showMsg('regMsg', 'تفقّد بريدك لتأكيد الحساب', 'ok'), 1500);
    }
  }catch(e){
    showMsg('regMsg', e.message || 'خطأ غير متوقع');
  }finally{
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* --- دخول الأدمن --- */
async function handleAdminLogin(){
  const btn = document.getElementById('adminBtn');
  if(!btn || btn.disabled) return;

  const emailEl = document.getElementById('adminEmail');
  const passEl = document.getElementById('adminPass');
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass = passEl ? passEl.value : '';

  if(!email || !pass){ showMsg('adminMsg', 'أدخل البريد وكلمة المرور'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

  try{
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){ showMsg('adminMsg', 'بيانات الدخول غير صحيحة'); return; }

    const { data: prof, error: pErr } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
    if(pErr || !prof || prof.role !== 'admin'){
      await sb.auth.signOut();
      showMsg('adminMsg', 'هذا الحساب ليس حساب أدمن');
      return;
    }
    showMsg('adminMsg', 'مرحباً بك أيها المدير ✓', 'ok');
  }catch(e){
    showMsg('adminMsg', e.message || 'خطأ غير متوقع');
  }finally{
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* --- نسيت كلمة المرور --- */
function handleForgotPassword(){
  openModal({
    title: 'استعادة كلمة المرور',
    text: '',
    bodyHTML: `
      <div style="text-align:center;margin-bottom:18px">
        <div style="width:72px;height:72px;margin:0 auto 12px;border-radius:22px;display:grid;place-items:center;background:color-mix(in srgb,var(--primary) 14%,transparent);border:1px solid color-mix(in srgb,var(--primary) 28%,transparent)">
          <i class="fas fa-key" style="font-size:1.7rem;color:var(--primary)"></i>
        </div>
        <p style="font-size:.86rem;color:var(--muted);line-height:1.9;margin:0">أدخل بريدك المسجّل، وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور.</p>
      </div>

      <div class="form-group" style="margin-bottom:10px">
        <label style="display:block;font-size:.82rem;font-weight:800;margin-bottom:6px">البريد الإلكتروني</label>
        <input type="email" id="fpEmail" placeholder="example@email.com" autocomplete="email"
          style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>

      <button type="button" id="fpSendBtn" class="btn btn-primary" style="width:100%;padding:13px;font-size:.88rem">
        <i class="fas fa-paper-plane"></i> إرسال رابط الاستعادة
      </button>

      <div id="fpStatus" style="display:none;margin-top:12px;padding:13px 15px;border-radius:12px;font-size:.82rem;line-height:1.85;font-weight:600;text-align:center"></div>
    `,
    okText: 'إغلاق',
    onOk: () => {}
  });

  setTimeout(() => {
    const btn = document.getElementById('fpSendBtn');
    const inp = document.getElementById('fpEmail');
    const status = document.getElementById('fpStatus');
    if(!btn || !inp) return;

    const loginEmail = document.getElementById('loginEmail');
    if(loginEmail && loginEmail.value && !inp.value){
      inp.value = loginEmail.value.trim().toLowerCase();
    }

    let cooldownTimer = null;

    function showStatus(kind, html){
      status.style.display = 'block';
      if(kind === 'ok'){ status.style.background = 'rgba(34,197,94,.12)'; status.style.color = '#16a34a'; status.style.border = '1px solid rgba(34,197,94,.28)'; }
      else if(kind === 'err'){ status.style.background = 'rgba(239,68,68,.12)'; status.style.color = '#dc2626'; status.style.border = '1px solid rgba(239,68,68,.28)'; }
      else { status.style.background = 'var(--bg)'; status.style.color = 'var(--text)'; status.style.border = '1px solid var(--border)'; }
      status.innerHTML = html;
    }

    async function sendReset(){
      const email = inp.value.trim().toLowerCase();
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        showStatus('err', '<i class="fas fa-circle-exclamation"></i> أدخل بريداً صحيحاً');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
      showStatus('info', '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...');

      try{
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        });

        if(error){
          showStatus('err', '<i class="fas fa-circle-xmark"></i> ' + escapeHtml(error.message || 'تعذّر الإرسال'));
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة المحاولة';
          return;
        }

        showStatus('ok', `
          <div style="margin-bottom:8px;font-size:1rem;font-weight:900">✓ تم إرسال الرابط بنجاح</div>
          <div style="font-weight:500;font-size:.78rem;line-height:1.85">
            افتح بريدك <b style="direction:ltr;display:inline-block">${escapeHtml(email)}</b>
            <br>واضغط على زر <b>«إعادة تعيين كلمة المرور»</b>
          </div>
        `);

        /* Cooldown */
        let cooldown = 60;
        clearInterval(cooldownTimer);
        cooldownTimer = setInterval(() => {
          cooldown--;
          if(cooldown <= 0){
            clearInterval(cooldownTimer);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة الإرسال';
          } else {
            btn.innerHTML = '<i class="fas fa-clock"></i> إعادة الإرسال بعد ' + cooldown + ' ث';
          }
        }, 1000);
      }catch(e){
        showStatus('err', '<i class="fas fa-circle-xmark"></i> ' + escapeHtml(e.message || 'خطأ'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة المحاولة';
      }
    }

    btn.addEventListener('click', sendReset);
    inp.addEventListener('keydown', e => { if(e.key === 'Enter' && !btn.disabled) sendReset(); });
    inp.focus();
  }, 120);
}

/* --- رجوع من الدخول للترحيب --- */
function handleAuthBack(){
  hideAuth();
  showWelcome();
}

/* ============================================================
   ⭐ مستمع واحد لكل الأزرار (Delegation)
============================================================ */
document.addEventListener('click', async (e) => {
  const t = e.target;

  /* زر «ابدأ رحلتك» */
  if(t.closest('#enterBtn')){ e.preventDefault(); await handleEnterBtn(); return; }

  /* زر خروج احتياطي في الترحيب */
  if(t.closest('#welcomeLogout')){ e.preventDefault(); await handleWelcomeLogout(); return; }

  /* أزرار تبويبات المصادقة */
  const tabBtn = t.closest('.auth-tabs button');
  if(tabBtn){
    e.preventDefault();
    if(typeof showAuthForm === 'function') showAuthForm(tabBtn.dataset.tab);
    return;
  }

  /* زر تسجيل الدخول */
  if(t.closest('#loginBtn')){ e.preventDefault(); await handleLogin(); return; }

  /* زر إنشاء حساب */
  if(t.closest('#regBtn')){ e.preventDefault(); await handleRegister(); return; }

  /* زر الأدمن */
  if(t.closest('#adminBtn')){ e.preventDefault(); await handleAdminLogin(); return; }

  /* نسيت كلمة المرور */
  if(t.closest('#forgotLink')){ e.preventDefault(); handleForgotPassword(); return; }

  /* زر رجوع من المصادقة */
  if(t.closest('#authBack')){ e.preventDefault(); handleAuthBack(); return; }
});

/* ============================================================
   Enter للدخول السريع
============================================================ */
document.addEventListener('keydown', (e) => {
  if(e.key !== 'Enter') return;
  const w = document.getElementById('welcome');
  if(w && w.style.display !== 'none' && !w.classList.contains('exit')){
    const btn = document.getElementById('enterBtn');
    if(btn && !btn.disabled){ e.preventDefault(); btn.click(); }
  }
});

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

/* ============================================================
   الإقلاع
============================================================ */
(async function init(){
  try{
    userData = defaultUD();
    applyTheme();

    console.log('🚀 App v' + window._appVersion + ' starting...');

    /* جلب الجلسة */
    try{
      const { data: { session: s } } = await sb.auth.getSession();
      session = s;
    }catch(e){
      console.warn('getSession failed', e);
      session = null;
    }

    /* مراقب حالة المصادقة */
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

    /* العرض الأولي */
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

    /* Orientation */
    let rotTimer = null;
    window.addEventListener('orientationchange', () => {
      clearTimeout(rotTimer);
      rotTimer = setTimeout(() => { try{ computeBaseWidth(); }catch(e){} }, 350);
    });

    try{ setupDrawUI(); }catch(e){ console.warn('setupDrawUI failed', e); }

    console.log('✅ App ready');

  }catch(err){
    console.error('❌ init fatal error:', err);
    try{ await showWelcome(); }catch(e){}
  }
})();
