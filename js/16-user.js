/* ============================================================
   16) USER — الملف الشخصي + الصورة + قائمة الجوال
============================================================ */

function applyUserUI(){
  if(!currentUserObj) return;
  const nm = currentUserObj.name || '—';
  const init = String(nm).trim().charAt(0) || '؟';
  const av = avatarStyleFor(currentUserObj);
  const ua = $('#userAvatar');
  if(ua){ ua.textContent = av ? '' : init; ua.style.cssText = av; }
  let badgeHTML = '';
  if(currentUserObj.role === 'admin') badgeHTML = ' <span class="sub-badge admin"><i class="fas fa-shield-halved"></i> أدمن</span>';
  else if(currentUserObj.status === 'approved') badgeHTML = ' <span class="sub-badge"><i class="fas fa-circle-check"></i> مشترك</span>';
  else if(currentUserObj.status === 'pending') badgeHTML = ' <span class="sub-badge pending"><i class="fas fa-clock"></i> معلّق</span>';
  $('#userName').innerHTML = escapeHtml(nm) + badgeHTML;
  $('#userEmail').textContent = currentUserObj.email;
  $('#setName').textContent = currentUserObj.name;
  $('#setEmail').textContent = currentUserObj.email;
  $('#setSub').innerHTML = currentUserObj.role === 'admin'
    ? '<span style="color:var(--danger)"><i class="fas fa-shield-halved"></i> أدمن</span>'
    : currentUserObj.status === 'approved'
      ? '<span style="color:var(--success)"><i class="fas fa-circle-check"></i> مشترك</span>'
      : currentUserObj.status === 'pending'
        ? '<span style="color:var(--accent)"><i class="fas fa-clock"></i> قيد المراجعة</span>'
        : '<span style="color:var(--danger)"><i class="fas fa-ban"></i> مرفوض</span>';
  const adminNav = $('#adminNav');
  if(adminNav){
    if(currentUserObj.role === 'admin') adminNav.style.display = 'flex';
    else adminNav.style.display = 'none';
  }
  updateMobileUserMenu();
}

function updateMobileUserMenu(){
  if(!currentUserObj) return;
  const nm = currentUserObj.name || '—';
  const init = String(nm).trim().charAt(0) || '؟';
  const av = currentUserObj.avatar_url || '';
  const avEl = document.getElementById('mumAvatar');
  const mb = document.getElementById('mobileUserAvatar');
  const dot = document.getElementById('mobileUserDot');
  if(avEl){ avEl.textContent = av ? '' : init; avEl.style.cssText = av ? `background-image:url('${av}')` : ''; }
  if(mb){ mb.textContent = av ? '' : init; mb.style.backgroundImage = av ? `url('${av}')` : ''; }
  const nm2 = document.getElementById('mumName'); if(nm2) nm2.textContent = nm;
  const em = document.getElementById('mumEmail'); if(em) em.textContent = currentUserObj.email || '';
  let badge = '';
  if(currentUserObj.role === 'admin') badge = '<span class="sub-badge admin"><i class="fas fa-shield-halved"></i> أدمن</span>';
  else if(currentUserObj.status === 'approved') badge = '<span class="sub-badge"><i class="fas fa-circle-check"></i> مشترك</span>';
  else if(currentUserObj.status === 'pending') badge = '<span class="sub-badge pending"><i class="fas fa-clock"></i> قيد المراجعة</span>';
  else badge = '<span class="sub-badge" style="background:linear-gradient(120deg,#ef4444,#dc2626)"><i class="fas fa-ban"></i> غير مفعّل</span>';
  const bd = document.getElementById('mumBadge'); if(bd) bd.innerHTML = badge;
  if(dot){
    dot.classList.remove('pending','off');
    if(currentUserObj.role === 'admin' || currentUserObj.status === 'approved'){ }
    else if(currentUserObj.status === 'pending') dot.classList.add('pending');
    else dot.classList.add('off');
  }
}

$('#logoutBtn').addEventListener('click', () => {
  confirmBox('تسجيل الخروج', 'هل تريد تسجيل الخروج من حسابك؟', async () => {
    savePrefs(); saveDrawings(); flushProgressSync();
    cleanupChannels();
    await sb.auth.signOut();
    currentUserObj = null;
    DB = { users: [], files: [] };
    closeReader();
    $('#app').classList.remove('open');
    const w = $('#welcome');
    w.style.display = 'flex'; w.classList.remove('exit');
    ['loginEmail','loginPass','adminEmail','adminPass'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    ['loginMsg','adminMsg'].forEach(id => { const el = document.getElementById(id); if(el){ el.className = 'auth-msg'; el.textContent = ''; } });
    const mum = $('#mobileUserMenu'); if(mum) mum.classList.remove('open');
    showAuthForm('login');
    showAuth();
  });
});

$('#mobileUserBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('#mobileUserMenu');
  menu.classList.toggle('open');
});
document.addEventListener('click', e => {
  const menu = $('#mobileUserMenu');
  if(!menu || !menu.classList.contains('open')) return;
  if(e.target.closest('#mobileUserMenu') || e.target.closest('#mobileUserBtn')) return;
  menu.classList.remove('open');
});
$('#mumProfile').addEventListener('click', () => { $('#mobileUserMenu').classList.remove('open'); go('profile'); });
$('#mumSettings').addEventListener('click', () => { $('#mobileUserMenu').classList.remove('open'); go('settings'); });
$('#mumLogout').addEventListener('click', () => { $('#mobileUserMenu').classList.remove('open'); $('#logoutBtn').click(); });

