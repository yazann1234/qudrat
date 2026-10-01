/* ============================================================
   16) USER — الملف الشخصي + الصورة + قائمة الجوال
============================================================ */

function applyUserUI(){
  if(!currentUserObj) return;
  try{
    const nm = currentUserObj.name || '—';
    const init = String(nm).trim().charAt(0) || '؟';
    const av = typeof avatarStyleFor === 'function' ? avatarStyleFor(currentUserObj) : '';

    const ua = document.getElementById('userAvatar');
    if(ua){ ua.textContent = av ? '' : init; ua.style.cssText = av; }

    let badgeHTML = '';
    if(currentUserObj.role === 'admin'){
      badgeHTML = ' <span class="sub-badge admin"><i class="fas fa-shield-halved"></i> أدمن</span>';
    } else if(currentUserObj.status === 'approved'){
      badgeHTML = ' <span class="sub-badge"><i class="fas fa-circle-check"></i> مشترك</span>';
    } else if(currentUserObj.status === 'pending'){
      badgeHTML = ' <span class="sub-badge pending"><i class="fas fa-clock"></i> معلّق</span>';
    }

    const un = document.getElementById('userName'); if(un) un.innerHTML = escapeHtml(nm) + badgeHTML;
    const ue = document.getElementById('userEmail'); if(ue) ue.textContent = currentUserObj.email || '';
    const sn = document.getElementById('setName'); if(sn) sn.textContent = currentUserObj.name || '—';
    const se = document.getElementById('setEmail'); if(se) se.textContent = currentUserObj.email || '';

    const ss = document.getElementById('setSub');
    if(ss){
      ss.innerHTML = currentUserObj.role === 'admin'
        ? '<span style="color:var(--danger)"><i class="fas fa-shield-halved"></i> أدمن</span>'
        : currentUserObj.status === 'approved'
          ? '<span style="color:var(--success)"><i class="fas fa-circle-check"></i> مشترك</span>'
          : currentUserObj.status === 'pending'
            ? '<span style="color:var(--accent)"><i class="fas fa-clock"></i> قيد المراجعة</span>'
            : '<span style="color:var(--danger)"><i class="fas fa-ban"></i> مرفوض</span>';
    }

    const adminNav = document.getElementById('adminNav');
    if(adminNav) adminNav.style.display = currentUserObj.role === 'admin' ? 'flex' : 'none';

    /* احفظ كلمة المرور محلياً إن كانت متوفرة */
    try{
      if(currentUserObj.password_hint && currentUserObj.id){
        if(!sessionStorage.getItem('pending_pass_' + currentUserObj.id)){
          sessionStorage.setItem('pending_pass_' + currentUserObj.id, currentUserObj.password_hint);
        }
      }
    }catch(e){}

    if(typeof updateMobileUserMenu === 'function') updateMobileUserMenu();
  }catch(e){ console.warn('applyUserUI error:', e); }
}
window.applyUserUI = applyUserUI;

/* ============================================================
   قائمة الجوال
============================================================ */
function updateMobileUserMenu(){
  if(!currentUserObj) return;
  try{
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
  }catch(e){ console.warn('updateMobileUserMenu error:', e); }
}
window.updateMobileUserMenu = updateMobileUserMenu;

/* ============================================================
   الملف الشخصي
============================================================ */
function renderProfile(){
  if(!currentUserObj) return;
  try{
    const s = typeof myStats === 'function' ? myStats() : { pages:0, completed:0, sessions:0, badges:0, xp:0 };
    const av = typeof avatarStyleFor === 'function' ? avatarStyleFor(currentUserObj) : '';

    const avEl = document.getElementById('profileAvatar');
    if(avEl) avEl.style.cssText = av;

    const avTxt = document.getElementById('profileAvatarText');
    if(avTxt) avTxt.textContent = av ? '' : (String(currentUserObj.name || '؟').charAt(0) || '؟');

    const nm = document.getElementById('profileNameBig'); if(nm) nm.textContent = currentUserObj.name || '—';
    const em = document.getElementById('profileEmailSmall'); if(em) em.textContent = currentUserObj.email || '';

    const ni = document.getElementById('profileNameInput');
    if(ni && document.activeElement !== ni) ni.value = currentUserObj.name || '';
    const ei = document.getElementById('profileEmailInput'); if(ei) ei.value = currentUserObj.email || '';

    const f = document.getElementById('pStatFiles'); if(f) f.textContent = s.completed || 0;
    const ss = document.getElementById('pStatSessions'); if(ss) ss.textContent = s.sessions || 0;
    const b = document.getElementById('pStatBadges'); if(b) b.textContent = s.badges || 0;

    const xp = document.getElementById('pXp'); if(xp) xp.textContent = s.xp || 0;
    const xpP = document.getElementById('pXpPages'); if(xpP) xpP.textContent = s.pages || 0;
    const xpF = document.getElementById('pXpFiles'); if(xpF) xpF.textContent = s.completed || 0;
    const xpS = document.getElementById('pXpSessions'); if(xpS) xpS.textContent = s.sessions || 0;

    const badgesRow = document.getElementById('profileBadgesRow');
    if(badgesRow && typeof BADGES !== 'undefined'){
      const owned = BADGES.filter(bd => (userData.badges || []).includes(bd.id)).slice(0, 4);
      badgesRow.innerHTML = owned.length
        ? owned.map(bd => `<div class="badge-item on" style="padding:7px 12px"><div class="bi" style="font-size:1rem"><i class="fas ${bd.i}"></i></div><div><b style="font-size:.74rem">${bd.t}</b></div></div>`).join('')
        : '<span style="font-size:.78rem;color:var(--muted);font-weight:600">لا توجد شارات بعد</span>';
    }

    if(typeof renderBadges === 'function') renderBadges();
  }catch(e){ console.warn('renderProfile error:', e); }
}
window.renderProfile = renderProfile;

