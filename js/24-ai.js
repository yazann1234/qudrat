/* ============================================================
   24) AI — المساعد الذكي (العبقري) — نسخة مُصلحة
   يعتمد على Edge Function اسمها ai-chat
============================================================ */

function getAIUrl(){
  const base = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL)
    ? SUPABASE_URL
    : 'https://turhxyetqlxrfizggtaf.supabase.co';
  return base + '/functions/v1/ai-chat';
}

const AI = {
  open: false,
  sending: false,
  history: [],
  fileContext: null,
  panel: null,
  bodyEl: null,
  inputEl: null,
  fab: null,
  initialized: false,
  userKey: null
};

function aiEsc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function aiFormat(t){
  return aiEsc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

/* ================== الصلاحيات ================== */
function canUseAI(){
  if(typeof currentUserObj === 'undefined' || !currentUserObj) return false;
  if(currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return true;
  if(currentUserObj.status === 'approved') return true;
  return false;
}
window.canUseAI = canUseAI;

function isAIAdminMode(){
  return typeof currentUserObj !== 'undefined' && currentUserObj &&
    (currentUserObj.role === 'admin' || currentUserObj.role === 'owner');
}
window.isAIAdminMode = isAIAdminMode;

/* ================== إظهار/إخفاء الأزرار حسب الحالة ================== */
function updateAIFabVisibility(){
  const fab = document.getElementById('aiFabBtn');
  const rdBtn = document.getElementById('rdAiHelp');
  const allowed = canUseAI();

  /* لو تغيّر المستخدم (خروج/دخول بحساب ثاني) صفّر المحادثة */
  const key = (typeof currentUserObj !== 'undefined' && currentUserObj)
    ? (currentUserObj.id || currentUserObj.email || 'u') : null;
  if(key !== AI.userKey){
    AI.userKey = key;
    resetAIChat();
  }

  if(rdBtn) rdBtn.style.display = allowed ? '' : 'none';

  if(!fab) return;
  if(!allowed){
    fab.style.display = 'none';
    if(AI.open) closeAIChat();
    return;
  }
  fab.style.display = 'grid';
  if(isAIAdminMode()){
    fab.style.background = 'linear-gradient(135deg, #f7b32b, #d97706)';
    fab.title = 'مساعد الأدمن الذكي 🤖 (وضع الإدارة)';
  } else {
    fab.style.background = 'linear-gradient(135deg, #5b6cff, #a855f7)';
    fab.title = 'المساعد الذكي 🤖';
  }
}
window.updateAIFabVisibility = updateAIFabVisibility;

function resetAIChat(){
  AI.history = [];
  AI.fileContext = null;
  AI.welcomed = false;
  if(AI.bodyEl) AI.bodyEl.innerHTML = '';
}

/* ================== تهيئة ================== */
function initAI(){
  if(AI.initialized) return;

  AI.panel   = document.getElementById('aiChatPanel');
  AI.bodyEl  = document.getElementById('aiChatBody');
  AI.inputEl = document.getElementById('aiChatInput');
  AI.fab     = document.getElementById('aiFabBtn');

  if(!AI.panel || !AI.bodyEl || !AI.inputEl) return;
  AI.initialized = true;

  if(AI.fab) AI.fab.addEventListener('click', toggleAIChat);
  const closeBtn = document.getElementById('aiChatClose');
  if(closeBtn) closeBtn.addEventListener('click', closeAIChat);

  const sendBtn = document.getElementById('aiChatSend');
  if(sendBtn) sendBtn.addEventListener('click', function(){ sendAIMessage(); });

  AI.inputEl.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendAIMessage(); }
  });
  AI.inputEl.addEventListener('input', function(){
    AI.inputEl.style.height = 'auto';
    AI.inputEl.style.height = Math.min(120, AI.inputEl.scrollHeight) + 'px';
  });

  const rdAiHelp = document.getElementById('rdAiHelp');
  if(rdAiHelp) rdAiHelp.addEventListener('click', openFileAiHelp);

  try{ initAIFindUI(); }catch(e){ console.warn('find ui', e); }
  updateSuggestions();
  updateAIFabVisibility();

  /* المستخدم يُحمَّل بعد تسجيل الدخول (async) — نراقب الحالة */
  setInterval(updateAIFabVisibility, 1500);
}
window.initAI = initAI;

