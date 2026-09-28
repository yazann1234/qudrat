/* ============================================================
   11) TIMER — مؤقت بومودورو
============================================================ */

const TIMER = { running:false, mode:'focus', endAt:0, remain:0, int:null, doneCount:0 };

function timerTotalSec(mode){
  if(mode === 'focus') return (userData.focus || 25) * 60;
  if(mode === 'long') return (userData.longBrk || 15) * 60;
  return (userData.brk || 5) * 60;
}

function drawTimerDial(){
  const holder = $('#timerDial'); if(!holder) return;
  const total = timerTotalSec(TIMER.mode);
  const remain = TIMER.running ? Math.max(0, Math.round((TIMER.endAt - Date.now()) / 1000)) : TIMER.remain;
  const pct = total ? ((total - remain) / total) * 100 : 0;
  const old = holder.querySelector('svg'); if(old) old.remove();
  const colA = TIMER.mode === 'focus' ? 'var(--primary)' : '#22c55e';
  const colB = TIMER.mode === 'focus' ? 'var(--primary-2)' : '#4ade80';
  holder.insertAdjacentHTML('afterbegin', ringSVG(pct, 150, 12, colA, colB));
}

function updateTimerUI(){
  const total = timerTotalSec(TIMER.mode);
  const remain = TIMER.running ? Math.max(0, Math.round((TIMER.endAt - Date.now()) / 1000)) : TIMER.remain;
  const tt = $('#timerText'); if(tt) tt.textContent = fmtTime(remain);
  const tl = $('#timerLabel'); if(tl) tl.textContent = TIMER.mode === 'focus' ? 'جلسة تركيز' : (TIMER.mode === 'long' ? 'راحة طويلة' : 'راحة قصيرة');
  const th = $('#timerHead'); if(th) th.textContent = TIMER.mode === 'focus' ? 'اعمل بتركيز كامل' : 'وقت الراحة — استرخِ قليلاً';
  const td = $('#timerDesc');
  if(td) td.textContent = TIMER.mode === 'focus' ? 'اعمل بتركيز كامل، ثم خذ راحة قصيرة.' : 'خذ نفساً عميقاً، تحرّك قليلاً، واشرب ماءً.';
  const ts = $('#timerStart');
  if(ts) ts.innerHTML = TIMER.running ? '<i class="fas fa-pause"></i> إيقاف مؤقت' : '<i class="fas fa-play"></i> ' + (TIMER.remain < total ? 'استئناف' : 'ابدأ الجلسة');
  const tm = $('#timerMode');
  if(tm) tm.innerHTML = TIMER.mode === 'focus' ? `<i class="fas fa-mug-hot"></i> راحة ${userData.brk || 5}د` : `<i class="fas fa-bullseye"></i> تركيز ${userData.focus || 25}د`;
  drawTimerDial();
}

function startTimer(){
  if(TIMER.running){
    TIMER.remain = Math.max(0, Math.round((TIMER.endAt - Date.now()) / 1000));
    clearInterval(TIMER.int); TIMER.int = null;
    TIMER.running = false;
    updateTimerUI(); return;
  }
  if(TIMER.remain <= 0) TIMER.remain = timerTotalSec(TIMER.mode);
  TIMER.endAt = Date.now() + TIMER.remain * 1000;
  TIMER.running = true;
  clearInterval(TIMER.int);
  TIMER.int = setInterval(timerTick, 250);
  updateTimerUI();
}

function timerTick(){
  if(!TIMER.running) return;
  const remain = Math.max(0, Math.round((TIMER.endAt - Date.now()) / 1000));
  TIMER.remain = remain;
  updateTimerUI();
  if(remain <= 0) finishTimer();
}

function finishTimer(){
  clearInterval(TIMER.int); TIMER.int = null;
  TIMER.running = false;
  beep();
  if(TIMER.mode === 'focus'){
    TIMER.doneCount++;
    userData.sessions++;
    addMinutesToday(userData.focus || 25);
    todayLog().sessions = (todayLog().sessions || 0) + 1;
    if(!userData.badges.includes('focus1')) userData.badges.push('focus1');
    savePrefs();
    renderHomeStats(); renderBadges(); checkBadges();
    toast('أحسنت! أكملت جلسة تركيز كاملة', 'ok');
    const useLong = TIMER.doneCount % 4 === 0;
    TIMER.mode = useLong ? 'long' : 'break';
    try{ if(typeof syncMyXp === 'function') syncMyXp(); }catch(e){}
  } else {
    toast('انتهت الراحة، لنعد للتركيز!', 'warn');
    TIMER.mode = 'focus';
  }
  TIMER.remain = timerTotalSec(TIMER.mode);
  updateTimerUI();
  if(userData.autoStart){ setTimeout(() => { if(!TIMER.running) startTimer(); }, 900); }
}

$('#timerStart').addEventListener('click', startTimer);
$('#timerReset').addEventListener('click', () => {
  clearInterval(TIMER.int); TIMER.int = null;
  TIMER.running = false;
  TIMER.remain = timerTotalSec(TIMER.mode);
  updateTimerUI();
});
$('#timerMode').addEventListener('click', () => {
  clearInterval(TIMER.int); TIMER.int = null;
  TIMER.running = false;
  TIMER.mode = TIMER.mode === 'focus' ? 'break' : 'focus';
  TIMER.remain = timerTotalSec(TIMER.mode);
  updateTimerUI();
});
