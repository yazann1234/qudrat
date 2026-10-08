/* ============================================================
   31) COURSE SYSTEM — نظام الدورات + منتجات = دورات
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
  /* ⭐ املأ قوائم الاختيار في لوحة الأدمن */
  fillCourseDropdowns();
  return CS.courses;
}
window.loadCourses = loadCourses;

/* ⭐ املأ كل الـ selects بالدورات */
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

function renderCoursesGrid(){
  const grid = document.getElementById('coursesGrid');
  if(!grid) return;

  if(!CS.courses.length){
    grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-graduation-cap"></i></div><h3>لا توجد دورات</h3></div>';
    return;
  }

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

function startCourseSubscription(courseId){
  const c = getCourseById(courseId);
  if(!c) return;
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }

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

/* ⭐ ربط ملف بفيديو + فلترة */
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

/* ⭐ مزامنة منتج → دورة */
async function syncProductToCourse(product){
  if(!product) return;
  if(!product.course_code) return;

  try{
    const code = product.course_code;
    const prices = {
      "1": product.price || 45,
      "3": Math.round((product.price || 45) * 2.8),
      "6": Math.round((product.price || 45) * 4.4),
      "12": Math.round((product.price || 45) * 7.5)
    };

    const payload = {
      code: code,
      name: product.title,
      description: product.description || '',
      icon: product.icon || 'fa-graduation-cap',
      color: product.color || '#5b6cff',
      prices: prices,
      active: product.active !== false
    };

    const check = await sb.from('courses').select('id').eq('code', code).maybeSingle();
    if(check.data){
      await sb.from('courses').update(payload).eq('code', code);
    } else {
      await sb.from('courses').insert(payload);
    }

    await loadCourses();
  }catch(e){ console.warn('syncProductToCourse failed', e); }
}
window.syncProductToCourse = syncProductToCourse;

async function initCourseSystem(){
  await loadCourses();
  try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
}
window.initCourseSystem = initCourseSystem;
