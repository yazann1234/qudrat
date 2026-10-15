/* ============================================================
   51) PAYMENT — الدفع الإلكتروني عبر طويق باي 💳
   - السلة ← «ادفع الآن» ← صفحة الدفع الآمنة
   - بعد الدفع يرجع الطالب لموقعنا مباشرة (?pay=xxx&t=yyy)
   - نتحقق من السيرفر → يتفعل اشتراكه فوراً 🎉
   - لو فشل → «عملية الدفع لم تستكمل» + إعادة تلقائية
============================================================ */

const PAY = { busy: false, poll: null, cd: null, current: null, visibilityWatcher: null };
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
    site_url_not_configured: 'إعدادات الموقع ناقصة — تواصل مع الدعم',
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
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> نجهّز صفحة الدفع الآمنة...'; }
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
    if(btn) btn.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i> نحوّلك لصفحة الدفع...';
    setTimeout(() => { window.location.href = res.link; }, 350);
  }catch(e){
    PAY.busy = false;
    if(btn){ btn.disabled = false; btn.innerHTML = `<i class="fas fa-lock"></i> ادفع ${payMoney(PAY.current.pv.total)}`; }
    if(msg){ msg.className = 'pay-msg err'; msg.innerHTML = '<i class="fas fa-circle-exclamation"></i> ' + escapeHtml(payErrText(e.message)); }
  }
}
window.payStart = payStart;

/* ================== 2) صفحة الرجوع من البوابة ================== */
function payGatewayHint(){
  try{
    const q = new URLSearchParams(location.search);
    const s = String(q.get('status') || q.get('transactionStatus') || q.get('result') || '').toUpperCase();
    if(/FAIL|DECLIN|REJECT|CANCEL|ERROR|EXPIRE/.test(s)) return 'failed';
    if(/PAID|SUCCESS|APPROV|SETTLE|COMPLETE|CAPTUR/.test(s)) return 'success';
  }catch(e){}
  return '';
}

function payShowResult(id, token, hint){
  const o = payOverlay('payResult');
  const started = Date.now();
  let tries = 0;
  const render = (state, p) => {
    clearInterval(PAY.cd); PAY.cd = null;
    if(state === 'checking'){
      o.innerHTML = `
        <div class="pay-box pay-res">
          <div class="pay-res-ic checking"><i class="fas fa-shield-halved"></i><span class="ring"></span></div>
          <h2>نتحقق من عملية الدفع…</h2>
          <p>لحظات بس — لا تقفل الصفحة 🙏</p>
          <div class="pay-progress"><i></i></div>
        </div>`;
    } else if(state === 'paid'){
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
    } else if(state === 'failed'){
      const link = p && p.link;
      o.innerHTML = `
        <div class="pay-box pay-res">
          <div class="pay-res-ic fail"><i class="fas fa-xmark"></i></div>
          <h2>عملية الدفع لم تستكمل</h2>
          <p>ما تم خصم أي مبلغ. تأكد من <b>رصيد البطاقة</b> أو صلاحيتها، أو جرّب بطاقة ثانية.</p>
          ${link ? `<div class="pay-cd" id="payCd">نرجعك لصفحة الدفع خلال <b>6</b> ثواني…</div>
          <button class="pay-btn" id="payRetryBtn"><i class="fas fa-rotate-right"></i> الرجوع لصفحة الدفع</button>
          <button class="pay-link" id="payStayBtn">إلغاء والبقاء في الموقع</button>` : `
          <button class="pay-btn" onclick="payCloseAll();openCart()"><i class="fas fa-cart-shopping"></i> حاول مرة ثانية من السلة</button>`}
          <a class="pw-support" href="https://wa.me/${(typeof getStoreConfig === 'function' ? getStoreConfig().supportWhatsApp : '966538524983')}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> تحتاج مساعدة؟ الدعم الفني</a>
        </div>`;
      if(link){
        let n = 6;
        PAY.cd = setInterval(() => {
          n--;
          const cd = document.getElementById('payCd');
          if(cd) cd.innerHTML = `نرجعك لصفحة الدفع خلال <b>${n}</b> ثواني…`;
          if(n <= 0){ clearInterval(PAY.cd); window.location.href = link; }
        }, 1000);
        document.getElementById('payRetryBtn').addEventListener('click', () => { clearInterval(PAY.cd); window.location.href = link; });
        document.getElementById('payStayBtn').addEventListener('click', () => { payCloseAll(); try{ localStorage.removeItem(PAY_PENDING_KEY); }catch(e){} });
      }
    } else if(state === 'timeout'){
      const link = p && p.link;
      o.innerHTML = `
        <div class="pay-box pay-res">
          <div class="pay-res-ic wait"><i class="fas fa-hourglass-half"></i></div>
          <h2>الدفع لم يكتمل بعد</h2>
          <p>ما وصلنا تأكيد من البوابة. لو ما أكملت الدفع، ارجع لصفحة الدفع.<br><small>ولو انخصم المبلغ، يتفعل اشتراكك <b>تلقائياً</b> خلال دقائق ويوصلك إشعار.</small></p>
          ${link ? '<button class="pay-btn" id="payBackBtn"><i class="fas fa-credit-card"></i> أكمل الدفع</button>' : ''}
          <button class="pay-link" id="payCheckAgain"><i class="fas fa-rotate"></i> تحقق مرة ثانية</button>
          <button class="pay-link" onclick="payCloseAll()">إغلاق</button>
        </div>`;
      if(link) document.getElementById('payBackBtn').addEventListener('click', () => { window.location.href = link; });
      document.getElementById('payCheckAgain').addEventListener('click', () => payShowResult(id, token));
    }
  };

  render('checking');
  clearInterval(PAY.poll);
  const check = async () => {
    tries++;
    let p = null;
    try{ p = (await payCall({ action: 'status', id, t: token }, false)).payment; }catch(e){}
    if(p && p.status === 'paid'){
      clearInterval(PAY.poll);
      try{ localStorage.removeItem(PAY_PENDING_KEY); }catch(e){}
      try{ if(typeof cartClearAfterSubmit === 'function') cartClearAfterSubmit(); }catch(e){}
      render('paid', p);
      payRefreshProfile();
      return;
    }
    if(p && p.status === 'failed'){ clearInterval(PAY.poll); render('failed', p); return; }
    if(p && hint === 'failed' && Date.now() - started > 6000){ clearInterval(PAY.poll); render('failed', p); return; }
    if(Date.now() - started > 90000){ clearInterval(PAY.poll); render('timeout', p); return; }
  };
  check();
  PAY.poll = setInterval(check, 2500);
}
window.payShowResult = payShowResult;

