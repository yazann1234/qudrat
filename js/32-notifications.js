/* ============================================================
   32) NOTIFICATIONS v2 — إشعارات موثوقة
   - إشعارات الملفات/الفيديوهات تُبنى مباشرة من الملفات نفسها
     (تصل للطالب حتى لو جدول notifications أو Realtime فيه مشكلة)
   - تحترم دورة الطالب (ما يجيه إشعار ملف دورة ثانية)
   - إشعارات موجّهة لمستخدم واحد (تفعيل اشتراك / هدية) لا تصل للجميع
   - Realtime + فحص دوري احتياطي كل دقيقة
   - إشعارات المتصفح (Push محلي) + صوت + الضغط على الإشعار يفتح الملف
============================================================ */

const NOTIF = {
  items: [],        /* القائمة المعروضة (مدموجة) */
  dbItems: [],      /* القادمة من جدول notifications */
  unreadCount: 0,
  open: false,
  channel: null,
  knownIds: new Set(),
  primed: false,    /* قبل التهيئة لا نعلن عن أي إشعار "جديد" */
  pollTimer: null,
  pollTick: 0
};

const NOTIF_DAYS = 30;

function notifSeenKey(){ return 'abdq_notif_last_seen_' + (currentUserObj ? currentUserObj.id : 'g'); }
function getNotifLastSeen(){
  try{ return parseInt(localStorage.getItem(notifSeenKey()) || '0', 10) || 0; }catch(e){ return 0; }
}
function setNotifLastSeen(t){
  try{ localStorage.setItem(notifSeenKey(), String(t || Date.now())); }catch(e){}
}

function notifCanReceiveContent(){
  if(!currentUserObj) return false;
  if(typeof isPrivileged === 'function' && isPrivileged()) return true;
  return currentUserObj.status === 'approved';
}

/* هل هذا الإشعار (من الجدول) يخص المستخدم الحالي؟ */
function canSeeNotif(n){
  if(!n || !currentUserObj) return false;
  if(n.target_user_id && n.target_user_id !== currentUserObj.id) return false;
  if(typeof isPrivileged === 'function' && isPrivileged()) return true;
  if(n.target_course_id && String(n.target_course_id) !== String(currentUserObj.course_id || '')) return false;
  return true;
}

/* ================== تحميل من جدول notifications ================== */
async function loadNotifications(){
  if(!currentUserObj){ NOTIF.dbItems = []; rebuildNotifications(); return; }
  try{
    let r = await sb.from('notifications')
      .select('*')
      .or(`target_user_id.is.null,target_user_id.eq.${currentUserObj.id}`)
      .order('created_at', { ascending: false })
      .limit(60);
    /* لو عمود target_user_id غير موجود → جلب عادي والفلترة محلياً */
    if(r.error){
      r = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    }
    if(r.error) throw r.error;
    /* الملفات والفيديوهات نبنيها من مصدرها مباشرة (تجنباً للتكرار) */
    NOTIF.dbItems = (r.data || []).filter(n => n.type !== 'file' && n.type !== 'video').filter(canSeeNotif);
  }catch(e){
    console.warn('notifications load failed:', e && e.message);
  }
  rebuildNotifications();
}
window.loadNotifications = loadNotifications;

/* ================== إشعارات المحتوى (ملفات + فيديوهات) ================== */
function buildContentNotifs(){
  if(!notifCanReceiveContent()) return [];
  const since = Date.now() - NOTIF_DAYS * 86400000;
  const out = [];
  const courseName = id => {
    const c = (id && typeof getCourseById === 'function') ? getCourseById(id) : null;
    return c ? 'دورة ' + c.name : 'متاح لجميع الطلاب';
  };

  const files = typeof getUserCourseFiles === 'function' ? getUserCourseFiles() : (DB.files || []);
  files.forEach(f => {
    const t = Date.parse(f.created_at || 0);
    if(!t || t < since) return;
    out.push({
      id: 'file:' + f.id, type: 'file',
      title: '📄 ملف جديد: ' + f.title,
      body: (f.category ? f.category + ' • ' : '') + courseName(f.course_id),
      created_at: f.created_at, created_by: f.created_by,
      target_id: f.id, icon: 'fa-file-pdf', color: '#ef4444'
    });
  });

  const videos = typeof getUserCourseVideos === 'function' ? getUserCourseVideos() : (DB.videos || []);
  videos.forEach(v => {
    const t = Date.parse(v.created_at || 0);
    if(!t || t < since) return;
    out.push({
      id: 'video:' + v.id, type: 'video',
      title: '🎬 فيديو جديد: ' + v.title,
      body: (v.category ? v.category + ' • ' : '') + courseName(v.course_id),
      created_at: v.created_at, created_by: v.created_by,
      target_id: v.id, icon: 'fa-video', color: '#dc2626'
    });
  });
  return out;
}

