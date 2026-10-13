/* ============================================================
   17) LEADERBOARD v2 — صدارة موحّدة للجميع
   - الترتيب يعتمد فقط على الأرقام المحفوظة في السيرفر (profiles)
     → كل الطلاب يشوفون نفس الترتيب ونفس النقاط بالضبط
     (سابقاً كل متصفح كان يخلط أرقامه المحلية + يقرأ تقدمه فقط)
   - نظام نقاط واضح ومعلن
============================================================ */

/* ⭐ نظام النقاط الرسمي */
const XP_RULES = {
  page: 2,          /* كل صفحة تقرأها (8 ثوانٍ على الأقل) */
  fileDone: 100,    /* إكمال ملف (بعد قراءة 90% من صفحاته) */
  minute: 1,        /* كل دقيقة تركيز حقيقية */
  video: 50,        /* مشاهدة فيديو كامل */
  quizPlay: 20,     /* المشاركة في لعبة العباقرة */
  quizCorrect: 10,  /* كل إجابة صحيحة */
  quizWin: 100      /* الفوز */
};
window.XP_RULES = XP_RULES;

function calcXp(pages, completed, sessions, badges){
  return (pages * XP_RULES.page) + (completed * XP_RULES.fileDone) + (sessions * XP_RULES.session) + ((badges || 0) * XP_RULES.badge);
}

/* ⭐ نقاطي من السيرفر (السجل) — المتصفح لا يحسب النقاط */
function myStats(){
  const m = (typeof XP !== 'undefined' && XP.mine) ? XP.mine : { xp: 0, pages: 0, files: 0, minutes: 0 };
  return { pages: m.pages, completed: m.files, sessions: m.minutes, badges: (userData && userData.badges || []).length, xp: m.xp, extraXp: 0 };
}
function _oldLocalStats(){
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
  /* النقاط تُسجّل في السيرفر مباشرة — هنا نحدّث العرض فقط */
  clearTimeout(_xpSyncTimer);
  _xpSyncTimer = setTimeout(() => { if(typeof xpRefreshMine === 'function') xpRefreshMine(); }, 800);
}
window.syncMyXp = syncMyXp;

async function pushMyXpNow(){
  if(typeof xpRefreshMine === 'function') await xpRefreshMine();
}
window.pushMyXpNow = pushMyXpNow;

