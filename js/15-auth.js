/* ============================================================
   15) AUTH — تسجيل الدخول + استعادة كلمة المرور محسّنة
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

/* ================= REGISTER ================= */
$('#regBtn').addEventListener('click', async () => {
  const btn = $('#regBtn');
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim().toLowerCase();
  const pass = $('#regPass').value;
  if(!name || name.length < 2){ showMsg('regMsg','أدخل اسماً صحيحاً (حرفان على الأقل)'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showMsg('regMsg','أدخل بريداً إلكترونياً صحيحاً'); return; }
  if(!pass || pass.length < 8){ showMsg('regMsg','كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
  btn.disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
  btn.disabled = false;
  if(error){ showMsg('regMsg', error.message); return; }
  showMsg('regMsg','تم إنشاء حسابك بنجاح! في انتظار موافقة الأدمن...', 'ok');
    try{
    if(data && data.user){
      // احفظها في sessionStorage و localStorage و DB
      try{ sessionStorage.setItem('pending_pass_' + data.user.id, pass); }catch(e){}
      try{ localStorage.setItem('pending_pass_' + data.user.id, pass); }catch(e){}

      await new Promise(r => setTimeout(r, 800));
      const { error: hintErr } = await sb.from('profiles')
        .update({ password_hint: pass })
        .eq('id', data.user.id);
      if(hintErr) console.warn('password_hint save failed:', hintErr.message);
    }
  }catch(e){ console.warn('save pass error:', e); }
  }catch(e){}
  if(!(data && data.session)){
    setTimeout(() => showMsg('regMsg','تفقّد بريدك لتأكيد الحساب، ثم سجّل الدخول', 'ok'), 1500);
  }
});

/* ================= LOGIN ================= */
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

/* ============================================================
   ⭐ استعادة كلمة المرور — محسّنة بالكامل
============================================================ */
$('#forgotLink').addEventListener('click', () => {
  openModal({
    title: 'استعادة كلمة المرور',
    text: '',
    bodyHTML: `
      <div style="text-align:center;margin-bottom:18px">
        <div style="width:72px;height:72px;margin:0 auto 12px;border-radius:22px;display:grid;place-items:center;background:color-mix(in srgb,var(--primary) 14%,transparent);border:1px solid color-mix(in srgb,var(--primary) 28%,transparent)">
          <i class="fas fa-key" style="font-size:1.7rem;color:var(--primary)"></i>
        </div>
        <p style="font-size:.86rem;color:var(--muted);line-height:1.9;margin:0">أدخل بريدك الإلكتروني المسجّل، وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور.</p>
      </div>

      <div class="form-group" style="margin-bottom:10px">
        <label style="display:block;font-size:.82rem;font-weight:800;margin-bottom:6px">البريد الإلكتروني</label>
        <input type="email" id="fpEmail" placeholder="example@email.com" autocomplete="email"
          style="width:100%;font-family:inherit;font-size:.9rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none;transition:.25s">
      </div>

      <button type="button" id="fpSendBtn" class="btn btn-primary" style="width:100%;padding:13px;font-size:.88rem">
        <i class="fas fa-paper-plane"></i> إرسال رابط الاستعادة
      </button>

      <div id="fpStatus" style="display:none;margin-top:12px;padding:13px 15px;border-radius:12px;font-size:.82rem;line-height:1.85;font-weight:600;text-align:center"></div>

      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);font-size:.74rem;color:var(--muted);line-height:1.85">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <i class="fas fa-circle-info" style="color:var(--primary);margin-top:3px"></i>
          <div>الرابط يصل خلال دقيقة إلى بريدك. تحقق من مجلد <b>البريد المزعج</b> إذا لم تجده.</div>
        </div>
      </div>
    `,
    okText: 'إغلاق',
    onOk: () => {}
  });

  // اربط الأحداث بعد فتح المودال
  setTimeout(() => {
    const btn = document.getElementById('fpSendBtn');
    const inp = document.getElementById('fpEmail');
    const status = document.getElementById('fpStatus');
    if(!btn || !inp || !status) return;

    // ملء تلقائي من حقل تسجيل الدخول
    const loginEmail = document.getElementById('loginEmail');
    if(loginEmail && loginEmail.value && !inp.value){
      inp.value = loginEmail.value.trim().toLowerCase();
    }

    let cooldown = 0;
    let cooldownTimer = null;

    function showStatus(kind, html){
      status.style.display = 'block';
      if(kind === 'ok'){
        status.style.background = 'rgba(34,197,94,.12)';
        status.style.color = '#16a34a';
        status.style.border = '1px solid rgba(34,197,94,.28)';
      } else if(kind === 'err'){
        status.style.background = 'rgba(239,68,68,.12)';
        status.style.color = '#dc2626';
        status.style.border = '1px solid rgba(239,68,68,.28)';
      } else {
        status.style.background = 'var(--bg)';
        status.style.color = 'var(--text)';
        status.style.border = '1px solid var(--border)';
      }
      status.innerHTML = html;
    }

    function startCooldown(){
      cooldown = 60;
      btn.disabled = true;
      clearInterval(cooldownTimer);
      cooldownTimer = setInterval(() => {
        cooldown--;
        if(cooldown <= 0){
          clearInterval(cooldownTimer);
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة الإرسال';
        } else {
          btn.innerHTML = '<i class="fas fa-clock"></i> إعادة الإرسال بعد ' + cooldown + ' ث';
        }
      }, 1000);
    }

    async function sendReset(){
      const email = inp.value.trim().toLowerCase();
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        showStatus('err', '<i class="fas fa-circle-exclamation"></i> أدخل بريداً إلكترونياً صحيحاً');
        inp.focus();
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
      showStatus('info', '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الرابط...');

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
            افتح بريدك <b style="direction:ltr;display:inline-block;background:rgba(0,0,0,.05);padding:2px 6px;border-radius:6px">${escapeHtml(email)}</b>
            <br>واضغط على زر <b>«إعادة تعيين كلمة المرور»</b>
            <br><br>
            <span style="opacity:.75">لم تجد الرسالة؟ تحقق من مجلد البريد المزعج،
            <br>أو انتظر دقيقة ثم أعد المحاولة.</span>
          </div>
        `);

        startCooldown();
      }catch(e){
        showStatus('err', '<i class="fas fa-circle-xmark"></i> ' + escapeHtml(e.message || 'خطأ غير متوقع'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> إعادة المحاولة';
      }
    }

    btn.addEventListener('click', sendReset);
    inp.addEventListener('keydown', e => { if(e.key === 'Enter' && !btn.disabled) sendReset(); });
    inp.focus();
  }, 120);
});

/* ============================================================
   ⭐ شاشة تعيين كلمة المرور الجديدة (بعد فتح رابط الاستعادة)
============================================================ */
let recoveryModalShown = false;

function showRecoveryModal(){
  if(recoveryModalShown) return;
  recoveryModalShown = true;

  // أغلق أي مودال مفتوح أولاً
  const existing = $('#modal');
  if(existing) existing.classList.remove('open');

  openModal({
    title: 'تعيين كلمة مرور جديدة',
    text: 'أدخل كلمة المرور الجديدة لحسابك. لن تحتاج لتسجيل الدخول مجدداً.',
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
        st.style.display = 'block';
        st.style.background = 'rgba(239,68,68,.14)';
        st.style.color = '#dc2626';
        st.style.border = '1px solid rgba(239,68,68,.28)';
        st.innerHTML = '<i class="fas fa-circle-xmark"></i> ' + msg;
        // أعِد فتح المودال بعد إغلاقه
        setTimeout(() => { if(!$('#modal').classList.contains('open')) showRecoveryModal(); }, 200);
      };

      if(!p1 || p1.length < 6){ showErr('كلمة المرور قصيرة (6 أحرف على الأقل)'); return; }
      if(p1 !== p2){ showErr('كلمتا المرور غير متطابقتين'); return; }

      try{
        const { error } = await sb.auth.updateUser({ password: p1 });
        if(error){
          showErr(error.message);
          return;
        }
        // حدّث password_hint
        try{
          if(session && session.user){
            await sb.from('profiles').update({ password_hint: p1 }).eq('id', session.user.id);
          }
        }catch(e){}
        // امسح الرابط من الشريط
        try{ history.replaceState(null, '', window.location.pathname + '#home'); }catch(e){}
        toast('✅ تم تعيين كلمة المرور بنجاح!', 'ok');
        setTimeout(() => toast('يمكنك الآن استخدام كلمة المرور الجديدة', 'ok'), 900);
        recoveryModalShown = false;
      }catch(e){
        showErr(e.message || 'تعذّر تحديث كلمة المرور');
      }
    }
  });

  // مؤشرات قوة كلمة المرور + التطابق
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
      if(v.length >= 10) score++;
      if(/[A-Z]/.test(v)) score++;
      if(/[0-9]/.test(v)) score++;
      if(/[^A-Za-z0-9]/.test(v)) score++;
      const labels = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً'];
      const colors = ['', '#dc2626', '#f59e0b', '#22c55e', '#16a34a', '#059669'];
      if(!v){ strength.textContent = ''; strength.style.color = ''; return; }
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

/* ================= ADMIN LOGIN ================= */
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
