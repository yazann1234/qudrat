/* ============================================================
   52) PROFILE v2 + ❄️ تجميد الاشتراك
   - ملف شخصي جديد: مستوى + ترتيب + أيام متواصلة + نشاط الأسبوع + شهاداتي
   - التجميد: 4 أيام لكل شهر اشتراك (شهر 4 • شهرين 8 • 3 شهور 12)
     الطالب يختار عدد الأيام ← نهاية اشتراكه تتمدد بنفس العدد
     أثناء التجميد المحتوى مقفل، ويقدر يفك التجميد بدري وترجع له الأيام
   - كل عمليات التجميد في السيرفر (supabase-update-11.sql)
============================================================ */

const PF2 = { rank: null, rankAt: 0, freeze: null, freezeDays: 1, wasFrozen: false };

const PF2_LEVELS = [
  { xp: 0,    name: 'مبتدئ',   icon: '🌱' },
  { xp: 200,  name: 'مجتهد',   icon: '📘' },
  { xp: 1000, name: 'متقدّم',   icon: '🚀' },
  { xp: 3000, name: 'عبقري',   icon: '🧠' },
  { xp: 6000, name: 'أسطورة',  icon: '👑' }
];

function pf2Level(xp){
  let i = 0;
  while(i < PF2_LEVELS.length - 1 && xp >= PF2_LEVELS[i + 1].xp) i++;
  const cur = PF2_LEVELS[i], next = PF2_LEVELS[i + 1] || null;
  const pct = next ? Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100) : 100;
  return { cur, next, pct: Math.max(0, Math.min(100, pct)), num: i + 1 };
}

