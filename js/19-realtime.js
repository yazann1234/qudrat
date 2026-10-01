/* ============================================================
   19) REALTIME — مع حماية شاملة
============================================================ */

function cleanupChannels(){
  try{ if(myProfileChannel) sb.removeChannel(myProfileChannel); }catch(e){}
  try{ if(filesChannel) sb.removeChannel(filesChannel); }catch(e){}
  try{ if(profilesChannel) sb.removeChannel(profilesChannel); }catch(e){}
  try{ if(window._videosChannel) sb.removeChannel(window._videosChannel); }catch(e){}
  try{ if(window._productsChannel) sb.removeChannel(window._productsChannel); }catch(e){}
  myProfileChannel = filesChannel = profilesChannel = null;
  window._videosChannel = null;
  window._productsChannel = null;
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

          /* حدّث الحالة بدون كسر */
          currentUserObj = Object.assign({}, currentUserObj || {}, payload.new || {});

          safeCall('applyUserUI');

          const profView = document.getElementById('view-profile');
          if(profView && profView.classList.contains('active')) safeCall('renderProfile');

          if(currentUserObj.role === 'admin' && oldRole !== 'admin'){
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
              try{ await loadProfilesAndFiles(); }catch(e){}
              try{ await loadMyProgress(); }catch(e){}
              try{ await loadVideos(); }catch(e){}
              try{ await loadMyVideoProgress(); }catch(e){}
              safeCall('renderFiles'); safeCall('renderRecent'); safeCall('renderHomeStats'); safeCall('updateSidebar');
              safeCall('go', 'home');
              toast('✅ أهلاً بك في المنصة!', 'ok');
            }, 400);
          }
          else if(currentUserObj.status === 'rejected' && oldStatus !== 'rejected'){
            toast('تم رفض طلبك', 'warn');
            safeCall('renderSubBanners');
          }
        }catch(err){
          console.warn('profile update handler error:', err);
        }
      })
      .subscribe();
  }catch(e){ console.warn('subscribeMyProfile error:', e); }
}

function subscribeFiles(){
  try{ if(filesChannel){ sb.removeChannel(filesChannel); filesChannel = null; } }catch(e){}
  const chName = 'files-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  filesChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => {
      safeCall('loadProfilesAndFiles');
    })
    .subscribe(status => {
      if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
        setTimeout(() => { try{ subscribeFiles(); }catch(e){} }, 3000);
      }
    });
}

function subscribeVideos(){
  try{ if(window._videosChannel) sb.removeChannel(window._videosChannel); }catch(e){}
  const chName = 'videos-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  window._videosChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
      safeCall('loadVideos');
    })
    .subscribe();
}

function subscribeProductsAndSettings(){
  try{ if(window._productsChannel) sb.removeChannel(window._productsChannel); }catch(e){}
  const chName = 'products-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  window._productsChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
      safeCall('loadProducts');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
      safeCall('loadStoreSettings');
    })
    .subscribe();
}

function subscribeProfilesForAdmin(){
  if(!currentUserObj || currentUserObj.role !== 'admin') return;
  if(profilesChannel) return;
  const chName = 'profiles-admin-' + Date.now();
  profilesChannel = sb.channel(chName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      if(currentUserObj && currentUserObj.role === 'admin'){
        sb.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
          DB.users = (data || []).filter(u => u.role !== 'admin');
          safeCall('renderAdmin');
        });
      }
    })
    .subscribe();
}
