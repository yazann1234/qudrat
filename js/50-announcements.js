/* ============================================================
   50) ANNOUNCEMENTS — قناة الإعلانات 📢
   - صفحة «الإعلانات»: كل إعلانات المنصة في مكان واحد
   - الأدمن ينشر إعلان (عنوان + نص + صورة + رابط)
   - «رسالة إلزامية»: تطلع لكل الطلاب بوجههم (اللي داخل الحين واللي يدخل بعدين)
     وما تنقفل إلا بزر «قرأت ✓» — وتنحفظ في قناة الإعلانات
   - عدّاد غير المقروءة في القائمة + كم طالب قرأ كل إعلان (للأدمن)
============================================================ */

const ANN = { list: [], reads: new Set(), queue: [], showing: false, channel: null, poll: null, counts: {}, imgFile: null };

function annStaff(){ return typeof isPrivileged === 'function' && isPrivileged(); }

function annFormat(t){
  return escapeHtml(t || '')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

async function annLoad(){
  if(!currentUserObj) return [];
  const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(50);
  if(error){ console.warn('[ann]', error.message); return ANN.list; }
  ANN.list = data || [];
  const ids = ANN.list.map(a => a.id);
  if(ids.length){
    const { data: r } = await sb.from('announcement_reads').select('announcement_id').eq('user_id', currentUserObj.id).in('announcement_id', ids);
    ANN.reads = new Set((r || []).map(x => x.announcement_id));
  }
  annBadge();
  return ANN.list;
}

/* إعلانات ما قرأها الطالب (الإعلانات اللي قبل تسجيله ما تطلع له بوجهه) */
function annUnread(){
  const joined = Date.parse(currentUserObj && currentUserObj.created_at || 0) || 0;
  return ANN.list.filter(a => a.active && !ANN.reads.has(a.id) && Date.parse(a.created_at) >= joined - 86400000 * 30);
}

function annBadge(){
  const n = currentUserObj && !annStaff() ? annUnread().length : 0;
  const b = document.getElementById('annBadgeNav');
  if(b){ b.textContent = n; b.style.display = n ? '' : 'none'; }
}

async function annMarkRead(id){
  if(ANN.reads.has(id)) return;
  ANN.reads.add(id);
  try{ await sb.from('announcement_reads').insert({ announcement_id: id, user_id: currentUserObj.id }); }catch(e){}
  annBadge();
}

/* ================== 📣 الرسالة الإلزامية بوجه الطالب ================== */
function annCheckPopups(){
  if(!currentUserObj || annStaff()) return;
  if(window.__PW_RECOVERING) return;
  const pending = annUnread().filter(a => a.require_ack).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  pending.forEach(a => { if(!ANN.queue.some(q => q.id === a.id)) ANN.queue.push(a); });
  annShowNext();
}

function annShowNext(){
  if(ANN.showing || !ANN.queue.length) return;
  const a = ANN.queue.shift();
  if(ANN.reads.has(a.id)) return annShowNext();
  ANN.showing = true;
  let o = document.getElementById('annPopup');
  if(!o){
    o = document.createElement('div');
    o.id = 'annPopup';
    o.className = 'ann-overlay';
    document.body.appendChild(o);
  }
  o.innerHTML = `
    <div class="ann-pop">
      <div class="ann-pop-head"><i class="fas fa-bullhorn"></i> رسالة من إدارة المنصة ${ANN.queue.length ? `<small>(${ANN.queue.length + 1} رسائل)</small>` : ''}</div>
      ${a.image_url ? `<img class="ann-pop-img" src="${escapeHtml(a.image_url)}" alt="">` : ''}
      <div class="ann-pop-body">
        <h2>${escapeHtml(a.title)}</h2>
        <div class="ann-pop-text">${annFormat(a.body)}</div>
        ${a.link ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(a.link)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> فتح الرابط</a>` : ''}
        <small class="ann-pop-meta"><i class="fas fa-user-shield"></i> ${escapeHtml(a.author_name || 'إدارة المنصة')} • ${new Date(a.created_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long' })}</small>
      </div>
      <button class="btn btn-primary ann-ack" id="annAck"><i class="fas fa-check"></i> قرأت وفهمت</button>
    </div>`;
  o.classList.add('open');
  document.getElementById('annAck').addEventListener('click', async () => {
    o.classList.remove('open');
    await annMarkRead(a.id);
    ANN.showing = false;
    renderAnnouncements();
    setTimeout(annShowNext, 250);
  });
}

/* ================== 📢 صفحة الإعلانات ================== */
async function renderAnnouncements(){
  const box = document.getElementById('annRoot');
  if(!box) return;
  const staff = annStaff();
  if(!box.dataset.built){
    box.dataset.built = '1';
    box.innerHTML = `
      <div class="cm-hero ann-hero">
        <div class="cm-hero-ic"><i class="fas fa-bullhorn"></i></div>
        <div><h2>قناة الإعلانات</h2><p>كل أخبار وتنبيهات منصة عباقرة القدرات في مكان واحد 📌</p></div>
      </div>
      <div id="annCompose"></div>
      <div id="annList" class="ann-list"><div class="cm-loading"><i class="fas fa-spinner fa-spin"></i></div></div>`;
  }
  const comp = document.getElementById('annCompose');
  if(comp) comp.innerHTML = staff ? annComposerHTML() : '';
  await annLoad();
  if(staff){
    try{
      const { data } = await sb.rpc('announcement_read_counts');
      ANN.counts = {}; (data || []).forEach(r => { ANN.counts[r.announcement_id] = Number(r.reads) || 0; });
    }catch(e){}
  }
  const list = document.getElementById('annList');
  if(!list) return;
  const items = ANN.list.filter(a => a.active || staff);
  if(!items.length){
    list.innerHTML = '<div class="cm-empty"><i class="fas fa-bullhorn"></i><b>لا توجد إعلانات بعد</b><small>أول ما ينزل إعلان بيطلع هنا</small></div>';
    return;
  }
  list.innerHTML = items.map(a => {
    const unread = !staff && !ANN.reads.has(a.id);
    return `
      <article class="ann-card ${unread ? 'unread' : ''} ${a.active ? '' : 'off'}">
        ${a.image_url ? `<img class="ann-img" src="${escapeHtml(a.image_url)}" loading="lazy" alt="" onclick="cmLightbox && cmLightbox('${escapeHtml(a.image_url)}')">` : ''}
        <div class="ann-in">
          <div class="ann-top">
            ${unread ? '<span class="ann-new">جديد</span>' : ''}
            ${a.require_ack ? '<span class="ann-tag"><i class="fas fa-circle-exclamation"></i> رسالة مهمة</span>' : ''}
            ${!a.active ? '<span class="ann-tag off">موقوف</span>' : ''}
            <small>${new Date(a.created_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
          </div>
          <h3>${escapeHtml(a.title)}</h3>
          <div class="ann-text">${annFormat(a.body)}</div>
          <div class="ann-foot">
            <small><i class="fas fa-user-shield"></i> ${escapeHtml(a.author_name || 'إدارة المنصة')}</small>
            ${a.link ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(a.link)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> الرابط</a>` : ''}
            ${unread ? `<button class="btn btn-ghost btn-sm" onclick="annMarkRead('${a.id}').then(renderAnnouncements)"><i class="fas fa-check"></i> تم</button>` : ''}
            ${staff ? `<span class="ann-reads"><i class="fas fa-eye"></i> قرأها ${ANN.counts[a.id] || 0}</span>
              <button class="btn btn-ghost btn-sm" onclick="annToggle('${a.id}', ${!a.active})">${a.active ? '<i class="fas fa-pause"></i> إيقاف' : '<i class="fas fa-play"></i> تفعيل'}</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="annDelete('${a.id}')"><i class="fas fa-trash"></i></button>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');
  /* فتح الصفحة = قراءة الإعلانات العادية (غير الإلزامية) */
  if(!staff) items.filter(a => !a.require_ack && !ANN.reads.has(a.id)).forEach(a => annMarkRead(a.id));
}
window.renderAnnouncements = renderAnnouncements;
window.annMarkRead = annMarkRead;

function annComposerHTML(){
  const IN = 'width:100%;font-family:inherit;font-size:.9rem;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)';
  return `
    <div class="card-basic ann-composer">
      <h3><i class="fas fa-pen-to-square"></i> إعلان جديد</h3>
      <input type="text" id="annTitle" maxlength="120" placeholder="عنوان الإعلان" style="${IN};margin:8px 0">
      <textarea id="annBody" rows="4" maxlength="3000" placeholder="نص الإعلان…" style="${IN};margin-bottom:8px"></textarea>
      <input type="url" id="annLink" placeholder="رابط (اختياري)" dir="ltr" style="${IN};margin-bottom:8px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <label class="btn btn-ghost btn-sm" style="cursor:pointer"><input type="file" id="annImg" accept="image/*" hidden onchange="annPickImg(this)"><i class="fas fa-image"></i> <span id="annImgName">صورة (اختياري)</span></label>
        <label style="display:flex;gap:6px;align-items:center;font-weight:800;font-size:.84rem;cursor:pointer">
          <input type="checkbox" id="annAck" checked> رسالة إلزامية (تطلع لكل الطلاب بوجههم لين يضغطون «قرأت»)
        </label>
        <button class="btn btn-primary" id="annSendBtn" onclick="annPublish()" style="margin-right:auto"><i class="fas fa-paper-plane"></i> نشر الإعلان</button>
      </div>
    </div>`;
}

window.annPickImg = input => {
  const f = input.files[0];
  ANN.imgFile = f || null;
  const n = document.getElementById('annImgName'); if(n) n.textContent = f ? f.name.slice(0, 24) : 'صورة (اختياري)';
};

window.annPublish = async () => {
  if(!annStaff()) return;
  const title = (document.getElementById('annTitle').value || '').trim();
  const body = (document.getElementById('annBody').value || '').trim();
  const link = (document.getElementById('annLink').value || '').trim();
  const ack = document.getElementById('annAck').checked;
  if(!title){ toast('اكتب عنوان الإعلان', 'warn'); return; }
  if(link && !/^https?:\/\//i.test(link)){ toast('الرابط لازم يبدأ بـ https://', 'warn'); return; }
  const btn = document.getElementById('annSendBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري النشر...';
  try{
    let image_url = null;
    if(ANN.imgFile){
      const blob = typeof schCompress === 'function' ? await schCompress(ANN.imgFile, 1400, 0.85) : ANN.imgFile;
      const path = 'ann/' + Date.now() + '.jpg';
      const up = await sb.storage.from('community').upload(path, blob, { contentType: 'image/jpeg' });
      if(!up.error){ const { data } = sb.storage.from('community').getPublicUrl(path); image_url = data.publicUrl; }
      else toast('تعذّر رفع الصورة — بننشر بدونها', 'warn');
    }
    const { error } = await sb.from('announcements').insert({
      title, body, link: link || null, image_url, require_ack: ack, active: true,
      author_name: currentUserObj.role === 'owner' ? 'رئيس المنصة' : (currentUserObj.name || 'إدارة المنصة')
    });
    if(error) throw error;
    if(typeof logAdminAction === 'function') logAdminAction('update_settings', null, 'نشر إعلان: ' + title, { require_ack: ack });
    ANN.imgFile = null;
    toast(ack ? '📢 تم النشر — بتطلع لكل الطلاب بوجههم' : '📢 تم نشر الإعلان', 'ok');
    const c = document.getElementById('annCompose'); if(c) c.innerHTML = annComposerHTML();
    renderAnnouncements();
  }catch(e){
    toast(/announcements/.test(e.message || '') ? 'ميزة الإعلانات تحتاج تشغيل supabase-update-8.sql' : 'فشل: ' + e.message, 'err');
  }finally{
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> نشر الإعلان';
  }
};

window.annToggle = async (id, active) => {
  const { error } = await sb.from('announcements').update({ active }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  renderAnnouncements();
};
window.annDelete = id => confirmBox('حذف الإعلان', 'حذف الإعلان نهائياً؟', async () => {
  const { error } = await sb.from('announcements').delete().eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  renderAnnouncements();
}, true);

/* ================== التشغيل: عند الدخول + لحظياً + فحص كل دقيقة ================== */
async function annBoot(){
  await annLoad();
  annCheckPopups();
  if(!ANN.channel){
    try{
      ANN.channel = sb.channel('ann-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, async () => {
          await annLoad(); annCheckPopups();
          const v = document.getElementById('view-announcements');
          if(v && v.classList.contains('active')) renderAnnouncements();
        })
        .subscribe();
    }catch(e){}
  }
  if(!ANN.poll) ANN.poll = setInterval(async () => {
    if(document.hidden || !currentUserObj) return;
    await annLoad(); annCheckPopups();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', () => {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if(currentUserObj && document.getElementById('app') && document.getElementById('app').classList.contains('open')){
      clearInterval(t);
      setTimeout(annBoot, 2500);
    } else if(tries > 120) clearInterval(t);
  }, 1000);
});

/* ================== ربط الصفحات بالتنقل ==================
   (العناوين والعرض صارت في 05-nav.js — هنا احتياط لو ملف التنقل قديم من الكاش) */
(function(){
  try{
    if(typeof TITLES !== 'undefined'){
      if(!TITLES.community) TITLES.community = ['مجتمع العباقرة', 'شارك زملاءك أسئلتك وإنجازاتك'];
      if(!TITLES.announcements) TITLES.announcements = ['الإعلانات', 'أخبار وتنبيهات منصة عباقرة القدرات'];
    }
  }catch(e){}
})();
