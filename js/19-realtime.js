/* ============================================================
   19) REALTIME — مع حماية شاملة + debounce لتخفيف الضغط
============================================================ */

function cleanupChannels(){
  try{ if(myProfileChannel) sb.removeChannel(myProfileChannel); }catch(e){}
  try{ if(filesChannel) sb.removeChannel(filesChannel); }catch(e){}
  try{ if(profilesChannel) sb.removeChannel(profilesChannel); }catch(e){}
  try{ if(window._videosChannel) sb.removeChannel(window._videosChannel); }catch(e){}
  try{ if(window._productsChannel) sb.removeChannel(window._productsChannel); }catch(e){}
  try{ if(window._giftsChannel) sb.removeChannel(window._giftsChannel); }catch(e){}
  try{ if(typeof resetNotifications === 'function') resetNotifications(); }catch(e){}
  try{ if(typeof stopDeviceWatch === 'function') stopDeviceWatch(); }catch(e){}
  try{ if(typeof srCleanup === 'function' && typeof SR !== 'undefined' && SR.room) srCleanup(); }catch(e){}
  clearInterval(_myProfilePoll); clearInterval(_adminPollTimer);
  myProfileChannel = filesChannel = profilesChannel = null;
  window._videosChannel = null;
  window._productsChannel = null;
  window._giftsChannel = null;
}

/* ⭐ safeCall: نستدعي الدالة فقط إن كانت موجودة */
function safeCall(fnName, ...args){
  try{
    if(typeof window[fnName] === 'function') return window[fnName](...args);
  }catch(e){ console.warn('safeCall ' + fnName + ' error:', e); }
}

/* ⭐ احتياط للطالب: فحص حالته ودوراته كل 60 ثانية (لو Realtime لجدول profiles مطفأ) */
let _myProfilePoll = null;
const MY_PROFILE_COLS = 'id,status,role,course_id,course_ids,subscription_start,subscription_end,subscription_months,purchase_submitted,name,avatar_url,phone,kahoot_wins,kahoot_games,kahoot_total_score';
function startMyProfilePoll(){
  clearInterval(_myProfilePoll);
  _myProfilePoll = setInterval(async () => {
    if(!currentUserObj || document.hidden) return;
    try{
      const { data, error } = await sb.from('profiles').select(MY_PROFILE_COLS).eq('id', currentUserObj.id).maybeSingle();
      if(error || !data) return;
      const keys = ['status','role','course_id','course_ids','subscription_end','purchase_submitted'];
      const changed = keys.some(k => JSON.stringify(currentUserObj[k]) !== JSON.stringify(data[k]));
      if(changed && typeof window._applyMyProfileUpdate === 'function') window._applyMyProfileUpdate(data);
    }catch(e){}
  }, 60000);
}

function subscribeMyProfile(){
  if(!session) return;
  startMyProfilePoll();
  try{
    if(myProfileChannel) sb.removeChannel(myProfileChannel);
    const uid = session.user.id;
    const chName = 'my-prof-' + uid + '-' + Date.now();

    myProfileChannel = sb.channel(chName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: 'id=eq.' + uid
      }, payload => { window._applyMyProfileUpdate(payload.new || {}); })
      .subscribe();
  }catch(e){ console.warn('subscribeMyProfile error:', e); }
}

window._applyMyProfileUpdate = function(newRow){
        try{
          const oldStatus = currentUserObj ? currentUserObj.status : null;
          const oldRole = currentUserObj ? currentUserObj.role : null;
          const oldCourse = currentUserObj ? getUserCourseIds().join(',') : '';

          /* حدّث الحالة بدون كسر */
          currentUserObj = Object.assign({}, currentUserObj || {}, newRow || {});

          safeCall('applyUserUI');
          safeCall('renderSubscriptionInfo');

          const profView = document.getElementById('view-profile');
          if(profView && profView.classList.contains('active')) safeCall('renderProfile');

          if((currentUserObj.role === 'admin' || currentUserObj.role === 'owner') && oldRole !== currentUserObj.role){
            const an = document.getElementById('adminNav');
            if(an) an.style.display = 'flex';
            subscribeProfilesForAdmin();
          }

          if(currentUserObj.status === 'approved' && oldStatus !== 'approved'){
            try{ if(typeof registerDevice === 'function') registerDevice(); }catch(e){}
            toast('🎉 تمت الموافقة على حسابك!', 'ok');
            safeCall('renderSubBanners');

            const appEl = document.getElementById('app');
            if(appEl) appEl.classList.remove('store-only');

            setTimeout(async () => {
              /* لا نعلن عن الملفات القديمة كأنها جديدة لحظة التفعيل */
              try{ if(typeof NOTIF !== 'undefined') NOTIF.primed = false; }catch(e){}
              try{ await loadProfilesAndFiles(); }catch(e){}
              try{ await loadMyProgress(); }catch(e){}
              try{ await loadVideos(); }catch(e){}
              try{ await loadMyVideoProgress(); }catch(e){}
              try{ await loadNotifications(); }catch(e){}
              safeCall('primeNotifications');
              safeCall('startNotifPolling');
              safeCall('renderFiles'); safeCall('renderRecent'); safeCall('renderHomeStats'); safeCall('updateSidebar');
              safeCall('renderCoursesGrid');
              safeCall('go', 'home');
              toast('✅ أهلاً بك في المنصة!', 'ok');
            }, 400);
          }
          else if(currentUserObj.status === 'rejected' && oldStatus !== 'rejected'){
            toast('تم رفض طلبك', 'warn');
            safeCall('renderSubBanners');
          }
          else if(getUserCourseIds().join(',') !== oldCourse){
            toast('📚 تم تحديث دوراتك', 'ok');
            safeCall('renderFiles'); safeCall('renderVideos'); safeCall('rebuildNotifications');
            safeCall('renderCoursesGrid'); safeCall('renderCourseFilters');
          }
        }catch(err){
          console.warn('profile update handler error:', err);
        }
};

