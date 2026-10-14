/* ============================================================
   44) CART — السلة + أكواد الخصم
   - الطالب يختار الدورة والمدة → تنضاف للسلة
   - يفتح السلة: يشوف الدورات والمدد، يغيّر المدة أو يحذف، يضيف كود خصم
   - «إتمام الدفع» → نفس خطوات الدفع (الآيبان + الإيصال + واتساب)
   - الأسعار والخصم يحسبها السيرفر (preview_cart / submit_cart)
   - لوحة الأدمن: إنشاء أكواد خصم (نسبة أو مبلغ، مرة وحدة أو أكثر، تاريخ انتهاء)
============================================================ */

const CART = { coupon: '', preview: null, busy: false };

function cartKey(){ return 'abq_cart_' + (currentUserObj ? currentUserObj.id : 'guest'); }

function cartGet(){
  try{
    const arr = JSON.parse(localStorage.getItem(cartKey()) || '[]');
    if(!Array.isArray(arr)) return [];
    /* نتجاهل الدورات اللي انحذفت أو انخفت */
    return arr.filter(it => it && it.course_id && getCourseById(it.course_id));
  }catch(e){ return []; }
}
function cartSet(items){
  try{ localStorage.setItem(cartKey(), JSON.stringify(items || [])); }catch(e){}
  CART.preview = null;
  renderCartFab();
  try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
}
function cartHas(courseId){ return cartGet().some(it => String(it.course_id) === String(courseId)); }
window.cartHas = cartHas;

function cartAdd(courseId, months){
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  const c = getCourseById(courseId);
  if(!c) return;
  const items = cartGet().filter(it => String(it.course_id) !== String(courseId));
  items.push({ course_id: c.id, months: parseInt(months, 10) || 1 });
  cartSet(items);
  toast(`🛒 أُضيفت «${c.name}» للسلة`, 'ok');
  const fab = document.getElementById('cartFab');
  if(fab){ fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); }
}
window.cartAdd = cartAdd;

function cartRemove(courseId){
  cartSet(cartGet().filter(it => String(it.course_id) !== String(courseId)));
  renderCartModal();
}
window.cartRemove = cartRemove;

function cartSetMonths(courseId, months){
  const items = cartGet();
  const it = items.find(x => String(x.course_id) === String(courseId));
  if(it) it.months = parseInt(months, 10) || 1;
  cartSet(items);
  renderCartModal();
}
window.cartSetMonths = cartSetMonths;

/* سعر البند محلياً (للعرض فقط — السيرفر يعيد الحساب) */
function cartLineLocal(it){
  const c = getCourseById(it.course_id);
  if(!c) return null;
  if(c.subscription_end_date){
    return { course: c, months: monthsUntilFixedEnd(c), price: getCourseDisplayPrice(c), fixed: true };
  }
  return { course: c, months: it.months, price: Number((c.prices || {})[String(it.months)]) || 0, fixed: false };
}

/* ================== زر السلة العائم ================== */
function renderCartFab(){
  let fab = document.getElementById('cartFab');
  if(!fab){
    fab = document.createElement('button');
    fab.id = 'cartFab';
    fab.className = 'cart-fab';
    fab.type = 'button';
    fab.title = 'السلة';
    fab.addEventListener('click', openCart);
    document.body.appendChild(fab);
  }
  const n = currentUserObj ? cartGet().length : 0;
  const storeOpen = !!(document.getElementById('view-store') || {}).classList?.contains('active');
  const html = `<i class="fas fa-cart-shopping"></i><span>السلة</span>${n ? `<b>${n}</b>` : ''}`;
  if(fab.innerHTML !== html) fab.innerHTML = html;
  fab.style.display = currentUserObj && (n > 0 || storeOpen) ? 'flex' : 'none';
  const reader = document.getElementById('reader');
  if(reader && reader.classList.contains('open')) fab.style.display = 'none';
}
window.renderCartFab = renderCartFab;

