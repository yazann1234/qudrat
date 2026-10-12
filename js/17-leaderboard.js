/* ============================================================
   17) LEADERBOARD v2 — صدارة موحّدة للجميع
   - الترتيب يعتمد فقط على الأرقام المحفوظة في السيرفر (profiles)
     → كل الطلاب يشوفون نفس الترتيب ونفس النقاط بالضبط
     (سابقاً كل متصفح كان يخلط أرقامه المحلية + يقرأ تقدمه فقط)
   - نظام نقاط واضح ومعلن
============================================================ */

/* ⭐ نظام النقاط الرسمي */
const XP_RULES = {
  page: 2,          /* كل صفحة جديدة تقرأها */
  fileDone: 100,    /* إكمال ملف */
  session: 25,      /* جلسة تركيز كاملة */
  badge: 15,        /* كل شارة */
  video: 50,        /* إكمال فيديو */
  adhkar: 5,        /* إكمال ذكر (مرة يومياً لكل ذكر) */
  planTask: 'حسب المهمة', /* مهام الجدول الذكي */
  quizWin: 100      /* الفوز في لعبة العباقرة */
};
window.XP_RULES = XP_RULES;

function calcXp(pages, completed, sessions, badges){
  return (pages * XP_RULES.page) + (completed * XP_RULES.fileDone) + (sessions * XP_RULES.session) + ((badges || 0) * XP_RULES.badge);
}

function myStats(){
  let pages = 0, completed = 0;
  for(const fid in userData.progress){
    const p = userData.progress[fid];
    if(!p) continue;
    const pct = typeof p === 'object' ? (p.pct || 0) : p;
    const mp = typeof p === 'object' ? (p.maxPage || 0) : 0;
    pages += mp;
    if(pct >= 100) completed++;
  }
  const sessions = userData.sessions || 0;
  const badges = (userData.badges || []).length;
  const extraXp = Math.max(0, userData.extraXp || 0);
  const xp = calcXp(pages, completed, sessions, badges) + extraXp;
  return { pages, completed, sessions, badges, xp, extraXp };
}

let _xpSyncTimer = null;
let _xpSyncing = null;

/* ⭐ مزامنة XP مع السيرفر (debounce) */
function syncMyXp(){
  if(!currentUserObj) return;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
  clearTimeout(_xpSyncTimer);
  _xpSyncTimer = setTimeout(pushMyXpNow, 600);
}
window.syncMyXp = syncMyXp;

async function pushMyXpNow(){
  if(!currentUserObj) return;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
  if(!window._progressReady) return;
  if(_xpSyncing) return _xpSyncing;
  clearTimeout(_xpSyncTimer);

  _xpSyncing = (async () => {
    const s = myStats();
    try{
      const r = await sbSafeWrite(
        p => sb.from('profiles').update(p).eq('id', currentUserObj.id),
        { xp_points: s.xp, focus_sessions: s.sessions, completed_files: s.completed, pages_read: s.pages }
      );
      if(r && r.error) console.warn('XP sync failed:', r.error.message);
      else {
        currentUserObj.xp_points = s.xp;
        currentUserObj.focus_sessions = s.sessions;
        currentUserObj.completed_files = s.completed;
        currentUserObj.pages_read = s.pages;
      }
    }catch(e){ console.warn('XP sync error:', e); }
    try{ if(typeof pushUserDataToDB === 'function') pushUserDataToDB(); }catch(e){}
  })();
  try{ await _xpSyncing; } finally { _xpSyncing = null; }
}
window.pushMyXpNow = pushMyXpNow;

/* ⭐ عند إكمال ملف: احتفال + نقاط فورية */
function onFileCompleted(file){
  if(!file) return;
  toast(`🎉 أكملت «${file.title}» — +${XP_RULES.fileDone} XP`, 'ok');
  try{ if(typeof beep === 'function') beep(); }catch(e){}
  try{ flushProgressSync(); }catch(e){}
  try{ checkBadges(); renderBadges(); }catch(e){}
}
window.onFileCompleted = onFileCompleted;

function avatarStyleFor(p){
  if(p && p.avatar_url) return `background-image:url('${p.avatar_url}')`;
  return '';
}
function avatarInitialFor(p){
  return (p && p.name ? String(p.name).trim().charAt(0) : '؟') || '؟';
}

