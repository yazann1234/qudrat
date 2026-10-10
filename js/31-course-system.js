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

/* ⭐ المدد المعتمدة للاشتراك */
const COURSE_DURATIONS = [
  { m: 1,  label: 'شهر',   long: 'شهر واحد' },
  { m: 3,  label: '3 أشهر', long: '3 أشهر' },
  { m: 6,  label: '6 أشهر', long: '6 أشهر' },
  { m: 12, label: 'سنة',   long: 'سنة كاملة' }
];
window.COURSE_DURATIONS = COURSE_DURATIONS;

function monthsLabel(m){
  m = parseInt(m, 10) || 0;
  if(m === 1) return 'شهر';
  if(m === 2) return 'شهرين';
  if(m === 12) return 'سنة';
  if(m >= 3 && m <= 10) return m + ' أشهر';
  return m + ' شهر';
}
window.monthsLabel = monthsLabel;

/* ⭐ أقل سعر متاح للدورة (للعرض «يبدأ من») */
function getCourseDisplayPrice(course){
  if(!course) return 0;
  const prices = course.prices || {};
  const vals = Object.values(prices).map(Number).filter(v => v > 0);
  if(vals.length) return Math.min(...vals);
  return Number(course.price) || 0;
}
window.getCourseDisplayPrice = getCourseDisplayPrice;

/* ⭐ عدد الأشهر حتى تاريخ النهاية الثابت */
function monthsUntilFixedEnd(course){
  if(!course || !course.subscription_end_date) return 0;
  const diffMs = new Date(course.subscription_end_date) - new Date();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
}
window.monthsUntilFixedEnd = monthsUntilFixedEnd;

