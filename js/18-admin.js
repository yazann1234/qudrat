/* ============================================================
   18) ADMIN — لوحة الأدمن الكاملة
============================================================ */

function renderAdmin(){
  if(!isPrivileged()) return;

  const nonAdmins = (DB.users || []).filter(u => u.role !== 'admin' && u.role !== 'owner');
  const setTxt = (id,v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setTxt('adUsers', nonAdmins.length);
  setTxt('adPending', nonAdmins.filter(u => u.status === 'pending').length);
  setTxt('adSubscribed', nonAdmins.filter(u => u.status === 'approved').length);
  setTxt('adFiles', (DB.files || []).length);
  setTxt('adImportant', (DB.files || []).filter(f => f.important).length);
  setTxt('adVideos', (DB.videos || []).length);
  setTxt('adProducts', (DB.products || []).filter(p => p.active).length);
  setTxt('adPurchases', nonAdmins.filter(u => u.purchase_submitted).length);

  /* ⭐ إظهار/إخفاء تبويبات الرئيس */
  const ownerTabs = document.querySelectorAll('.owner-only-tab');
  ownerTabs.forEach(t => {
    t.style.display = (currentUserObj && currentUserObj.role === 'owner') ? '' : 'none';
  });

  renderUsersTable();
  renderAdminFiles();
  if(typeof renderAdminVideos === 'function') renderAdminVideos();
  if(typeof renderAdminProducts === 'function') renderAdminProducts();
  if(typeof renderStoreSettings === 'function') renderStoreSettings();
  if(typeof renderAdminQuizQuestions === 'function') renderAdminQuizQuestions();

  /* ⭐ تحميل بيانات الرئيس */
  if(currentUserObj && currentUserObj.role === 'owner'){
    try{ if(typeof loadGiftUsersList === 'function') loadGiftUsersList(); }catch(e){}
    try{ if(typeof renderAdminLogs === 'function') renderAdminLogs(); }catch(e){}
  }
}
window.renderAdmin = renderAdmin;

/* ============================================================
   جدول المستخدمين
============================================================ */
function renderUsersTable(){
  const box = document.getElementById('usersTable');
  if(!box) return;

  const q = (document.getElementById('userSearch') ? document.getElementById('userSearch').value : '').trim().toLowerCase();
  const filter = document.getElementById('userFilter') ? document.getElementById('userFilter').value : 'all';
  const isOwnerUser = typeof isOwner === 'function' && isOwner();

  let list = DB.users || [];
  if(q) list = list.filter(u => (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));

  if(filter === 'pending') list = list.filter(u => u.status === 'pending' && u.role !== 'owner' && u.role !== 'admin');
  else if(filter === 'sub') list = list.filter(u => u.status === 'approved');
  else if(filter === 'off') list = list.filter(u => u.status !== 'approved');
  else if(filter === 'admins') list = list.filter(u => u.role === 'admin' || u.role === 'owner');

  list.sort((a,b) => {
    const rank = u => {
      if(u.role === 'owner') return 0;
      if(u.role === 'admin') return 1;
      if(u.status === 'pending') return 2;
      return 3;
    };
    const ra = rank(a), rb = rank(b);
    if(ra !== rb) return ra - rb;
    return new Date(b.created_at||0) - new Date(a.created_at||0);
  });

  if(!list.length){
    box.innerHTML = '<div class="admin-empty"><div class="em-ic"><i class="fas fa-users"></i></div><h3>لا يوجد مستخدمون مطابقون</h3><p>جرّب تغيير البحث أو التصفية</p></div>';
    return;
  }

  box.innerHTML = `
    <div class="thead">
      <div>المستخدم</div><div>البريد الإلكتروني</div><div>كلمة السر</div><div>الحالة</div><div style="text-align:left">إجراءات</div>
    </div>
    ${list.map(u => {
      let statusBadge;
      if(u.role === 'owner') statusBadge = '<span class="role-badge owner"><i class="fas fa-crown"></i> رئيس المنصة</span>';
      else if(u.role === 'admin') statusBadge = '<span class="role-badge admin"><i class="fas fa-shield-halved"></i> أدمن</span>';
      else if(u.status === 'approved'){
        const daysLeft = u.subscription_end ? Math.ceil((new Date(u.subscription_end) - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const subLabel = daysLeft !== null ? ` (${daysLeft > 0 ? daysLeft + ' يوم' : 'منتهي'})` : '';
        statusBadge = `<span class="status-badge on"><i class="fas fa-circle-check"></i> مشترك${subLabel}</span>`;
      }
      else if(u.status === 'pending') statusBadge = '<span class="status-badge pending"><i class="fas fa-clock"></i> معلّق</span>';
      else statusBadge = '<span class="status-badge off"><i class="fas fa-ban"></i> مرفوض</span>';

      const avStyle = u.avatar_url ? `background-image:url('${u.avatar_url}')` : '';
      const pwHtml = u.password_hint
        ? `<code onclick="copyTxt('${escapeHtml(u.password_hint).replace(/'/g,'&#39;')}')" title="اضغط للنسخ" style="background:var(--bg);padding:3px 8px;border-radius:6px;font-size:.74rem;direction:ltr;display:inline-block;cursor:pointer;border:1px solid var(--border)">${escapeHtml(u.password_hint)}</code>`
        : '<span style="font-size:.72rem;color:var(--muted)">—</span>';

      const isTargetOwner = u.role === 'owner';
      const isTargetAdmin = u.role === 'admin';

      let actions = '';

      if(!isTargetOwner){
        if(u.status !== 'approved' && u.role !== 'admin'){
          actions += `<button class="btn btn-success btn-sm" onclick="openApproveModal('${u.id}')" title="تفعيل"><i class="fas fa-check"></i></button>`;
        }
        if(u.status !== 'rejected' && u.role !== 'admin'){
          actions += `<button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')" title="رفض"><i class="fas fa-ban"></i></button>`;
        }

        if(isOwnerUser || !isTargetAdmin){
          actions += `<button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')" title="تعديل"><i class="fas fa-pen"></i></button>`;
          actions += `<button class="btn btn-ghost btn-sm" onclick="resetUserPassword('${u.id}')" title="إعادة تعيين كلمة المرور"><i class="fas fa-key"></i></button>`;
        }

        if(u.purchase_receipt_url){
          actions += `<button class="btn btn-ghost btn-sm" onclick="viewReceipt('${escapeHtml(u.purchase_receipt_url)}')" title="عرض الإيصال" style="background:rgba(247,179,43,.15);color:#b45309;border-color:rgba(247,179,43,.3)"><i class="fas fa-receipt"></i></button>`;
        }

        if(isOwnerUser){
          if(u.role === 'admin'){
            actions += `<button class="btn btn-ghost btn-sm" onclick="demoteAdmin('${u.id}')" title="إزالة صلاحية الأدمن" style="background:rgba(247,179,43,.15);color:#d97706;border-color:rgba(247,179,43,.3)"><i class="fas fa-arrow-down"></i></button>`;
          } else {
            actions += `<button class="btn btn-ghost btn-sm" onclick="promoteToAdmin('${u.id}')" title="ترقية إلى أدمن" style="background:rgba(239,68,68,.12);color:#dc2626;border-color:rgba(239,68,68,.28)"><i class="fas fa-user-shield"></i></button>`;
          }
          actions += `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')" title="حذف نهائي"><i class="fas fa-trash"></i></button>`;
        }
      }

      return `<div class="trow">
        <div class="user-cell">
          <div class="av" style="${avStyle}">${avStyle ? '' : escapeHtml((u.name||'؟').trim().charAt(0) || '؟')}</div>
          <div class="info">
            <b>${escapeHtml(u.name || '—')}</b>
            <small>${u.created_at ? new Date(u.created_at).toLocaleDateString('ar-SA') : '—'}${u.phone ? ' • ' + escapeHtml(u.phone) : ''}</small>
          </div>
        </div>
        <div class="email-cell" style="direction:ltr;text-align:right">${escapeHtml(u.email)}</div>
        <div class="pw-cell">${pwHtml}</div>
        <div class="status-cell">${statusBadge}</div>
        <div class="actions-cell">${actions || '<span style="font-size:.72rem;color:var(--muted)">—</span>'}</div>
      </div>`;
    }).join('')}
  `;
}
window.renderUsersTable = renderUsersTable;

window.copyTxt = t => { try{ navigator.clipboard.writeText(t); toast('نُسخت', 'ok'); }catch(e){} };

/* ============================================================
   مودال التفعيل بالاشتراك
============================================================ */
window.openApproveModal = (userId) => {
  const u = DB.users.find(x => x.id === userId);
  if(!u) return;

  openModal({
    title: 'تفعيل اشتراك الطالب',
    text: `اختر مدة الاشتراك للمستخدم: ${escapeHtml(u.name || u.email)}`,
    bodyHTML: `
      <div class="form-group">
        <label>مدة الاشتراك</label>
        <select id="approveDuration" style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="1">شهر واحد (30 يوم)</option>
          <option value="2">شهرين (60 يوم)</option>
          <option value="3" selected>3 أشهر (90 يوم)</option>
          <option value="6">6 أشهر (180 يوم)</option>
          <option value="12">سنة كاملة (365 يوم)</option>
        </select>
      </div>
      <div style="padding:12px;background:var(--primary-soft);border-radius:10px;font-size:.76rem;color:var(--primary);font-weight:700;line-height:1.7">
        <i class="fas fa-info-circle"></i> عند انتهاء المدة، سيتم إرجاع الطالب لصفحة انتظار التفعيل تلقائياً.
      </div>
    `,
    okText: 'تفعيل الاشتراك',
    onOk: async () => {
      const months = parseInt(document.getElementById('approveDuration').value, 10);
      if(typeof activateSubscription === 'function'){
        await activateSubscription(userId, months);
      }
      try{
        const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        DB.users = data || [];
        renderUsersTable();
      }catch(e){}
    }
  });
};

window.approveUser = async id => {
  openApproveModal(id);
};

window.rejectUser = async id => {
  const { error } = await sb.from('profiles').update({ status:'rejected' }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  if(typeof logAdminAction === 'function'){
    await logAdminAction('reject_user', id, 'رفض طلب مستخدم');
  }
  toast('تم رفض المستخدم', 'warn');
};

window.promoteToAdmin = (id) => {
  if(!isOwner()){ toast('هذه الصلاحية لرئيس المنصة فقط', 'err'); return; }
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('ترقية إلى أدمن', `ترقية «${escapeHtml(u.name)}» إلى صلاحيات أدمن كاملة؟`, async () => {
    const { error } = await sb.from('profiles').update({ role: 'admin' }).eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    u.role = 'admin';
    if(typeof logAdminAction === 'function'){ await logAdminAction('promote_admin', id, 'ترقية إلى أدمن'); }
    renderUsersTable();
    toast('✓ تم الترقية', 'ok');
  });
};

window.demoteAdmin = (id) => {
  if(!isOwner()){ toast('هذه الصلاحية لرئيس المنصة فقط', 'err'); return; }
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('إزالة صلاحية الأدمن', `إزالة صلاحيات الأدمن من «${escapeHtml(u.name)}»؟`, async () => {
    const { error } = await sb.from('profiles').update({ role: 'user' }).eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    u.role = 'user';
    if(typeof logAdminAction === 'function'){ await logAdminAction('demote_admin', id, 'إزالة صلاحية الأدمن'); }
    renderUsersTable();
    toast('تمت الإزالة', 'warn');
  }, true);
};

window.editUser = id => {
  const u = DB.users.find(x => x.id === id); if(!u) return;
  const isOwnerUser = isOwner();
  const isTargetAdmin = u.role === 'admin';

  if(!isOwnerUser && isTargetAdmin){
    toast('لا تملك صلاحية تعديل الأدمنز', 'err');
    return;
  }

  openModal({
    title: 'تعديل المستخدم',
    text: isOwnerUser ? 'رئيس المنصة يمكنه تعديل كل شيء.' : 'عدّل البيانات الأساسية.',
    bodyHTML: `
      <div class="form-group" style="margin-bottom:12px">
        <label>الاسم</label>
        <input type="text" id="euName" value="${escapeHtml(u.name||'')}"
          style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label>البريد الإلكتروني</label>
        <input type="email" id="euEmail" value="${escapeHtml(u.email||'')}"
          style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label>رقم الجوال</label>
        <input type="tel" id="euPhone" value="${escapeHtml(u.phone||'')}" maxlength="10"
          style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label>كلمة المرور الجديدة ${u.password_hint ? `<span style="color:var(--muted);font-weight:600;font-size:.76rem">(الحالية: <code style="background:var(--bg);padding:2px 6px;border-radius:5px;direction:ltr;display:inline-block;cursor:pointer" onclick="copyTxt('${escapeHtml(u.password_hint).replace(/'/g,'&#39;')}')">${escapeHtml(u.password_hint)}</code>)</span>` : ''}</label>
        <div style="position:relative">
          <input type="password" id="euPw" value="" placeholder="اتركها فارغة لعدم التغيير"
            style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 44px 12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('euPw',this)"
            style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>

      ${isOwnerUser && !isTargetAdmin ? `
      <div class="form-group" style="margin-bottom:12px">
        <label>الدور</label>
        <select id="euRole"
          style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="user" ${u.role==='user'?'selected':''}>👤 مستخدم عادي</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>🛡️ أدمن</option>
        </select>
      </div>
      ` : ''}

      ${!isTargetAdmin ? `
      <div class="form-group" style="margin-bottom:12px">
        <label>حالة الحساب</label>
        <select id="euStatus"
          style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="approved" ${u.status==='approved'?'selected':''}>✅ مشترك</option>
          <option value="pending" ${u.status==='pending'?'selected':''}>⏳ معلّق</option>
          <option value="rejected" ${u.status==='rejected'?'selected':''}>❌ مرفوض</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label>مدة الاشتراك (لو الحالة مشترك) — عدد الأشهر</label>
        <input type="number" id="euMonths" min="1" max="12" value="${u.subscription_months || 1}"
          style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>
      ` : ''}

      <div id="euStatusBar" style="display:none;padding:10px 12px;border-radius:10px;font-size:.78rem;font-weight:700;text-align:center;margin-top:8px"></div>
    `,
    okText: 'حفظ',
    onOk: async () => {
      const newPw = document.getElementById('euPw').value.trim();
      const newPhone = document.getElementById('euPhone').value.trim().replace(/\D/g, '');
      const statusBar = document.getElementById('euStatusBar');
      const showBar = (kind, html) => {
        if(!statusBar) return;
        statusBar.style.display = 'block';
        if(kind === 'ok'){ statusBar.style.background = 'rgba(34,197,94,.14)'; statusBar.style.color = '#16a34a'; }
        else if(kind === 'warn'){ statusBar.style.background = 'rgba(247,179,43,.16)'; statusBar.style.color = '#d97706'; }
        else { statusBar.style.background = 'rgba(239,68,68,.14)'; statusBar.style.color = '#dc2626'; }
        statusBar.innerHTML = html;
      };

      const upd = {
        name: document.getElementById('euName').value.trim() || u.name,
        email: document.getElementById('euEmail').value.trim().toLowerCase() || u.email
      };

      if(newPhone && newPhone.length === 10) upd.phone = newPhone;

      const statusEl = document.getElementById('euStatus');
      if(statusEl) upd.status = statusEl.value;

      const roleEl = document.getElementById('euRole');
      if(roleEl) upd.role = roleEl.value;

      /* ⭐ لو الحالة تحولت لمشترك → حدّد مدة الاشتراك */
      if(statusEl && statusEl.value === 'approved' && u.status !== 'approved'){
        const months = parseInt(document.getElementById('euMonths').value, 10) || 1;
        const start = new Date();
        const end = new Date();
        end.setMonth(end.getMonth() + months);
        upd.subscription_start = start.toISOString();
        upd.subscription_end = end.toISOString();
        upd.subscription_months = months;
      }

      const { error } = await sb.from('profiles').update(upd).eq('id', id);
      if(error){ showBar('err', '<i class="fas fa-circle-xmark"></i> فشل: ' + error.message); return; }

      if(typeof logAdminAction === 'function'){ await logAdminAction('edit_user', id, 'تعديل بيانات المستخدم', upd); }

      if(newPw && newPw !== u.password_hint){
        if(newPw.length < 8){ showBar('err', '<i class="fas fa-circle-xmark"></i> كلمة المرور 8 أحرف على الأقل'); return; }
        showBar('warn', '<i class="fas fa-spinner fa-spin"></i> جاري تحديث كلمة المرور...');

        let success = false;
        try{
          const r = await sb.auth.getSession();
          const curSess = r.data.session;
          const res = await fetch(CHANGE_PASS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (curSess ? curSess.access_token : '') },
            body: JSON.stringify({ userId: id, newPassword: newPw })
          });
          if(res.ok){ const j = await res.json(); if(j && j.success) success = true; }
        }catch(e){}

        if(success){
          try{ await sb.from('profiles').update({ password_hint: newPw }).eq('id', id); }catch(e){}
          upd.password_hint = newPw;
          Object.assign(u, upd);
          renderUsersTable();
          showBar('ok', '<i class="fas fa-circle-check"></i> ✅ تم التحديث وكلمة المرور مباشرة');
          toast('✓ تم تغيير كلمة المرور', 'ok');
          setTimeout(() => { const m = document.getElementById('modal'); if(m) m.classList.remove('open'); }, 1500);
          return;
        }

        try{
          const { error: eErr } = await sb.auth.resetPasswordForEmail(upd.email, {
            redirectTo: window.location.origin + window.location.pathname
          });
          if(eErr) throw eErr;
          try{ await sb.from('profiles').update({ password_hint: newPw }).eq('id', id); }catch(e){}
          upd.password_hint = newPw;
          Object.assign(u, upd);
          renderUsersTable();
          showBar('ok', '<i class="fas fa-circle-check"></i> تم إرسال رابط إعادة تعيين للمستخدم');
          setTimeout(() => { const m = document.getElementById('modal'); if(m) m.classList.remove('open'); }, 2000);
          return;
        }catch(e){
          showBar('err', '<i class="fas fa-circle-xmark"></i> فشل: ' + escapeHtml(e.message));
          return;
        }
      }

      Object.assign(u, upd);
      renderUsersTable();
      toast('✓ تم تحديث البيانات', 'ok');
    }
  });
};

window.resetUserPassword = id => {
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('إعادة تعيين كلمة السر', `سيتم إرسال رابط إعادة تعيين كلمة السر إلى: ${escapeHtml(u.email)}`, async () => {
    try{
      const { error } = await sb.auth.resetPasswordForEmail(u.email, { redirectTo: window.location.origin + window.location.pathname });
      if(error){ toast('فشل الإرسال: ' + error.message, 'err'); return; }
      toast('✓ تم إرسال رابط إعادة التعيين', 'ok');
    }catch(e){ toast('خطأ: ' + e.message, 'err'); }
  });
};

window.deleteUser = id => {
  if(!isOwner()){ toast('هذه الصلاحية لرئيس المنصة فقط', 'err'); return; }
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('حذف المستخدم', `سيتم حذف الحساب «${escapeHtml(u.name)}» (${escapeHtml(u.email)}) نهائيًا مع كل تقدمه. متأكد؟`, async () => {
    if(typeof logAdminAction === 'function'){ await logAdminAction('delete_user', id, `حذف المستخدم: ${u.name}`, { email: u.email }); }

    try{ await sb.from('user_progress').delete().eq('user_id', id); }catch(e){}
    try{ await sb.from('user_drawings').delete().eq('user_id', id); }catch(e){}
    try{ await sb.from('video_progress').delete().eq('user_id', id); }catch(e){}
    const { error } = await sb.from('profiles').delete().eq('id', id);
    if(error){ toast('فشل الحذف: ' + error.message, 'err'); return; }
    DB.users = DB.users.filter(x => x.id !== id);
    renderUsersTable(); renderAdmin();
    toast('✓ تم حذف المستخدم', 'ok');
  }, true);
};

window.viewReceipt = (url) => {
  if(!url) return;
  openModal({
    title: '🧾 إيصال التحويل',
    text: '',
    bodyHTML: `
      <div style="text-align:center;margin-bottom:12px">
        <img src="${escapeHtml(url)}" alt="الإيصال" style="max-width:100%;max-height:60vh;border-radius:12px;border:1px solid var(--border);background:#fff" onerror="this.style.display='none'">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${escapeHtml(url)}" target="_blank" class="btn btn-primary" style="flex:1;text-decoration:none;justify-content:center">
          <i class="fas fa-external-link-alt"></i> فتح في نافذة جديدة
        </a>
      </div>
    `,
    okText: 'إغلاق',
    onOk: () => {}
  });
};

/* أحداث البحث */
document.addEventListener('DOMContentLoaded', () => {
  const searchEl = document.getElementById('userSearch');
  if(searchEl && !searchEl.dataset.bound){
    searchEl.dataset.bound = '1';
    searchEl.addEventListener('input', renderUsersTable);
  }
  const filterEl = document.getElementById('userFilter');
  if(filterEl && !filterEl.dataset.bound){
    filterEl.dataset.bound = '1';
    filterEl.addEventListener('change', renderUsersTable);
  }
});

/* ============================================================
   ملفات
============================================================ */
function renderAdminFiles(){
  const box = document.getElementById('adminFilesGrid'); if(!box) return;
  if(!DB.files.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-inbox"></i></div><h3>لا توجد ملفات</h3></div>';
    return;
  }
  box.innerHTML = DB.files.map(f => `
    <div class="admin-file-card ${f.important ? 'important' : ''}" style="--fc:${f.color || '#5b6cff'}">
      <div class="afc-head">
        <div class="ic"><i class="fas ${f.icon || 'fa-book'}"></i></div>
        <div style="flex:1;min-width:0">
          <h4>${escapeHtml(f.title)} ${f.important ? '<i class="fas fa-star" style="color:var(--accent);font-size:.75rem"></i>' : ''}</h4>
          <small>${escapeHtml(f.category || '')} • ${f.page_count || '?'} صفحة</small>
        </div>
      </div>
      <div class="afc-meta">
        <span>${f.important ? '<i class="fas fa-star" style="color:var(--accent)"></i> مهم' : 'ملف عادي'}</span>
      </div>
      <div class="afc-actions">
        <button class="btn btn-ghost btn-sm" onclick="toggleImportant('${f.id}')"><i class="fas fa-star"></i> ${f.important ? 'إلغاء' : 'تمييز'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFile('${f.id}','${escapeHtml(f.storage_path)}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
window.renderAdminFiles = renderAdminFiles;

window.toggleImportant = async id => {
  const f = DB.files.find(x => x.id === id); if(!f) return;
  const { error } = await sb.from('files').update({ important: !f.important }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  toast(f.important ? 'تم إزالة النجمة' : 'أصبح الملف مميزاً', 'ok');
};

window.deleteFile = (id, path) => {
  const f = DB.files.find(x => x.id === id); if(!f) return;
  confirmBox('حذف الملف', `حذف الملف «${escapeHtml(f.title)}»؟`, async () => {
    try{ await sb.storage.from('pdfs').remove([path]); }catch(e){}
    const { error } = await sb.from('files').delete().eq('id', id);
    if(error){ toast('فشل الحذف: ' + error.message, 'err'); return; }
    if(typeof logAdminAction === 'function'){ await logAdminAction('delete_file', null, `حذف ملف: ${f.title}`); }
    toast('تم حذف الملف', 'ok');
  }, true);
};

let currentPdfBlob = null;
const uploadZone = document.getElementById('uploadZone');
const afPdfInput = document.getElementById('afPdfInput');

if(uploadZone && afPdfInput && !uploadZone.dataset.bound){
  uploadZone.dataset.bound = '1';
  uploadZone.addEventListener('click', () => afPdfInput.click());
  ['dragenter','dragover'].forEach(ev => {
    uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  });
  ['dragleave','drop'].forEach(ev => {
    uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.remove('dragover'); });
  });
  uploadZone.addEventListener('drop', e => {
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if(file) handlePdfFile(file);
  });
  afPdfInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if(file) handlePdfFile(file);
  });
}

