/* ============================================================
   29) QUIZ v2 — لعبة العباقرة (إعادة بناء كاملة)
   - كل شيء يتبع current_index من الجلسة → مستحيل يتكرر سؤال
     أو يعلق العداد (كان سبب المشكلة: عودة الحالة إلى playing
     كانت تُعامل كبداية لعبة جديدة فيرجع للسؤال 1)
   - كل لاعب يحسب ويحفظ نقاطه بنفسه (لا كتابة على صفوف الآخرين)
   - مزامنة Realtime + فحص احتياطي كل ثانيتين
   - لو المضيف خرج، لاعب آخر يكمل الإدارة تلقائياً
   - دعم صورة للسؤال
============================================================ */

const QZ = {
  session: null,
  players: [],
  questions: [],
  questionsKey: '',
  shownIndex: -1,
  revealedIndex: -1,
  myAnswers: {},       /* index → answer index */
  myScore: 0,
  myCorrect: 0,
  qLocalStart: 0,
  timerInterval: null,
  autoNextTimer: null,
  stuckTimer: null,
  pollTimer: null,
  channel: null,
  isHost: false,
  chain: Promise.resolve(),
  finalizedFor: null,
  lastChangeAt: 0
};

const QZ_ICONS = ['A', 'B', 'C', 'D'];
const QZ_STATUS_RANK = { waiting: 0, playing: 1, revealing: 2, finished: 3 };

function generateRoomCode(){
  return String(Math.floor(100000 + Math.random() * 900000));
}

function qzEl(id){ return document.getElementById(id); }
function qzShow(screen){
  ['quizLobby', 'quizWaitingRoom', 'quizGameScreen', 'quizFinalResults'].forEach(id => {
    const el = qzEl(id);
    if(el) el.style.display = (id === screen) ? 'block' : 'none';
  });
}

function initQuiz(){
  renderQuizMyStats();
  if(typeof isPrivileged === 'function' && isPrivileged()) renderAdminQuizQuestions();
  bindQuizEvents();
}
window.initQuiz = initQuiz;

function renderQuizMyStats(){
  const box = qzEl('quizMyStats');
  if(!box || !currentUserObj) return;
  const wins = currentUserObj.kahoot_wins || 0;
  const games = currentUserObj.kahoot_games || 0;
  const score = currentUserObj.kahoot_total_score || 0;
  box.innerHTML = `
    <div class="stat"><b>${wins}</b><small>🏆 جلسات فزت بها</small></div>
    <div class="stat"><b>${games}</b><small>🎮 إجمالي الجلسات</small></div>
    <div class="stat"><b>${score}</b><small>⭐ مجموع النقاط</small></div>
  `;
}

/* ================== إنشاء / انضمام ================== */
async function createQuizRoom(){
  if(!currentUserObj){ toast('سجل الدخول أولاً', 'warn'); return; }
  if(!isSubscribed()){ toast('تحتاج اشتراكاً مفعّلاً', 'warn'); return; }
  if(QZ.session){ toast('أنت داخل غرفة بالفعل', 'warn'); return; }

  const totalQ = parseInt(qzEl('quizTotalQuestions').value, 10) || 20;
  const seconds = parseInt(qzEl('quizSeconds').value, 10) || 20;

  const { count, error: cErr } = await sb.from('quiz_questions').select('id', { count: 'exact', head: true });
  if(cErr){ toast('فشل جلب الأسئلة: ' + cErr.message, 'err'); return; }
  if(!count || count < 5){ toast('يجب إضافة 5 أسئلة على الأقل في لوحة الأدمن', 'warn'); return; }

  let data = null, lastErr = null;
  for(let i = 0; i < 4 && !data; i++){
    const r = await sb.from('quiz_sessions').insert({
      room_code: generateRoomCode(),
      host_id: currentUserObj.id,
      total_questions: Math.min(totalQ, count),
      question_seconds: seconds,
      status: 'waiting',
      current_index: 0
    }).select().single();
    if(r.error) lastErr = r.error; else data = r.data;
  }
  if(!data){ toast('فشل إنشاء الغرفة: ' + (lastErr ? lastErr.message : ''), 'err'); return; }

  resetQuizLocalState();
  QZ.session = data;
  QZ.isHost = true;
  await addPlayerToSession(data.id);
  enterQuizRoom();
}
window.createQuizRoom = createQuizRoom;

async function joinQuizRoom(){
  if(!currentUserObj){ toast('سجل الدخول أولاً', 'warn'); return; }
  if(!isSubscribed()){ toast('تحتاج اشتراكاً مفعّلاً', 'warn'); return; }
  if(QZ.session){ toast('أنت داخل غرفة بالفعل', 'warn'); return; }

  const code = (qzEl('quizJoinCode').value || '').trim();
  if(!/^\d{6}$/.test(code)){ toast('أدخل رمز غرفة صحيح (6 أرقام)', 'warn'); return; }

  const { data, error } = await sb.from('quiz_sessions')
    .select('*').eq('room_code', code).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if(error || !data){ toast('الغرفة غير موجودة', 'err'); return; }
  if(data.status !== 'waiting'){ toast('اللعبة بدأت بالفعل في هذه الغرفة', 'warn'); return; }

  const { data: players } = await sb.from('quiz_players').select('user_id').eq('session_id', data.id);
  const already = (players || []).some(p => p.user_id === currentUserObj.id);
  if(!already && players && players.length >= (data.max_players || 4)){ toast('الغرفة ممتلئة', 'warn'); return; }

  resetQuizLocalState();
  QZ.session = data;
  QZ.isHost = data.host_id === currentUserObj.id;
  await addPlayerToSession(data.id);
  enterQuizRoom();
}
window.joinQuizRoom = joinQuizRoom;

