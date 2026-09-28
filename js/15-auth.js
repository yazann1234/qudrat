/* ============================================================
   15) AUTH — تسجيل الدخول/الحساب/الأدمن
============================================================ */

function showAuth(){ $('#auth').classList.add('open'); }
function hideAuth(){ $('#auth').classList.remove('open'); }

function showAuthForm(tab){
  $$('.auth-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.auth-form').forEach(f => f.classList.remove('on'));
  const el = document.getElementById('form-' + tab);
  if(el) el.classList.add('on');
  ['loginMsg','regMsg','adminMsg'].forEach(id => {
    const m = document.getElementById(id);
    if(m){ m.className = 'auth-msg'; m.textContent = ''; }
  });
}
function showMsg(elId, text, type='err'){
  const el = document.getElementById(elId); if(!el) return;
  el.innerHTML = `<i class="fas ${type === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${escapeHtml(text)}`;
  el.className = 'auth-msg ' + type;
}
$$('.auth-tabs button').forEach(b => b.addEventListener('click', () => showAuthForm(b.dataset.tab)));
$('#authBack').addEventListener('click', () => {
  hideAuth();
  const w = $('#welcome'); w.style.display = 'flex'; w.classList.remove('exit');
});

$('#regBtn').addEventListener('click', async () => {
  const btn = $('#regBtn');
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim().toLowerCase();
  const pass = $('#regPass').value;
  if(!name || name.length < 2){ showMsg('regMsg','أدخل اسماً صحيحاً (حرفان على الأقل)'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('regMsg','أدخل بريداً إلكترونياً صحيحاً'); return; }
  if(!pass || pass.length < 6){ showMsg('regMsg','كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
  btn.disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
  btn.disabled = false;
  if(error){ showMsg('regMsg', error.message); return; }
  showMsg('regMsg','تم إنشاء حسابك بنجاح! في انتظار موافقة الأدمن...', 'ok');
  try{
    if(data && data.user){
      await new Promise(r => setTimeout(r, 600));
      await sb.from('profiles').update({ password_hint: pass }).eq('id', data.user.id);
    }
  }catch(e){}
  if(!(data && data.session)){
    setTimeout(() => showMsg('regMsg','تفقّد بريدك لتأكيد الحساب، ثم سجّل الدخول', 'ok'), 1500);
  }
});

$('#loginBtn').addEventListener('click', async () => {
  const btn = $('#loginBtn');
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  if(!email || !pass){ showMsg('loginMsg','أدخل البريد وكلمة المرور'); return; }
  btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false;
  if(error){
    showMsg('loginMsg', error.message === 'Invalid login credentials' ? 'البريد أو كلمة المرور غير صحيحة' : error.message);
    return;
  }
  showMsg('loginMsg','تم تسجيل الدخول', 'ok');
});

$('#forgotLink').addEventListener('click', () => {
  openModal({
    title: 'استعادة كلمة المرور',
    text: 'أدخل بريدك الإلكتروني المسجّل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.',
    bodyHTML: `<div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="fpEmail" placeholder="example@email.com" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none"></div>`,
    okText: 'إرسال الرابط',
    onOk: async () => {
      const email = document.getElementById('fpEmail').value.trim().toLowerCase();
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('أدخل بريداً إلكترونياً صحيحاً', 'err'); return; }
      try{
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        if(error){ toast('فشل الإرسال: ' + error.message, 'err'); return; }
        toast('تم إرسال رابط إعادة التعيين إلى بريدك', 'ok');
      }catch(e){ toast('تعذّر الإرسال: ' + e.message, 'err'); }
    }
  });
});

$('#adminBtn').addEventListener('click', async () => {
  const btn = $('#adminBtn');
  const email = $('#adminEmail').value.trim().toLowerCase();
  const pass = $('#adminPass').value;
  if(!email || !pass){ showMsg('adminMsg','أدخل البريد وكلمة المرور'); return; }
  btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false;
  if(error){ showMsg('adminMsg','بيانات الدخول غير صحيحة'); return; }
  const { data: prof, error: pErr } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
  if(pErr || !prof || prof.role !== 'admin'){
    await sb.auth.signOut();
    showMsg('adminMsg','هذا الحساب ليس حساب أدمن');
    return;
  }
  showMsg('adminMsg','مرحباً بك أيها المدير', 'ok');
});