/* ================== رسالة ترحيب ================== */
function getWelcomeMessage(){
  if(isAIAdminMode()){
    const isOwner = currentUserObj.role === 'owner';
    return 'أهلاً بك ' + (isOwner ? 'يا رئيس المنصة 👑' : 'أيها الأدمن 🛡️') + '!\n\n' +
      'أنا "العبقري" — مساعدك الإداري الذكي.\n\nأستطيع مساعدتك في:\n' +
      '• شرح أي أداة في لوحة الأدمن\n• كيف تُفعّل/ترفض مستخدمين\n' +
      '• كيف تُدير الملفات والفيديوهات والمنتجات\n• الفرق بين صلاحياتك وصلاحيات الآخرين\n' +
      '• نصائح احترافية لإدارة المنصة\n• حل أي مشكلة تواجهك\n\n' +
      'اسألني أي شيء عن الإدارة وسأشرحه لك بالتفصيل 📚';
  }
  return 'أهلاً بك في منصة عباقرة القدرات 🌸\nأنا "العبقري" — مساعدك الذكي الخاص بالمنصة.\n\n' +
    'كيف أقدر أساعدك اليوم؟\n• كيفية استخدام أي قسم\n• كيف أزيد نقاطي XP\n' +
    '• حل أي مشكلة تواجهك\n• شرح ميزات القارئ والفيديو\n\nجرب الاقتراحات بالأسفل 👇';
}

/* ================== فتح/إغلاق ================== */
function toggleAIChat(){
  if(!canUseAI()){ toast('هذه الميزة متاحة للمشتركين فقط', 'warn'); return; }
  if(AI.open) closeAIChat(); else openAIChat();
}
function openAIChat(){
  if(!AI.initialized) initAI();
  if(!AI.panel) return;
  if(!canUseAI()){ toast('هذه الميزة للمشتركين فقط', 'warn'); return; }
  AI.open = true;
  AI.panel.classList.add('open');
  if(AI.fab) AI.fab.classList.add('hidden');

  if(!AI.welcomed){
    AI.welcomed = true;
    showAIMessage('assistant', getWelcomeMessage());
    updateSuggestions();
  }
  setTimeout(function(){ if(AI.inputEl) AI.inputEl.focus(); }, 300);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}
function closeAIChat(){
  AI.open = false;
  if(AI.panel) AI.panel.classList.remove('open');
  if(AI.fab) AI.fab.classList.remove('hidden');
}

