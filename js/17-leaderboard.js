/* ============================================================
   17) LEADERBOARD — المتصدرون + XP
============================================================ */

function calcXp(pages, completed, sessions, badges){
  return (pages * 2) + (completed * 100) + (sessions * 25) + ((badges || 0) * 15);
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
  const extraXp = userData.extraXp || 0;
  const xp = calcXp(pages, completed, sessions, badges) + extraXp;
  return { pages, completed, sessions, badges, xp, extraXp };
}

let _xpSyncTimer = null;
let _xpSyncing = false;

/* ⭐ مزامنة XP مع قاعدة البيانات (مع debounce + تحقق من الأخطاء) */
function syncMyXp(){
  if(!currentUserObj) return;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
  clearTimeout(_xpSyncTimer);
  _xpSyncTimer = setTimeout(pushMyXpNow, 600);
}

async function pushMyXpNow(){
  if(!currentUserObj || _xpSyncing) return;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
  /* لا نكتب XP قبل تحميل التقدم من القاعدة (حتى لا نكتب رقماً ناقصاً) */
  if(!window._progressReady) return;
  _xpSyncing = true;
  const s = myStats();
  try{
    const r = await sbSafeWrite(
      p => sb.from('profiles').update(p).eq('id', currentUserObj.id),
      { xp_points: s.xp, focus_sessions: s.sessions, completed_files: s.completed }
    );
    if(r && r.error){
      console.warn('XP sync failed:', r.error.message);
    } else {
      currentUserObj.xp_points = s.xp;
      currentUserObj.focus_sessions = s.sessions;
      currentUserObj.completed_files = s.completed;
    }
  }catch(e){ console.warn('XP sync error:', e); }
  finally{ _xpSyncing = false; }
  /* احفظ user_data أيضاً (فيه extraXp + نسخة التقدم الاحتياطية) */
  try{ if(typeof pushUserDataToDB === 'function') pushUserDataToDB(); }catch(e){}
}
window.syncMyXp = syncMyXp;

