/* ============================================================
   31) COURSE SYSTEM — نظام الدورات
============================================================ */

const CS = {
  courses: [],
  currentCourseId: null
};

/* ================== تحميل الدورات ================== */
async function loadCourses(retry){
  retry = (typeof retry === 'number') ? retry : 2;
  try{
    const { data, error } = await sb.from('courses')
      .select('*').eq('active', true).order('sort_order', { ascending: true });
    if(error) throw error;
    CS.courses = data || [];
    DB.courses = CS.courses;
  }catch(e){
    if(retry > 0){ await new Promise(r => setTimeout(r, 300)); return loadCourses(retry - 1); }
    CS.courses = [];
  }
  return CS.courses;
}
window.loadCourses = loadCourses;

/* ================== الحصول على دورة ================== */
function getCourseById(id){
  if(!id) return null;
  return (CS.courses || []).find(c => c.id === id) || null;
}
window.getCourseById = getCourseById;

function getMyCourse(){
  if(!currentUserObj || !currentUserObj.course_id) return null;
  return getCourseById(currentUserObj.course_id);
}
window.getMyCourse = getMyCourse;

/* ================== دورة المستخدم الحالية ================== */
function shouldSeeCourseItem(item){
  /* الأدمن والمالك يرون كل شيء */
  if(typeof isPrivileged === 'function' && isPrivileged()) return true;

  /* لو ما فيه دورة محددة للمستخدم → لا يرى شيئاً */
  if(!currentUserObj || !currentUserObj.course_id) return false;

  /* لو الملف ما له دورة → متاح للجميع */
  if(!item.course_id) return true;

  /* المطابقة */
  return item.course_id === currentUserObj.course_id;
}
window.shouldSeeCourseItem = shouldSeeCourseItem;

/* ================== السعر حسب المدة ================== */
function getCoursePrice(course, months){
  if(!course || !course.prices) return 0;
  const prices = course.prices;
  return prices[String(months)] || 0;
}
window.getCoursePrice = getCoursePrice;

/* ================== عرض الدورات في المتجر ================== */
function renderCoursesGrid(){
  const grid = document.getElementById('coursesGrid');
  if(!grid) return;

  if(!CS.courses.length){
    grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-graduation-cap"></i></div><h3>لا توجد دورات</h3></div>';
    return;
  }

  /* دورات المتاح له الاشتراك */
  const isSubscribedToAny = currentUserObj && currentUserObj.status === 'approved' && currentUserObj.course_id;

  grid.innerHTML = CS.courses.map(c => {
    const isMyCourse = currentUserObj && currentUserObj.course_id === c.id && currentUserObj.status === 'approved';
    const prices = c.prices || {};
    const durations = [
      { m: 1, label: 'شهر' },
      { m: 3, label: '3 أشهر' },
      { m: 6, label: '6 أشهر' },
      { m: 12, label: 'سنة' }
    ].filter(d => prices[String(d.m)]);

    return `
      <div class="course-card ${isMyCourse ? 'mine' : ''}" style="--cc:${c.color || '#5b6cff'}">
        ${isMyCourse ? '<div class="course-active-badge"><i class="fas fa-check-circle"></i> دورتك الحالية</div>' : ''}
        <div class="course-icon"><i class="fas ${c.icon || 'fa-graduation-cap'}"></i></div>
        <h3>${escapeHtml(c.name)}</h3>
        <p class="course-desc">${escapeHtml(c.description || '')}</p>
        <div class="course-prices">
          ${durations.map(d => `
            <div class="course-price-item" data-course="${c.id}" data-months="${d.m}">
              <span class="months">${d.label}</span>
              <b>${prices[String(d.m)]}</b>
              <span class="currency">ر.س</span>
            </div>
          `).join('')}
        </div>
        <button class="course-subscribe-btn" ${isMyCourse ? 'disabled' : ''} onclick="startCourseSubscription('${c.id}')">
          ${isMyCourse ? '<i class="fas fa-check"></i> أنت مشترك' : '<i class="fas fa-shopping-cart"></i> اشترك الآن'}
        </button>
      </div>
    `;
  }).join('');
}
window.renderCoursesGrid = renderCoursesGrid;

