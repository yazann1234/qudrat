/* ============================================================
   07) FILES — بطاقات الملفات + فلترة حسب الدورة ⭐
============================================================ */

function fileCard(f){
  const pct = getPct(f.id);
  const done = pct >= 100;
  const maxPage = getMaxPage(f.id);
  const total = f.page_count || '?';
  const cur = maxPage > 0 ? Math.min(maxPage, total) : 1;

  /* ⭐ 3 مستويات: مشترك + نفس الدورة = unlock / مشترك بدورة ثانية = locked / غير مشترك = locked */
  const isSub = typeof isSubscribed === 'function' ? isSubscribed() : false;
  const hasCourseAccess = isPrivileged() || !f.course_id || (currentUserObj && f.course_id === currentUserObj.course_id);
  const locked = !isPrivileged() && (!isSub || !hasCourseAccess);
  const lockedReason = !isSub ? 'subscribe' : 'course'; // للتلميح

  const fav = userData.favs.includes(f.id);
  const icon = f.icon || 'fa-book';
  const color = f.color || '#5b6cff';
  const cat = f.category || 'عام';
  const hasExplanation = f.explanation_video_id && (DB.videos || []).some(v => v.id === f.explanation_video_id);

  /* ⭐ هل هذا الملف من دورة أخرى؟ */
  const fromOtherCourse = !isPrivileged() && f.course_id && currentUserObj && f.course_id !== currentUserObj.course_id;
  const course = f.course_id && typeof getCourseById === 'function' ? getCourseById(f.course_id) : null;

  return `
  <div class="file-card ${f.important ? 'important' : ''} ${locked ? 'locked' : ''}" style="--fc:${color}">
    <div class="fc-head">
      <div class="fc-icon"><i class="fas ${icon}"></i></div>
      <div class="fc-head-txt">
        <h3>${escapeHtml(f.title)}</h3>
        <span class="fc-cat">${escapeHtml(cat)}</span>
        ${course ? `<span class="fc-cat" style="background:color-mix(in srgb,${course.color} 15%,transparent);color:${course.color};margin-right:6px"><i class="fas ${course.icon || 'fa-graduation-cap'}"></i> ${escapeHtml(course.name)}</span>` : ''}
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
        ? (fromOtherCourse
            ? `<button class="btn btn-ghost" style="flex:1" onclick="showCourseLockMessage('${course ? escapeHtml(course.name) : ''}')"><i class="fas fa-graduation-cap"></i> يحتاج دورة أخرى</button>`
            : `<button class="btn btn-ghost" style="flex:1" onclick="showLockMessage()"><i class="fas fa-lock"></i> يتطلب اشتراك</button>`)
        : `<button class="btn btn-primary" onclick="openFile('${f.id}')"><i class="fas fa-book-open"></i> ${done ? 'مراجعة' : pct > 0 ? 'متابعة' : 'فتح'}</button>`}
    </div>
    ${!locked && hasExplanation ? `<button class="fc-explain" onclick="event.stopPropagation();openVideo('${f.explanation_video_id}')"><i class="fas fa-circle-play"></i> شرح الملف بالفيديو</button>` : ''}
  </div>`;
}

let fileFilter = 'all', fileSort = 'new';

/* ⭐ دوال مساعدة للفلترة */
function getVisibleFiles(){
  let list = DB.files.slice();
  if(isPrivileged()) return list;
  if(!currentUserObj) return [];
  if(typeof isSubscribed === 'function' && !isSubscribed()) return [];
  /* ⭐ مشترك: فقط ملفات دورته + الملفات العامة */
  const myCourseId = currentUserObj.course_id;
  list = list.filter(f => !f.course_id || f.course_id === myCourseId);
  return list;
}

function renderFiles(){
  const q = ($('#searchInput') ? $('#searchInput').value : '').trim().toLowerCase();
  let list = getVisibleFiles();
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
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="admin-empty"><div class="em-ic"><i class="fas fa-inbox"></i></div><h3>${q || fileFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد ملفات متاحة لدورتك'}</h3><p>${q || fileFilter !== 'all' ? 'جرّب تغيير البحث أو التصنيف' : 'سيتم رفع الملفات من لوحة الأدمن'}</p></div></div>`;
  } else grid.innerHTML = list.map(fileCard).join('');
  renderRecent();
  /* ⭐ استخدم العدد المفلتر الحقيقي (وليس عدد نتائج البحث الحالية) */
const nc = $('#navCount');
if(nc) nc.textContent = (typeof getUserCourseFiles === 'function' ? getUserCourseFiles() : list).length;
  renderSubBanners();
}

function renderRecent(){
  const visible = getVisibleFiles();
  const recent = userData.opened.slice(0, 4).map(id => visible.find(f => f.id === id)).filter(Boolean);
  const list = recent.length ? recent : visible.slice(0, 4);
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

/* ⭐ رسالة خاصة عند فتح ملف من دورة أخرى */
window.showCourseLockMessage = (courseName) => {
  toast(`هذا الملف خاص بدورة "${courseName || 'أخرى'}" — لا تملك صلاحية الوصول`, 'warn');
};

window.toggleFav = (id, ev) => {
  if(ev){ ev.stopPropagation(); ev.preventDefault(); }
  const i = userData.favs.indexOf(id);
  if(i > -1){ userData.favs.splice(i,1); toast('أُزيل من المفضلة', 'warn'); }
  else { userData.favs.push(id); toast('أُضيف إلى المفضلة', 'ok'); }
  savePrefs(); renderFiles();
};

window.getVisibleFiles = getVisibleFiles;
