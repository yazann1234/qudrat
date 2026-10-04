/* ============================================================
   29) QUIZ — لعبة الكاهوت
============================================================ */

const QZ = {
  session: null,
  players: [],
  questions: [],
  currentQuestion: null,
  currentIndex: 0,
  myAnswer: null,
  answerTimer: null,
  timerInterval: null,
  channel: null,
  isHost: false,
  answerStartTime: 0,
  isRevealing: false,
  finalScores: []
};

/* ================== توليد رمز الغرفة ================== */
function generateRoomCode(){
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ================== التهيئة ================== */
function initQuiz(){
  renderQuizMyStats();
  renderAdminQuizQuestions();
  bindQuizEvents();
}
window.initQuiz = initQuiz;

/* ================== إحصائياتي ================== */
function renderQuizMyStats(){
  const box = document.getElementById('quizMyStats');
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

/* ================== إنشاء غرفة ================== */
async function createQuizRoom(){
  if(!currentUserObj){ toast('سجل الدخول أولاً', 'warn'); return; }
  if(!isSubscribed()){ toast('تحتاج اشتراكاً مفعّلاً', 'warn'); return; }

  const totalQ = parseInt(document.getElementById('quizTotalQuestions').value, 10) || 20;
  const seconds = parseInt(document.getElementById('quizSeconds').value, 10) || 20;

  /* تحقق من وجود أسئلة كافية */
  const { data: qs, error: qErr } = await sb.from('quiz_questions').select('id').limit(totalQ);
  if(qErr){ toast('فشل جلب الأسئلة: ' + qErr.message, 'err'); return; }
  if(!qs || qs.length < 5){ toast('يجب إضافة 5 أسئلة على الأقل في لوحة الأدمن', 'warn'); return; }

  const roomCode = generateRoomCode();

  try{
    const { data, error } = await sb.from('quiz_sessions').insert({
      room_code: roomCode,
      host_id: currentUserObj.id,
      total_questions: Math.min(totalQ, qs.length),
      question_seconds: seconds,
      status: 'waiting'
    }).select().single();

    if(error){ toast('فشل إنشاء الغرفة: ' + error.message, 'err'); return; }

    QZ.session = data;
    QZ.isHost = true;

    /* أضف نفسك كلاعب */
    await addPlayerToSession(roomCode, currentUserObj.id, currentUserObj.name, currentUserObj.avatar_url);

    showQuizWaitingRoom();
    subscribeQuizRoom(roomCode);
  }catch(e){
    toast('خطأ: ' + e.message, 'err');
  }
}
window.createQuizRoom = createQuizRoom;

/* ================== الانضمام لغرفة ================== */
async function joinQuizRoom(){
  if(!currentUserObj){ toast('سجل الدخول أولاً', 'warn'); return; }
  if(!isSubscribed()){ toast('تحتاج اشتراكاً مفعّلاً', 'warn'); return; }

  const code = document.getElementById('quizJoinCode').value.trim();
  if(!code || code.length !== 6){ toast('أدخل رمز غرفة صحيح (6 أرقام)', 'warn'); return; }

  const { data, error } = await sb.from('quiz_sessions')
    .select('*').eq('room_code', code).eq('status', 'waiting').maybeSingle();

  if(error || !data){ toast('الغرفة غير موجودة أو بدأت بالفعل', 'err'); return; }

  /* تحقق من عدد اللاعبين */
  const { data: players } = await sb.from('quiz_players').select('user_id').eq('session_id', data.id);
  if(players && players.length >= data.max_players){
    toast('الغرفة ممتلئة', 'warn'); return;
  }

  QZ.session = data;
  QZ.isHost = data.host_id === currentUserObj.id;

  await addPlayerToSession(code, currentUserObj.id, currentUserObj.name, currentUserObj.avatar_url);

  showQuizWaitingRoom();
  subscribeQuizRoom(code);
}
window.joinQuizRoom = joinQuizRoom;

async function addPlayerToSession(roomCode, userId, name, avatar){
  const { data: sessionData } = await sb.from('quiz_sessions').select('id').eq('room_code', roomCode).single();
  if(!sessionData) return;

  await sb.from('quiz_players').upsert({
    session_id: sessionData.id,
    user_id: userId,
    name: name || 'لاعب',
    avatar_url: avatar || null,
    score: 0,
    correct_count: 0
  }, { onConflict: 'session_id,user_id' });
}

/* ================== غرفة الانتظار ================== */
function showQuizWaitingRoom(){
  document.getElementById('quizLobby').style.display = 'none';
  document.getElementById('quizWaitingRoom').style.display = 'block';
  document.getElementById('quizGameScreen').style.display = 'none';
  document.getElementById('quizFinalResults').style.display = 'none';

  const display = document.getElementById('quizRoomCodeDisplay');
  if(display) display.textContent = QZ.session.room_code;

  loadQuizPlayers();
}

async function loadQuizPlayers(){
  if(!QZ.session) return;
  const { data } = await sb.from('quiz_players').select('*').eq('session_id', QZ.session.id).order('joined_at', { ascending: true });
  QZ.players = data || [];
  renderQuizPlayers();
}

function renderQuizPlayers(){
  const grid = document.getElementById('quizPlayersGrid');
  if(!grid) return;

  const max = QZ.session.max_players || 4;
  let html = '';

  QZ.players.forEach(p => {
    const isMe = p.user_id === currentUserObj.id;
    const isHost = p.user_id === QZ.session.host_id;
    const initial = String(p.name || '؟').charAt(0);
    const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
    html += `
      <div class="quiz-player-card ${isMe ? 'me' : ''} ${isHost ? 'host' : ''}">
        <div class="quiz-player-avatar" style="${av}">${av ? '' : initial}</div>
        <div class="quiz-player-name">${escapeHtml(p.name)}</div>
        <div class="quiz-player-status"><i class="fas fa-check-circle"></i> جاهز</div>
      </div>`;
  });

  for(let i = QZ.players.length; i < max; i++){
    html += `<div class="quiz-player-empty"><div><i class="fas fa-user-plus"></i><br><span>في انتظار لاعب</span></div></div>`;
  }

  grid.innerHTML = html;

  const countEl = document.getElementById('quizPlayersCount');
  if(countEl) countEl.textContent = `${QZ.players.length} من ${max} لاعبين`;

  /* أظهر زر البدء للمضيف */
  const startBtn = document.getElementById('quizStartBtn');
  if(startBtn){
    if(QZ.isHost && QZ.players.length >= 2){
      startBtn.style.display = 'inline-flex';
    } else if(QZ.isHost && QZ.players.length < 2){
      startBtn.style.display = 'inline-flex';
      startBtn.disabled = QZ.players.length < 2;
      startBtn.title = QZ.players.length < 2 ? 'يجب وجود لاعبَين على الأقل' : '';
    } else {
      startBtn.style.display = 'none';
    }
  }
}

/* ================== بدء اللعبة ================== */
async function startQuizGame(){
  if(!QZ.isHost){ toast('المضيف فقط يبدأ اللعبة', 'warn'); return; }
  if(QZ.players.length < 2){ toast('يجب وجود لاعبَين على الأقل', 'warn'); return; }

  const total = QZ.session.total_questions || 20;

  /* جلب أسئلة عشوائية */
  const { data: allQs, error } = await sb.from('quiz_questions').select('id').limit(100);
  if(error || !allQs || allQs.length < 5){ toast('أسئلة غير كافية', 'err'); return; }

  /* خلط عشوائي */
  const shuffled = [...allQs].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(total, shuffled.length)).map(q => q.id);

  /* ابدأ */
  const { error: upErr } = await sb.from('quiz_sessions').update({
    status: 'playing',
    question_ids: selected,
    current_index: 0
  }).eq('id', QZ.session.id);

  if(upErr){ toast('فشل بدء اللعبة', 'err'); return; }
}

/* ================== الاشتراك في الغرفة ================== */
function subscribeQuizRoom(roomCode){
  if(QZ.channel){
    try{ sb.removeChannel(QZ.channel); }catch(e){}
  }

  QZ.channel = sb.channel('quiz-room-' + roomCode + '-' + Date.now())
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'quiz_players',
      filter: 'session_id=eq.' + QZ.session.id
    }, () => {
      loadQuizPlayers();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'quiz_sessions',
      filter: 'id=eq.' + QZ.session.id
    }, payload => {
      handleSessionUpdate(payload.new);
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'quiz_answers',
      filter: 'session_id=eq.' + QZ.session.id
    }, () => {
      /* تحديث عدد الأجوبة */
      loadQuizAnswersCount();
    })
    .subscribe();
}

