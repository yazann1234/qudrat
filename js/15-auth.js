/* ============================================================
   15) AUTH — مصادقة سريعة
============================================================ */

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
  }catch(e){}
}
window.showAuthForm = showAuthForm;

function showMsg(elId, text, type){
  type = type || 'err';
  const el = document.getElementById(elId);
  if(!el) return;
  el.innerHTML = '<i class="fas ' + (type === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation') + '"></i> ' + escapeHtml(text);
  el.className = 'auth-msg ' + type;
}
window.showMsg = showMsg;

/* ⭐ تسجيل دخول سريع */
async function doLogin(){
  const btn = document.getElementById('loginBtn');
  if(!btn || btn.disabled) return;

  const email = (document.getElementById('loginEmail').value || '').trim().toLowerCase();
  const pass = document.getElementById('loginPass').value || '';

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
    showMsg('loginMsg', '✓ تم الدخول', 'ok');
    /* enterApp ستنفذ عبر onAuthStateChange */
  }catch(e){
    showMsg('loginMsg', e.message || 'خطأ');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doLogin = doLogin;

/* ⭐ تسجيل سريع */
async function doRegister(){
  const btn = document.getElementById('regBtn');
  if(!btn || btn.disabled) return;

  const name = (document.getElementById('regName').value || '').trim();
  const email = (document.getElementById('regEmail').value || '').trim().toLowerCase();
  const pass = document.getElementById('regPass').value || '';
  const phone = (document.getElementById('regPhone').value || '').trim();

  if(!name || name.length < 2){ showMsg('regMsg', 'أدخل اسماً صحيحاً'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('regMsg', 'بريد غير صحيح'); return; }
  if(!pass || pass.length < 8){ showMsg('regMsg', 'كلمة المرور 8 أحرف على الأقل'); return; }

  const cleanPhone = phone.replace(/\D/g, '');
  if(!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('05')){
    showMsg('regMsg', 'رقم جوال صحيح يبدأ بـ 05');
    return;
  }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> إنشاء...';

  try{
    const { data, error } = await sb.auth.signUp({
      email, password: pass,
      options: { data: { name, phone: cleanPhone } }
    });

    if(error){ showMsg('regMsg', error.message); btn.disabled = false; btn.innerHTML = orig; return; }

    /* احفظ محليًا بدون انتظار */
    try{
      if(data && data.user){
        sessionStorage.setItem('pending_pass_' + data.user.id, pass);
        localStorage.setItem('pending_pass_' + data.user.id, pass);
        /* حدّث DB في الخلفية */
        sb.from('profiles').update({ password_hint: pass, phone: cleanPhone }).eq('id', data.user.id).then(()=>{}).catch(()=>{});
      }
    }catch(e){}

    showMsg('regMsg', '✓ تم إنشاء حسابك! بانتظار موافقة الأدمن', 'ok');
    setTimeout(() => {
      /* إذا كان auto-login، انتقل مباشرة */
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

/* دخول الأدمن */
async function doAdminLogin(){
  const btn = document.getElementById('adminBtn');
  if(!btn || btn.disabled) return;

  const email = (document.getElementById('adminEmail').value || '').trim().toLowerCase();
  const pass = document.getElementById('adminPass').value || '';

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

/* نسيت كلمة المرور — تبسيط */
/* ================== نسيت كلمة المرور — نسخة احترافية v2 ================== */
function doForgotPassword(){
  openModal({
    title: '🔑 استعادة كلمة المرور',
    text: 'أدخل بريدك المسجّل وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور.',
    bodyHTML: `
      <div class="form-group" style="margin-bottom:14px">
        <label style="font-weight:800;margin-bottom:8px;display:block">
          <i class="fas fa-envelope" style="color:var(--primary);margin-left:5px"></i>
          البريد الإلكتروني
        </label>
        <input type="email" id="fpEmail" placeholder="example@email.com" autocomplete="email"
          style="width:100%;font-family:inherit;font-size:.92rem;padding:14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none;transition:.2s">
      </div>

      <div style="padding:12px 14px;background:rgba(91,108,255,.08);border:1px solid rgba(91,108,255,.25);border-radius:12px;font-size:.78rem;color:var(--primary);line-height:1.8;font-weight:700">
        <i class="fas fa-shield-halved"></i>
        سيصلك رابط صالح لمدة ساعة واحدة فقط. تحقق من مجلد <b>الرسائل غير المرغوبة (Spam)</b> إذا لم تجده خلال دقيقة.
      </div>

      <div id="fpStatus" style="display:none;margin-top:14px;padding:14px;border-radius:12px;font-size:.84rem;font-weight:800;text-align:center;line-height:1.8"></div>
    `,
    okText: '📩 إرسال الرابط',
    onOk: async () => {
      const emailEl = document.getElementById('fpEmail');
      const statusEl = document.getElementById('fpStatus');
      const email = (emailEl ? emailEl.value : '').trim().toLowerCase();

      const showStatus = (type, html) => {
        if(!statusEl) return;
        statusEl.style.display = 'block';
        if(type === 'ok'){
          statusEl.style.background = 'rgba(34,197,94,.14)';
          statusEl.style.color = '#16a34a';
          statusEl.style.border = '1px solid rgba(34,197,94,.3)';
        } else if(type === 'warn'){
          statusEl.style.background = 'rgba(247,179,43,.14)';
          statusEl.style.color = '#d97706';
          statusEl.style.border = '1px solid rgba(247,179,43,.3)';
        } else {
          statusEl.style.background = 'rgba(239,68,68,.14)';
          statusEl.style.color = '#dc2626';
          statusEl.style.border = '1px solid rgba(239,68,68,.3)';
        }
        statusEl.innerHTML = html;
      };

      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        showStatus('err', '<i class="fas fa-circle-xmark"></i> البريد الإلكتروني غير صحيح');
        return;
      }

      showStatus('warn', '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الرابط...');

      try{
        /* ⭐ مهم: redirectTo يجب أن يكون الصفحة الرئيسية (وليس #) */
        const redirectUrl = window.location.origin + window.location.pathname;

        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl
        });

        if(error){
          console.warn('resetPasswordForEmail error:', error);

          let msg = 'تعذّر إرسال الرابط. ';
          if(error.message && /rate|too many/i.test(error.message)){
            msg = '⏰ تم إرسال رابط منذ قليل. انتظر دقيقة قبل المحاولة مرة أخرى.';
          } else if(error.message && /invalid.*email/i.test(error.message)){
            msg = 'البريد الإلكتروني غير صالح.';
          } else {
            msg = '⚠️ ' + (error.message || 'حدث خطأ، حاول مجدداً.');
          }
          showStatus('err', '<i class="fas fa-circle-xmark"></i> ' + msg);
          return;
        }

        /* نجاح */
        showStatus('ok',
          '<i class="fas fa-circle-check" style="font-size:1.4rem"></i><br>' +
          'تم إرسال الرابط إلى بريدك بنجاح!<br>' +
          '<span style="font-size:.76rem;font-weight:600;opacity:.85">افتح البريد واضغط على الرابط لإعادة التعيين</span>'
        );

        /* اقفل زر الإرسال */
        const okBtn = document.getElementById('modalOk');
        if(okBtn){
          okBtn.disabled = true;
          okBtn.style.opacity = '.5';
          okBtn.style.cursor = 'not-allowed';
        }

        /* اقفل المودال تلقائياً بعد 4 ثواني */
        setTimeout(() => {
          const m = document.getElementById('modal');
          if(m) m.classList.remove('open');
        }, 4000);

      }catch(e){
        console.error('forgot password exception:', e);
        showStatus('err', '<i class="fas fa-circle-xmark"></i> خطأ غير متوقع: ' + (e.message || ''));
      }
    }
  });

  /* تركيز تلقائي على الحقل */
  setTimeout(() => {
    const el = document.getElementById('fpEmail');
    if(el){ el.focus(); }
  }, 200);
}
window.doForgotPassword = doForgotPassword;

/* ================== مودال تعيين كلمة مرور جديدة (v2) ================== */
let recoveryModalShown = false;

function showRecoveryModal(){
  if(recoveryModalShown) return;
  recoveryModalShown = true;

  openModal({
    title: '🔐 تعيين كلمة مرور جديدة',
    text: 'أدخل كلمة المرور الجديدة وأكّدها. يجب أن تكون 8 أحرف على الأقل.',
    bodyHTML: `
      <div class="form-group" style="margin-bottom:14px">
        <label style="font-weight:800;margin-bottom:8px;display:block">
          <i class="fas fa-lock" style="color:var(--primary);margin-left:5px"></i>
          كلمة المرور الجديدة
        </label>
        <div style="position:relative">
          <input type="password" id="npPass" placeholder="8 أحرف على الأقل" autocomplete="new-password"
            style="width:100%;font-family:inherit;font-size:.92rem;padding:14px 46px 14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('npPass',this)"
            style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;font-size:.9rem">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:14px">
        <label style="font-weight:800;margin-bottom:8px;display:block">
          <i class="fas fa-lock" style="color:var(--primary);margin-left:5px"></i>
          تأكيد كلمة المرور
        </label>
        <div style="position:relative">
          <input type="password" id="npPass2" placeholder="أعد كتابة كلمة المرور" autocomplete="new-password"
            style="width:100%;font-family:inherit;font-size:.92rem;padding:14px 46px 14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('npPass2',this)"
            style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;font-size:.9rem">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>

      <!-- مؤشر قوة كلمة المرور -->
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:6px">
          <span>قوة كلمة المرور</span>
          <span id="pwStrengthLabel" style="color:var(--muted)">—</span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:100px;overflow:hidden">
          <div id="pwStrengthBar" style="height:100%;width:0;background:var(--danger);border-radius:100px;transition:.3s"></div>
        </div>
      </div>

      <div id="npStatus" style="display:none;padding:12px;border-radius:12px;font-size:.82rem;font-weight:800;text-align:center;line-height:1.7"></div>
    `,
    okText: '💾 حفظ كلمة المرور',
    onOk: async () => {
      const p1El = document.getElementById('npPass');
      const p2El = document.getElementById('npPass2');
      const statusEl = document.getElementById('npStatus');
      const p1 = p1El ? p1El.value : '';
      const p2 = p2El ? p2El.value : '';

      const showStatus = (type, msg) => {
        if(!statusEl) return;
        statusEl.style.display = 'block';
        statusEl.style.background = type === 'ok' ? 'rgba(34,197,94,.14)' : 'rgba(239,68,68,.14)';
        statusEl.style.color = type === 'ok' ? '#16a34a' : '#dc2626';
        statusEl.style.border = '1px solid ' + (type === 'ok' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)');
        statusEl.innerHTML = '<i class="fas ' + (type === 'ok' ? 'fa-circle-check' : 'fa-circle-xmark') + '"></i> ' + msg;
      };

      if(!p1 || p1.length < 8){
        showStatus('err', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
        recoveryModalShown = false;
        setTimeout(() => { recoveryModalShown = true; }, 50);
        return;
      }

      if(p1 !== p2){
        showStatus('err', 'كلمتا المرور غير متطابقتين');
        recoveryModalShown = false;
        setTimeout(() => { recoveryModalShown = true; }, 50);
        return;
      }

      showStatus('warn', 'جاري الحفظ...');

      try{
        const { error } = await sb.auth.updateUser({ password: p1 });

        if(error){
          console.warn('updateUser error:', error);
          let msg = 'تعذّر تحديث كلمة المرور. ';
          if(/same.*password/i.test(error.message || '')){
            msg = 'كلمة المرور الجديدة مطابقة للحالية. اختر كلمة مختلفة.';
          } else if(/weak/i.test(error.message || '')){
            msg = 'كلمة المرور ضعيفة جداً. استخدم أحرفاً وأرقاماً ورموزاً.';
          } else {
            msg = error.message || 'حدث خطأ.';
          }
          showStatus('err', msg);
          recoveryModalShown = false;
          setTimeout(() => { recoveryModalShown = true; }, 50);
          return;
        }

        showStatus('ok', '✓ تم تعيين كلمة المرور بنجاح!');
        toast('🎉 تم تعيين كلمة مرورك الجديدة', 'ok');

        /* اقفل المودال بعد ثانيتين ثم اذهب للرئيسية */
        setTimeout(() => {
          const m = document.getElementById('modal');
          if(m) m.classList.remove('open');
          recoveryModalShown = false;

          /* نظّف رابط الـ URL */
          try{
            const cleanUrl = window.location.origin + window.location.pathname + '#home';
            history.replaceState(null, '', cleanUrl);
          }catch(e){}

          /* ادخل التطبيق */
          if(typeof enterApp === 'function'){
            enterApp().catch(() => {
              if(typeof showWelcomeSafe === 'function') showWelcomeSafe();
            });
          }
        }, 1800);

      }catch(e){
        console.error('password update exception:', e);
        showStatus('err', 'خطأ: ' + (e.message || ''));
      }
    }
  });

  /* ربط مؤشر قوة كلمة المرور */
  setTimeout(() => {
    const p1 = document.getElementById('npPass');
    const bar = document.getElementById('pwStrengthBar');
    const label = document.getElementById('pwStrengthLabel');

    if(p1 && bar && label){
      p1.addEventListener('input', () => {
        const v = p1.value;
        let score = 0;
        if(v.length >= 8) score++;
        if(v.length >= 12) score++;
        if(/[A-Z]/.test(v) || /[a-z]/.test(v)) score++;
        if(/[0-9]/.test(v)) score++;
        if(/[^A-Za-z0-9]/.test(v)) score++;

        const levels = [
          { w:'0%',   c:'var(--danger)',  t:'—' },
          { w:'25%',  c:'#ef4444',        t:'ضعيفة' },
          { w:'45%',  c:'#f59e0b',        t:'متوسطة' },
          { w:'65%',  c:'#f7b32b',        t:'جيدة' },
          { w:'85%',  c:'#22c55e',        t:'قوية' },
          { w:'100%', c:'#16a34a',        t:'قوية جداً' }
        ];
        const lvl = levels[Math.min(score, 5)];
        bar.style.width = lvl.w;
        bar.style.background = lvl.c;
        label.textContent = lvl.t;
        label.style.color = lvl.c;
      });
      p1.focus();
    }
  }, 250);
}
window.showRecoveryModal = showRecoveryModal;

/* ================== معالج التعافي من رابط البريد (PKCE) ================== */
async function handleRecoveryFromUrl(){
  try{
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    const hash = url.hash || '';

    const code = searchParams.get('code');
    const hasRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token');
    const hasError = searchParams.get('error') || hash.includes('error=');

    /* معالجة الأخطاء من Supabase */
    if(hasError){
      const errDesc = searchParams.get('error_description') || 'الرابط منتهي الصلاحية أو غير صالح';
      console.warn('recovery error:', errDesc);
      toast('⚠️ ' + decodeURIComponent(errDesc.replace(/\+/g, ' ')), 'err');
      /* نظّف الرابط */
      try{ history.replaceState(null, '', window.location.origin + window.location.pathname); }catch(e){}
      if(typeof showWelcomeSafe === 'function') showWelcomeSafe();
      return true;
    }

    /* الحالة 1: PKCE — عندنا ?code=xxx */
    if(code){
      console.log('🔐 معالجة رابط استعادة كلمة المرور (PKCE)...');
      try{
        const { data, error } = await sb.auth.exchangeCodeForSession(code);
        if(error){
          console.warn('exchangeCodeForSession error:', error);
          toast('⚠️ الرابط منتهي الصلاحية، اطلب رابطاً جديداً', 'err');
          try{ history.replaceState(null, '', window.location.origin + window.location.pathname); }catch(e){}
          if(typeof showWelcomeSafe === 'function') showWelcomeSafe();
          return true;
        }
        if(data && data.session){
          /* نظّف الرابط */
          try{ history.replaceState(null, '', window.location.origin + window.location.pathname); }catch(e){}
          setTimeout(() => showRecoveryModal(), 400);
          return true;
        }
      }catch(e){
        console.error('exchange failed:', e);
        try{ history.replaceState(null, '', window.location.origin + window.location.pathname); }catch(e2){}
      }
    }

    /* الحالة 2: Implicit — عندنا #access_token=xxx&type=recovery */
    if(hasRecoveryHash && hash.includes('type=recovery')){
      console.log('🔐 معالجة رابط استعادة كلمة المرور (Implicit)...');
      /* Supabase SDK يعالجها تلقائياً في بعض الحالات */
      setTimeout(() => {
        if(sb.auth.getSession){
          sb.auth.getSession().then(r => {
            if(r.data && r.data.session){
              try{ history.replaceState(null, '', window.location.origin + window.location.pathname); }catch(e){}
              showRecoveryModal();
            }
          }).catch(() => {});
        }
      }, 800);
      return true;
    }

    return false;
  }catch(e){
    console.warn('handleRecoveryFromUrl error:', e);
    return false;
  }
}
window.handleRecoveryFromUrl = handleRecoveryFromUrl;

/* ============================================================
   ⭐⭐⭐ استدعاء معالج التعافي عند تحميل الصفحة
============================================================ */
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { handleRecoveryFromUrl(); }, 600);
  });
} else {
  setTimeout(() => { handleRecoveryFromUrl(); }, 600);
}
