/* ============================================================
   18) ADMIN — لوحة الأدمن الكاملة
============================================================ */

function renderAdmin(){
  if(!currentUserObj || currentUserObj.role !== 'admin') return;
  const nonAdmins = DB.users.filter(u => u.role !== 'admin');
  const setTxt = (id,v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setTxt('adUsers', nonAdmins.length);
  setTxt('adPending', nonAdmins.filter(u => u.status === 'pending').length);
  setTxt('adSubscribed', nonAdmins.filter(u => u.status === 'approved').length);
  setTxt('adFiles', DB.files.length);
  setTxt('adImportant', DB.files.filter(f => f.important).length);
  renderUsersTable();
  renderAdminFiles();
}

function renderUsersTable(){
  const box = $('#usersTable'); if(!box) return;
  const q = ($('#userSearch') ? $('#userSearch').value : '').trim().toLowerCase();
  const filter = $('#userFilter') ? $('#userFilter').value : 'all';
  const isOwner = currentUserObj && currentUserObj.role === 'owner';

  let list = DB.users;
  if(q) list = list.filter(u => (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
  if(filter === 'pending') list = list.filter(u => u.status === 'pending');
  else if(filter === 'sub') list = list.filter(u => u.status === 'approved');
  else if(filter === 'off') list = list.filter(u => u.status !== 'approved');
  else if(filter === 'admins') list = list.filter(u => u.role === 'admin' || u.role === 'owner');

  /* الترتيب: pending أولاً، ثم owner، ثم admin، ثم user */
  list.sort((a,b) => {
    const rank = u => u.role === 'owner' ? 0 : u.role === 'admin' ? 1 : (u.status === 'pending' ? 2 : 3);
    const ra = rank(a), rb = rank(b);
    if(ra !== rb) return ra - rb;
    return new Date(b.created_at||0) - new Date(a.created_at||0);
  });

  if(!list.length){
    box.innerHTML = '<div class="admin-empty"><div class="em-ic"><i class="fas fa-users"></i></div><h3>لا يوجد مستخدمون مطابقون</h3></div>';
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
      else if(u.status === 'approved') statusBadge = '<span class="status-badge on"><i class="fas fa-circle-check"></i> مشترك</span>';
      else if(u.status === 'pending') statusBadge = '<span class="status-badge pending"><i class="fas fa-clock"></i> معلّق</span>';
      else statusBadge = '<span class="status-badge off"><i class="fas fa-ban"></i> مرفوض</span>';

      const avStyle = u.avatar_url ? `background-image:url('${u.avatar_url}')` : '';
      const pwHtml = u.password_hint
        ? `<code onclick="copyTxt('${escapeHtml(u.password_hint).replace(/'/g,'&#39;')}')" title="اضغط للنسخ" style="background:var(--bg);padding:3px 8px;border-radius:6px;font-size:.74rem;direction:ltr;display:inline-block;cursor:pointer;border:1px solid var(--border)">${escapeHtml(u.password_hint)}</code>`
        : '<span style="font-size:.72rem;color:var(--muted)">—</span>';

      /* أزرار حسب الدور */
      const isTargetOwner = u.role === 'owner';
      const isTargetAdmin = u.role === 'admin';

      let actions = '';

      if(!isTargetOwner){
        /* الأدمن والمشرف العام يمكنهم التفعيل/الرفض */
        if(u.status !== 'approved' && u.role !== 'admin'){
          actions += `<button class="btn btn-success btn-sm" onclick="approveUser('${u.id}')" title="تفعيل"><i class="fas fa-check"></i></button>`;
        }
        if(u.status !== 'rejected' && u.role !== 'admin'){
          actions += `<button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')" title="رفض"><i class="fas fa-ban"></i></button>`;
        }

        /* زر التعديل: owner يمكنه تعديل الكل، admin لا يعدل admins آخرين */
        if(isOwner || !isTargetAdmin){
          actions += `<button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')" title="تعديل بيانات"><i class="fas fa-pen"></i></button>`;
        }

        /* إعادة تعيين كلمة المرور بالبريد */
        if(isOwner || !isTargetAdmin){
          actions += `<button class="btn btn-ghost btn-sm" onclick="resetUserPassword('${u.id}')" title="إرسال رابط إعادة تعيين"><i class="fas fa-key"></i></button>`;
        }

        /* ⭐ owner فقط: ترقية إلى أدمن / تنزيل من أدمن */
        if(isOwner){
          if(u.role === 'admin'){
            actions += `<button class="btn btn-ghost btn-sm" onclick="demoteAdmin('${u.id}')" title="إزالة صلاحية الأدمن" style="background:rgba(247,179,43,.15);color:#d97706;border-color:rgba(247,179,43,.3)"><i class="fas fa-arrow-down"></i></button>`;
          } else {
            actions += `<button class="btn btn-ghost btn-sm" onclick="promoteToAdmin('${u.id}')" title="ترقية إلى أدمن" style="background:rgba(239,68,68,.12);color:#dc2626;border-color:rgba(239,68,68,.28)"><i class="fas fa-user-shield"></i></button>`;
          }
          /* owner فقط: حذف */
          actions += `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')" title="حذف نهائي"><i class="fas fa-trash"></i></button>`;
        }
      }

      return `<div class="trow">
        <div class="user-cell">
          <div class="av" style="${avStyle}">${avStyle ? '' : escapeHtml((u.name||'؟').trim().charAt(0) || '؟')}</div>
          <div class="info">
            <b>${escapeHtml(u.name || '—')}</b>
            <small>${u.created_at ? new Date(u.created_at).toLocaleDateString('ar-SA') : '—'}</small>
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

/* ============================================================
   دوال رئيس المنصة (Owner)
============================================================ */
window.promoteToAdmin = (id) => {
  if(!currentUserObj || currentUserObj.role !== 'owner'){ toast('هذه الصلاحية لرئيس المنصة فقط', 'err'); return; }
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('ترقية إلى أدمن', `ترقية «${escapeHtml(u.name)}» إلى صلاحيات أدمن كاملة؟`, async () => {
    const { error } = await sb.from('profiles').update({ role: 'admin' }).eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    u.role = 'admin';
    renderUsersTable();
    toast('✓ تم ترقية المستخدم إلى أدمن', 'ok');
  });
};

window.demoteAdmin = (id) => {
  if(!currentUserObj || currentUserObj.role !== 'owner'){ toast('هذه الصلاحية لرئيس المنصة فقط', 'err'); return; }
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('إزالة صلاحية الأدمن', `إزالة صلاحيات الأدمن من «${escapeHtml(u.name)}»؟`, async () => {
    const { error } = await sb.from('profiles').update({ role: 'user' }).eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    u.role = 'user';
    renderUsersTable();
    toast('تمت إزالة صلاحية الأدمن', 'warn');
  }, true);
};
window.copyTxt = t => { try{ navigator.clipboard.writeText(t); toast('نُسخت كلمة السر', 'ok'); }catch(e){} };

window.approveUser = async id => {
  const { error } = await sb.from('profiles').update({ status:'approved' }).eq('id', id);
  if(error){ toast('فشل التحديث: ' + error.message, 'err'); return; }
  toast('تم تفعيل الاشتراك', 'ok');
};
window.rejectUser = async id => {
  const { error } = await sb.from('profiles').update({ status:'rejected' }).eq('id', id);
  if(error){ toast('فشل التحديث: ' + error.message, 'err'); return; }
  toast('تم رفض المستخدم', 'warn');
};

/* ============================================================
   ⭐ تعديل المستخدم + تغيير كلمة السر (مع Fallback ذكي)
============================================================ */
window.editUser = id => {
  const u = DB.users.find(x => x.id === id); if(!u) return;
  const isOwner = currentUserObj && currentUserObj.role === 'owner';
  const isTargetAdmin = u.role === 'admin';

  /* الأدمن لا يعدل admins آخرين */
  if(!isOwner && isTargetAdmin){
    toast('لا تملك صلاحية تعديل الأدمنز', 'err');
    return;
  }

  openModal({
    title: 'تعديل المستخدم',
    text: isOwner
      ? 'رئيس المنصة يمكنه تعديل كل شيء: الاسم، البريد، كلمة المرور، الدور.'
      : 'عدّل البيانات الأساسية. تغيير كلمة السر يتم عبر خدمة آمنة.',
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

      ${isOwner && !isTargetAdmin ? `
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
      ` : ''}

      <div id="euStatusBar" style="display:none;padding:10px 12px;border-radius:10px;font-size:.78rem;font-weight:700;text-align:center;margin-top:8px"></div>
    `,
    okText: 'حفظ',
    onOk: async () => {
      const newPw = document.getElementById('euPw').value.trim();
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

      const statusEl = document.getElementById('euStatus');
      if(statusEl) upd.status = statusEl.value;

      const roleEl = document.getElementById('euRole');
      if(roleEl) upd.role = roleEl.value;

      const { error } = await sb.from('profiles').update(upd).eq('id', id);
      if(error){ showBar('err', '<i class="fas fa-circle-xmark"></i> فشل التحديث: ' + error.message); return; }

      /* تغيير كلمة المرور */
      if(newPw && newPw !== u.password_hint){
        if(newPw.length < 8){ showBar('err', '<i class="fas fa-circle-xmark"></i> كلمة المرور 8 أحرف على الأقل'); return; }
        showBar('warn', '<i class="fas fa-spinner fa-spin"></i> جاري تحديث كلمة المرور...');

        let success = false;
        try{
          const { data: { session: curSess } } = await sb.auth.getSession();
          const res = await fetch(CHANGE_PASS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (curSess ? curSess.access_token : '') },
            body: JSON.stringify({ userId: id, newPassword: newPw })
          });
          if(res.ok){ const r = await res.json(); if(r && r.success) success = true; }
        }catch(e){}

        if(success){
          try{ await sb.from('profiles').update({ password_hint: newPw }).eq('id', id); }catch(e){}
          upd.password_hint = newPw;
          Object.assign(u, upd);
          renderUsersTable();
          showBar('ok', '<i class="fas fa-circle-check"></i> ✅ تم التحديث وكلمة المرور مباشرة');
          toast('✓ تم تغيير كلمة المرور', 'ok');
          setTimeout(() => { const m = $('#modal'); if(m) m.classList.remove('open'); }, 1500);
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
          setTimeout(() => { const m = $('#modal'); if(m) m.classList.remove('open'); }, 2000);
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
      toast('تم إرسال رابط إعادة التعيين', 'ok');
    }catch(e){ toast('خطأ: ' + e.message, 'err'); }
  });
};

window.deleteUser = id => {
  const u = DB.users.find(x => x.id === id); if(!u) return;
  confirmBox('حذف المستخدم', `سيتم حذف الحساب «${escapeHtml(u.name)}» (${escapeHtml(u.email)}) نهائيًا مع كل تقدمه. متأكد؟`, async () => {
    try{ await sb.from('user_progress').delete().eq('user_id', id); }catch(e){}
    try{ await sb.from('user_drawings').delete().eq('user_id', id); }catch(e){}
    const { error } = await sb.from('profiles').delete().eq('id', id);
    if(error){ toast('فشل الحذف: ' + error.message, 'err'); return; }
    DB.users = DB.users.filter(x => x.id !== id);
    renderUsersTable(); renderAdmin();
    toast('تم حذف المستخدم', 'ok');
  }, true);
};

$('#userSearch').addEventListener('input', renderUsersTable);
$('#userFilter').addEventListener('change', renderUsersTable);

function renderAdminFiles(){
  const box = $('#adminFilesGrid'); if(!box) return;
  if(!DB.files.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-inbox"></i></div><h3>لا توجد ملفات</h3><p>اذهب لتبويب «إضافة ملف» لرفع أول ملف PDF</p></div>';
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
        <span>${f.created_at ? new Date(f.created_at).toLocaleDateString('ar-SA') : ''}</span>
      </div>
      <div class="afc-actions">
        <button class="btn btn-ghost btn-sm" onclick="toggleImportant('${f.id}')"><i class="fas fa-star"></i> ${f.important ? 'إلغاء' : 'تمييز'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteFile('${f.id}','${escapeHtml(f.storage_path)}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
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
    toast('تم حذف الملف', 'ok');
  }, true);
};

let currentPdfBlob = null;
const uploadZone = $('#uploadZone');
const afPdfInput = $('#afPdfInput');
if(uploadZone && afPdfInput){
  uploadZone.addEventListener('click', () => afPdfInput.click());
  ['dragenter','dragover'].forEach(ev => { uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.add('dragover'); }); });
  ['dragleave','drop'].forEach(ev => { uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.remove('dragover'); }); });
  uploadZone.addEventListener('drop', e => { const file = e.dataTransfer && e.dataTransfer.files[0]; if(file) handlePdfFile(file); });
  afPdfInput.addEventListener('change', e => { const file = e.target.files[0]; if(file) handlePdfFile(file); });
}
async function handlePdfFile(file){
  if(file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')){ toast('الرجاء اختيار ملف PDF فقط', 'warn'); return; }
  if(file.size > 100 * 1024 * 1024){ toast('حجم الملف كبير جداً (الحد 100 ميجا)', 'warn'); return; }
  currentPdfBlob = file;
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  let pages = '?';
  try{
    const ab = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: ab }).promise;
    pages = doc.numPages;
    try{ doc.destroy(); }catch(e){}
  }catch(e){}
  $('#uzFileInfo').innerHTML = `<div class="uz-file"><i class="fas fa-circle-check"></i> ${escapeHtml(file.name)} — ${sizeMB} ميجا${pages !== '?' ? ` — ${pages} صفحة` : ''}</div>`;
  if(!$('#afTitle').value) $('#afTitle').value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g,' ');
}
$('#clearFileBtn').addEventListener('click', () => {
  $('#afTitle').value = ''; $('#afCat').value = 'كمي'; $('#afDesc').value = ''; $('#afImportant').checked = false;
  $('#uzFileInfo').innerHTML = ''; if(afPdfInput) afPdfInput.value = ''; currentPdfBlob = null;
});
$('#saveFileBtn').addEventListener('click', async () => {
  if(!currentUserObj || currentUserObj.role !== 'admin'){ toast('غير مصرح', 'err'); return; }
  const btn = $('#saveFileBtn');
  const title = $('#afTitle').value.trim();
  const cat = $('#afCat').value;
  const desc = $('#afDesc').value.trim();
  const important = $('#afImportant').checked;
  if(!title){ toast('أدخل عنوان الملف', 'warn'); return; }
  if(!currentPdfBlob){ toast('اختر ملف PDF أولاً', 'warn'); return; }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';
  const id = uuidv4();
  const safeName = currentPdfBlob.name.replace(/[^\w.\-]+/g,'_').slice(0,80);
  const storagePath = currentUserObj.id + '/' + id + '_' + safeName;
  let pages = 0;
  try{ const ab = await currentPdfBlob.arrayBuffer(); const doc = await pdfjsLib.getDocument({ data: ab }).promise; pages = doc.numPages; try{ doc.destroy(); }catch(e){} }catch(e){}
  const { error: upErr } = await sb.storage.from('pdfs').upload(storagePath, currentPdfBlob, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });
  if(upErr){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> حفظ الملف'; toast('فشل رفع الملف: ' + upErr.message, 'err'); return; }
  const choice = pick(ICONS);
  const { error: dbErr } = await sb.from('files').insert({
    id: id, title, category: cat, description: desc, important,
    icon: choice.i, color: choice.c, page_count: pages,
    storage_path: storagePath, created_by: currentUserObj.id
  });
  if(dbErr){
    try{ await sb.storage.from('pdfs').remove([storagePath]); }catch(e){}
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> حفظ الملف';
    toast('فشل حفظ البيانات: ' + dbErr.message, 'err'); return;
  }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> حفظ الملف';
  $('#afTitle').value = ''; $('#afCat').value = 'كمي'; $('#afDesc').value = ''; $('#afImportant').checked = false;
  $('#uzFileInfo').innerHTML = ''; if(afPdfInput) afPdfInput.value = ''; currentPdfBlob = null;
  toast('تم رفع الملف بنجاح', 'ok');
  $$('.admin-tabs button').forEach(b => b.classList.remove('on'));
  $$('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="files"]');
  if(tab) tab.classList.add('on');
  $('#panel-files').classList.add('on');
});

