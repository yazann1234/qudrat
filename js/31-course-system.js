/* ============================================================
   31) COURSE SYSTEM — نظام الدورات (مع دعم تاريخ النهاية الثابت)
============================================================ */

const CS = {
  courses: [],
  currentCourseId: null
};

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
  fillCourseDropdowns();
  return CS.courses;
}
window.loadCourses = loadCourses;

function fillCourseDropdowns(){
  const selects = ['afCourse', 'avCourse', 'giftCourseSelect', 'nuCourse'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if(!sel) return;
    const currentVal = sel.value;
    const isGift = (id === 'giftCourseSelect');
    sel.innerHTML = (isGift ? '<option value="">— اختر دورة —</option>' : '<option value="">— بدون دورة (للجميع) —</option>') +
      CS.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if(currentVal) sel.value = currentVal;
  });
}
window.fillCourseDropdowns = fillCourseDropdowns;

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

function shouldSeeCourseItem(item){
  if(typeof isPrivileged === 'function' && isPrivileged()) return true;
  if(!currentUserObj || !currentUserObj.course_id) return false;
  if(!item.course_id) return true;
  return item.course_id === currentUserObj.course_id;
}
window.shouldSeeCourseItem = shouldSeeCourseItem;

function getCoursePrice(course, months){
  if(!course || !course.prices) return 0;
  return course.prices[String(months)] || 0;
}
window.getCoursePrice = getCoursePrice;

/* ⭐ استخرج سعر الدورة (يدعم التاريخ الثابت) */
function getCourseDisplayPrice(course){
  if(!course) return 0;
  const prices = course.prices || {};
  return prices['1'] || prices['3'] || prices['6'] || prices['12'] ||
         (Object.values(prices)[0]) || course.price || 0;
}
window.getCourseDisplayPrice = getCourseDisplayPrice;

/* ⭐ تنسيق التاريخ بالعربي */
function formatEndDate(dateStr){
  try{
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' });
  }catch(e){ return ''; }
}
window.formatEndDate = formatEndDate;

/* ⭐⭐⭐ عرض الدورات في المتجر */
function renderCoursesGrid(){
  const grid = document.getElementById('coursesGrid');
  if(!grid) return;

  if(!CS.courses.length){
    grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-graduation-cap"></i></div><h3>لا توجد دورات</h3><p>سيتم عرض الدورات هنا بعد إضافتها</p></div>';
    return;
  }

  grid.innerHTML = CS.courses.map(c => {
    const isMyCourse = currentUserObj && currentUserObj.course_id === c.id && currentUserObj.status === 'approved';
    const prices = c.prices || {};

    /* ⭐ هل الدورة لها تاريخ نهاية ثابت؟ (مثل دورة الورقي) */
    const hasFixedEnd = !!(c.subscription_end_date);

    let priceHTML = '';

    if(hasFixedEnd){
      /* ⭐ عرض واحد فقط: السعر + التاريخ */
      const price = getCourseDisplayPrice(c);
      const dateStr = formatEndDate(c.subscription_end_date);
      priceHTML = `
        <div class="course-fixed-end">
          <div class="course-fixed-end-head">
            <i class="fas fa-calendar-check"></i>
            <span>اشتراك حتى</span>
          </div>
          <div class="course-fixed-end-date">${escapeHtml(dateStr)}</div>
          <div class="course-fixed-end-price">
            <b>${price}</b>
            <span>ر.س</span>
          </div>
        </div>
      `;
    } else {
      /* ⭐ عرض المدد المتعددة */
      const durations = [
        { m: 1,  label: 'شهر' },
        { m: 3,  label: '3 أشهر' },
        { m: 6,  label: '6 أشهر' },
        { m: 12, label: 'سنة' }
      ].filter(d => prices[String(d.m)]);

      if(!durations.length){
        priceHTML = `<div style="text-align:center;font-size:.82rem;color:var(--muted);padding:16px">لا توجد أسعار محددة</div>`;
      } else {
        priceHTML = `
          <div class="course-prices">
            ${durations.map(d => `
              <div class="course-price-item" data-course="${c.id}" data-months="${d.m}">
                <span class="months">${d.label}</span>
                <b>${prices[String(d.m)]}</b>
                <span class="currency">ر.س</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    return `
      <div class="course-card ${isMyCourse ? 'mine' : ''}" style="--cc:${c.color || '#5b6cff'}">
        ${isMyCourse ? '<div class="course-active-badge"><i class="fas fa-check-circle"></i> دورتك الحالية</div>' : ''}
        <div class="course-icon"><i class="fas ${c.icon || 'fa-graduation-cap'}"></i></div>
        <h3>${escapeHtml(c.name)}</h3>
        <p class="course-desc">${escapeHtml(c.description || '')}</p>
        ${priceHTML}
        <button class="course-subscribe-btn" ${isMyCourse ? 'disabled' : ''} onclick="startCourseSubscription('${c.id}')">
          ${isMyCourse ? '<i class="fas fa-check"></i> أنت مشترك' : '<i class="fas fa-shopping-cart"></i> اشترك الآن'}
        </button>
      </div>
    `;
  }).join('');
}
window.renderCoursesGrid = renderCoursesGrid;

/* ⭐⭐⭐ بدء الاشتراك — يتخطى اختيار المدة للدورات ذات التاريخ الثابت */
function startCourseSubscription(courseId){
  const c = getCourseById(courseId);
  if(!c) return;
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }

  /* ⭐ لو الدورة فيها تاريخ نهاية ثابت: انتقل مباشرة للشراء */
  if(c.subscription_end_date){
    const price = getCourseDisplayPrice(c);
    /* احسب الأشهر حتى تاريخ النهاية (لعرضها في مودال الشراء) */
    const now = new Date();
    const endDate = new Date(c.subscription_end_date);
    const diffMs = endDate - now;
    const diffMonths = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
    openPurchaseModalInline(c, diffMonths, price);
    return;
  }

  /* ⭐ الدورات بدون تاريخ ثابت: اعرض اختيار المدة */
  const prices = c.prices || {};
  const options = [
    { m: 1,  label: 'شهر واحد' },
    { m: 3,  label: '3 أشهر' },
    { m: 6,  label: '6 أشهر' },
    { m: 12, label: 'سنة كاملة' }
  ].filter(o => prices[String(o.m)]);

  if(!options.length){
    toast('لا توجد أسعار محددة لهذه الدورة', 'warn');
    return;
  }

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
      openPurchaseModalInline(c, months, price);
    }
  });

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

