/* ============================================================
   12) SETTINGS — الإعدادات + تصدير/استيراد
============================================================ */

const segHandler = (sel, cb) => {
  const box = document.querySelector(sel); if(!box) return;
  box.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); cb(b);
    });
  });
};

segHandler('#modeSeg', b => { userData.darkMode = b.dataset.m; savePrefs(); applyTheme(); });
segHandler('#fontSeg', b => { userData.font = parseFloat(b.dataset.f); savePrefs(); applyTheme(); });
segHandler('#readThemeSeg', b => { userData.readTheme = b.dataset.r; savePrefs(); applyReaderTheme(); });
segHandler('#snapSeg', b => { userData.snap = b.dataset.s === '1'; savePrefs(); applySnapClass(); });
segHandler('#zoomSeg', b => { userData.defaultZoom = parseFloat(b.dataset.z); savePrefs(); });
segHandler('#focusSeg', b => { userData.focus = parseInt(b.dataset.m, 10); savePrefs(); if(!TIMER.running && TIMER.mode === 'focus'){ TIMER.remain = timerTotalSec('focus'); } updateTimerUI(); });
segHandler('#breakSeg', b => { userData.brk = parseInt(b.dataset.m, 10); savePrefs(); if(!TIMER.running && TIMER.mode === 'break'){ TIMER.remain = timerTotalSec('break'); } updateTimerUI(); });
segHandler('#longSeg', b => { userData.longBrk = parseInt(b.dataset.m, 10); savePrefs(); if(!TIMER.running && TIMER.mode === 'long'){ TIMER.remain = timerTotalSec('long'); } updateTimerUI(); });

$('#setAnim').addEventListener('change', e => { userData.reduceMotion = e.target.checked; savePrefs(); applyTheme(); });
$('#setMarks').addEventListener('change', e => { userData.showMarks = e.target.checked; savePrefs(); applyMarksVisibility(); });
$('#setResume').addEventListener('change', e => { userData.autoResume = e.target.checked; savePrefs(); });
$('#setAuto').addEventListener('change', e => { userData.autoStart = e.target.checked; savePrefs(); });
$('#setSound').addEventListener('change', e => { userData.sound = e.target.checked; savePrefs(); });

$('#goalPagesRange').addEventListener('input', e => {
  userData.goalPages = parseInt(e.target.value, 10) || 10;
  $('#goalPagesVal').textContent = userData.goalPages;
  $('#goalTarget').textContent = userData.goalPages;
  savePrefs(); renderHomeStats(); checkBadges();
});
$('#goalMinRange').addEventListener('input', e => {
  userData.goalMinutes = parseInt(e.target.value, 10) || 30;
  $('#goalMinVal').textContent = userData.goalMinutes;
  savePrefs();
});

$$('.filter-chip').forEach(b => {
  b.addEventListener('click', () => {
    $$('.filter-chip').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); fileFilter = b.dataset.cat; renderFiles();
  });
});
$('#sortSelect').addEventListener('change', e => { fileSort = e.target.value; renderFiles(); });
$('#searchInput').addEventListener('input', () => { go('files'); renderFiles(); });

$('#exportBtn').addEventListener('click', () => {
  const data = Object.assign({}, userData, { exportedAt: new Date().toISOString(), user: currentUserObj ? currentUserObj.name : '' });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'abdqaqra-backup.json'; a.click();
  URL.revokeObjectURL(a.href);
  toast('تم تصدير نسختك الاحتياطية', 'ok');
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const d = JSON.parse(ev.target.result);
      Object.keys(d).forEach(k => { if(k !== 'exportedAt' && k !== 'user') userData[k] = d[k]; });
      if(!userData.log || typeof userData.log !== 'object') userData.log = {};
      if(!userData.drawings || typeof userData.drawings !== 'object') userData.drawings = {};
      savePrefs();
      notesArea.value = userData.notes || '';
      refreshAll(); renderTasks(); renderBadges(); renderProgress(); applyTheme(); applyReaderTheme(); applySnapClass();
      toast('تم استيراد البيانات بنجاح', 'ok');
    }catch(err){ toast('الملف غير صالح', 'warn'); }
  };
  reader.readAsText(file); e.target.value = '';
});
$('#resetProgressBtn').addEventListener('click', () => {
  confirmBox('تصفير التقدم', 'سيتم مسح كل نسب الإنجاز والشارات والدقائق. هل أنت متأكد؟', async () => {
    userData.progress = {}; userData.badges = []; userData.opened = [];
    userData.minutes = 0; userData.sessions = 0; userData.log = {};
    savePrefs();
    if(currentUserObj && currentUserObj.role !== 'admin'){
      try{ await sb.from('user_progress').delete().eq('user_id', currentUserObj.id); }catch(e){}
    }
    refreshAll(); renderBadges(); renderProgress();
    toast('تم تصفير التقدم', 'ok');
  }, true);
});
$('#changePassBtn').addEventListener('click', () => {
  openModal({
    title:'تغيير كلمة المرور', text:'أدخل كلمة المرور الجديدة.',
    bodyHTML:`<div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="mpNew" placeholder="6 أحرف على الأقل" style="width:100%;font-family:inherit;font-size:.88rem;padding:12px 15px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none"></div>`,
    okText:'حفظ',
    onOk: async () => {
      const n1 = document.getElementById('mpNew').value;
      if(!n1 || n1.length < 6){ toast('كلمة المرور قصيرة', 'err'); return; }
      const { error } = await sb.auth.updateUser({ password: n1 });
      if(error){ toast('فشل: ' + error.message, 'err'); return; }
      toast('تم تغيير كلمة المرور', 'ok');
    }
  });
});