/* ================== اقتراحات حسب الدور ================== */
function updateSuggestions(){
  const box = document.getElementById('aiChatSuggestions');
  if(!box) return;

  if(isAIAdminMode()){
    box.innerHTML =
      '<button data-q="كيف أفعّل مستخدم جديد؟"><i class="fas fa-user-check"></i> تفعيل مستخدم</button>' +
      '<button data-q="كيف أعدل كلمة مرور مستخدم؟"><i class="fas fa-key"></i> تعديل كلمة سر</button>' +
      '<button data-q="كيف أربط فيديو بملف؟"><i class="fas fa-link"></i> ربط فيديو بملف</button>' +
      '<button data-q="كيف أضيف منتج جديد في المتجر؟"><i class="fas fa-shopping-bag"></i> منتج جديد</button>' +
      '<button data-q="ما الفرق بيني وبين رئيس المنصة؟"><i class="fas fa-crown"></i> الفرق بين الرتب</button>' +
      '<button data-q="أعطني نصائح لإدارة المنصة"><i class="fas fa-lightbulb"></i> نصائح إدارية</button>';
  } else {
    box.innerHTML =
      '<button data-q="كيف أشاهد الفيديو والملف في نفس الوقت؟"><i class="fas fa-video"></i> فيديو + ملف</button>' +
      '<button data-q="كيف أزيد نقاط XP؟"><i class="fas fa-star"></i> زيادة XP</button>' +
      '<button data-q="كيف أرسم على الملف؟"><i class="fas fa-pen"></i> الرسم على الملف</button>' +
      '<button data-q="كيف أشتري دورة؟"><i class="fas fa-shopping-bag"></i> شراء دورة</button>' +
      '<button data-q="كيف أحفظ موضعي في الفيديو؟"><i class="fas fa-bookmark"></i> حفظ الموضع</button>';
    box.insertAdjacentHTML('afterbegin', '<button class="ai-find-chip" type="button" onclick="setAISearchMode(true)"><i class="fas fa-magnifying-glass"></i> ابحث عن سؤال في الملفات</button>');
  }

  box.querySelectorAll('button[data-q]').forEach(function(b){
    b.addEventListener('click', function(){ sendAIMessage(b.dataset.q); });
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
  if(role === 'user') bubble.textContent = content;
  else bubble.innerHTML = aiFormat(content);

  div.appendChild(avatar);
  div.appendChild(bubble);
  AI.bodyEl.appendChild(div);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}

function showAITyping(){
  hideAITyping();
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
  if(!canUseAI()){ toast('هذه الميزة متاحة للمشتركين فقط', 'warn'); return; }
  if(!AI.initialized) initAI();

  const text = (typeof textOverride === 'string' ? textOverride : (AI.inputEl.value || '')).trim();
  /* ⭐ صورة مرفقة أو وضع البحث → البحث عن السؤال في الملفات */
  if(typeof textOverride !== 'string' && (AI.pendingImage || AI.searchMode)){
    AI.sending = false;
    return findQuestionInFiles(text);
  }
  if(!text) return;

  AI.sending = true;
  AI.inputEl.value = '';
  AI.inputEl.style.height = 'auto';

  showAIMessage('user', text);
  AI.history.push({ role: 'user', content: text });
  showAITyping();

  const sendBtn = document.getElementById('aiChatSend');
  if(sendBtn) sendBtn.disabled = true;

  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, 45000);

  try{
    if(typeof sb === 'undefined') throw new Error('Supabase client غير جاهز');

    const r = await sb.auth.getSession();
    const token = r && r.data && r.data.session ? r.data.session.access_token : '';
    if(!token) throw new Error('انتهت الجلسة، أعد تسجيل الدخول');

    /* نسخة من السياق حتى لا نعدّل الأصل */
    const context = Object.assign({}, AI.fileContext || {});
    if(isAIAdminMode()){
      context.adminMode = true;
      const activeView = document.querySelector('.view.active');
      if(activeView && activeView.id === 'view-admin'){
        const activePanel = document.querySelector('.admin-panel.on');
        if(activePanel) context.adminSection = activePanel.id.replace('panel-', '');
      }
    }

    const res = await fetch(getAIUrl(), {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey': (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '')
      },
      body: JSON.stringify({
        messages: AI.history.slice(-12),
        context: context
      })
    });

    hideAITyping();

    if(!res.ok){
      let errMsg = 'تعذر الاتصال بالذكاء الاصطناعي';
      try{ const j = await res.json(); errMsg = j.error || j.message || errMsg; }catch(e){}
      console.warn('AI error', res.status, errMsg);

      let extra = '\n\nحاول مرة أخرى بعد قليل 🌸';
      if(isAIAdminMode()){
        extra = '\n\n🔧 للأدمن:\n' +
          '1. تأكد من إضافة DEEPSEEK_API_KEY في Edge Function Secrets\n' +
          '2. تأكد أن رصيد حساب DeepSeek غير منتهٍ\n' +
          '3. تأكد من نشر الدالة (Deploy)\n' +
          '4. افتح Logs الدالة في Supabase لرؤية الخطأ بالتفصيل';
      }
      showAIMessage('assistant', '⚠️ ' + errMsg + extra);
      /* احذف رسالة المستخدم الفاشلة من السجل */
      AI.history.pop();
    } else {
      const data = await res.json();
      const reply = data.reply || 'عذراً، لم أفهم.';
      showAIMessage('assistant', reply);
      AI.history.push({ role: 'assistant', content: reply });
      if(AI.history.length > 30) AI.history = AI.history.slice(-30);
      /* سياق الملف يُرسل مرة واحدة مع أول سؤال عن الملف */
      AI.fileContext = null;
    }

  }catch(e){
    hideAITyping();
    AI.history.pop();
    const msg = e && e.name === 'AbortError'
      ? '⚠️ انتهت مهلة الاتصال، حاول مرة أخرى.'
      : '⚠️ ' + ((e && e.message) || 'حدث خطأ في الاتصال بالخادم.') + '\nتأكد من الإنترنت وحاول مرة أخرى.';
    showAIMessage('assistant', msg);
    console.warn('AI send error:', e);
  } finally {
    clearTimeout(timer);
    AI.sending = false;
    if(sendBtn) sendBtn.disabled = false;
  }
}
window.sendAIMessage = sendAIMessage;

