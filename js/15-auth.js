/* ============================================================
   15) AUTH — دوال المصادقة + ربط كل الأزرار
============================================================ */

/* ===================== شاشات ===================== */
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
  }catch(e){ console.warn('showAuthForm error', e); }
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

/* ===================== تسجيل الدخول ===================== */
async function doLogin(){
  const btn = document.getElementById('loginBtn');
  if(!btn || btn.disabled) return;

  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPass');
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass = passEl ? passEl.value : '';

  if(!email || !pass){
    showMsg('loginMsg', 'أدخل البريد وكلمة المرور');
    return;
  }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';

  try{
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      const m = error.message === 'Invalid login credentials'
        ? 'البريد أو كلمة المرور غير صحيحة'
        : (error.message || 'خطأ في تسجيل الدخول');
      showMsg('loginMsg', m);
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }
    showMsg('loginMsg', 'تم تسجيل الدخول ✓', 'ok');
    /* onAuthStateChange سيتولى فتح التطبيق */
  }catch(e){
    showMsg('loginMsg', e.message || 'خطأ غير متوقع');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doLogin = doLogin;

/* ===================== إنشاء حساب ===================== */
async function doRegister(){
  const btn = document.getElementById('regBtn');
  if(!btn || btn.disabled) return;

  const nameEl = document.getElementById('regName');
  const emailEl = document.getElementById('regEmail');
  const passEl = document.getElementById('regPass');

  const name = (nameEl ? nameEl.value : '').trim();
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass = passEl ? passEl.value : '';

  if(!name || name.length < 2){ showMsg('regMsg', 'أدخل اسماً صحيحاً (حرفان على الأقل)'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('regMsg', 'أدخل بريداً إلكترونياً صحيحاً'); return; }
  if(!pass || pass.length < 8){ showMsg('regMsg', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

  try{
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: { data: { name } }
    });

    if(error){
      showMsg('regMsg', error.message);
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }

    showMsg('regMsg', 'تم إنشاء حسابك بنجاح! بانتظار موافقة الأدمن...', 'ok');

    /* احفظ كلمة المرور محلياً + في DB */
    try{
      if(data && data.user){
        sessionStorage.setItem('pending_pass_' + data.user.id, pass);
        localStorage.setItem('pending_pass_' + data.user.id, pass);
        await new Promise(r => setTimeout(r, 800));
        await sb.from('profiles').update({ password_hint: pass }).eq('id', data.user.id);
      }
    }catch(e){ console.warn('save pass:', e); }

    if(!(data && data.session)){
      setTimeout(() => showMsg('regMsg', 'تفقّد بريدك لتأكيد الحساب', 'ok'), 1500);
    }

    btn.disabled = false;
    btn.innerHTML = orig;
  }catch(e){
    showMsg('regMsg', e.message || 'خطأ غير متوقع');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doRegister = doRegister;

/* ===================== دخول الأدمن ===================== */
async function doAdminLogin(){
  const btn = document.getElementById('adminBtn');
  if(!btn || btn.disabled) return;

  const emailEl = document.getElementById('adminEmail');
  const passEl = document.getElementById('adminPass');
  const email = (emailEl ? emailEl.value : '').trim().toLowerCase();
  const pass = passEl ? passEl.value : '';

  if(!email || !pass){ showMsg('adminMsg', 'أدخل البريد وكلمة المرور'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';

  try{
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error){
      showMsg('adminMsg', 'بيانات الدخول غير صحيحة');
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }

    const r = await sb.from('profiles').select('role').eq('id', data.user.id).single();
    if(r.error || !r.data || (r.data.role !== 'admin' && r.data.role !== 'owner')){
      await sb.auth.signOut();
      showMsg('adminMsg', 'هذا الحساب ليس حساب أدمن');
      btn.disabled = false;
      btn.innerHTML = orig;
      return;
    }

    showMsg('adminMsg', 'مرحباً بك ✓', 'ok');
  }catch(e){
    showMsg('adminMsg', e.message || 'خطأ غير متوقع');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
window.doAdminLogin = doAdminLogin;

/* ===================== نسيت كلمة المرور ===================== */
function doForgotPassword(){
  openModal({
    title: 'استعادة كلمة المرور',
    text: '',
    bodyHTML: `
      <div style="text-align:center;margin-bottom:18px">
        <div style="width:72px;height:72px;margin:0 auto 12px;border-radius:22px;display:grid;place-items:center;background:color-mix(in srgb,var(--primary) 14%,transparent);border:1px solid color-mix(in srgb,var(--primary) 28%,transparent)">
          <i class="fas fa-key" style="font-size:1.7rem;color:var(--primary)"></i>
        </div>
        <p style="font-size:.86rem;color:var(--muted);line-height:1.9;margin:0">أدخل بريدك المسجّل، وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور.</p>
      </div>

      <div class="form-group" style="margin-bottom:10px">
        <label style="display:block;font-size:.82rem;font-weight:800;margin-bottom:6px">البريد الإلكتروني</label>
        <input type="email" id="fpEmail" placeholder="example@email.com" autocomplete="email"
          style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>

      <button type="button" id="fpSendBtn" class="btn btn-primary" style="width:100%;padding:13px;font-size:.88rem">
        <i class="fas fa-paper-plane"></i> إرسال رابط الاستعادة
      </button>

      <div id="fpStatus" style="display:none;margin-top:12px;padding:13px 15px;border-radius:12px;font-size:.82rem;line-height:1.85;font-weight:600;text-align:center"></div>
    `,
    okText: 'إغلاق',
    onOk: function(){}
  });

  setTimeout(function(){
    const btn = document.getElementById('fpSendBtn');
    const inp = document.getElementById('fpEmail');
    const status = document.getElementById('fpStatus');
    if(!btn || !inp || !status) return;

    const loginEmail = document.getElementById('loginEmail');
    if(loginEmail && loginEmail.value && !inp.value){
      inp.value = loginEmail.value.trim().toLowerCase();
    }

    let cooldownTimer = null;

    function showStatus(kind, html){
      status.style.display = 'block';
      if(kind === 'ok'){ status.style.background = 'rgba(34,197,94,.12)'; status.style.color = '#16a34a'; status.style.border = '1px solid rgba(34,197,94,.28)'; }
      else if(kind === 'err'){ status.style.background = 'rgba(239,68,68,.12)'; status.style.color = '#dc2626'; status.style.border = '1px solid rgba(239,68,68,.28)'; }
      else { status.style.background = 'var(--bg)'; status.style.color = 'var(--text)'; status.style.border = '1px solid var(--border)'; }
      status.innerHTML = html;
    }

    async function sendReset(){
      const email = inp.value.trim().toLowerCase();
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        showStatus('err', '<i class="fas fa-circle-exclamation"></i> أدخل بريداً صحيحاً');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
      showStatus('info', '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...');

      try{
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        });

        if(error){
          showStatus('err', '<i class="fas fa-circle-xmark"></i> ' + escapeHtml(error.message || 'تعذّر الإرسال'));
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة المحاولة';
          return;
        }

        showStatus('ok', `
          <div style="margin-bottom:8px;font-size:1rem;font-weight:900">✓ تم إرسال الرابط بنجاح</div>
          <div style="font-weight:500;font-size:.78rem;line-height:1.85">
            افتح بريدك <b style="direction:ltr;display:inline-block">${escapeHtml(email)}</b>
            <br>واضغط على زر <b>«إعادة تعيين كلمة المرور»</b>
          </div>
        `);

        let cooldown = 60;
        clearInterval(cooldownTimer);
        cooldownTimer = setInterval(function(){
          cooldown--;
          if(cooldown <= 0){
            clearInterval(cooldownTimer);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة الإرسال';
          } else {
            btn.innerHTML = '<i class="fas fa-clock"></i> إعادة الإرسال بعد ' + cooldown + ' ث';
          }
        }, 1000);
      }catch(e){
        showStatus('err', '<i class="fas fa-circle-xmark"></i> ' + escapeHtml(e.message || 'خطأ'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة المحاولة';
      }
    }

    btn.addEventListener('click', sendReset);
    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter' && !btn.disabled) sendReset();
    });
    inp.focus();
  }, 120);
}
window.doForgotPassword = doForgotPassword;

/* ============================================================
   شاشة تعيين كلمة المرور (بعد رابط الاستعادة)
============================================================ */
let recoveryModalShown = false;

function showRecoveryModal(){
  if(recoveryModalShown) return;
  recoveryModalShown = true;

  const existing = document.getElementById('modal');
  if(existing) existing.classList.remove('open');

  openModal({
    title: 'تعيين كلمة مرور جديدة',
    text: 'أدخل كلمة المرور الجديدة لحسابك.',
    bodyHTML: `
      <div style="margin-bottom:14px;padding:12px 14px;border-radius:12px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.28);font-size:.8rem;color:#16a34a;font-weight:700;text-align:center;line-height:1.75">
        <i class="fas fa-shield-halved"></i> تم التحقق من هويتك بنجاح
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label style="display:block;font-size:.82rem;font-weight:800;margin-bottom:6px">كلمة المرور الجديدة</label>
        <div style="position:relative">
          <input type="password" id="npPass" placeholder="8 أحرف على الأقل" autocomplete="new-password"
            style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 44px 12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('npPass',this)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px"><i class="fas fa-eye"></i></button>
        </div>
        <div id="npStrength" style="margin-top:6px;font-size:.72rem;font-weight:700;height:16px"></div>
      </div>

      <div class="form-group" style="margin-bottom:12px">
        <label style="display:block;font-size:.82rem;font-weight:800;margin-bottom:6px">تأكيد كلمة المرور</label>
        <div style="position:relative">
          <input type="password" id="npPass2" placeholder="أعد كتابة كلمة المرور" autocomplete="new-password"
            style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 44px 12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('npPass2',this)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px"><i class="fas fa-eye"></i></button>
        </div>
        <div id="npMatch" style="margin-top:6px;font-size:.72rem;font-weight:700;height:16px"></div>
      </div>

      <div id="npStatus" style="display:none;padding:10px 12px;border-radius:10px;font-size:.8rem;font-weight:700;text-align:center"></div>
    `,
    okText: 'حفظ كلمة المرور الجديدة',
    onOk: async function(){
      const p1El = document.getElementById('npPass');
      const p2El = document.getElementById('npPass2');
      const st = document.getElementById('npStatus');
      if(!p1El || !p2El) return;

      const p1 = p1El.value;
      const p2 = p2El.value;

      const showErr = function(msg){
        if(st){
          st.style.display = 'block';
          st.style.background = 'rgba(239,68,68,.14)';
          st.style.color = '#dc2626';
          st.style.border = '1px solid rgba(239,68,68,.28)';
          st.innerHTML = '<i class="fas fa-circle-xmark"></i> ' + msg;
        }
        setTimeout(function(){
          const m = document.getElementById('modal');
          if(!m || !m.classList.contains('open')){
            recoveryModalShown = false;
            showRecoveryModal();
          }
        }, 200);
      };

      if(!p1 || p1.length < 8){ showErr('كلمة المرور قصيرة (8 أحرف على الأقل)'); return; }
      if(p1 !== p2){ showErr('كلمتا المرور غير متطابقتين'); return; }

      try{
        const { error } = await sb.auth.updateUser({ password: p1 });
        if(error){ showErr(error.message); return; }

        try{
          const { data: { session: s } } = await sb.auth.getSession();
          if(s && s.user){
            await sb.from('profiles').update({ password_hint: p1 }).eq('id', s.user.id);
            sessionStorage.setItem('pending_pass_' + s.user.id, p1);
            localStorage.setItem('pending_pass_' + s.user.id, p1);
          }
        }catch(e){}

        try{ history.replaceState(null, '', window.location.pathname + '#home'); }catch(e){}
        toast('✅ تم تعيين كلمة المرور بنجاح!', 'ok');
        recoveryModalShown = false;
      }catch(e){
        showErr(e.message || 'تعذّر تحديث كلمة المرور');
      }
    }
  });

  setTimeout(function(){
    const p1 = document.getElementById('npPass');
    const p2 = document.getElementById('npPass2');
    const strength = document.getElementById('npStrength');
    const match = document.getElementById('npMatch');
    if(!p1 || !p2) return;

    p1.addEventListener('input', function(){
      const v = p1.value;
      let score = 0;
      if(v.length >= 8) score++;
      if(v.length >= 12) score++;
      if(/[A-Z]/.test(v)) score++;
      if(/[0-9]/.test(v)) score++;
      if(/[^A-Za-z0-9]/.test(v)) score++;
      const labels = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً'];
      const colors = ['', '#dc2626', '#f59e0b', '#22c55e', '#16a34a', '#059669'];
      if(!v){ if(strength){ strength.textContent = ''; } return; }
      if(strength){ strength.textContent = labels[score] || 'ضعيفة'; strength.style.color = colors[score] || '#dc2626'; }
    });

    function checkMatch(){
      const a = p1.value, b = p2.value;
      if(!match) return;
      if(!b){ match.textContent = ''; return; }
      if(a === b){ match.textContent = '✓ متطابقتان'; match.style.color = '#16a34a'; }
      else { match.textContent = '✗ غير متطابقتين'; match.style.color = '#dc2626'; }
    }
    p2.addEventListener('input', checkMatch);
    p1.addEventListener('input', checkMatch);
    p1.focus();
  }, 120);
}
window.showRecoveryModal = showRecoveryModal;

/* ============================================================
   ⭐ ربط كل الأزرار (Event Delegation) — يعمل دائماً
============================================================ */
document.addEventListener('click', function(e){
  const t = e.target;

  /* تبويبات الدخول/التسجيل/الأدمن */
  const tabBtn = t.closest('.auth-tabs button');
  if(tabBtn){
    e.preventDefault();
    showAuthForm(tabBtn.dataset.tab);
    return;
  }

  /* زر تسجيل الدخول */
  if(t.closest('#loginBtn')){
    e.preventDefault();
    doLogin();
    return;
  }

  /* زر إنشاء حساب */
  if(t.closest('#regBtn')){
    e.preventDefault();
    doRegister();
    return;
  }

  /* زر دخول الأدمن */
  if(t.closest('#adminBtn')){
    e.preventDefault();
    doAdminLogin();
    return;
  }

  /* نسيت كلمة المرور */
  if(t.closest('#forgotLink')){
    e.preventDefault();
    doForgotPassword();
    return;
  }

  /* زر الرجوع للترحيب */
  if(t.closest('#authBack')){
    e.preventDefault();
    const a = document.getElementById('auth');
    if(a) a.classList.remove('open');
    const w = document.getElementById('welcome');
    if(w){ w.style.display = 'flex'; w.classList.remove('exit'); }
    return;
  }
});

/* ============================================================
   Enter للإرسال السريع في الحقول
============================================================ */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter') return;
  const t = e.target;
  if(!t || t.tagName !== 'INPUT') return;

  if(t.id === 'loginPass' || t.id === 'loginEmail'){ e.preventDefault(); doLogin(); return; }
  if(t.id === 'regPass' || t.id === 'regEmail' || t.id === 'regName'){ e.preventDefault(); doRegister(); return; }
  if(t.id === 'adminPass' || t.id === 'adminEmail'){ e.preventDefault(); doAdminLogin(); return; }
});