/* ⭐⭐⭐ ماذا اشترى المستخدم؟ (الدورة + المدة + السعر) — للتفعيل بضغطة واحدة */
function getPurchaseRequest(u){
  if(!u) return null;
  let course = null, months = 0;
  const code = String(u.purchase_product || '');
  const m = /^(.*)_(\d+)m$/.exec(code);

  if(u.purchase_course_id) course = getCourseById(u.purchase_course_id);
  if(!course && m) course = (CS.courses || []).find(c => c.code === m[1]) || null;
  if(!course && code){
    /* الصيغة القديمة: كان يُحفظ id المنتج */
    const prod = (DB.products || []).find(p => p.id === code);
    if(prod) course = (CS.courses || []).find(c => c.code === (prod.course_code || ('auto_' + prod.id))) || null;
  }
  if(!course) return null;

  months = parseInt(u.purchase_months, 10) || (m ? parseInt(m[2], 10) : 0) || 0;
  if(!months){
    if(course.subscription_end_date) months = monthsUntilFixedEnd(course);
    else {
      const first = COURSE_DURATIONS.find(d => Number((course.prices || {})[String(d.m)]) > 0);
      months = first ? first.m : 1;
    }
  }
  const price = (u.purchase_price != null && u.purchase_price !== '')
    ? Number(u.purchase_price)
    : (course.subscription_end_date ? getCourseDisplayPrice(course) : getCoursePrice(course, months));

  return { course, months, price };
}
window.getPurchaseRequest = getPurchaseRequest;

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

  /* هل للمستخدم طلب شراء قيد المراجعة؟ */
  const pendingReq = (currentUserObj && currentUserObj.purchase_submitted && currentUserObj.status !== 'approved')
    ? getPurchaseRequest(currentUserObj) : null;

  grid.innerHTML = CS.courses.map(c => {
    const isMyCourse = currentUserObj && currentUserObj.course_id === c.id && currentUserObj.status === 'approved';
    const isPendingHere = pendingReq && pendingReq.course && pendingReq.course.id === c.id;
    const prices = c.prices || {};
    const hasFixedEnd = !!(c.subscription_end_date);
    const p1 = Number(prices['1']) || 0;

    let priceBlock = '';

    if(hasFixedEnd){
      const price = getCourseDisplayPrice(c);
      const dateStr = formatEndDate(c.subscription_end_date);
      priceBlock = `
        <div class="course-fixed-end">
          <div class="course-fixed-end-head">
            <i class="fas fa-calendar-check"></i>
            <span>اشتراك حتى</span>
          </div>
          <div class="course-fixed-end-date">${escapeHtml(dateStr)}</div>
          <div class="course-fixed-end-price">
            <b>${price}</b>
            <span>${sarIcon()}</span>
          </div>
        </div>
      `;
    } else {
      const durations = COURSE_DURATIONS.filter(d => Number(prices[String(d.m)]) > 0);

      if(!durations.length){
        priceBlock = `<div style="text-align:center;font-size:.82rem;color:var(--muted);padding:16px">لا توجد أسعار محددة</div>`;
      } else {
        priceBlock = `
          <div class="course-prices">
            ${durations.map(d => {
              const price = Number(prices[String(d.m)]);
              const save = (p1 && d.m > 1) ? Math.round((1 - price / (p1 * d.m)) * 100) : 0;
              return `
              <div class="course-price-item" data-course="${c.id}" data-months="${d.m}">
                <span class="months">${d.label}${save > 0 ? ` <em class="price-save">وفّر ${save}%</em>` : ''}</span>
                <b>${price}${sarIcon()}</b>
              </div>`;
            }).join('')}
          </div>
        `;
      }
    }

    let btn;
    if(isMyCourse) btn = '<button class="course-subscribe-btn" disabled><i class="fas fa-check"></i> أنت مشترك</button>';
    else if(isPendingHere) btn = '<button class="course-subscribe-btn" disabled><i class="fas fa-hourglass-half"></i> طلبك قيد المراجعة</button>';
    else btn = `<button class="course-subscribe-btn" onclick="startCourseSubscription('${c.id}')"><i class="fas fa-shopping-cart"></i> اشترك الآن</button>`;

    return `
      <div class="course-card ${isMyCourse ? 'mine' : ''}" style="--cc:${c.color || '#5b6cff'}">
        ${isMyCourse ? '<div class="course-active-badge"><i class="fas fa-check-circle"></i> دورتك الحالية</div>' : ''}
        ${isPendingHere ? `<div class="course-active-badge" style="background:linear-gradient(120deg,#f7b32b,#d97706)"><i class="fas fa-clock"></i> ${monthsLabel(pendingReq.months)} — قيد المراجعة</div>` : ''}
        <div class="course-icon"><i class="fas ${c.icon || 'fa-graduation-cap'}"></i></div>
        <h3>${escapeHtml(c.name)}</h3>
        <p class="course-desc">${escapeHtml(c.description || '')}</p>
        ${priceBlock}
        ${btn}
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

  if(c.subscription_end_date){
    openPurchaseModalInline(c, monthsUntilFixedEnd(c), getCourseDisplayPrice(c));
    return;
  }

  const prices = c.prices || {};
  const p1 = Number(prices['1']) || 0;
  const options = COURSE_DURATIONS.filter(o => Number(prices[String(o.m)]) > 0);

  if(!options.length){
    toast('لا توجد أسعار محددة لهذه الدورة', 'warn');
    return;
  }

  openModal({
    title: 'اختر مدة الاشتراك',
    text: `دورة: ${escapeHtml(c.name)}`,
    bodyHTML: `
      <div class="duration-picker" id="durationPicker">
        ${options.map((o, i) => {
          const price = Number(prices[String(o.m)]);
          const perMonth = o.m > 1 ? Math.round(price / o.m) : 0;
          const save = (p1 && o.m > 1) ? Math.round((1 - price / (p1 * o.m)) * 100) : 0;
          return `
          <label class="duration-option ${i === 0 ? 'on' : ''}" data-months="${o.m}" data-price="${price}">
            <input type="radio" name="courseDuration" value="${o.m}" ${i === 0 ? 'checked' : ''}>
            <div class="duration-card">
              <div class="duration-label">${o.long}${save > 0 ? ` <em class="price-save">وفّر ${save}%</em>` : ''}</div>
              <div class="duration-price">
                <b>${price}</b> <span>${sarIcon()}</span>
                ${perMonth ? `<small class="duration-per-month">≈ ${perMonth} ${sarIcon()} / شهر</small>` : ''}
              </div>
            </div>
          </label>`;
        }).join('')}
      </div>
    `,
    okText: 'متابعة للدفع',
    onOk: async () => {
      const selected = document.querySelector('input[name="courseDuration"]:checked');
      if(!selected) return;
      const months = parseInt(selected.value, 10);
      openPurchaseModalInline(c, months, Number(prices[String(months)]));
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
    /* ⭐ سعر مستقل لكل مدة (من لوحة الأدمن) */
    const prices = {};
    const src = (product.prices && typeof product.prices === 'object') ? product.prices : null;
    COURSE_DURATIONS.forEach(d => {
      const v = src ? Number(src[String(d.m)]) : Number(product.price);
      if(v > 0) prices[String(d.m)] = v;
    });
    if(!Object.keys(prices).length && Number(product.price) > 0) prices['1'] = Number(product.price);

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
    const r = check.data
      ? await sbSafeWrite(p => sb.from('courses').update(p).eq('code', code), payload)
      : await sbSafeWrite(p => sb.from('courses').insert(p), payload);
    if(r && r.error) console.warn('course sync failed:', r.error.message);

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