/* ================== دمج + حساب غير المقروء + كشف الجديد ================== */
function rebuildNotifications(){
  if(!currentUserObj){ NOTIF.items = []; NOTIF.unreadCount = 0; updateNotifBadge(); return; }

  const all = buildContentNotifs().concat(
    NOTIF.dbItems.map(n => Object.assign({}, n, { id: 'db:' + n.id }))
  );
  all.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  NOTIF.items = all.slice(0, 60);

  const lastSeen = getNotifLastSeen();
  NOTIF.unreadCount = NOTIF.items.filter(n => Date.parse(n.created_at || 0) > lastSeen).length;

  if(NOTIF.primed){
    const recent = Date.now() - 12 * 3600000;
    const fresh = NOTIF.items.filter(n =>
      !NOTIF.knownIds.has(n.id) &&
      Date.parse(n.created_at || 0) > recent &&
      !(n.created_by && n.created_by === currentUserObj.id)
    );
    fresh.slice(0, 3).forEach(announceNotification);
  }
  NOTIF.items.forEach(n => NOTIF.knownIds.add(n.id));

  updateNotifBadge();
  if(NOTIF.open) renderNotificationsPanel();
}
window.rebuildNotifications = rebuildNotifications;

/* يُستدعى بعد أول تحميل كامل للبيانات: من الآن أي شيء جديد يُعلن عنه */
function primeNotifications(){
  NOTIF.items.forEach(n => NOTIF.knownIds.add(n.id));
  NOTIF.primed = true;
}
window.primeNotifications = primeNotifications;

/* ================== الإعلان عن إشعار جديد ================== */
function announceNotification(n){
  try{ toast('🔔 ' + n.title, 'ok'); }catch(e){}
  try{ if(typeof beep === 'function') beep(); }catch(e){}

  const bell = document.getElementById('notifBtn');
  if(bell){
    bell.classList.remove('ring');
    void bell.offsetWidth;
    bell.classList.add('ring');
  }

  /* إشعار المتصفح (يظهر حتى لو التبويب بالخلفية) */
  try{
    if('Notification' in window && Notification.permission === 'granted' && document.hidden){
      const bn = new Notification(n.title, {
        body: n.body || 'عباقرة القدرات',
        icon: 'assets/logo.png',
        badge: 'assets/logo.png',
        tag: n.id,
        lang: 'ar', dir: 'rtl'
      });
      bn.onclick = () => { try{ window.focus(); }catch(e){} openNotification(n.id); bn.close(); };
    }
  }catch(e){}
}

async function enableBrowserNotifications(){
  if(!('Notification' in window)){ toast('متصفحك لا يدعم الإشعارات', 'warn'); return; }
  try{
    const p = await Notification.requestPermission();
    if(p === 'granted'){
      toast('✓ تم تفعيل إشعارات الجهاز', 'ok');
      try{ new Notification('عباقرة القدرات', { body: 'ستصلك الإشعارات هنا عند نزول ملف أو فيديو جديد', icon: 'assets/logo.png', lang: 'ar', dir: 'rtl' }); }catch(e){}
    } else if(p === 'denied'){
      toast('تم رفض الإذن — فعّله من إعدادات المتصفح', 'warn');
    }
  }catch(e){}
  if(NOTIF.open) renderNotificationsPanel();
}
window.enableBrowserNotifications = enableBrowserNotifications;