$$('.admin-tabs button').forEach(b => {
  b.addEventListener('click', () => {
    $$('.admin-tabs button').forEach(x => x.classList.remove('on'));
    $$('.admin-panel').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const panel = document.getElementById('panel-' + b.dataset.panel);
    if(panel) panel.classList.add('on');
  });
});

(function bindAdminCreateUser(){
  const btn = document.getElementById('nuCreateBtn'); if(!btn) return;
  btn.addEventListener('click', async () => {
    if(!currentUserObj || currentUserObj.role !== 'admin'){ toast('غير مصرح', 'err'); return; }
    const name = $('#nuName').value.trim();
    const email = $('#nuEmail').value.trim().toLowerCase();
    const pass = $('#nuPass').value;
    const approve = $('#nuApprove').checked;
    if(!name || name.length < 2){ toast('أدخل اسماً صحيحاً', 'warn'); return; }
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('أدخل بريداً صحيحاً', 'warn'); return; }
    if(!pass || pass.length < 8){ toast('كلمة المرور 8 أحرف على الأقل', 'warn'); return; }
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
    try{
      const { data, error } = await sbTemp.auth.signUp({ email, password: pass, options: { data: { name } } });
      if(error){ toast('فشل الإنشاء: ' + error.message, 'err'); btn.disabled = false; btn.innerHTML = orig; return; }
      if(data && data.user){
        await new Promise(r => setTimeout(r, 800));
        const upd = { name, password_hint: pass };
        if(approve) upd.status = 'approved';
        const { error: upErr } = await sb.from('profiles').update(upd).eq('id', data.user.id);
        if(upErr) console.warn('auto update failed', upErr);
      }
      toast('تم إنشاء الحساب بنجاح', 'ok');
      $('#nuName').value = ''; $('#nuEmail').value = '';
      try{
        const { data: usersData } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        DB.users = (usersData || []).filter(u => u.role !== 'admin');
        renderAdmin();
      }catch(e){}
    }catch(e){ toast('خطأ: ' + e.message, 'err'); }
    btn.disabled = false; btn.innerHTML = orig;
  });
  const clr = document.getElementById('nuClearBtn');
  if(clr) clr.addEventListener('click', () => { $('#nuName').value = ''; $('#nuEmail').value = ''; $('#nuPass').value = '123456'; $('#nuApprove').checked = true; });
})();

