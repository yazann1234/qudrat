/* ============================================================
   24) AI — المساعد الذكي (Gemini)
============================================================ */

const AI_CHAT_URL = SUPABASE_URL + '/functions/v1/ai-chat';

const AI = {
  open: false,
  sending: false,
  history: [],        // { role: 'user'|'assistant', content: '...' }
  fileContext: null,  // { fileId, fileTitle, fileCategory, currentPage, totalPages }
  panel: null,
  bodyEl: null,
  inputEl: null,
  fab: null
};

/* ================== تهيئة ================== */
function initAI(){
  AI.panel = document.getElementById('aiChatPanel');
  AI.bodyEl = document.getElementById('aiChatBody');
  AI.inputEl = document.getElementById('aiChatInput');
  AI.fab = document.getElementById('aiFabBtn');

  if(!AI.panel || !AI.bodyEl || !AI.inputEl) return;

  /* فتح/إغلاق */
  if(AI.fab) AI.fab.addEventListener('click', toggleAIChat);
  const closeBtn = document.getElementById('aiChatClose');
  if(closeBtn) closeBtn.addEventListener('click', closeAIChat);

  /* إرسال */
  const sendBtn = document.getElementById('aiChatSend');
  if(sendBtn) sendBtn.addEventListener('click', () => sendAIMessage());

  /* Enter للإرسال */
  AI.inputEl.addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendAIMessage(); }
  });

  /* اقتراحات سريعة */
  const suggestions = document.getElementById('aiChatSuggestions');
  if(suggestions){
    suggestions.querySelectorAll('button[data-q]').forEach(b => {
      b.addEventListener('click', () => {
        AI.inputEl.value = b.dataset.q;
        sendAIMessage();
      });
    });
  }

  /* عدّل ارتفاع textarea تلقائياً */
  AI.inputEl.addEventListener('input', () => {
    AI.inputEl.style.height = 'auto';
    AI.inputEl.style.height = Math.min(120, AI.inputEl.scrollHeight) + 'px';
  });

  /* رسالة ترحيب أولى */
  if(!AI.history.length){
    showAIMessage('assistant', 'أهلاً بك في منصة العباقرة للقدرات 🌸\nأنا "العبقري" — مساعدك الذكي الخاص بالمنصة.\n\nكيف أقدر أساعدك اليوم؟\nاسألني عن:\n• كيفية استخدام أي قسم\n• كيف أزيد نقاطي\n• حل أي مشكلة تواجهك\n• شرح ميزات القارئ والفيديو\n\nجرب الاقتراحات بالأسفل 👇');
  }

  /* ربط زر المساعدة في القارئ */
  const rdAiHelp = document.getElementById('rdAiHelp');
  if(rdAiHelp){
    rdAiHelp.addEventListener('click', openFileAiHelp);
  }
}
window.initAI = initAI;

/* ================== فتح/إغلاق ================== */
function toggleAIChat(){
  if(AI.open) closeAIChat(); else openAIChat();
}
function openAIChat(){
  AI.open = true;
  AI.panel.classList.add('open');
  if(AI.fab) AI.fab.classList.add('hidden');
  setTimeout(() => { if(AI.inputEl) AI.inputEl.focus(); }, 300);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}
function closeAIChat(){
  AI.open = false;
  AI.panel.classList.remove('open');
  if(AI.fab) AI.fab.classList.remove('hidden');
}

/* ================== عرض رسالة ================== */
function showAIMessage(role, content){
  const div = document.createElement('div');
  div.className = 'ai-msg ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'ai-msg-avatar ' + (role === 'user' ? 'user' : 'bot');
  avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'ai-msg-bubble';
  bubble.textContent = content;

  div.appendChild(avatar);
  div.appendChild(bubble);
  AI.bodyEl.appendChild(div);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}

function showAITyping(){
  const div = document.createElement('div');
  div.className = 'ai-msg assistant';
  div.id = 'aiTypingIndicator';
  div.innerHTML = `
    <div class="ai-msg-avatar bot"><i class="fas fa-robot"></i></div>
    <div class="ai-typing"><span></span><span></span><span></span></div>
  `;
  AI.bodyEl.appendChild(div);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}
function hideAITyping(){
  const el = document.getElementById('aiTypingIndicator');
  if(el) el.remove();
}