/* ================== الواجهة ================== */
function updateNotifBadge(){
  const badge = document.getElementById('notifBadge');
  if(!badge) return;
  if(NOTIF.unreadCount > 0){
    badge.textContent = NOTIF.unreadCount > 9 ? '9+' : NOTIF.unreadCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
  /* عدّاد في عنوان التبويب */
  try{
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = NOTIF.unreadCount > 0 ? `(${NOTIF.unreadCount > 9 ? '9+' : NOTIF.unreadCount}) ${base}` : base;
  }catch(e){}
}

function toggleNotifications(){
  const panel = document.getElementById('notificationsPanel');
  if(!panel) return;
  NOTIF.open = !NOTIF.open;
  panel.classList.toggle('open', NOTIF.open);
  if(NOTIF.open){
    renderNotificationsPanel();   /* يُظهر غير المقروء مميّزاً */
    setNotifLastSeen(Date.now()); /* ثم نصفّر العداد */
    NOTIF.unreadCount = 0;
    updateNotifBadge();
  }
}
window.toggleNotifications = toggleNotifications;

function closeNotifications(){
  const panel = document.getElementById('notificationsPanel');
  if(panel) panel.classList.remove('open');
  NOTIF.open = false;
}
window.closeNotifications = closeNotifications;

function renderNotificationsPanel(){
  const box = document.getElementById('notifList');
  if(!box) return;

  let pushBanner = '';
  if('Notification' in window && Notification.permission === 'default'){
    pushBanner = `
      <button class="notif-push-banner" onclick="enableBrowserNotifications()">
        <i class="fas fa-mobile-screen"></i>
        <span><b>فعّل إشعارات الجهاز</b><small>ليصلك تنبيه فور نزول ملف جديد حتى لو كانت الصفحة مغلقة بالخلفية</small></span>
      </button>`;
  }

  if(!NOTIF.items.length){
    box.innerHTML = pushBanner + `
      <div class="notif-empty">
        <i class="fas fa-bell-slash"></i>
        <h4>لا توجد إشعارات</h4>
        <p>ستظهر هنا الإشعارات عند إضافة ملفات أو فيديوهات جديدة</p>
      </div>`;
    return;
  }

  const iconsByType = {
    file: { i: 'fa-file-pdf', c: '#ef4444' },
    video: { i: 'fa-video', c: '#dc2626' },
    product: { i: 'fa-shopping-bag', c: '#22c55e' },
    gift: { i: 'fa-gift', c: '#f7b32b' },
    general: { i: 'fa-bell', c: '#5b6cff' },
    announcement: { i: 'fa-bullhorn', c: '#8b5cf6' }
  };
  const lastSeen = getNotifLastSeen();

  box.innerHTML = pushBanner + NOTIF.items.map(n => {
    const def = iconsByType[n.type] || iconsByType.general;
    const icon = n.icon || def.i;
    const color = n.color || def.c;
    const date = new Date(n.created_at);
    const isPersonal = !!n.target_user_id;
    const unread = Date.parse(n.created_at || 0) > lastSeen;
    const clickable = n.type === 'file' || n.type === 'video' || n.type === 'gift';

    return `
      <div class="notif-item ${isPersonal ? 'personal' : ''} ${unread ? 'unread' : ''} ${clickable ? 'clickable' : ''}"
           ${clickable ? `onclick="openNotification('${escapeHtml(n.id)}')"` : ''}>
        <div class="notif-icon" style="background:color-mix(in srgb,${color} 15%,transparent);color:${color}">
          <i class="fas ${icon}"></i>
          ${isPersonal ? '<span class="notif-personal-dot"></span>' : ''}
        </div>
        <div class="notif-body">
          <b>${escapeHtml(n.title)}</b>
          ${n.body ? `<p>${escapeHtml(n.body)}</p>` : ''}
          <small><i class="far fa-clock"></i> ${getTimeAgo(date)}${clickable ? ' • <span class="notif-open-hint">اضغط للفتح</span>' : ''}</small>
        </div>
      </div>
    `;
  }).join('');
}

/* الضغط على إشعار → يفتح الملف/الفيديو/الهدايا */
function openNotification(id){
  const n = NOTIF.items.find(x => x.id === id);
  if(!n) return;
  closeNotifications();
  try{
    if(n.type === 'file' && n.target_id){
      if(typeof go === 'function') go('files');
      setTimeout(() => { if(typeof openFile === 'function') openFile(n.target_id); }, 250);
    } else if(n.type === 'video' && n.target_id){
      if(typeof go === 'function') go('videos');
      setTimeout(() => { if(typeof openVideo === 'function') openVideo(n.target_id); }, 250);
    } else if(n.type === 'gift'){
      if(typeof go === 'function') go('gifts');
    }
  }catch(e){}
}
window.openNotification = openNotification;

function getTimeAgo(date){
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if(diff < 60) return 'الآن';
  if(diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if(diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  if(diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return date.toLocaleDateString('ar-SA');
}

function markNotificationsRead(){
  if(!currentUserObj) return;
  setNotifLastSeen(Date.now());
  NOTIF.unreadCount = 0;
  updateNotifBadge();
  renderNotificationsPanel();
}
window.markNotificationsRead = markNotificationsRead;

/* ================== إرسال إشعار ==================
   sendNotification(type, title, body, targetId, targetCourseId, icon, color, targetUserId)
   - targetUserId: لو محدد → الإشعار يصل لهذا المستخدم فقط
================================================== */
async function sendNotification(type, title, body, targetId, targetCourseId, icon, color, targetUserId){
  try{
    const r = await sbSafeWrite(p => sb.from('notifications').insert(p), {
      type: type || 'general',
      title,
      body: body || '',
      target_id: targetId || null,
      target_course_id: targetCourseId || null,
      target_user_id: targetUserId || null,
      icon: icon || 'fa-bell',
      color: color || '#5b6cff',
      created_by: currentUserObj ? currentUserObj.id : null
    });
    if(r && r.error) console.warn('notification send failed:', r.error.message);
    return r;
  }catch(e){ console.warn(e); }
}
window.sendNotification = sendNotification;

/* ================== Realtime ================== */
function subscribeNotifications(){
  if(NOTIF.channel){ try{ sb.removeChannel(NOTIF.channel); }catch(e){} NOTIF.channel = null; }
  if(!currentUserObj) return;

  NOTIF.channel = sb.channel('notifications-' + currentUserObj.id + '-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
      const n = payload.new;
      if(!n || n.type === 'file' || n.type === 'video') return; /* تُبنى من الملفات مباشرة */
      if(!canSeeNotif(n)) return;
      if(NOTIF.dbItems.some(x => x.id === n.id)) return;
      NOTIF.dbItems.unshift(n);
      rebuildNotifications();
    })
    .subscribe();
}
window.subscribeNotifications = subscribeNotifications;

/* ================== فحص دوري احتياطي ==================
   لو Realtime غير مفعّل لجدول files/videos، هذا يضمن وصول الإشعار
   خلال دقيقة. استعلام خفيف جداً (صف واحد + العدد).
========================================================= */
async function pollContentChanges(){
  if(!currentUserObj || !notifCanReceiveContent()) return;
  try{
    const [fr, vr] = await Promise.all([
      sb.from('files').select('id,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(1),
      sb.from('videos').select('id,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(1)
    ]);
    if(!fr.error){
      const newest = (fr.data && fr.data[0]) ? fr.data[0].id : null;
      const localNewest = (DB.files || []).slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0];
      if((typeof fr.count === 'number' && fr.count !== (DB.files || []).length) || (newest && (!localNewest || localNewest.id !== newest))){
        if(typeof window.loadProfilesAndFiles === 'function') await window.loadProfilesAndFiles();
      }
    }
    if(!vr.error){
      const newest = (vr.data && vr.data[0]) ? vr.data[0].id : null;
      const localNewest = (DB.videos || []).slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))[0];
      if((typeof vr.count === 'number' && vr.count !== (DB.videos || []).length) || (newest && (!localNewest || localNewest.id !== newest))){
        if(typeof window.loadVideos === 'function') await window.loadVideos();
      }
    }
  }catch(e){}
  NOTIF.pollTick++;
  if(NOTIF.pollTick % 2 === 0) loadNotifications();
}

function startNotifPolling(){
  stopNotifPolling();
  NOTIF.pollTimer = setInterval(() => {
    if(document.hidden && !('Notification' in window && Notification.permission === 'granted')) return;
    pollContentChanges();
  }, 60000);
}
function stopNotifPolling(){
  if(NOTIF.pollTimer){ clearInterval(NOTIF.pollTimer); NOTIF.pollTimer = null; }
}
window.startNotifPolling = startNotifPolling;
window.stopNotifPolling = stopNotifPolling;

/* لما يرجع الطالب للتبويب → افحص فوراً */
document.addEventListener('visibilitychange', () => {
  if(!document.hidden && currentUserObj && NOTIF.pollTimer) pollContentChanges();
});

/* تصفير عند تسجيل الخروج */
function resetNotifications(){
  stopNotifPolling();
  if(NOTIF.channel){ try{ sb.removeChannel(NOTIF.channel); }catch(e){} NOTIF.channel = null; }
  NOTIF.items = []; NOTIF.dbItems = []; NOTIF.unreadCount = 0;
  NOTIF.knownIds = new Set(); NOTIF.primed = false; NOTIF.pollTick = 0;
  updateNotifBadge();
}
window.resetNotifications = resetNotifications;

document.addEventListener('DOMContentLoaded', () => {
  const notifBtn = document.getElementById('notifBtn');
  if(notifBtn && !notifBtn.dataset.bound){
    notifBtn.dataset.bound = '1';
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotifications();
    });
  }

  document.addEventListener('click', (e) => {
    if(!NOTIF.open) return;
    const panel = document.getElementById('notificationsPanel');
    const btn = document.getElementById('notifBtn');
    if(panel && !panel.contains(e.target) && btn && !btn.contains(e.target)){
      closeNotifications();
    }
  });

  const markBtn = document.getElementById('notifMarkRead');
  if(markBtn && !markBtn.dataset.bound){
    markBtn.dataset.bound = '1';
    markBtn.addEventListener('click', markNotificationsRead);
  }
});