/* ⭐ debounce: لو انرفعت عدة ملفات ورا بعض، نحمّل مرة واحدة فقط */
const _reloadFilesSoon = debounce(() => safeCall('loadProfilesAndFiles'), 500);
const _reloadVideosSoon = debounce(() => safeCall('loadVideos'), 500);

function subscribeFiles(){
  try{ if(filesChannel){ sb.removeChannel(filesChannel); filesChannel = null; } }catch(e){}
  const chName = 'files-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  filesChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => {
      _reloadFilesSoon();
    })
    .subscribe(status => {
      if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
        setTimeout(() => { try{ if(currentUserObj) subscribeFiles(); }catch(e){} }, 5000);
      }
    });
}

function subscribeVideos(){
  try{ if(window._videosChannel) sb.removeChannel(window._videosChannel); }catch(e){}
  const chName = 'videos-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  window._videosChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
      _reloadVideosSoon();
    })
    .subscribe();
}

function subscribeProductsAndSettings(){
  try{ if(window._productsChannel) sb.removeChannel(window._productsChannel); }catch(e){}
  const chName = 'products-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  window._productsChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, debounce(() => {
      safeCall('loadProducts');
    }, 500))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, debounce(async () => {
      try{ await loadCourses(); }catch(e){}
      safeCall('renderCoursesGrid');
    }, 500))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
      safeCall('loadStoreSettings');
    })
    .subscribe();
}

/* ⭐ للأدمن: تحديث صف المستخدم اللي تغيّر فقط (بدون إعادة تحميل الكل)
   + تنبيه عند طلب شراء جديد / تسجيل مستخدم جديد */
function adminNoticeChanges(prev, u){
  if(!u) return;
  if(u.purchase_submitted && (!prev || !prev.purchase_submitted)){
    const req = typeof getPurchaseRequest === 'function' ? getPurchaseRequest(u) : null;
    toast(`🛒 طلب شراء جديد من ${u.name || u.email}${req && req.course ? ' — ' + req.course.name : ''}`, 'ok');
    try{ if(typeof beep === 'function') beep(); }catch(e){}
  } else if(!prev){
    toast(`👤 مستخدم جديد سجّل: ${u.name || u.email}`, 'ok');
  }
}

const _rerenderAdminSoon = debounce(() => {
  const v = document.getElementById('view-admin');
  if(v && v.classList.contains('active')) safeCall('renderAdmin');
}, 800);

function applyAdminProfileChange(payload){
  if(!isPrivileged() || !payload) return;
  const ev = payload.eventType;
  if(ev === 'DELETE'){
    const id = payload.old && payload.old.id;
    if(id) DB.users = (DB.users || []).filter(x => x.id !== id);
    _rerenderAdminSoon();
    return;
  }
  const u = Object.assign({}, payload.new || {});
  if(!u.id) return;
  delete u.user_data;   /* لا نحتاجه في الجدول */
  const list = DB.users || (DB.users = []);
  const i = list.findIndex(x => x.id === u.id);
  const prev = i >= 0 ? list[i] : null;

  /* تغييرات النقاط/البيانات الشخصية فقط → لا داعي لإعادة رسم الجدول */
  const keys = ['status','role','course_id','course_ids','subscription_end','purchase_submitted','purchase_course_id','purchase_months','name','phone','avatar_url','email'];
  const important = !prev || keys.some(k => JSON.stringify(prev[k]) !== JSON.stringify(u[k]));

  adminNoticeChanges(prev, u);
  if(i >= 0) list[i] = Object.assign({}, prev, u); else list.unshift(u);
  if(important) _rerenderAdminSoon();
}

let _adminPollTimer = null;
async function pollAdminUsers(){
  if(!isPrivileged() || document.hidden) return;
  const fresh = await fetchAdminUsers();
  if(!fresh) return;
  const before = new Map((DB.users || []).map(u => [u.id, u]));
  if(before.size) fresh.forEach(u => adminNoticeChanges(before.get(u.id), u));
  DB.users = fresh;
  _rerenderAdminSoon();
}
window.pollAdminUsers = pollAdminUsers;

function subscribeProfilesForAdmin(){
  if(!isPrivileged()) return;
  if(!profilesChannel){
    profilesChannel = sb.channel('profiles-admin-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, applyAdminProfileChange)
      .subscribe();
  }
  /* احتياط خفيف: تحديث القائمة كل 45 ثانية فقط لما لوحة الأدمن مفتوحة */
  clearInterval(_adminPollTimer);
  _adminPollTimer = setInterval(() => {
    const v = document.getElementById('view-admin');
    if(v && v.classList.contains('active')) pollAdminUsers();
  }, 45000);
}
