/* ============================================================
   18) ADMIN — النسخة المُصلَّحة (بدون تكرار + رفع سريع)
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

  document.querySelectorAll('.owner-only-tab').forEach(t => {
    t.style.display = (currentUserObj && currentUserObj.role === 'owner') ? '' : 'none';
  });

  renderUsersTable();
  renderAdminFiles();
  if(typeof renderAdminVideos === 'function') renderAdminVideos();
  if(typeof renderAdminProducts === 'function') renderAdminProducts();
  if(typeof renderStoreSettings === 'function') renderStoreSettings();
  if(typeof renderAdminQuizQuestions === 'function') renderAdminQuizQuestions();

  if(currentUserObj && currentUserObj.role === 'owner'){
    try{ if(typeof loadGiftUsersList === 'function') loadGiftUsersList(); }catch(e){}
    try{ if(typeof renderAdminLogs === 'function') renderAdminLogs(); }catch(e){}
  }
}
window.renderAdmin = renderAdmin;

/* ============================================================
   جدول المستخدمين — مع الدورة والاشتراك
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
    const rank = u => u.role === 'owner' ? 0 : u.role === 'admin' ? 1 : u.status === 'pending' ? 2 : 3;
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
      <div>المستخدم</div>
      <div>البريد الإلكتروني</div>
      <div>الدورة والاشتراك</div>
      <div>كلمة السر</div>
      <div>الحالة</div>
      <div style="text-align:left">إجراءات</div>
    </div>
    ${list.map(u => {
      let statusBadge;
      if(u.role === 'owner') statusBadge = '<span class="role-badge owner"><i class="fas fa-crown"></i> رئيس المنصة</span>';
      else if(u.role === 'admin') statusBadge = '<span class="role-badge admin"><i class="fas fa-shield-halved"></i> أدمن</span>';
      else if(u.status === 'approved') statusBadge = '<span class="status-badge on"><i class="fas fa-circle-check"></i> مشترك</span>';
      else if(u.status === 'pending') statusBadge = '<span class="status-badge pending"><i class="fas fa-clock"></i> معلّق</span>';
      else statusBadge = '<span class="status-badge off"><i class="fas fa-ban"></i> مرفوض</span>';

      const avStyle = u.avatar_url ? `background-image:url('${u.avatar_url}')` : '';
      const pwHtml = u.password_hint
        ? `<code onclick="copyTxt('${escapeHtml(u.password_hint).replace(/'/g,'&#39;')}')" title="اضغط للنسخ" style="background:var(--bg);padding:3px 8px;border-radius:6px;font-size:.74rem;direction:ltr;display:inline-block;cursor:pointer;border:1px solid var(--border)">${escapeHtml(u.password_hint)}</code>`
        : '<span style="font-size:.72rem;color:var(--muted)">—</span>';

      /* ⭐ بيانات الدورة والاشتراك */
      const course = (u.course_id && typeof getCourseById === 'function') ? getCourseById(u.course_id) : null;
      let subCell;
      if(course && u.status === 'approved'){
        const months = u.subscription_months || 0;
        const price = (course.prices && months) ? (course.prices[String(months)] || 0) : 0;
        let daysLeft = null;
        if(u.subscription_end){
          daysLeft = Math.ceil((new Date(u.subscription_end) - new Date()) / (1000*60*60*24));
        }
        const isExpired = daysLeft !== null && daysLeft <= 0;
        const isWarning = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
        const daysColor = isExpired ? '#dc2626' : isWarning ? '#d97706' : '#16a34a';
        subCell = `
          <div style="display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:800;margin-bottom:3px">
            <i class="fas ${course.icon || 'fa-graduation-cap'}" style="color:${course.color || '#5b6cff'};font-size:.9rem"></i>
            <span>${escapeHtml(course.name)}</span>
          </div>
          <div style="font-size:.72rem;color:var(--muted);font-weight:700;line-height:1.6">
            <span style="color:var(--primary);font-weight:900">${price}</span> ر.س • ${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'أشهر'}
            ${daysLeft !== null ? `<br><span style="color:${daysColor};font-weight:900">${isExpired ? '⛔ منتهي' : `⏳ متبقي ${daysLeft} يوم`}</span>` : ''}
          </div>
        `;
      } else if(course){
        subCell = `
          <div style="display:flex;align-items:center;gap:7px;font-size:.8rem;font-weight:700;opacity:.7">
            <i class="fas ${course.icon || 'fa-graduation-cap'}" style="color:${course.color || '#5b6cff'}"></i>
            <span>${escapeHtml(course.name)}</span>
          </div>
          <small style="font-size:.68rem;color:var(--accent);font-weight:800">لم يُفعّل بعد</small>
        `;
      } else {
        subCell = '<span style="font-size:.72rem;color:var(--muted)">بدون دورة</span>';
      }

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
        <div class="sub-cell">${subCell}</div>
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
   مودال التفعيل — مع الدورة والمدة