async function handlePdfFile(file){
  if(file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')){ toast('PDF فقط', 'warn'); return; }
  if(file.size > 100 * 1024 * 1024){ toast('الحد 100 ميجا', 'warn'); return; }
  currentPdfBlob = file;
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  let pages = '?';
  try{
    const ab = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: ab }).promise;
    pages = doc.numPages;
    try{ doc.destroy(); }catch(e){}
  }catch(e){}
  const info = document.getElementById('uzFileInfo');
  if(info) info.innerHTML = `<div class="uz-file"><i class="fas fa-circle-check"></i> ${escapeHtml(file.name)} — ${sizeMB} ميجا${pages !== '?' ? ` — ${pages} صفحة` : ''}</div>`;
  const titleEl = document.getElementById('afTitle');
  if(titleEl && !titleEl.value) titleEl.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g,' ');
}

document.addEventListener('DOMContentLoaded', () => {
  const cf = document.getElementById('clearFileBtn');
  if(cf && !cf.dataset.bound){
    cf.dataset.bound = '1';
    cf.addEventListener('click', () => {
      const t = document.getElementById('afTitle'); if(t) t.value = '';
      const c = document.getElementById('afCat'); if(c) c.value = 'كمي';
      const d = document.getElementById('afDesc'); if(d) d.value = '';
      const i = document.getElementById('afImportant'); if(i) i.checked = false;
      const info = document.getElementById('uzFileInfo'); if(info) info.innerHTML = '';
      if(afPdfInput) afPdfInput.value = '';
      currentPdfBlob = null;
    });
  }

  const sf = document.getElementById('saveFileBtn');
  if(sf && !sf.dataset.bound){
    sf.dataset.bound = '1';
    sf.addEventListener('click', async () => {
      if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
      const btn = sf;
      const title = (document.getElementById('afTitle').value || '').trim();
      const cat = document.getElementById('afCat').value;
      const desc = (document.getElementById('afDesc').value || '').trim();
      const important = document.getElementById('afImportant').checked;
      if(!title){ toast('أدخل عنوان الملف', 'warn'); return; }
      if(!currentPdfBlob){ toast('اختر ملف PDF أولاً', 'warn'); return; }

      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

      const id = typeof uuidv4 === 'function' ? uuidv4() : ('f_' + Date.now() + '_' + Math.random().toString(36).slice(2,9));
      const safeName = currentPdfBlob.name.replace(/[^\w.\-]+/g,'_').slice(0,80);
      const storagePath = currentUserObj.id + '/' + id + '_' + safeName;

      let pages = 0;
      try{
        const ab = await currentPdfBlob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: ab }).promise;
        pages = doc.numPages;
        try{ doc.destroy(); }catch(e){}
      }catch(e){}

      const { error: upErr } = await sb.storage.from('pdfs').upload(storagePath, currentPdfBlob, {
        cacheControl: '3600', upsert: false, contentType: 'application/pdf'
      });
      if(upErr){ btn.disabled = false; btn.innerHTML = orig; toast('فشل: ' + upErr.message, 'err'); return; }

      const choice = typeof pick === 'function' ? pick(ICONS) : { i: 'fa-book', c: '#5b6cff' };
      const { error: dbErr } = await sb.from('files').insert({
        id: id, title, category: cat, description: desc, important,
        icon: choice.i, color: choice.c, page_count: pages,
        storage_path: storagePath, created_by: currentUserObj.id
      });

      if(dbErr){
        try{ await sb.storage.from('pdfs').remove([storagePath]); }catch(e){}
        btn.disabled = false; btn.innerHTML = orig;
        toast('فشل: ' + dbErr.message, 'err');
        return;
      }

      if(typeof logAdminAction === 'function'){ await logAdminAction('upload_file', null, `رفع ملف: ${title}`, { category: cat }); }

      btn.disabled = false; btn.innerHTML = orig;
      const t = document.getElementById('afTitle'); if(t) t.value = '';
      const c = document.getElementById('afCat'); if(c) c.value = 'كمي';
      const d = document.getElementById('afDesc'); if(d) d.value = '';
      const i = document.getElementById('afImportant'); if(i) i.checked = false;
      const info = document.getElementById('uzFileInfo'); if(info) info.innerHTML = '';
      if(afPdfInput) afPdfInput.value = '';
      currentPdfBlob = null;

      toast('✓ تم رفع الملف', 'ok');

      document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
      const tab = document.querySelector('.admin-tabs button[data-panel="files"]');
      if(tab) tab.classList.add('on');
      const panel = document.getElementById('panel-files');
      if(panel) panel.classList.add('on');
    });
  }
});