async function addPlayerToSession(sessionId){
  await sb.from('quiz_players').upsert({
    session_id: sessionId,
    user_id: currentUserObj.id,
    name: currentUserObj.name || 'لاعب',
    avatar_url: currentUserObj.avatar_url || null,
    score: 0,
    correct_count: 0
  }, { onConflict: 'session_id,user_id' });
}

function resetQuizLocalState(){
  stopQuizTimer();
  clearTimeout(QZ.autoNextTimer);
  clearTimeout(QZ.stuckTimer);
  QZ.players = []; QZ.questions = []; QZ.questionsKey = '';
  QZ.shownIndex = -1; QZ.revealedIndex = -1;
  QZ.myAnswers = {}; QZ.myScore = 0; QZ.myCorrect = 0;
  QZ.chain = Promise.resolve();
}

function enterQuizRoom(){
  qzShow('quizWaitingRoom');
  const display = qzEl('quizRoomCodeDisplay');
  if(display) display.textContent = QZ.session.room_code;
  subscribeQuizRoom();
  startQuizPolling();
  loadQuizPlayers();
}

/* ================== اللاعبون ================== */
async function loadQuizPlayers(){
  if(!QZ.session) return;
  const { data } = await sb.from('quiz_players').select('*').eq('session_id', QZ.session.id).order('joined_at', { ascending: true });
  QZ.players = data || [];
  /* نقاطي المحلية أدق (لو التحديث لم يصل بعد) */
  const me = QZ.players.find(p => p.user_id === currentUserObj.id);
  if(me){
    me.score = Math.max(me.score || 0, QZ.myScore);
    me.correct_count = Math.max(me.correct_count || 0, QZ.myCorrect);
  }
  const st = QZ.session.status;
  if(st === 'waiting') renderQuizPlayers();
  else if(st === 'playing' || st === 'revealing'){
    updateQuizPlayersBar();
    if(QZ.revealedIndex === QZ.shownIndex && QZ.revealedIndex >= 0) renderQuizRevealPlayers();
  }
}

function renderQuizPlayers(){
  const grid = qzEl('quizPlayersGrid');
  if(!grid || !QZ.session) return;
  const max = QZ.session.max_players || 4;
  let html = '';
  QZ.players.forEach(p => {
    const isMe = p.user_id === currentUserObj.id;
    const isHost = p.user_id === QZ.session.host_id;
    const initial = String(p.name || '؟').charAt(0);
    const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
    html += `
      <div class="quiz-player-card ${isMe ? 'me' : ''} ${isHost ? 'host' : ''}">
        <div class="quiz-player-avatar" style="${av}">${av ? '' : escapeHtml(initial)}</div>
        <div class="quiz-player-name">${escapeHtml(p.name)}${isHost ? ' 👑' : ''}</div>
        <div class="quiz-player-status"><i class="fas fa-check-circle"></i> جاهز</div>
      </div>`;
  });
  for(let i = QZ.players.length; i < max; i++){
    html += `<div class="quiz-player-empty"><div><i class="fas fa-user-plus"></i><br><span>في انتظار لاعب</span></div></div>`;
  }
  grid.innerHTML = html;

  const countEl = qzEl('quizPlayersCount');
  if(countEl) countEl.textContent = `${QZ.players.length} من ${max} لاعبين`;

  const startBtn = qzEl('quizStartBtn');
  if(startBtn){
    if(QZ.isHost){
      startBtn.style.display = 'inline-flex';
      const canStart = QZ.players.length >= 2;
      startBtn.disabled = !canStart;
      startBtn.style.opacity = canStart ? '1' : '.55';
      startBtn.style.cursor = canStart ? 'pointer' : 'not-allowed';
      startBtn.title = canStart ? 'ابدأ اللعبة' : 'يجب وجود لاعبَين على الأقل';
    } else {
      startBtn.style.display = 'none';
    }
  }
}

/* ================== بدء اللعبة (المضيف) ================== */
async function startQuizGame(){
  if(!QZ.isHost){ toast('المضيف فقط يبدأ اللعبة', 'warn'); return; }
  await loadQuizPlayers();
  if(QZ.players.length < 2){ toast('يجب وجود لاعبَين على الأقل', 'warn'); return; }

  const btn = qzEl('quizStartBtn');
  if(btn){ btn.disabled = true; }

  const total = QZ.session.total_questions || 20;
  const { data: allQs, error } = await sb.from('quiz_questions').select('id').limit(1000);
  if(error || !allQs || allQs.length < 5){ toast('أسئلة غير كافية', 'err'); if(btn) btn.disabled = false; return; }

  /* خلط عادل (Fisher–Yates) + إزالة أي تكرار */
  const ids = [...new Set(allQs.map(q => q.id))];
  for(let i = ids.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const selected = ids.slice(0, Math.min(total, ids.length));

  const { data, error: upErr } = await sb.from('quiz_sessions').update({
    status: 'playing',
    question_ids: selected,
    total_questions: selected.length,
    current_index: 0,
    question_started_at: new Date().toISOString()
  }).eq('id', QZ.session.id).eq('status', 'waiting').select().single();

  if(upErr || !data){ toast('فشل بدء اللعبة', 'err'); if(btn) btn.disabled = false; return; }
  queueApplySession(data);
}
window.startQuizGame = startQuizGame;

/* ================== المزامنة ================== */
function subscribeQuizRoom(){
  if(QZ.channel){ try{ sb.removeChannel(QZ.channel); }catch(e){} QZ.channel = null; }
  if(!QZ.session) return;
  const sid = QZ.session.id;

  QZ.channel = sb.channel('quiz-' + sid + '-' + Date.now())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_players', filter: 'session_id=eq.' + sid },
      debounce(() => loadQuizPlayers(), 250))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: 'id=eq.' + sid },
      payload => { if(payload.new) queueApplySession(payload.new); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'quiz_sessions', filter: 'id=eq.' + sid },
      () => { toast('أُغلقت الغرفة', 'warn'); backToQuizLobby(true); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_answers', filter: 'session_id=eq.' + sid },
      () => onAnyAnswer())
    .subscribe();
}