============================================================ */
window.openApproveModal = (userId) => {
  const u = DB.users.find(x => x.id === userId);
  if(!u) return;
  const courses = (typeof CS !== 'undefined' ? CS.courses : []) || [];

  openModal({
    title: 'تفعيل اشتراك الطالب',
    text: `اختر الدورة ومدة الاشتراك لـ: ${escapeHtml(u.name || u.email)}`,
    bodyHTML: `
      <div class="form-group" style="margin-bottom:14px">
        <label>الدورة *</label>
        <select id="approveCourse" style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="">— اختر دورة —</option>
          ${courses.map(c => `<option value="${c.id}" ${u.course_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label>مدة الاشتراك *</label>
        <select id="approveDuration" style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="1">شهر واحد</option>
          <option value="3">3 أشهر</option>
          <option value="6">6 أشهر</option>
          <option value="12">سنة كاملة</option>
        </select>
      </div>
      <div style="padding:12px;background:var(--primary-soft);border-radius:10px;font-size:.76rem;color:var(--primary);font-weight:700;line-height:1.7">
        <i class="fas fa-info-circle"></i> الطالب سيرى فقط ملفات وفيديوهات الدورة المختارة.
      </div>
    `,
    okText: 'تفعيل الآن',
    onOk: async () => {
      const courseId = document.getElementById('approveCourse').value;
      const months = parseInt(document.getElementById('approveDuration').value, 10);
      if(!courseId){ toast('اختر دورة', 'warn'); return; }
      if(typeof activateSubscription === 'function'){
        await activateSubscription(userId, months, courseId);
      }
      try{
        const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        DB.users = data || [];
        renderUsersTable();
      }catch(e){}
    }
  });
};

window.approveUser = async id => openApproveModal(id);

window.rejectUser = async id => {
  const { error } = await sb.from('profiles').update({ status:'rejected' }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  if(typeof logAdminAction === 'function') await logAdminAction('reject_user', id, 'رفض طلب مستخدم');
  toast('تم رفض المستخدم', 'warn');
};

window.promoteToAdmin = (id) => {
  if(!isOwner()){ toast('هذه الصلاحية لرئيس المنصة فقط', 'err'); return; }
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('ترقية إلى أدمن', `ترقية «${escapeHtml(u.name)}» إلى صلاحيات أدمن كاملة؟`, async () => {
    const { error } = await sb.from('profiles').update({ role: 'admin' }).eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    u.role = 'admin';
    if(typeof logAdminAction === 'function') await logAdminAction('promote_admin', id, 'ترقية إلى أدمن');
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
    if(typeof logAdminAction === 'function') await logAdminAction('demote_admin', id, 'إزالة صلاحية الأدمن');
    renderUsersTable();
    toast('تمت الإزالة', 'warn');
  }, true);
};

window.editUser = id => {
  const u = DB.users.find(x => x.id === id); if(!u) return;
  const isOwnerUser = isOwner();
  const isTargetAdmin = u.role === 'admin';
  const courses = (typeof CS !== 'undefined' ? CS.courses : []) || [];

  if(!isOwnerUser && isTargetAdmin){ toast('لا تملك صلاحية تعديل الأدمنز', 'err'); return; }

  openModal({
    title: 'تعديل المستخدم',
    text: isOwnerUser ? 'رئيس المنصة يمكنه تعديل كل شيء.' : 'عدّل البيانات الأساسية.',
    bodyHTML: `
      <div class="form-group" style="margin-bottom:12px">
        <label>الاسم</label>
        <input type="text" id="euName" value="${escapeHtml(u.name||'')}" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>البريد الإلكتروني</label>
        <input type="email" id="euEmail" value="${escapeHtml(u.email||'')}" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>رقم الجوال</label>
        <input type="tel" id="euPhone" value="${escapeHtml(u.phone||'')}" maxlength="10" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>
      ${!isTargetAdmin ? `
      <div class="form-group" style="margin-bottom:12px">
        <label>الدورة</label>
        <select id="euCourse" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="">— بدون دورة —</option>
          ${courses.map(c => `<option value="${c.id}" ${u.course_id===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      ` : ''}
      <div class="form-group" style="margin-bottom:12px">
        <label>كلمة المرور الجديدة ${u.password_hint ? `<span style="color:var(--muted);font-weight:600;font-size:.76rem">(الحالية: <code style="background:var(--bg);padding:2px 6px;border-radius:5px;direction:ltr;display:inline-block;cursor:pointer" onclick="copyTxt('${escapeHtml(u.password_hint).replace(/'/g,'&#39;')}')">${escapeHtml(u.password_hint)}</code>)</span>` : ''}</label>
        <div style="position:relative">
          <input type="password" id="euPw" value="" placeholder="اتركها فارغة لعدم التغيير" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 44px 12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('euPw',this)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      ${!isTargetAdmin ? `
      <div class="form-group" style="margin-bottom:12px">
        <label>حالة الحساب</label>
        <select id="euStatus" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <option value="approved" ${u.status==='approved'?'selected':''}>✅ مشترك</option>
          <option value="pending" ${u.status==='pending'?'selected':''}>⏳ معلّق</option>
          <option value="rejected" ${u.status==='rejected'?'selected':''}>❌ مرفوض</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>مدة الاشتراك (عدد الأشهر)</label>
        <input type="number" id="euMonths" min="1" max="60" value="${u.subscription_months || 1}" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
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
        statusBar.style.background = kind === 'ok' ? 'rgba(34,197,94,.14)' : kind === 'warn' ? 'rgba(247,179,43,.16)' : 'rgba(239,68,68,.14)';
        statusBar.style.color = kind === 'ok' ? '#16a34a' : kind === 'warn' ? '#d97706' : '#dc2626';
        statusBar.innerHTML = html;
      };

      const upd = {
        name: document.getElementById('euName').value.trim() || u.name,
        email: document.getElementById('euEmail').value.trim().toLowerCase() || u.email
      };
      if(newPhone && newPhone.length === 10) upd.phone = newPhone;

      const statusEl = document.getElementById('euStatus');
      if(statusEl) upd.status = statusEl.value;

      const courseEl = document.getElementById('euCourse');
      if(courseEl) upd.course_id = courseEl.value || null;

      if(statusEl && statusEl.value === 'approved'){
        const months = parseInt(document.getElementById('euMonths').value, 10) || 1;
        const end = new Date();
        end.setMonth(end.getMonth() + months);
        upd.subscription_end = end.toISOString();
        upd.subscription_months = months;
        if(!u.subscription_start) upd.subscription_start = new Date().toISOString();
      }

      const { error } = await sb.from('profiles').update(upd).eq('id', id);
      if(error){ showBar('err', '<i class="fas fa-circle-xmark"></i> فشل: ' + error.message); return; }

      if(typeof logAdminAction === 'function') await logAdminAction('edit_user', id, 'تعديل بيانات المستخدم', upd);

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
          showBar('ok', '<i class="fas fa-circle-check"></i> ✅ تم التحديث');
          setTimeout(() => { const m = document.getElementById('modal'); if(m) m.classList.remove('open'); }, 1500);
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
  confirmBox('حذف المستخدم', `سيتم حذف «${escapeHtml(u.name)}» نهائيًا؟`, async () => {
    if(typeof logAdminAction === 'function') await logAdminAction('delete_user', id, `حذف المستخدم: ${u.name}`, { email: u.email });
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
    bodyHTML: `<div style="text-align:center;margin-bottom:12px"><img src="${escapeHtml(url)}" alt="الإيصال" style="max-width:100%;max-height:60vh;border-radius:12px;border:1px solid var(--border);background:#fff" onerror="this.style.display='none'"></div>`,
    okText: 'إغلاق',
    onOk: () => {}
  });
};

document.addEventListener('DOMContentLoaded', () => {
  const searchEl = document.getElementById('userSearch');
  if(searchEl && !searchEl.dataset.bound){ searchEl.dataset.bound = '1'; searchEl.addEventListener('input', renderUsersTable); }
  const filterEl = document.getElementById('userFilter');
  if(filterEl && !filterEl.dataset.bound){ filterEl.dataset.bound = '1'; filterEl.addEventListener('change', renderUsersTable); }
});

/* ============================================================
   ملفات الأدمن
============================================================ */
function renderAdminFiles(){
  const box = document.getElementById('adminFilesGrid'); if(!box) return;
  if(!DB.files.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-inbox"></i></div><h3>لا توجد ملفات</h3></div>';
    return;
  }
  box.innerHTML = DB.files.map(f => {
    const course = f.course_id && typeof getCourseById === 'function' ? getCourseById(f.course_id) : null;
    return `
    <div class="admin-file-card ${f.important ? 'important' : ''}" style="--fc:${f.color || '#5b6cff'}">
      <div class="afc-head">
        <div class="ic"><i class="fas ${f.icon || 'fa-book'}"></i></div>
        <div style="flex:1;min-width:0">
          <h4>${escapeHtml(f.title)} ${f.important ? '<i class="fas fa-star" style="color:var(--accent);font-size:.75rem"></i>' : ''}</h4>
          <small>${escapeHtml(f.category || '')} • ${f.page_count || '?'} صفحة</small>
        </div>
      </div>
      <div class="afc-meta">
        ${course ? `<span style="color:${course.color};font-weight:800"><i class="fas ${course.icon}"></i> ${escapeHtml(course.name)}</span>` : '<span style="color:var(--muted)">للجميع</span>'}
      </div>
      <div class="afc-actions">
        <button class="btn btn-ghost btn-sm" onclick="toggleImportant('${f.id}')"><i class="fas fa-star"></i> ${f.important ? 'إلغاء' : 'تمييز'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFile('${f.id}','${escapeHtml(f.storage_path)}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
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
    if(typeof logAdminAction === 'function') await logAdminAction('delete_file', null, `حذف ملف: ${f.title}`);
    toast('تم حذف الملف', 'ok');
  }, true);
};

/* ============================================================
   ⭐ رفع ملف — نسخة نظيفة سريعة بدون تكرار
============================================================ */
let currentPdfBlob = null;

(function bindUploadZone(){
  const uploadZone = document.getElementById('uploadZone');
  const afPdfInput = document.getElementById('afPdfInput');
  if(!uploadZone || !afPdfInput || uploadZone.dataset.bound) return;
  uploadZone.dataset.bound = '1';
  uploadZone.addEventListener('click', () => afPdfInput.click());
  ['dragenter','dragover'].forEach(ev => uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(ev => uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.remove('dragover'); }));
  uploadZone.addEventListener('drop', e => { const file = e.dataTransfer && e.dataTransfer.files[0]; if(file) handlePdfFile(file); });
  afPdfInput.addEventListener('change', e => { const file = e.target.files[0]; if(file) handlePdfFile(file); });
})();

async function handlePdfFile(file){
  if(file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')){ toast('PDF فقط', 'warn'); return; }
  if(file.size > 100 * 1024 * 1024){ toast('الحد 100 ميجا', 'warn'); return; }
  currentPdfBlob = file;
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const info = document.getElementById('uzFileInfo');
  if(info) info.innerHTML = `<div class="uz-file"><i class="fas fa-circle-check"></i> ${escapeHtml(file.name)} — ${sizeMB} ميجا</div>`;
  const titleEl = document.getElementById('afTitle');
  if(titleEl && !titleEl.value) titleEl.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g,' ');
}

/* ⭐⭐⭐ حفظ ملف — نسخة موحّدة (تحل مشكلة التكرار + تسريع الرفع) */
(function bindSaveFileOnce(){
  const btn = document.getElementById('saveFileBtn');
  if(!btn || btn.dataset.finalBound) return;
  btn.dataset.finalBound = '1';
  /* أزل أي listener قديم بتغيير الزر */
  const clone = btn.cloneNode(true);
  clone.dataset.finalBound = '1';
  btn.parentNode.replaceChild(clone, btn);

  clone.addEventListener('click', async () => {
    if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
    if(clone.disabled) return;

    const title = (document.getElementById('afTitle').value || '').trim();
    const courseId = document.getElementById('afCourse') ? document.getElementById('afCourse').value : '';
    const cat = document.getElementById('afCat').value;
    const desc = (document.getElementById('afDesc').value || '').trim();
    const important = document.getElementById('afImportant').checked;

    if(!title){ toast('أدخل عنوان الملف', 'warn'); return; }
    if(!currentPdfBlob){ toast('اختر ملف PDF أولاً', 'warn'); return; }

    clone.disabled = true;
    const orig = clone.innerHTML;
    clone.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

    const id = typeof uuidv4 === 'function' ? uuidv4() : ('f_' + Date.now() + '_' + Math.random().toString(36).slice(2,9));
    const safeName = currentPdfBlob.name.replace(/[^\w.\-]+/g,'_').slice(0,80);
    const storagePath = currentUserObj.id + '/' + id + '_' + safeName;

    /* ⭐ ارفع + اعد الصفحات بالتوازي = أسرع بكثير */
    let pages = 0;
    let uploadError = null;

    await Promise.all([
      /* الرفع */
      (async () => {
        const { error } = await sb.storage.from('pdfs').upload(storagePath, currentPdfBlob, {
          cacheControl: '3600', upsert: false, contentType: 'application/pdf'
        });
        if(error) uploadError = error;
      })(),
      /* عدّ الصفحات (بالتوازي، ويستهلك arrayBuffer مؤقتاً) */
      (async () => {
        try{
          const ab = await currentPdfBlob.arrayBuffer();
          const doc = await pdfjsLib.getDocument({ data: ab }).promise;
          pages = doc.numPages;
          try{ doc.destroy(); }catch(e){}
        }catch(e){ pages = 0; }
      })()
    ]);

    if(uploadError){
      clone.disabled = false;
      clone.innerHTML = orig;
      toast('فشل الرفع: ' + uploadError.message, 'err');
      return;
    }

    const choice = typeof pick === 'function' ? pick(ICONS) : { i: 'fa-book', c: '#5b6cff' };
    const { error: dbErr } = await sb.from('files').insert({
      id, title, category: cat, description: desc, important,
      icon: choice.i, color: choice.c, page_count: pages,
      storage_path: storagePath, created_by: currentUserObj.id,
      course_id: courseId || null
    });

    if(dbErr){
      try{ await sb.storage.from('pdfs').remove([storagePath]); }catch(e){}
      clone.disabled = false;
      clone.innerHTML = orig;
      toast('فشل: ' + dbErr.message, 'err');
      return;
    }

    if(typeof logAdminAction === 'function') await logAdminAction('upload_file', null, `رفع ملف: ${title}`, { course_id: courseId });

    /* إشعار */
    try{
      if(typeof sendNotification === 'function'){
        const c = courseId ? getCourseById(courseId) : null;
        await sendNotification('file', '📄 ملف جديد: ' + title,
          c ? 'في دورة ' + c.name : 'متاح لجميع الطلاب',
          null, courseId || null, 'fa-file-pdf', '#ef4444');
      }
    }catch(e){}

    /* نظّف */
    clone.disabled = false;
    clone.innerHTML = orig;
    document.getElementById('afTitle').value = '';
    if(document.getElementById('afCourse')) document.getElementById('afCourse').value = '';
    document.getElementById('afDesc').value = '';
    document.getElementById('afImportant').checked = false;
    document.getElementById('uzFileInfo').innerHTML = '';
    const inp = document.getElementById('afPdfInput'); if(inp) inp.value = '';
    currentPdfBlob = null;

    toast('✓ تم رفع الملف', 'ok');

    document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
    const tab = document.querySelector('.admin-tabs button[data-panel="files"]');
    if(tab) tab.classList.add('on');
    const panel = document.getElementById('panel-files');
    if(panel) panel.classList.add('on');
  });
})();

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
      const inp = document.getElementById('afPdfInput'); if(inp) inp.value = '';
      currentPdfBlob = null;
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
  }
});

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
  box.innerHTML = list.map(v => {
    const course = v.course_id && typeof getCourseById === 'function' ? getCourseById(v.course_id) : null;
    return `
    <div class="admin-video-card">
      <div class="admin-video-thumb" style="background-image:url('${v.thumbnail || youtubeThumb(v.youtube_id)}')">
        <img src="${v.thumbnail || youtubeThumb(v.youtube_id)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
      </div>
      <div class="admin-video-body">
        <h4>${escapeHtml(v.title)} ${v.important ? '<i class="fas fa-star" style="color:var(--accent);font-size:.75rem"></i>' : ''}</h4>
        <small>${escapeHtml(v.category || '')} • ${fmtDuration(v.duration || 0)}</small>
        <div class="afc-meta" style="margin-top:8px">${course ? `<span style="color:${course.color};font-weight:800"><i class="fas ${course.icon}"></i> ${escapeHtml(course.name)}</span>` : '<span style="color:var(--muted)">للجميع</span>'}</div>
        <div class="admin-video-actions">
          <button class="btn btn-ghost btn-sm" onclick="toggleVideoImportant('${v.id}')"><i class="fas fa-star"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="linkVideoToFile('${v.id}')"><i class="fas fa-link"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteVideo('${v.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
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
    if(typeof logAdminAction === 'function') await logAdminAction('delete_video', null, `حذف فيديو: ${v.title}`);
    toast('تم الحذف', 'ok');
  }, true);
};

window.linkVideoToFile = (videoId) => {
  const v = (DB.videos || []).find(x => x.id === videoId); if(!v) return;
  const list = DB.files || [];
  if(!list.length){ toast('لا توجد ملفات', 'warn'); return; }
  openModal({
    title: 'ربط الفيديو بملف كـ «شرح»',
    text: 'اختر الملف.',
    bodyHTML: `<div class="vp-pick-list">${list.map(f => `<div class="vp-pick-item" onclick="doLinkVideo('${videoId}','${f.id}')"><i class="fas ${f.icon || 'fa-book'}" style="font-size:1.4rem;color:${f.color || '#5b6cff'};margin:0 6px"></i><div style="flex:1;min-width:0"><b>${escapeHtml(f.title)}</b><small>${escapeHtml(f.category || 'عام')}</small></div></div>`).join('')}</div>`,
    okText: 'إلغاء', onOk: () => {}
  });
};

window.doLinkVideo = async (videoId, fileId) => {
  const f = DB.files.find(x => x.id === fileId); if(!f) return;
  const { error } = await sb.from('files').update({ explanation_video_id: videoId }).eq('id', fileId);
  if(error){ toast('فشل', 'err'); return; }
  f.explanation_video_id = videoId;
  const m = document.getElementById('modal'); if(m) m.classList.remove('open');
  toast('✓ تم الربط', 'ok');
  if(typeof renderAdminFiles === 'function') renderAdminFiles();
  if(typeof renderFiles === 'function') renderFiles();
};

/* ⭐ حفظ فيديو — نسخة نظيفة */
(function bindSaveVideoOnce(){
  const btn = document.getElementById('saveVideoBtn');
  if(!btn || btn.dataset.finalBound) return;
  const clone = btn.cloneNode(true);
  clone.dataset.finalBound = '1';
  btn.parentNode.replaceChild(clone, btn);

  clone.addEventListener('click', async () => {
    if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
    if(clone.disabled) return;

    const url = (document.getElementById('avUrl').value || '').trim();
    const title = (document.getElementById('avTitle').value || '').trim();
    const courseId = document.getElementById('avCourse') ? document.getElementById('avCourse').value : '';
    const cat = document.getElementById('avCat').value;
    const desc = (document.getElementById('avDesc').value || '').trim();
    const important = document.getElementById('avImportant').checked;
    const ytId = extractYoutubeId(url);

    if(!ytId){ toast('رابط يوتيوب غير صالح', 'err'); return; }
    if(!title){ toast('أدخل عنوان الفيديو', 'warn'); return; }

    clone.disabled = true;
    const orig = clone.innerHTML;
    clone.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

    const thumb = youtubeThumb(ytId);
    const { error } = await sb.from('videos').insert({
      title, description: desc, youtube_id: ytId, category: cat,
      important, thumbnail: thumb, duration: 0,
      created_by: currentUserObj.id, course_id: courseId || null
    });

    clone.disabled = false;
    clone.innerHTML = orig;
    if(error){ toast('فشل: ' + error.message, 'err'); return; }

    if(typeof logAdminAction === 'function') await logAdminAction('add_video', null, `إضافة فيديو: ${title}`, { course_id: courseId });
    try{
      if(typeof sendNotification === 'function'){
        const c = courseId ? getCourseById(courseId) : null;
        await sendNotification('video', '🎬 فيديو جديد: ' + title,
          c ? 'في دورة ' + c.name : 'متاح لجميع الطلاب',
          null, courseId || null, 'fa-video', '#dc2626');
      }
    }catch(e){}

    document.getElementById('avUrl').value = '';
    document.getElementById('avTitle').value = '';
    if(document.getElementById('avCourse')) document.getElementById('avCourse').value = '';
    document.getElementById('avDesc').value = '';
    document.getElementById('avImportant').checked = false;
    const p = document.getElementById('avUrlPreview'); if(p) p.style.display = 'none';

    toast('✓ تم إضافة الفيديو', 'ok');
    if(typeof loadVideos === 'function') loadVideos();
  });

  const cvb = document.getElementById('clearVideoBtn');
  if(cvb && !cvb.dataset.bound){
    cvb.dataset.bound = '1';
    cvb.addEventListener('click', () => {
      document.getElementById('avUrl').value = '';
      document.getElementById('avTitle').value = '';
      document.getElementById('avDesc').value = '';
      document.getElementById('avImportant').checked = false;
      const p = document.getElementById('avUrlPreview'); if(p) p.style.display = 'none';
    });
  }
})();

/* ============================================================
   إنشاء مستخدم من الأدمن — نسخة موحّدة (بدون تكرار)
============================================================ */
(function bindAdminCreateUserFinal(){
  const btn = document.getElementById('nuCreateBtn');
  if(!btn || btn.dataset.finalBound) return;
  const clone = btn.cloneNode(true);
  clone.dataset.finalBound = '1';
  btn.parentNode.replaceChild(clone, btn);

  const courseSel = document.getElementById('nuCourse');
  if(courseSel && typeof CS !== 'undefined'){
    courseSel.innerHTML = '<option value="">— اختر دورة —</option>' +
      (CS.courses || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  const durationSel = document.getElementById('nuDuration');
  const customWrap = document.getElementById('nuCustomMonthsWrap');
  if(durationSel && customWrap){
    durationSel.addEventListener('change', e => {
      customWrap.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  }

  clone.addEventListener('click', async () => {
    if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
    if(clone.disabled) return;

    const name = (document.getElementById('nuName').value || '').trim();
    const email = (document.getElementById('nuEmail').value || '').trim().toLowerCase();
    const phone = (document.getElementById('nuPhone') ? document.getElementById('nuPhone').value : '').trim().replace(/\D/g, '');
    const pass = document.getElementById('nuPass').value;
    const courseId = document.getElementById('nuCourse') ? document.getElementById('nuCourse').value : '';
    const durationValue = document.getElementById('nuDuration') ? document.getElementById('nuDuration').value : '1';
    const customMonths = document.getElementById('nuCustomMonths') ? parseInt(document.getElementById('nuCustomMonths').value, 10) : 1;
    const approve = document.getElementById('nuApprove').checked;

    if(!name || name.length < 2){ toast('أدخل اسماً صحيحاً', 'warn'); return; }
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('بريد غير صحيح', 'warn'); return; }
    if(!pass || pass.length < 8){ toast('كلمة المرور 8 أحرف على الأقل', 'warn'); return; }
    if(approve && !courseId){ toast('اختر دورة للتفعيل', 'warn'); return; }

    let months = 1;
    if(approve){
      if(durationValue === 'custom'){
        months = customMonths;
        if(!months || months < 1 || months > 60){ toast('المدة بين 1 و 60 شهر', 'warn'); return; }
      } else {
        months = parseInt(durationValue, 10) || 1;
      }
    }

    clone.disabled = true;
    const orig = clone.innerHTML;
    clone.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

    try{
      const { data, error } = await sbTemp.auth.signUp({ email, password: pass, options: { data: { name, phone: phone || null } } });
      if(error){ toast('فشل: ' + error.message, 'err'); clone.disabled = false; clone.innerHTML = orig; return; }

      if(data && data.user){
        await new Promise(r => setTimeout(r, 700));
        const upd = { name, password_hint: pass };
        if(phone && phone.length === 10) upd.phone = phone;
        if(approve){
          upd.status = 'approved';
          upd.course_id = courseId;
          upd.subscription_start = new Date().toISOString();
          const end = new Date(); end.setMonth(end.getMonth() + months);
          upd.subscription_end = end.toISOString();
          upd.subscription_months = months;
        }
        const { error: upErr } = await sb.from('profiles').update(upd).eq('id', data.user.id);
        if(upErr) console.warn('update failed', upErr);
        if(typeof logAdminAction === 'function') await logAdminAction('create_user', data.user.id, `إنشاء حساب: ${name}`, { course_id: courseId, months });
      }

      toast('✓ تم إنشاء الحساب', 'ok');
      document.getElementById('nuName').value = '';
      document.getElementById('nuEmail').value = '';
      if(document.getElementById('nuPhone')) document.getElementById('nuPhone').value = '';

      try{
        const r = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        DB.users = r.data || [];
        renderAdmin();
      }catch(e){}
    }catch(e){ toast('خطأ: ' + e.message, 'err'); }

    clone.disabled = false;
    clone.innerHTML = orig;
  });

  const clr = document.getElementById('nuClearBtn');
  if(clr){
    clr.addEventListener('click', () => {
      document.getElementById('nuName').value = '';
      document.getElementById('nuEmail').value = '';
      if(document.getElementById('nuPhone')) document.getElementById('nuPhone').value = '';
      document.getElementById('nuPass').value = '12345678';
      document.getElementById('nuApprove').checked = true;
    });
  }
})();