/* ================== إرسال ================== */
async function sendAIMessage(textOverride){
  if(AI.sending) return;
  const text = (textOverride || AI.inputEl.value || '').trim();
  if(!text) return;

  AI.sending = true;
  AI.inputEl.value = '';
  AI.inputEl.style.height = 'auto';

  /* أضف رسالة المستخدم */
  showAIMessage('user', text);
  AI.history.push({ role: 'user', content: text });

  /* مؤشر الكتابة */
  showAITyping();

  /* عطّل الزر */
  const sendBtn = document.getElementById('aiChatSend');
  if(sendBtn) sendBtn.disabled = true;

  try{
    const { data: { session: s } } = await sb.auth.getSession();
    const token = s ? s.access_token : '';

    const res = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        messages: AI.history.slice(-12),
        context: AI.fileContext || null
      })
    });

    hideAITyping();

    if(!res.ok){
      let errMsg = 'تعذر الاتصال بالذكاء الاصطناعي';
      try{ const j = await res.json(); errMsg = j.error || errMsg; }catch(e){}
      showAIMessage('assistant', '⚠️ ' + errMsg + '\n\nحاول مرة أخرى بعد قليل.');
      AI.sending = false;
      if(sendBtn) sendBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const reply = data.reply || 'عذراً، لم أفهم. حاول مرة أخرى 🌸';

    showAIMessage('assistant', reply);
    AI.history.push({ role: 'assistant', content: reply });

    if(AI.history.length > 30){
      AI.history = AI.history.slice(-30);
    }

  }catch(e){
    hideAITyping();
    showAIMessage('assistant', '⚠️ حدث خطأ في الاتصال.\nتأكد من الإنترنت وحاول مرة أخرى.');
    console.warn('AI send error:', e);
  }

  AI.sending = false;
  if(sendBtn) sendBtn.disabled = false;
}
window.sendAIMessage = sendAIMessage;

/* ================== مساعدة ملف محدد ================== */
async function openFileAiHelp(){
  if(!RS || !RS.file){
    toast('افتح ملفاً أولاً', 'warn');
    return;
  }

  const f = RS.file;
  const modal = document.getElementById('aiFileHelpModal');
  const intro = document.getElementById('aiFileHelpIntro');
  const quick = document.getElementById('aiFileHelpQuick');
  const input = document.getElementById('aiFileHelpInput');

  if(!modal) return;

  intro.innerHTML = `أنت الآن في ملف: <b>${escapeHtml(f.title)}</b>${f.category ? ' • ' + escapeHtml(f.category) : ''}<br>الصفحة الحالية: <b>${RS.current}</b> من <b>${RS.numPages}</b>`;
  input.value = '';

  const suggestions = [
    { icon: 'fa-lightbulb', text: 'اشرح لي الفكرة الأساسية في هذه الصفحة' },
    { icon: 'fa-question-circle', text: 'ما المفهوم الأهم في هذه الصفحة؟' },
    { icon: 'fa-tasks', text: 'اقترح لي خطوات لفهم هذا الدرس' },
    { icon: 'fa-check-circle', text: 'أعطني أسئلة تدريبية على هذا الدرس' },
    { icon: 'fa-link', text: 'كيف أرتبط هذا الدرس بما قبله؟' }
  ];

  quick.innerHTML = suggestions.map(s => `
    <button type="button" data-ai-q="${escapeHtml(s.text)}" style="text-align:right;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--card-2);color:var(--text);font-family:inherit;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:9px;transition:.2s">
      <i class="fas ${s.icon}" style="color:var(--primary)"></i>
      <span>${escapeHtml(s.text)}</span>
    </button>
  `).join('');

  quick.querySelectorAll('button[data-ai-q]').forEach(b => {
    b.addEventListener('click', () => { input.value = b.dataset.aiQ; });
  });

  modal.classList.add('open');

  /* اجعل الأزرار تعمل */
  const sendBtn = document.getElementById('aiFileHelpSend');
  const cancelBtn = document.getElementById('aiFileHelpCancel');

  const onSend = async () => {
    const q = input.value.trim();
    if(!q){ toast('اكتب سؤالك أولاً', 'warn'); return; }

    /* اقفل المودال */
    modal.classList.remove('open');

    /* املأ السياق */
    AI.fileContext = {
      fileId: f.id,
      fileTitle: f.title,
      fileCategory: f.category,
      currentPage: RS.current,
      totalPages: RS.numPages
    };

    /* افتح المحادثة */
    openAIChat();

    /* أرسل السؤال مباشرة */
    setTimeout(() => {
      sendAIMessage(`[مساعدة في ملف "${f.title}" - الصفحة ${RS.current}]\n${q}`);
    }, 300);
  };

  sendBtn.onclick = onSend;
  cancelBtn.onclick = () => modal.classList.remove('open');
  input.onkeydown = e => {
    if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); onSend(); }
  };

  setTimeout(() => input.focus(), 200);
}
window.openFileAiHelp = openFileAiHelp;

/* ================== تشغيل ================== */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAI, 800);
});