/* فحص احتياطي — لو Realtime فاتته رسالة لا تتوقف اللعبة */
function startQuizPolling(){
  stopQuizPolling();
  QZ.pollTimer = setInterval(async () => {
    if(!QZ.session) return;
    try{
      const { data, error } = await sb.from('quiz_sessions').select('*').eq('id', QZ.session.id).maybeSingle();
      if(error) return;
      if(!data){ toast('أُغلقت الغرفة', 'warn'); backToQuizLobby(true); return; }
      queueApplySession(data);
      if(data.status === 'waiting') loadQuizPlayers();
    }catch(e){}
  }, 2000);
}
function stopQuizPolling(){
  if(QZ.pollTimer){ clearInterval(QZ.pollTimer); QZ.pollTimer = null; }
}

/* تنفيذ التحديثات بالترتيب (لا تتداخل) + تجاهل القديم */
function queueApplySession(s){
  QZ.chain = QZ.chain.then(() => applySession(s)).catch(e => console.warn('quiz apply error', e));
  return QZ.chain;
}

function isStale(n){
  const o = QZ.session;
  if(!o || !n) return false;
  if((n.current_index || 0) < (o.current_index || 0)) return true;
  if((n.current_index || 0) === (o.current_index || 0) &&
     (QZ_STATUS_RANK[n.status] || 0) < (QZ_STATUS_RANK[o.status] || 0)) return true;
  return false;
}

async function applySession(n){
  if(!QZ.session || !n || n.id !== QZ.session.id) return;
  if(isStale(n)) return;

  const changed = n.status !== QZ.session.status || n.current_index !== QZ.session.current_index || n.host_id !== QZ.session.host_id;
  QZ.session = n;
  QZ.isHost = n.host_id === currentUserObj.id;
  if(changed) QZ.lastChangeAt = Date.now();

  if(n.status === 'waiting'){
    qzShow('quizWaitingRoom');
    renderQuizPlayers();
    return;
  }

  if(n.status === 'finished'){
    stopQuizTimer();
    clearTimeout(QZ.autoNextTimer);
    await showQuizFinalResults();
    return;
  }

  /* playing / revealing */
  const ok = await ensureQuizQuestions();
  if(!ok) return;
  qzShow('quizGameScreen');

  const idx = n.current_index || 0;
  if(idx !== QZ.shownIndex) showQuizQuestion(idx);
  if(n.status === 'revealing' && QZ.revealedIndex !== idx) await revealQuizAnswer(idx);

  armStuckWatchdog();
}

async function ensureQuizQuestions(){
  const ids = QZ.session.question_ids || [];
  if(!ids.length){ toast('لا توجد أسئلة', 'err'); return false; }
  const key = ids.join(',');
  if(QZ.questionsKey === key && QZ.questions.length) return true;
  const { data, error } = await sb.from('quiz_questions').select('*').in('id', ids);
  if(error || !data){ toast('فشل جلب الأسئلة', 'err'); return false; }
  const map = new Map(data.map(q => [q.id, q]));
  QZ.questions = ids.map(id => map.get(id)).filter(Boolean);
  QZ.questionsKey = key;
  return QZ.questions.length > 0;
}

