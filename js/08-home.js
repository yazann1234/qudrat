/* ============================================================
   08) HOME — الرئيسية + تقرير الأداء
============================================================ */

function renderHomeStats(){
  if(!userData) return;
  const avg = overallProgress();
  const setTxt = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setTxt('stFiles', completedCount());
  setTxt('stAvg', avg + '%');
  setTxt('stPages', totalPagesRead());
  setTxt('stBadge', userData.badges.length);
  const sp = $('#sidePct'); if(sp) sp.textContent = avg + '%';
  const sb = $('#sideBar'); if(sb) sb.style.width = avg + '%';
  const t = todayLog();
  const goal = Math.max(1, userData.goalPages || 10);
  const gp = Math.min(100, Math.round((t.pages / goal) * 100));
  const gr = $('#goalRing');
  if(gr){ const old = gr.querySelector('svg'); if(old) old.remove(); gr.insertAdjacentHTML('afterbegin', ringSVG(gp, 130, 12, 'var(--primary)', 'var(--primary-2)')); }
  setTxt('goalToday', t.pages);
  setTxt('goalTarget', goal);
  const gm = $('#goalMsg');
  if(gm){
    if(t.pages === 0) gm.textContent = 'لم تبدأ القراءة اليوم. افتح ملفاً وابدأ الآن!';
    else if(t.pages < goal) gm.textContent = `أحسنت! بقي ${goal - t.pages} صفحة لتحقيق هدف اليوم.`;
    else gm.textContent = '🎉 رائع! لقد حققت هدف اليوم بالكامل.';
  }
  const st = computeStreak();
  setTxt('streakNum', st);
  renderWeekChart('#weekChart', 100);
  renderWeekChart('#weekChartBig', 150);
  setTxt('tmSessions', t.sessions || 0);
  setTxt('tmMinutes', Math.round(t.min));
  try{ renderHome2(t, st, goal); }catch(e){}
}

/* ⭐ الرئيسية v2: ترحيب باسم الطالب + ملخص اليوم + زر «كمّل» ذكي + أرقام الوصول السريع */
function renderHome2(t, streak, goal){
  const setTxt = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  const now = new Date(), h = now.getHours();
  const hello = h < 5 ? 'مساء الخير' : h < 12 ? 'صباح الخير' : h < 17 ? 'طاب يومك' : 'مساء الخير';
  const first = (typeof currentUserObj !== 'undefined' && currentUserObj && currentUserObj.name) ? String(currentUserObj.name).trim().split(/\s+/)[0] : '';
  setTxt('h2Hello', hello + (first ? '، ' + first : '') + ' 👋');
  try{ setTxt('h2Date', now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })); }catch(e){}

  const chips = document.getElementById('h2Chips');
  if(chips){
    const left = Math.max(0, goal - t.pages);
    chips.innerHTML = `
      <span class="${streak > 0 ? 'fire' : ''}"><i class="fas fa-fire"></i> ${streak} ${streak === 1 ? 'يوم متواصل' : 'أيام متواصلة'}</span>
      <span><i class="fas fa-file-lines"></i> ${t.pages} صفحة اليوم</span>
      <span><i class="fas fa-clock"></i> ${Math.round(t.min)} دقيقة اليوم</span>
      <span class="${left === 0 ? 'ok' : ''}"><i class="fas fa-bullseye"></i> ${left === 0 ? 'حققت هدف اليوم 🎉' : 'باقي ' + left + ' صفحة للهدف'}</span>`;
  }

  /* زر «كمّل من حيث توقفت» */
  const btn = document.getElementById('h2ContinueBtn');
  if(btn){
    const f = h2LastFile();
    const span = btn.querySelector('span');
    if(span){
      if(f){
        const page = typeof getMaxPage === 'function' ? getMaxPage(f.id) : 0;
        const title = String(f.title || '').length > 22 ? String(f.title).slice(0, 22) + '…' : f.title;
        span.textContent = 'كمّل: ' + title + (page > 1 ? ' (ص ' + page + ')' : '');
      } else span.textContent = 'ابدأ المذاكرة';
    }
  }

  try{
    const files = typeof getUserCourseFiles === 'function' ? getUserCourseFiles() : [];
    const vids = typeof getUserCourseVideos === 'function' ? getUserCourseVideos() : [];
    if(files.length) setTxt('h2qFiles', files.length + ' ملف');
    if(vids.length) setTxt('h2qVideos', vids.length + ' فيديو');
  }catch(e){}
}