/* تبويبات لوحة الأدمن */
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.admin-tabs button');
  if(tabBtn){
    document.querySelectorAll('.admin-tabs button').forEach(x => x.classList.remove('on'));
    document.querySelectorAll('.admin-panel').forEach(x => x.classList.remove('on'));
    tabBtn.classList.add('on');
    const panel = document.getElementById('panel-' + tabBtn.dataset.panel);
    if(panel) panel.classList.add('on');
    return;
  }
});

/* إضافة مستخدم */
(function bindAdminCreateUser(){
  const btn = document.getElementById('nuCreateBtn');
  if(!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async () => {
    if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
    const name = (document.getElementById('nuName').value || '').trim();
    const email = (document.getElementById('nuEmail').value || '').trim().toLowerCase();
    const pass = document.getElementById('nuPass').value;
    const approve = document.getElementById('nuApprove').checked;

    if(!name || name.length < 2){ toast('أدخل اسماً صحيحاً', 'warn'); return; }
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('أدخل بريداً صحيحاً', 'warn'); return; }
    if(!pass || pass.length < 8){ toast('كلمة المرور 8 أحرف على الأقل', 'warn'); return; }

    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

    try{
      const { data, error } = await sbTemp.auth.signUp({ email, password: pass, options: { data: { name } } });
      if(error){ toast('فشل: ' + error.message, 'err'); btn.disabled = false; btn.innerHTML = orig; return; }

      if(data && data.user){
        await new Promise(r => setTimeout(r, 800));
        const upd = { name, password_hint: pass };
        if(approve){
          upd.status = 'approved';
          const start = new Date();
          const end = new Date();
          end.setMonth(end.getMonth() + 1);
          upd.subscription_start = start.toISOString();
          upd.subscription_end = end.toISOString();
          upd.subscription_months = 1;
        }
        const { error: upErr } = await sb.from('profiles').update(upd).eq('id', data.user.id);
        if(upErr) console.warn('update failed', upErr);

        if(typeof logAdminAction === 'function'){ await logAdminAction('create_user', data.user.id, `إنشاء حساب: ${name}`); }
      }

      toast('✓ تم إنشاء الحساب', 'ok');
      document.getElementById('nuName').value = '';
      document.getElementById('nuEmail').value = '';

      try{
        const r = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        DB.users = r.data || [];
        renderAdmin();
      }catch(e){}
    }catch(e){ toast('خطأ: ' + e.message, 'err'); }

    btn.disabled = false;
    btn.innerHTML = orig;
  });

  const clr = document.getElementById('nuClearBtn');
  if(clr){
    clr.addEventListener('click', () => {
      document.getElementById('nuName').value = '';
      document.getElementById('nuEmail').value = '';
      document.getElementById('nuPass').value = '12345678';
      document.getElementById('nuApprove').checked = true;
    });
  }
})();

