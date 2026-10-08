/* ============================================================
   32) NOTIFICATIONS — إشعارات (عامة + موجهة لمستخدم)
============================================================ */

const NOTIF = {
  items: [],
  unreadCount: 0,
  open: false,
  channel: null
};

async function loadNotifications(){
  if(!currentUserObj){ NOTIF.items = []; return; }

  try{
    /* ⭐ اجلب الإشعارات العامة + الخاصة بالمستخدم */
    const { data, error } = await sb.from('notifications')
      .select('*')
      .or(`target_user_id.is.null,target_user_id.eq.${currentUserObj.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if(error) throw error;
    NOTIF.items = data || [];

    let lastSeen = '0';
    try{ lastSeen = localStorage.getItem('abdq_notif_last_seen_' + currentUserObj.id) || '0'; }catch(e){}
    const lastSeenDate = lastSeen === '0' ? new Date(0) : new Date(parseInt(lastSeen, 10));

    NOTIF.unreadCount = NOTIF.items.filter(n => new Date(n.created_at) > lastSeenDate).length;

    updateNotifBadge();
    if(NOTIF.open) renderNotificationsPanel();
  }catch(e){
    console.warn('notifications load failed', e);
    NOTIF.items = [];
  }
}
window.loadNotifications = loadNotifications;

function updateNotifBadge(){
  const badge = document.getElementById('notifBadge');
  if(!badge) return;
  if(NOTIF.unreadCount > 0){
    badge.textContent = NOTIF.unreadCount > 9 ? '9+' : NOTIF.unreadCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleNotifications(){
  const panel = document.getElementById('notificationsPanel');
  if(!panel) return;
  NOTIF.open = !NOTIF.open;
  panel.classList.toggle('open', NOTIF.open);
  if(NOTIF.open) renderNotificationsPanel();
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

  if(!NOTIF.items.length){
    box.innerHTML = `
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

  box.innerHTML = NOTIF.items.map(n => {
    const def = iconsByType[n.type] || iconsByType.general;
    const icon = n.icon || def.i;
    const color = n.color || def.c;
    const date = new Date(n.created_at);
    const timeAgo = getTimeAgo(date);
    const isPersonal = !!n.target_user_id;

    return `
      <div class="notif-item ${isPersonal ? 'personal' : ''}">
        <div class="notif-icon" style="background:color-mix(in srgb,${color} 15%,transparent);color:${color}">
          <i class="fas ${icon}"></i>
          ${isPersonal ? '<span class="notif-personal-dot"></span>' : ''}
        </div>
        <div class="notif-body">
          <b>${escapeHtml(n.title)}</b>
          ${n.body ? `<p>${escapeHtml(n.body)}</p>` : ''}
          <small><i class="far fa-clock"></i> ${timeAgo}</small>
        </div>
      </div>
    `;
  }).join('');
}

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
  try{ localStorage.setItem('abdq_notif_last_seen_' + currentUserObj.id, Date.now().toString()); }catch(e){}
  NOTIF.unreadCount = 0;
  updateNotifBadge();
  renderNotificationsPanel();
}
window.markNotificationsRead = markNotificationsRead;

/* ⭐ إرسال إشعار — عام أو موجه لمستخدم */
async function sendNotification(type, title, body, targetId, targetCourseId, icon, color, targetUserId){
  try{
    const { error } = await sb.from('notifications').insert({
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
    if(error) console.warn('notification send failed', error);
  }catch(e){ console.warn(e); }
}
window.sendNotification = sendNotification;

function subscribeNotifications(){
  if(NOTIF.channel){ try{ sb.removeChannel(NOTIF.channel); }catch(e){} }
  if(!currentUserObj) return;

  NOTIF.channel = sb.channel('notifications-' + currentUserObj.id + '-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
      const n = payload.new;
      if(!n) return;
      /* ⭐ اقبل فقط: عام أو موجّه لي */
      if(n.target_user_id && n.target_user_id !== currentUserObj.id) return;

      NOTIF.items.unshift(n);
      NOTIF.unreadCount++;
      updateNotifBadge();
      if(NOTIF.open) renderNotificationsPanel();
      toast('🔔 ' + n.title, 'ok');
    })
    .subscribe();
}

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