/* تحديث حساب الطالب بعد التفعيل */
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

/* ================== 3) التشغيل عند فتح الموقع ================== */
(function payBoot(){
  let ret = null;
  try{
    const q = new URLSearchParams(location.search);
    if(q.get('pay') && q.get('t')) ret = { id: q.get('pay'), t: q.get('t'), hint: payGatewayHint() };
    if(ret){
      // ⭐ نظّف الرابط بدون إعادة تحميل (نحتفظ بالهاش)
      const clean = location.pathname + (location.hash || '#home');
      history.replaceState(null, '', clean);
    }
  }catch(e){}

  // ⭐ لو رجعنا من البوابة، نستقبله فوراً بدون انتظار تحميل الصفحة كلها
  if(ret){
    const fire = () => {
      if(typeof window.enterApp === 'function' && !window._appInitialized){
        // ننتظر الإقلاع يكمل
        setTimeout(() => payShowResult(ret.id, ret.t, ret.hint), 600);
      } else {
        setTimeout(() => payShowResult(ret.id, ret.t, ret.hint), 400);
      }
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fire);
    else fire();
  } else {
    // ما فيه params → نتحقق من طلب دفع معلّق (رجع بدون رابط، مثلاً قفل التبويب)
    const run = () => {
      try{
        const pend = JSON.parse(localStorage.getItem(PAY_PENDING_KEY) || 'null');
        if(!pend || !pend.id) return;
        if(Date.now() - pend.at > 6 * 3600 * 1000){ localStorage.removeItem(PAY_PENDING_KEY); return; }
        setTimeout(async () => {
          try{
            const p = (await payCall({ action: 'status', id: pend.id, t: pend.t }, false)).payment;
            if(p && p.status === 'paid') payShowResult(pend.id, pend.t);
            else if(p && p.status === 'failed') localStorage.removeItem(PAY_PENDING_KEY);
          }catch(e){}
        }, 5000);
      }catch(e){}
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  // ⭐ حارس إضافي: لو رجع المستخدم للتبويب ونحن داخل نافذة الدفع، نفحص الحالة
  let watcherFired = false;
  PAY.visibilityWatcher = () => {
    if(document.hidden || watcherFired) return;
    watcherFired = true;
    const o = document.getElementById('payResult');
    if(!o || !o.classList.contains('open')) return;
    try{
      const pend = JSON.parse(localStorage.getItem(PAY_PENDING_KEY) || 'null');
      if(!pend || !pend.id) return;
      payCall({ action: 'status', id: pend.id, t: pend.t }, false).then(r => {
        const p = r && r.payment;
        if(p && p.status === 'paid'){
          try{ localStorage.removeItem(PAY_PENDING_KEY); }catch(e){}
          try{ if(typeof cartClearAfterSubmit === 'function') cartClearAfterSubmit(); }catch(e){}
          payShowResult(pend.id, pend.t);
          payRefreshProfile();
        }
      }).catch(() => {});
    }catch(e){}
    setTimeout(() => { watcherFired = false; }, 4000);
  };
  document.addEventListener('visibilitychange', PAY.visibilityWatcher);
})();
