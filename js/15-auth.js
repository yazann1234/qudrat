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
function doForgotPassword(){
  openModal({
    title: 'استعادة كلمة المرور',
    text: 'أدخل بريدك المسجّل وسنرسل رابطاً لإعادة التعيين.',
    bodyHTML: `
      <div class="form-group">
        <label>البريد الإلكتروني</label>
        <input type="email" id="fpEmail" placeholder="example@email.com"
          style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
      </div>
      <div id="fpStatus" style="display:none;margin-top:10px;padding:10px;border-radius:10px;font-size:.82rem;text-align:center"></div>
    `,
    okText: 'إرسال',
    onOk: async () => {
      const email = (document.getElementById('fpEmail').value || '').trim().toLowerCase();
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('بريد غير صحيح', 'err'); return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if(error){ toast('فشل: ' + error.message, 'err'); return; }
      toast('✓ تم إرسال الرابط', 'ok');
    }
  });
}
window.doForgotPassword = doForgotPassword;

/* تعيين كلمة مرور جديدة */
let recoveryModalShown = false;
function showRecoveryModal(){
  if(recoveryModalShown) return;
  recoveryModalShown = true;

  openModal({
    title: 'تعيين كلمة مرور جديدة',
    text: 'أدخل كلمة المرور الجديدة.',
    bodyHTML: `
      <div class="form-group" style="margin-bottom:12px">
        <label>كلمة المرور الجديدة</label>
        <div style="position:relative">
          <input type="password" id="npPass" placeholder="8 أحرف على الأقل"
            style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 44px 12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('npPass',this)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>تأكيد كلمة المرور</label>
        <div style="position:relative">
          <input type="password" id="npPass2" placeholder="أعد الكتابة"
            style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 44px 12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none">
          <button type="button" onclick="togglePassVis('npPass2',this)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px"><i class="fas fa-eye"></i></button>
        </div>
      </div>
    `,
    okText: 'حفظ',
    onOk: async () => {
      const p1 = document.getElementById('npPass').value;
      const p2 = document.getElementById('npPass2').value;
      if(!p1 || p1.length < 8){ toast('كلمة المرور قصيرة', 'err'); recoveryModalShown = false; setTimeout(showRecoveryModal, 100); return; }
      if(p1 !== p2){ toast('غير متطابقتين', 'err'); recoveryModalShown = false; setTimeout(showRecoveryModal, 100); return; }
      const { error } = await sb.auth.updateUser({ password: p1 });
      if(error){ toast(error.message, 'err'); return; }
      toast('✓ تم تعيين كلمة المرور', 'ok');
      recoveryModalShown = false;
      try{ history.replaceState(null, '', window.location.pathname + '#home'); }catch(e){}
    }
  });
}
window.showRecoveryModal = showRecoveryModal;

/* ربط */
document.addEventListener('click', function(e){
  const t = e.target;

  const tabBtn = t.closest('.auth-tabs button');
  if(tabBtn){ e.preventDefault(); showAuthForm(tabBtn.dataset.tab); return; }

  if(t.closest('#loginBtn')){ e.preventDefault(); doLogin(); return; }
  if(t.closest('#regBtn')){ e.preventDefault(); doRegister(); return; }
  if(t.closest('#adminBtn')){ e.preventDefault(); doAdminLogin(); return; }
  if(t.closest('#forgotLink')){ e.preventDefault(); doForgotPassword(); return; }
  if(t.closest('#authBack')){
    e.preventDefault();
    const a = document.getElementById('auth'); if(a) a.classList.remove('open');
    const w = document.getElementById('welcome'); if(w){ w.style.display = 'flex'; w.classList.remove('exit'); }
    return;
  }
});

document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter') return;
  const t = e.target;
  if(!t || t.tagName !== 'INPUT') return;

  if(t.id === 'loginPass' || t.id === 'loginEmail'){ e.preventDefault(); doLogin(); return; }
  if(['regPass','regEmail','regName','regPhone'].includes(t.id)){ e.preventDefault(); doRegister(); return; }
  if(t.id === 'adminPass' || t.id === 'adminEmail'){ e.preventDefault(); doAdminLogin(); return; }
});

/* تنظيف الجوال */
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('regPhone');
  if(phoneInput){
    phoneInput.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
  }
});
