/* ============================================================
   24) AI — المساعد الذكي (Gemini) — نسخة كاملة
============================================================ */

const AI_CHAT_URL = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://turhxyetqlxrfizggtaf.supabase.co') + '/functions/v1/ai-chat';

const AI = {
  open: false,
  sending: false,
  history: [],
  fileContext: null,
  panel: null,
  bodyEl: null,
  inputEl: null,
  fab: null,
  initialized: false
};

/* ================== هل يمكن استخدام AI؟ ================== */
function canUseAI(){
  if(!currentUserObj) return false;
  /* admin أو owner */
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return true;
  /* مشترك معتمد */
  if(currentUserObj.status === 'approved') return true;
  return false;
}
window.canUseAI = canUseAI;

/* ================== هل هو أدمن؟ ================== */
function isAIAdminMode(){
  return currentUserObj && (currentUserObj.role === 'admin' || currentUserObj.role === 'owner');
}
window.isAIAdminMode = isAIAdminMode;

/* ================== تحديث زر AI حسب الحالة ================== */
function updateAIFabVisibility(){
  const fab = document.getElementById('aiFabBtn');
  if(!fab) return;

  if(!currentUserObj){
    fab.style.display = 'none';
    return;
  }

  if(canUseAI()){
    fab.style.display = 'grid';
    /* لون مختلف للأدمن */
    if(isAIAdminMode()){
      fab.style.background = 'linear-gradient(135deg, #f7b32b, #d97706)';
      fab.title = 'مساعد الأدمن الذكي 🤖 (وضع الإدارة)';
    } else {
      fab.style.background = 'linear-gradient(135deg, #5b6cff, #a855f7)';
      fab.title = 'المساعد الذكي 🤖';
    }
  } else {
    fab.style.display = 'none';
  }
}
window.updateAIFabVisibility = updateAIFabVisibility;

/* ================== تهيئة ================== */
function initAI(){
  if(AI.initialized) return;
  AI.initialized = true;

  AI.panel = document.getElementById('aiChatPanel');
  AI.bodyEl = document.getElementById('aiChatBody');
  AI.inputEl = document.getElementById('aiChatInput');
  AI.fab = document.getElementById('aiFabBtn');

  if(!AI.panel || !AI.bodyEl || !AI.inputEl) return;

  if(AI.fab) AI.fab.addEventListener('click', toggleAIChat);
  const closeBtn = document.getElementById('aiChatClose');
  if(closeBtn) closeBtn.addEventListener('click', closeAIChat);

  const sendBtn = document.getElementById('aiChatSend');
  if(sendBtn) sendBtn.addEventListener('click', function(){ sendAIMessage(); });

  AI.inputEl.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendAIMessage(); }
  });

  const suggestions = document.getElementById('aiChatSuggestions');
  if(suggestions){
    suggestions.querySelectorAll('button[data-q]').forEach(function(b){
      b.addEventListener('click', function(){
        AI.inputEl.value = b.dataset.q;
        sendAIMessage();
      });
    });
  }

  AI.inputEl.addEventListener('input', function(){
    AI.inputEl.style.height = 'auto';
    AI.inputEl.style.height = Math.min(120, AI.inputEl.scrollHeight) + 'px';
  });

  const rdAiHelp = document.getElementById('rdAiHelp');
  if(rdAiHelp){
    rdAiHelp.addEventListener('click', openFileAiHelp);
    /* إخفاء الزر إذا لا يمكن استخدام AI */
    if(!canUseAI()) rdAiHelp.style.display = 'none';
  }

  updateAIFabVisibility();
}
window.initAI = initAI;

/* ================== رسالة ترحيب حسب الدور ================== */
function getWelcomeMessage(){
  if(isAIAdminMode()){
    const isOwner = currentUserObj.role === 'owner';
    return `أهلاً بك ${isOwner ? 'يا رئيس المنصة 👑' : 'أيها الأدمن 🛡️'}!\n\nأنا "العبقري" — مساعدك الإداري الذكي.\n\nأستطيع مساعدتك في:\n• شرح أي أداة في لوحة الأدمن\n• كيف تُفعّل/ترفض مستخدمين\n• كيف تُدير الملفات والفيديوهات والمنتجات\n• الفرق بين صلاحياتك وصلاحيات الآخرين\n• نصائح احترافية لإدارة المنصة\n• حل أي مشكلة تواجهك\n\nاسألني أي شيء عن الإدارة وسأشرحه لك بالتفصيل 📚`;
  }
  return `أهلاً بك في منصة العباقرة للقدرات 🌸\nأنا "العبقري" — مساعدك الذكي الخاص بالمنصة.\n\nكيف أقدر أساعدك اليوم؟\n• كيفية استخدام أي قسم\n• كيف أزيد نقاطي XP\n• حل أي مشكلة تواجهك\n• شرح ميزات القارئ والفيديو\n\nجرب الاقتراحات بالأسفل 👇`;
}

