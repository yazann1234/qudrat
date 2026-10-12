/* ============================================================
   05) NAV — التنقل + الروابط + حماية #admin
============================================================ */

const TITLES = {
  home:['الرئيسية','أهلاً بك مجدداً، لنواصل رحلة التفوق'],
  store:['المتجر','اختر دورتك وفعّل اشتراكك'],
  files:['الملفات','مكتبتك التعليمية الكاملة'],
  videos:['الفيديوهات','مكتبة الدروس المرئية'],
  quiz:['لعبة العباقرة','تحدَّ أصدقاءك في مسابقة سريعة'],
  gifts:['هداياي','صندوق الطالب — الهدايا والمكافآت'],
  studyplan:['الجدول الذكي','خطة مذاكرتك الذكية'],
  adhkar:['الأذكار والأدعية','أذكار الصباح والمساء وقبل المذاكرة'],
  progress:['إنجازي','تقرير مفصّل عن تقدمك في كل ملف'],
  leaderboard:['قائمة المتصدرين','ترتيب الطلاب حسب نقاط XP'],
  profile:['ملفي الشخصي','عدّل بياناتك وصورتك الشخصية'],
  suggestions:['الاقتراحات','شاركنا أفكارك ومقترحاتك لتطوير المنصة'],
  about:['من نحن','تعرّف على منصة عباقرة القدرات'],
  features:['المزايا','كل ما تقدمه لك منصة عباقرة القدرات'],
  settings:['الإعدادات','خصّص تجربتك بالشكل الذي يناسبك'],
  admin:['لوحة الأدمن','إدارة كاملة للمستخدمين والملفات']
};

function canAccess(view){
  if(view !== 'admin') return true;
  return currentUserObj && (currentUserObj.role === 'admin' || currentUserObj.role === 'owner');
}

function go(view, skipHash){
  if(!TITLES[view]) view = 'home';

  /* حماية #admin */
  if(!canAccess(view)){
    toast('هذه الصفحة للأدمن فقط', 'err');
    if(location.hash.slice(1) === 'admin'){
      try{ history.replaceState(null, '', '#home'); }catch(e){ location.hash = 'home'; }
    }
    view = 'home';
  }

  /* منع التنقل خارج المتجر */
  const appEl = document.getElementById('app');
  if(appEl && appEl.classList.contains('store-only') && view !== 'store'){
    view = 'store';
  }

  if(!skipHash && location.hash.slice(1) !== view){
    try{ history.replaceState(null, '', '#' + view); }catch(e){ location.hash = view; }
  }

  const currentActive = document.querySelector('.view.active');
  const targetView = document.getElementById('view-' + view);

  if(currentActive && currentActive !== targetView){
    currentActive.classList.add('leaving');
    setTimeout(() => {
      currentActive.classList.remove('leaving');
      currentActive.classList.remove('active');
      if(targetView) targetView.classList.add('active');
    }, 180);
  } else if(targetView){
    targetView.classList.add('active');
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  const meta = TITLES[view];
  const pageTitleEl = document.getElementById('pageTitle');
  const pageSubEl = document.getElementById('pageSub');
  if(pageTitleEl) pageTitleEl.textContent = meta[0];
  if(pageSubEl) pageSubEl.textContent = meta[1];

  const mainScroll = document.getElementById('mainScroll');
  if(mainScroll) mainScroll.scrollTop = 0;
  document.title = meta[0] + ' — عباقرة القدرات';

  setTimeout(() => {
    if(view === 'home' && typeof renderHomeStats === 'function') renderHomeStats();
    if(view === 'home' && typeof updateHomeCountdown === 'function') updateHomeCountdown();
    if(view === 'progress' && typeof renderProgress === 'function') renderProgress();
    if(view === 'admin' && typeof renderAdmin === 'function') renderAdmin();
    if(view === 'files' && typeof renderFiles === 'function') renderFiles();
    if(view === 'videos' && typeof renderVideos === 'function') renderVideos();
    if(view === 'store' && typeof renderProducts === 'function') renderProducts();
    if(view === 'store' && typeof applyStoreSettings === 'function') applyStoreSettings();
    if(view === 'store' && typeof renderTestimonials === 'function') renderTestimonials();
    if(view === 'leaderboard' && typeof renderLeaderboard === 'function') renderLeaderboard();
    if(view === 'profile' && typeof renderProfile === 'function') renderProfile();
    if(view === 'adhkar' && typeof renderAdhkarSection === 'function') renderAdhkarSection();
    if(view === 'studyplan' && typeof renderStudyPlan === 'function') renderStudyPlan();
    if(view === 'quiz' && typeof initQuiz === 'function') initQuiz();
    if(view === 'gifts' && typeof renderMyGifts === 'function') renderMyGifts();
    if(view === 'suggestions' && typeof renderMySuggestions === 'function') renderMySuggestions();
  }, 180);
}
window.go = go;

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1) || 'home';
  if(v.startsWith('watch=')) return;
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

/* ⭐ تنقل موحّد: أي زر فيه data-view (القائمة الجانبية، قائمة الجوال، أي زر جديد)
   يشتغل تلقائياً — حتى لو أُضيف للصفحة لاحقاً */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if(!btn || btn.closest('.view')) return;   /* نتجاهل عناصر داخل الصفحات نفسها */
  const view = btn.dataset.view;
  if(!view || !TITLES[view]) return;
  e.preventDefault();
  const mum = document.getElementById('mobileUserMenu');
  if(mum) mum.classList.remove('open');
  go(view);
});
