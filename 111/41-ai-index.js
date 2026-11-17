/* ============================================================
   41) AI INDEX v2 — فهرسة سريعة جداً للبحث الذكي (للأدمن)
   ⚡ الوضع السريع (الافتراضي) — بدون أي حدود:
      - نص PDF المضمّن يُقرأ مباشرة (لحظي)
      - الصفحات المصوّرة تُقرأ داخل المتصفح نفسه (Tesseract OCR عربي)
        → لا يستهلك Gemini أبداً، ولا يوجد حد يومي
   🎯 وضع Gemini: الذكاء الاصطناعي يقرأ كل الصفحات (أدق للمعادلات)
      - بإيقاع منضبط يحترم حدود الحساب المجاني (لا رسائل «تجاوزنا الحد»)
   - حفظ دفعات + استكمال من حيث توقف
============================================================ */

const AIX = {
  queue: [],
  running: false,
  paused: false,
  current: null,     /* { fileId, title, done, total } */
  stats: {},         /* fileId → pages indexed */
  log: [],
  conc: 1,           /* طلبات Gemini المتوازية (حساب مجاني = 1-2) */
  maxConc: 2,
  batch: 2,          /* صفحات في كل طلب Gemini */
  gapMs: 4500,       /* أقل فاصل بين طلبات Gemini (~13 طلب/دقيقة) */
  lastReq: 0,
  startedAt: 0,
  pagesDone: 0       /* صفحات هذه الجلسة (لحساب السرعة) */
};

function aixMode(){
  try{ return localStorage.getItem('aix_mode') || 'fast'; }catch(e){ return 'fast'; }
}
window.setIndexMode = (m) => {
  try{ localStorage.setItem('aix_mode', m); }catch(e){}
  aixRenderControls();
  toast(m === 'fast' ? '⚡ الوضع السريع: القراءة داخل المتصفح — بدون حدود' : '🎯 وضع Gemini: أدق للمعادلات لكن أبطأ وله حد استخدام', 'ok');
};

function aixLog(msg, kind){
  AIX.log.unshift({ t: new Date(), msg, kind: kind || '' });
  AIX.log = AIX.log.slice(0, 50);
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
  if(!AIX.running) await aixLoadStats();
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

function aixSpeed(){
  const mins = (Date.now() - AIX.startedAt) / 60000;
  return mins > 0.05 ? AIX.pagesDone / mins : 0;
}

function aixRenderControls(){
  const c = document.getElementById('aiIndexControls');
  if(!c) return;
  const cur = AIX.current;
  const mode = aixMode();
  const speed = aixSpeed();
  const remainAll = Object.keys(AIX.stats).length || cur
    ? (DB.files || []).reduce((s, f) => s + Math.max(0, (f.page_count || 0) - (AIX.stats[f.id] || 0)), 0) : 0;
  const eta = speed > 0 ? Math.ceil(remainAll / speed) : 0;
  c.innerHTML = `
    <div class="aix-mode">
      <button class="${mode === 'fast' ? 'on' : ''}" onclick="setIndexMode('fast')" ${AIX.running ? 'disabled' : ''} title="قراءة داخل المتصفح — بدون حدود ولا تكلفة"><i class="fas fa-bolt"></i> سريع (بدون حدود)</button>
      <button class="${mode === 'precise' ? 'on' : ''}" onclick="setIndexMode('precise')" ${AIX.running ? 'disabled' : ''} title="Gemini يقرأ كل صفحة — أدق للمعادلات لكن له حد استخدام"><i class="fas fa-bullseye"></i> Gemini (أدق، أبطأ)</button>
    </div>
    <button class="btn btn-primary" onclick="indexAllFiles()" ${AIX.running ? 'disabled' : ''}><i class="fas fa-wand-magic-sparkles"></i> فهرسة كل الملفات غير المكتملة</button>
    ${AIX.running ? `<button class="btn btn-ghost" onclick="toggleIndexPause()"><i class="fas ${AIX.paused ? 'fa-play' : 'fa-pause'}"></i> ${AIX.paused ? 'استئناف' : 'إيقاف مؤقت'}</button>` : ''}
    ${cur ? `<span class="aix-now"><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(cur.title)} — ${cur.done}/${cur.total}</span>` : ''}
    ${AIX.running && speed ? `<span class="aix-speed"><i class="fas fa-gauge-high"></i> ${Math.round(speed)} صفحة/دقيقة${AIX.tessWorkers ? ` • ${AIX.tessWorkers} قارئ محلي` : ''}${eta ? ` • متبقي ≈ ${eta} د` : ''}</span>` : ''}`;
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
  aixLog(`بدء فهرسة ${list.length} ملف (${aixMode() === 'fast' ? 'الوضع السريع' : 'الوضع الدقيق'})`);
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
  AIX.startedAt = Date.now();
  AIX.pagesDone = 0;
  aixRenderControls();
  /* منع إطفاء الشاشة/تجميد التبويب أثناء الفهرسة قدر الإمكان */
  let wake = null;
  try{ if(navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); }catch(e){}
  try{
    while(AIX.queue.length){
      const job = AIX.queue.shift();
      try{ await aixIndexFile(job.fileId, job.force); }
      catch(e){ aixLog('فشل: ' + (e.message || e), 'err'); }
    }
  } finally {
    try{ if(wake) wake.release(); }catch(e){}
    try{ await aixTessStop(); }catch(e){}
    const mins = ((Date.now() - AIX.startedAt) / 60000).toFixed(1);
    AIX.running = false; AIX.current = null; AIX.paused = false;
    aixRenderControls();
    renderAiIndexPanel();
    aixLog(`انتهت الفهرسة ✓ (${AIX.pagesDone} صفحة في ${mins} دقيقة)`, 'ok');
  }
}

