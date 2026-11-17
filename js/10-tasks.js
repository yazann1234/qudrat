/* ============================================================
   10) TASKS & NOTES — المهام والملاحظات
============================================================ */

function renderTasks(){
  const box = $('#taskList'); if(!box) return;
  if(!userData.tasks.length){ box.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:.84rem">لا توجد مهام بعد</div>`; return; }
  box.innerHTML = userData.tasks.map((t, i) => `
    <div class="task-item ${t.done ? 'done' : ''}">
      <div class="t-check" onclick="toggleTask(${i})">${t.done ? '<i class="fas fa-check"></i>' : ''}</div>
      <span class="t-txt">${escapeHtml(t.text)}</span>
      <button class="t-del" onclick="delTask(${i})"><i class="fas fa-trash"></i></button>
    </div>`).join('');
}
window.toggleTask = i => { if(userData.tasks[i]){ userData.tasks[i].done = !userData.tasks[i].done; savePrefs(); renderTasks(); } };
window.delTask = i => { userData.tasks.splice(i, 1); savePrefs(); renderTasks(); };

function addTask(){
  const inp = $('#taskInput'); if(!inp) return;
  const v = inp.value.trim(); if(!v) return;
  userData.tasks.unshift({ text: v, done:false });
  inp.value = ''; savePrefs(); renderTasks();
}
$('#taskAdd').addEventListener('click', addTask);
$('#taskInput').addEventListener('keydown', e => { if(e.key === 'Enter') addTask(); });

const notesArea = $('#notesArea');
let notesTimer = null;
notesArea.addEventListener('input', () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => { userData.notes = notesArea.value; savePrefs(); }, 400);
});
$('#notesExport').addEventListener('click', () => {
  if(!userData.notes.trim()){ toast('لا توجد ملاحظات للتصدير', 'warn'); return; }
  const blob = new Blob([userData.notes], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ملاحظاتي-العباقرة.txt'; a.click();
  URL.revokeObjectURL(a.href);
  toast('تم تصدير الملاحظات', 'ok');
});