async function handleSessionUpdate(newSession){
  if(!newSession) return;
  const oldStatus = QZ.session.status;
  const oldIndex = QZ.session.current_index;
  QZ.session = newSession;

  if(oldStatus !== 'playing' && newSession.status === 'playing'){
    /* بدأت اللعبة */
    await beginQuizPlay();
  } else if(oldStatus === 'playing' && newSession.current_index !== oldIndex){
    /* سؤال جديد */
    await loadNextQuestion();
  } else if(newSession.status === 'finished' && oldStatus !== 'finished'){
    showQuizFinalResults();
  }
}

/* ================== بدء اللعب ================== */
async function beginQuizPlay(){
  document.getElementById('quizLobby').style.display = 'none';
  document.getElementById('quizWaitingRoom').style.display = 'none';
  document.getElementById('quizGameScreen').style.display = 'block';
  document.getElementById('quizFinalResults').style.display = 'none';

  /* جلب الأسئلة */
  const ids = QZ.session.question_ids || [];
  if(!ids.length){ toast('لا توجد أسئلة', 'err'); return; }

  const { data, error } = await sb.from('quiz_questions').select('*').in('id', ids);
  if(error){ toast('فشل جلب الأسئلة', 'err'); return; }

  /* رتبها حسب question_ids */
  QZ.questions = ids.map(id => data.find(q => q.id === id)).filter(Boolean);
  QZ.currentIndex = 0;

  await loadQuestionByIndex(0);
}