/* ================== مساعدة ملف محدد ================== */
async function openFileAiHelp(){
  if(!canUseAI()){ toast('هذه الميزة متاحة للمشتركين فقط', 'warn'); return; }
  if(typeof RS === 'undefined' || !RS.file){ toast('افتح ملفاً أولاً', 'warn'); return; }

  const f = RS.file;
  const modal = document.getElementById('aiFileHelpModal');
  const intro = document.getElementById('aiFileHelpIntro');
  const quick = document.getElementById('aiFileHelpQuick');
  const input = document.getElementById('aiFileHelpInput');
  if(!modal) return;

  intro.innerHTML = 'أنت الآن في ملف: <b>' + aiEsc(f.title) + '</b>' +
    (f.category ? ' • ' + aiEsc(f.category) : '') +
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
    return '<button type="button" data-ai-q="' + aiEsc(s.text) + '" style="text-align:right;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--card-2);color:var(--text);font-family:inherit;font-size:.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:9px">' +
      '<i class="fas ' + s.icon + '" style="color:var(--primary)"></i><span>' + aiEsc(s.text) + '</span></button>';
  }).join('');

  quick.querySelectorAll('button[data-ai-q]').forEach(function(b){
    b.addEventListener('click', function(){ input.value = b.dataset.aiQ; });
  });

  modal.classList.add('open');

  const sendBtn = document.getElementById('aiFileHelpSend');
  const cancelBtn = document.getElementById('aiFileHelpCancel');

  const onSend = function(){
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
function bootAI(){
  try{ initAI(); }catch(e){ console.warn('initAI error:', e); }
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(bootAI, 300); });
} else {
  setTimeout(bootAI, 300);
}


/* ============================================================
   ⭐ البحث عن سؤال داخل ملفات المنصة (نص أو صورة)
============================================================ */
AI.pendingImage = null;   /* { data: base64, mime, url } */
AI.searchMode = false;

function initAIFindUI(){
  const wrap = document.querySelector('#aiChatPanel .ai-chat-input-wrap');
  if(!wrap || document.getElementById('aiAttachBtn')) return;

  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/*'; file.id = 'aiImageInput'; file.style.display = 'none';
  file.addEventListener('change', e => { const f = e.target.files[0]; if(f) aiAttachImage(f); e.target.value = ''; });

  const btn = document.createElement('button');
  btn.id = 'aiAttachBtn'; btn.className = 'ai-attach-btn'; btn.type = 'button';
  btn.title = 'أرفق صورة سؤال';
  btn.innerHTML = '<i class="fas fa-camera"></i>';
  btn.addEventListener('click', () => file.click());

  wrap.insertBefore(btn, wrap.firstChild);
  wrap.appendChild(file);

  const bar = document.createElement('div');
  bar.id = 'aiFindBar'; bar.className = 'ai-find-bar';
  wrap.parentNode.insertBefore(bar, wrap);

  /* لصق صورة مباشرة (Ctrl+V) */
  AI.inputEl.addEventListener('paste', e => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for(const it of items){
      if(it.type && it.type.startsWith('image/')){ e.preventDefault(); aiAttachImage(it.getAsFile()); break; }
    }
  });
  renderAIFindBar();
}

window.setAISearchMode = (on) => {
  if(!AI.initialized) initAI();
  if(!AI.open) openAIChat();
  AI.searchMode = !!on;
  renderAIFindBar();
  if(on){
    showAIMessage('assistant', '🔎 أرسل لي **نص السؤال** أو **صورته** (زر الكاميرا 📷)، وبدوّر عليه في كل ملفات دورتك:\n• لو لقيته أقولك الملف والصفحة ورقم السؤال\n• ولو ما لقيته أشرح لك حله بالتفصيل');
    setTimeout(() => AI.inputEl && AI.inputEl.focus(), 100);
  }
};

