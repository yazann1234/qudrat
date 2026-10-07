/* ============================================================
   30) OWNER FEATURES — اشتراكات + صندوق الطالب + اللوقز
============================================================ */

/* ================== دوال مساعدة ================== */
function isOwnerUser(){
  return currentUserObj && currentUserObj.role === 'owner';
}
window.isOwnerUser = isOwnerUser;

/* هل الاشتراك منتهي؟ */
function isSubscriptionExpired(){
  if(!currentUserObj) return false;
  if(currentUserObj.role === 'owner' || currentUserObj.role === 'admin') return false;
  if(currentUserObj.status !== 'approved') return false;
  if(!currentUserObj.subscription_end) return false;
  return new Date(currentUserObj.subscription_end) < new Date();
}

/* كم يوم باقي في الاشتراك؟ */
function getSubscriptionDaysLeft(){
  if(!currentUserObj || !currentUserObj.subscription_end) return null;
  const end = new Date(currentUserObj.subscription_end);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
}
window.getSubscriptionDaysLeft = getSubscriptionDaysLeft;

/* ================== التحقق من الاشتراك عند الدخول ================== */
async function checkSubscriptionOnLogin(){
  if(!currentUserObj) return;
  if(currentUserObj.role === 'owner' || currentUserObj.role === 'admin') return;
  if(currentUserObj.status !== 'approved') return;

  if(isSubscriptionExpired()){
    /* اشتراك منتهي → أرجعه لمعلق */
    try{
      await sb.from('profiles').update({
        status: 'pending',
        subscription_end: null,
        subscription_start: null,
        subscription_months: 0
      }).eq('id', currentUserObj.id);

      currentUserObj.status = 'pending';
      currentUserObj.subscription_end = null;
      currentUserObj.subscription_start = null;

      toast('⏰ انتهى اشتراكك — يرجى التجديد', 'warn');
      return true; /* تم إرجاعه لمعلق */
    }catch(e){
      console.warn('subscription check failed', e);
    }
  }
  return false;
}
window.checkSubscriptionOnLogin = checkSubscriptionOnLogin;

/* ================== تفعيل الاشتراك ================== */
async function activateSubscription(userId, months){
  if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }

  months = parseInt(months, 10);
  if(!months || months < 1 || months > 12){
    toast('المدة يجب أن تكون بين شهر و 12 شهر', 'warn');
    return;
  }

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + months);

  const { error } = await sb.from('profiles').update({
    status: 'approved',
    subscription_start: start.toISOString(),
    subscription_end: end.toISOString(),
    subscription_months: months
  }).eq('id', userId);

  if(error){ toast('فشل التفعيل: ' + error.message, 'err'); return; }

  /* سجّل العملية */
  await logAdminAction('activate_subscription', userId, `تفعيل اشتراك لمدة ${months} شهر`, {
    months,
    subscription_end: end.toISOString()
  });

  toast(`✓ تم التفعيل لمدة ${months} شهر`, 'ok');
}
window.activateSubscription = activateSubscription;

/* ============================================================
   اللوقز (Logs) — للرئيس فقط
============================================================ */
async function logAdminAction(action, targetId, label, details){
  if(!currentUserObj) return;
  if(currentUserObj.role !== 'admin' && currentUserObj.role !== 'owner') return;

  try{
    let targetName = null;
    if(targetId){
      const { data: t } = await sb.from('profiles').select('name').eq('id', targetId).maybeSingle();
      targetName = t ? t.name : null;
    }

    await sb.from('admin_logs').insert({
      admin_id: currentUserObj.id,
      admin_name: currentUserObj.name || 'أدمن',
      admin_role: currentUserObj.role,
      action: action,
      action_label: label || action,
      target_id: targetId || null,
      target_name: targetName,
      details: details || {}
    });
  }catch(e){ console.warn('log failed', e); }
}
window.logAdminAction = logAdminAction;