async function loadNextQuestion(){
  QZ.currentIndex = QZ.session.current_index;
  await loadQuestionByIndex(QZ.currentIndex);
}

/* ================== تحميل سؤال ================== */
async function loadQuestionByIndex(idx){
  if(idx >= QZ.questions.length){
    /* انتهت الأسئلة */
    return;
  }

  QZ.currentQuestion = QZ.questions[idx];
  QZ.myAnswer = null;
  QZ.isRevealing = false;
  QZ.answerStartTime = Date.now();

  /* واجهة */
  const qNum = document.getElementById('quizQNum'); if(qNum) qNum.textContent = idx + 1;
  const qTotal = document.getElementById('quizQTotal'); if(qTotal) qTotal.textContent = QZ.questions.length;
  const cat = document.getElementById('quizCategory'); if(cat) cat.textContent = QZ.currentQuestion.category || 'عام';
  const qText = document.getElementById('quizQuestionText'); if(qText) qText.textContent = QZ.currentQuestion.question;

  /* الأجوبة */
  renderQuizAnswers(QZ.currentQuestion.answers, null);
  document.getElementById('quizRevealBox').style.display = 'none';

  /* العداد */
  startQuizTimer(QZ.session.question_seconds || 20);

  /* تحديث اللوحة السفلية */
  await loadQuizAnswersCount();
}

function renderQuizAnswers(answers, selectedIdx){
  const grid = document.getElementById('quizAnswersGrid');
  if(!grid) return;

  const icons = ['A', 'B', 'C', 'D'];
  grid.innerHTML = answers.map((ans, i) => `
    <button class="quiz-answer-btn ${selectedIdx === i ? 'selected' : ''}" data-idx="${i}"
      ${QZ.myAnswer !== null || QZ.isRevealing ? 'disabled' : ''}
      onclick="submitQuizAnswer(${i})">
      <span class="quiz-answer-icon">${icons[i]}</span>
      <span>${escapeHtml(ans)}</span>
    </button>
  `).join('');
}

/* ================== العداد ================== */
function startQuizTimer(seconds){
  stopQuizTimer();

  const ring = document.getElementById('quizTimerRing');
  const num = document.getElementById('quizTimerNum');
  if(!ring || !num) return;

  const total = seconds;
  const circumference = 188.5;

  let remaining = seconds;
  num.textContent = remaining;
  num.classList.remove('warning');
  ring.style.strokeDashoffset = '0';

  QZ.timerInterval = setInterval(() => {
    remaining--;
    num.textContent = Math.max(0, remaining);
    ring.style.strokeDashoffset = ((total - remaining) / total) * circumference;

    if(remaining <= 5) num.classList.add('warning');

    if(remaining <= 0){
      stopQuizTimer();
      handleTimerEnd();
    }
  }, 1000);
}

function stopQuizTimer(){
  if(QZ.timerInterval){
    clearInterval(QZ.timerInterval);
    QZ.timerInterval = null;
  }
}

