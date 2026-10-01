/* ============================================================
   19) REALTIME — الاشتراكات الفورية
============================================================ */

function cleanupChannels(){
  try{ if(myProfileChannel) sb.removeChannel(myProfileChannel); }catch(e){}
  try{ if(filesChannel) sb.removeChannel(filesChannel); }catch(e){}
  try{ if(profilesChannel) sb.removeChannel(profilesChannel); }catch(e){}
  try{ if(window._videosChannel) sb.removeChannel(window._videosChannel); }catch(e){}
window._videosChannel = null;
  myProfileChannel = filesChannel = profilesChannel = null;
}

function subscribeMyProfile(){
  if(!session) return;
  try{
    if(myProfileChannel) sb.removeChannel(myProfileChannel);
    const uid = session.user.id;
    const chName = 'my-prof-' + uid + '-' + Date.now();
    myProfileChannel = sb.channel(chName)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'profiles', filter: 'id=eq.' + uid }, payload => {
        const oldStatus = currentUserObj ? currentUserObj.status : null;
        const oldRole = currentUserObj ? currentUserObj.role : null;
        currentUserObj = Object.assign({}, currentUserObj, payload.new);
        applyUserUI();
        if($('#view-profile').classList.contains('active')) renderProfile();
        if(currentUserObj.role === 'admin' && oldRole !== 'admin'){ $('#adminNav').style.display = 'flex'; subscribeProfilesForAdmin(); }
        if(currentUserObj.status === 'approved' && oldStatus !== 'approved'){
          toast('🎉 تمت الموافقة على حسابك! جاري تحميل الملفات...', 'ok');
          renderSubBanners();
          setTimeout(async () => {
            try{
              await loadProfilesAndFiles();
              await loadMyProgress();
              renderFiles(); renderRecent(); renderHomeStats(); updateSidebar();
              toast('تم تحميل الملفات بنجاح ✓', 'ok');
            }catch(e){ console.warn('auto-reload failed', e); }
          }, 400);
        }
        else if(currentUserObj.status === 'rejected' && oldStatus !== 'rejected'){ toast('تم رفض طلبك', 'warn'); renderSubBanners(); }
        else if(currentUserObj.status === 'pending'){ renderSubBanners(); }
      })
      .subscribe();
  }catch(e){}
}

function subscribeFiles(){
  try{ if(filesChannel){ sb.removeChannel(filesChannel); filesChannel = null; } }catch(e){}
  const chName = 'files-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  filesChannel = sb.channel(chName)
    .on('postgres_changes', { event:'*', schema:'public', table:'files' }, () => { loadProfilesAndFiles(); })
    .subscribe(status => {
      if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
        setTimeout(() => { try{ subscribeFiles(); }catch(e){} }, 3000);
      }
    });
}

function subscribeProfilesForAdmin(){
  if(!currentUserObj || currentUserObj.role !== 'admin') return;
  if(profilesChannel) return;
  const chName = 'profiles-admin-' + Date.now();
  profilesChannel = sb.channel(chName)
    .on('postgres_changes', { event:'*', schema:'public', table:'profiles' }, () => {
      if(currentUserObj && currentUserObj.role === 'admin'){
        sb.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
          DB.users = (data || []).filter(u => u.role !== 'admin');
          renderAdmin();
        });
      }
    })
    .subscribe();
}

function subscribeVideos(){
  try{ if(window._videosChannel){ sb.removeChannel(window._videosChannel); } }catch(e){}
  const chName = 'videos-live-' + (session ? session.user.id.slice(0,8) : 'g') + '-' + Date.now();
  window._videosChannel = sb.channel(chName)
    .on('postgres_changes', { event:'*', schema:'public', table:'videos' }, () => {
      if(typeof loadVideos === 'function') loadVideos();
    })
    .subscribe();
}