/* ================== الصدارة ================== */
let _lbLoading = false;
let _lbAutoTimer = null;

async function fetchLeaderboardRows(){
  const cols = 'id, name, avatar_url, role, status, xp_points, focus_sessions, completed_files, pages_read, created_at';
  let r = await sb.from('profiles').select(cols).not('role', 'in', '(admin,owner)');
  if(r.error){
    /* لو عمود pages_read غير موجود بعد */
    r = await sb.from('profiles').select('id, name, avatar_url, role, status, xp_points, focus_sessions, completed_files, created_at').not('role', 'in', '(admin,owner)');
  }
  if(r.error) throw r.error;
  return r.data || [];
}

async function renderLeaderboard(){
  const podiumBox = $('#lbPodium');
  const listBox = $('#lbList');
  const myRankBox = $('#lbMyRank');
  if(!podiumBox || !listBox || _lbLoading) return;
  _lbLoading = true;

  if(!podiumBox.innerHTML.trim()){
    podiumBox.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary)"></i></div>';
  }

  /* ⭐ احفظ نقاطي أولاً — حتى أشوف نفسي بنفس الرقم اللي يشوفه الكل */
  try{ await pushMyXpNow(); }catch(e){}

  let rows = [];
  try{ rows = await fetchLeaderboardRows(); }
  catch(e){
    _lbLoading = false;
    listBox.innerHTML = `<div class="lb-empty"><i class="fas fa-triangle-exclamation"></i><h3>تعذّر تحميل الصدارة</h3><p>${escapeHtml(e.message || '')}</p></div>`;
    podiumBox.innerHTML = '';
    return;
  }
  _lbLoading = false;

  const users = rows
    .map(p => ({
      id: p.id,
      name: p.name || 'طالب',
      avatar_url: p.avatar_url,
      xp: Math.max(0, Number(p.xp_points) || 0),
      pages: Number(p.pages_read) || 0,
      completed: Number(p.completed_files) || 0,
      sessions: Number(p.focus_sessions) || 0,
      created: Date.parse(p.created_at || 0) || 0,
      status: p.status
    }))
    .filter(u => u.status === 'approved' || u.xp > 0);

  /* ⭐ ترتيب ثابت وواضح: XP ← الملفات المكتملة ← الصفحات ← الأقدم تسجيلاً */
  users.sort((a, b) =>
    (b.xp - a.xp) || (b.completed - a.completed) || (b.pages - a.pages) ||
    (a.created - b.created) || String(a.id).localeCompare(String(b.id)));

  /* المتساوون في كل شيء ياخذون نفس المركز */
  let rank = 0, prev = null;
  users.forEach((u, i) => {
    if(!prev || u.xp !== prev.xp || u.completed !== prev.completed || u.pages !== prev.pages) rank = i + 1;
    u.rank = rank; prev = u;
  });

  if(!users.length){
    podiumBox.innerHTML = '';
    listBox.innerHTML = '<div class="lb-empty"><i class="fas fa-trophy"></i><h3>لا يوجد متصدرون بعد</h3><p>ابدأ المذاكرة واجمع النقاط لتظهر هنا!</p></div>';
    if(myRankBox) myRankBox.textContent = '—';
    renderXpRulesCard();
    return;
  }

  const me = users.find(u => currentUserObj && u.id === currentUserObj.id);
  if(myRankBox) myRankBox.textContent = me ? '#' + me.rank : '—';

  const top3 = users.slice(0, 3);
  function podiumCard(u){
    const av = avatarStyleFor(u);
    const r = u.rank;
    const cls = r === 1 ? 'rank1' : r === 2 ? 'rank2' : 'rank3';
    const crown = r === 1 ? '<div class="lb-crown"><i class="fas fa-crown"></i></div>' : '';
    return `<div class="lb-card ${cls}">
      ${crown}
      <div class="lb-avatar-wrap">
        <div class="lb-avatar" style="${av}">${av ? '' : escapeHtml(avatarInitialFor(u))}</div>
        <div class="lb-medal">${r}</div>
      </div>
      <div class="lb-name">${escapeHtml(u.name)}</div>
      <div class="lb-xp"><i class="fas fa-star"></i> ${u.xp.toLocaleString('en')} XP</div>
      <div class="lb-stats-mini">
        <span><i class="fas fa-file-lines"></i> ${u.pages} صفحة</span>
        <span><i class="fas fa-book"></i> ${u.completed} ملف</span>
        <span><i class="fas fa-stopwatch"></i> ${u.sessions} جلسة</span>
      </div>
    </div>`;
  }
  const ordered = [];
  if(top3[1]) ordered.push(podiumCard(top3[1]));
  if(top3[0]) ordered.push(podiumCard(top3[0]));
  if(top3[2]) ordered.push(podiumCard(top3[2]));
  podiumBox.innerHTML = ordered.join('');

  listBox.innerHTML = users.map(u => {
    const r = u.rank;
    const av = avatarStyleFor(u);
    const isMe = currentUserObj && u.id === currentUserObj.id;
    const rankCls = r === 1 ? 'g1' : r === 2 ? 'g2' : r === 3 ? 'g3' : '';
    const badgeCls = r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';
    const badgeTxt = r === 1 ? '🥇 ذهبي' : r === 2 ? '🥈 فضي' : r === 3 ? '🥉 برونزي' : 'مشارك';
    return `<div class="lb-row ${isMe ? 'me' : ''}" ${isMe ? 'id="lbMeRow"' : ''}>
      <div class="lb-rank-num ${rankCls}">${r}</div>
      <div class="lb-user-cell">
        <div class="lb-user-av" style="${av}">${av ? '' : escapeHtml(avatarInitialFor(u))}</div>
        <div style="min-width:0">
          <b>${escapeHtml(u.name)} ${isMe ? '<span style="color:var(--primary);font-size:.72rem">(أنت)</span>' : ''}</b>
          <small>${u.pages} صفحة • ${u.completed} ملف • ${u.sessions} جلسة</small>
        </div>
      </div>
      <div class="lb-xp-cell">${u.xp.toLocaleString('en')}<small>XP</small></div>
      <div class="lb-badge-mini ${badgeCls}">${badgeTxt}</div>
    </div>`;
  }).join('');

  renderXpRulesCard();

  /* تحديث تلقائي كل 30 ثانية ما دامت الصفحة مفتوحة */
  clearTimeout(_lbAutoTimer);
  _lbAutoTimer = setTimeout(() => {
    const v = document.getElementById('view-leaderboard');
    if(v && v.classList.contains('active') && !document.hidden) renderLeaderboard();
  }, 30000);
}
window.renderLeaderboard = renderLeaderboard;

