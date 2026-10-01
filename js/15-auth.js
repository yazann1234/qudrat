/* ============================================================
   15) AUTH — دوال المصادقة فقط (بدون ربط أزرار)
   الأزرار مربوطة مركزياً في js/21-app.js
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
  }catch(e){ console.warn('showAuthForm error', e); }
}
window.showAuthForm = showAuthForm;

function showMsg(elId, text, type='err'){
  const el = document.getElementById(elId);
  if(!el) return;
  el.innerHTML = `<i class="fas ${type === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${escapeHtml(text)}`;
  el.className = 'auth-msg ' + type;
}
window.showMsg = showMsg;

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
    onOk: async () => {
      const p1 = document.getElementById('npPass').value;
      const p2 = document.getElementById('npPass2').value;
      const st = document.getElementById('npStatus');
      const showErr = (msg) => {
        if(st){
          st.style.display = 'block';
          st.style.background = 'rgba(239,68,68,.14)';
          st.style.color = '#dc2626';
          st.style.border = '1px solid rgba(239,68,68,.28)';
          st.innerHTML = '<i class="fas fa-circle-xmark"></i> ' + msg;
        }
        setTimeout(() => {
          if(!document.getElementById('modal').classList.contains('open')){
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
          if(session && session.user){
            await sb.from('profiles').update({ password_hint: p1 }).eq('id', session.user.id);
            sessionStorage.setItem('pending_pass_' + session.user.id, p1);
            localStorage.setItem('pending_pass_' + session.user.id, p1);
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

  setTimeout(() => {
    const p1 = document.getElementById('npPass');
    const p2 = document.getElementById('npPass2');
    const strength = document.getElementById('npStrength');
    const match = document.getElementById('npMatch');
    if(!p1 || !p2) return;

    p1.addEventListener('input', () => {
      const v = p1.value;
      let score = 0;
      if(v.length >= 8) score++;
      if(v.length >= 12) score++;
      if(/[A-Z]/.test(v)) score++;
      if(/[0-9]/.test(v)) score++;
      if(/[^A-Za-z0-9]/.test(v)) score++;
      const labels = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً'];
      const colors = ['', '#dc2626', '#f59e0b', '#22c55e', '#16a34a', '#059669'];
      if(!v){ strength.textContent = ''; return; }
      strength.textContent = labels[score] || 'ضعيفة';
      strength.style.color = colors[score] || '#dc2626';
    });

    function checkMatch(){
      const a = p1.value, b = p2.value;
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
