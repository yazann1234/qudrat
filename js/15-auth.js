/* ============================================================
   15) AUTH — مصادقة كاملة (نسخة مُصلحة نهائية)
============================================================ */

/* ================== إظهار/إخفاء شاشة auth ================== */
function showAuth(){
  const a = document.getElementById('auth');
  if(a) a.classList.add('open');
}
function hideAuth(){
  const a = document.getElementById('auth');
  if(a) a.classList.remove('open');
}
window.showAuth = showAuth;
window.hideAuth = hideAuth;

/* ================== تبديل التبويبات (دخول/تسجيل/أدمن) ================== */
function showAuthForm(tab){
  try{
    document.querySelectorAll('.auth-tabs button').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('on'));
    const el = document.getElementById('form-' + tab);
    if(el) el.classList.add('on');
    ['loginMsg','regMsg','adminMsg'].forEach(id => {
      const m = document.getElementById(id);
      if(m){ m.className = 'auth-msg'; m.textContent = ''; }
    });
  }catch(e){ console.warn('showAuthForm error:', e); }
}
window.showAuthForm = showAuthForm;

/* ================== عرض رسائل داخل auth ================== */
function showMsg(elId, text, type){
  type = type || 'err';
  const el = document.getElementById(elId);
  if(!el) return;
  el.innerHTML = '<i class="fas ' + (type === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation') + '"></i> ' + escapeHtml(text);
  el.className = 'auth-msg ' + type;
}
window.showMsg = showMsg;

/* ================== تسجيل الدخول ================== */
async function doLogin(){
  const btn = document.getElementById('loginBtn');
  if(!btn || btn.disabled) return;

  const emailEl = document.getElementById('loginEmail');
  const passEl  = document.getElementById('loginPass');
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass  = passEl ? passEl.value : '';

  if(!email || !pass){ showMsg('loginMsg', 'أدخل البريد وكلمة المرور'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> دخول...';

  try{
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      const m = error.message === 'Invalid login credentials'
        ? 'البريد أو كلمة المرور غير صحيحة'
        : (error.message || 'خطأ');
      showMsg('loginMsg', m);
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }
    showMsg('loginMsg', '✓ تم الدخول — جاري فتح حسابك...', 'ok');
    /* ⭐ احتياط: لو ما وصل حدث onAuthStateChange نفتح الحساب بأنفسنا (بدون تكرار) */
    setTimeout(async () => {
      try{
        const appOpen = document.getElementById('app') && document.getElementById('app').classList.contains('open');
        if(!appOpen && typeof window.enterApp === 'function'){
          const r = await sb.auth.getSession();
          if(r.data.session){ session = r.data.session; await window.enterApp(); }
        }
      }catch(e){}
      btn.disabled = false; btn.innerHTML = orig;
    }, 1500);
  }catch(e){
    showMsg('loginMsg', e.message || 'خطأ');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doLogin = doLogin;

/* ================== تسجيل حساب جديد ================== */
async function doRegister(){
  const btn = document.getElementById('regBtn');
  if(!btn || btn.disabled) return;

  const nameEl  = document.getElementById('regName');
  const emailEl = document.getElementById('regEmail');
  const passEl  = document.getElementById('regPass');
  const phoneEl = document.getElementById('regPhone');

  const name  = (nameEl  ? nameEl.value  : '').trim();
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass  = passEl   ? passEl.value  : '';
  const phone = (phoneEl ? phoneEl.value : '').trim();

  if(!name || name.length < 2){ showMsg('regMsg', 'أدخل اسماً صحيحاً'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('regMsg', 'بريد غير صحيح'); return; }
  if(!pass || pass.length < 8){ showMsg('regMsg', 'كلمة المرور 8 أحرف على الأقل'); return; }

  const termsEl = document.getElementById('regTerms');
  if(termsEl && !termsEl.checked){
    showMsg('regMsg', 'يجب الموافقة على الشروط والأحكام وسياسة الاسترجاع');
    if(typeof openTerms === 'function') openTerms();
    return;
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if(!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('05')){
    showMsg('regMsg', 'رقم جوال صحيح يبدأ بـ 05');
    return;
  }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> إنشاء...';

  /* ⭐ حساب واحد فقط لكل جهاز */
  try{
    if(typeof checkDeviceCanRegister === 'function'){
      const chk = await checkDeviceCanRegister();
      if(!chk.allowed){ showMsg('regMsg', chk.msg); btn.disabled = false; btn.innerHTML = orig; return; }
    }
  }catch(e){}

  try{
    const { data, error } = await sb.auth.signUp({
      email, password: pass,
      options: { data: { name, phone: cleanPhone } }
    });

    if(error){ showMsg('regMsg', error.message); btn.disabled = false; btn.innerHTML = orig; return; }

    /* احفظ محلياً + حدّث DB في الخلفية */
    try{
      if(data && data.user){
        if(typeof markDeviceOwner === 'function') markDeviceOwner(data.user.id);
        sessionStorage.setItem('pending_pass_' + data.user.id, pass);
        localStorage.setItem('pending_pass_' + data.user.id, pass);
        sb.from('profiles').update({ password_hint: pass, phone: cleanPhone })
          .eq('id', data.user.id).then(()=>{}).catch(()=>{});
      }
    }catch(e){}

    showMsg('regMsg', '✓ تم إنشاء حسابك! بانتظار موافقة الأدمن', 'ok');
    setTimeout(() => {
      if(data && data.session){
        /* سيتم الدخول عبر onAuthStateChange */
      } else {
        showAuthForm('login');
      }
    }, 1200);

    btn.disabled = false;
    btn.innerHTML = orig;
  }catch(e){
    showMsg('regMsg', e.message || 'خطأ');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doRegister = doRegister;

/* ================== دخول الأدمن ================== */
async function doAdminLogin(){
  const btn = document.getElementById('adminBtn');
  if(!btn || btn.disabled) return;

  const emailEl = document.getElementById('adminEmail');
  const passEl  = document.getElementById('adminPass');
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass  = passEl  ? passEl.value  : '';

  if(!email || !pass){ showMsg('adminMsg', 'أدخل البريد وكلمة المرور'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> تحقق...';

  try{
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){ showMsg('adminMsg', 'بيانات خاطئة'); btn.disabled = false; btn.innerHTML = orig; return; }

    const r = await sb.from('profiles').select('role').eq('id', data.user.id).single();
    if(r.error || !r.data || (r.data.role !== 'admin' && r.data.role !== 'owner')){
      await sb.auth.signOut();
      showMsg('adminMsg', 'ليس حساب أدمن');
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }
    showMsg('adminMsg', '✓ مرحباً', 'ok');
  }catch(e){
    showMsg('adminMsg', e.message || 'خطأ');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doAdminLogin = doAdminLogin;

/* ============================================================
   🔑 نسيت كلمة المرور — تجربة كاملة وسلسة
   1) الطالب يكتب بريده → يوصله رابط (يشتغل من أي تبويب/جهاز)
   2) يضغط الرابط → تطلع له شاشة «كلمة مرور جديدة» مباشرة
   3) يحفظ → يدخل حسابه فوراً
   + رابط منتهي؟ يطلب رابط جديد من نفس الشاشة
   + ما وصله الإيميل؟ زر الدعم واتساب
============================================================ */
let _pwCooldownUntil = 0;

function pwOverlay(){
  let o = document.getElementById('pwReset');
  if(!o){
    o = document.createElement('div');
    o.id = 'pwReset';
    o.className = 'pw-overlay';
    document.body.appendChild(o);
  }
  o.classList.add('open');
  return o;
}
function pwClose(){
  const o = document.getElementById('pwReset');
  if(o) o.classList.remove('open');
}
window.pwClose = pwClose;

function pwSupportLink(){
  const num = (typeof getStoreConfig === 'function' ? getStoreConfig().supportWhatsApp : '') || '966538524983';
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent('السلام عليكم، نسيت كلمة المرور وما وصلني رابط الاستعادة 🙏');
}

function pwFriendlyError(msg){
  msg = String(msg || '');
  if(/rate limit|too many|only request this after|security purposes/i.test(msg)){
    const m = /(\d+)\s*second/i.exec(msg);
    return m ? `انتظر ${m[1]} ثانية قبل طلب رابط جديد` : 'طلبت روابط كثيرة — انتظر دقائق وحاول مرة ثانية';
  }
  if(/network|fetch/i.test(msg)) return 'تأكد من اتصالك بالإنترنت وحاول مرة ثانية';
  if(/same.*password|different from the old/i.test(msg)) return 'كلمة المرور الجديدة لازم تختلف عن القديمة';
  if(/weak|at least|short/i.test(msg)) return 'كلمة المرور ضعيفة — خلها 8 أحرف أو أكثر';
  if(/expired|invalid|otp/i.test(msg)) return 'الرابط منتهي أو مستخدم — اطلب رابط جديد';
  return msg || 'حدث خطأ غير متوقع';
}

/* ---------- الخطوة 1: طلب الرابط ---------- */
function doForgotPassword(prefill){
  const o = pwOverlay();
  const email = (typeof prefill === 'string' && prefill) || ((document.getElementById('loginEmail') || {}).value || '').trim();
  o.innerHTML = `
    <div class="pw-box">
      <button class="pw-x" onclick="pwClose()" title="إغلاق"><i class="fas fa-xmark"></i></button>
      <div class="pw-ic"><i class="fas fa-key"></i></div>
      <h2>نسيت كلمة المرور؟</h2>
      <p>اكتب بريدك المسجّل ونرسل لك رابط تعيّن فيه كلمة مرور جديدة خلال ثواني.</p>
      <div class="pw-field">
        <i class="fas fa-envelope"></i>
        <input type="email" id="pwEmail" dir="ltr" placeholder="example@email.com" autocomplete="email" value="${escapeHtml(email)}">
      </div>
      <div class="pw-msg" id="pwMsg"></div>
      <button class="btn btn-primary pw-main" id="pwSend"><i class="fas fa-paper-plane"></i> أرسل رابط الاستعادة</button>
      <button class="pw-link" onclick="pwClose()"><i class="fas fa-arrow-right"></i> رجوع لتسجيل الدخول</button>
    </div>`;
  const inp = document.getElementById('pwEmail');
  setTimeout(() => { try{ inp.focus(); }catch(e){} }, 80);
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') pwSendLink(); });
  document.getElementById('pwSend').addEventListener('click', pwSendLink);
}
window.doForgotPassword = doForgotPassword;

async function pwSendLink(){
  const btn = document.getElementById('pwSend');
  const msg = document.getElementById('pwMsg');
  const email = ((document.getElementById('pwEmail') || {}).value || '').trim().toLowerCase();
  const show = (t, ok) => { if(msg){ msg.className = 'pw-msg ' + (ok ? 'ok' : 'err'); msg.innerHTML = t; } };
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ show('<i class="fas fa-circle-exclamation"></i> اكتب بريد إلكتروني صحيح'); return; }
  const left = Math.ceil((_pwCooldownUntil - Date.now()) / 1000);
  if(left > 0){ show(`<i class="fas fa-hourglass-half"></i> انتظر ${left} ثانية قبل طلب رابط جديد`); return; }
  if(btn.disabled) return;
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
  try{
    const { error } = await sbRecovery.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT });
    if(error) throw error;
    _pwCooldownUntil = Date.now() + 60000;
    pwShowSent(email);
  }catch(e){
    show('<i class="fas fa-circle-exclamation"></i> ' + escapeHtml(pwFriendlyError(e.message)));
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> أرسل رابط الاستعادة';
  }
}

function pwShowSent(email){
  const o = pwOverlay();
  o.innerHTML = `
    <div class="pw-box">
      <button class="pw-x" onclick="pwClose()" title="إغلاق"><i class="fas fa-xmark"></i></button>
      <div class="pw-ic ok"><i class="fas fa-envelope-circle-check"></i></div>
      <h2>تم إرسال الرابط ✉️</h2>
      <p>أرسلنا رابط الاستعادة إلى<br><b dir="ltr">${escapeHtml(email)}</b></p>
      <ul class="pw-tips">
        <li><i class="fas fa-check"></i> افتح الإيميل واضغط على الرابط (صالح لمدة ساعة)</li>
        <li><i class="fas fa-check"></i> ما لقيته؟ شيّك على مجلد <b>الرسائل غير المرغوبة (Spam)</b></li>
        <li><i class="fas fa-check"></i> الرابط يشتغل من الجوال أو الكمبيوتر</li>
      </ul>
      <button class="btn btn-ghost pw-main" id="pwResend" disabled><i class="fas fa-rotate"></i> إعادة الإرسال <span id="pwCd">(60)</span></button>
      <a class="pw-support" href="${pwSupportLink()}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> ما وصلني الإيميل — تواصل مع الدعم</a>
      <button class="pw-link" onclick="pwClose()"><i class="fas fa-arrow-right"></i> رجوع لتسجيل الدخول</button>
    </div>`;
  const rb = document.getElementById('pwResend');
  const t = setInterval(() => {
    const left = Math.ceil((_pwCooldownUntil - Date.now()) / 1000);
    const cd = document.getElementById('pwCd');
    if(!cd){ clearInterval(t); return; }
    if(left > 0){ cd.textContent = `(${left})`; }
    else { clearInterval(t); cd.textContent = ''; rb.disabled = false; }
  }, 1000);
  rb.addEventListener('click', () => doForgotPassword(email));
}

/* ---------- الخطوة 2: الطالب فتح الرابط ---------- */
async function handlePasswordRecovery(){
  const r = window.__AUTH_RECOVERY;
  if(!r) return;
  window.__AUTH_RECOVERY = null;
  window.__PW_RECOVERING = true;
  const o = pwOverlay();
  o.innerHTML = `<div class="pw-box"><div class="pw-ic"><i class="fas fa-spinner fa-spin"></i></div><h2>نتحقق من الرابط...</h2></div>`;
  try{
    if(r.error) throw new Error(r.error === 'no_token' ? 'invalid' : (r.desc || r.error));
    let res;
    if(r.access_token) res = await sb.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    else if(r.code) res = await sb.auth.exchangeCodeForSession(r.code);
    if(!res || res.error || !res.data || !res.data.session) throw new Error((res && res.error && res.error.message) || 'invalid');
    session = res.data.session;
    pwShowNewPassword(res.data.session.user && res.data.session.user.email);
  }catch(e){
    window.__PW_RECOVERING = false;
    pwShowExpired();
  }
}
window.handlePasswordRecovery = handlePasswordRecovery;

function pwShowExpired(){
  const o = pwOverlay();
  o.innerHTML = `
    <div class="pw-box">
      <button class="pw-x" onclick="pwClose()" title="إغلاق"><i class="fas fa-xmark"></i></button>
      <div class="pw-ic warn"><i class="fas fa-link-slash"></i></div>
      <h2>الرابط منتهي أو مستخدم</h2>
      <p>روابط الاستعادة تشتغل مرة وحدة ولمدة ساعة فقط. لا تشيل هم — اطلب رابط جديد الحين 👇</p>
      <button class="btn btn-primary pw-main" onclick="doForgotPassword()"><i class="fas fa-paper-plane"></i> اطلب رابط جديد</button>
      <a class="pw-support" href="${pwSupportLink()}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> تواصل مع الدعم</a>
    </div>`;
}

function pwStrength(p){
  let s = 0;
  if(p.length >= 8) s++;
  if(p.length >= 12) s++;
  if(/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if(/\d/.test(p)) s++;
  if(/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

function pwShowNewPassword(email){
  const o = pwOverlay();
  const eye = id => `<button type="button" class="pw-eye" onclick="togglePassVis('${id}',this)"><i class="fas fa-eye"></i></button>`;
  o.innerHTML = `
    <div class="pw-box">
      <div class="pw-ic"><i class="fas fa-lock-open"></i></div>
      <h2>كلمة مرور جديدة</h2>
      <p>${email ? `للحساب <b dir="ltr">${escapeHtml(email)}</b><br>` : ''}اختر كلمة مرور قوية وسهلة تتذكرها.</p>
      <div class="pw-field"><i class="fas fa-lock"></i><input type="password" id="pwNew1" dir="ltr" placeholder="كلمة المرور الجديدة" autocomplete="new-password">${eye('pwNew1')}</div>
      <div class="pw-meter"><i id="pwMeter"></i></div>
      <small class="pw-meter-txt" id="pwMeterTxt">8 أحرف على الأقل</small>
      <div class="pw-field"><i class="fas fa-lock"></i><input type="password" id="pwNew2" dir="ltr" placeholder="أعد كتابة كلمة المرور" autocomplete="new-password">${eye('pwNew2')}</div>
      <div class="pw-msg" id="pwMsg"></div>
      <button class="btn btn-primary pw-main" id="pwSave"><i class="fas fa-check"></i> حفظ كلمة المرور</button>
    </div>`;
  const p1 = document.getElementById('pwNew1'), p2 = document.getElementById('pwNew2');
  const labels = ['ضعيفة جداً', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية 💪'];
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'];
  p1.addEventListener('input', () => {
    const s = p1.value ? pwStrength(p1.value) : 0;
    const m = document.getElementById('pwMeter');
    m.style.width = p1.value ? ((s + 1) * 20) + '%' : '0';
    m.style.background = colors[s];
    const t = document.getElementById('pwMeterTxt');
    t.textContent = !p1.value ? '8 أحرف على الأقل' : p1.value.length < 8 ? `باقي ${8 - p1.value.length} أحرف` : 'القوة: ' + labels[s];
    t.style.color = p1.value.length < 8 ? 'var(--muted)' : colors[s];
  });
  [p1, p2].forEach(el => el.addEventListener('keydown', e => { if(e.key === 'Enter') pwSaveNew(); }));
  document.getElementById('pwSave').addEventListener('click', pwSaveNew);
  setTimeout(() => { try{ p1.focus(); }catch(e){} }, 80);
}

async function pwSaveNew(){
  const btn = document.getElementById('pwSave');
  const msg = document.getElementById('pwMsg');
  const a = (document.getElementById('pwNew1') || {}).value || '';
  const b = (document.getElementById('pwNew2') || {}).value || '';
  const show = t => { msg.className = 'pw-msg err'; msg.innerHTML = '<i class="fas fa-circle-exclamation"></i> ' + t; };
  if(a.length < 8){ show('كلمة المرور لازم تكون 8 أحرف أو أكثر'); return; }
  if(a !== b){ show('كلمتا المرور غير متطابقتين'); return; }
  if(btn.disabled) return;
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  try{
    const { error } = await sb.auth.updateUser({ password: a });
    if(error) throw error;
    window.__PW_RECOVERING = false;
    const o = pwOverlay();
    o.innerHTML = `
      <div class="pw-box">
        <div class="pw-ic ok"><i class="fas fa-circle-check"></i></div>
        <h2>تم تغيير كلمة المرور 🎉</h2>
        <p>استخدم كلمة المرور الجديدة في المرات الجاية. أنت الحين داخل حسابك.</p>
        <button class="btn btn-primary pw-main" id="pwEnter"><i class="fas fa-right-to-bracket"></i> ادخل للمنصة</button>
      </div>`;
    document.getElementById('pwEnter').addEventListener('click', () => {
      pwClose();
      try{ if(!window._appInitialized && typeof window.enterApp === 'function') window.enterApp(); }catch(e){}
    });
  }catch(e){
    show(escapeHtml(pwFriendlyError(e.message)));
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> حفظ كلمة المرور';
  }
}

/* توافق: الحدث القديم من Supabase */
function showRecoveryModal(){
  if(document.getElementById('pwReset') && document.getElementById('pwReset').classList.contains('open')) return;
  pwShowNewPassword(session && session.user ? session.user.email : '');
}
window.showRecoveryModal = showRecoveryModal;

/* ============================================================
   ⭐⭐⭐ الأحداث — معالج شامل لكل أزرار auth
============================================================ */
document.addEventListener('click', function(e){
  const t = e.target;
  if(!t) return;

  /* تبديل التبويبات */
  const tabBtn = t.closest('.auth-tabs button');
  if(tabBtn){
    e.preventDefault();
    showAuthForm(tabBtn.dataset.tab);
    return;
  }

  /* أزرار الدخول/التسجيل/الأدمن */
  if(t.closest('#loginBtn')){ e.preventDefault(); doLogin(); return; }
  if(t.closest('#regBtn')){   e.preventDefault(); doRegister(); return; }
  if(t.closest('#adminBtn')){ e.preventDefault(); doAdminLogin(); return; }
  if(t.closest('#forgotLink')){ e.preventDefault(); doForgotPassword(); return; }

  /* ⭐⭐⭐ زر الرجوع — يعرض شاشة الترحيب بشكل صحيح */
  if(t.closest('#authBack')){
    e.preventDefault();
    e.stopPropagation();

    /* 1) اقفل auth */
    const a = document.getElementById('auth');
    if(a) a.classList.remove('open');

    /* 2) اقفل app */
    const ap = document.getElementById('app');
    if(ap) ap.classList.remove('open', 'store-only', 'ready');

    /* 3) اعرض welcome — بدون أي شرط */
    const w = document.getElementById('welcome');
    if(w){
      w.dataset.firstVisit = 'true';
      w.classList.remove('exit');
      w.style.display    = 'flex';
      w.style.opacity    = '1';
      w.style.visibility = 'visible';
    }
    return;
  }
});

/* ============================================================
   Enter في الحقول
============================================================ */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter') return;
  const t = e.target;
  if(!t || t.tagName !== 'INPUT') return;

  if(t.id === 'loginPass' || t.id === 'loginEmail'){ e.preventDefault(); doLogin(); return; }
  if(['regPass','regEmail','regName','regPhone'].includes(t.id)){ e.preventDefault(); doRegister(); return; }
  if(t.id === 'adminPass' || t.id === 'adminEmail'){ e.preventDefault(); doAdminLogin(); return; }
});

/* ============================================================
   تنظيف رقم الجوال
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('regPhone');
  if(phoneInput && !phoneInput.dataset.bound){
    phoneInput.dataset.bound = '1';
    phoneInput.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
  }
});