const aixSleep = ms => new Promise(r => setTimeout(r, ms));
async function aixWaitPause(){ while(AIX.paused) await aixSleep(500); }

async function aixToken(){
  const r = await sb.auth.getSession();
  return r && r.data && r.data.session ? r.data.session.access_token : '';
}

/* ================== قراءة نص PDF مباشرة ================== */
async function aixPageText(doc, num){
  try{
    const page = await doc.getPage(num);
    const tc = await page.getTextContent();
    /* ترتيب الأسطر حسب الموضع (من فوق لتحت) */
    const lines = [];
    tc.items.forEach(it => {
      if(!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5]);
      let line = lines.find(l => Math.abs(l.y - y) <= 3);
      if(!line){ line = { y, parts: [] }; lines.push(line); }
      line.parts.push({ x: it.transform[4], s: it.str });
    });
    lines.sort((a, b) => b.y - a.y);
    const text = lines.map(l => l.parts.sort((a, b) => b.x - a.x).map(p => p.s).join(' ')).join('\n');
    try{ page.cleanup(); }catch(e){}
    return text.normalize('NFKC');
  }catch(e){ return ''; }
}

const AIX_COMMON = ['في', 'من', 'على', 'الى', 'إلى', 'ما', 'قيمة', 'اذا', 'إذا', 'التي', 'الذي', 'عدد', 'اوجد', 'أوجد', 'كان', 'العدد', 'ناتج', 'يساوي', 'الكلمة', 'الجملة'];
const rev = w => w.split('').reverse().join('');

/* هل نص PDF صالح؟ (عربي كافٍ، غير مخربط) — ويصلحه لو كانت الكلمات مقلوبة */
function aixCheckText(raw){
  const text = String(raw || '');
  const ar = (text.match(/[ء-ي]/g) || []).length;
  const bad = (text.match(/[�-]/g) || []).length;
  if(ar < 60 || bad > 5) return null;                 /* صفحة مصوّرة أو خط مشفّر */
  const words = text.split(/\s+/);
  let ok = 0, flipped = 0;
  words.forEach(w => {
    const c = w.replace(/[^ء-ي]/g, '');
    if(!c) return;
    if(AIX_COMMON.includes(c)) ok++;
    else if(AIX_COMMON.includes(rev(c))) flipped++;
  });
  if(flipped > ok && flipped >= 2){
    /* الحروف مقلوبة داخل الكلمات → نعكسها */
    return text.split('\n').map(line => line.split(/\s+/).map(w => /[ء-ي]/.test(w) ? rev(w) : w).reverse().join(' ')).join('\n');
  }
  if(ok === 0 && words.length > 40) return null;       /* نص غريب → نخلي الذكاء يقرأه */
  return text;
}