/* عرض اللوقز (لوحة الرئيس) */
async function renderAdminLogs(){
  if(!isOwnerUser()) return;

  const box = document.getElementById('ownerLogsList');
  if(!box) return;

  box.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary)"></i></div>';

  try{
    const { data, error } = await sb.from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if(error) throw error;

    if(!data || !data.length){
      box.innerHTML = '<div class="admin-empty"><div class="em-ic"><i class="fas fa-scroll"></i></div><h3>لا توجد سجلات بعد</h3><p>ستظهر هنا كل عمليات الأدمن</p></div>';
      return;
    }

    const actionIcons = {
      activate_subscription: 'fa-crown',
      approve_user: 'fa-user-check',
      reject_user: 'fa-user-xmark',
      edit_user: 'fa-user-pen',
      delete_user: 'fa-user-minus',
      create_user: 'fa-user-plus',
      upload_file: 'fa-file-arrow-up',
      delete_file: 'fa-file-circle-xmark',
      add_video: 'fa-video',
      delete_video: 'fa-video-slash',
      add_product: 'fa-cart-plus',
      update_settings: 'fa-gear',
      send_gift: 'fa-gift'
    };

    box.innerHTML = data.map(log => {
      const icon = actionIcons[log.action] || 'fa-circle-info';
      const color = log.admin_role === 'owner' ? '#f7b32b' : '#ef4444';
      const date = new Date(log.created_at);
      const dateStr = date.toLocaleDateString('ar-SA');
      const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="log-row">
          <div class="log-icon" style="background:color-mix(in srgb,${color} 15%,transparent);color:${color}">
            <i class="fas ${icon}"></i>
          </div>
          <div class="log-content">
            <div class="log-top">
              <b>${escapeHtml(log.admin_name || 'أدمن')}</b>
              <span class="log-role-badge" style="background:${color}">${log.admin_role === 'owner' ? '👑 رئيس' : '🛡️ أدمن'}</span>
            </div>
            <div class="log-action">${escapeHtml(log.action_label || log.action)}</div>
            ${log.target_name ? `<div class="log-target"><i class="fas fa-user"></i> ${escapeHtml(log.target_name)}</div>` : ''}
            <div class="log-time"><i class="fas fa-clock"></i> ${dateStr} — ${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }catch(e){
    box.innerHTML = `<div class="admin-empty"><h3>فشل تحميل السجلات</h3><p>${escapeHtml(e.message)}</p></div>`;
  }
}
window.renderAdminLogs = renderAdminLogs;

/* ============================================================
   صندوق الطالب (الهدايا) — للرئيس فقط
============================================================ */

/* عرض هداياي (للمستخدم) */
async function renderMyGifts(){
  if(!currentUserObj) return;

  const box = document.getElementById('myGiftsBox');
  if(!box) return;

  try{
    const { data, error } = await sb.from('student_gifts')
      .select('*')
      .eq('user_id', currentUserObj.id)
      .order('created_at', { ascending: false });

    if(error) throw error;

    const unopened = (data || []).filter(g => !g.opened);

    /* إظهار شارة على الأيقونة */
    updateGiftBadge(unopened.length);

    if(!data || !data.length){
      box.innerHTML = `
        <div class="gifts-empty">
          <i class="fas fa-gift"></i>
          <h3>لا توجد هدايا حالياً</h3>
          <p>ستظهر هداياك هنا عندما يحصل عليها من رئيس المنصة</p>
        </div>`;
      return;
    }

    box.innerHTML = data.map(g => {
      const date = new Date(g.created_at).toLocaleDateString('ar-SA');
      return `
        <div class="gift-card ${g.opened ? 'opened' : 'unopened'}" onclick="openGiftBox('${g.id}')">
          <div class="gift-box-icon">
            <i class="fas ${g.opened ? 'fa-box-open' : 'fa-gift'}"></i>
          </div>
          <div class="gift-info">
            <b>${escapeHtml(g.title)}</b>
            <small>${date}</small>
          </div>
          ${!g.opened ? '<div class="gift-new-badge">جديد!</div>' : ''}
        </div>
      `;
    }).join('');
  }catch(e){
    console.warn('gifts load failed', e);
  }
}
window.renderMyGifts = renderMyGifts;

/* فتح الهدية */
async function openGiftBox(giftId){
  try{
    const { data: g, error } = await sb.from('student_gifts').select('*').eq('id', giftId).maybeSingle();
    if(error || !g) return;

    /* علّمها كمفتوحة */
    if(!g.opened){
      await sb.from('student_gifts').update({
        opened: true,
        opened_at: new Date().toISOString()
      }).eq('id', giftId);
    }

    /* أظهر مودال الاحتفال */
    showGiftCelebration(g);
    renderMyGifts();
  }catch(e){ console.warn('openGift failed', e); }
}
window.openGiftBox = openGiftBox;

/* مودال الاحتفال */
function showGiftCelebration(g){
  const modal = document.getElementById('giftCelebrationModal');
  if(!modal) return;

  /* املأ البيانات */
  const titleEl = document.getElementById('giftCelebTitle');
  if(titleEl) titleEl.textContent = g.title || 'هدية لك! 🎁';

  const msgEl = document.getElementById('giftCelebMessage');
  if(msgEl) msgEl.textContent = g.message || '';

  const imgEl = document.getElementById('giftCelebImage');
  if(imgEl){
    if(g.image_url){
      imgEl.src = g.image_url;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
  }

  const senderEl = document.getElementById('giftCelebSender');
  if(senderEl) senderEl.textContent = 'من: ' + (g.sender_name || 'رئيس المنصة');

  /* أظهر المودال */
  modal.classList.add('open');

  /* ابدأ الاحتفال */
  startGiftConfetti();
}

/* كونفيتي الاحتفال */
function startGiftConfetti(){
  const container = document.getElementById('giftConfetti');
  if(!container) return;
  container.innerHTML = '';

  const colors = ['#f7b32b', '#5b6cff', '#8b5cf6', '#22c55e', '#ef4444', '#ec4899', '#0ea5e9'];
  const shapes = ['🎉', '🎊', '✨', '⭐', '🎁', '🌟'];

  for(let i = 0; i < 60; i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';

    if(Math.random() > 0.5){
      piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      piece.style.fontSize = (14 + Math.random() * 20) + 'px';
    } else {
      piece.style.width = (6 + Math.random() * 10) + 'px';
      piece.style.height = (6 + Math.random() * 14) + 'px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    }

    piece.style.left = Math.random() * 100 + '%';
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    container.appendChild(piece);
  }

  /* أوقف الكونفيتي بعد 5 ثوان */
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

/* إغلاق المودال */
function closeGiftCelebration(){
  const modal = document.getElementById('giftCelebrationModal');
  if(modal) modal.classList.remove('open');
  const c = document.getElementById('giftConfetti');
  if(c) c.innerHTML = '';
}
window.closeGiftCelebration = closeGiftCelebration;

/* شارة الهدايا على الأيقونة */
function updateGiftBadge(count){
  const badge = document.getElementById('giftBadgeNav');
  if(!badge) return;
  if(count > 0){
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================================
   إرسال هدية (للرئيس فقط)
============================================================ */
async function sendStudentGift(){
  if(!isOwnerUser()){ toast('هذه الميزة لرئيس المنصة فقط', 'err'); return; }

  const userId = document.getElementById('giftUserId').value;
  const title = document.getElementById('giftTitle').value.trim();
  const message = document.getElementById('giftMessage').value.trim();
  const giftType = document.getElementById('giftType').value;
  const imgInput = document.getElementById('giftImageInput');
  const imgFile = imgInput && imgInput.files[0];

  if(!userId){ toast('اختر المستخدم', 'warn'); return; }
  if(!title){ toast('أدخل عنوان الهدية', 'warn'); return; }
  if(!message){ toast('أدخل رسالة الهدية', 'warn'); return; }

  const btn = document.getElementById('sendGiftBtn');
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

  let imageUrl = null;

  /* ارفع الصورة إن وُجدت */
  if(imgFile){
    try{
      const blob = await resizeImageToBlob(imgFile, 800, 0.85);
      const path = '_gifts/' + userId + '/' + Date.now() + '.jpg';

      const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
        cacheControl: '3600', upsert: true, contentType: 'image/jpeg'
      });

      if(upErr) throw upErr;

      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
      imageUrl = urlData ? urlData.publicUrl : null;
    }catch(e){
      console.warn('image upload failed', e);
    }
  }

  /* احفظ الهدية */
  const { error } = await sb.from('student_gifts').insert({
    user_id: userId,
    sender_id: currentUserObj.id,
    sender_name: currentUserObj.name || 'رئيس المنصة',
    title,
    message,
    image_url: imageUrl,
    gift_type: giftType
  });

  btn.disabled = false;
  btn.innerHTML = orig;

  if(error){
    toast('فشل الإرسال: ' + error.message, 'err');
    return;
  }

  /* سجّل العملية */
  await logAdminAction('send_gift', userId, 'إرسال هدية للطالب: ' + title, { gift_type: giftType });

  toast('🎁 تم إرسال الهدية بنجاح', 'ok');

  /* نظّف الحقول */
  document.getElementById('giftUserId').value = '';
  document.getElementById('giftTitle').value = '';
  document.getElementById('giftMessage').value = '';
  if(imgInput) imgInput.value = '';
  const prev = document.getElementById('giftImagePreview');
  if(prev) prev.innerHTML = '';
}
window.sendStudentGift = sendStudentGift;

/* معاينة الصورة */
function previewGiftImage(input){
  const prev = document.getElementById('giftImagePreview');
  if(!prev) return;

  const f = input.files[0];
  if(!f){ prev.innerHTML = ''; return; }

  const reader = new FileReader();
  reader.onload = e => {
    prev.innerHTML = `
      <div style="position:relative;display:inline-block">
        <img src="${e.target.result}" style="max-width:200px;max-height:150px;border-radius:10px;border:1px solid var(--border)">
        <button type="button" onclick="clearGiftImage()" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer;display:grid;place-items:center">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  };
  reader.readAsDataURL(f);
}
window.previewGiftImage = previewGiftImage;

function clearGiftImage(){
  const inp = document.getElementById('giftImageInput');
  if(inp) inp.value = '';
  const prev = document.getElementById('giftImagePreview');
  if(prev) prev.innerHTML = '';
}
window.clearGiftImage = clearGiftImage;

/* قائمة المستخدمين للاختيار */
async function loadGiftUsersList(){
  const sel = document.getElementById('giftUserId');
  if(!sel) return;

  try{
    const { data } = await sb.from('profiles')
      .select('id, name, email')
      .neq('role', 'owner')
      .order('name', { ascending: true });

    if(!data || !data.length){ sel.innerHTML = '<option value="">لا يوجد مستخدمون</option>'; return; }

    sel.innerHTML = '<option value="">— اختر مستخدماً —</option>' +
      data.map(u => `<option value="${u.id}">${escapeHtml(u.name || u.email)}</option>`).join('');
  }catch(e){ console.warn(e); }
}
window.loadGiftUsersList = loadGiftUsersList;

/* ============================================================
   التهيئة عند الدخول
============================================================ */
async function initOwnerFeatures(){
  if(!currentUserObj) return;

  /* التحقق من الاشتراك */
  const wasExpired = await checkSubscriptionOnLogin();
  if(wasExpired) return;

  /* احدث الهدايا */
  try{ await renderMyGifts(); }catch(e){}

  /* شارة الهدايا */
  subscribeGifts();

  /* عرض الهدايا في البروفايل */
  renderGiftsSection();
}

window.initOwnerFeatures = initOwnerFeatures;

/* اشتراك في الهدايا */
function subscribeGifts(){
  if(!currentUserObj) return;
  try{
    if(window._giftsChannel){ sb.removeChannel(window._giftsChannel); }
    window._giftsChannel = sb.channel('gifts-' + currentUserObj.id + '-' + Date.now())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'student_gifts',
        filter: 'user_id=eq.' + currentUserObj.id
      }, () => {
        renderMyGifts();
        toast('🎁 وصلك هدية جديدة من الرئيس!', 'ok');
      })
      .subscribe();
  }catch(e){}
}

/* عرض قسم الهدايا في البروفايل */
function renderGiftsSection(){
  const box = document.getElementById('myGiftsBox');
  if(box) renderMyGifts();
}

/* ============================================================
   عرض معلومات الاشتراك
============================================================ */
function renderSubscriptionInfo(){
  const box = document.getElementById('subscriptionInfoBox');
  if(!box) return;

  if(!currentUserObj) return;
  if(currentUserObj.role === 'owner' || currentUserObj.role === 'admin'){
    box.innerHTML = `
      <div class="sub-info-card owner">
        <i class="fas fa-crown"></i>
        <div>
          <b>رئيس المنصة / أدمن</b>
          <small>صلاحيات كاملة بدون اشتراك</small>
        </div>
      </div>`;
    return;
  }

  if(currentUserObj.status !== 'approved'){
    box.innerHTML = '';
    return;
  }

  const days = getSubscriptionDaysLeft();
  if(days === null){
    box.innerHTML = `
      <div class="sub-info-card">
        <i class="fas fa-infinity"></i>
        <div>
          <b>اشتراك دائم</b>
          <small>لا يوجد تاريخ انتهاء</small>
        </div>
      </div>`;
    return;
  }

  const isExpired = days <= 0;
  const isWarning = days > 0 && days <= 7;
  const cls = isExpired ? 'expired' : (isWarning ? 'warning' : 'active');
  const icon = isExpired ? 'fa-circle-xmark' : (isWarning ? 'fa-triangle-exclamation' : 'fa-circle-check');
  const label = isExpired ? 'انتهى اشتراكك' : `باقي ${days} يوم على انتهاء اشتراكك`;

  box.innerHTML = `
    <div class="sub-info-card ${cls}">
      <i class="fas ${icon}"></i>
      <div>
        <b>${label}</b>
        <small>${currentUserObj.subscription_end ? 'ينتهي في: ' + new Date(currentUserObj.subscription_end).toLocaleDateString('ar-SA') : ''}</small>
      </div>
    </div>`;
}
window.renderSubscriptionInfo = renderSubscriptionInfo;

/* ================== تشغيل ================== */
document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('sendGiftBtn');
  if(sendBtn && !sendBtn.dataset.bound){
    sendBtn.dataset.bound = '1';
    sendBtn.addEventListener('click', sendStudentGift);
  }
});