/* ============================================================
   إدارة الفيديوهات في لوحة الأدمن
============================================================ */

function renderAdminVideos(){
  const box = $('#adminVideosGrid'); if(!box) return;
  const list = DB.videos || [];
  if(!list.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-video"></i></div><h3>لا توجد فيديوهات</h3><p>اذهب لتبويب «إضافة فيديو» لإضافة أول فيديو</p></div>';
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

window.toggleVideoImportant = async id => {
  const v = (DB.videos || []).find(x => x.id === id); if(!v) return;
  const { error } = await sb.from('videos').update({ important: !v.important }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  toast(v.important ? 'أُزيل التمييز' : 'أصبح الفيديو مميزاً', 'ok');
};

window.deleteVideo = id => {
  const v = (DB.videos || []).find(x => x.id === id); if(!v) return;
  confirmBox('حذف الفيديو', `حذف «${escapeHtml(v.title)}»؟`, async () => {
    const { error } = await sb.from('videos').delete().eq('id', id);
    if(error){ toast('فشل الحذف: ' + error.message, 'err'); return; }
    toast('تم حذف الفيديو', 'ok');
  }, true);
};

window.linkVideoToFile = (videoId) => {
  const v = (DB.videos || []).find(x => x.id === videoId); if(!v) return;
  const list = DB.files || [];
  if(!list.length){ toast('لا توجد ملفات لربطها', 'warn'); return; }
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
  $('#modal').classList.remove('open');
  toast('تم ربط الفيديو بالملف ✓', 'ok');
  if(typeof renderAdminFiles === 'function') renderAdminFiles();
  if(typeof renderFiles === 'function') renderFiles();
};

/* زر حفظ الفيديو */
const _svBtn = document.getElementById('saveVideoBtn');
if(_svBtn){
  _svBtn.addEventListener('click', async () => {
    if(!currentUserObj || currentUserObj.role !== 'admin'){ toast('غير مصرح', 'err'); return; }
    const url = $('#avUrl').value.trim();
    const title = $('#avTitle').value.trim();
    const cat = $('#avCat').value;
    const desc = $('#avDesc').value.trim();
    const important = $('#avImportant').checked;
    const ytId = extractYoutubeId(url);
    if(!ytId){ toast('رابط يوتيوب غير صالح', 'err'); return; }
    if(!title){ toast('أدخل عنوان الفيديو', 'warn'); return; }

    const btn = $('#saveVideoBtn');
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
    if(error){ toast('فشل الحفظ: ' + error.message, 'err'); return; }

    $('#avUrl').value = ''; $('#avTitle').value = ''; $('#avDesc').value = ''; $('#avImportant').checked = false;
    $('#avUrlPreview').style.display = 'none';
    toast('تم إضافة الفيديو بنجاح ✓', 'ok');

    document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
    const tab = document.querySelector('.admin-tabs button[data-panel="videos"]');
    if(tab) tab.classList.add('on');
    const p = $('#panel-videos'); if(p) p.classList.add('on');
    if(typeof loadVideos === 'function') loadVideos();
  });
}

/* زر المسح */
const _cvBtn = document.getElementById('clearVideoBtn');
if(_cvBtn){
  _cvBtn.addEventListener('click', () => {
    $('#avUrl').value = ''; $('#avTitle').value = ''; $('#avDesc').value = ''; $('#avImportant').checked = false;
    $('#avUrlPreview').style.display = 'none';
  });
}

/* معاينة الرابط */
const _avUrl = document.getElementById('avUrl');
if(_avUrl){
  _avUrl.addEventListener('input', e => {
    const ytId = extractYoutubeId(e.target.value);
    const prev = $('#avUrlPreview');
    const txt = $('#avUrlPreviewText');
    if(ytId){
      prev.style.display = 'block';
      txt.textContent = 'معرف الفيديو: ' + ytId;
    } else {
      prev.style.display = 'none';
    }
  });
}

/* ============================================================
   عرض الإيصال (المودال)
============================================================ */
window.viewReceipt = (url) => {
  if(!url) return;
  openModal({
    title: '🧾 إيصال التحويل',
    text: 'رابط صورة الإيصال المرفقة من المستخدم.',
    bodyHTML: `
      <div style="text-align:center;margin-bottom:12px">
        <img src="${escapeHtml(url)}" alt="الإيصال" style="max-width:100%;max-height:60vh;border-radius:12px;border:1px solid var(--border);background:#fff" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <p style="display:none;color:var(--danger);font-weight:700;font-size:.84rem">تعذّر تحميل الصورة — الرابط قد يكون منتهياً</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${escapeHtml(url)}" target="_blank" class="btn btn-primary" style="flex:1;text-decoration:none;justify-content:center">
          <i class="fas fa-external-link-alt"></i> فتح في نافذة جديدة
        </a>
        <button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${escapeHtml(url).replace(/'/g,'&#39;')}');toast('نُسخ الرابط','ok')">
          <i class="fas fa-copy"></i> نسخ الرابط
        </button>
      </div>
    `,
    okText: 'إغلاق',
    onOk: () => {}
  });
};