/* ================== نافذة السلة ================== */
function openCart(){
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  let m = document.getElementById('cartModal');
  if(!m){
    m = document.createElement('div');
    m.id = 'cartModal';
    m.className = 'cart-overlay';
    m.addEventListener('click', e => { if(e.target === m) closeCart(); });
    document.body.appendChild(m);
  }
  m.classList.add('open');
  renderCartModal();
  refreshCartPreview();
}
window.openCart = openCart;

function closeCart(){
  const m = document.getElementById('cartModal');
  if(m) m.classList.remove('open');
}
window.closeCart = closeCart;

function money(v){
  const n = Math.round(Number(v || 0) * 100) / 100;
  return `${n.toLocaleString('en')} ${typeof sarIcon === 'function' ? sarIcon() : 'ريال'}`;
}

function renderCartModal(){
  const m = document.getElementById('cartModal');
  if(!m || !m.classList.contains('open')) return;
  const items = cartGet();
  const lines = items.map(cartLineLocal).filter(Boolean);
  const pv = CART.preview;
  const subtotal = pv ? Number(pv.subtotal) : lines.reduce((a, b) => a + b.price, 0);
  const discount = pv ? Number(pv.discount) || 0 : 0;
  const total = pv ? Number(pv.total) : subtotal;
  const cp = pv && pv.coupon;
  const pending = currentUserObj && currentUserObj.purchase_submitted;

  const couponMsg = !CART.coupon ? '' : !pv ? '<div class="cart-cp-msg"><i class="fas fa-spinner fa-spin"></i> نتحقق من الكود...</div>'
    : (cp && cp.ok) ? `<div class="cart-cp-msg ok"><i class="fas fa-circle-check"></i> تم تطبيق الكود <b dir="ltr">${escapeHtml(cp.code)}</b> — خصم ${cp.kind === 'percent' ? Number(cp.value) + '%' : money(cp.value)}</div>`
    : `<div class="cart-cp-msg bad"><i class="fas fa-circle-xmark"></i> ${couponReasonText(cp && cp.reason)}</div>`;

  m.innerHTML = `
    <div class="cart-box">
      <div class="cart-head">
        <b><i class="fas fa-cart-shopping"></i> سلة المشتريات <small>(${lines.length})</small></b>
        <button class="cart-x" onclick="closeCart()"><i class="fas fa-xmark"></i></button>
      </div>
      ${!lines.length ? `
        <div class="cart-empty">
          <i class="fas fa-cart-arrow-down"></i>
          <b>سلتك فاضية</b>
          <small>اختر الدورة والمدة من المتجر وأضفها للسلة</small>
          <button class="btn btn-primary" onclick="closeCart();go('store')"><i class="fas fa-store"></i> اذهب للمتجر</button>
        </div>` : `
        ${pending ? '<div class="cart-warn"><i class="fas fa-circle-info"></i> عندك طلب سابق قيد المراجعة — إرسال طلب جديد يستبدله.</div>' : ''}
        <div class="cart-items">
          ${lines.map(l => {
            const prices = l.course.prices || {};
            const opts = (COURSE_DURATIONS || []).filter(d => Number(prices[String(d.m)]) > 0);
            return `
            <div class="cart-item" style="--cc:${l.course.color || '#5b6cff'}">
              <div class="ci-ic"><i class="fas ${l.course.icon || 'fa-graduation-cap'}"></i></div>
              <div class="ci-info">
                <b>${escapeHtml(l.course.name)}</b>
                ${l.fixed
                  ? `<small><i class="fas fa-calendar-check"></i> اشتراك حتى ${escapeHtml(formatEndDate(l.course.subscription_end_date))}</small>`
                  : `<label class="ci-dur"><i class="fas fa-clock"></i> المدة:
                      <select onchange="cartSetMonths('${l.course.id}', this.value)">
                        ${opts.map(d => `<option value="${d.m}" ${d.m === l.months ? 'selected' : ''}>${d.long}</option>`).join('')}
                      </select></label>`}
              </div>
              <div class="ci-price">${money(l.price)}</div>
              <button class="ci-del" onclick="cartRemove('${l.course.id}')" title="حذف"><i class="fas fa-trash-can"></i></button>
            </div>`;
          }).join('')}
        </div>

        <div class="cart-coupon">
          <label><i class="fas fa-ticket"></i> كود الخصم</label>
          <div class="cart-cp-row">
            <input type="text" id="cartCouponInput" dir="ltr" placeholder="مثال: SAVE20" value="${escapeHtml(CART.coupon)}" ${CART.coupon && cp && cp.ok ? 'disabled' : ''}>
            ${CART.coupon && cp && cp.ok
              ? '<button class="btn btn-ghost btn-sm" onclick="cartClearCoupon()"><i class="fas fa-xmark"></i> إزالة</button>'
              : '<button class="btn btn-primary btn-sm" onclick="cartApplyCoupon()">تطبيق</button>'}
          </div>
          ${couponMsg}
        </div>

        <div class="cart-sum">
          <div><span>المجموع</span><b>${money(subtotal)}</b></div>
          ${discount > 0 ? `<div class="disc"><span>الخصم</span><b>− ${money(discount)}</b></div>` : ''}
          <div class="total"><span>الإجمالي</span><b>${money(total)}</b></div>
        </div>

        <button class="btn btn-primary cart-checkout" onclick="cartCheckout()" ${CART.busy ? 'disabled' : ''}>
          <i class="fas fa-lock"></i> إتمام الدفع — ${money(total)}
        </button>
        <button class="btn btn-ghost cart-more" onclick="closeCart();go('store')"><i class="fas fa-plus"></i> أضف دورة ثانية</button>
      `}
      ${trustBadgeHTML()}
    </div>`;

  const inp = document.getElementById('cartCouponInput');
  if(inp) inp.addEventListener('keydown', e => { if(e.key === 'Enter') cartApplyCoupon(); });
}