/* استخراج الأسئلة المرقّمة من النص (تقريبي — البحث يعتمد على النص كاملاً أصلاً) */
function aixExtractQuestions(text){
  const out = [];
  const re = /(?:^|\n|\s)(\d{1,3})\s*[-.)(\u066B]\s*/g;
  const marks = [];
  let m;
  while((m = re.exec(text))) marks.push({ n: m[1], i: m.index + m[0].length });
  for(let k = 0; k < marks.length; k++){
    const seg = text.slice(marks[k].i, k + 1 < marks.length ? marks[k + 1].i - marks[k + 1].n.length - 2 : undefined).trim();
    if(seg.length > 8) out.push({ number: marks[k].n, text: seg.slice(0, 1500) });
  }
  return out.slice(0, 40);
}

/* صورة الصفحة (عرض ~1100px — كافية للقراءة وأسرع في الرفع) */
async function aixRenderPage(doc, num){
  const page = await doc.getPage(num);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(1.8, 1100 / (vp1.width || 600));
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  try{ page.cleanup(); }catch(e){}
  const data = c.toDataURL('image/jpeg', 0.72).split(',')[1];
  c.width = c.height = 1;
  return data;
}

/* ⭐ بوابة الإيقاع: لا نرسل لـ Gemini أسرع من حد الحساب المجاني */
let _aixGate = Promise.resolve();
function aixRateGate(){
  _aixGate = _aixGate.then(async () => {
    const wait = AIX.lastReq + AIX.gapMs - Date.now();
    if(wait > 0) await aixSleep(wait);
    AIX.lastReq = Date.now();
  });
  return _aixGate;
}

/* طلب قراءة دفعة صفحات عبر Gemini — مع احترام الحدود */
async function aixOcrBatch(fileTitle, items){
  for(let attempt = 0; attempt < 6; attempt++){
    await aixWaitPause();
    await aixRateGate();
    const token = await aixToken();
    let res, j = null;
    try{
      res = await fetch(getAIUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '') },
        body: JSON.stringify({ mode: 'index_pages', fileTitle, images: items.map(it => ({ page: it.page, image: it.image, mime: 'image/jpeg' })) })
      });
      try{ j = await res.json(); }catch(e){}
    }catch(e){ res = { ok: false, status: 0 }; }

    if(res.ok && j && Array.isArray(j.pages)){
      /* نجاح → نسرّع شوي (بحدود) */
      if(AIX.gapMs > 3000) AIX.gapMs -= 250;
      if(AIX.conc < AIX.maxConc && Math.random() < 0.2) AIX.conc++;
      return j.pages;
    }
    const msg = (j && j.error) || ('HTTP ' + res.status);
    if(res.status === 403) throw new Error(msg);
    const limited = res.status === 429 || /حد الاستخدام|مزدحمة|بطيئة/.test(msg);
    if(limited){
      /* حد الدقيقة → ننتظر دقيقة كاملة ونبطّئ الإيقاع */
      AIX.conc = 1;
      AIX.gapMs = Math.min(12000, AIX.gapMs + 2000);
      aixLog(`Gemini وصل حدّه — ننتظر دقيقة ثم نكمل تلقائياً (لا تقفل الصفحة)`, 'warn');
      await aixSleep(62000);
    } else {
      aixLog(`صفحات ${items.map(i => i.page).join('،')}: ${msg} — إعادة المحاولة`, 'warn');
      await aixSleep(3000 * (attempt + 1));
    }
  }
  throw new Error('تعذّرت قراءة الصفحات ' + items.map(i => i.page).join('،'));
}

async function aixSaveRows(fileId, rows){
  if(!rows.length) return;
  const { error } = await sb.from('file_pages').upsert(
    rows.map(r => ({ file_id: fileId, page: r.page, content: r.content, questions: r.questions, method: r.method })),
    { onConflict: 'file_id,page' }
  );
  if(error) throw error;
  AIX.current.done += rows.length;
  AIX.stats[fileId] = AIX.current.done;
  AIX.pagesDone += rows.length;
  aixRenderControls();
}

/* ================== ⚡ قراءة محلية داخل المتصفح (Tesseract) ================== */
const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let _tessScheduler = null;
let _tessLoading = null;