/* ⭐ عند إكمال ملف: احتفال + نقاط فورية */
function onFileCompleted(file){
  if(!file) return;
  try{ flushProgressSync(); }catch(e){}
  try{ checkBadges(); renderBadges(); }catch(e){}
  if(typeof xpFileComplete === 'function') xpFileComplete(file);
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
  /* ⭐ الأفضل: حساب موحّد في السيرفر (نفس النتيجة لكل الطلاب) */
  try{
    const rr = await sb.rpc('get_leaderboard');
    if(!rr.error && Array.isArray(rr.data)){
      return rr.data.map(r => ({
        id: r.id, name: r.name, avatar_url: r.avatar_url, status: r.status || 'approved',
        xp_points: r.xp, pages_read: r.pages, completed_files: r.completed, focus_sessions: r.sessions, created_at: r.created_at
      }));
    }
  }catch(e){}
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

  /* ترتيب متسلسل واضح: 1، 2، 3... */
  users.forEach((u, i) => { u.rank = i + 1; });
  window._lbUsers = users;   /* للشهادات */

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
        <span><i class="fas fa-stopwatch"></i> ${u.sessions} دقيقة</span>
      </div>
      <button class="lb-cert-podium" onclick="openCertificate('${u.id}')"><i class="fas fa-award"></i> الشهادة</button>
    </div>`;
  }
  const ordered = [];
  if(top3[1]) ordered.push(podiumCard(top3[1]));
  if(top3[0]) ordered.push(podiumCard(top3[0]));
  if(top3[2]) ordered.push(podiumCard(top3[2]));
  podiumBox.innerHTML = ordered.join('');

  renderLbToolbar(users.length);
  listBox.innerHTML = users.map(u => {
    const r = u.rank;
    const av = avatarStyleFor(u);
    const isMe = currentUserObj && u.id === currentUserObj.id;
    const t = lbTier(r, u.xp);
    const rankCls = t.rankCls;
    const badgeCls = t.cls;
    const badgeTxt = t.txt;
    return `<div class="lb-row ${isMe ? 'me' : ''}" ${isMe ? 'id="lbMeRow"' : ''}>
      <div class="lb-rank-num ${rankCls}">${r}</div>
      <div class="lb-user-cell">
        <div class="lb-user-av" style="${av}">${av ? '' : escapeHtml(avatarInitialFor(u))}</div>
        <div style="min-width:0">
          <b>${escapeHtml(u.name)} ${isMe ? '<span style="color:var(--primary);font-size:.72rem">(أنت)</span>' : ''}</b>
          <small>${u.pages} صفحة • ${u.completed} ملف • ${u.sessions} دقيقة تركيز</small>
        </div>
      </div>
      <div class="lb-xp-cell">${u.xp.toLocaleString('en')}<small>XP</small></div>
      <div class="lb-badge-mini ${badgeCls}">${badgeTxt}</div>
      <button class="lb-cert-btn ${isMe ? 'me' : ''}" onclick="openCertificate('${u.id}')" title="شهادة الشكر والتقدير"><i class="fas fa-award"></i>${isMe ? ' شهادتي' : ''}</button>
      ${typeof isPrivileged === 'function' && isPrivileged() ? `<button class="lb-cert-btn" onclick="resetUserPoints('${u.id}','${escapeHtml(u.name).replace(/'/g, '')}')" title="تصفير نقاط هذا الطالب" style="color:var(--danger)"><i class="fas fa-eraser"></i></button>` : ''}
    </div>`;
  }).join('');

  renderXpRulesCard();

  /* تحديث تلقائي كل 30 ثانية ما دامت الصفحة مفتوحة */
  clearTimeout(_lbAutoTimer);
  _lbAutoTimer = setTimeout(() => {
    const v = document.getElementById('view-leaderboard');
    if(v && v.classList.contains('active') && !document.hidden) renderLeaderboard();
  }, 60000);
}
window.renderLeaderboard = renderLeaderboard;

/* ⭐ شارة لكل مركز (بدل «مشارك» للجميع) */
function lbTier(rank, xp){
  if(rank === 1) return { cls: 'gold', rankCls: 'g1', txt: '🥇 ذهبي' };
  if(rank === 2) return { cls: 'silver', rankCls: 'g2', txt: '🥈 فضي' };
  if(rank === 3) return { cls: 'bronze', rankCls: 'g3', txt: '🥉 برونزي' };
  if(rank <= 10) return { cls: 'tier-top10', rankCls: 'r-top10', txt: '⭐ نخبة العشرة' };
  if(rank <= 25) return { cls: 'tier-top25', rankCls: 'r-top25', txt: '🔥 متميّز' };
  if(xp >= 3000) return { cls: 'tier-lvl4', rankCls: '', txt: '🧠 عبقري' };
  if(xp >= 1000) return { cls: 'tier-lvl3', rankCls: '', txt: '🚀 متقدّم' };
  if(xp >= 200)  return { cls: 'tier-lvl2', rankCls: '', txt: '📘 مجتهد' };
  return { cls: 'tier-lvl1', rankCls: '', txt: '🌱 مبتدئ' };
}

let _lbUpdatedAt = 0;
function renderLbToolbar(count){
  const list = document.getElementById('lbList');
  if(!list) return;
  let bar = document.getElementById('lbToolbar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'lbToolbar';
    bar.className = 'lb-toolbar';
    list.parentNode.insertBefore(bar, list);
  }
  _lbUpdatedAt = Date.now();
  bar.innerHTML = `
    <span><i class="fas fa-users"></i> ${count} طالب في الترتيب</span>
    <span class="lb-updated"><i class="fas fa-clock"></i> آخر تحديث: ${new Date(_lbUpdatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
    ${currentUserObj && (window._lbUsers || []).some(x => x.id === currentUserObj.id) ? `<button class="btn btn-primary btn-sm" onclick="openCertificate('${currentUserObj.id}')"><i class="fas fa-award"></i> شهادتي</button>` : ''}
    <button class="btn btn-ghost btn-sm" onclick="renderLeaderboard()"><i class="fas fa-rotate"></i> تحديث</button>
    ${typeof isPrivileged === 'function' && isPrivileged() ? '<button class="btn btn-danger btn-sm" onclick="resetAllPoints()"><i class="fas fa-trash-can"></i> تصفير كل النقاط</button>' : ''}`;
}

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
    <h4><i class="fas fa-circle-info"></i> كيف تُحسب النقاط؟ <small style="font-weight:700;color:var(--muted)">(يحسبها السيرفر — دقيقة وما فيها تلاعب)</small></h4>
    <div class="xp-rules-grid">
      <div><i class="fas fa-file-lines"></i><b>+${XP_RULES.page}</b><small>لكل صفحة تقرأها</small></div>
      <div><i class="fas fa-book"></i><b>+${XP_RULES.fileDone}</b><small>إكمال ملف</small></div>
      <div><i class="fas fa-stopwatch"></i><b>+${XP_RULES.minute}</b><small>لكل دقيقة تركيز</small></div>
      <div><i class="fas fa-video"></i><b>+${XP_RULES.video}</b><small>مشاهدة فيديو كامل</small></div>
      <div><i class="fas fa-gamepad"></i><b>+${XP_RULES.quizCorrect}</b><small>كل إجابة صحيحة باللعبة</small></div>
      <div><i class="fas fa-trophy"></i><b>+${XP_RULES.quizWin}</b><small>الفوز باللعبة</small></div>
    </div>
    ${s ? `<div class="xp-rules-mine">نقاطك: <b>${s.xp.toLocaleString('en')} XP</b> = ${s.pages} صفحة × ${XP_RULES.page} + ${s.completed} ملف × ${XP_RULES.fileDone} + ${s.sessions} دقيقة تركيز + الفيديوهات واللعبة</div>` : ''}
  `;
}