/* ============================================================
   الفيديوهات
============================================================ */
function renderAdminVideos(){
  const box = document.getElementById('adminVideosGrid'); if(!box) return;
  const list = DB.videos || [];
  if(!list.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-video"></i></div><h3>لا توجد فيديوهات</h3></div>';
    return;
  }
  box.innerHTML = list.map(v => `
    <div class="admin-video-card">
      <div class="admin-video-thumb" style="background-image:url('${v.thumbnail || youtubeThumb(v.youtube_id)}')">
        <img src="${v.thumbnail || youtubeThumb(v.youtube_id)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
      </div>
      <div class="admin-video-body">
        <h4>${escapeHtml(v.title)} ${v.important ? '<i class="fas fa-star" style="color:var(--accent);font-size:.75rem"></i>' : ''}</h4>
        <small>${escapeHtml(v.category || '')} • ${fmtDuration(v.duration || 0)}</small>
        <div class="admin-video-actions">
          <button class="btn btn-ghost btn-sm" onclick="toggleVideoImportant('${v.id}')"><i class="fas fa-star"></i> ${v.important ? 'إلغاء' : 'تمييز'}</button>
          <button class="btn btn-ghost btn-sm" onclick="linkVideoToFile('${v.id}')"><i class="fas fa-link"></i> ربط بملف</button>
          <button class="btn btn-danger btn-sm" onclick="deleteVideo('${v.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}
window.renderAdminVideos = renderAdminVideos;

window.toggleVideoImportant = async id => {
  const v = (DB.videos || []).find(x => x.id === id); if(!v) return;
  const { error } = await sb.from('videos').update({ important: !v.important }).eq('id', id);
  if(error){ toast('فشل', 'err'); return; }
  toast(v.important ? 'أُزيل التمييز' : 'أصبح مميزاً', 'ok');
};

window.deleteVideo = id => {
  const v = (DB.videos || []).find(x => x.id === id); if(!v) return;
  confirmBox('حذف الفيديو', `حذف «${escapeHtml(v.title)}»؟`, async () => {
    const { error } = await sb.from('videos').delete().eq('id', id);
    if(error){ toast('فشل', 'err'); return; }
    if(typeof logAdminAction === 'function'){ await logAdminAction('delete_video', null, `حذف فيديو: ${v.title}`); }
    toast('تم الحذف', 'ok');
  }, true);
};

window.linkVideoToFile = (videoId) => {
  const v = (DB.videos || []).find(x => x.id === videoId); if(!v) return;
  const list = DB.files || [];
  if(!list.length){ toast('لا توجد ملفات', 'warn'); return; }
  openModal({
    title: 'ربط الفيديو بملف كـ «شرح»',
    text: 'اختر الملف الذي سيعرض هذا الفيديو كشرح له.',
    bodyHTML: `
      <div class="vp-pick-list">
        ${list.map(f => `
          <div class="vp-pick-item" onclick="doLinkVideo('${videoId}','${f.id}')">
            <i class="fas ${f.icon || 'fa-book'}" style="font-size:1.4rem;color:${f.color || '#5b6cff'};margin:0 6px"></i>
            <div style="flex:1;min-width:0">
              <b>${escapeHtml(f.title)}</b>
              <small>${escapeHtml(f.category || 'عام')}</small>
            </div>
            ${f.explanation_video_id === videoId ? '<i class="fas fa-circle-check" style="color:var(--success)"></i>' : ''}
          </div>
        `).join('')}
      </div>
    `,
    okText: 'إلغاء',
    onOk: () => {}
  });
};

window.doLinkVideo = async (videoId, fileId) => {
  const f = DB.files.find(x => x.id === fileId); if(!f) return;
  const { error } = await sb.from('files').update({ explanation_video_id: videoId }).eq('id', fileId);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  f.explanation_video_id = videoId;
  const m = document.getElementById('modal'); if(m) m.classList.remove('open');
  toast('✓ تم الربط', 'ok');
  if(typeof renderAdminFiles === 'function') renderAdminFiles();
  if(typeof renderFiles === 'function') renderFiles();
};

/* حفظ الفيديو */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('saveVideoBtn');
  if(btn && !btn.dataset.bound){
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
      const url = (document.getElementById('avUrl').value || '').trim();
      const title = (document.getElementById('avTitle').value || '').trim();
      const cat = document.getElementById('avCat').value;
      const desc = (document.getElementById('avDesc').value || '').trim();
      const important = document.getElementById('avImportant').checked;
      const ytId = extractYoutubeId(url);

      if(!ytId){ toast('رابط يوتيوب غير صالح', 'err'); return; }
      if(!title){ toast('أدخل عنوان الفيديو', 'warn'); return; }

      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      const thumb = youtubeThumb(ytId);
      const { error } = await sb.from('videos').insert({
        title, description: desc, youtube_id: ytId, category: cat,
        important, thumbnail: thumb, duration: 0, created_by: currentUserObj.id
      });

      btn.disabled = false;
      btn.innerHTML = orig;

      if(error){ toast('فشل: ' + error.message, 'err'); return; }

      if(typeof logAdminAction === 'function'){ await logAdminAction('add_video', null, `إضافة فيديو: ${title}`); }

      document.getElementById('avUrl').value = '';
      document.getElementById('avTitle').value = '';
      document.getElementById('avDesc').value = '';
      document.getElementById('avImportant').checked = false;
      const p = document.getElementById('avUrlPreview'); if(p) p.style.display = 'none';

      toast('✓ تم إضافة الفيديو', 'ok');
      if(typeof loadVideos === 'function') loadVideos();
    });
  }
});

/* ============================================================
   المنتجات
============================================================ */
const PRODUCT_ICONS = [
  'fa-graduation-cap','fa-book','fa-calculator','fa-brain',
  'fa-lightbulb','fa-star','fa-crown','fa-fire','fa-rocket',
  'fa-award','fa-medal','fa-trophy','fa-chalkboard-user',
  'fa-pen-ruler','fa-language','fa-infinity'
];
const PRODUCT_COLORS = [
  '#5b6cff','#8b5cf6','#7c3aed','#ec4899','#db2777','#ef4444',
  '#f59e0b','#f7b32b','#22c55e','#16a34a','#14b8a6','#06b6d4','#0ea5e9'
];

let pfSelectedIcon = 'fa-graduation-cap';
let pfSelectedColor = '#5b6cff';

function renderAdminProducts(){
  const box = document.getElementById('adminProductsGrid'); if(!box) return;
  const list = DB.products || [];
  const stat1 = document.getElementById('adProducts');
  if(stat1) stat1.textContent = list.filter(p => p.active).length;

  if(!list.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-shopping-bag"></i></div><h3>لا توجد منتجات</h3></div>';
    return;
  }

  box.innerHTML = list.map(p => `
    <div class="admin-product-card ${p.active ? '' : 'inactive'}" style="--pc:${p.color || '#5b6cff'}">
      <div class="admin-product-head">
        <div class="apc-icon"><i class="fas ${p.icon || 'fa-graduation-cap'}"></i></div>
        <div style="flex:1;min-width:0">
          <h4>${escapeHtml(p.title || '—')}</h4>
          <small>${escapeHtml(p.subtitle || '')}</small>
        </div>
      </div>
      <div class="admin-product-badges">
        ${p.popular ? '<span class="popular"><i class="fas fa-fire"></i> الأكثر طلباً</span>' : ''}
        ${p.active ? '<span class="active"><i class="fas fa-eye"></i> معروض</span>' : '<span class="inactive"><i class="fas fa-eye-slash"></i> مخفي</span>'}
      </div>
      <div class="admin-product-price"><b>${p.price || 0}</b> <span>${escapeHtml(p.currency || 'ر.س')}</span></div>
      <div class="admin-product-actions">
        <button class="btn btn-ghost btn-sm" onclick="adminEditProduct('${p.id}')" style="flex:1"><i class="fas fa-pen"></i> تعديل</button>
        <button class="btn btn-ghost btn-sm" onclick="adminToggleProductActive('${p.id}')"><i class="fas ${p.active ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
        <button class="btn btn-danger btn-sm" onclick="adminDeleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
window.renderAdminProducts = renderAdminProducts;

window.adminNewProduct = () => {
  document.getElementById('productFormTitle').textContent = 'إضافة منتج جديد';
  document.getElementById('pfId').value = '';
  document.getElementById('pfTitle').value = '';
  document.getElementById('pfSubtitle').value = '';
  document.getElementById('pfDesc').value = '';
  document.getElementById('pfPrice').value = '';
  document.getElementById('pfCurrency').value = 'ر.س';
  document.getElementById('pfFeatures').value = '';
  document.getElementById('pfPopular').checked = false;
  document.getElementById('pfActive').checked = true;
  pfSelectedIcon = 'fa-graduation-cap';
  pfSelectedColor = '#5b6cff';
  renderIconPicker();
  renderColorPicker();

  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="addproduct"]');
  if(tab) tab.classList.add('on');
  const panel = document.getElementById('panel-addproduct');
  if(panel) panel.classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.adminEditProduct = id => {
  const p = (DB.products || []).find(x => x.id === id);
  if(!p) return;

  document.getElementById('productFormTitle').textContent = 'تعديل المنتج';
  document.getElementById('pfId').value = p.id;
  document.getElementById('pfTitle').value = p.title || '';
  document.getElementById('pfSubtitle').value = p.subtitle || '';
  document.getElementById('pfDesc').value = p.description || '';
  document.getElementById('pfPrice').value = p.price || 0;
  document.getElementById('pfCurrency').value = p.currency || 'ر.س';
  document.getElementById('pfFeatures').value = (p.features || []).join('\n');
  document.getElementById('pfPopular').checked = !!p.popular;
  document.getElementById('pfActive').checked = p.active !== false;
  pfSelectedIcon = p.icon || 'fa-graduation-cap';
  pfSelectedColor = p.color || '#5b6cff';
  renderIconPicker();
  renderColorPicker();

  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="addproduct"]');
  if(tab) tab.classList.add('on');
  const panel = document.getElementById('panel-addproduct');
  if(panel) panel.classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function backToProductsList(){
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="products"]');
  if(tab) tab.classList.add('on');
  const panel = document.getElementById('panel-products');
  if(panel) panel.classList.add('on');
}

function renderIconPicker(){
  const box = document.getElementById('pfIconPicker');
  if(!box) return;
  box.innerHTML = PRODUCT_ICONS.map(ic => `
    <button type="button" class="icon-pick ${ic === pfSelectedIcon ? 'on' : ''}" data-icon="${ic}"><i class="fas ${ic}"></i></button>
  `).join('');
  box.querySelectorAll('.icon-pick').forEach(b => {
    b.addEventListener('click', () => {
      pfSelectedIcon = b.dataset.icon;
      box.querySelectorAll('.icon-pick').forEach(x => x.classList.toggle('on', x === b));
    });
  });
}

function renderColorPicker(){
  const box = document.getElementById('pfColorPicker');
  if(!box) return;
  box.innerHTML = PRODUCT_COLORS.map(c => `
    <button type="button" class="color-pick ${c === pfSelectedColor ? 'on' : ''}" data-c="${c}" style="--cc:${c}"></button>
  `).join('');
  box.querySelectorAll('.color-pick').forEach(b => {
    b.addEventListener('click', () => {
      pfSelectedColor = b.dataset.c;
      box.querySelectorAll('.color-pick').forEach(x => x.classList.toggle('on', x === b));
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('pfSave');
  if(saveBtn && !saveBtn.dataset.bound){
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', async () => {
      if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
      const id = document.getElementById('pfId').value.trim();
      const title = document.getElementById('pfTitle').value.trim();
      const subtitle = document.getElementById('pfSubtitle').value.trim();
      const description = document.getElementById('pfDesc').value.trim();
      const price = parseFloat(document.getElementById('pfPrice').value) || 0;
      const currency = document.getElementById('pfCurrency').value.trim() || 'ر.س';
      const features = document.getElementById('pfFeatures').value.split('\n').map(s => s.trim()).filter(Boolean);
      const popular = document.getElementById('pfPopular').checked;
      const active = document.getElementById('pfActive').checked;

      if(!title){ toast('أدخل اسم المنتج', 'warn'); return; }

      const payload = { title, subtitle, description, price, currency, icon: pfSelectedIcon, color: pfSelectedColor, features, popular, active };

      saveBtn.disabled = true;
      const orig = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      let error;
      if(id){
        const r = await sb.from('products').update(payload).eq('id', id);
        error = r.error;
      } else {
        const r = await sb.from('products').insert(payload);
        error = r.error;
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = orig;

      if(error){ toast('فشل: ' + error.message, 'err'); return; }

      toast(id ? '✓ تم التحديث' : '✓ تم الإضافة', 'ok');
      if(typeof loadProducts === 'function') await loadProducts();
      if(typeof renderProducts === 'function') renderProducts();
      backToProductsList();
    });
  }
});

window.adminToggleProductActive = async id => {
  const p = (DB.products || []).find(x => x.id === id);
  if(!p) return;
  const { error } = await sb.from('products').update({ active: !p.active }).eq('id', id);
  if(error){ toast('فشل', 'err'); return; }
  toast(p.active ? 'تم الإخفاء' : 'أصبح معروضاً', 'ok');
};

window.adminDeleteProduct = id => {
  const p = (DB.products || []).find(x => x.id === id);
  if(!p) return;
  confirmBox('حذف المنتج', `حذف «${escapeHtml(p.title)}»؟`, async () => {
    const { error } = await sb.from('products').delete().eq('id', id);
    if(error){ toast('فشل', 'err'); return; }
    toast('تم الحذف', 'ok');
  }, true);
};

/* زر الدورة الافتراضية */
async function seedDefaultProduct(){
  if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
  const btn = document.getElementById('seedDefaultProductBtn');
  if(!btn || btn.disabled) return;

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';

  try{
    const checkRes = await sb.from('products').select('id').eq('title', 'دورة الأقسام').maybeSingle();
    if(checkRes.data){ if(!confirm('الدورة موجودة مسبقاً. متابعة؟')){ btn.disabled = false; btn.innerHTML = orig; return; } }

    const payload = {
      title: 'دورة الأقسام',
      subtitle: 'الدورة الشاملة لاختبار القدرات',
      description: 'دورة متكاملة تغطي جميع أقسام اختبار القدرات بأسلوب مبسط ومنظم.',
      price: 199, currency: 'ر.س',
      icon: 'fa-graduation-cap', color: '#5b6cff',
      features: ['شرح تفصيلي','ملفات PDF','فيديوهات','متابعة أسبوعية'],
      popular: true, active: true, sort_order: 0
    };

    const { error } = await sb.from('products').insert(payload);
    if(error){ toast('فشل: ' + error.message, 'err'); btn.disabled = false; btn.innerHTML = orig; return; }

    toast('✅ تمت الإضافة', 'ok');
    if(typeof loadProducts === 'function') await loadProducts();
  }catch(e){ toast('خطأ: ' + e.message, 'err'); }

  btn.disabled = false;
  btn.innerHTML = orig;
}

document.addEventListener('click', (e) => {
  if(e.target.closest('#seedDefaultProductBtn')){ e.preventDefault(); seedDefaultProduct(); }
});

/* ============================================================
   إعدادات المتجر
============================================================ */
function renderStoreSettings(){
  const s = DB.storeSettings || {};

  const ibanEl = document.getElementById('ssIban'); if(ibanEl) ibanEl.value = s.iban_number || '';
  const holderEl = document.getElementById('ssHolder'); if(holderEl) holderEl.value = s.iban_holder || '';
  const phoneEl = document.getElementById('ssPhone'); if(phoneEl) phoneEl.value = s.support_phone || '';
  const waEl = document.getElementById('ssWhatsApp'); if(waEl) waEl.value = s.support_whatsapp || '';

  const wrap = document.getElementById('ssIbanImageWrap');
  const removeBtn = document.getElementById('ssIbanImageRemove');
  const uploadLabel = document.getElementById('ssIbanUploadLabel');

  if(wrap){
    if(s.iban_image){
      wrap.innerHTML = `<img src="${s.iban_image}" alt="IBAN" loading="lazy">`;
      if(removeBtn) removeBtn.style.display = 'inline-flex';
      if(uploadLabel) uploadLabel.textContent = 'تغيير الصورة';
    } else {
      wrap.innerHTML = '';
      if(removeBtn) removeBtn.style.display = 'none';
      if(uploadLabel) uploadLabel.textContent = 'اختيار صورة';
    }
  }

  updateWaPreview();

  const status = document.getElementById('storeSettingsStatus');
  if(status){
    status.className = 'store-settings-status';
    status.innerHTML = '<i class="fas fa-circle-info"></i><span>لا توجد تغييرات غير محفوظة</span>';
  }
}
window.renderStoreSettings = renderStoreSettings;

window.copyFieldValue = (fieldId) => {
  const el = document.getElementById(fieldId);
  if(!el || !el.value){ toast('الحقل فارغ', 'warn'); return; }
  try{ navigator.clipboard.writeText(el.value); toast('✓ تم النسخ', 'ok'); }
  catch(e){ el.select(); document.execCommand('copy'); toast('✓ تم النسخ', 'ok'); }
};

function updateWaPreview(){
  const waEl = document.getElementById('ssWhatsApp');
  const prev = document.getElementById('waPreview');
  if(!waEl || !prev) return;

  const val = (waEl.value || '').replace(/\D/g, '');
  if(!val){ prev.classList.remove('show'); prev.innerHTML = ''; return; }

  if(val.length < 10){
    prev.classList.add('show');
    prev.style.background = 'rgba(239,68,68,.08)';
    prev.style.borderColor = 'rgba(239,68,68,.25)';
    prev.style.color = '#dc2626';
    prev.innerHTML = '<i class="fas fa-circle-exclamation"></i> الرقم قصير';
    return;
  }

  prev.classList.add('show');
  prev.style.background = 'rgba(37,211,102,.08)';
  prev.style.borderColor = 'rgba(37,211,102,.25)';
  prev.style.color = '#128C7E';
  prev.innerHTML = `<i class="fas fa-check-circle"></i> <b>الرابط:</b> https://wa.me/${val}`;
}

function markSettingsDirty(){
  const status = document.getElementById('storeSettingsStatus');
  if(!status) return;
  status.className = 'store-settings-status dirty';
  status.innerHTML = '<i class="fas fa-circle-exclamation"></i><span>لديك تغييرات غير محفوظة</span>';
}

async function saveStoreSettings(){
  if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
  const saveBtn = document.getElementById('ssSave');
  const orig = saveBtn.innerHTML;

  const iban = (document.getElementById('ssIban').value || '').trim();
  const waNum = (document.getElementById('ssWhatsApp').value || '').replace(/\D/g, '');

  if(!iban){ toast('أدخل رقم الآيبان', 'warn'); return; }
  if(!waNum || waNum.length < 10){ toast('رقم الواتساب غير صحيح', 'warn'); return; }

  const payload = {
    iban_number: iban,
    iban_holder: (document.getElementById('ssHolder').value || '').trim(),
    support_phone: (document.getElementById('ssPhone').value || '').trim(),
    support_whatsapp: waNum,
    updated_at: new Date().toISOString()
  };

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

  try{
    const { error } = await sb.from('store_settings').update(payload).eq('id', 1);
    if(error){ toast('فشل: ' + error.message, 'err'); saveBtn.disabled = false; saveBtn.innerHTML = orig; return; }

    DB.storeSettings = Object.assign({}, DB.storeSettings, payload);
    if(typeof applyStoreSettings === 'function') applyStoreSettings();

    if(typeof logAdminAction === 'function'){ await logAdminAction('update_settings', null, 'تحديث إعدادات المتجر'); }

    const status = document.getElementById('storeSettingsStatus');
    if(status){
      status.className = 'store-settings-status saved';
      status.innerHTML = '<i class="fas fa-circle-check"></i><span>✓ تم الحفظ</span>';
    }

    toast('✅ تم الحفظ', 'ok');
    setTimeout(() => {
      if(status){
        status.className = 'store-settings-status';
        status.innerHTML = '<i class="fas fa-circle-info"></i><span>لا توجد تغييرات غير محفوظة</span>';
      }
    }, 3000);
  }catch(e){ toast('خطأ: ' + e.message, 'err'); }

  saveBtn.disabled = false;
  saveBtn.innerHTML = orig;
}
window.saveStoreSettings = saveStoreSettings;

document.addEventListener('DOMContentLoaded', () => {
  const ibanInput = document.getElementById('ssIbanImageInput');

  if(ibanInput && !ibanInput.dataset.bound){
    ibanInput.dataset.bound = '1';
    ibanInput.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if(!f) return;
      if(!f.type.startsWith('image/')){ toast('صورة صحيحة', 'warn'); return; }
      if(f.size > 5 * 1024 * 1024){ toast('الحد 5 ميجا', 'warn'); return; }

      toast('جاري الرفع...');
      try{
        const blob = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const ratio = Math.min(1200 / img.width, 1200 / img.height, 1);
              const w = Math.round(img.width * ratio);
              const h = Math.round(img.height * ratio);
              const c = document.createElement('canvas');
              c.width = w; c.height = h;
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              c.toBlob(b => b ? res(b) : rej(new Error('فشل')), 'image/jpeg', 0.9);
            };
            img.onerror = rej;
            img.src = reader.result;
          };
          reader.onerror = rej;
          reader.readAsDataURL(f);
        });

        const path = '_store/iban_' + Date.now() + '.jpg';
        const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
          cacheControl: '3600', upsert: true, contentType: 'image/jpeg'
        });
        if(upErr){ toast('فشل: ' + upErr.message, 'err'); return; }

        try{
          const old = DB.storeSettings && DB.storeSettings.iban_image;
          if(old){
            const oldPath = old.split('/avatars/')[1];
            if(oldPath && oldPath.startsWith('_store/')){
              await sb.storage.from('avatars').remove([oldPath.split('?')[0]]);
            }
          }
        }catch(e){}

        const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
        const url = urlData ? urlData.publicUrl + '?t=' + Date.now() : '';

        const { error: dbErr } = await sb.from('store_settings').update({ iban_image: url }).eq('id', 1);
        if(dbErr){ toast('فشل: ' + dbErr.message, 'err'); return; }

        if(!DB.storeSettings) DB.storeSettings = {};
        DB.storeSettings.iban_image = url;
        renderStoreSettings();
        toast('✅ تم الرفع', 'ok');
      }catch(err){ toast('خطأ: ' + err.message, 'err'); }
      e.target.value = '';
    });
  }

  const rm = document.getElementById('ssIbanImageRemove');
  if(rm && !rm.dataset.bound){
    rm.dataset.bound = '1';
    rm.addEventListener('click', async () => {
      if(!confirm('حذف صورة الآيبان؟')) return;
      const { error } = await sb.from('store_settings').update({ iban_image: '' }).eq('id', 1);
      if(error){ toast('فشل', 'err'); return; }
      if(!DB.storeSettings) DB.storeSettings = {};
      DB.storeSettings.iban_image = '';
      renderStoreSettings();
      toast('تم الحذف', 'ok');
    });
  }

  const waInput = document.getElementById('ssWhatsApp');
  if(waInput && !waInput.dataset.bound){
    waInput.dataset.bound = '1';
    waInput.addEventListener('input', () => { updateWaPreview(); markSettingsDirty(); });
  }

  ['ssIban','ssHolder','ssPhone'].forEach(id => {
    const el = document.getElementById(id);
    if(el && !el.dataset.bound){
      el.dataset.bound = '1';
      el.addEventListener('input', markSettingsDirty);
    }
  });

  const saveBtn = document.getElementById('ssSave');
  if(saveBtn && !saveBtn.dataset.bound){
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', saveStoreSettings);
  }
});
