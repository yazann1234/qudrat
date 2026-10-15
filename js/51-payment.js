/* ============================================================
   51) PAYMENT — طويق باي (بدون returnUrl — نعتمد على Webhook)
   - نفتح صفحة الدفع في تاب جديد → المستخدم يعرف يرجع لنا
   - فحص تلقائي كل 5 ثواني + عند رجوع التبويب
   - زر "تحقق يدوي" للأمان
============================================================ */

const PAY = {
  busy: false,
  poll: null,
  cd: null,
  current: null,
  autoChecker: null,   // ← فاحص الخلفية
};
const PAY_FN = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/tuwaiqpay';
const PAY_PENDING_KEY = 'abq_pay_pending';

async function payCall(body, needAuth){
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
  if(needAuth){
    const { data } = await sb.auth.getSession();
    const tok = data && data.session ? data.session.access_token : null;
    if(!tok) throw new Error('not_authenticated');
    headers.Authorization = 'Bearer ' + tok;
  } else {
    headers.Authorization = 'Bearer ' + SUPABASE_ANON_KEY;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try{
    const r = await fetch(PAY_FN, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(j.error || j.message || ('http_' + r.status));
    return j;
  }finally{ clearTimeout(t); }
}

function payErrText(msg){
  msg = String(msg || '');
  const map = {
    coupon_used_up: 'كود الخصم انتهى عدد استخداماته — أزله من السلة',
    coupon_already_used: 'استخدمت كود الخصم هذا من قبل',
    coupon_expired: 'كود الخصم منتهي الصلاحية',
    coupon_invalid: 'كود الخصم غير صحيح',
    course_not_found: 'إحدى الدورات لم تعد متاحة — حدّث السلة',
    price_not_found: 'إحدى الدورات لم تعد متاحة — حدّث السلة',
    cart_empty: 'السلة فاضية',
    too_many_attempts: 'محاولات كثيرة — انتظر شوي وحاول مرة ثانية',
    not_authenticated: 'انتهت جلستك — سجّل الدخول مرة ثانية',
    gateway_not_configured: 'بوابة الدفع قيد التجهيز — تواصل مع الدعم',
    gateway_auth_failed: 'بوابة الدفع غير متاحة حالياً — حاول بعد دقائق',
    aborted: 'الاتصال بطيء — حاول مرة ثانية'
  };
  for(const k in map) if(msg.includes(k)) return map[k];
  if(/abort|network|fetch/i.test(msg)) return 'تأكد من اتصالك بالإنترنت وحاول مرة ثانية';
  return 'تعذّر بدء الدفع — حاول مرة ثانية';
}

function payMoney(v){
  const n = Math.round(Number(v || 0) * 100) / 100;
  return `${n.toLocaleString('en')} ${typeof sarIcon === 'function' ? sarIcon() : 'ريال'}`;
}

function payOverlay(id){
  let o = document.getElementById(id);
  if(!o){
    o = document.createElement('div');
    o.id = id;
    o.className = 'pay-overlay';
    document.body.appendChild(o);
  }
  o.classList.add('open');
  return o;
}
function payCloseAll(){
  ['payCheckout', 'payResult'].forEach(id => { const o = document.getElementById(id); if(o) o.classList.remove('open'); });
  clearInterval(PAY.poll); clearInterval(PAY.cd); PAY.poll = PAY.cd = null;
}
window.payCloseAll = payCloseAll;

const PAY_BRANDS = `
  <span class="pb mada">مدى</span><span class="pb visa">VISA</span>
  <span class="pb master"><i></i><i></i></span><span class="pb amex">AMEX</span>`;

/* ================== 1) صفحة إتمام الدفع ================== */
function payCheckout(items, pv){
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  PAY.current = { items, pv };
  const o = payOverlay('payCheckout');
  const lines = (pv.lines || []).map(l => {
    const c = getCourseById(l.course_id) || { name: l.name, color: '#5b6cff', icon: 'fa-graduation-cap' };
    const dur = l.fixed_end ? 'حتى ' + formatEndDate(l.fixed_end) : monthsLabel(l.months);
    return `<div class="pay-line">
      <div class="pay-line-ic" style="--cc:${c.color || '#5b6cff'}"><i class="fas ${c.icon || 'fa-graduation-cap'}"></i></div>
      <div class="pay-line-info"><b>${escapeHtml(c.name || l.name)}</b><small><i class="fas fa-clock"></i> ${escapeHtml(dur)}</small></div>
      <div class="pay-line-price">${payMoney(l.price)}</div>
    </div>`;
  }).join('');
  const disc = Number(pv.discount) || 0;
  o.innerHTML = `
    <div class="pay-box">
      <button class="pay-x" onclick="payCloseAll()" title="إغلاق"><i class="fas fa-xmark"></i></button>
      <div class="pay-head">
        <div class="pay-lock"><i class="fas fa-lock"></i></div>
        <h2>الدفع الآمن</h2>
        <p>ادفع ببطاقتك ويتفعل اشتراكك <b>فوراً</b> ⚡</p>
      </div>
      <div class="pay-lines">${lines}</div>
      <div class="pay-sum">
        ${disc > 0 ? `<div><span>المجموع</span><b>${payMoney(pv.subtotal)}</b></div>
        <div class="disc"><span><i class="fas fa-ticket"></i> خصم ${escapeHtml(pv.coupon && pv.coupon.code || '')}</span><b>− ${payMoney(disc)}</b></div>` : ''}
        <div class="total"><span>الإجمالي</span><b>${payMoney(pv.total)}</b></div>
      </div>
      <div class="pay-acc"><i class="fas fa-user-circle"></i> يتفعل على حساب: <b>${escapeHtml(currentUserObj.name || '')}</b> <small dir="ltr">${escapeHtml(currentUserObj.email || '')}</small></div>
      <div class="pay-brands">${PAY_BRANDS}</div>
      <button class="pay-btn" id="payNowBtn" onclick="payStart()">
        <i class="fas fa-lock"></i> ادفع ${payMoney(pv.total)}
      </button>
      <div class="pay-msg" id="payMsg"></div>
      <div class="pay-trust">
        <span><i class="fas fa-shield-halved"></i> تشفير SSL</span>
        <span><i class="fas fa-fingerprint"></i> حماية 3D Secure</span>
        <span><i class="fas fa-building-columns"></i> مدعوم من طويق باي</span>
      </div>
      <small class="pay-terms">بالدفع أنت توافق على <button type="button" onclick="openTerms()">الشروط والأحكام وسياسة الاسترجاع</button></small>
      ${typeof trustBadgeHTML === 'function' ? trustBadgeHTML() : ''}
    </div>`;
}
window.payCheckout = payCheckout;

async function payStart(){
  if(PAY.busy || !PAY.current) return;
  const btn = document.getElementById('payNowBtn');
  const msg = document.getElementById('payMsg');
  PAY.busy = true;
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> نجهّز صفحة الدفع...'; }
  if(msg){ msg.className = 'pay-msg'; msg.textContent = ''; }
  try{
    const { items, pv } = PAY.current;
    const res = await payCall({ action: 'create', items, coupon: pv.coupon && pv.coupon.ok ? pv.coupon.code : null }, true);
    try{ localStorage.setItem(PAY_PENDING_KEY, JSON.stringify({ id: res.id, t: res.token, at: Date.now() })); }catch(e){}
    if(res.free){
      payCloseAll();
      payShowResult(res.id, res.token);
      return;
    }
    if(!res.link) throw new Error('bill_failed');

    // ⭐ نفتح البوابة في تاب جديد (بدل ما نطير من الموقع)
    // هذي أفضل تجربة: الطالب يقدر يرجع لموقعنا بسهولة
    const newWin = window.open(res.link, '_blank', 'noopener');
    if(!newWin){
      // لو المتصفح منع النوافذ — نروح مباشرة
      if(btn) btn.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i> نحوّلك...';
      setTimeout(() => { window.location.href = res.link; }, 400);
      return;
    }

    // ⭐ نعرض للطالب تعليمات بعد ما تفتح البوابة
    PAY.busy = false;
    if(btn){ btn.disabled = false; btn.innerHTML = `<i class="fas fa-lock"></i> ادفع ${payMoney(pv.total)}`; }
    payShowPending(res.id, res.token);

  }catch(e){
    PAY.busy = false;
    if(btn){ btn.disabled = false; btn.innerHTML = `<i class="fas fa-lock"></i> ادفع ${payMoney(PAY.current.pv.total)}`; }
    if(msg){ msg.className = 'pay-msg err'; msg.innerHTML = '<i class="fas fa-circle-exclamation"></i> ' + escapeHtml(payErrText(e.message)); }
  }
}
window.payStart = payStart;

/* ================== 2) شاشة "بانتظار الدفع" ==================
   نعرضها في موقعنا، بينما البوابة مفتوحة في تاب ثاني
   نفحص كل 4 ثواني + عند رجوع المستخدم للتبويب
============================================================ */
function payShowPending(id, token){
  const o = payOverlay('payResult');
  let secs = 0;
  const render = () => {
    o.innerHTML = `
      <div class="pay-box pay-res">
        <div class="pay-res-ic wait"><i class="fas fa-hourglass-half"></i></div>
        <h2>بانتظار إتمام الدفع</h2>
        <p>فتحنا لك صفحة الدفع في <b>تاب جديد</b>.<br>
           أكمِل العملية هناك، وبمجرد ما ينجح الدفع <b>سيتفعل اشتراكك تلقائياً</b> هنا 🎉</p>
        <div class="pay-progress"><i></i></div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px">
          <span class="pay-cd" style="font-size:.8rem">
            <i class="fas fa-spinner fa-spin"></i> نتحقق تلقائياً… (${secs}ث)
          </span>
        </div>
        <button class="pay-btn" id="payReopenBtn" style="background:linear-gradient(120deg,#0ea5e9,#0284c7);margin-top:6px">
          <i class="fas fa-arrow-up-right-from-square"></i> فتح صفحة الدفع مرة ثانية
        </button>
        <button class="pay-btn" id="payCheckNowBtn" style="background:linear-gradient(120deg,#16a34a,#15803d);margin-top:6px">
          <i class="fas fa-rotate"></i> تحقّقت ودخلت الدفع — تحقق الآن
        </button>
        <button class="pay-link" id="payCancelWaitBtn">إغلاق ومتابعة لاحقاً</button>
        <p style="font-size:.78rem;color:var(--muted);line-height:1.7;margin-top:6px">
          💡 <b>ملاحظة:</b> حتى لو قفلت الصفحة، الاشتراك يتفعل تلقائياً.
          ترجع للمنصة بأي وقت — يكون جاهز.
        </p>
      </div>`;
    const reopen = document.getElementById('payReopenBtn');
    const check = document.getElementById('payCheckNowBtn');
    const cancel = document.getElementById('payCancelWaitBtn');
    if(reopen) reopen.onclick = () => {
      const p = getPending();
      if(p && p.link) window.open(p.link, '_blank', 'noopener');
      else {
        // ما عندنا رابط محفوظ؟ نطلب واحد جديد من السيرفر
        payCall({ action: 'status', id, t: token }, false).then(r => {
          const link = r && r.payment && r.payment.link;
          if(link) window.open(link, '_blank', 'noopener');
          else toast('انتهت صلاحية الرابط — اطلب طلب جديد من السلة', 'warn');
        }).catch(()=>{});
      }
    };
    if(check) check.onclick = () => checkPaymentNow(id, token, true);
    if(cancel) cancel.onclick = () => { payCloseAll(); toast('تقدر ترجع للمنصة بأي وقت — الاشتراك يتفعل تلقائياً', 'ok'); };
  };
  render();

  // ⭐ فاحص تلقائي كل 4 ثواني
  clearInterval(PAY.poll);
  PAY.poll = setInterval(async () => {
    secs += 4;
    const cd = document.querySelector('#payResult .pay-cd');
    if(cd) cd.innerHTML = `<i class="fas fa-spinner fa-spin"></i> نتحقق تلقائياً… (${secs}ث)`;
    try{
      const r = await payCall({ action: 'status', id, t: token }, false);
      const p = r && r.payment;
      if(p && p.status === 'paid'){
        clearInterval(PAY.poll);
        try{ localStorage.removeItem(PAY_PENDING_KEY); }catch(e){}
        try{ if(typeof cartClearAfterSubmit === 'function') cartClearAfterSubmit(); }catch(e){}
        renderPaid(p);
        payRefreshProfile();
      } else if(p && p.status === 'failed'){
        clearInterval(PAY.poll);
        renderFailed(p);
      } else if(secs > 600){    // 10 دقائق → نوقف
        clearInterval(PAY.poll);
        const cd2 = document.querySelector('#payResult .pay-cd');
        if(cd2) cd2.innerHTML = '⏱️ ننتظرك… الاشتراك يتفعل تلقائياً بمجرد نجاح الدفع';
      }
    }catch(e){}
  }, 4000);
}

function getPending(){
  try{ return JSON.parse(localStorage.getItem(PAY_PENDING_KEY) || 'null'); }catch(e){ return null; }
}

async function checkPaymentNow(id, token, manual){
  if(manual){ toast('نتحقق من الدفع...', 'ok'); }
  try{
    const r = await payCall({ action: 'status', id, t: token }, false);
    const p = r && r.payment;
    if(p && p.status === 'paid'){
      clearInterval(PAY.poll);
      try{ localStorage.removeItem(PAY_PENDING_KEY); }catch(e){}
      try{ if(typeof cartClearAfterSubmit === 'function') cartClearAfterSubmit(); }catch(e){}
      renderPaid(p);
      payRefreshProfile();
      return true;
    } else if(p && p.status === 'failed'){
      clearInterval(PAY.poll);
      renderFailed(p);
      return false;
    } else if(manual){
      toast('لم يصلنا تأكيد الدفع بعد — تأكد إنك أتممت العملية في صفحة الدفع', 'warn');
    }
  }catch(e){
    if(manual) toast('تعذّر التحقق — حاول بعد لحظات', 'err');
  }
  return false;
}

/* ================== شاشة النجاح ================== */
function renderPaid(p){
  const o = payOverlay('payResult');
  const items = (p.items || []).map(l => `<li><i class="fas fa-check"></i> ${escapeHtml(l.name)} — ${l.fixed_end ? 'حتى ' + formatEndDate(l.fixed_end) : monthsLabel(l.months)}</li>`).join('');
  o.innerHTML = `
    <div class="pay-box pay-res">
      <div class="pay-confetti">${'<i></i>'.repeat(24)}</div>
      <div class="pay-res-ic ok"><i class="fas fa-check"></i></div>
      <h2>تم الدفع بنجاح 🎉</h2>
      <p>${p.activated ? 'تم تفعيل اشتراكك — بالتوفيق يا بطل 💙' : 'تم استلام الدفع — جاري تفعيل اشتراكك…'}</p>
      <ul class="pay-res-items">${items}</ul>
      <div class="pay-res-amount">المبلغ المدفوع: <b>${payMoney(p.amount)}</b></div>
      <button class="pay-btn ok" id="payGoBtn"><i class="fas fa-rocket"></i> ابدأ المذاكرة الحين</button>
    </div>`;
  document.getElementById('payGoBtn').addEventListener('click', payAfterSuccess);
}

function renderFailed(p){
  const o = payOverlay('payResult');
  o.innerHTML = `
    <div class="pay-box pay-res">
      <div class="pay-res-ic fail"><i class="fas fa-xmark"></i></div>
      <h2>عملية الدفع لم تستكمل</h2>
      <p>ما تم خصم أي مبلغ. تأكد من <b>رصيد البطاقة</b> أو صلاحيتها، أو جرّب بطاقة ثانية.</p>
      <button class="pay-btn" onclick="payCloseAll();openCart()"><i class="fas fa-cart-shopping"></i> حاول مرة ثانية من السلة</button>
      <a class="pw-support" href="https://wa.me/${(typeof getStoreConfig === 'function' ? getStoreConfig().supportWhatsApp : '966538524983')}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> تحتاج مساعدة؟ الدعم الفني</a>
    </div>`;
}

/* ================== النجاح النهائي ================== */
async function payRefreshProfile(){
  if(!currentUserObj) return;
  for(let i = 0; i < 5; i++){
    try{
      const { data } = await sb.from('profiles').select('*').eq('id', currentUserObj.id).maybeSingle();
      if(data && data.status === 'approved'){
        currentUserObj = data;
        try{ applyUserUI(); }catch(e){}
        const app = document.getElementById('app'); if(app) app.classList.remove('store-only');
        try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
        try{ if(typeof renderSubscriptionInfo === 'function') renderSubscriptionInfo(); }catch(e){}
        return data;
      }
    }catch(e){}
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function payAfterSuccess(){
  payCloseAll();
  if(!currentUserObj){
    try{ if(typeof showAuthScreen === 'function') showAuthScreen(); }catch(e){}
    toast('سجّل دخولك للبدء 🚀', 'ok');
    return;
  }
  await payRefreshProfile();
  try{ if(typeof loadProfilesAndFiles === 'function') loadProfilesAndFiles(); }catch(e){}
  try{ if(typeof loadVideos === 'function') loadVideos(); }catch(e){}
  try{ go('home'); }catch(e){}
}

/* ================== 3) التشغيل عند فتح الموقع ==================
   - نفحص لو فيه دفعة معلّقة (رجع للتبويب أو فتح الموقع)
============================================================ */
(function payBoot(){
  // فحص أول عند فتح الموقع — لو فيه دفعة معلّقة، نتحقق
  const bootCheck = () => {
    const p = getPending();
    if(!p || !p.id) return;
    if(Date.now() - p.at > 6 * 3600 * 1000){ localStorage.removeItem(PAY_PENDING_KEY); return; }
    // ما نعرض النافذة كاملة — نفحص بالخلفية
    setTimeout(async () => {
      try{
        const r = await payCall({ action: 'status', id: p.id, t: p.t }, false);
        const pm = r && r.payment;
        if(pm && pm.status === 'paid'){
          localStorage.removeItem(PAY_PENDING_KEY);
          try{ if(typeof cartClearAfterSubmit === 'function') cartClearAfterSubmit(); }catch(e){}
          renderPaid(pm);
          payRefreshProfile();
        } else if(pm && pm.status === 'failed'){
          localStorage.removeItem(PAY_PENDING_KEY);
        } else if(pm && pm.status === 'pending'){
          // لسه معلّق — نعرض شاشة الانتظار لو المستخدم ما زال مهتم
          payShowPending(p.id, p.t);
        }
      }catch(e){}
    }, 3000);
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCheck);
  else bootCheck();

  // ⭐ فاحص عن رجوع التبويب — لو المستخدم رجع من البوابة
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) return;
    const p = getPending();
    if(!p || !p.id) return;
    setTimeout(() => checkPaymentNow(p.id, p.t, false), 800);
  });
})();
