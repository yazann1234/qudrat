/* ============================================================
   43) XP — نظام النقاط الدقيق (السيرفر هو المرجع الوحيد)
   كل نقطة تُطلب من السيرفر، والسيرفر يتحقق ويسجّلها مرة واحدة:
   📄 صفحة +2  (تبقى مفتوحة 8 ثوانٍ، صفحة كل 4 ثوانٍ كحد أقصى)
   📚 ملف +100 (بعد قراءة 90% من صفحاته فعلاً)
   ⏱️ تركيز +1 لكل دقيقة حقيقية
   🎬 فيديو +50 (وقت المشاهدة الحقيقي يغطي مدة الفيديو)
   🎮 لعبة: 20 + 10 لكل إجابة صحيحة + 100 للفائز (يحسبها السيرفر)
============================================================ */

const XP = {
  mine: { xp: 0, pages: 0, files: 0, minutes: 0, videos: 0, quizzes: 0 },
  awarded: new Set(),       /* fileId:page اللي انحسبت */
  loadedFile: null,
  dwellTimer: null,
  queue: [],
  queueBusy: false,
  focusId: null,
  focusSource: null,
  videoWatch: null,         /* { id, videoId } */
  videoClaimed: new Set(),
  refreshTimer: null
};

const XP_DWELL_MS = 8000;

function xpEligible(){
  return !!(currentUserObj && (currentUserObj.role || 'user') === 'user' && currentUserObj.status === 'approved');
}

async function xpRpc(fn, args){
  try{
    const { data, error } = await sb.rpc(fn, args || {});
    if(error){ console.warn('[XP]', fn, error.message); return null; }
    return data;
  }catch(e){ console.warn('[XP]', fn, e); return null; }
}

/* ================== ملخص نقاطي ================== */
async function xpRefreshMine(){
  if(!currentUserObj) return XP.mine;
  const d = await xpRpc('my_xp_summary');
  if(d){
    XP.mine = {
      xp: Number(d.xp) || 0, pages: Number(d.pages) || 0, files: Number(d.files) || 0,
      minutes: Number(d.minutes) || 0, videos: Number(d.videos) || 0, quizzes: Number(d.quizzes) || 0
    };
    currentUserObj.xp_points = XP.mine.xp;
  }
  xpRenderMine();
  return XP.mine;
}
window.xpRefreshMine = xpRefreshMine;

const xpRefreshSoon = (() => { let t = null; return () => { clearTimeout(t); t = setTimeout(xpRefreshMine, 1500); }; })();

function xpRenderMine(){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('pXp', XP.mine.xp.toLocaleString('en'));
  set('pXpPages', XP.mine.pages);
  set('pXpFiles', XP.mine.files);
  set('pXpSessions', XP.mine.minutes);
}