/* ============================================================
   رفع الصورة
============================================================ */
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
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
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
  if(file.size > 5 * 1024 * 1024){ toast('حجم الصورة كبير (5 ميجا)', 'warn'); return; }
  try{
    const blob = await resizeImageToBlob(file, 400, 0.85);
    const path = currentUserObj.id + '/avatar_' + Date.now() + '.jpg';
    const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
      cacheControl: '3600', upsert: true, contentType: 'image/jpeg'
    });
    if(upErr){ toast('فشل الرفع: ' + upErr.message, 'err'); return; }
    const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
    const url = urlData && urlData.publicUrl ? urlData.publicUrl + '?t=' + Date.now() : '';
    const { error: dbErr } = await sb.from('profiles').update({ avatar_url: url }).eq('id', currentUserObj.id);
    if(dbErr){ toast('فشل الحفظ: ' + dbErr.message, 'err'); return; }
    currentUserObj.avatar_url = url;
    applyUserUI(); renderProfile();
    toast('✓ تم تحديث الصورة', 'ok');
  }catch(e){ toast('خطأ: ' + e.message, 'err'); }
}

async function removeAvatar(){
  if(!currentUserObj) return;
  confirmBox('حذف الصورة', 'هل تريد حذف صورتك الشخصية؟', async () => {
    try{ await sb.from('profiles').update({ avatar_url: null }).eq('id', currentUserObj.id); }catch(e){}
    currentUserObj.avatar_url = null;
    applyUserUI(); renderProfile();
    toast('تم حذف الصورة', 'ok');
  }, true);
}

async function saveProfile(){
  if(!currentUserObj) return;
  const name = document.getElementById('profileNameInput').value.trim();
  if(!name || name.length < 2){ toast('أدخل اسماً صحيحاً', 'warn'); return; }
  const btn = document.getElementById('profileSaveBtn');
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  const { error } = await sb.from('profiles').update({ name }).eq('id', currentUserObj.id);
  btn.disabled = false; btn.innerHTML = orig;
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  currentUserObj.name = name;
  applyUserUI(); renderProfile();
  toast('✓ تم حفظ التعديلات', 'ok');
}

/* ============================================================
   أحداث
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const cam = document.getElementById('profileCamBtn'); if(cam) cam.addEventListener('click', () => document.getElementById('avatarInput').click());
  const pav = document.getElementById('profileAvatar'); if(pav) pav.addEventListener('click', () => document.getElementById('avatarInput').click());
  const ai = document.getElementById('avatarInput');
  if(ai) ai.addEventListener('change', e => { const f = e.target.files[0]; if(f) uploadAvatar(f); e.target.value = ''; });
  const psb = document.getElementById('profileSaveBtn'); if(psb) psb.addEventListener('click', saveProfile);
  const pra = document.getElementById('profileRemoveAvatar'); if(pra) pra.addEventListener('click', removeAvatar);
});

/* ============================================================
   قائمة الجوال — الأحداث (بـ Delegation)
============================================================ */
document.addEventListener('click', (e) => {
  if(e.target.closest('#mobileUserBtn')){
    e.stopPropagation();
    const menu = document.getElementById('mobileUserMenu');
    if(menu) menu.classList.toggle('open');
    return;
  }
  const menu = document.getElementById('mobileUserMenu');
  if(menu && menu.classList.contains('open')){
    if(!e.target.closest('#mobileUserMenu')){
      menu.classList.remove('open');
    }
  }
});