function aixLoadTesseract(){
  if(window.Tesseract) return Promise.resolve();
  if(_tessLoading) return _tessLoading;
  _tessLoading = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = TESS_URL; sc.async = true;
    sc.onload = () => res();
    sc.onerror = () => { _tessLoading = null; rej(new Error('تعذّر تحميل قارئ النصوص')); };
    document.head.appendChild(sc);
  });
  return _tessLoading;
}

async function aixTessScheduler(){
  if(_tessScheduler) return _tessScheduler;
  await aixLoadTesseract();
  const cores = navigator.hardwareConcurrency || 4;
  const n = Math.max(1, Math.min(4, cores - 1));
  aixLog(`⚙️ تجهيز ${n} قارئ نصوص عربي داخل المتصفح (أول مرة تحتاج تحميل بسيط)...`);
  const sch = Tesseract.createScheduler();
  for(let i = 0; i < n; i++){
    const w = await Tesseract.createWorker('ara+eng', 1, { logger: () => {} });
    await w.setParameters({ preserve_interword_spaces: '1' });
    sch.addWorker(w);
  }
  AIX.tessWorkers = n;
  _tessScheduler = sch;
  return sch;
}

async function aixTessStop(){
  if(_tessScheduler){ try{ await _tessScheduler.terminate(); }catch(e){} }
  _tessScheduler = null; AIX.tessWorkers = 0;
}