/* ================== نهاية الوقت ================== */
async function handleTimerEnd(){
  if(QZ.isRevealing) return;
  QZ.isRevealing = true;

  /* المضيف يكشف الإجابات ويرسل تحديث */
  if(QZ.isHost){
    await sb.from('quiz_sessions').update({
      status: 'revealing'
    }).eq('id', QZ.session.id);

    /* احسب النقاط */
    await calculateAndAwardPoints();
  }

  /* أظهر الكشف */
  await revealQuizAnswer();
}

/* ================== إرسال جواب ================== */
async function submitQuizAnswer(idx){
  if(QZ.myAnswer !== null) return;
  if(QZ.isRevealing) return;

  QZ.myAnswer = idx;

  /* عطّل الأزرار */
  document.querySelectorAll('.quiz-answer-btn').forEach(b => {
    b.disabled = true;
    if(parseInt(b.dataset.idx, 10) === idx) b.classList.add('selected');
  });

  /* احسب الوقت المستغرق */
  const timeSpent = (Date.now() - QZ.answerStartTime) / 1000;
  const isCorrect = idx === QZ.currentQuestion.correct_index;

  /* احفظ */
  try{
    await sb.from('quiz_answers').insert({
      session_id: QZ.session.id,
      question_id: QZ.currentQuestion.id,
      user_id: currentUserObj.id,
      answer_index: idx,
      is_correct: isCorrect
    });
  }catch(e){ console.warn('answer save failed', e); }

  /* نبّه إذا كان مضيفاً - ينتظر النهاية */
  if(QZ.isHost){
    /* افحص هل الكل أجاب */
    const allAnswered = await checkAllPlayersAnswered();
    if(allAnswered){
      stopQuizTimer();
      setTimeout(() => handleTimerEnd(), 500);
    }
  }
}
window.submitQuizAnswer = submitQuizAnswer;

async function checkAllPlayersAnswered(){
  const { data: answers } = await sb.from('quiz_answers')
    .select('user_id')
    .eq('session_id', QZ.session.id)
    .eq('question_id', QZ.currentQuestion.id);

  return (answers || []).length >= QZ.players.length;
}

/* ================== حساب النقاط ================== */
async function calculateAndAwardPoints(){
  const { data: answers } = await sb.from('quiz_answers')
    .select('*')
    .eq('session_id', QZ.session.id)
    .eq('question_id', QZ.currentQuestion.id);

  /* من أجاب صح */
  const correctAnswers = (answers || []).filter(a => a.is_correct);

  for(const ans of correctAnswers){
    const player = QZ.players.find(p => p.user_id === ans.user_id);
    if(!player) continue;

    /* نقاط أساسية + مكافأة سرعة */
    const timeSpent = (new Date(ans.answered_at) - new Date(QZ.session.question_started_at || QZ.answerStartTime)) / 1000;
    const maxTime = QZ.session.question_seconds || 20;
    const speedBonus = Math.max(0, Math.round((maxTime - timeSpent) * 5));

    const points = 100 + speedBonus;

    await sb.from('quiz_players').update({
      score: (player.score || 0) + points,
      correct_count: (player.correct_count || 0) + 1
    }).eq('session_id', QZ.session.id).eq('user_id', ans.user_id);
  }
}

/* ================== الكشف ================== */
async function revealQuizAnswer(){
  const correctIdx = QZ.currentQuestion.correct_index;

  /* حدّد الأزرار */
  document.querySelectorAll('.quiz-answer-btn').forEach(b => {
    b.disabled = true;
    const idx = parseInt(b.dataset.idx, 10);
    if(idx === correctIdx) b.classList.add('correct');
    else if(idx === QZ.myAnswer) b.classList.add('wrong');
  });

  /* صندوق الكشف */
  const revealBox = document.getElementById('quizRevealBox');
  if(revealBox){
    revealBox.innerHTML = `
      <div class="quiz-reveal-header">
        <i class="fas fa-check-circle"></i>
        <span>الإجابة الصحيحة: <b style="color:var(--success)">${escapeHtml(QZ.currentQuestion.answers[correctIdx])}</b></span>
      </div>
      <div id="quizRevealPlayers"></div>
    `;
    revealBox.style.display = 'block';
  }

  /* اجلب الأجوبة */
  const { data: answers } = await sb.from('quiz_answers')
    .select('*')
    .eq('session_id', QZ.session.id)
    .eq('question_id', QZ.currentQuestion.id);

  /* اجلب اللاعبين */
  await loadQuizPlayers();

  /* اعرض نتائج كل لاعب */
  renderQuizRevealPlayers(answers || [], correctIdx);

  /* زر التالي للمضيف */
  if(QZ.isHost){
    const nextBtn = document.createElement('div');
    nextBtn.style.marginTop = '16px';
    nextBtn.innerHTML = `
      <button class="btn btn-primary" onclick="nextQuizQuestion()" style="width:100%;padding:14px">
        <i class="fas fa-arrow-left"></i> السؤال التالي
      </button>
    `;
    revealBox.appendChild(nextBtn);
  }
}

