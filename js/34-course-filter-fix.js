/* ============================================================
   34) COURSE FILTER v2 — كل طالب يشوف محتوى دوراته فقط
   - ملفات وفيديوهات الدورة (المحوسب يشوف المحوسب، الورقي يشوف الورقي)
   - يدعم أكثر من دورة للطالب
   - فلتر «الدورة» في الملفات والفيديوهات لمن عنده أكثر من دورة (وللأدمن)
   (أُزيلت الحيل القديمة: تبديل DB.files مؤقتاً + MutationObserver)
============================================================ */

/* اختيار الدورة المعروضة حالياً: 'all' | 'general' | <course id> */
const COURSE_VIEW = { files: 'all', videos: 'all' };
window.COURSE_VIEW = COURSE_VIEW;

function getUserCourseFiles(){
  if(!currentUserObj) return [];
  return (DB.files || []).filter(canAccessCourseItem);
}
window.getUserCourseFiles = getUserCourseFiles;

function getUserCourseVideos(){
  if(!currentUserObj) return [];
  return (DB.videos || []).filter(canAccessCourseItem);
}
window.getUserCourseVideos = getUserCourseVideos;

function fixNavCounts(){
  try{
    const nc = document.getElementById('navCount');
    if(nc) nc.textContent = getUserCourseFiles().length;
    const nvc = document.getElementById('navVideoCount');
    if(nvc) nvc.textContent = getUserCourseVideos().length;
  }catch(e){}
}
window.fixNavCounts = fixNavCounts;

/* ============================================================
   فلتر الدورة (قائمة منسدلة) في صفحة الملفات والفيديوهات
============================================================ */
function courseFilterOptions(){
  const priv = typeof isPrivileged === 'function' && isPrivileged();
  const courses = priv ? (CS.courses || []) : getMyCourses();
  return courses;
}

function renderCourseFilters(){
  [['files', '#view-files .filter-row, #view-files .filters, #view-files .filter-chips', 'renderFiles'],
   ['videos', '#view-videos .filter-row, #view-videos .filters, #view-videos .filter-chips', 'renderVideos']].forEach(([kind, sel, fn]) => {
    const courses = courseFilterOptions();
    const id = kind === 'files' ? 'fileCourseFilter' : 'videoCourseFilter';
    let el = document.getElementById(id);
    const show = courses.length > 1;

    if(!show){
      if(el) el.style.display = 'none';
      COURSE_VIEW[kind] = 'all';
      return;
    }

    if(!el){
      const chipsHost = document.querySelector(kind === 'files' ? '[data-cat="all"]' : '[data-vcat="all"]');
      const host = chipsHost ? chipsHost.parentNode : document.querySelector(sel);
      if(!host) return;
      el = document.createElement('select');
      el.id = id;
      el.className = 'sort-select course-filter-select';
      el.addEventListener('change', () => {
        COURSE_VIEW[kind] = el.value;
        try{ window[fn](); }catch(e){}
      });
      host.insertBefore(el, host.firstChild);
    }
    el.style.display = '';
    const cur = COURSE_VIEW[kind];
    el.innerHTML = `<option value="all">📚 كل دوراتي</option>` +
      courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') +
      `<option value="general">🌐 المحتوى العام</option>`;
    el.value = [...el.options].some(o => o.value === cur) ? cur : 'all';
    COURSE_VIEW[kind] = el.value;
  });
}
window.renderCourseFilters = renderCourseFilters;

/* بعد كل رندر للملفات: صحّح العدد */
(function hookRenderFiles(){
  const wrap = () => {
    if(typeof window.renderFiles !== 'function' || window._renderFilesHooked) return false;
    window._renderFilesHooked = true;
    const orig = window.renderFiles;
    window.renderFiles = function(){
      const r = orig.apply(this, arguments);
      fixNavCounts();
      return r;
    };
    return true;
  };
  if(!wrap()) document.addEventListener('DOMContentLoaded', wrap);
})();

/* عند تغيّر دورات المستخدم أو تحميل الدورات → حدّث الفلاتر */
(function watchCourseChange(){
  let last = '';
  setInterval(() => {
    const cur = (currentUserObj ? getUserCourseIds().join(',') : '') + '|' + (CS.courses || []).length;
    if(cur !== last){
      last = cur;
      try{ renderCourseFilters(); }catch(e){}
      try{ fixNavCounts(); }catch(e){}
    }
  }, 1500);
})();
