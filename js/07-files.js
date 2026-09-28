/* ============================================================
   07) FILES — بطاقات الملفات + الفلترة
============================================================ */

function fileCard(f){
  const pct = getPct(f.id);
  const done = pct >= 100;
  const maxPage = getMaxPage(f.id);
  const total = f.page_count || '?';
  const cur = maxPage > 0 ? Math.min(maxPage, total) : 1;
  const locked = !isSubscribed();
  const fav = userData.favs.includes(f.id);
  const icon = f.icon || 'fa-book';
  const color = f.color || '#5b6cff';
  const cat = f.category || 'عام';
  return `
  <div class="file-card ${f.important ? 'important' : ''} ${locked ? 'locked' : ''}" style="--fc:${color}">
    <div class="fc-head">
      <div class="fc-icon"><i class="fas ${icon}"></i></div>
      <div class="fc-head-txt">
        <h3>${escapeHtml(f.title)}</h3>
        <span class="fc-cat">${escapeHtml(cat)}</span>
      </div>
      ${locked ? '<div class="fc-lock"><i class="fas fa-lock"></i></div>' : (f.important ? '<div class="fc-star"><i class="fas fa-star"></i></div>' : '<div class="fc-pdf">PDF</div>')}
      ${!locked ? `<button class="fc-fav ${fav?'on':''}" onclick="toggleFav('${f.id}',event)" title="مفضلة"><i class="${fav?'fas':'far'} fa-star"></i></button>` : ''}
    </div>
    <p class="fc-desc">${escapeHtml(f.description || '—')}</p>
    ${!locked ? `<div class="fc-prog">
        <div class="fc-prog-top"><span>${cur}/${total} صفحة</span><b>${pct}%</b></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>` : ''}
    <div class="fc-actions">
      ${locked
        ? `<button class="btn btn-ghost" style="flex:1" onclick="showLockMessage()"><i class="fas fa-lock"></i> يتطلب اشتراك</button>`
        : `<button class="btn btn-primary" onclick="openFile('${f.id}')"><i class="fas fa-book-open"></i> ${done ? 'مراجعة' : pct > 0 ? 'متابعة' : 'فتح'}</button>`}
    </div>
  </div>`;
}

let fileFilter = 'all', fileSort = 'new';

function renderFiles(){
  const q = ($('#searchInput') ? $('#searchInput').value : '').trim().toLowerCase();
  let list = DB.files.slice();
  if(q) list = list.filter(f =>
    (f.title||'').toLowerCase().includes(q) || (f.category||'').toLowerCase().includes(q) || (f.description||'').toLowerCase().includes(q));
  if(fileFilter === 'fav') list = list.filter(f => userData.favs.includes(f.id));
  else if(fileFilter !== 'all') list = list.filter(f => f.category === fileFilter);
  if(fileSort === 'new') list.sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
  else if(fileSort === 'old') list.sort((a,b)=> new Date(a.created_at||0) - new Date(b.created_at||0));
  else if(fileSort === 'alpha') list.sort((a,b)=> String(a.title).localeCompare(String(b.title), 'ar'));
  else if(fileSort === 'progress') list.sort((a,b)=> getPct(b.id) - getPct(a.id));

  const grid = $('#filesGrid'); if(!grid) return;
  if(!list.length){
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="admin-empty"><div class="em-ic"><i class="fas fa-inbox"></i></div><h3>${q || fileFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد ملفات بعد'}</h3><p>${q || fileFilter !== 'all' ? 'جرّب تغيير البحث أو التصنيف' : 'سيتم رفع الملفات من لوحة الأدمن'}</p></div></div>`;
  } else grid.innerHTML = list.map(fileCard).join('');
  renderRecent();
  const nc = $('#navCount'); if(nc) nc.textContent = DB.files.length;
  renderSubBanners();
}

function renderRecent(){
  const recent = userData.opened.slice(0, 4).map(id => DB.files.find(f => f.id === id)).filter(Boolean);
  const list = recent.length ? recent : DB.files.slice(0, 4);
  const box = $('#recentFiles');
  if(box) box.innerHTML = list.length ? list.map(fileCard).join('') :
    '<div style="grid-column:1/-1"><div class="admin-empty" style="padding:40px 20px"><div class="em-ic"><i class="fas fa-folder-open"></i></div><h3>لا توجد ملفات بعد</h3></div></div>';
}

function renderSubBanners(){
  const bannerHTML = !isSubscribed() ? (() => {
    if(isPending()){
      return `<div class="subscribe-wall"><div class="sw-icon"><i class="fas fa-hourglass-half"></i></div><h3>طلبك قيد المراجعة</h3><p>تم إرسال طلب اشتراكك بنجاح. سيتم تفعيل حسابك من قبل الأدمن قريباً.</p><div class="sw-status"><i class="fas fa-clock"></i> بانتظار الموافقة</div></div>`;
    }
    return `<div class="subscribe-wall"><div class="sw-icon"><i class="fas fa-lock"></i></div><h3>حسابك بحاجة إلى اشتراك</h3><p>لتصفّح الملفات ومتابعة تقدمك، يجب تفعيل اشتراكك من قبل الأدمن.</p><div class="sw-status"><i class="fas fa-ban"></i> الوصول غير متاح</div></div>`;
  })() : '';
  const hb = $('#homeSubBanner'); if(hb) hb.innerHTML = bannerHTML;
  const fb = $('#filesSubBanner'); if(fb) fb.innerHTML = bannerHTML;
}

window.showLockMessage = () => {
  if(isPending()) toast('طلبك قيد المراجعة من قبل الأدمن', 'warn');
  else toast('تحتاج اشتراكاً مفعّلاً للوصول للملفات', 'warn');
};

window.toggleFav = (id, ev) => {
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  const i = userData.favs.indexOf(id);
  if(i > -1){ userData.favs.splice(i,1); toast('أُزيل من المفضلة', 'warn'); }
  else { userData.favs.push(id); toast('أُضيف إلى المفضلة', 'ok'); }
  savePrefs(); renderFiles();
};