/* ================== بدء الاشتراك ================== */
function startCourseSubscription(courseId){
  const c = getCourseById(courseId);
  if(!c) return;

  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }

  /* مودال اختيار المدة */
  const prices = c.prices || {};
  const options = [
    { m: 1, label: 'شهر واحد' },
    { m: 3, label: '3 أشهر' },
    { m: 6, label: '6 أشهر' },
    { m: 12, label: 'سنة كاملة' }
  ].filter(o => prices[String(o.m)]);

  openModal({
    title: 'اختر مدة الاشتراك',
    text: `دورة: ${c.name}`,
    bodyHTML: `
      <div class="duration-picker" id="durationPicker">
        ${options.map((o, i) => `
          <label class="duration-option ${i === 0 ? 'on' : ''}" data-months="${o.m}" data-price="${prices[String(o.m)]}">
            <input type="radio" name="courseDuration" value="${o.m}" ${i === 0 ? 'checked' : ''}>
            <div class="duration-card">
              <div class="duration-label">${o.label}</div>
              <div class="duration-price">
                <b>${prices[String(o.m)]}</b> <span>ر.س</span>
              </div>
            </div>
          </label>
        `).join('')}
      </div>
    `,
    okText: 'متابعة للدفع',
    onOk: async () => {
      const selected = document.querySelector('input[name="courseDuration"]:checked');
      if(!selected) return;
      const months = parseInt(selected.value, 10);
      const price = prices[String(months)];
      openPurchaseModal(c, months, price);
    }
  });

  /* ربط التحديد */
  setTimeout(() => {
    const picker = document.getElementById('durationPicker');
    if(picker){
      picker.querySelectorAll('.duration-option').forEach(el => {
        el.addEventListener('click', () => {
          picker.querySelectorAll('.duration-option').forEach(x => x.classList.remove('on'));
          el.classList.add('on');
          const inp = el.querySelector('input');
          if(inp) inp.checked = true;
        });
      });
    }
  }, 100);
}
window.startCourseSubscription = startCourseSubscription;

/* ================== حفظ حالة الاشتراك المؤقت (لإرسالها للدعم) ================== */
window._pendingSubscription = null;

function openPurchaseModal(course, months, price){
  /* لو دالة الشراء القديمة موجودة، استخدمها بعد تحديث الـ currentProduct */
  const fakeProduct = {
    id: course.code + '_' + months + 'm',
    title: course.name + ' — ' + months + ' شهر',
    subtitle: 'اشتراك في دورة ' + course.name,
    price: price,
    currency: 'ر.س',
    icon: course.icon,
    color: course.color,
    course_id: course.id,
    months: months
  };

  /* استخدم دالة الشراء القديمة */
  if(typeof openPurchaseModalInline === 'function'){
    openPurchaseModalInline(fakeProduct);
  } else {
    /* البديل: عرض رسالة */
    window._pendingSubscription = { course, months, price };
    if(typeof startPurchase === 'function'){
      /* try قديم */
      window._currentFakeProduct = fakeProduct;
      /* استدعاء يدوي */
      toast('جاري تحضير الدفع...', 'ok');
    }
  }
}
window.openPurchaseModal = openPurchaseModal;

/* ================== فلترة الملفات والفيديوهات ================== */
function filterByCourse(items){
  if(!Array.isArray(items)) return [];
  if(typeof isPrivileged === 'function' && isPrivileged()) return items;
  if(!currentUserObj) return [];
  /* لو المستخدم ما عنده دورة → يرى العناصر بدون دورة فقط */
  const myCourse = currentUserObj.course_id;
  return items.filter(item => {
    if(!item.course_id) return true;
    return item.course_id === myCourse;
  });
}
window.filterByCourse = filterByCourse;

/* ================== التهيئة ================== */
async function initCourseSystem(){
  await loadCourses();
  try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
}
window.initCourseSystem = initCourseSystem;