/* ===== الملف الشخصي ===== */
function renderProfile(){
  if(!currentUserObj) return;
  const s = myStats();
  const av = avatarStyleFor(currentUserObj);
  const avEl = $('#profileAvatar');
  if(avEl){ avEl.style.cssText = av; }
  const avTxt = $('#profileAvatarText');
  if(avTxt) avTxt.textContent = av ? '' : avatarInitialFor(currentUserObj);
  const nm = $('#profileNameBig'); if(nm) nm.textContent = currentUserObj.name || '—';
  const em = $('#profileEmailSmall'); if(em) em.textContent = currentUserObj.email || '';
  const ni = $('#profileNameInput'); if(ni && document.activeElement !== ni) ni.value = currentUserObj.name || '';
  const ei = $('#profileEmailInput'); if(ei) ei.value = currentUserObj.email || '';
  const f = $('#pStatFiles'); if(f) f.textContent = s.completed;
  const ss = $('#pStatSessions'); if(ss) ss.textContent = s.sessions;
  const b = $('#pStatBadges'); if(b) b.textContent = s.badges;
  const xp = $('#pXp'); if(xp) xp.textContent = s.xp;
  const xpP = $('#pXpPages'); if(xpP) xpP.textContent = s.pages;
  const xpF = $('#pXpFiles'); if(xpF) xpF.textContent = s.completed;
  const xpS = $('#pXpSessions'); if(xpS) xpS.textContent = s.sessions;
  const badgesRow = $('#profileBadgesRow');
  if(badgesRow){
    const owned = BADGES.filter(bd => userData.badges.includes(bd.id)).slice(0, 4);
    badgesRow.innerHTML = owned.length
      ? owned.map(bd => `<div class="badge-item on" style="padding:7px 12px"><div class="bi" style="font-size:1rem"><i class="fas ${bd.i}"></i></div><div><b style="font-size:.74rem">${bd.t}</b></div></div>`).join('')
      : '<span style="font-size:.78rem;color:var(--muted);font-weight:600">لا توجد شارات بعد — ابدأ المذاكرة!</span>';
  }
  renderBadges();
}

async function resizeImageToBlob(file, maxSize, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality || 0.85);
      };
      img.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('تعذّر فتح الملف'));
    reader.readAsDataURL(file);
  });
}

async function uploadAvatar(file){
  if(!file) return;
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  if(!file.type.startsWith('image/')){ toast('اختر صورة صحيحة', 'warn'); return; }
  if(file.size > 5 * 1024 * 1024){ toast('حجم الصورة كبير (الحد 5 ميجا)', 'warn'); return; }
  try{
    const blob = await resizeImageToBlob(file, 400, 0.85);
    const path = currentUserObj.id + '/avatar_' + Date.now() + '.jpg';
    const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
      cacheControl: '3600', upsert: true, contentType: 'image/jpeg'
    });
    if(upErr){ toast('فشل رفع الصورة: ' + upErr.message, 'err'); return; }
    try{
      const { data: list } = await sb.storage.from('avatars').list(currentUserObj.id);
      if(list && list.length){
        const olds = list.filter(f => f.name !== path.split('/').pop()).map(f => currentUserObj.id + '/' + f.name);
        if(olds.length) await sb.storage.from('avatars').remove(olds);
      }
    }catch(e){}
    const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
    const url = urlData && urlData.publicUrl ? urlData.publicUrl + '?t=' + Date.now() : '';
    const { error: dbErr } = await sb.from('profiles').update({ avatar_url: url }).eq('id', currentUserObj.id);
    if(dbErr){ toast('فشل حفظ الرابط: ' + dbErr.message, 'err'); return; }
    currentUserObj.avatar_url = url;
    applyUserUI(); renderProfile();
    try{ updateMobileUserMenu(); }catch(e){}
    toast('تم تحديث الصورة بنجاح ✓', 'ok');
  }catch(e){
    console.error(e);
    toast('خطأ: ' + (e.message || 'غير معروف'), 'err');
  }
}

async function removeAvatar(){
  if(!currentUserObj) return;
  confirmBox('حذف الصورة', 'هل تريد حذف صورتك الشخصية؟', async () => {
    try{
      const { data: list } = await sb.storage.from('avatars').list(currentUserObj.id);
      if(list && list.length){
        const paths = list.map(f => currentUserObj.id + '/' + f.name);
        await sb.storage.from('avatars').remove(paths);
      }
    }catch(e){}
    try{ await sb.from('profiles').update({ avatar_url: null }).eq('id', currentUserObj.id); }catch(e){}
    currentUserObj.avatar_url = null;
    applyUserUI(); renderProfile();
    try{ updateMobileUserMenu(); }catch(e){}
    toast('تم حذف الصورة', 'ok');
  }, true);
}

async function saveProfile(){
  if(!currentUserObj) return;
  const name = $('#profileNameInput').value.trim();
  if(!name || name.length < 2){ toast('أدخل اسماً صحيحاً (حرفان على الأقل)', 'warn'); return; }
  const btn = $('#profileSaveBtn');
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  const { error } = await sb.from('profiles').update({ name }).eq('id', currentUserObj.id);
  btn.disabled = false;
  btn.innerHTML = orig;
  if(error){ toast('فشل الحفظ: ' + error.message, 'err'); return; }
  currentUserObj.name = name;
  applyUserUI(); renderProfile();
  toast('تم حفظ التعديلات', 'ok');
}

$('#profileCamBtn').addEventListener('click', () => $('#avatarInput').click());
$('#profileAvatar').addEventListener('click', () => $('#avatarInput').click());
$('#avatarInput').addEventListener('change', e => {
  const f = e.target.files[0];
  if(f) uploadAvatar(f);
  e.target.value = '';
});
$('#profileSaveBtn').addEventListener('click', saveProfile);
$('#profileRemoveAvatar').addEventListener('click', removeAvatar);