/* ⭐ فلترة حسب الدورة */
function filterByCourse(items){
  if(!Array.isArray(items)) return [];
  if(typeof isPrivileged === 'function' && isPrivileged()) return items;
  if(!currentUserObj) return [];
  const myCourse = currentUserObj.course_id;
  return items.filter(item => {
    if(!item.course_id) return true;
    return item.course_id === myCourse;
  });
}
window.filterByCourse = filterByCourse;

/* ⭐⭐⭐ مزامنة منتج → دورة (يعمل دائماً، يولّد كود تلقائياً) */
async function syncProductToCourse(product){
  if(!product) return;

  /* ولّد كود تلقائي لو ما فيه */
  let code = product.course_code;
  if(!code){
    code = 'auto_' + (product.id || Date.now().toString(36));
  }

  try{
    const prices = {
      "1":  product.price || 0,
      "3":  product.price || 0,
      "6":  product.price || 0,
      "12": product.price || 0
    };

    const payload = {
      code: code,
      name: product.title,
      description: product.description || '',
      icon: product.icon || 'fa-graduation-cap',
      color: product.color || '#5b6cff',
      prices: prices,
      active: product.active !== false,
      subscription_end_date: product.subscription_end_date || null
    };

    const check = await sb.from('courses').select('id').eq('code', code).maybeSingle();
    if(check.data){
      await sb.from('courses').update(payload).eq('code', code);
    } else {
      await sb.from('courses').insert(payload);
    }

    /* ⭐ خزّن الكود في المنتج لو ما كان موجود */
    if(!product.course_code && product.id){
      try{ await sb.from('products').update({ course_code: code }).eq('id', product.id); }catch(e){}
    }

    await loadCourses();
    if(typeof renderCoursesGrid === 'function') renderCoursesGrid();
  }catch(e){ console.warn('syncProductToCourse failed', e); }
}
window.syncProductToCourse = syncProductToCourse;

async function initCourseSystem(){
  await loadCourses();
  try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
}
window.initCourseSystem = initCourseSystem;