async function aiAttachImage(f){
  if(!f || !f.type || !f.type.startsWith('image/')){ toast('اختر صورة', 'warn'); return; }
  if(f.size > 12 * 1024 * 1024){ toast('الصورة كبيرة جداً', 'warn'); return; }
  try{
    const blob = typeof resizeImageToBlob === 'function' ? await resizeImageToBlob(f, 1600, 0.88) : f;
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    AI.pendingImage = { data: String(dataUrl).split(',')[1], mime: 'image/jpeg', url: dataUrl };
    AI.searchMode = true;
    renderAIFindBar();
    if(!AI.open) openAIChat();
  }catch(e){ toast('تعذّر قراءة الصورة', 'err'); }
}

function renderAIFindBar(){
  const bar = document.getElementById('aiFindBar');
  if(!bar) return;
  if(!AI.searchMode && !AI.pendingImage){
    bar.innerHTML = ''; bar.style.display = 'none';
    if(AI.inputEl) AI.inputEl.placeholder = 'اسألني عن أي شيء في المنصة...';
    return;
  }
  bar.style.display = 'flex';
  bar.innerHTML = `
    <span class="aif-mode"><i class="fas fa-magnifying-glass"></i> وضع البحث عن سؤال في الملفات</span>
    ${AI.pendingImage ? `<span class="aif-thumb"><img src="${AI.pendingImage.url}" alt=""><button type="button" onclick="aiClearImage()" title="إزالة"><i class="fas fa-xmark"></i></button></span>` : ''}
    <button type="button" class="aif-off" onclick="aiClearImage();setAISearchMode(false)" title="إلغاء البحث"><i class="fas fa-xmark"></i> إلغاء</button>`;
  if(AI.inputEl) AI.inputEl.placeholder = AI.pendingImage ? 'أضف ملاحظة (اختياري) ثم اضغط إرسال...' : 'اكتب نص السؤال أو أرفق صورته...';
}
window.aiClearImage = () => { AI.pendingImage = null; renderAIFindBar(); };

function showAIHTML(html){
  const div = document.createElement('div');
  div.className = 'ai-msg assistant';
  div.innerHTML = '<div class="ai-msg-avatar bot"><i class="fas fa-robot"></i></div>';
  const bubble = document.createElement('div');
  bubble.className = 'ai-msg-bubble ai-find-bubble';
  bubble.innerHTML = html;
  div.appendChild(bubble);
  AI.bodyEl.appendChild(div);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;
}