/* ================== عرض السؤال ================== */
function showQuizQuestion(idx){
  const q = QZ.questions[idx];
  if(!q) return;
  stopQuizTimer();
  clearTimeout(QZ.autoNextTimer);

  QZ.shownIndex = idx;
  const secs = QZ.session.question_seconds || 20;

  /* مزامنة الوقت مع بداية السؤال عند المضيف (مع حماية من فرق الساعات) */
  const started = Date.parse(QZ.session.question_started_at || '') || Date.now();
  let elapsed = Date.now() - started;
  if(!(elapsed >= 0 && elapsed < secs * 1000)) elapsed = Math.min(Math.max(0, elapsed), secs * 1000);
  if(Math.abs(Date.now() - started) > 60000) elapsed = 0; /* ساعة الجهاز مختلفة كثيراً */
  QZ.qLocalStart = Date.now() - elapsed;

  const setTxt = (id, v) => { const el = qzEl(id); if(el) el.textContent = v; };
  setTxt('quizQNum', idx + 1);
  setTxt('quizQTotal', QZ.questions.length);
  setTxt('quizCategory', q.category || 'عام');
  setTxt('quizQuestionText', q.question || '');

  /* صورة السؤال */
  const qText = qzEl('quizQuestionText');
  let img = qzEl('quizQuestionImage');
  if(!img && qText){
    img = document.createElement('img');
    img.id = 'quizQuestionImage';
    img.className = 'quiz-q-image';
    img.alt = 'صورة السؤال';
    qText.parentNode.insertBefore(img, qText.nextSibling);
  }
  if(img){
    if(q.image_url){ img.src = q.image_url; img.style.display = 'block'; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  }

  renderQuizAnswers();
  const rb = qzEl('quizRevealBox'); if(rb){ rb.style.display = 'none'; rb.innerHTML = ''; }

  const remaining = Math.max(0, secs - elapsed / 1000);
  startQuizTimer(secs, remaining, idx);
  updateQuizPlayersBar();
}

function renderQuizAnswers(){
  const grid = qzEl('quizAnswersGrid');
  const idx = QZ.shownIndex;
  const q = QZ.questions[idx];
  if(!grid || !q) return;
  const mine = QZ.myAnswers[idx];
  const locked = mine !== undefined || QZ.revealedIndex === idx;
  grid.innerHTML = (q.answers || []).map((ans, i) => `
    <button class="quiz-answer-btn ${mine === i ? 'selected' : ''}" data-idx="${i}" ${locked ? 'disabled' : ''}
      onclick="submitQuizAnswer(${i})">
      <span class="quiz-answer-icon">${QZ_ICONS[i]}</span>
      <span>${escapeHtml(ans)}</span>
    </button>
  `).join('');
}

/* ================== المؤقت ================== */
function startQuizTimer(total, remaining, idx){
  stopQuizTimer();
  const ring = qzEl('quizTimerRing');
  const num = qzEl('quizTimerNum');
  const circumference = 188.5;
  const draw = () => {
    const left = Math.max(0, total - (Date.now() - QZ.qLocalStart) / 1000);
    const s = Math.ceil(left);
    if(num){ num.textContent = s; num.classList.toggle('warning', s <= 5); }
    if(ring) ring.style.strokeDashoffset = ((total - left) / total) * circumference;
    return left;
  };
  draw();
  if(remaining <= 0){ onQuizTimeUp(idx); return; }
  QZ.timerInterval = setInterval(() => {
    if(draw() <= 0){ stopQuizTimer(); onQuizTimeUp(idx); }
  }, 200);
}
function stopQuizTimer(){
  if(QZ.timerInterval){ clearInterval(QZ.timerInterval); QZ.timerInterval = null; }
}

function onQuizTimeUp(idx){
  if(!QZ.session || QZ.shownIndex !== idx) return;
  document.querySelectorAll('.quiz-answer-btn').forEach(b => b.disabled = true);
  if(QZ.isHost) hostReveal(idx);
  else {
    /* لو المضيف تأخر — نكشف محلياً بعد 4 ثواني */
    setTimeout(() => {
      if(QZ.session && QZ.shownIndex === idx && QZ.revealedIndex !== idx && QZ.session.status === 'playing'){
        revealQuizAnswer(idx);
      }
    }, 4000);
  }
}

/* المضيف ينقل الجلسة لحالة الكشف (مرة واحدة فقط لكل سؤال) */
async function hostReveal(idx){
  if(!QZ.isHost || !QZ.session) return;
  if(QZ.session.status !== 'playing' || QZ.session.current_index !== idx) return;
  const { data } = await sb.from('quiz_sessions')
    .update({ status: 'revealing' })
    .eq('id', QZ.session.id).eq('current_index', idx).eq('status', 'playing')
    .select().maybeSingle();
  if(data) queueApplySession(data);
}

/* كل ما أجاب أحد: لو الكل أجاب → المضيف يكشف فوراً */
const onAnyAnswer = debounce(async () => {
  if(!QZ.session || QZ.session.status !== 'playing') return;
  const idx = QZ.shownIndex;
  const q = QZ.questions[idx];
  if(!q) return;
  const { data } = await sb.from('quiz_answers').select('user_id').eq('session_id', QZ.session.id).eq('question_id', q.id);
  const answered = new Set((data || []).map(a => a.user_id)).size;
  const bar = qzEl('quizAnsweredCount');
  if(bar) bar.textContent = `${answered} / ${QZ.players.length} أجابوا`;
  if(QZ.isHost && QZ.players.length && answered >= QZ.players.length){
    stopQuizTimer();
    setTimeout(() => hostReveal(idx), 400);
  }
}, 250);

/* ================== الإجابة ================== */
async function submitQuizAnswer(i){
  const idx = QZ.shownIndex;
  const q = QZ.questions[idx];
  if(!q || !QZ.session) return;
  if(QZ.myAnswers[idx] !== undefined) return;
  if(QZ.revealedIndex === idx || QZ.session.status !== 'playing') return;

  const secs = QZ.session.question_seconds || 20;
  const elapsed = (Date.now() - QZ.qLocalStart) / 1000;
  if(elapsed > secs + 0.5) return;

  QZ.myAnswers[idx] = i;
  document.querySelectorAll('.quiz-answer-btn').forEach(b => {
    b.disabled = true;
    if(parseInt(b.dataset.idx, 10) === i) b.classList.add('selected');
  });

  const isCorrect = i === q.correct_index;
  /* نقاط: 100 للإجابة الصحيحة + حتى 100 حسب السرعة */
  const points = isCorrect ? 100 + Math.max(0, Math.round(((secs - elapsed) / secs) * 100)) : 0;
  if(isCorrect){ QZ.myScore += points; QZ.myCorrect += 1; }
  QZ.lastPoints = { idx, points, isCorrect };

  try{
    await sbSafeWrite(p => sb.from('quiz_answers').insert(p), {
      session_id: QZ.session.id, question_id: q.id, user_id: currentUserObj.id,
      answer_index: i, is_correct: isCorrect, points
    });
  }catch(e){}

  /* كل لاعب يحدّث صفه فقط */
  try{
    await sb.from('quiz_players').update({ score: QZ.myScore, correct_count: QZ.myCorrect })
      .eq('session_id', QZ.session.id).eq('user_id', currentUserObj.id);
  }catch(e){}

  onAnyAnswer();
}
window.submitQuizAnswer = submitQuizAnswer;

/* ================== كشف الإجابة ================== */
async function revealQuizAnswer(idx){
  const q = QZ.questions[idx];
  if(!q || QZ.revealedIndex === idx) return;
  QZ.revealedIndex = idx;
  stopQuizTimer();

  const correctIdx = q.correct_index;
  const mine = QZ.myAnswers[idx];
  document.querySelectorAll('.quiz-answer-btn').forEach(b => {
    b.disabled = true;
    const bi = parseInt(b.dataset.idx, 10);
    if(bi === correctIdx) b.classList.add('correct');
    else if(bi === mine) b.classList.add('wrong');
  });

  const lp = QZ.lastPoints && QZ.lastPoints.idx === idx ? QZ.lastPoints : null;
  const myLine = mine === undefined
    ? '<div class="quiz-my-result miss"><i class="fas fa-clock"></i> لم تجب على هذا السؤال</div>'
    : (mine === correctIdx
        ? `<div class="quiz-my-result ok"><i class="fas fa-circle-check"></i> إجابة صحيحة! +${lp ? lp.points : 100} نقطة</div>`
        : '<div class="quiz-my-result bad"><i class="fas fa-circle-xmark"></i> إجابة خاطئة</div>');

  const revealBox = qzEl('quizRevealBox');
  if(revealBox){
    revealBox.innerHTML = `
      ${myLine}
      <div class="quiz-reveal-header">
        <i class="fas fa-check-circle"></i>
        <span>الإجابة الصحيحة: <b style="color:var(--success)">${escapeHtml((q.answers || [])[correctIdx] || '')}</b></span>
      </div>
      <div id="quizRevealPlayers"></div>
      <div id="quizNextWrap"></div>
    `;
    revealBox.style.display = 'block';
  }

  await loadQuizPlayers();
  renderQuizRevealPlayers();
  renderQuizNextControls(idx);
}

async function renderQuizRevealPlayers(){
  const box = qzEl('quizRevealPlayers');
  if(!box || !QZ.session) return;
  const q = QZ.questions[QZ.revealedIndex];
  let answers = [];
  if(q){
    try{
      const { data } = await sb.from('quiz_answers').select('user_id,is_correct,points')
        .eq('session_id', QZ.session.id).eq('question_id', q.id);
      answers = data || [];
    }catch(e){}
  }
  const sorted = [...QZ.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  box.innerHTML = sorted.map((p, i) => {
    const ans = answers.find(a => a.user_id === p.user_id);
    const isCorrect = ans && ans.is_correct;
    const initial = String(p.name || '؟').charAt(0);
    const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
    return `
      <div class="quiz-player-score-row ${isCorrect ? 'correct' : (ans ? 'wrong' : '')}" style="margin-top:8px">
        <span class="quiz-rank">${i + 1}</span>
        <div class="av" style="${av}">${av ? '' : escapeHtml(initial)}</div>
        <div class="info">
          <b>${escapeHtml(p.name)}${p.user_id === currentUserObj.id ? ' (أنت)' : ''}</b>
          <small>${ans ? (isCorrect ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة') : '⏰ لم يجب'}</small>
        </div>
        ${isCorrect ? `<span class="badge-correct">+${ans.points || 100}</span>` : ''}
        <div class="score">${p.score || 0}</div>
      </div>`;
  }).join('');
}

function renderQuizNextControls(idx){
  const wrap = qzEl('quizNextWrap');
  if(!wrap) return;
  clearTimeout(QZ.autoNextTimer);
  const isLast = idx + 1 >= QZ.questions.length;

  if(!QZ.isHost){
    wrap.innerHTML = `<div class="quiz-wait-next"><i class="fas fa-hourglass-half"></i> ${isLast ? 'بانتظار النتائج النهائية...' : 'السؤال التالي خلال لحظات...'}</div>`;
    return;
  }

  let left = 6;
  wrap.innerHTML = `
    <button class="btn btn-primary" id="quizNextBtn" onclick="nextQuizQuestion()" style="width:100%;padding:14px;margin-top:16px">
      <i class="fas ${isLast ? 'fa-flag-checkered' : 'fa-arrow-left'}"></i>
      ${isLast ? 'عرض النتائج' : 'السؤال التالي'} <span id="quizNextCount">(${left})</span>
    </button>`;
  const tick = () => {
    if(!QZ.session || QZ.revealedIndex !== idx || QZ.session.current_index !== idx) return;
    left--;
    const c = qzEl('quizNextCount'); if(c) c.textContent = `(${left})`;
    if(left <= 0) nextQuizQuestion();
    else QZ.autoNextTimer = setTimeout(tick, 1000);
  };
  QZ.autoNextTimer = setTimeout(tick, 1000);
}

/* المضيف ينتقل للسؤال التالي — شرط current_index يمنع أي قفزة مزدوجة */
async function nextQuizQuestion(){
  if(!QZ.isHost || !QZ.session) return;
  clearTimeout(QZ.autoNextTimer);
  const idx = QZ.session.current_index || 0;
  const btn = qzEl('quizNextBtn'); if(btn) btn.disabled = true;

  if(idx + 1 >= QZ.questions.length){
    const { data } = await sb.from('quiz_sessions').update({ status: 'finished' })
      .eq('id', QZ.session.id).eq('current_index', idx).select().maybeSingle();
    if(data) queueApplySession(data);
    return;
  }

  const { data } = await sb.from('quiz_sessions').update({
    current_index: idx + 1,
    status: 'playing',
    question_started_at: new Date().toISOString()
  }).eq('id', QZ.session.id).eq('current_index', idx).select().maybeSingle();
  if(data) queueApplySession(data);
}
window.nextQuizQuestion = nextQuizQuestion;

/* ================== لو المضيف اختفى ================== */
function armStuckWatchdog(){
  clearTimeout(QZ.stuckTimer);
  if(!QZ.session || QZ.session.status === 'finished') return;
  const secs = QZ.session.question_seconds || 20;
  const wait = (QZ.session.status === 'playing' ? secs + 12 : 18) * 1000;
  QZ.stuckTimer = setTimeout(takeOverIfStuck, wait);
}

async function takeOverIfStuck(){
  if(!QZ.session || QZ.isHost || QZ.session.status === 'finished') return;
  if(Date.now() - QZ.lastChangeAt < 10000) { armStuckWatchdog(); return; }
  await loadQuizPlayers();
  const others = QZ.players.filter(p => p.user_id !== QZ.session.host_id);
  if(!others.length || others[0].user_id !== currentUserObj.id){ armStuckWatchdog(); return; }
  const { data } = await sb.from('quiz_sessions').update({ host_id: currentUserObj.id })
    .eq('id', QZ.session.id).eq('host_id', QZ.session.host_id).select().maybeSingle();
  if(data){
    toast('👑 أصبحت المضيف لإكمال اللعبة', 'ok');
    QZ.session = data; QZ.isHost = true;
    if(data.status === 'playing') hostReveal(data.current_index || 0);
    else if(data.status === 'revealing') renderQuizNextControls(data.current_index || 0);
  }
  armStuckWatchdog();
}

/* ================== شريط اللاعبين ================== */
function updateQuizPlayersBar(){
  const bar = qzEl('quizPlayersBar');
  if(!bar) return;
  const sorted = [...QZ.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  bar.innerHTML = `<div class="quiz-answered" id="quizAnsweredCount"></div>` + sorted.map((p, i) => {
    const initial = String(p.name || '؟').charAt(0);
    const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
    return `
      <div class="quiz-player-score-row ${p.user_id === currentUserObj.id ? 'me' : ''}">
        <span class="quiz-rank">${i + 1}</span>
        <div class="av" style="${av}">${av ? '' : escapeHtml(initial)}</div>
        <div class="info">
          <b>${escapeHtml(p.name)}${p.user_id === QZ.session.host_id ? ' 👑' : ''}</b>
          <small>${p.correct_count || 0} إجابة صحيحة</small>
        </div>
        <div class="score">${p.score || 0}</div>
      </div>`;
  }).join('');
}

/* ================== النتائج النهائية ================== */
async function showQuizFinalResults(){
  qzShow('quizFinalResults');
  await loadQuizPlayers();
  const sorted = [...QZ.players].sort((a, b) =>
    (b.score || 0) - (a.score || 0) || (b.correct_count || 0) - (a.correct_count || 0));
  const winner = sorted[0];

  if(winner){
    const isMe = winner.user_id === currentUserObj.id;
    qzEl('quizFinalTitle').textContent = isMe ? '🏆 مبروك! فزت!' : `🏆 الفائز: ${winner.name}`;
    qzEl('quizFinalSubtitle').textContent = `${winner.correct_count || 0} إجابة صحيحة • ${winner.score || 0} نقطة`;
  }

  const list = qzEl('quizFinalList');
  if(list){
    list.innerHTML = sorted.map((p, i) => {
      const rank = i + 1;
      const initial = String(p.name || '؟').charAt(0);
      const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
      return `
        <div class="quiz-final-row ${rank <= 3 ? 'rank' + rank : ''}">
          <div class="quiz-final-rank">${rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}</div>
          <div class="quiz-final-av" style="${av}">${av ? '' : escapeHtml(initial)}</div>
          <div class="quiz-final-info">
            <b>${escapeHtml(p.name)} ${p.user_id === currentUserObj.id ? '(أنت)' : ''}</b>
            <small>${p.correct_count || 0} إجابة صحيحة من ${QZ.questions.length}</small>
          </div>
          <div class="quiz-final-score">${p.score || 0}<small>نقطة</small></div>
        </div>`;
    }).join('');
  }

  await finalizeMyQuizStats(sorted);
}

/* كل لاعب يحدّث إحصائياته ونقاط XP بنفسه — مرة واحدة لكل جلسة */
async function finalizeMyQuizStats(sorted){
  if(!QZ.session || !currentUserObj) return;
  const sid = QZ.session.id;
  const key = 'qz_done_' + sid + '_' + currentUserObj.id;
  if(QZ.finalizedFor === sid) return;
  QZ.finalizedFor = sid;
  try{ if(localStorage.getItem(key)) return; localStorage.setItem(key, '1'); }catch(e){}

  const me = sorted.find(p => p.user_id === currentUserObj.id);
  if(!me) return;
  const won = sorted[0] && sorted[0].user_id === currentUserObj.id && (me.score || 0) > 0;
  const myScore = Math.max(me.score || 0, QZ.myScore);

  /* XP: مشاركة 20 + 10 لكل إجابة صحيحة + 100 للفائز */
  const xp = 20 + (Math.max(me.correct_count || 0, QZ.myCorrect) * 10) + (won ? 100 : 0);
  userData.extraXp = (userData.extraXp || 0) + xp;
  savePrefs();
  toast(won ? `🏆 فزت! +${xp} XP` : `🎮 انتهت اللعبة — +${xp} XP`, 'ok');

  try{
    const { data: prof } = await sb.from('profiles').select('kahoot_wins,kahoot_games,kahoot_total_score').eq('id', currentUserObj.id).single();
    const upd = {
      kahoot_games: ((prof && prof.kahoot_games) || 0) + 1,
      kahoot_total_score: ((prof && prof.kahoot_total_score) || 0) + myScore,
      kahoot_wins: ((prof && prof.kahoot_wins) || 0) + (won ? 1 : 0)
    };
    await sbSafeWrite(p => sb.from('profiles').update(p).eq('id', currentUserObj.id), upd);
    Object.assign(currentUserObj, upd);
  }catch(e){}

  if(typeof syncMyXp === 'function') syncMyXp();
  renderQuizMyStats();
}

/* ================== الخروج ================== */
async function backToQuizLobby(silent){
  stopQuizTimer();
  stopQuizPolling();
  clearTimeout(QZ.autoNextTimer);
  clearTimeout(QZ.stuckTimer);
  if(QZ.channel){ try{ sb.removeChannel(QZ.channel); }catch(e){} QZ.channel = null; }

  QZ.session = null;
  resetQuizLocalState();
  qzShow('quizLobby');
  const jc = qzEl('quizJoinCode'); if(jc) jc.value = '';
  renderQuizMyStats();
}
window.backToQuizLobby = backToQuizLobby;

async function leaveQuizRoom(){
  if(!QZ.session) return backToQuizLobby();
  const s = QZ.session;
  try{
    if(QZ.isHost){
      await loadQuizPlayers();
      const next = QZ.players.find(p => p.user_id !== currentUserObj.id);
      if(next && s.status !== 'finished'){
        /* انقل الإدارة للاعب آخر بدل إغلاق الغرفة على الجميع */
        await sb.from('quiz_sessions').update({ host_id: next.user_id }).eq('id', s.id);
        await sb.from('quiz_players').delete().eq('session_id', s.id).eq('user_id', currentUserObj.id);
      } else {
        await sb.from('quiz_sessions').delete().eq('id', s.id);
      }
    } else {
      await sb.from('quiz_players').delete().eq('session_id', s.id).eq('user_id', currentUserObj.id);
    }
  }catch(e){}
  backToQuizLobby();
}
window.leaveQuizRoom = leaveQuizRoom;

function copyQuizCode(){
  if(!QZ.session) return;
  try{ navigator.clipboard.writeText(QZ.session.room_code); toast('✓ تم نسخ رمز الغرفة', 'ok'); }
  catch(e){ toast('تعذّر النسخ', 'err'); }
}
window.copyQuizCode = copyQuizCode;

/* إغلاق التبويب أثناء الانتظار → اخرج من الغرفة */
window.addEventListener('pagehide', () => {
  try{
    if(QZ.session && QZ.session.status === 'waiting' && !QZ.isHost && currentUserObj){
      sb.from('quiz_players').delete().eq('session_id', QZ.session.id).eq('user_id', currentUserObj.id).then(() => {});
    }
  }catch(e){}
});

/* ============================================================
   لوحة الأدمن — الأسئلة (مع صورة)
============================================================ */
let _qqImageFile = null;
let _qqImageUrl = null;

function renderAdminQuizQuestions(){
  const grid = qzEl('adminQuizGrid');
  if(!grid) return;
  sb.from('quiz_questions').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if(error){ grid.innerHTML = '<div class="admin-empty">فشل التحميل</div>'; return; }
    const count = qzEl('quizQuestionsCount');
    if(count) count.textContent = (data || []).length;
    if(!data || !data.length){
      grid.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-question-circle"></i></div><h3>لا توجد أسئلة</h3></div>';
      return;
    }
    grid.innerHTML = data.map(q => {
      const answers = q.answers || [];
      return `
        <div class="quiz-admin-card">
          <div class="category-badge">${escapeHtml(q.category || 'عام')}</div>
          ${q.image_url ? `<img class="quiz-admin-img" src="${escapeHtml(q.image_url)}" alt="" loading="lazy">` : ''}
          <h4>${escapeHtml(q.question || (q.image_url ? '(سؤال بالصورة)' : ''))}</h4>
          <div class="answers-list">
            ${answers.map((a, i) => `
              <div class="ans ${i === q.correct_index ? 'correct' : ''}">
                <span style="font-weight:900;color:var(--muted)">${QZ_ICONS[i]}.</span>
                <span>${escapeHtml(a)}</span>
              </div>`).join('')}
          </div>
          <div class="quiz-admin-actions">
            <button class="btn btn-ghost btn-sm" onclick="adminEditQuestion('${q.id}')"><i class="fas fa-pen"></i> تعديل</button>
            <button class="btn btn-danger btn-sm" onclick="adminDeleteQuestion('${q.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    }).join('');
  });
}
window.renderAdminQuizQuestions = renderAdminQuizQuestions;

function openQuizForm(){
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="addquiz"]');
  if(tab) tab.classList.add('on');
  const panel = qzEl('panel-addquiz');
  if(panel) panel.classList.add('on');
}

function renderQqImagePreview(src){
  const prev = qzEl('qqImagePreview');
  if(!prev) return;
  prev.innerHTML = src ? `
    <div style="position:relative;display:inline-block">
      <img src="${escapeHtml(src)}" style="max-width:260px;max-height:180px;border-radius:12px;border:1px solid var(--border);display:block">
      <button type="button" onclick="clearQuizImage()" style="position:absolute;top:-8px;right:-8px;width:26px;height:26px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer"><i class="fas fa-times"></i></button>
    </div>` : '';
}

window.previewQuizImage = function(input){
  const f = input.files && input.files[0];
  if(!f) return;
  if(!f.type.startsWith('image/')){ toast('اختر صورة صحيحة', 'warn'); return; }
  if(f.size > 5 * 1024 * 1024){ toast('الحد 5 ميجا', 'warn'); return; }
  _qqImageFile = f;
  const reader = new FileReader();
  reader.onload = e => renderQqImagePreview(e.target.result);
  reader.readAsDataURL(f);
};
window.clearQuizImage = function(){
  _qqImageFile = null; _qqImageUrl = null;
  const inp = qzEl('qqImageInput'); if(inp) inp.value = '';
  renderQqImagePreview(null);
};

window.adminNewQuestion = () => {
  qzEl('quizFormTitle').textContent = 'إضافة سؤال جديد';
  qzEl('qqId').value = '';
  qzEl('qqQuestion').value = '';
  document.querySelectorAll('.quiz-answer-field').forEach(f => { f.value = ''; });
  document.querySelector('input[name="qqCorrect"][value="0"]').checked = true;
  qzEl('qqCategory').value = 'عام';
  qzEl('qqDifficulty').value = 'medium';
  clearQuizImage();
  openQuizForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.adminEditQuestion = async id => {
  const { data: q } = await sb.from('quiz_questions').select('*').eq('id', id).single();
  if(!q) return;
  qzEl('quizFormTitle').textContent = 'تعديل السؤال';
  qzEl('qqId').value = q.id;
  qzEl('qqQuestion').value = q.question || '';
  const answers = q.answers || [];
  document.querySelectorAll('.quiz-answer-field').forEach((f, i) => { f.value = answers[i] || ''; });
  const r = document.querySelector(`input[name="qqCorrect"][value="${q.correct_index}"]`); if(r) r.checked = true;
  qzEl('qqCategory').value = q.category || 'عام';
  qzEl('qqDifficulty').value = q.difficulty || 'medium';
  _qqImageFile = null;
  _qqImageUrl = q.image_url || null;
  const inp = qzEl('qqImageInput'); if(inp) inp.value = '';
  renderQqImagePreview(_qqImageUrl);
  openQuizForm();
};

window.adminDeleteQuestion = id => {
  confirmBox('حذف السؤال', 'هل أنت متأكد من حذف هذا السؤال؟', async () => {
    const { error } = await sb.from('quiz_questions').delete().eq('id', id);
    if(error){ toast('فشل الحذف', 'err'); return; }
    toast('تم حذف السؤال', 'ok');
    renderAdminQuizQuestions();
  }, true);
};

window.backToQuizQuestionsList = () => {
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="quiz"]');
  if(tab) tab.classList.add('on');
  const panel = qzEl('panel-quiz');
  if(panel) panel.classList.add('on');
};

window.bulkAddQuestions = () => {
  openModal({
    title: 'إضافة أسئلة جماعية',
    text: 'أدخل سؤالاً واحداً في كل سطر بالصيغة: السؤال | جواب1 | جواب2 | جواب3 | جواب4 | رقم_الجواب_الصحيح (1-4)',
    bodyHTML: `<div class="form-group"><textarea id="bulkQuestionsInput" placeholder="ما ناتج ٢ + ٢؟ | ٢ | ٣ | ٤ | ٥ | 3" style="min-height:200px;font-family:monospace;direction:rtl"></textarea></div>`,
    okText: 'إضافة الكل',
    onOk: async () => {
      const text = qzEl('bulkQuestionsInput').value.trim();
      if(!text){ toast('الصق الأسئلة', 'warn'); return; }
      const questions = [], errors = [];
      text.split('\n').filter(l => l.trim()).forEach((line, i) => {
        const parts = line.split('|').map(p => p.trim());
        if(parts.length < 6){ errors.push(i + 1); return; }
        const correctIdx = parseInt(parts[5], 10) - 1;
        if(correctIdx < 0 || correctIdx > 3){ errors.push(i + 1); return; }
        questions.push({
          question: parts[0], answers: parts.slice(1, 5), correct_index: correctIdx,
          category: 'عام', difficulty: 'medium', created_by: currentUserObj.id
        });
      });
      if(questions.length){
        const { error } = await sb.from('quiz_questions').insert(questions);
        if(error){ toast('فشل: ' + error.message, 'err'); return; }
        toast(`✓ تمت إضافة ${questions.length} سؤال`, 'ok');
        renderAdminQuizQuestions();
      }
      if(errors.length) toast(`${errors.length} سطر فشل`, 'warn');
    }
  });
};

async function uploadQuizImage(file){
  const blob = typeof resizeImageToBlob === 'function' ? await resizeImageToBlob(file, 1200, 0.85) : file;
  const path = '_quiz/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
  const { error } = await sb.storage.from('avatars').upload(path, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });
  if(error) throw error;
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  return data ? data.publicUrl : null;
}

async function saveQuizQuestion(){
  if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
  const id = qzEl('qqId').value;
  const question = qzEl('qqQuestion').value.trim();
  const answers = Array.from(document.querySelectorAll('.quiz-answer-field')).map(f => f.value.trim());
  const correctIdx = parseInt(document.querySelector('input[name="qqCorrect"]:checked').value, 10);
  const category = qzEl('qqCategory').value;
  const difficulty = qzEl('qqDifficulty').value;

  if(!question && !_qqImageFile && !_qqImageUrl){ toast('اكتب السؤال أو أرفق صورة له', 'warn'); return; }
  if(answers.some(a => !a)){ toast('أدخل جميع الأجوبة', 'warn'); return; }

  const btn = qzEl('qqSave');
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';

  let imageUrl = _qqImageUrl;
  if(_qqImageFile){
    try{ imageUrl = await uploadQuizImage(_qqImageFile); }
    catch(e){ toast('فشل رفع الصورة: ' + (e.message || ''), 'err'); btn.disabled = false; btn.innerHTML = orig; return; }
  }

  const payload = { question, answers, correct_index: correctIdx, category, difficulty, image_url: imageUrl || null, created_by: currentUserObj.id };
  const r = id
    ? await sbSafeWrite(p => sb.from('quiz_questions').update(p).eq('id', id), payload)
    : await sbSafeWrite(p => sb.from('quiz_questions').insert(p), payload);

  btn.disabled = false;
  btn.innerHTML = orig;
  if(r.error){ toast('فشل: ' + r.error.message, 'err'); return; }
  toast(id ? '✓ تم التحديث' : '✓ تم الإضافة', 'ok');
  clearQuizImage();
  renderAdminQuizQuestions();
  backToQuizQuestionsList();
}

function bindQuizEvents(){
  const saveBtn = qzEl('qqSave');
  if(saveBtn && !saveBtn.dataset.bound){
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', saveQuizQuestion);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindQuizEvents();
  const codeInput = qzEl('quizJoinCode');
  if(codeInput){
    codeInput.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    codeInput.addEventListener('keydown', e => { if(e.key === 'Enter') joinQuizRoom(); });
  }
});