function couponReasonText(r){
  return ({
    invalid: 'الكود غير صحيح',
    expired: 'الكود منتهي الصلاحية',
    used_up: 'الكود انتهى عدد استخداماته',
    already_used: 'استخدمت هذا الكود من قبل'
  })[r] || 'تعذّر التحقق من الكود';
}

async function refreshCartPreview(){
  const items = cartGet();
  if(!items.length){ CART.preview = null; renderCartModal(); return null; }
  try{
    const { data, error } = await sb.rpc('preview_cart', { p_items: items, p_code: CART.coupon || null });
    if(error) throw error;
    CART.preview = data;
  }catch(e){
    console.warn('[cart] preview', e);
    CART.preview = null;
    const msg = String(e.message || '');
    if(/course_not_found|price_not_found/.test(msg)) toast('إحدى الدورات في السلة لم تعد متاحة — احذفها', 'warn');
  }
  renderCartModal();
  return CART.preview;
}

window.cartApplyCoupon = async () => {
  const inp = document.getElementById('cartCouponInput');
  const code = (inp ? inp.value : '').trim().toUpperCase();
  if(!code){ toast('اكتب كود الخصم', 'warn'); return; }
  CART.coupon = code;
  CART.preview = null;
  renderCartModal();
  const pv = await refreshCartPreview();
  if(pv && pv.coupon && pv.coupon.ok) toast('🎉 تم تطبيق كود الخصم', 'ok');
};

window.cartClearCoupon = () => {
  CART.coupon = '';
  refreshCartPreview();
};

window.cartCheckout = async () => {
  const items = cartGet();
  if(!items.length) return;
  CART.busy = true; renderCartModal();
  const pv = await refreshCartPreview();
  CART.busy = false;
  if(!pv){ toast('تعذّر حساب السلة — حاول مرة ثانية', 'err'); renderCartModal(); return; }
  if(CART.coupon && !(pv.coupon && pv.coupon.ok)){
    toast('كود الخصم غير صالح — أزله أو صحّحه', 'warn'); renderCartModal(); return;
  }
  closeCart();
  openCartPurchase(items, pv);
};