async function findQuestionInFiles(text){
  if(AI.sending) return;
  if(!canUseAI()){ toast('هذه الميزة متاحة للمشتركين فقط', 'warn'); return; }
  const img = AI.pendingImage;
  if(!text && !img){ toast('اكتب نص السؤال أو أرفق صورته', 'warn'); return; }

  AI.sending = true;
  AI.inputEl.value = ''; AI.inputEl.style.height = 'auto';

  /* رسالة الطالب (مع الصورة) */
  const um = document.createElement('div');
  um.className = 'ai-msg user';
  um.innerHTML = '<div class="ai-msg-avatar user"><i class="fas fa-user"></i></div>';
  const ub = document.createElement('div');
  ub.className = 'ai-msg-bubble';
  if(img){ const im = document.createElement('img'); im.src = img.url; im.className = 'ai-user-img'; ub.appendChild(im); }
  if(text){ const t = document.createElement('div'); t.textContent = text; ub.appendChild(t); }
  um.appendChild(ub);
  AI.bodyEl.appendChild(um);
  AI.bodyEl.scrollTop = AI.bodyEl.scrollHeight;

  AI.pendingImage = null;
  renderAIFindBar();
  showAITyping();
  const st = document.getElementById('aiChatStatus');
  if(st) st.textContent = 'يبحث في الملفات... 🔎';
  const sendBtn = document.getElementById('aiChatSend'); if(sendBtn) sendBtn.disabled = true;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try{
    const r = await sb.auth.getSession();
    const token = r && r.data && r.data.session ? r.data.session.access_token : '';
    if(!token) throw new Error('انتهت الجلسة، أعد تسجيل الدخول');
    const res = await fetch(getAIUrl(), {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '') },
      body: JSON.stringify({ mode: 'find_question', text, image: img ? img.data : null, mime: img ? img.mime : null })
    });
    hideAITyping();
    let j = null; try{ j = await res.json(); }catch(e){}
    if(!res.ok || !j || j.error) throw new Error((j && j.error) || 'تعذّر البحث');
    showAIHTML(renderFindResult(j));
    /* سياق للمحادثة اللاحقة (لو سأل «اشرح أكثر») */
    AI.history.push({ role: 'user', content: '[بحث عن سؤال] ' + String(j.extracted_question || text || '').slice(0, 800) });
    AI.history.push({ role: 'assistant', content: (j.found ? `السؤال موجود في ملف «${j.file_title}» صفحة ${j.page}${j.question_number ? ' سؤال رقم ' + j.question_number : ''}. ` : 'السؤال غير موجود في الملفات. ') + 'الإجابة: ' + (j.answer || '') + '\n' + String(j.solution || '').slice(0, 1500) });
    if(AI.history.length > 30) AI.history = AI.history.slice(-30);
  }catch(e){
    hideAITyping();
    showAIMessage('assistant', '⚠️ ' + (e && e.name === 'AbortError' ? 'استغرق البحث وقتاً طويلاً، حاول مرة ثانية.' : (e.message || 'تعذّر البحث')));
  }finally{
    clearTimeout(timer);
    AI.sending = false;
    if(sendBtn) sendBtn.disabled = false;
    if(st) st.textContent = 'متصل • جاهز للمساعدة';
  }
}
window.findQuestionInFiles = findQuestionInFiles;

function renderFindResult(j){
  const sol = j.solution ? aiFormat(j.solution) : '';
  const ans = j.answer ? `<div class="aif-answer"><i class="fas fa-circle-check"></i> الإجابة: <b>${aiEsc(j.answer)}</b></div>` : '';
  if(j.notQuestion) return `<div class="aif-card miss">${aiFormat(j.solution || '')}</div>`;
  if(j.found){
    return `
      <div class="aif-card found">
        <div class="aif-title"><i class="fas fa-circle-check"></i> السؤال موجود في ملفاتك!</div>
        <div class="aif-loc">
          <div><i class="fas fa-file-pdf"></i><small>الملف</small><b>${aiEsc(j.file_title || '')}</b></div>
          <div><i class="fas fa-file-lines"></i><small>الصفحة</small><b>${aiEsc(j.page)}</b></div>
          <div><i class="fas fa-hashtag"></i><small>رقم السؤال</small><b>${j.question_number ? aiEsc(j.question_number) : 'غير مرقّم'}</b></div>
        </div>
        <button class="aif-open" onclick="aiOpenFilePage('${aiEsc(j.file_id)}', ${parseInt(j.page, 10) || 1})"><i class="fas fa-book-open"></i> افتح الملف على الصفحة ${aiEsc(j.page)}</button>
        ${sol ? `<details class="aif-sol"><summary><i class="fas fa-lightbulb"></i> عرض الحل بالتفصيل</summary>${ans}<div>${sol}</div></details>` : ''}
      </div>`;
  }
  return `
    <div class="aif-card miss">
      <div class="aif-title"><i class="fas fa-magnifying-glass-minus"></i> السؤال ليس موجوداً ضمن ملفات المنصة</div>
      <p class="aif-note">بحثت في كل ملفات دورتك ولم أجد نفس السؤال بنفس الأرقام والمعطيات. وهذا حله بالتفصيل 👇</p>
      ${ans}
      <div class="aif-solution">${sol || 'تعذّر توليد الحل، حاول مرة ثانية.'}</div>
    </div>`;
}

window.aiOpenFilePage = (fileId, page) => {
  const f = (DB.files || []).find(x => x.id === fileId);
  if(!f){ toast('الملف غير متاح لحسابك', 'warn'); return; }
  closeAIChat();
  window._openAtPage = page;
  if(typeof openFile === 'function') openFile(fileId);
};
