/* ============================================================
   05) NAV — التنقل + الروابط + حماية #admin
============================================================ */

const TITLES = {
  home:['الرئيسية','أهلاً بك مجدداً، لنواصل رحلة التفوق'],
  files:['الملفات','مكتبتك التعليمية الكاملة'],
  videos:['الفيديوهات','مكتبة الدروس المرئية'],
  progress:['إنجازي','تقرير مفصّل عن تقدمك في كل ملف'],
  leaderboard:['قائمة المتصدرين','ترتيب الطلاب حسب نقاط XP'],
  profile:['ملفي الشخصي','عدّل بياناتك وصورتك الشخصية'],
  features:['المزايا','كل ما تقدمه لك منصة العباقرة للقدرات'],
  settings:['الإعدادات','خصّص تجربتك بالشكل الذي يناسبك'],
  admin:['لوحة الأدمن','إدارة كاملة للمستخدمين والملفات']
};

function canAccess(view){
  if(view !== 'admin') return true;
  return currentUserObj && currentUserObj.role === 'admin';
}

function go(view, skipHash){
  if(!TITLES[view]) view = 'home';

  // حماية #admin
  if(!canAccess(view)){
    toast('هذه الصفحة للأدمن فقط', 'err');
    if(location.hash.slice(1) === 'admin'){
      try{ history.replaceState(null, '', '#home'); }catch(e){ location.hash = 'home'; }
    }
    view = 'home';
  }

  if(!skipHash && location.hash.slice(1) !== view){
    try{ history.replaceState(null, '', '#' + view); }catch(e){ location.hash = view; }
  }
  $$('.view').forEach(v => v.classList.remove('active'));
  const t = document.getElementById('view-' + view);
  if(t) t.classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const meta = TITLES[view];
  $('#pageTitle').textContent = meta[0];
  $('#pageSub').textContent = meta[1];
  $('#mainScroll').scrollTop = 0;
  document.title = meta[0] + ' — العباقرة للقدرات';
  if(view === 'progress' && typeof renderProgress === 'function') renderProgress();
  if(view === 'admin' && typeof renderAdmin === 'function') renderAdmin();
  if(view === 'files' && typeof renderFiles === 'function') renderFiles();
  if(view === 'videos' && typeof renderVideos === 'function') renderVideos();
  if(view === 'leaderboard' && typeof renderLeaderboard === 'function') renderLeaderboard();
  if(view === 'profile' && typeof renderProfile === 'function') renderProfile();
}
window.go = go;

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1) || 'home';
  if(v.startsWith('watch=')) return; // لا تتدخل بروابط الفيديو
  if(v === 'admin' && !canAccess('admin')){
    try{ history.replaceState(null, '', '#home'); }catch(e){ location.hash = 'home'; }
    toast('هذه الصفحة للأدمن فقط', 'err');
    go('home', true);
    return;
  }
  if(TITLES[v]) go(v, true);
});

function goFromHash(){
  const v = (location.hash.slice(1) || 'home');
  if(v.startsWith('watch=')){ go('videos', true); return; }
  if(v === 'admin' && !canAccess('admin')){
    try{ history.replaceState(null, '', '#home'); }catch(e){ location.hash = 'home'; }
    go('home', true);
    return;
  }
  go(TITLES[v] ? v : 'home', true);
}

$$('.nav-btn').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.view)));