/* ⭐ عند إكمال ملف: احتفال + نقاط فورية */
function onFileCompleted(file){
  if(!file) return;
  toast(`🎉 أكملت «${file.title}» — +100 XP`, 'ok');
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

async function renderLeaderboard(){
  const podiumBox = $('#lbPodium');
  const listBox = $('#lbList');
  const myRankBox = $('#lbMyRank');
  if(!podiumBox || !listBox) return;
  podiumBox.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary)"></i></div>';
  listBox.innerHTML = '';

  let profilesData = [];
  let progressData = [];
  try{
    const r1 = await sb.from('profiles').select('id, name, email, avatar_url, role, status, xp_points, focus_sessions, completed_files').not('role', 'in', '(admin,owner)');
    profilesData = r1.data || [];
  }catch(e){}
  if(!profilesData.length){
    try{
      const r1 = await sb.from('profiles').select('id, name, email, role, status').not('role', 'in', '(admin,owner)');
      profilesData = r1.data || [];
    }catch(e){}
  }
  try{
    const r2 = await sb.from('user_progress').select('user_id, pct, max_page');
    progressData = r2.data || [];
  }catch(e){}

  /* ⭐ تجميع التقدم لكل مستخدم مرة واحدة (O(n) بدل O(n×m)) */
  const progByUser = new Map();
  progressData.forEach(r => {
    let e = progByUser.get(r.user_id);
    if(!e){ e = { pages: 0, completed: 0 }; progByUser.set(r.user_id, e); }
    e.pages += (r.max_page || 0);
    if((r.pct || 0) >= 100) e.completed++;
  });

  const users = profilesData.map(p => {
    const e = progByUser.get(p.id) || { pages: 0, completed: 0 };
    const sessions = p.focus_sessions || 0;
    const completed = Math.max(e.completed, p.completed_files || 0);
    const computed = calcXp(e.pages, completed, sessions, 0);
    /* خذ الأعلى بين المحفوظ والمحسوب — حتى لو فشلت مزامنة أحدهما */
    const xp = Math.max(typeof p.xp_points === 'number' ? p.xp_points : 0, computed);
    return { id: p.id, name: p.name || 'طالب', avatar_url: p.avatar_url, xp, pages: e.pages, completed, sessions };
  });

  /* ⭐ المستخدم الحالي: استخدم أرقامه المحلية الدقيقة */
  if(currentUserObj){
    const me = users.find(u => u.id === currentUserObj.id);
    if(me){
      const s = myStats();
      me.xp = Math.max(me.xp, s.xp); me.pages = Math.max(me.pages, s.pages);
      me.completed = Math.max(me.completed, s.completed); me.sessions = Math.max(me.sessions, s.sessions);
    }
  }
  users.sort((a,b) => (b.xp - a.xp) || String(a.name).localeCompare(String(b.name), 'ar'));

  if(!users.length){
    podiumBox.innerHTML = '';
    listBox.innerHTML = '<div class="lb-empty"><i class="fas fa-trophy"></i><h3>لا يوجد متصدرون بعد</h3><p>ابدأ المذاكرة واجمع النقاط لتظهر هنا!</p></div>';
    if(myRankBox) myRankBox.textContent = '—';
    return;
  }

  const myIdx = users.findIndex(u => currentUserObj && u.id === currentUserObj.id);
  if(myRankBox) myRankBox.textContent = myIdx >= 0 ? '#' + (myIdx + 1) : '—';

  const top3 = users.slice(0, 3);
  function podiumCard(u, rank){
    const av = avatarStyleFor(u);
    const cls = rank === 1 ? 'rank1' : rank === 2 ? 'rank2' : 'rank3';
    const crown = rank === 1 ? '<div class="lb-crown"><i class="fas fa-crown"></i></div>' : '';
    return `<div class="lb-card ${cls}">
      ${crown}
      <div class="lb-avatar-wrap">
        <div class="lb-avatar" style="${av}">${av ? '' : escapeHtml(avatarInitialFor(u))}</div>
        <div class="lb-medal">${rank}</div>
      </div>
      <div class="lb-name">${escapeHtml(u.name)}</div>
      <div class="lb-xp"><i class="fas fa-star"></i> ${u.xp} XP</div>
      <div class="lb-stats-mini">
        <span><i class="fas fa-file-lines"></i> ${u.pages} صفحة</span>
        <span><i class="fas fa-book"></i> ${u.completed} ملف</span>
        <span><i class="fas fa-stopwatch"></i> ${u.sessions} جلسة</span>
      </div>
    </div>`;
  }
  const ordered = [];
  if(top3[1]) ordered.push(podiumCard(top3[1], 2));
  if(top3[0]) ordered.push(podiumCard(top3[0], 1));
  if(top3[2]) ordered.push(podiumCard(top3[2], 3));
  podiumBox.innerHTML = ordered.join('');

  listBox.innerHTML = users.map((u, i) => {
    const rank = i + 1;
    const av = avatarStyleFor(u);
    const isMe = currentUserObj && u.id === currentUserObj.id;
    const rankCls = rank === 1 ? 'g1' : rank === 2 ? 'g2' : rank === 3 ? 'g3' : '';
    const badgeCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const badgeTxt = rank === 1 ? '🥇 ذهبي' : rank === 2 ? '🥈 فضي' : rank === 3 ? '🥉 برونزي' : 'مشارك';
    return `<div class="lb-row ${isMe ? 'me' : ''}">
      <div class="lb-rank-num ${rankCls}">${rank}</div>
      <div class="lb-user-cell">
        <div class="lb-user-av" style="${av}">${av ? '' : escapeHtml(avatarInitialFor(u))}</div>
        <div style="min-width:0">
          <b>${escapeHtml(u.name)} ${isMe ? '<span style="color:var(--primary);font-size:.72rem">(أنت)</span>' : ''}</b>
          <small>${u.pages} صفحة • ${u.completed} ملف • ${u.sessions} جلسة</small>
        </div>
      </div>
      <div class="lb-xp-cell">${u.xp}<small>XP</small></div>
      <div class="lb-badge-mini ${badgeCls}">${badgeTxt}</div>
    </div>`;
  }).join('');
}