/* ================== فتح/إغلاق ================== */
function toggleAIChat(){
  if(!canUseAI()){
    toast('هذه الميزة متاحة للمشتركين فقط', 'warn');
    return;
  }
  if(AI.open) closeAIChat(); else openAIChat();
}
function openAIChat(){
  if(!canUseAI()){ toast('هذه الميزة للمشتركين فقط', 'warn'); return; }
  AI.open = true;
  AI.panel.classList.add('open');
  if(AI.fab) AI.fab.classList.add('hidden');

  if(!AI.history.length){
    showAIMessage('assistant', getWelcomeMessage());
    /* ⭐ اقتراحات حسب الدور */
    updateSuggestions();
  }

  setTimeout(function(){ if(AI.inputEl) AI.inputEl.focus(); }, 300);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}
function closeAIChat(){
  AI.open = false;
  AI.panel.classList.remove('open');
  if(AI.fab) AI.fab.classList.remove('hidden');
}

/* ================== اقتراحات حسب الدور ================== */
function updateSuggestions(){
  const box = document.getElementById('aiChatSuggestions');
  if(!box) return;

  if(isAIAdminMode()){
    box.innerHTML = `
      <button data-q="كيف أفعّل مستخدم جديد؟"><i class="fas fa-user-check"></i> تفعيل مستخدم</button>
      <button data-q="كيف أعدل كلمة مرور مستخدم؟"><i class="fas fa-key"></i> تعديل كلمة سر</button>
      <button data-q="كيف أربط فيديو بملف؟"><i class="fas fa-link"></i> ربط فيديو بملف</button>
      <button data-q="كيف أضيف منتج جديد في المتجر؟"><i class="fas fa-shopping-bag"></i> منتج جديد</button>
      <button data-q="ما الفرق بيني وبين رئيس المنصة؟"><i class="fas fa-crown"></i> الفرق بين الرتب</button>
      <button data-q="كيف أرى إيصال مستخدم؟"><i class="fas fa-receipt"></i> عرض إيصال</button>
      <button data-q="أعطني نصائح لإدارة المنصة"><i class="fas fa-lightbulb"></i> نصائح إدارية</button>
    `;
  } else {
    box.innerHTML = `
      <button data-q="كيف أشاهد الفيديو والملف في نفس الوقت؟"><i class="fas fa-video"></i> فيديو + ملف</button>
      <button data-q="كيف أزيد نقاط XP؟"><i class="fas fa-star"></i> زيادة XP</button>
      <button data-q="كيف أرسم على الملف؟"><i class="fas fa-pen"></i> الرسم على الملف</button>
      <button data-q="كيف أشتري دورة؟"><i class="fas fa-shopping-bag"></i> شراء دورة</button>
      <button data-q="كيف أحفظ موضعي في الفيديو؟"><i class="fas fa-bookmark"></i> حفظ الموضع</button>
    `;
  }

  box.querySelectorAll('button[data-q]').forEach(function(b){
    b.addEventListener('click', function(){
      AI.inputEl.value = b.dataset.q;
      sendAIMessage();
    });
  });
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
  div.innerHTML = '<div class="ai-msg-avatar bot"><i class="fas fa-robot"></i></div><div class="ai-typing"><span></span><span></span><span></span></div>';
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
  if(!canUseAI()){
    toast('هذه الميزة متاحة للمشتركين فقط', 'warn');
    return;
  }

  const text = (textOverride || AI.inputEl.value || '').trim();
  if(!text) return;

  AI.sending = true;
  AI.inputEl.value = '';
  AI.inputEl.style.height = 'auto';

  showAIMessage('user', text);
  AI.history.push({ role: 'user', content: text });
  showAITyping();

  const sendBtn = document.getElementById('aiChatSend');
  if(sendBtn) sendBtn.disabled = true;

  try{
    const r = await sb.auth.getSession();
    const token = r.data.session ? r.data.session.access_token : '';

    /* سياق إضافي للأدمن */
    let context = AI.fileContext || {};
    if(isAIAdminMode()){
      context.adminMode = true;
      /* اكتشف القسم الحالي */
      const activeView = document.querySelector('.view.active');
      if(activeView && activeView.id === 'view-admin'){
        const activePanel = document.querySelector('.admin-panel.on');
        if(activePanel){
          context.adminSection = activePanel.id.replace('panel-', '');
        }
      }
    }

    const res = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        messages: AI.history.slice(-12),
        context: context
      })
    });

    hideAITyping();

    if(!res.ok){
      let errMsg = 'تعذر الاتصال بالذكاء الاصطناعي';
      try{
        const j = await res.json();
        errMsg = j.error || errMsg;
      }catch(e){}

      showAIMessage('assistant',
        '⚠️ ' + errMsg + '\n\n' +
        '🔧 الحل:\n' +
        '1. تأكد من إضافة GEMINI_API_KEY في Edge Function Secrets\n' +
        '2. تأكد من نشر الدالة (Deploy)\n' +
        '3. أعد تحميل الصفحة\n\n' +
        'إذا استمرت المشكلة، تواصل مع الدعم الفني.');
      AI.sending = false;
      if(sendBtn) sendBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const reply = data.reply || 'عذراً، لم أفهم.';

    showAIMessage('assistant', reply);
    AI.history.push({ role: 'assistant', content: reply });

    if(AI.history.length > 30){
      AI.history = AI.history.slice(-30);
    }

  }catch(e){
    hideAITyping();
    showAIMessage('assistant', '⚠️ حدث خطأ في الاتصال بالخادم.\nتأكد من الإنترنت وحاول مرة أخرى.');
    console.warn('AI send error:', e);
  }

  AI.sending = false;
  if(sendBtn) sendBtn.disabled = false;
}
window.sendAIMessage = sendAIMessage;

