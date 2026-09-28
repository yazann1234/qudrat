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
  goFromHash();

  if(currentUserObj.role === 'admin' || currentUserObj.status === 'approved'){
    await loadProfilesAndFiles();
    await loadMyProgress();
  } else {
    DB.files = [];
    renderFiles(); renderRecent();
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
  if(currentUserObj.role === 'admin') subscribeProfilesForAdmin();
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
        openModal({
          title: 'تعيين كلمة مرور جديدة',
          text: 'أدخل كلمة المرور الجديدة لحسابك.',
          bodyHTML: `<div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="npPass" placeholder="6 أحرف على الأقل" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none"></div>`,
          okText: 'حفظ كلمة المرور',
          onOk: async () => {
            const p = document.getElementById('npPass').value;
            if(!p || p.length < 6){ toast('كلمة المرور قصيرة', 'err'); return; }
            const { error } = await sb.auth.updateUser({ password: p });
            if(error){ toast('فشل: ' + error.message, 'err'); return; }
            toast('تم تحديث كلمة المرور بنجاح', 'ok');
            try{ history.replaceState(null, '', window.location.pathname); }catch(e){}
          }
        });
      }, 600);
      return;
    }
    if(event === 'SIGNED_IN' && newSession){ await enterApp(); }
    else if(event === 'SIGNED_OUT'){ currentUserObj = null; cleanupChannels(); $('#app').classList.remove('open'); showWelcome(); }
  });

  if(session){ await enterApp(); } else { showWelcome(); }

  if(window.location.hash && window.location.hash.includes('type=recovery')){
    setTimeout(() => {
      openModal({
        title: 'تعيين كلمة مرور جديدة',
        text: 'أدخل كلمة المرور الجديدة لحسابك.',
        bodyHTML: `<div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="npPass2" placeholder="6 أحرف على الأقل" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none"></div>`,
        okText: 'حفظ كلمة المرور',
        onOk: async () => {
          const p = document.getElementById('npPass2').value;
          if(!p || p.length < 6){ toast('كلمة المرور قصيرة', 'err'); return; }
          const { error } = await sb.auth.updateUser({ password: p });
          if(error){ toast('فشل: ' + error.message, 'err'); return; }
          toast('تم تحديث كلمة المرور بنجاح', 'ok');
          try{ history.replaceState(null, '', window.location.pathname); }catch(e){}
        }
      });
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