/* يفتح نافذة الدفع المعتادة بمحتويات السلة */
function openCartPurchase(items, pv){
  currentPurchaseData = {
    cart: true,
    items: items,
    coupon: (pv.coupon && pv.coupon.ok) ? pv.coupon.code : null,
    lines: (pv.lines || []).map(l => ({
      course: getCourseById(l.course_id) || { id: l.course_id, name: l.name },
      months: Number(l.months) || 1, price: Number(l.price) || 0, fixed_end: l.fixed_end || null
    })),
    subtotal: Number(pv.subtotal) || 0,
    discount: Number(pv.discount) || 0,
    total: Number(pv.total) || 0
  };
  renderPurchaseModal();
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.add('open');
}
window.openCartPurchase = openCartPurchase;

window.cartClearAfterSubmit = () => {
  CART.coupon = ''; CART.preview = null;
  cartSet([]);
};

/* ================== شارة التوثيق (نفس «من نحن») ================== */
function trustBadgeHTML(){
  return `
    <div class="trust-mini">
      <div class="tm-logos">
        <img src="assets/trust/logo.png" alt="عباقرة القدرات">
        <span class="tf-x"></span>
        <img src="assets/trust/sbc.png" alt="المركز السعودي للأعمال" loading="lazy">
      </div>
      <div class="tm-txt">
        <b>التجارة الإلكترونية : <span dir="ltr">0000333664</span></b>
        <small><i class="fas fa-circle-check"></i> موثّق لدى المركز السعودي للأعمال</small>
      </div>
    </div>`;
}
window.trustBadgeHTML = trustBadgeHTML;

/* ============================================================
   🎟️ لوحة الأدمن: أكواد الخصم
============================================================ */
async function renderAdminCoupons(){
  const box = document.getElementById('adminCouponsList');
  if(!box || !isPrivileged()) return;
  box.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin" style="font-size:1.4rem;color:var(--primary)"></i></div>';
  const { data, error } = await sb.from('coupons').select('*').order('created_at', { ascending: false });
  if(error){
    box.innerHTML = `<div class="adm-course-warn"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(error.message)} — شغّل ملف supabase-update-7.sql</div>`;
    return;
  }
  const list = data || [];
  if(!list.length){
    box.innerHTML = '<div class="admin-empty"><div class="em-ic"><i class="fas fa-ticket"></i></div><h3>لا توجد أكواد</h3><p>أنشئ أول كود خصم من الأعلى</p></div>';
    return;
  }
  const now = Date.now();
  box.innerHTML = list.map(c => {
    const expired = c.expires_at && new Date(c.expires_at).getTime() < now;
    const usedUp = c.max_uses != null && c.used_count >= c.max_uses;
    const state = !c.active ? ['off', 'موقوف'] : expired ? ['off', 'منتهي'] : usedUp ? ['off', 'مستخدم بالكامل'] : ['on', 'فعّال'];
    return `
      <div class="cp-card ${state[0]}">
        <div class="cp-top">
          <code dir="ltr" onclick="copyTxt('${escapeHtml(c.code)}')" title="نسخ">${escapeHtml(c.code)}</code>
          <span class="cp-state ${state[0]}">${state[1]}</span>
        </div>
        <div class="cp-val">${c.kind === 'percent' ? `خصم ${Number(c.value)}%` : `خصم ${money(c.value)}`}</div>
        <div class="cp-meta">
          <span><i class="fas fa-repeat"></i> ${c.max_uses == null ? 'استخدام غير محدود' : c.max_uses === 1 ? 'مرة واحدة فقط' : c.max_uses + ' مرات'}</span>
          <span><i class="fas fa-users"></i> استُخدم ${c.used_count} ${c.max_uses != null ? '/ ' + c.max_uses : ''}</span>
          <span><i class="fas fa-calendar"></i> ${c.expires_at ? 'ينتهي ' + new Date(c.expires_at).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn') : 'بدون تاريخ انتهاء'}</span>
          ${c.note ? `<span><i class="fas fa-note-sticky"></i> ${escapeHtml(c.note)}</span>` : ''}
        </div>
        <div class="cp-actions">
          <button class="btn btn-ghost btn-sm" onclick="toggleCoupon('${c.id}', ${!c.active})">${c.active ? '<i class="fas fa-pause"></i> إيقاف' : '<i class="fas fa-play"></i> تفعيل'}</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteCoupon('${c.id}','${escapeHtml(c.code)}')"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>`;
  }).join('');
}
window.renderAdminCoupons = renderAdminCoupons;