/* ================== مساعدة ملف محدد ================== */
async function openFileAiHelp(){
  if(!canUseAI()){
    toast('هذه الميزة متاحة للمشتركين فقط', 'warn');
    return;
  }
  if(typeof RS === 'undefined' || !RS.file){
    toast('افتح ملفاً أولاً', 'warn');
    return;
  }

  const f = RS.file;
  const modal = document.getElementById('aiFileHelpModal');
  const intro = document.getElementById('aiFileHelpIntro');
  const quick = document.getElementById('aiFileHelpQuick');
  const input = document.getElementById('aiFileHelpInput');

  if(!modal) return;

  intro.innerHTML = 'أنت الآن في ملف: <b>' + escapeHtml(f.title) + '</b>' +
    (f.category ? ' • ' + escapeHtml(f.category) : '') +
    '<br>الصفحة الحالية: <b>' + RS.current + '</b> من <b>' + RS.numPages + '</b>';

  input.value = '';

  const suggestions = [
    { icon: 'fa-lightbulb', text: 'اشرح لي الفكرة الأساسية في هذه الصفحة' },
    { icon: 'fa-question-circle', text: 'ما المفهوم الأهم في هذه الصفحة؟' },
    { icon: 'fa-tasks', text: 'اقترح لي خطوات لفهم هذا الدرس' },
    { icon: 'fa-check-circle', text: 'أعطني أسئلة تدريبية على هذا الدرس' },
    { icon: 'fa-link', text: 'كيف يرتبط هذا الدرس بما قبله؟' }
  ];

  quick.innerHTML = suggestions.map(function(s){
    return '<button type="button" data-ai-q="' + escapeHtml(s.text) + '" style="text-align:right;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--card-2);color:var(--text);font-family:inherit;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:9px;transition:.2s">' +
      '<i class="fas ' + s.icon + '" style="color:var(--primary)"></i>' +
      '<span>' + escapeHtml(s.text) + '</span>' +
    '</button>';
  }).join('');

  quick.querySelectorAll('button[data-ai-q]').forEach(function(b){
    b.addEventListener('click', function(){ input.value = b.dataset.aiQ; });
  });

  modal.classList.add('open');

  const sendBtn = document.getElementById('aiFileHelpSend');
  const cancelBtn = document.getElementById('aiFileHelpCancel');

  const onSend = async function(){
    const q = input.value.trim();
    if(!q){ toast('اكتب سؤالك أولاً', 'warn'); return; }

    modal.classList.remove('open');

    AI.fileContext = {
      fileId: f.id,
      fileTitle: f.title,
      fileCategory: f.category,
      currentPage: RS.current,
      totalPages: RS.numPages
    };

    openAIChat();

    setTimeout(function(){
      sendAIMessage('[مساعدة في ملف "' + f.title + '" - الصفحة ' + RS.current + ']\n' + q);
    }, 300);
  };

  sendBtn.onclick = onSend;
  cancelBtn.onclick = function(){ modal.classList.remove('open'); };
  input.onkeydown = function(e){
    if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); onSend(); }
  };

  setTimeout(function(){ input.focus(); }, 200);
}
window.openFileAiHelp = openFileAiHelp;

/* ================== بدء ================== */
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    try{ initAI(); }catch(e){ console.warn('initAI error:', e); }
  }, 800);
});
