/* ============================================================
   41) AI INDEX — فهرسة الملفات للبحث الذكي عن الأسئلة (للأدمن)
   - كل صفحة تتحول لصورة ويقرأها الذكاء الاصطناعي بدقة (OCR)
     → نص الصفحة + أسئلتها بأرقامها → تُحفظ في جدول file_pages
   - قابلة للاستكمال: الصفحات المفهرسة لا تُعاد (إلا بإعادة فهرسة)
   - الملفات الجديدة تُفهرس تلقائياً بعد الرفع
============================================================ */

const AIX = {
  queue: [],
  running: false,
  paused: false,
  current: null,     /* { fileId, title, done, total } */
  stats: {},         /* fileId → pages indexed */
  log: []
};

function aixLog(msg, kind){
  AIX.log.unshift({ t: new Date(), msg, kind: kind || '' });
  AIX.log = AIX.log.slice(0, 40);
  aixRenderLog();
}

async function aixLoadStats(){
  try{
    const { data, error } = await sb.rpc('file_index_stats');
    if(error) throw error;
    AIX.stats = {};
    (data || []).forEach(r => { AIX.stats[r.file_id] = r.pages; });
  }catch(e){
    aixLog('تعذّر قراءة حالة الفهرسة — تأكد من تشغيل supabase-update-5.sql', 'err');
  }
}