/* ⭐ بطاقة «كيف تُحسب النقاط» */
function renderXpRulesCard(){
  const list = document.getElementById('lbList');
  if(!list) return;
  let card = document.getElementById('xpRulesCard');
  if(!card){
    card = document.createElement('div');
    card.id = 'xpRulesCard';
    card.className = 'xp-rules-card';
    list.parentNode.insertBefore(card, list.nextSibling);
  }
  const s = currentUserObj && currentUserObj.role !== 'admin' && currentUserObj.role !== 'owner' ? myStats() : null;
  card.innerHTML = `
    <h4><i class="fas fa-circle-info"></i> كيف تُحسب النقاط؟</h4>
    <div class="xp-rules-grid">
      <div><i class="fas fa-file-lines"></i><b>+${XP_RULES.page}</b><small>لكل صفحة جديدة</small></div>
      <div><i class="fas fa-book"></i><b>+${XP_RULES.fileDone}</b><small>إكمال ملف</small></div>
      <div><i class="fas fa-stopwatch"></i><b>+${XP_RULES.session}</b><small>جلسة تركيز</small></div>
      <div><i class="fas fa-video"></i><b>+${XP_RULES.video}</b><small>إكمال فيديو</small></div>
      <div><i class="fas fa-medal"></i><b>+${XP_RULES.badge}</b><small>كل شارة</small></div>
      <div><i class="fas fa-gamepad"></i><b>+${XP_RULES.quizWin}</b><small>فوز في اللعبة</small></div>
    </div>
    ${s ? `<div class="xp-rules-mine">نقاطك: <b>${s.xp.toLocaleString('en')} XP</b> = ${s.pages} صفحة × ${XP_RULES.page} + ${s.completed} ملف × ${XP_RULES.fileDone} + ${s.sessions} جلسة × ${XP_RULES.session} + ${s.badges} شارة × ${XP_RULES.badge} + ${s.extraXp} مكافآت</div>` : ''}
  `;
}