function renderQuizRevealPlayers(answers, correctIdx){
  const box = document.getElementById('quizRevealPlayers');
  if(!box) return;

  const html = QZ.players.map(p => {
    const ans = answers.find(a => a.user_id === p.user_id);
    const isCorrect = ans && ans.is_correct;
    const initial = String(p.name || '؟').charAt(0);
    const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';

    return `
      <div class="quiz-player-score-row ${isCorrect ? 'correct' : (ans ? 'wrong' : '')}" style="margin-top:8px">
        <div class="av" style="${av}">${av ? '' : initial}</div>
        <div class="info">
          <b>${escapeHtml(p.name)}</b>
          <small>${ans ? (isCorrect ? '✓ إجابة صحيحة' : '✗ إجابة خاطئة') : '⏰ لم يجب'}</small>
        </div>
        ${isCorrect ? '<span class="badge-correct">+100</span>' : ''}
        <div class="score">${p.score || 0}</div>
      </div>
    `;
  }).join('');

  box.innerHTML = html;
}

/* ================== السؤال التالي ================== */
async function nextQuizQuestion(){
  if(!QZ.isHost) return;

  const nextIdx = QZ.currentIndex + 1;

  if(nextIdx >= QZ.questions.length){
    /* انتهت اللعبة */
    await endQuizGame();
    return;
  }

  await sb.from('quiz_sessions').update({
    current_index: nextIdx,
    status: 'playing',
    question_started_at: new Date().toISOString()
  }).eq('id', QZ.session.id);
}
window.nextQuizQuestion = nextQuizQuestion;

/* ================== نهاية اللعبة ================== */
async function endQuizGame(){
  await sb.from('quiz_sessions').update({
    status: 'finished'
  }).eq('id', QZ.session.id);

  /* امنح XP للفائز */
  await awardQuizWinner();

  /* حدّث الإحصائيات */
  await updateQuizStats();
}

async function awardQuizWinner(){
  await loadQuizPlayers();
  if(!QZ.players.length) return;

  /* رتّب حسب النقاط */
  const sorted = [...QZ.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sorted[0];

  if(!winner) return;

  /* امنح XP للفائز: 200 + نقاطه/5 */
  const xpReward = 200 + Math.round((winner.score || 0) / 5);

  if(winner.user_id === currentUserObj.id){
    userData.extraXp = (userData.extraXp || 0) + xpReward;
    savePrefs();
    toast(`🏆 فزت! +${xpReward} XP`, 'ok');
  }

  /* حدّث البروفايل */
  try{
    const { data: profile } = await sb.from('profiles').select('*').eq('id', winner.user_id).single();
    if(profile){
      await sb.from('profiles').update({
        kahoot_wins: (profile.kahoot_wins || 0) + 1,
        kahoot_total_score: (profile.kahoot_total_score || 0) + (winner.score || 0)
      }).eq('id', winner.user_id);
    }
  }catch(e){}

  /* حدّث للجميع */
  for(const p of QZ.players){
    try{
      const { data: prof } = await sb.from('profiles').select('kahoot_games, kahoot_total_score').eq('id', p.user_id).single();
      if(prof){
        await sb.from('profiles').update({
          kahoot_games: (prof.kahoot_games || 0) + 1,
          kahoot_total_score: (prof.kahoot_total_score || 0) + (p.score || 0)
        }).eq('id', p.user_id);
      }
    }catch(e){}
  }

  if(typeof syncMyXp === 'function') syncMyXp();
}

async function updateQuizStats(){
  try{
    const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUserObj.id).single();
    if(profile){
      currentUserObj = Object.assign({}, currentUserObj, profile);
    }
  }catch(e){}
  renderQuizMyStats();
}