/* آخر ملف فتحه الطالب وما كمّله (ومسموح له) */
function h2LastFile(){
  try{
    if(typeof isSubscribed === 'function' && !isSubscribed()) return null;
    const visible = typeof getVisibleFiles === 'function' ? getVisibleFiles() : [];
    const opened = (userData && userData.opened) || [];
    for(const id of opened){
      const f = visible.find(x => x.id === id);
      if(f && getPct(f.id) < 100) return f;
    }
  }catch(e){}
  return null;
}
window.h2Continue = () => {
  const f = h2LastFile();
  if(f && typeof openFile === 'function') openFile(f.id);
  else if(typeof go === 'function') go('files');
};

function renderWeekChart(sel, height){
  const box = document.querySelector(sel); if(!box) return;
  const days = last7Days();
  const max = Math.max(10, ...days.map(d => d.min));
  const names = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
  box.innerHTML = days.map(d => {
    const h = Math.max(4, Math.round((d.min / max) * (height - 22)));
    return `<div class="week-bar" title="${d.min} دقيقة"><i style="height:${h}px"></i><span>${names[d.date.getDay()]}</span></div>`;
  }).join('');
}

function ringSVG(pct, size, stroke, colorA, colorB, bg){
  const uid = 'g' + Math.random().toString(36).slice(2, 9);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><defs><linearGradient id="${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${colorA}"/><stop offset="100%" stop-color="${colorB}"/></linearGradient></defs><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${bg || 'var(--border)'}" stroke-width="${stroke}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="url(#${uid})" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)"/></svg>`;
}

function updateSidebar(){ renderHomeStats(); }

function renderProgress(){
  const avg = overallProgress();
  const setTxt = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setTxt('progPctBig', avg + '%');
  setTxt('progDoneBig', completedCount() + '/' + statFiles().length);
  setTxt('progPagesBig', totalPagesRead());
  setTxt('progMinBig', Math.round(userData.minutes));
  const msgs = ['ابدأ بفتح أول ملف وسيتابع النظام تقدمك تلقائياً.','بداية جيدة! استمر في التقدم خطوة بخطوة.','أنت في منتصف الطريق تقريباً، لا تتوقف الآن!','أداء ممتاز! اقتربت من إتمام كل الملفات.','مذهل! أكملت جميع الملفات، أنت عبقري القدرات'];
  const idx = avg === 0 ? 0 : avg < 30 ? 1 : avg < 65 ? 2 : avg < 100 ? 3 : 4;
  const pm = $('#progMsg'); if(pm) pm.textContent = msgs[idx];
  const days = last7Days();
  const best = days.reduce((a,b)=> b.min > a.min ? b : a, days[0]);
  setTxt('bestDay', best && best.min ? best.min + ' دقيقة' : '—');
  setTxt('totalMinutes', Math.round(userData.minutes));
  setTxt('totalSessions', userData.sessions);
  const pl = $('#progressList'); if(!pl) return;
  const files = statFiles();
  if(!files.length){ pl.innerHTML = '<div class="admin-empty"><div class="em-ic"><i class="fas fa-inbox"></i></div><h3>لا توجد ملفات بعد</h3></div>'; return; }
  pl.innerHTML = files.map(f => {
    const p = getPct(f.id);
    const mp = getMaxPage(f.id);
    const total = f.page_count || '?';
    const curPage = mp > 0 ? Math.min(mp, total) : 0;
    const icon = f.icon || 'fa-book';
    const color = f.color || '#5b6cff';
    return `<div style="padding:16px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap"><i class="fas ${icon}" style="font-size:1.2rem;color:${color}"></i><b style="font-size:.9rem;flex:1;min-width:120px">${escapeHtml(f.title)} ${f.important ? '<i class="fas fa-star" style="color:var(--accent);font-size:.8rem"></i>' : ''}</b><span style="font-size:.74rem;color:var(--muted);font-weight:700">${curPage}/${total} صفحة</span><span style="font-size:.86rem;font-weight:900;color:${color}">${p}%</span></div><div class="bar"><i style="width:${p}%;background:linear-gradient(90deg,${color},${color}aa)"></i></div></div>`;
  }).join('') + `<div style="padding-top:18px;display:flex;gap:20px;flex-wrap:wrap;font-size:.84rem;color:var(--muted);font-weight:700"><span><i class="fas fa-book" style="color:var(--primary)"></i> ملفات مكتملة: <b style="color:var(--primary)">${completedCount()}</b></span><span><i class="fas fa-file-lines" style="color:var(--primary)"></i> صفحات مقروءة: <b style="color:var(--primary)">${totalPagesRead()}</b></span><span><i class="fas fa-stopwatch" style="color:var(--primary)"></i> دقائق المذاكرة: <b style="color:var(--primary)">${Math.round(userData.minutes)}</b></span><span><i class="fas fa-bullseye" style="color:var(--primary)"></i> جلسات التركيز: <b style="color:var(--primary)">${userData.sessions}</b></span></div>`;
}