/* صفحة → canvas بدقة مناسبة للقراءة المحلية */
async function aixRenderCanvas(doc, num){
  const page = await doc.getPage(num);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2.4, 1600 / (vp1.width || 600));
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext('2d', { alpha: false, willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  try{ page.cleanup(); }catch(e){}
  return c;
}

/* قراءة صفحات محلياً (متوازي حسب عدد القرّاء) */
async function aixTessPages(doc, fileId, pages){
  const sch = await aixTessScheduler();
  let next = 0, failed = [];
  let buf = [];
  const flush = async (force) => {
    if(buf.length >= 10 || (force && buf.length)){ const rows = buf; buf = []; await aixSaveRows(fileId, rows); }
  };
  const worker = async () => {
    while(next < pages.length){
      await aixWaitPause();
      const p = pages[next++];
      try{
        const canvas = await aixRenderCanvas(doc, p);
        const { data } = await sch.addJob('recognize', canvas);
        canvas.width = canvas.height = 1;
        const txt = String((data && data.text) || '').replace(/[\u200E\u200F\u202A-\u202E]/g, '').replace(/[ \t]+/g, ' ').trim();
        if(txt.length > 10){
          buf.push({ page: p, content: txt.slice(0, 20000), questions: aixExtractQuestions(txt), method: 'tess' });
          await flush(false);
        } else failed.push(p);
      }catch(e){ failed.push(p); }
    }
  };
  await Promise.all(Array.from({ length: AIX.tessWorkers || 1 }, worker));
  await flush(true);
  return failed;
}

/* ================== فهرسة ملف ================== */
async function aixIndexFile(fileId, force){
  const f = (DB.files || []).find(x => x.id === fileId);
  if(!f) return;
  const mode = aixMode();

  let done = new Set();
  if(force) await sb.from('file_pages').delete().eq('file_id', fileId);
  else {
    const { data } = await sb.from('file_pages').select('page').eq('file_id', fileId);
    done = new Set((data || []).map(r => r.page));
  }

  const { data: signed, error: sErr } = await sb.storage.from('pdfs').createSignedUrl(f.storage_path, 3600);
  if(sErr || !signed) throw new Error('تعذّر فتح الملف: ' + (sErr ? sErr.message : ''));
  const doc = await pdfjsLib.getDocument({
    url: signed.signedUrl,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
    disableAutoFetch: false
  }).promise;

  const total = doc.numPages;
  if(f.page_count !== total){
    f.page_count = total;
    try{ await sb.from('files').update({ page_count: total }).eq('id', fileId); }catch(e){}
  }
  AIX.current = { fileId, title: f.title, done: done.size, total };
  const pending = [];
  for(let p = 1; p <= total; p++) if(!done.has(p)) pending.push(p);
  aixLog(`بدء: ${f.title} (${pending.length} صفحة متبقية)`);
  renderAiIndexPanel();

  /* ⚡ المرحلة 1: نص PDF المباشر (بدون ذكاء اصطناعي) */
  const needOcr = [];
  if(mode === 'fast'){
    let buf = [];
    for(const p of pending){
      await aixWaitPause();
      const txt = aixCheckText(await aixPageText(doc, p));
      if(txt){
        buf.push({ page: p, content: txt.slice(0, 20000), questions: aixExtractQuestions(txt), method: 'text' });
        if(buf.length >= 25){ await aixSaveRows(fileId, buf); buf = []; }
      } else needOcr.push(p);
    }
    await aixSaveRows(fileId, buf);
    if(pending.length - needOcr.length) aixLog(`⚡ ${pending.length - needOcr.length} صفحة من نص الملف مباشرة • ${needOcr.length} تحتاج قراءة بالصورة`, 'ok');
  } else {
    needOcr.push(...pending);
  }

  /* ⚡ المرحلة 2 (الوضع السريع): الصفحات المصوّرة تُقرأ داخل المتصفح — بدون حدود */
  if(needOcr.length && mode === 'fast'){
    try{
      aixLog(`📖 قراءة ${needOcr.length} صفحة مصوّرة داخل المتصفح...`);
      const failedLocal = await aixTessPages(doc, fileId, needOcr);
      needOcr.length = 0;
      if(failedLocal.length){
        aixLog(`${failedLocal.length} صفحة ما انقرأت محلياً — نرسلها لـ Gemini`, 'warn');
        needOcr.push(...failedLocal);
      }
    }catch(e){
      aixLog('القارئ المحلي غير متاح (' + (e.message || e) + ') — نستخدم Gemini بإيقاع منضبط', 'warn');
    }
  }

  /* 🤖 المرحلة 3: Gemini (وضع Gemini، أو الصفحات اللي فشلت محلياً) — بإيقاع يحترم الحدود */
  if(needOcr.length){
    const batches = [];
    for(let i = 0; i < needOcr.length; i += AIX.batch) batches.push(needOcr.slice(i, i + AIX.batch));
    let next = 0, active = 0, failed = 0;

    await new Promise(resolve => {
      const pump = () => {
        if(next >= batches.length && active === 0) return resolve();
        while(active < AIX.conc && next < batches.length){
          const b = batches[next++];
          active++;
          (async () => {
            try{
              await aixWaitPause();
              const items = [];
              for(const p of b) items.push({ page: p, image: await aixRenderPage(doc, p) });
              const pages = await aixOcrBatch(f.title, items);
              const rows = [];
              for(const pg of pages){
                if(pg.ok){
                  const content = [pg.text, ...(pg.questions || []).map(q => (q.number ? q.number + ') ' : '') + q.text)].filter(Boolean).join('\n');
                  rows.push({ page: pg.page, content, questions: pg.questions || [], method: 'ocr' });
                } else {
                  /* الذكاء ما قرأها → نحفظ نص PDF الخام كاحتياط */
                  const raw = await aixPageText(doc, pg.page);
                  if(raw && raw.trim().length > 20) rows.push({ page: pg.page, content: raw.slice(0, 20000), questions: aixExtractQuestions(raw), method: 'text' });
                }
              }
              await aixSaveRows(fileId, rows);
            }catch(e){
              failed += b.length;
              aixLog(`صفحات ${b.join('،')} من «${f.title}»: ${e.message || e}`, 'err');
            }finally{
              active--;
              pump();
            }
          })();
        }
      };
      pump();
    });
    if(failed) aixLog(`⚠️ ${failed} صفحة ما انقرأت — اضغط «استكمال» لاحقاً لإعادتها`, 'warn');
  }

  try{ doc.destroy(); }catch(e){}
  if(AIX.pagesDone % 3 === 0) renderAiIndexPanel();
  aixLog(`✓ اكتمل: ${f.title}`, 'ok');
  renderAiIndexPanel();
}

/* فتح التبويب → تحميل الحالة */
document.addEventListener('click', e => {
  const tab = e.target.closest('.admin-tabs button[data-panel="aiindex"]');
  if(tab) setTimeout(renderAiIndexPanel, 50);
});
