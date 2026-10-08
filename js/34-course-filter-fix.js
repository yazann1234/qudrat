/* ============================================================
   34) COURSE FILTER FIX — فلترة الملفات حسب دورة المستخدم
   يحل مشكلتين:
   1) عدد الملفات في sidebar يعرض كل الملفات بدل ملفات دورته
   2) الجدول الذكي يستخدم كل الملفات بدل ملفات دورته
============================================================ */

/* ⭐⭐⭐ دالة مساعدة: ملفات المستخدم المسموح له رؤيتها */
function getUserCourseFiles(){
  if(!currentUserObj) return [];
  if(typeof isPrivileged === 'function' && isPrivileged()) return DB.files.slice();
  if(typeof isSubscribed === 'function' && !isSubscribed()) return [];
  const myCourseId = currentUserObj.course_id;
  if(!myCourseId) return DB.files.filter(f => !f.course_id);
  return DB.files.filter(f => !f.course_id || f.course_id === myCourseId);
}
window.getUserCourseFiles = getUserCourseFiles;

/* ⭐ نفس الدالة للفيديوهات */
function getUserCourseVideos(){
  if(!currentUserObj) return [];
  if(typeof isPrivileged === 'function' && isPrivileged()) return (DB.videos || []).slice();
  if(typeof isSubscribed === 'function' && !isSubscribed()) return [];
  const myCourseId = currentUserObj.course_id;
  const list = DB.videos || [];
  if(!myCourseId) return list.filter(v => !v.course_id);
  return list.filter(v => !v.course_id || v.course_id === myCourseId);
}
window.getUserCourseVideos = getUserCourseVideos;

/* ============================================================
   1) إصلاح عدد الملفات في السايدبار + الفيديوهات
============================================================ */
function fixNavCounts(){
  try{
    const nc = document.getElementById('navCount');
    if(nc){
      const count = getUserCourseFiles().length;
      if(nc.textContent !== String(count)) nc.textContent = count;
    }
    const nvc = document.getElementById('navVideoCount');
    if(nvc){
      const count = getUserCourseVideos().length;
      if(nvc.textContent !== String(count)) nvc.textContent = count;
    }
  }catch(e){}
}
window.fixNavCounts = fixNavCounts;

/* ⭐ غلّف renderFiles لإعادة تصحيح العدد بعد أي رندر */
(function hookRenderFiles(){
  const check = setInterval(() => {
    if(typeof window.renderFiles === 'function' && !window._renderFilesHooked){
      clearInterval(check);
      window._renderFilesHooked = true;
      const orig = window.renderFiles;
      window.renderFiles = function(){
        orig.apply(this, arguments);
        fixNavCounts();
      };
    }
  }, 100);
  setTimeout(() => clearInterval(check), 6000);
})();

/* ⭐ غلّف loadProfilesAndFiles حتى لا يكتب DB.files.length */
(function hookLoadFiles(){
  const check = setInterval(() => {
    if(typeof window.loadProfilesAndFiles === 'function' && !window._loadFilesHooked){
      clearInterval(check);
      window._loadFilesHooked = true;
      const orig = window.loadProfilesAndFiles;
      window.loadProfilesAndFiles = async function(){
        const r = await orig.apply(this, arguments);
        fixNavCounts();
        return r;
      };
    }
  }, 100);
  setTimeout(() => clearInterval(check), 6000);
})();

/* ⭐ MutationObserver: لو أحد غيّر العدد يدوياً، رجّعه */
(function watchNavCount(){
  const nc = document.getElementById('navCount');
  if(!nc) return;
  const obs = new MutationObserver(() => {
    const correct = getUserCourseFiles().length;
    if(nc.textContent !== String(correct)){
      nc.textContent = correct;
    }
  });
  obs.observe(nc, { childList: true, characterData: true, subtree: true });
})();

/* ============================================================
   2) إصلاح الجدول الذكي — يستخدم ملفات الدورة فقط
   نغلّف الدوال المحتملة: renderStudyPlan / generateStudyPlan
   + نصلح أي استخدام مباشر لـ DB.files في هذا القسم
============================================================ */

/* ⭐ اضبط أي دالة تولّد خطة لتستخدم getUserCourseFiles() */
function patchStudyPlanData(){
  try{
    /* لو الجدول الذكي يخزّن ملفات في variable عام */
    if(window.STUDY_PLAN_DATA && Array.isArray(window.STUDY_PLAN_DATA.files)){
      /* اتركه للدالة نفسها */
    }

    /* ⭐ استبدل DB.files على مستوى الجدول الذكي فقط */
    /* نحفظ الأصل */
    if(!window._origDBFilesGetter){
      window._origDBFilesGetter = true;
    }
  }catch(e){}
}

/* ⭐⭐⭐ الحل الأقوى: Wrap الدوال المسؤولة */
(function hookStudyPlan(){
  const names = ['renderStudyPlan', 'generateStudyPlan', 'buildStudyPlan', 'createStudyPlan'];

  const check = setInterval(() => {
    let found = false;
    names.forEach(fnName => {
      if(typeof window[fnName] === 'function' && !window['_' + fnName + '_hooked']){
        found = true;
        window['_' + fnName + '_hooked'] = true;
        const orig = window[fnName];
        window[fnName] = function(){
          /* ⭐ لو الدالة تعتمد على DB.files، استبدله مؤقتاً */
          const realFiles = DB.files;
          const filtered = getUserCourseFiles();

          /* استبدل DB.files بنسخة مفلترة مؤقتاً */
          try{
            DB.files = filtered;
            return orig.apply(this, arguments);
          } finally {
            /* أعِد الأصلي بعد الانتهاء */
            DB.files = realFiles;
          }
        };
      }
    });
    if(found && names.every(n => !window[n] || window['_' + n + '_hooked'])){
      /* كل الدوال اللي وجدناها تم تغليفها */
    }
  }, 150);

  setTimeout(() => clearInterval(check), 8000);
})();

/* ============================================================
   3) عند تغيير دورة المستخدم — أعِد الرندر
============================================================ */
(function watchCourseChange(){
  let lastCourseId = currentUserObj ? currentUserObj.course_id : null;
  setInterval(() => {
    const cur = currentUserObj ? currentUserObj.course_id : null;
    if(cur !== lastCourseId){
      lastCourseId = cur;
      try{ fixNavCounts(); }catch(e){}
      try{ if(typeof renderFiles === 'function') renderFiles(); }catch(e){}
      try{ if(typeof renderStudyPlan === 'function') renderStudyPlan(); }catch(e){}
    }
  }, 2000);
})();

/* ============================================================
   4) تفعيل أولي
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(fixNavCounts, 500);
  setTimeout(fixNavCounts, 2000);
  setTimeout(fixNavCounts, 5000);
});

console.log('✅ Course filter fix loaded');