/* ================== عرض النتائج النهائية ================== */
async function showQuizFinalResults(){
  document.getElementById('quizLobby').style.display = 'none';
  document.getElementById('quizWaitingRoom').style.display = 'none';
  document.getElementById('quizGameScreen').style.display = 'none';
  document.getElementById('quizFinalResults').style.display = 'block';

  await loadQuizPlayers();
  const sorted = [...QZ.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  QZ.finalScores = sorted;

  const winner = sorted[0];
  if(winner){
    const isMe = winner.user_id === currentUserObj.id;
    document.getElementById('quizFinalTitle').textContent = isMe ? '🏆 مبروك! فزت!' : `🏆 الفائز: ${winner.name}`;
    document.getElementById('quizFinalSubtitle').textContent = `${winner.correct_count || 0} إجابة صحيحة • ${winner.score || 0} نقطة`;
  }

  const list = document.getElementById('quizFinalList');
  if(list){
    list.innerHTML = sorted.map((p, i) => {
      const rank = i + 1;
      const rankCls = rank <= 3 ? `rank${rank}` : '';
      const initial = String(p.name || '؟').charAt(0);
      const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
      const isMe = p.user_id === currentUserObj.id;

      return `
        <div class="quiz-final-row ${rankCls}">
          <div class="quiz-final-rank">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
          <div class="quiz-final-av" style="${av}">${av ? '' : initial}</div>
          <div class="quiz-final-info">
            <b>${escapeHtml(p.name)} ${isMe ? '(أنت)' : ''}</b>
            <small>${p.correct_count || 0} إجابة صحيحة من ${QZ.questions.length}</small>
          </div>
          <div class="quiz-final-score">${p.score || 0}<small>نقطة</small></div>
        </div>
      `;
    }).join('');
  }
}

/* ================== العودة للوبي ================== */
async function backToQuizLobby(){
  if(QZ.channel){
    try{ sb.removeChannel(QZ.channel); }catch(e){}
    QZ.channel = null;
  }

  /* غادر الغرفة إذا كنت فيها */
  if(QZ.session && !QZ.isHost){
    try{
      await sb.from('quiz_players').delete().eq('session_id', QZ.session.id).eq('user_id', currentUserObj.id);
    }catch(e){}
  }

  QZ.session = null;
  QZ.players = [];
  QZ.questions = [];
  QZ.currentQuestion = null;
  QZ.myAnswer = null;
  QZ.isRevealing = false;

  document.getElementById('quizLobby').style.display = 'block';
  document.getElementById('quizWaitingRoom').style.display = 'none';
  document.getElementById('quizGameScreen').style.display = 'none';
  document.getElementById('quizFinalResults').style.display = 'none';
  document.getElementById('quizJoinCode').value = '';

  renderQuizMyStats();
}
window.backToQuizLobby = backToQuizLobby;

/* ================== مغادرة الغرفة ================== */
async function leaveQuizRoom(){
  if(!QZ.session) return;

  if(QZ.isHost){
    /* المضيف يغادر → احذف الجلسة */
    try{ await sb.from('quiz_sessions').delete().eq('id', QZ.session.id); }catch(e){}
  } else {
    try{ await sb.from('quiz_players').delete().eq('session_id', QZ.session.id).eq('user_id', currentUserObj.id); }catch(e){}
  }

  backToQuizLobby();
}
window.leaveQuizRoom = leaveQuizRoom;

function copyQuizCode(){
  if(!QZ.session) return;
  try{
    navigator.clipboard.writeText(QZ.session.room_code);
    toast('✓ تم نسخ رمز الغرفة', 'ok');
  }catch(e){ toast('تعذّر النسخ', 'err'); }
}
window.copyQuizCode = copyQuizCode;

/* ================== عداد الأجوبة ================== */
async function loadQuizAnswersCount(){
  if(!QZ.session || !QZ.currentQuestion) return;
  const { data } = await sb.from('quiz_answers')
    .select('user_id')
    .eq('session_id', QZ.session.id)
    .eq('question_id', QZ.currentQuestion.id);

  const count = (data || []).length;
  updateQuizPlayersBar(count);
}

function updateQuizPlayersBar(answeredCount){
  const bar = document.getElementById('quizPlayersBar');
  if(!bar) return;

  const html = QZ.players.map(p => {
    const initial = String(p.name || '؟').charAt(0);
    const av = p.avatar_url ? `background-image:url('${p.avatar_url}')` : '';
    return `
      <div class="quiz-player-score-row">
        <div class="av" style="${av}">${av ? '' : initial}</div>
        <div class="info">
          <b>${escapeHtml(p.name)}</b>
          <small>${p.correct_count || 0} إجابة صحيحة</small>
        </div>
        <div class="score">${p.score || 0}</div>
      </div>
    `;
  }).join('');

  bar.innerHTML = html;
}

/* ============================================================
   لوحة الأدمن — إدارة الأسئلة
============================================================ */
function renderAdminQuizQuestions(){
  const grid = document.getElementById('adminQuizGrid');
  if(!grid) return;

  sb.from('quiz_questions').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if(error){ grid.innerHTML = '<div class="admin-empty">فشل التحميل</div>'; return; }

    const count = document.getElementById('quizQuestionsCount');
    if(count) count.textContent = (data || []).length;

    if(!data || !data.length){
      grid.innerHTML = `
        <div class="admin-empty" style="grid-column:1/-1">
          <div class="em-ic"><i class="fas fa-question-circle"></i></div>
          <h3>لا توجد أسئلة</h3>
          <p>اضغط «سؤال جديد» لإضافة أول سؤال</p>
        </div>`;
      return;
    }

    const icons = ['A','B','C','D'];
    grid.innerHTML = data.map(q => {
      const answers = q.answers || [];
      const correct = q.correct_index;
      return `
        <div class="quiz-admin-card">
          <div class="category-badge">${escapeHtml(q.category || 'عام')}</div>
          <h4>${escapeHtml(q.question)}</h4>
          <div class="answers-list">
            ${answers.map((a, i) => `
              <div class="ans ${i === correct ? 'correct' : ''}">
                <span style="font-weight:900;color:var(--muted)">${icons[i]}.</span>
                <span>${escapeHtml(a)}</span>
              </div>
            `).join('')}
          </div>
          <div class="quiz-admin-actions">
            <button class="btn btn-ghost btn-sm" onclick="adminEditQuestion('${q.id}')">
              <i class="fas fa-pen"></i> تعديل
            </button>
            <button class="btn btn-danger btn-sm" onclick="adminDeleteQuestion('${q.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  });
}
window.renderAdminQuizQuestions = renderAdminQuizQuestions;

window.adminNewQuestion = () => {
  document.getElementById('quizFormTitle').textContent = 'إضافة سؤال جديد';
  document.getElementById('qqId').value = '';
  document.getElementById('qqQuestion').value = '';
  document.querySelectorAll('.quiz-answer-field').forEach((f, i) => { f.value = ''; });
  document.querySelector('input[name="qqCorrect"][value="0"]').checked = true;
  document.getElementById('qqCategory').value = 'عام';
  document.getElementById('qqDifficulty').value = 'medium';

  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="addquiz"]');
  if(tab) tab.classList.add('on');
  const panel = document.getElementById('panel-addquiz');
  if(panel) panel.classList.add('on');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.adminEditQuestion = async id => {
  const { data: q } = await sb.from('quiz_questions').select('*').eq('id', id).single();
  if(!q) return;

  document.getElementById('quizFormTitle').textContent = 'تعديل السؤال';
  document.getElementById('qqId').value = q.id;
  document.getElementById('qqQuestion').value = q.question;
  const answers = q.answers || [];
  document.querySelectorAll('.quiz-answer-field').forEach((f, i) => { f.value = answers[i] || ''; });
  document.querySelector(`input[name="qqCorrect"][value="${q.correct_index}"]`).checked = true;
  document.getElementById('qqCategory').value = q.category || 'عام';
  document.getElementById('qqDifficulty').value = q.difficulty || 'medium';

  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const tab = document.querySelector('.admin-tabs button[data-panel="addquiz"]');
  if(tab) tab.classList.add('on');
  const panel = document.getElementById('panel-addquiz');
  if(panel) panel.classList.add('on');
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
  const panel = document.getElementById('panel-quiz');
  if(panel) panel.classList.add('on');
};

window.bulkAddQuestions = () => {
  openModal({
    title: 'إضافة أسئلة جماعية',
    text: 'أدخل سؤالاً واحداً في كل سطر بالصيغة: السؤال | جواب1 | جواب2 | جواب3 | جواب4 | رقم_الجواب_الصحيح (1-4)',
    bodyHTML: `
      <div class="form-group">
        <textarea id="bulkQuestionsInput" placeholder="ما ناتج ٢ + ٢؟ | ٢ | ٣ | ٤ | ٥ | 3&#10;ما عاصمة السعودية؟ | الرياض | جدة | الدمام | مكة | 1" style="min-height:200px;font-family:monospace;direction:rtl"></textarea>
      </div>
      <small style="color:var(--muted);font-size:.76rem;display:block;line-height:1.7">رقم الجواب الصحيح: 1 للأول، 2 للثاني، 3 للثالث، 4 للرابع</small>
    `,
    okText: 'إضافة الكل',
    onOk: async () => {
      const text = document.getElementById('bulkQuestionsInput').value.trim();
      if(!text){ toast('الصق الأسئلة', 'warn'); return; }

      const lines = text.split('\n').filter(l => l.trim());
      const questions = [];
      const errors = [];

      for(let i = 0; i < lines.length; i++){
        const parts = lines[i].split('|').map(p => p.trim());
        if(parts.length < 6){
          errors.push(`سطر ${i+1}: يحتاج 6 أجزاء`);
          continue;
        }
        const correctIdx = parseInt(parts[5], 10) - 1;
        if(correctIdx < 0 || correctIdx > 3){
          errors.push(`سطر ${i+1}: رقم الجواب يجب أن يكون 1-4`);
          continue;
        }
        questions.push({
          question: parts[0],
          answers: [parts[1], parts[2], parts[3], parts[4]],
          correct_index: correctIdx,
          category: 'عام',
          difficulty: 'medium',
          created_by: currentUserObj.id
        });
      }

      if(questions.length){
        const { error } = await sb.from('quiz_questions').insert(questions);
        if(error){ toast('فشل الإضافة: ' + error.message, 'err'); return; }
        toast(`✓ تمت إضافة ${questions.length} سؤال`, 'ok');
        renderAdminQuizQuestions();
      }
      if(errors.length) toast(`${errors.length} سطر فشل`, 'warn');
    }
  });
};

/* حفظ السؤال */
function saveQuizQuestion(){
  return async () => {
    if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }

    const id = document.getElementById('qqId').value;
    const question = document.getElementById('qqQuestion').value.trim();
    const answers = Array.from(document.querySelectorAll('.quiz-answer-field')).map(f => f.value.trim());
    const correctIdx = parseInt(document.querySelector('input[name="qqCorrect"]:checked').value, 10);
    const category = document.getElementById('qqCategory').value;
    const difficulty = document.getElementById('qqDifficulty').value;

    if(!question){ toast('أدخل السؤال', 'warn'); return; }
    if(answers.some(a => !a)){ toast('أدخل جميع الأجوبة الأربعة', 'warn'); return; }

    const payload = {
      question,
      answers,
      correct_index: correctIdx,
      category,
      difficulty,
      created_by: currentUserObj.id
    };

    const btn = document.getElementById('qqSave');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    let error;
    if(id){
      const r = await sb.from('quiz_questions').update(payload).eq('id', id);
      error = r.error;
    } else {
      const r = await sb.from('quiz_questions').insert(payload);
      error = r.error;
    }

    btn.disabled = false;
    btn.innerHTML = orig;

    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    toast(id ? '✓ تم تحديث السؤال' : '✓ تم إضافة السؤال', 'ok');
    renderAdminQuizQuestions();
    backToQuizQuestionsList();
  };
}

/* ================== ربط الأحداث ================== */
function bindQuizEvents(){
  const saveBtn = document.getElementById('qqSave');
  if(saveBtn && !saveBtn.dataset.bound){
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', saveQuizQuestion());
  }
}

/* ================== تحميل التبويب ================== */
document.addEventListener('DOMContentLoaded', () => {
  /* ربط زر الكاهوت في القائمة */
  const quizNavBtn = document.querySelector('.nav-btn[data-view="quiz"]');
  if(quizNavBtn){
    quizNavBtn.addEventListener('click', () => {
      if(typeof QZ !== 'undefined') initQuiz();
    });
  }

  /* مسح رمز الغرفة عند الكتابة */
  const codeInput = document.getElementById('quizJoinCode');
  if(codeInput){
    codeInput.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  }
});

window.initQuiz = initQuiz;
