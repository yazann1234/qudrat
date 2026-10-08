/* ============================================================
   25) STUDY PLAN — الجدول الذكي للدراسة
   (يدعم: ملفات فقط | ملفات + مهامي)
============================================================ */

const SP = {
  plan: null,
  progress: {},
  expandedDay: null,
  mode: 'files' /* files | files_tasks */
};

/* ================== توليد الخطة ================== */
async function generateStudyPlan(){
  if(!currentUserObj){ toast('سجل الدخول أولاً', 'warn'); return; }

   if(SP.plan && SP.plan.days){
    const validIds = new Set(
      (typeof getUserCourseFiles === 'function' ? getUserCourseFiles() : DB.files)
        .map(f => f.id)
    );
    const hasInvalid = SP.plan.days.some(d =>
      (d.tasks || []).some(t => t.type === 'file' && t.fileId && !validIds.has(t.fileId))
    );
    if(hasInvalid){
      const ok = confirm('خطتك الحالية تحتوي على ملفات من دورة أخرى. هل تريد إنشاء خطة جديدة بناءً على دورتك الحالية؟');
      if(ok){
        SP.plan = null;
        try{ if(currentUserObj) localStorage.removeItem('study_plan_' + currentUserObj.id); }catch(e){}
      } else {
        return;
      }
    }
  }

  const examDateEl = document.getElementById('spExamDate');
  const daysCountEl = document.getElementById('spDaysCount');

  let examDate = examDateEl.value ? new Date(examDateEl.value) : null;
  let totalDays = parseInt(daysCountEl.value, 10);

  /* تحديد عدد الأيام */
  if(examDate){
    const today = new Date();
    today.setHours(0,0,0,0);
    examDate.setHours(0,0,0,0);
    const diff = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    if(diff < 3){ toast('يجب أن يكون الموعد بعد 3 أيام على الأقل', 'warn'); return; }
    totalDays = diff - 2;
  } else if(totalDays){
    if(totalDays < 3 || totalDays > 180){ toast('عدد الأيام بين 3 و 180', 'warn'); return; }
  } else {
    toast('حدد موعد اختبارك أو عدد الأيام', 'warn'); return;
  }

  /* الوضع المختار */
  const modeEl = document.querySelector('input[name="spMode"]:checked');
  SP.mode = modeEl ? modeEl.value : 'files';

  /* الملفات */
    /* ⭐ الملفات — فقط ملفات دورة المستخدم */
  const files = (typeof getUserCourseFiles === 'function')
    ? getUserCourseFiles()
    : (DB.files || []);
  if(!files.length){
    toast('لا توجد ملفات متاحة في دورتك لبناء خطة', 'warn');
    return;
  }

  const remainingFiles = files
    .map(f => ({
      id: f.id,
      title: f.title,
      category: f.category || 'عام',
      pages: f.page_count || 10,
      progress: getPct(f.id),
      maxPage: getMaxPage(f.id)
    }))
    .filter(f => f.progress < 100)
    .sort((a, b) => a.progress - b.progress);

  /* المهام (لو الوضع مختار) */
  let userTasks = [];
  if(SP.mode === 'files_tasks'){
    userTasks = (userData.tasks || []).filter(t => !t.done).map((t, i) => ({
      id: 'task_' + i,
      text: t.text,
      done: false
    }));
  }

  if(!remainingFiles.length && !userTasks.length){
    toast('🎉 لا يوجد شيء متبقٍ للمذاكرة', 'ok');
    return;
  }

  /* إجمالي الصفحات */
  const totalRemainingPages = remainingFiles.reduce((s, f) => s + Math.max(0, f.pages - f.maxPage), 0);
  const dailyPages = Math.max(5, Math.ceil(totalRemainingPages / totalDays));

  /* عدد المهام لكل يوم */
  const tasksPerDay = userTasks.length ? Math.max(1, Math.ceil(userTasks.length / totalDays)) : 0;

  /* ابنِ الأيام */
  const planDays = [];
  let currentFileIndex = 0;
  let currentFilePage = remainingFiles[0] ? remainingFiles[0].maxPage : 0;
  let currentTaskIndex = 0;

  for(let day = 1; day <= totalDays; day++){
    const tasks = [];
    let pagesLeftToday = dailyPages;

    /* المهام أولاً (إن وُجدت) */
    if(SP.mode === 'files_tasks' && tasksPerDay > 0){
      for(let i = 0; i < tasksPerDay && currentTaskIndex < userTasks.length; i++){
        const ut = userTasks[currentTaskIndex];
        tasks.push({
          id: `day${day}_task_${currentTaskIndex}`,
          type: 'user_task',
          fileId: null,
          fileTitle: '📝 مهمة: ' + ut.text,
          fromPage: null,
          toPage: null,
          pages: 0,
          done: false,
          xp: 15
        });
        currentTaskIndex++;
      }
    }

    /* ثم الملفات */
    while(pagesLeftToday > 0 && currentFileIndex < remainingFiles.length){
      const file = remainingFiles[currentFileIndex];
      const pagesAvailable = file.pages - currentFilePage;

      if(pagesAvailable <= 0){
        currentFileIndex++;
        currentFilePage = remainingFiles[currentFileIndex] ? remainingFiles[currentFileIndex].maxPage : 0;
        continue;
      }

      const pagesToRead = Math.min(pagesLeftToday, pagesAvailable);
      const newPage = currentFilePage + pagesToRead;

      tasks.push({
        id: `day${day}_file_${currentFileIndex}_${tasks.length}`,
        type: 'file',
        fileId: file.id,
        fileTitle: file.title,
        fromPage: currentFilePage + 1,
        toPage: newPage,
        pages: pagesToRead,
        done: false,
        xp: pagesToRead * 2
      });

      pagesLeftToday -= pagesToRead;
      currentFilePage = newPage;

      if(currentFilePage >= file.pages){
        currentFileIndex++;
        currentFilePage = remainingFiles[currentFileIndex] ? remainingFiles[currentFileIndex].maxPage : 0;
      }
    }

    if(tasks.length){
      planDays.push({
        day: day,
        tasks: tasks,
        totalPages: tasks.reduce((s, t) => s + (t.pages || 0), 0),
        totalXp: tasks.reduce((s, t) => s + t.xp, 0),
        completed: false
      });
    }
  }

  const planData = {
    examDate: examDate ? examDate.toISOString().split('T')[0] : null,
    totalDays: totalDays,
    dailyPages: dailyPages,
    mode: SP.mode,
    createdAt: new Date().toISOString(),
    days: planDays
  };

  SP.plan = planData;

  /* احفظ في DB */
  try{
    const { data, error } = await sb.from('study_plans').insert({
      user_id: currentUserObj.id,
      exam_date: planData.examDate,
      total_days: totalDays,
      daily_pages: dailyPages,
      plan_data: planDays
    }).select().single();

    if(error) console.warn('plan save error:', error);
    else if(data){ SP.plan.dbId = data.id; }
  }catch(e){ console.warn('plan save failed:', e); }

  savePlanLocally();
  renderStudyPlan();
  updateHomeCountdown();

  toast(`✓ تم إنشاء خطة لمدة ${totalDays} يوم`, 'ok');

  userData.extraXp = (userData.extraXp || 0) + 50;
  savePrefs();
  setTimeout(() => toast('🎁 +50 XP لإنشاء خطتك', 'ok'), 1200);

  if(typeof syncMyXp === 'function') syncMyXp();
}

