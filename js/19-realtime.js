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

function subscribeMyProfile(){
  if(!session) return;
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
      }, payload => {
        try{
          const oldStatus = currentUserObj ? currentUserObj.status : null;
          const oldRole = currentUserObj ? currentUserObj.role : null;
          const oldCourse = currentUserObj ? currentUserObj.course_id : null;

          /* حدّث الحالة بدون كسر */
          currentUserObj = Object.assign({}, currentUserObj || {}, payload.new || {});

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
          else if(currentUserObj.course_id !== oldCourse){
            safeCall('renderFiles'); safeCall('renderVideos'); safeCall('rebuildNotifications');
          }
        }catch(err){
          console.warn('profile update handler error:', err);
        }
      })
      .subscribe();
  }catch(e){ console.warn('subscribeMyProfile error:', e); }
}

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

/* ⭐ للأدمن: تحديث جدول المستخدمين + تنبيه عند وصول طلب شراء جديد */
const _reloadUsersForAdmin = debounce(async () => {
  if(!isPrivileged()) return;
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if(error || !data) return;

  const before = new Map((DB.users || []).map(u => [u.id, u]));
  if(before.size) data.forEach(u => {
    const prev = before.get(u.id);
    if(u.purchase_submitted && u.status !== 'approved' && (!prev || !prev.purchase_submitted)){
      const req = typeof getPurchaseRequest === 'function' ? getPurchaseRequest(u) : null;
      toast(`🛒 طلب شراء جديد من ${u.name || u.email}${req && req.course ? ' — ' + req.course.name : ''}`, 'ok');
      try{ if(typeof beep === 'function') beep(); }catch(e){}
    } else if(!prev){
      toast(`👤 مستخدم جديد سجّل: ${u.name || u.email}`, 'ok');
    }
  });

  DB.users = data;
  safeCall('renderAdmin');
}, 600);

function subscribeProfilesForAdmin(){
  if(!isPrivileged()) return;
  if(profilesChannel) return;
  const chName = 'profiles-admin-' + Date.now();
  profilesChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      _reloadUsersForAdmin();
    })
    .subscribe();
}
