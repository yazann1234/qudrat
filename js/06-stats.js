/* ============================================================
   06) STATS — الإحصاءات والشارات
============================================================ */

function getPct(id){ const p = userData.progress[id]; if(!p) return 0; return typeof p === 'object' ? (p.pct || 0) : p; }
function getMaxPage(id){ const p = userData.progress[id]; if(!p || typeof p !== 'object') return 0; return p.maxPage || 0; }

/* ⭐ الإحصاءات تُحسب على ملفات دورة الطالب فقط (وليس كل ملفات المنصة) */
function statFiles(){
  try{ if(typeof getVisibleFiles === 'function') return getVisibleFiles(); }catch(e){}
  return DB.files || [];
}
function overallProgress(){
  const list = statFiles();
  if(!list.length) return 0;
  const sum = list.reduce((a,f)=> a + getPct(f.id), 0);
  return Math.round(sum / list.length);
}
function completedCount(){ return statFiles().filter(f => getPct(f.id) >= 100).length; }
function totalPagesRead(){ return statFiles().reduce((a,f)=> a + getMaxPage(f.id), 0); }
function isSubscribed(){
  return currentUserObj && (
    currentUserObj.role === 'admin' ||
    currentUserObj.role === 'owner' ||
    currentUserObj.status === 'approved'
  );
}
function isPending(){ return currentUserObj && currentUserObj.role !== 'admin' && currentUserObj.status === 'pending'; }

function todayLog(){
  const k = dayKey();
  if(!userData.log[k]) userData.log[k] = { min:0, pages:0, sessions:0 };
  const e = userData.log[k];
  if(typeof e.min !== 'number') e.min = 0;
  if(typeof e.pages !== 'number') e.pages = 0;
  if(typeof e.sessions !== 'number') e.sessions = 0;
  return e;
}
function addPagesToday(n){ if(!n) return; const e = todayLog(); e.pages += n; savePrefs(); }
function addMinutesToday(n){ if(!n) return; const e = todayLog(); e.min += n; userData.minutes += n; savePrefs(); }

function computeStreak(){
  let streak = 0;
  const d = new Date();
  const todayHas = (() => { const e = userData.log[dayKey(d)]; return e && (e.min >= 1 || e.pages > 0); })();
  if(!todayHas) d.setDate(d.getDate() - 1);
  for(let i = 0; i < 400; i++){
    const e = userData.log[dayKey(d)];
    if(e && (e.min >= 1 || e.pages > 0)){ streak++; d.setDate(d.getDate() - 1); } else break;
  }
  userData.streak = streak;
  return streak;
}

function last7Days(){
  const out = [];
  const d = new Date();
  for(let i = 6; i >= 0; i--){
    const dd = new Date();
    dd.setDate(d.getDate() - i);
    const e = userData.log[dayKey(dd)] || { min:0, pages:0 };
    out.push({ key: dayKey(dd), date: dd, min: Math.round(e.min || 0), pages: e.pages || 0 });
  }
  return out;
}

function checkBadges(){
   
  const add = id => {
    if(userData.badges.includes(id)) return;
    userData.badges.push(id);
    const b = BADGES.find(x => x.id === id);
    if(b) toast(`حصلت على شارة «${b.t}»`, 'ok');
  };
  const vals = statFiles().map(f => getPct(f.id));
  if(userData.opened.length) add('first');
  if(totalPagesRead() >= 10) add('pages10');
  if(totalPagesRead() >= 100) add('pages100');
  if(vals.some(v => v >= 50)) add('half');
  if(vals.some(v => v >= 100)) add('done1');
  if(vals.filter(v => v >= 50).length >= 3) add('three');
  if(vals.length && vals.every(v => v >= 100)) add('all');
  if(userData.sessions >= 1) add('focus1');
  if(userData.sessions >= 10) add('focus10');
  const st = computeStreak();
  if(st >= 3) add('streak3');
  if(st >= 7) add('streak7');
  const t = todayLog();
  if(userData.goalPages && t.pages >= userData.goalPages) add('goal');

  // شارة الفيديوهات
  const vp = userData.videoProgress || {};
  const watchedCount = Object.values(vp).filter(p => p && p.completed).length;
  if(watchedCount >= 5) add('videos5');

  savePrefs();
}

function renderBadges(){
  const html = BADGES.map(b => `
    <div class="badge-item ${userData.badges.includes(b.id) ? 'on' : ''}">
      <div class="bi"><i class="fas ${b.i}"></i></div>
      <div><b>${b.t}</b><small>${b.d}</small></div>
    </div>`).join('');
  const h = $('#badgesHome'); if(h) h.innerHTML = html;
  const a = $('#badgesAll'); if(a) a.innerHTML = html;
  const p = $('#profileBadgesList'); if(p) p.innerHTML = html;
}