function pf2Date(d, withDay){
  try{
    return new Date(d).toLocaleDateString('ar-SA', withDay
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' });
  }catch(e){ return ''; }
}

function pf2IsStudent(){
  return currentUserObj && (currentUserObj.role || 'user') === 'user';
}

/* ================== الرسم الرئيسي (يُستدعى من renderProfile) ================== */
function renderProfile2(){
  if(!currentUserObj) return;
  try{ pf2RenderChips(); }catch(e){}
  try{ pf2RenderLevel(); }catch(e){}
  try{ pf2RenderWeek(); }catch(e){}
  try{
    const st = document.getElementById('pf2Streak');
    if(st) st.textContent = typeof computeStreak === 'function' ? computeStreak() : (userData.streak || 0);
    const bc = document.getElementById('pf2BadgeCount');
    if(bc && typeof BADGES !== 'undefined') bc.textContent = `(${(userData.badges || []).length} من ${BADGES.length})`;
    const ph = document.getElementById('profilePhoneInput');
    if(ph) ph.value = currentUserObj.phone || '—';
    const jn = document.getElementById('pf2Joined');
    if(jn) jn.textContent = currentUserObj.created_at ? pf2Date(currentUserObj.created_at) : '—';
  }catch(e){}
  pf2RenderRank();
  pf2RenderCerts();
  renderFreezeBox();
}
window.renderProfile2 = renderProfile2;

function pf2RenderChips(){
  const box = document.getElementById('pf2Chips');
  if(!box) return;
  const chips = [];
  const role = currentUserObj.role || 'user';
  if(role === 'owner') chips.push('<span class="pf2-chip gold"><i class="fas fa-crown"></i> رئيس المنصة</span>');
  else if(role === 'admin') chips.push('<span class="pf2-chip gold"><i class="fas fa-user-shield"></i> أدمن</span>');
  else if(typeof isFrozen === 'function' && isFrozen()) chips.push('<span class="pf2-chip ice"><i class="fas fa-snowflake"></i> مجمّد</span>');
  else if(currentUserObj.status === 'approved') chips.push('<span class="pf2-chip ok"><i class="fas fa-circle-check"></i> مشترك</span>');
  else chips.push(`<span class="pf2-chip warn"><i class="fas fa-hourglass-half"></i> ${currentUserObj.purchase_submitted ? 'قيد المراجعة' : 'غير مشترك'}</span>`);
  if(role === 'user' && typeof getMyCourses === 'function'){
    getMyCourses().forEach(c => chips.push(`<span class="pf2-chip" style="--cc:${c.color || '#5b6cff'}"><i class="fas ${c.icon || 'fa-graduation-cap'}"></i> ${escapeHtml(c.name)}</span>`));
  }
  box.innerHTML = chips.join('');
}

function pf2RenderLevel(){
  const box = document.getElementById('pf2Level');
  if(!box) return;
  if(!pf2IsStudent()){ box.innerHTML = ''; return; }
  const xp = (typeof XP !== 'undefined' && XP.mine) ? XP.mine.xp : (currentUserObj.xp_points || 0);
  const L = pf2Level(xp);
  box.innerHTML = `
    <div class="pf2-level-top">
      <span class="pf2-level-ic">${L.cur.icon}</span>
      <div><small>المستوى ${L.num}</small><b>${L.cur.name}</b></div>
    </div>
    <div class="pf2-level-bar"><i style="width:${L.pct}%"></i></div>
    <small class="pf2-level-next">${L.next ? `باقي <b>${(L.next.xp - xp).toLocaleString('en')}</b> XP للمستوى «${L.next.name}» ${L.next.icon}` : 'وصلت أعلى مستوى 👑'}</small>`;
}

function pf2RenderWeek(){
  const box = document.getElementById('pf2Week');
  if(!box || typeof last7Days !== 'function') return;
  const days = last7Days();
  const max = Math.max(10, ...days.map(d => d.min));
  const total = days.reduce((a, d) => a + d.min, 0);
  const pages = days.reduce((a, d) => a + d.pages, 0);
  const todayKey = typeof dayKey === 'function' ? dayKey(new Date()) : '';
  box.innerHTML = `
    <div class="pf2-week-bars">
      ${days.map(d => `
        <div class="pf2-wb ${d.key === todayKey ? 'today' : ''}" title="${d.min} دقيقة • ${d.pages} صفحة">
          <span class="pf2-wb-val">${d.min || ''}</span>
          <div class="pf2-wb-col"><i style="height:${Math.max(d.min ? 6 : 2, Math.round(d.min / max * 100))}%"></i></div>
          <small>${d.date.toLocaleDateString('ar-SA', { weekday: 'short' })}</small>
        </div>`).join('')}
    </div>
    <div class="pf2-week-sum">
      <span><i class="fas fa-clock"></i> <b>${total}</b> دقيقة هذا الأسبوع</span>
      <span><i class="fas fa-file-lines"></i> <b>${pages}</b> صفحة</span>
    </div>`;
}

/* ترتيبي في الصدارة (نفس ترتيب صفحة المتصدرين) */
async function pf2RenderRank(){
  const el = document.getElementById('pf2Rank');
  if(!el) return;
  if(!pf2IsStudent()){ el.textContent = '—'; return; }
  if(PF2.rank && Date.now() - PF2.rankAt < 120000){ el.textContent = '#' + PF2.rank; return; }
  try{
    let list = window._lbUsers;
    if(!list || !list.length){
      const { data, error } = await sb.rpc('get_leaderboard');
      if(error || !Array.isArray(data)) return;
      list = data.map(r => ({ id: r.id, xp: Number(r.xp) || 0, completed: Number(r.completed) || 0, pages: Number(r.pages) || 0,
                              created: Date.parse(r.created_at || 0) || 0, status: r.status }))
        .filter(u => u.status === 'approved' || u.xp > 0)
        .sort((a, b) => (b.xp - a.xp) || (b.completed - a.completed) || (b.pages - a.pages) || (a.created - b.created) || String(a.id).localeCompare(String(b.id)));
      list.forEach((u, i) => { u.rank = i + 1; });
    }
    const me = list.find(u => u.id === currentUserObj.id);
    if(me){ PF2.rank = me.rank; PF2.rankAt = Date.now(); el.textContent = '#' + me.rank; }
  }catch(e){}
}

/* 🏆 شهاداتي (شهادات أبطال الشهر) */
async function pf2RenderCerts(){
  const box = document.getElementById('pf2Certs');
  if(!box) return;
  if(!pf2IsStudent()){ box.innerHTML = ''; return; }
  try{
    const { data, error } = await sb.from('monthly_awards').select('id,rank,month,month_label,xp')
      .eq('user_id', currentUserObj.id).order('month', { ascending: false });
    if(error || !data || !data.length){ box.innerHTML = ''; return; }
    const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉';
    box.innerHTML = `
      <div class="card-basic pf2-card">
        <h3><i class="fas fa-certificate" style="color:#f59e0b"></i> شهاداتي <small class="pf2-muted">(${data.length})</small></h3>
        <div class="pf2-certs">
          ${data.map(a => `
            <button class="pf2-cert r${a.rank}" onclick="openAwardCertificate('${a.id}')">
              <span class="pf2-cert-medal">${medal(a.rank)}</span>
              <span><b>المركز ${a.rank === 1 ? 'الأول' : a.rank === 2 ? 'الثاني' : 'الثالث'}</b><small>${escapeHtml(a.month_label || a.month)}</small></span>
              <i class="fas fa-download"></i>
            </button>`).join('')}
        </div>
      </div>`;
  }catch(e){ box.innerHTML = ''; }
}

/* ================== ❄️ التجميد ================== */
async function pf2LoadFreeze(){
  try{
    const { data, error } = await sb.rpc('my_freeze_status');
    if(error || !data) return null;
    PF2.freeze = data;
    /* حدّث بياناتي من السيرفر (لو تغيّرت من جهاز ثاني أو من الإدارة) */
    currentUserObj.freeze_until = data.frozen ? data.freeze_until : null;
    if(data.subscription_end) currentUserObj.subscription_end = data.subscription_end;
    return data;
  }catch(e){ return null; }
}

async function renderFreezeBox(){
  const box = document.getElementById('freezeBox');
  if(!box) return;
  if(!pf2IsStudent() || currentUserObj.status !== 'approved' || !currentUserObj.subscription_end){ box.innerHTML = ''; return; }
  const f = await pf2LoadFreeze();
  if(!f){ box.innerHTML = ''; return; }   /* ملف SQL ما انشغّل بعد */

  if(f.frozen){
    const until = new Date(f.freeze_until);
    const msLeft = until - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
    const total = Math.max(1, Math.ceil((until - new Date(f.freeze_started_at || Date.now())) / 86400000));
    const pct = Math.min(100, Math.max(0, Math.round((1 - msLeft / (total * 86400000)) * 100)));
    const unused = Math.max(0, Math.floor(msLeft / 86400000));
    box.innerHTML = `
      <div class="freeze-card frozen">
        <div class="fz-snow"><i class="fas fa-snowflake"></i><i class="fas fa-snowflake"></i><i class="fas fa-snowflake"></i></div>
        <div class="fz-head">
          <div class="fz-ic"><i class="fas fa-snowflake"></i></div>
          <div><small>حالة الاشتراك</small><b>حسابك مجمّد ❄️</b></div>
        </div>
        <div class="fz-count"><b>${daysLeft}</b><small>${daysLeft === 1 ? 'يوم متبقي على التجميد' : 'يوم متبقي على التجميد'}</small></div>
        <div class="fz-bar"><i style="width:${pct}%"></i></div>
        <div class="fz-info">
          <div><i class="fas fa-play"></i> يرجع حسابك <b>${pf2Date(until, true)}</b></div>
          <div><i class="fas fa-flag-checkered"></i> اشتراكك تمدد إلى <b>${pf2Date(f.subscription_end)}</b></div>
          <div><i class="fas fa-lock"></i> الملفات والفيديوهات مقفلة أثناء التجميد</div>
        </div>
        <button class="btn fz-btn-unfreeze" onclick="unfreezeMyAccount(${unused})"><i class="fas fa-fire"></i> فك التجميد الآن</button>
        ${unused > 0 ? `<small class="fz-note">لو فكيته الحين يرجع لرصيدك <b>${unused}</b> ${unused === 1 ? 'يوم' : 'أيام'} ما استخدمتها</small>` : ''}
      </div>`;
    return;
  }

  const remaining = Number(f.remaining) || 0, allowance = Number(f.allowance) || 0, used = Number(f.used) || 0;
  const endD = new Date(f.subscription_end);
  if(endD <= new Date()){ box.innerHTML = ''; return; }
  PF2.freezeDays = Math.min(Math.max(1, PF2.freezeDays || 1), Math.max(1, remaining));
  const dots = Array.from({ length: allowance }, (_, i) => `<i class="${i < used ? 'used' : ''}"></i>`).join('');

  box.innerHTML = `
    <div class="freeze-card">
      <div class="fz-head">
        <div class="fz-ic"><i class="fas fa-snowflake"></i></div>
        <div style="flex:1"><small>مسافر؟ مريض؟ عندك اختبارات؟</small><b>تجميد الاشتراك</b></div>
        <span class="fz-balance"><b>${remaining}</b> / ${allowance} يوم</span>
      </div>
      <div class="fz-dots" title="رصيد أيام التجميد">${dots}</div>
      <p class="fz-desc">جمّد اشتراكك وقت ما تحتاج، وأيام التجميد <b>تنضاف لنهاية اشتراكك</b> — ما ينقص عليك ولا يوم.
        <br><span class="fz-rule">شهر = 4 أيام • شهرين = 8 أيام • 3 شهور = 12 يوم</span></p>
      ${remaining > 0 ? `
        <div class="fz-picker">
          <label>كم يوم تبي تجمّد؟</label>
          <div class="fz-stepper">
            <button type="button" onclick="pf2FreezeStep(1)" aria-label="زيادة"><i class="fas fa-plus"></i></button>
            <div class="fz-days"><b id="fzDays">${PF2.freezeDays}</b><small>${PF2.freezeDays === 1 ? 'يوم' : 'أيام'}</small></div>
            <button type="button" onclick="pf2FreezeStep(-1)" aria-label="نقص"><i class="fas fa-minus"></i></button>
          </div>
          <input type="range" id="fzRange" min="1" max="${remaining}" value="${PF2.freezeDays}" oninput="pf2FreezeSet(this.value)">
          <div class="fz-preview" id="fzPreview"></div>
        </div>
        <button class="btn btn-primary fz-btn" onclick="freezeMyAccount()"><i class="fas fa-snowflake"></i> جمّد اشتراكي</button>`
      : `<div class="fz-empty"><i class="fas fa-circle-info"></i> استخدمت كل أيام التجميد لهذا الاشتراك — يتجدد رصيدك مع الاشتراك الجاي.</div>`}
    </div>`;
  pf2FreezePreview();
}
window.renderFreezeBox = renderFreezeBox;

function pf2FreezePreview(){
  const box = document.getElementById('fzPreview');
  if(!box || !PF2.freeze) return;
  const d = PF2.freezeDays;
  const back = new Date(Date.now() + d * 86400000);
  const newEnd = new Date(new Date(PF2.freeze.subscription_end).getTime() + d * 86400000);
  box.innerHTML = `
    <div><i class="fas fa-play"></i> يرجع حسابك <b>${pf2Date(back, true)}</b></div>
    <div><i class="fas fa-flag-checkered"></i> نهاية اشتراكك تصير <b>${pf2Date(newEnd)}</b> <span class="fz-plus">+${d}</span></div>`;
}

window.pf2FreezeSet = (v) => {
  const max = PF2.freeze ? Number(PF2.freeze.remaining) || 1 : 1;
  PF2.freezeDays = Math.min(max, Math.max(1, parseInt(v, 10) || 1));
  const b = document.getElementById('fzDays'); if(b){ b.textContent = PF2.freezeDays; b.nextElementSibling.textContent = PF2.freezeDays === 1 ? 'يوم' : 'أيام'; }
  const r = document.getElementById('fzRange'); if(r && Number(r.value) !== PF2.freezeDays) r.value = PF2.freezeDays;
  pf2FreezePreview();
};
window.pf2FreezeStep = (n) => window.pf2FreezeSet(PF2.freezeDays + n);

async function pf2RefreshMe(){
  try{
    const { data } = await sb.from('profiles').select('*').eq('id', currentUserObj.id).maybeSingle();
    if(data) currentUserObj = Object.assign({}, currentUserObj, data);
  }catch(e){}
  PF2.wasFrozen = typeof isFrozen === 'function' && isFrozen();
  pf2RefreshContent();
}

/* بعد التجميد/فكه: نحدّث كل الأماكن اللي تعتمد على الاشتراك */
function pf2RefreshContent(){
  ['applyUserUI', 'renderSubBanners', 'renderFiles', 'renderVideos', 'renderProfile', 'fixNavCounts'].forEach(fn => {
    try{ if(typeof window[fn] === 'function') window[fn](); }catch(e){}
  });
}

window.freezeMyAccount = () => {
  const d = PF2.freezeDays;
  const back = new Date(Date.now() + d * 86400000);
  confirmBox('❄️ تجميد الاشتراك',
    `بتجمّد اشتراكك <b>${d} ${d === 1 ? 'يوم' : 'أيام'}</b>.<br><br>
     • الملفات والفيديوهات تنقفل لين <b>${pf2Date(back, true)}</b><br>
     • نهاية اشتراكك تتمدد ${d} ${d === 1 ? 'يوم' : 'أيام'}<br>
     • تقدر تفك التجميد بدري وترجع لك الأيام اللي ما استخدمتها`,
    async () => {
      const { data, error } = await sb.rpc('freeze_my_account', { p_days: d });
      if(error){ toast('فشل التجميد: ' + error.message, 'err'); return; }
      if(!data || !data.ok){
        const why = { already: 'حسابك مجمّد أصلاً', expired: 'اشتراكك منتهي', not_active: 'ما عندك اشتراك فعّال',
                      no_end: 'اشتراكك ما له تاريخ نهاية', bad_days: `رصيدك ${data && data.remaining != null ? data.remaining : 0} يوم فقط` };
        toast(why[data && data.reason] || 'تعذّر التجميد', 'warn');
        renderFreezeBox();
        return;
      }
      toast(`❄️ تم تجميد اشتراكك ${d} ${d === 1 ? 'يوم' : 'أيام'} — نشوفك ${pf2Date(back, true)} 💙`, 'ok');
      PF2.freezeDays = 1;
      await pf2RefreshMe();
    });
};

window.unfreezeMyAccount = (unused) => {
  confirmBox('🔥 فك التجميد',
    `يرجع حسابك يشتغل الحين${unused > 0 ? `، ويرجع لرصيدك <b>${unused}</b> ${unused === 1 ? 'يوم' : 'أيام'} ما استخدمتها (وتنخصم من التمديد)` : ''}.`,
    async () => {
      const { data, error } = await sb.rpc('unfreeze_account', {});
      if(error){ toast('فشل: ' + error.message, 'err'); return; }
      if(!data || !data.ok){ toast('حسابك مو مجمّد', 'warn'); await pf2RefreshMe(); return; }
      toast('🔥 رجع حسابك — يلا نكمّل المذاكرة!', 'ok');
      await pf2RefreshMe();
    });
};

/* انتهى وقت التجميد والصفحة مفتوحة → نفتح المحتوى تلقائياً */
setInterval(() => {
  if(!currentUserObj) return;
  const now = typeof isFrozen === 'function' && isFrozen();
  if(PF2.wasFrozen && !now){
    toast('🔥 انتهى التجميد — حسابك رجع يشتغل', 'ok');
    pf2RefreshContent();
  }
  PF2.wasFrozen = now;
}, 30000);

/* الإدارة: فك تجميد طالب */
window.adminUnfreezeUser = (userId, name) => {
  confirmBox('فك التجميد', `فك تجميد «${escapeHtml(name || '')}»؟ الأيام اللي ما استخدمها ترجع لرصيده.`, async () => {
    const { data, error } = await sb.rpc('unfreeze_account', { p_user: userId });
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    if(!data || !data.ok){ toast('الطالب مو مجمّد', 'warn'); return; }
    toast(`✓ تم فك التجميد (رجع له ${data.returned_days || 0} يوم)`, 'ok');
    try{ if(typeof loadProfilesAndFiles === 'function') loadProfilesAndFiles(); }catch(e){}
  });
};

/* زر تغيير كلمة المرور */
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('pf2ChangePw');
  if(b) b.addEventListener('click', () => {
    if(typeof doForgotPassword === 'function') doForgotPassword(currentUserObj && currentUserObj.email);
  });
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if(currentUserObj){ clearInterval(t); PF2.wasFrozen = typeof isFrozen === 'function' && isFrozen(); }
    else if(tries > 60) clearInterval(t);
  }, 1000);
});