/* ================== الواجهة ================== */
async function renderAiIndexPanel(){
  const box = document.getElementById('aiIndexList');
  if(!box || !isPrivileged()) return;
  await aixLoadStats();
  const files = (DB.files || []).slice().sort((a, b) => String(a.title).localeCompare(String(b.title), 'ar'));
  const totalPages = files.reduce((s, f) => s + (f.page_count || 0), 0);
  const donePages = files.reduce((s, f) => s + Math.min(AIX.stats[f.id] || 0, f.page_count || AIX.stats[f.id] || 0), 0);
  const sum = document.getElementById('aiIndexSummary');
  if(sum){
    const pct = totalPages ? Math.round(donePages / totalPages * 100) : 0;
    sum.innerHTML = `
      <div class="aix-sum-num"><b>${pct}%</b><small>نسبة الفهرسة</small></div>
      <div class="aix-sum-num"><b>${donePages}</b><small>صفحة مفهرسة</small></div>
      <div class="aix-sum-num"><b>${totalPages}</b><small>إجمالي الصفحات</small></div>
      <div class="aix-sum-bar"><i style="width:${pct}%"></i></div>`;
  }
  if(!files.length){ box.innerHTML = '<div class="admin-empty"><h3>لا توجد ملفات</h3></div>'; return; }
  box.innerHTML = files.map(f => {
    const done = AIX.stats[f.id] || 0;
    const total = f.page_count || 0;
    const full = total && done >= total;
    const isCur = AIX.current && AIX.current.fileId === f.id;
    const queued = AIX.queue.some(q => q.fileId === f.id);
    const course = f.course_id && typeof getCourseById === 'function' ? getCourseById(f.course_id) : null;
    return `
      <div class="aix-row ${full ? 'full' : ''} ${isCur ? 'cur' : ''}">
        <i class="fas ${full ? 'fa-circle-check' : isCur ? 'fa-spinner fa-spin' : 'fa-file-pdf'} aix-ic"></i>
        <div class="aix-info">
          <b>${escapeHtml(f.title)}</b>
          <small>${course ? escapeHtml(course.name) : 'للجميع'} • ${done}/${total || '?'} صفحة ${queued ? '• في الانتظار' : ''}</small>
          <div class="aix-bar"><i style="width:${total ? Math.min(100, done / total * 100) : 0}%"></i></div>
        </div>
        <div class="aix-acts">
          ${!full ? `<button class="btn btn-primary btn-sm" onclick="queueIndexFile('${f.id}')" ${isCur || queued ? 'disabled' : ''}><i class="fas fa-magnifying-glass-plus"></i> ${done ? 'استكمال' : 'فهرسة'}</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="reindexFile('${f.id}')" title="إعادة فهرسة كاملة" ${isCur ? 'disabled' : ''}><i class="fas fa-rotate"></i></button>
        </div>
      </div>`;
  }).join('');
  aixRenderControls();
}
window.renderAiIndexPanel = renderAiIndexPanel;

function aixRenderControls(){
  const c = document.getElementById('aiIndexControls');
  if(!c) return;
  const cur = AIX.current;
  c.innerHTML = `
    <button class="btn btn-primary" onclick="indexAllFiles()" ${AIX.running ? 'disabled' : ''}><i class="fas fa-wand-magic-sparkles"></i> فهرسة كل الملفات غير المكتملة</button>
    ${AIX.running ? `<button class="btn btn-ghost" onclick="toggleIndexPause()"><i class="fas ${AIX.paused ? 'fa-play' : 'fa-pause'}"></i> ${AIX.paused ? 'استئناف' : 'إيقاف مؤقت'}</button>` : ''}
    ${cur ? `<span class="aix-now"><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(cur.title)} — صفحة ${cur.done}/${cur.total}</span>` : ''}`;
}

function aixRenderLog(){
  const l = document.getElementById('aiIndexLog');
  if(!l) return;
  l.innerHTML = AIX.log.map(x => `<div class="aix-log ${x.kind}"><small>${x.t.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small> ${escapeHtml(x.msg)}</div>`).join('');
}

/* ================== الطابور ================== */
window.queueIndexFile = (fileId, force) => {
  if(!isPrivileged()) return;
  const f = (DB.files || []).find(x => x.id === fileId);
  if(!f) return;
  if(AIX.queue.some(q => q.fileId === fileId) || (AIX.current && AIX.current.fileId === fileId)) return;
  AIX.queue.push({ fileId, force: !!force });
  aixLog('أُضيف للطابور: ' + f.title);
  aixRun();
  renderAiIndexPanel();
};

window.reindexFile = (fileId) => {
  const f = (DB.files || []).find(x => x.id === fileId);
  confirmBox('إعادة الفهرسة', `إعادة قراءة كل صفحات «${escapeHtml(f ? f.title : '')}» من جديد؟`, () => queueIndexFile(fileId, true));
};

window.indexAllFiles = async () => {
  await aixLoadStats();
  const list = (DB.files || []).filter(f => !(f.page_count && (AIX.stats[f.id] || 0) >= f.page_count));
  if(!list.length){ toast('✓ كل الملفات مفهرسة', 'ok'); return; }
  list.forEach(f => { if(!AIX.queue.some(q => q.fileId === f.id)) AIX.queue.push({ fileId: f.id, force: false }); });
  aixLog(`بدء فهرسة ${list.length} ملف`);
  aixRun();
  renderAiIndexPanel();
};

window.toggleIndexPause = () => {
  AIX.paused = !AIX.paused;
  aixLog(AIX.paused ? 'تم الإيقاف المؤقت' : 'تم الاستئناف');
  aixRenderControls();
};

async function aixRun(){
  if(AIX.running) return;
  AIX.running = true;
  aixRenderControls();
  try{
    while(AIX.queue.length){
      const job = AIX.queue.shift();
      try{ await aixIndexFile(job.fileId, job.force); }
      catch(e){ aixLog('فشل: ' + (e.message || e), 'err'); }
    }
  } finally {
    AIX.running = false; AIX.current = null; AIX.paused = false;
    aixRenderControls();
    renderAiIndexPanel();
    aixLog('انتهت الفهرسة ✓', 'ok');
  }
}

const aixSleep = ms => new Promise(r => setTimeout(r, ms));

async function aixToken(){
  const r = await sb.auth.getSession();
  return r && r.data && r.data.session ? r.data.session.access_token : '';
}

/* صورة الصفحة بدقة كافية للقراءة (عرض ~1400px) */
async function aixRenderPage(doc, num){
  const page = await doc.getPage(num);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, 1400 / (vp1.width || 600));
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  let text = '';
  try{
    const tc = await page.getTextContent();
    text = tc.items.map(i => i.str).join(' ');
  }catch(e){}
  try{ page.cleanup(); }catch(e){}
  const data = c.toDataURL('image/jpeg', 0.82);
  c.width = c.height = 1;
  return { data, text };
}

async function aixOcr(fileTitle, page, image){
  const token = await aixToken();
  for(let attempt = 0; attempt < 4; attempt++){
    while(AIX.paused) await aixSleep(800);
    const res = await fetch(getAIUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey': (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '')
      },
      body: JSON.stringify({ mode: 'index_page', image, mime: 'image/jpeg', fileTitle, page })
    });
    if(res.ok) return await res.json();
    let msg = 'HTTP ' + res.status;
    try{ const j = await res.json(); msg = j.error || msg; }catch(e){}
    if(res.status === 403) throw new Error(msg);
    /* ازدحام/حد الاستخدام → انتظر وأعد */
    aixLog(`صفحة ${page}: ${msg} — إعادة المحاولة...`, 'warn');
    await aixSleep(res.status === 429 || /حد الاستخدام/.test(msg) ? 25000 : 4000 * (attempt + 1));
  }
  throw new Error('تعذّرت قراءة الصفحة ' + page);
}

async function aixIndexFile(fileId, force){
  const f = (DB.files || []).find(x => x.id === fileId);
  if(!f) return;

  /* الصفحات المفهرسة سابقاً */
  let done = new Set();
  if(force){
    await sb.from('file_pages').delete().eq('file_id', fileId);
  } else {
    const { data } = await sb.from('file_pages').select('page').eq('file_id', fileId);
    done = new Set((data || []).map(r => r.page));
  }

  const { data: signed, error: sErr } = await sb.storage.from('pdfs').createSignedUrl(f.storage_path, 3600);
  if(sErr || !signed) throw new Error('تعذّر فتح الملف: ' + (sErr ? sErr.message : ''));
  const doc = await pdfjsLib.getDocument({
    url: signed.signedUrl,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true
  }).promise;

  const total = doc.numPages;
  if(f.page_count !== total){
    f.page_count = total;
    try{ await sb.from('files').update({ page_count: total }).eq('id', fileId); }catch(e){}
  }
  AIX.current = { fileId, title: f.title, done: done.size, total };
  aixLog(`بدء: ${f.title} (${total} صفحة، مفهرس ${done.size})`);
  renderAiIndexPanel();

  let okCount = 0;
  for(let p = 1; p <= total; p++){
    if(done.has(p)) continue;
    while(AIX.paused) await aixSleep(800);

    let content = '', questions = [], method = 'ocr';
    try{
      const { data, text } = await aixRenderPage(doc, p);
      try{
        const r = await aixOcr(f.title, p, data);
        content = r.text || ''; questions = r.questions || [];
      }catch(e){
        /* احتياط: نص PDF المباشر لو فشلت القراءة بالصورة */
        if(text && text.trim().length > 30){ content = text; method = 'text'; aixLog(`صفحة ${p}: استُخدم نص PDF المباشر`, 'warn'); }
        else throw e;
      }
      const { error } = await sb.from('file_pages').upsert({ file_id: fileId, page: p, content, questions, method }, { onConflict: 'file_id,page' });
      if(error) throw error;
      okCount++;
      AIX.current.done = done.size + okCount;
      AIX.stats[fileId] = AIX.current.done;
      aixRenderControls();
      if(okCount % 3 === 0) renderAiIndexPanel();
    }catch(e){
      aixLog(`صفحة ${p} من «${f.title}»: ${e.message || e}`, 'err');
    }
    await aixSleep(700);   /* تهدئة حتى لا نتجاوز حد Gemini */
  }
  try{ doc.destroy(); }catch(e){}
  aixLog(`✓ اكتمل: ${f.title} (${okCount} صفحة جديدة)`, 'ok');
}

/* فتح التبويب → تحميل الحالة */
document.addEventListener('click', e => {
  const tab = e.target.closest('.admin-tabs button[data-panel="aiindex"]');
  if(tab) setTimeout(renderAiIndexPanel, 50);
});