function xpFlash(amount, label){
  if(!amount) return;
  let el = document.getElementById('xpFlash');
  if(!el){ el = document.createElement('div'); el.id = 'xpFlash'; el.className = 'xp-flash'; document.body.appendChild(el); }
  el.textContent = `+${amount} XP${label ? ' • ' + label : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

/* ================== 📄 الصفحات ================== */
async function xpLoadFile(fileId){
  XP.loadedFile = fileId;
  if(!xpEligible()) return;
  const arr = await xpRpc('my_awarded_pages', { p_file: fileId });
  if(Array.isArray(arr)) arr.forEach(p => XP.awarded.add(fileId + ':' + p));
}

/* يُستدعى كل ما تغيّرت الصفحة الحالية في القارئ */
function xpTrackPage(){
  clearTimeout(XP.dwellTimer);
  if(!xpEligible() || typeof RS === 'undefined' || !RS.file || !RS.current) return;
  const fileId = RS.file.id, page = RS.current;
  const key = fileId + ':' + page;
  if(XP.awarded.has(key)) return;
  XP.dwellTimer = setTimeout(() => {
    const reader = document.getElementById('reader');
    if(document.hidden || !reader || !reader.classList.contains('open')){ xpTrackPage(); return; }
    if(!RS.file || RS.file.id !== fileId || RS.current !== page) return;
    xpEnqueuePage(fileId, page);
  }, XP_DWELL_MS);
}
window.xpTrackPage = xpTrackPage;

function xpEnqueuePage(fileId, page){
  const key = fileId + ':' + page;
  if(XP.awarded.has(key) || XP.queue.some(q => q.key === key)) return;
  XP.queue.push({ key, fileId, page, tries: 0 });
  xpPumpQueue();
}

async function xpPumpQueue(){
  if(XP.queueBusy) return;
  XP.queueBusy = true;
  try{
    while(XP.queue.length){
      const it = XP.queue.shift();
      const r = await xpRpc('award_page', { p_file: it.fileId, p_page: it.page });
      if(r && r.reason === 'rate' && it.tries < 5){
        it.tries++; XP.queue.unshift(it);
        await new Promise(res => setTimeout(res, 4300));
        continue;
      }
      if(r && (r.reason === 'ok' || r.reason === 'dup')) XP.awarded.add(it.key);
      if(r && r.xp > 0){ XP.mine.xp += r.xp; XP.mine.pages++; xpRenderMine(); }
      await new Promise(res => setTimeout(res, 4100));   /* يتماشى مع حد السيرفر */
    }
  } finally {
    XP.queueBusy = false;
  }
}

/* ================== 📚 إكمال ملف ================== */
async function xpFileComplete(file){
  if(!file || !xpEligible()) return;
  /* ننتظر لين تخلص الصفحات اللي بالطابور */
  for(let i = 0; i < 20 && (XP.queue.length || XP.queueBusy); i++) await new Promise(r => setTimeout(r, 1000));
  const r = await xpRpc('award_file_complete', { p_file: file.id });
  if(!r) return;
  if(r.reason === 'ok'){
    toast(`🎉 أكملت «${file.title}» — +100 XP`, 'ok');
    xpFlash(100, 'إكمال ملف');
    try{ if(typeof beep === 'function') beep(); }catch(e){}
    xpRefreshSoon();
  } else if(r.reason === 'not_enough'){
    toast(`📄 قرأت ${r.have} من ${r.need} صفحة مطلوبة — كمّل قراءة الصفحات (8 ثوانٍ لكل صفحة) لتحصل على 100 XP`, 'warn');
  }
}
window.xpFileComplete = xpFileComplete;

/* ================== ⏱️ جلسات التركيز ================== */
/* رقم الجلسة يُحفظ في التبويب (لو حدّث الصفحة ما تضيع النقاط) */
function xpSaveFocus(){
  try{
    if(XP.focusId) sessionStorage.setItem('abq_focus_id', XP.focusId);
    else sessionStorage.removeItem('abq_focus_id');
  }catch(e){}
}
try{ XP.focusId = sessionStorage.getItem('abq_focus_id') || null; }catch(e){}

async function xpFocusStart(minutes, source){
  if(!xpEligible()) return null;
  const id = await xpRpc('start_focus', { p_minutes: Math.round(minutes || 25), p_source: source || 'timer' });
  XP.focusId = id || null;
  XP.focusSource = source || 'timer';
  xpSaveFocus();
  return id;
}
window.xpFocusStart = xpFocusStart;

async function xpFocusFinish(label){
  if(!xpEligible()) return 0;
  const id = XP.focusId;
  XP.focusId = null;
  xpSaveFocus();
  /* لو رقم الجلسة ضاع → السيرفر ينهي آخر جلسة مفتوحة للطالب (ما تضيع الدقائق) */
  let r = id ? await xpRpc('finish_focus', { p_id: id }) : null;
  if(!r || r.reason === 'no_session') r = await xpRpc('finish_my_focus');
  if(r && r.xp > 0){
    toast(`⏱️ ${r.minutes} دقيقة تركيز — +${r.xp} XP`, 'ok');
    xpFlash(r.xp, label || 'تركيز');
    xpRefreshSoon();
    return r.xp;
  }
  return 0;
}
window.xpFocusFinish = xpFocusFinish;

/* إيقاف/إعادة ضبط المؤقت → تنحسب الدقائق اللي ذاكرها فعلاً (بهدوء) */
function xpFocusAbandon(){
  const id = XP.focusId;
  XP.focusId = null; xpSaveFocus();
  if(id && xpEligible()) xpRpc('finish_focus', { p_id: id }).then(r => { if(r && r.xp > 0){ xpFlash(r.xp, 'تركيز'); xpRefreshSoon(); } });
}
window.xpFocusAbandon = xpFocusAbandon;

/* ================== 🎬 الفيديو ================== */
async function xpVideoStart(videoId){
  XP.videoWatch = null;
  if(!xpEligible() || XP.videoClaimed.has(videoId)) return;
  const id = await xpRpc('start_video', { p_video: videoId });
  if(id) XP.videoWatch = { id, videoId };
}
window.xpVideoStart = xpVideoStart;

async function xpVideoClaim(videoId, duration){
  if(!XP.videoWatch || XP.videoWatch.videoId !== videoId || XP.videoClaimed.has(videoId)) return 0;
  const r = await xpRpc('claim_video', { p_watch: XP.videoWatch.id, p_duration: Math.round(duration || 0) });
  if(!r) return 0;
  if(r.reason === 'ok' || r.reason === 'dup') XP.videoClaimed.add(videoId);
  if(r.xp > 0){
    toast(`🎉 شاهدت الفيديو كاملاً — +${r.xp} XP`, 'ok');
    xpFlash(r.xp, 'فيديو');
    xpRefreshSoon();
  }
  return r.xp || 0;
}
window.xpVideoClaim = xpVideoClaim;

/* ================== 🎮 لعبة العباقرة ================== */
async function xpQuizClaim(sessionId){
  if(!xpEligible()) return null;
  const r = await xpRpc('claim_quiz', { p_session: sessionId });
  if(!r) return null;
  if(r.xp > 0){
    toast(r.won ? `🏆 فزت! ${r.correct} إجابة صحيحة — +${r.xp} XP` : `🎮 ${r.correct} إجابة صحيحة — +${r.xp} XP`, 'ok');
    xpFlash(r.xp, 'لعبة العباقرة');
    xpRefreshSoon();
  } else if(r.reason === 'daily_limit'){
    toast('وصلت الحد اليومي لنقاط اللعبة (5 جلسات) — العب للمتعة 😄', 'warn');
  }
  return r;
}
window.xpQuizClaim = xpQuizClaim;

/* ================== 🗑️ تصفير النقاط (أدمن) ================== */
window.resetAllPoints = () => {
  if(typeof isPrivileged !== 'function' || !isPrivileged()) return;
  openModal({
    title: 'تصفير كل النقاط',
    text: 'سيتم حذف نقاط <b>كل الطلاب</b> نهائياً وتبدأ الصدارة من الصفر. لا يمكن التراجع.<br><br>اكتب كلمة <b>تصفير</b> للتأكيد:',
    bodyHTML: '<input type="text" id="resetConfirmInput" placeholder="تصفير" style="width:100%;font-family:inherit;font-size:.95rem;padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)">',
    okText: 'تصفير الآن',
    danger: true,
    onOk: async () => {
      const v = (document.getElementById('resetConfirmInput') || {}).value || '';
      if(v.trim() !== 'تصفير'){ toast('لم يتم التصفير — اكتب كلمة «تصفير» بالضبط', 'warn'); return; }
      const { data, error } = await sb.rpc('reset_all_points');
      if(error){ toast('فشل: ' + error.message, 'err'); return; }
      if(typeof logAdminAction === 'function') logAdminAction('update_settings', null, 'تصفير كل النقاط', { users: data });
      toast(`✓ تم تصفير نقاط الجميع (${data || 0} طالب كان عنده نقاط)`, 'ok');
      if(typeof renderLeaderboard === 'function') renderLeaderboard();
    }
  });
};

window.resetUserPoints = (userId, name) => {
  if(typeof isPrivileged !== 'function' || !isPrivileged()) return;
  confirmBox('تصفير نقاط طالب', `تصفير كل نقاط «${escapeHtml(name || '')}»؟`, async () => {
    const { error } = await sb.rpc('reset_user_points', { p_user: userId });
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    toast('✓ تم تصفير نقاطه', 'ok');
    if(typeof renderLeaderboard === 'function') renderLeaderboard();
  }, true);
};

/* تحديث ملخصي عند الدخول وكل دقيقتين */
document.addEventListener('DOMContentLoaded', () => {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if(currentUserObj){ clearInterval(t); xpRefreshMine(); }
    else if(tries > 60) clearInterval(t);
  }, 1000);
  XP.refreshTimer = setInterval(() => { if(currentUserObj && !document.hidden) xpRefreshMine(); }, 120000);
});