window.createCoupon = async () => {
  if(!isPrivileged()) return;
  const v = id => (document.getElementById(id) || {}).value || '';
  let code = v('cpCode').trim().toUpperCase().replace(/\s+/g, '');
  const kind = v('cpKind') || 'percent';
  const value = parseFloat(v('cpValue'));
  const usage = v('cpUsage');
  const maxN = parseInt(v('cpMax'), 10);
  const exp = v('cpExpires');
  const note = v('cpNote').trim();

  if(!code) code = 'ABQ' + Math.random().toString(36).slice(2, 7).toUpperCase();
  if(!/^[A-Z0-9_-]{3,30}$/.test(code)){ toast('الكود: حروف إنجليزية وأرقام فقط (3-30)', 'warn'); return; }
  if(!(value > 0)){ toast('أدخل قيمة الخصم', 'warn'); return; }
  if(kind === 'percent' && value > 100){ toast('النسبة لا تتجاوز 100%', 'warn'); return; }

  let max_uses = null;
  if(usage === 'once') max_uses = 1;
  else if(usage === 'limited'){
    if(!(maxN > 0)){ toast('أدخل عدد مرات الاستخدام', 'warn'); return; }
    max_uses = maxN;
  }
  const payload = {
    code, kind, value, max_uses, note: note || null, active: true,
    expires_at: exp ? new Date(exp + 'T23:59:59').toISOString() : null,
    created_by: currentUserObj ? currentUserObj.id : null
  };
  const { error } = await sb.from('coupons').insert(payload);
  if(error){
    toast(/duplicate|unique/i.test(error.message) ? 'هذا الكود موجود مسبقاً' : 'فشل: ' + error.message, 'err');
    return;
  }
  if(typeof logAdminAction === 'function') logAdminAction('update_settings', null, 'إنشاء كود خصم: ' + code, payload);
  toast(`✓ تم إنشاء الكود ${code}`, 'ok');
  ['cpCode', 'cpValue', 'cpMax', 'cpExpires', 'cpNote'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  renderAdminCoupons();
};

window.toggleCoupon = async (id, active) => {
  const { error } = await sb.from('coupons').update({ active }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  renderAdminCoupons();
};

window.deleteCoupon = (id, code) => {
  confirmBox('حذف كود الخصم', `حذف الكود «${code}» نهائياً؟`, async () => {
    const { error } = await sb.from('coupons').delete().eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    toast('تم الحذف', 'warn');
    renderAdminCoupons();
  }, true);
};

document.addEventListener('click', e => {
  const tab = e.target.closest('.admin-tabs button[data-panel="coupons"]');
  if(tab) setTimeout(renderAdminCoupons, 50);
});

document.addEventListener('change', e => {
  if(e.target && e.target.id === 'cpUsage'){
    const w = document.getElementById('cpMaxWrap');
    if(w) w.style.display = e.target.value === 'limited' ? 'block' : 'none';
  }
  if(e.target && e.target.id === 'cpKind'){
    const u = document.getElementById('cpValueUnit');
    if(u) u.textContent = e.target.value === 'percent' ? '%' : 'ريال';
  }
});

/* إظهار زر السلة عند الدخول وعند التنقل */
document.addEventListener('DOMContentLoaded', () => {
  const st = document.getElementById('storeTrust');
  if(st) st.innerHTML = trustBadgeHTML();
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if(currentUserObj){ clearInterval(t); renderCartFab(); }
    else if(tries > 60) clearInterval(t);
  }, 1000);
  setInterval(renderCartFab, 1500);
});