/* ================== عرض الخطة ================== */
function renderStudyPlan(){
  if(!SP.plan){
    const setup = document.getElementById('spSetup');
    const planEl = document.getElementById('spPlan');
    if(setup) setup.style.display = 'block';
    if(planEl) planEl.style.display = 'none';
    return;
  }

  const setup = document.getElementById('spSetup');
  const planEl = document.getElementById('spPlan');
  if(setup) setup.style.display = 'none';
  if(planEl) planEl.style.display = 'block';

  const meta = document.getElementById('spPlanMeta');
  if(meta){
    const totalPages = SP.plan.days.reduce((s, d) => s + d.totalPages, 0);
    const modeLabel = SP.plan.mode === 'files_tasks' ? 'ملفات + مهام' : 'ملفات فقط';
    meta.innerHTML = `${SP.plan.totalDays} يوم • ${SP.plan.dailyPages} صفحة/يوم • ${totalPages} صفحة • ${modeLabel}`;
  }

  updateCountdown();
  updateHomeCountdown();
  updatePlanProgress();

  const daysEl = document.getElementById('spDays');
  if(!daysEl) return;

  daysEl.innerHTML = SP.plan.days.map(d => {
    const completedTasks = d.tasks.filter(t => t.done).length;
    const isCompleted = completedTasks === d.tasks.length && d.tasks.length > 0;
    const expanded = SP.expandedDay === d.day;

    return `
      <div class="sp-day ${isCompleted ? 'completed' : ''} ${expanded ? 'expanded' : ''}" data-day="${d.day}">
        <div class="sp-day-head" onclick="togglePlanDay(${d.day})">
          <div class="sp-day-num">${isCompleted ? '<i class="fas fa-check"></i>' : d.day}</div>
          <div class="sp-day-info">
            <h4>اليوم ${d.day}</h4>
            <p>${d.totalPages} صفحة • ${completedTasks}/${d.tasks.length} مهمة</p>
          </div>
          <div class="sp-day-xp"><i class="fas fa-star"></i> ${d.totalXp} XP</div>
        </div>
        <div class="sp-day-tasks">
          ${d.tasks.map(t => `
            <div class="sp-task ${t.done ? 'done' : ''}" onclick="togglePlanTask(${d.day},'${t.id}')">
              <div class="sp-task-check">${t.done ? '<i class="fas fa-check"></i>' : ''}</div>
              <div class="sp-task-txt">
                ${t.type === 'user_task'
                  ? escapeHtml(t.fileTitle)
                  : `${escapeHtml(t.fileTitle)} — من ص ${t.fromPage} إلى ${t.toPage}`}
              </div>
              <div class="sp-task-xp">+${t.xp}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/* ================== تفاعلات ================== */
window.togglePlanDay = (day) => {
  SP.expandedDay = SP.expandedDay === day ? null : day;
  renderStudyPlan();
};

window.togglePlanTask = async (day, taskId) => {
  const dayData = SP.plan.days.find(d => d.day === day);
  if(!dayData) return;
  const task = dayData.tasks.find(t => t.id === taskId);
  if(!task) return;

  task.done = !task.done;

  if(task.done){
    userData.extraXp = (userData.extraXp || 0) + task.xp;
    savePrefs();
    toast(`+${task.xp} XP ✓`, 'ok');
  } else {
    userData.extraXp = Math.max(0, (userData.extraXp || 0) - task.xp);
    savePrefs();
  }

  dayData.completed = dayData.tasks.every(t => t.done);
  if(dayData.completed && dayData.tasks.length > 0){
    userData.extraXp += 20;
    savePrefs();
    toast('🎉 أكملت مهام اليوم! +20 XP', 'ok');
  }

  savePlanLocally();
  renderStudyPlan();

  try{
    if(SP.plan.dbId){
      await sb.from('study_plan_progress').upsert({
        user_id: currentUserObj.id,
        plan_id: SP.plan.dbId,
        day_number: day,
        tasks_completed: dayData.tasks,
        completed: dayData.completed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,plan_id,day_number' });
    }
  }catch(e){}

  if(typeof syncMyXp === 'function') syncMyXp();
};

/* ================== Countdown ================== */
function updateCountdown(){
  const numEl = document.getElementById('spCountdownNum');
  if(!numEl || !SP.plan || !SP.plan.examDate) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const exam = new Date(SP.plan.examDate);
  exam.setHours(0,0,0,0);
  const diff = Math.ceil((exam - today) / (1000 * 60 * 60 * 24));

  if(diff > 0){
    numEl.textContent = diff;
    numEl.style.color = diff <= 7 ? 'var(--danger)' : 'var(--primary)';
  } else if(diff === 0){
    numEl.textContent = 'اليوم';
    numEl.style.color = 'var(--danger)';
  } else {
    numEl.textContent = 'انتهى';
    numEl.style.color = 'var(--muted)';
  }
}

/* ================== Progress ================== */
function updatePlanProgress(){
  if(!SP.plan) return;
  const totalTasks = SP.plan.days.reduce((s, d) => s + d.tasks.length, 0);
  const completedTasks = SP.plan.days.reduce((s, d) => s + d.tasks.filter(t => t.done).length, 0);
  const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const fill = document.getElementById('spProgressFill');
  const label = document.getElementById('spProgressLabel');
  if(fill) fill.style.width = pct + '%';
  if(label) label.textContent = pct + '%';
}

/* ================== العد التنازلي في الرئيسية ================== */
function updateHomeCountdown(){
  const card = document.getElementById('examCountdownCard');
  if(!card) return;

  if(!SP.plan || !SP.plan.examDate){
    card.style.display = 'none';
    return;
  }

  const examDate = new Date(SP.plan.examDate);
  examDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = examDate - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if(diffDays < 0){
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  const dateLabel = document.getElementById('examDateLabel');
  if(dateLabel){
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateLabel.textContent = examDate.toLocaleDateString('ar-SA', options);
  }

  const numsEl = document.getElementById('examCountdownNums');
  if(numsEl){
    const now = new Date();
    let hours = 0, minutes = 0;
    if(diffDays === 0){
      const nowMs = now.getTime();
      const examMs = examDate.getTime();
      const diffMs2 = Math.max(0, examMs - nowMs);
      hours = Math.floor(diffMs2 / (1000 * 60 * 60));
      minutes = Math.floor((diffMs2 % (1000 * 60 * 60)) / (1000 * 60));
    }

    if(diffDays <= 1){
      numsEl.innerHTML = `
        <div class="exam-countdown-num-box ${diffDays === 0 ? 'urgent' : ''}">
          <b>${hours}</b><small>ساعة</small>
        </div>
        <div class="exam-countdown-num-box ${diffDays === 0 ? 'urgent' : ''}">
          <b>${minutes}</b><small>دقيقة</small>
        </div>
      `;
    } else {
      const urgent = diffDays <= 7 ? 'urgent' : '';
      numsEl.innerHTML = `
        <div class="exam-countdown-num-box ${urgent}">
          <b>${diffDays}</b><small>يوم</small>
        </div>
      `;
    }
  }

  const fill = document.getElementById('examProgressFill');
  const label = document.getElementById('examProgressLabel');
  if(fill && label){
    const totalTasks = SP.plan.days.reduce((s, d) => s + d.tasks.length, 0);
    const completedTasks = SP.plan.days.reduce((s, d) => s + d.tasks.filter(t => t.done).length, 0);
    const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    fill.style.width = pct + '%';
    label.textContent = pct + '% مكتمل';
  }
}
window.updateHomeCountdown = updateHomeCountdown;

/* ================== حفظ محلي ================== */
function savePlanLocally(){
  try{
    if(currentUserObj && SP.plan){
      localStorage.setItem('study_plan_' + currentUserObj.id, JSON.stringify(SP.plan));
    }
  }catch(e){}
}

function loadPlanLocally(){
  try{
    if(!currentUserObj) return;
    const raw = localStorage.getItem('study_plan_' + currentUserObj.id);
    if(raw){
      SP.plan = JSON.parse(raw);
      renderStudyPlan();
      updateHomeCountdown();
    }
  }catch(e){}
}

/* ================== Reset ================== */
function resetStudyPlan(){
  if(!confirm('هل تريد إنشاء خطة جديدة؟ سيتم فقدان التقدم الحالي.')) return;

  SP.plan = null;
  SP.expandedDay = null;

  try{
    if(currentUserObj) localStorage.removeItem('study_plan_' + currentUserObj.id);
  }catch(e){}

  renderStudyPlan();

  const examEl = document.getElementById('spExamDate');
  const daysEl = document.getElementById('spDaysCount');
  if(examEl) examEl.value = '';
  if(daysEl) daysEl.value = '';

  updateHomeCountdown();
  toast('يمكنك إنشاء خطة جديدة الآن', 'ok');
}

/* ================== الأحداث ================== */
document.addEventListener('DOMContentLoaded', () => {
  const genBtn = document.getElementById('spGenerateBtn');
  if(genBtn && !genBtn.dataset.bound){
    genBtn.dataset.bound = '1';
    genBtn.addEventListener('click', generateStudyPlan);
  }

  const resetBtn = document.getElementById('spResetBtn');
  if(resetBtn && !resetBtn.dataset.bound){
    resetBtn.dataset.bound = '1';
    resetBtn.addEventListener('click', resetStudyPlan);
  }

  document.querySelectorAll('input[name="spMode"]').forEach(radio => {
    radio.addEventListener('change', e => { SP.mode = e.target.value; });
  });

  setInterval(updateCountdown, 60000);
  setInterval(updateHomeCountdown, 60000);
});

window.generateStudyPlan = generateStudyPlan;
window.renderStudyPlan = renderStudyPlan;
window.loadPlanLocally = loadPlanLocally;
window.updateHomeCountdown = updateHomeCountdown;
