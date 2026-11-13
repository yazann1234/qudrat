/* ============================================================
   53) LIVE — البث المباشر (يوتيوب) + الشات المباشر 🔴
   - الإدارة تحط رابط بث يوتيوب من لوحة الأدمن ← يوصل إشعار للكل
   - زر «مباشر» عائم في الزاوية ← يفتح البث داخل الموقع (صوت + صورة من يوتيوب)
   - شات مباشر: أي رسالة تظهر فوراً للجميع، وللمقدّم في «وضع المقدّم»
   - عدد المشاهدين لحظياً (Realtime Presence)
   - يحتاج supabase-update-12.sql
============================================================ */

const LIVE = {
  stream: null,          /* البث الحالي { id, youtube_id, title, status, chat_open, ... } */
  open: false,
  presenter: false,
  streamsCh: null,
  chatCh: null,
  presCh: null,
  viewers: 0,
  lastId: 0,
  msgs: [],
  pollTimer: null,
  chatPoll: null,
  sending: false,
  stickBottom: true,
  unread: 0,
  announced: null
};

/* ================== أدوات ================== */
function liveParseYouTube(url){
  const s = String(url || '').trim();
  if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:live\/|embed\/|shorts\/|watch\?(?:.*&)?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
window.liveParseYouTube = liveParseYouTube;

function liveCanWatch(){
  if(!currentUserObj) return false;
  if(typeof isPrivileged === 'function' && isPrivileged()) return true;
  return typeof isSubscribed === 'function' ? isSubscribed() : currentUserObj.status === 'approved';
}

function liveTime(d){
  try{ return new Date(d).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' }); }catch(e){ return ''; }
}

function liveSince(d){
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 60000));
  if(m < 1) return 'بدأ الآن';
  if(m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  return `منذ ${h} ساعة${m % 60 ? ' و' + (m % 60) + ' دقيقة' : ''}`;
}

/* ================== البث الحالي ================== */
async function liveLoadActive(){
  try{
    const { data, error } = await sb.from('live_streams').select('*')
      .eq('status', 'live').order('started_at', { ascending: false }).limit(1).maybeSingle();
    if(error) return;            /* ملف SQL ما انشغّل بعد */
    liveSetStream(data || null);
  }catch(e){}
}

function liveSetStream(s){
  const prev = LIVE.stream;
  LIVE.stream = s && s.status === 'live' ? s : null;

  /* بدأ بث جديد والصفحة مفتوحة → تنبيه */
  if(LIVE.stream && (!prev || prev.id !== LIVE.stream.id)){
    if(LIVE.announced !== LIVE.stream.id && Date.now() - Date.parse(LIVE.stream.started_at) < 15 * 60000) liveAnnounce();
    LIVE.announced = LIVE.stream.id;
  }
  /* انتهى البث وهو يتابع */
  if(prev && !LIVE.stream && LIVE.open) liveShowEnded();
  if(LIVE.stream && LIVE.open && prev && prev.id === LIVE.stream.id) liveRenderHead();

  liveRenderFab();
  try{ if(typeof renderAdminLive === 'function') renderAdminLive(); }catch(e){}
}

function liveSubscribeStreams(){
  if(LIVE.streamsCh){ try{ sb.removeChannel(LIVE.streamsCh); }catch(e){} }
  LIVE.streamsCh = sb.channel('live-streams-' + Date.now())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, p => {
      const row = p.new && p.new.id ? p.new : null;
      if(row && row.status === 'live') liveSetStream(row);
      else if(row && LIVE.stream && row.id === LIVE.stream.id) liveSetStream(null);
    })
    .subscribe();
  /* احتياط لو Realtime مطفأ */
  clearInterval(LIVE.pollTimer);
  LIVE.pollTimer = setInterval(() => { if(!document.hidden) liveLoadActive(); }, 60000);
}

/* ================== الزر العائم ================== */
function liveRenderFab(){
  let fab = document.getElementById('liveFab');
  if(!LIVE.stream || !currentUserObj || LIVE.open){
    if(fab) fab.classList.remove('show');
    return;
  }
  if(!fab){
    fab = document.createElement('button');
    fab.id = 'liveFab';
    fab.className = 'live-fab';
    fab.addEventListener('click', () => openLive());
    document.body.appendChild(fab);
  }
  fab.innerHTML = `<span class="lf-dot"></span><b>مباشر الآن</b><small>${escapeHtml(LIVE.stream.title || 'بث مباشر')}</small>`;
  fab.title = 'شاهد البث المباشر';
  requestAnimationFrame(() => fab.classList.add('show'));
}

/* تنبيه بدء البث (لمن الموقع مفتوح عنده) */
function liveAnnounce(){
  if(!currentUserObj || LIVE.open) return;
  let el = document.getElementById('liveToast');
  if(!el){
    el = document.createElement('div');
    el.id = 'liveToast';
    el.className = 'live-toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="lt-ic"><i class="fas fa-tower-broadcast"></i></div>
    <div class="lt-txt"><b>🔴 بدأ بث مباشر!</b><small>${escapeHtml(LIVE.stream.title || '')}</small></div>
    <button class="btn btn-primary btn-sm" id="liveToastGo">شاهد الآن</button>
    <button class="lt-x" id="liveToastX" aria-label="إغلاق"><i class="fas fa-xmark"></i></button>`;
  el.classList.add('show');
  document.getElementById('liveToastGo').onclick = () => { el.classList.remove('show'); openLive(); };
  document.getElementById('liveToastX').onclick = () => el.classList.remove('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 20000);
  try{ if(typeof beep === 'function') beep(); }catch(e){}
}

/* ================== نافذة البث ================== */
function liveModal(){
  let m = document.getElementById('liveModal');
  if(m) return m;
  m = document.createElement('div');
  m.id = 'liveModal';
  m.className = 'live-modal';
  m.innerHTML = `
    <div class="live-box">
      <div class="live-head">
        <span class="live-pill"><span class="lf-dot"></span> مباشر</span>
        <div class="live-title"><b id="liveTitle">—</b><small id="liveSince">—</small></div>
        <span class="live-viewers" title="عدد المشاهدين الآن"><i class="fas fa-eye"></i> <b id="liveViewers">0</b></span>
        <button class="live-x" id="liveClose" title="إغلاق"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="live-main">
        <div class="live-player" id="livePlayer"></div>
        <div class="live-chat">
          <div class="live-chat-head">
            <b><i class="fas fa-comments"></i> الشات المباشر</b>
            <span id="liveChatTools"></span>
          </div>
          <div class="live-msgs" id="liveMsgs"></div>
          <button class="live-newpill" id="liveNewPill"><i class="fas fa-arrow-down"></i> <span>رسائل جديدة</span></button>
          <div class="live-send" id="liveSend">
            <input type="text" id="liveInput" maxlength="300" placeholder="اكتب رسالتك..." autocomplete="off">
            <button class="btn btn-primary" id="liveSendBtn" title="إرسال"><i class="fas fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
      <div class="live-ended" id="liveEnded">
        <i class="fas fa-circle-stop"></i>
        <h3>انتهى البث المباشر</h3>
        <p>شكراً لمتابعتك 💙 — راح يوصلك إشعار مع البث الجاي.</p>
        <button class="btn btn-primary" onclick="closeLive()">إغلاق</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  document.getElementById('liveClose').onclick = closeLive;
  const input = document.getElementById('liveInput');
  input.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.isComposing){ e.preventDefault(); liveSend(); } });
  document.getElementById('liveSendBtn').onclick = liveSend;
  const list = document.getElementById('liveMsgs');
  list.addEventListener('scroll', () => {
    LIVE.stickBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    if(LIVE.stickBottom){ LIVE.unread = 0; livePill(); }
  });
  document.getElementById('liveNewPill').onclick = () => { liveScrollBottom(true); };
  return m;
}

async function openLive(opts){
  opts = opts || {};
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  if(!LIVE.stream) await liveLoadActive();
  if(!LIVE.stream){ toast('ما فيه بث مباشر الحين', 'warn'); return; }
  if(!liveCanWatch()){
    toast(typeof isFrozen === 'function' && isFrozen() ? '❄️ حسابك مجمّد — فك التجميد لمتابعة البث' : 'البث المباشر للمشتركين فقط 🔒', 'warn');
    return;
  }
  const m = liveModal();
  LIVE.open = true;
  LIVE.presenter = !!opts.presenter && typeof isPrivileged === 'function' && isPrivileged();
  m.classList.toggle('presenter', LIVE.presenter);
  m.classList.remove('ended');
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  liveRenderFab();

  /* المشغّل: نفتحه بعد ضغطة المستخدم → الصوت يشتغل مباشرة */
  const player = document.getElementById('livePlayer');
  if(LIVE.presenter){
    player.innerHTML = `<div class="live-presenter-note"><i class="fas fa-microphone-lines"></i><b>وضع المقدّم</b><small>الفيديو مخفي هنا عشان ما يصير صدى للصوت — تابع الشات وردّ على الطلاب.</small></div>`;
  } else if(player.dataset.vid !== LIVE.stream.youtube_id){
    player.dataset.vid = LIVE.stream.youtube_id;
    const origin = encodeURIComponent(location.origin);
    player.innerHTML = `<iframe src="https://www.youtube.com/embed/${LIVE.stream.youtube_id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${origin}"
      title="البث المباشر" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <div class="live-sound-hint"><i class="fas fa-volume-high"></i> ما يطلع صوت؟ اضغط على الفيديو أو زر الصوت 🔊</div>`;
    setTimeout(() => { const h = player.querySelector('.live-sound-hint'); if(h) h.classList.add('hide'); }, 8000);
  }

  liveRenderHead();
  liveRenderChatTools();
  await liveLoadChat();
  liveSubscribeChat();
  liveJoinPresence();
  setTimeout(() => { const i = document.getElementById('liveInput'); if(i && window.innerWidth > 720) i.focus(); }, 200);
}
window.openLive = openLive;

function closeLive(){
  const m = document.getElementById('liveModal');
  if(m){
    m.classList.remove('open');
    const player = document.getElementById('livePlayer');
    if(player){ player.innerHTML = ''; player.dataset.vid = ''; }   /* يوقف الصوت */
  }
  LIVE.open = false;
  document.body.style.overflow = '';
  liveLeave();
  liveRenderFab();
}
window.closeLive = closeLive;

function liveShowEnded(){
  const m = document.getElementById('liveModal');
  if(!m) return;
  m.classList.add('ended');
  const player = document.getElementById('livePlayer');
  if(player){ player.innerHTML = ''; player.dataset.vid = ''; }
  liveLeave();
}

function liveRenderHead(){
  const s = LIVE.stream; if(!s) return;
  const t = document.getElementById('liveTitle'); if(t) t.textContent = s.title || 'بث مباشر';
  const since = document.getElementById('liveSince');
  if(since) since.textContent = (s.host_name ? 'مع ' + s.host_name + ' • ' : '') + liveSince(s.started_at);
  const send = document.getElementById('liveSend');
  const staff = typeof isPrivileged === 'function' && isPrivileged();
  if(send){
    const closed = s.chat_open === false && !staff;
    send.classList.toggle('closed', closed);
    const inp = document.getElementById('liveInput');
    if(inp){ inp.disabled = closed; inp.placeholder = closed ? 'الشات مقفل من الإدارة' : 'اكتب رسالتك...'; }
  }
}

function liveRenderChatTools(){
  const box = document.getElementById('liveChatTools'); if(!box) return;
  const staff = typeof isPrivileged === 'function' && isPrivileged();
  box.innerHTML = staff && LIVE.stream ? `
    <button class="live-tool" onclick="liveToggleChat()" title="قفل/فتح الشات"><i class="fas ${LIVE.stream.chat_open === false ? 'fa-lock' : 'fa-lock-open'}"></i></button>
    <button class="live-tool danger" onclick="liveEnd()" title="إنهاء البث"><i class="fas fa-circle-stop"></i></button>` : '';
}

/* ================== الشات ================== */
async function liveLoadChat(){
  const list = document.getElementById('liveMsgs');
  if(!list || !LIVE.stream) return;
  list.innerHTML = '<div class="live-empty"><i class="fas fa-spinner fa-spin"></i></div>';
  LIVE.msgs = []; LIVE.lastId = 0; LIVE.unread = 0; livePill();
  try{
    const { data, error } = await sb.from('live_chat').select('*')
      .eq('stream_id', LIVE.stream.id).order('id', { ascending: false }).limit(80);
    if(error) throw error;
    (data || []).reverse().forEach(m => liveAddMsg(m, true));
  }catch(e){}
  liveRenderMsgs();
  liveScrollBottom(true);
}

function liveAddMsg(m, silent){
  if(!m || !m.id || LIVE.msgs.some(x => x.id === m.id)) return false;
  LIVE.msgs.push(m);
  if(m.id > LIVE.lastId) LIVE.lastId = m.id;
  if(LIVE.msgs.length > 250) LIVE.msgs.splice(0, LIVE.msgs.length - 250);
  return true;
}

function liveMsgHTML(m){
  const me = currentUserObj && m.user_id === currentUserObj.id;
  const staff = typeof isPrivileged === 'function' && isPrivileged();
  const role = m.author_role === 'owner' ? '<span class="lm-role owner">رئيس المنصة</span>'
             : m.author_role === 'admin' ? '<span class="lm-role">إدارة</span>' : '';
  const av = m.author_avatar ? `style="background-image:url('${escapeHtml(m.author_avatar)}')"` : '';
  const initial = escapeHtml(String(m.author_name || '؟').trim().charAt(0) || '؟');
  return `<div class="lm ${me ? 'me' : ''} ${m.author_role && m.author_role !== 'user' ? 'staff' : ''}" data-id="${m.id}">
    <div class="lm-av" ${av}>${m.author_avatar ? '' : initial}</div>
    <div class="lm-body">
      <div class="lm-top"><b>${escapeHtml(m.author_name || 'طالب')}</b>${role}<small>${liveTime(m.created_at)}</small>
        ${staff || me ? `<button class="lm-del" onclick="liveDeleteMsg(${m.id})" title="حذف"><i class="fas fa-trash"></i></button>` : ''}</div>
      <div class="lm-txt">${escapeHtml(m.body)}</div>
    </div>
  </div>`;
}

function liveRenderMsgs(){
  const list = document.getElementById('liveMsgs'); if(!list) return;
  list.innerHTML = LIVE.msgs.length ? LIVE.msgs.map(liveMsgHTML).join('')
    : '<div class="live-empty"><i class="fas fa-comment-dots"></i><span>كن أول من يكتب في الشات 👋</span></div>';
}

function liveAppend(m){
  if(!liveAddMsg(m)) return;
  const list = document.getElementById('liveMsgs'); if(!list) return;
  const empty = list.querySelector('.live-empty'); if(empty) empty.remove();
  list.insertAdjacentHTML('beforeend', liveMsgHTML(m));
  while(list.children.length > 250) list.removeChild(list.firstChild);
  const mine = currentUserObj && m.user_id === currentUserObj.id;
  if(LIVE.stickBottom || mine) liveScrollBottom(mine);
  else { LIVE.unread++; livePill(); }
}

function liveScrollBottom(force){
  const list = document.getElementById('liveMsgs'); if(!list) return;
  requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  if(force){ LIVE.stickBottom = true; LIVE.unread = 0; livePill(); }
}

function livePill(){
  const p = document.getElementById('liveNewPill'); if(!p) return;
  p.classList.toggle('show', LIVE.unread > 0);
  const s = p.querySelector('span'); if(s) s.textContent = LIVE.unread > 1 ? `${LIVE.unread} رسائل جديدة` : 'رسالة جديدة';
}

function liveSubscribeChat(){
  liveUnsubChat();
  if(!LIVE.stream) return;
  const sid = LIVE.stream.id;
  LIVE.chatCh = sb.channel('live-chat-' + sid + '-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat', filter: 'stream_id=eq.' + sid }, p => liveAppend(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_chat' }, p => {
      const id = p.old && p.old.id; if(!id) return;
      LIVE.msgs = LIVE.msgs.filter(x => x.id !== id);
      const el = document.querySelector(`#liveMsgs .lm[data-id="${id}"]`); if(el) el.remove();
    })
    .subscribe(status => {
      /* Realtime ما اشتغل → نجيب الرسائل الجديدة كل 5 ثواني */
      clearInterval(LIVE.chatPoll);
      if(status !== 'SUBSCRIBED') LIVE.chatPoll = setInterval(liveFetchNew, 5000);
    });
}

async function liveFetchNew(){
  if(!LIVE.open || !LIVE.stream || document.hidden) return;
  try{
    const { data } = await sb.from('live_chat').select('*').eq('stream_id', LIVE.stream.id)
      .gt('id', LIVE.lastId).order('id', { ascending: true }).limit(50);
    (data || []).forEach(liveAppend);
  }catch(e){}
}

function liveUnsubChat(){
  clearInterval(LIVE.chatPoll); LIVE.chatPoll = null;
  if(LIVE.chatCh){ try{ sb.removeChannel(LIVE.chatCh); }catch(e){} LIVE.chatCh = null; }
}

async function liveSend(){
  const inp = document.getElementById('liveInput');
  if(!inp || !LIVE.stream || LIVE.sending) return;
  const body = inp.value.trim();
  if(!body) return;
  LIVE.sending = true;
  const btn = document.getElementById('liveSendBtn'); if(btn) btn.disabled = true;
  try{
    const { data, error } = await sb.from('live_chat').insert({ stream_id: LIVE.stream.id, body }).select().single();
    if(error) throw error;
    inp.value = '';
    liveAppend(data);
  }catch(e){
    const msg = String((e && e.message) || '');
    const why = /slow_down/.test(msg) ? 'على راحتك 😄 — رسالة كل 3 ثواني'
      : /muted/.test(msg) ? 'تم إيقافك عن الكتابة مؤقتاً'
      : /banned_word/.test(msg) ? 'رسالتك فيها كلمة غير مسموحة'
      : /chat_closed/.test(msg) ? 'الشات مقفل من الإدارة'
      : /stream_ended/.test(msg) ? 'انتهى البث'
      : /not_subscribed/.test(msg) ? 'الشات للمشتركين فقط'
      : /too_long/.test(msg) ? 'الرسالة طويلة (300 حرف كحد أقصى)'
      : 'ما انرسلت الرسالة، جرّب مرة ثانية';
    toast(why, 'warn');
  }finally{
    LIVE.sending = false;
    if(btn) btn.disabled = false;
    inp.focus();
  }
}

window.liveDeleteMsg = async (id) => {
  const { error } = await sb.from('live_chat').delete().eq('id', id);
  if(error){ toast('فشل الحذف: ' + error.message, 'err'); return; }
  LIVE.msgs = LIVE.msgs.filter(x => x.id !== id);
  const el = document.querySelector(`#liveMsgs .lm[data-id="${id}"]`); if(el) el.remove();
};

/* ================== عدد المشاهدين (Presence) ================== */
function liveJoinPresence(){
  liveLeavePresence();
  if(!LIVE.stream || !currentUserObj) return;
  const sid = LIVE.stream.id;
  LIVE.presCh = sb.channel('live-presence-' + sid, { config: { presence: { key: currentUserObj.id } } });
  LIVE.presCh
    .on('presence', { event: 'sync' }, () => {
      const state = LIVE.presCh ? LIVE.presCh.presenceState() : {};
      LIVE.viewers = Object.keys(state).length;
      const v = document.getElementById('liveViewers'); if(v) v.textContent = LIVE.viewers.toLocaleString('en');
      const a = document.getElementById('admLiveViewers'); if(a) a.textContent = LIVE.viewers.toLocaleString('en');
      clearTimeout(LIVE._peakT);
      LIVE._peakT = setTimeout(() => { try{ sb.rpc('live_report_viewers', { p_stream: sid, p_count: LIVE.viewers }); }catch(e){} }, 4000);
    })
    .subscribe(async status => {
      if(status === 'SUBSCRIBED' && LIVE.presCh){
        try{ await LIVE.presCh.track({ name: currentUserObj.name || '', at: Date.now() }); }catch(e){}
      }
    });
}
function liveLeavePresence(){
  if(LIVE.presCh){ try{ LIVE.presCh.untrack(); sb.removeChannel(LIVE.presCh); }catch(e){} LIVE.presCh = null; }
}
function liveLeave(){ liveUnsubChat(); liveLeavePresence(); }

/* ================== تحكم الإدارة ================== */
window.liveToggleChat = async () => {
  if(!LIVE.stream) return;
  const next = LIVE.stream.chat_open === false;
  const { error } = await sb.from('live_streams').update({ chat_open: next }).eq('id', LIVE.stream.id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  LIVE.stream.chat_open = next;
  liveRenderHead(); liveRenderChatTools();
  try{ renderAdminLive(); }catch(e){}
  toast(next ? '🔓 الشات مفتوح للجميع' : '🔒 تم قفل الشات (الإدارة فقط تكتب)', 'ok');
};

window.liveEnd = () => {
  if(!LIVE.stream) return;
  confirmBox('إنهاء البث', 'إنهاء البث المباشر؟ يختفي زر البث من عند الطلاب ويتقفل الشات.', async () => {
    const { error } = await sb.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', LIVE.stream.id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    if(typeof logAdminAction === 'function') logAdminAction('update_settings', null, 'إنهاء بث مباشر', { title: LIVE.stream.title });
    toast('⏹️ تم إنهاء البث', 'ok');
    const wasOpen = LIVE.open;
    liveSetStream(null);
    if(wasOpen) closeLive();
  }, true);
};

async function liveStart(){
  const url = (document.getElementById('admLiveUrl') || {}).value || '';
  const title = ((document.getElementById('admLiveTitle') || {}).value || '').trim() || 'بث مباشر';
  const notify = (document.getElementById('admLiveNotify') || {}).checked !== false;
  const vid = liveParseYouTube(url);
  if(!vid){ toast('رابط يوتيوب غير صحيح — انسخ رابط البث من يوتيوب', 'warn'); return; }
  const btn = document.getElementById('admLiveStart');
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البدء...'; }
  try{
    /* لو فيه بث قديم مفتوح نقفله أولاً */
    await sb.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('status', 'live');
    const { data, error } = await sb.from('live_streams').insert({
      youtube_id: vid, title, status: 'live', chat_open: true,
      started_by: currentUserObj.id, host_name: currentUserObj.name || ''
    }).select().single();
    if(error) throw error;
    if(notify && typeof sendNotification === 'function'){
      await sendNotification('live', '🔴 بث مباشر الآن: ' + title, 'اضغط هنا وشاهد البث وشارك في الشات', data.id, null, 'fa-tower-broadcast', '#ef4444');
    }
    if(typeof logAdminAction === 'function') logAdminAction('update_settings', null, 'بدء بث مباشر', { title, youtube_id: vid });
    LIVE.announced = data.id;
    liveSetStream(data);
    toast('🔴 بدأ البث — وصل إشعار للطلاب', 'ok');
  }catch(e){
    toast('فشل بدء البث: ' + (e.message || ''), 'err');
  }finally{
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-tower-broadcast"></i> ابدأ البث'; }
  }
}
window.liveStart = liveStart;

function renderAdminLive(){
  const box = document.getElementById('admLiveBox');
  if(!box) return;
  const s = LIVE.stream;
  if(s){
    box.innerHTML = `
      <div class="adm-live-on">
        <div class="alo-head">
          <span class="live-pill"><span class="lf-dot"></span> مباشر الآن</span>
          <div style="flex:1;min-width:0"><b>${escapeHtml(s.title || 'بث مباشر')}</b><small>${liveSince(s.started_at)} • youtu.be/${escapeHtml(s.youtube_id)}</small></div>
        </div>
        <div class="alo-stats">
          <div><i class="fas fa-eye"></i><b id="admLiveViewers">${LIVE.open ? LIVE.viewers : '—'}</b><small>يشاهدون الآن</small></div>
          <div><i class="fas fa-chart-line"></i><b>${Number(s.peak_viewers || 0).toLocaleString('en')}</b><small>أعلى عدد</small></div>
          <div><i class="fas ${s.chat_open === false ? 'fa-lock' : 'fa-comments'}"></i><b>${s.chat_open === false ? 'مقفل' : 'مفتوح'}</b><small>الشات</small></div>
        </div>
        <div class="alo-actions">
          <button class="btn btn-primary" onclick="openLive({ presenter: true })"><i class="fas fa-microphone-lines"></i> وضع المقدّم (الشات فقط)</button>
          <button class="btn btn-ghost" onclick="openLive()"><i class="fas fa-play"></i> شاهد كطالب</button>
          <button class="btn btn-ghost" onclick="liveToggleChat()"><i class="fas ${s.chat_open === false ? 'fa-lock-open' : 'fa-lock'}"></i> ${s.chat_open === false ? 'فتح الشات' : 'قفل الشات'}</button>
          <button class="btn btn-danger" onclick="liveEnd()"><i class="fas fa-circle-stop"></i> إنهاء البث</button>
        </div>
        <p class="alo-tip"><i class="fas fa-lightbulb"></i> وأنت تبث من يوتيوب افتح «وضع المقدّم» على جهاز ثاني أو شاشة ثانية — تشوف رسائل الطلاب لحظياً وتقدر ترد عليهم.</p>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="adm-live-new">
      <div class="form-group"><label>رابط البث من يوتيوب *</label>
        <input type="text" id="admLiveUrl" dir="ltr" placeholder="https://youtube.com/live/xxxxxxxxxxx">
        <small class="pf2-muted">يقبل: youtube.com/live/… • youtube.com/watch?v=… • youtu.be/…</small></div>
      <div class="form-group"><label>عنوان البث</label>
        <input type="text" id="admLiveTitle" maxlength="80" placeholder="مثال: مراجعة الكمي قبل الاختبار"></div>
      <label class="checkbox-row" style="display:flex;gap:8px;align-items:center;font-weight:700;font-size:.86rem;margin-bottom:14px">
        <input type="checkbox" id="admLiveNotify" checked> إرسال إشعار لكل الطلاب
      </label>
      <button class="btn btn-primary" id="admLiveStart" onclick="liveStart()" style="width:100%;padding:13px"><i class="fas fa-tower-broadcast"></i> ابدأ البث</button>
      <div class="alo-help">
        <b><i class="fas fa-circle-info"></i> قبل ما تبدأ:</b>
        <ul>
          <li>ابدأ البث في يوتيوب أولاً، وخلّه <b>عام</b> أو <b>غير مدرج (Unlisted)</b> — مو خاص.</li>
          <li>تأكد إن خيار <b>«السماح بالتضمين» (Allow embedding)</b> مفعّل في إعدادات البث.</li>
          <li>انسخ رابط البث وحطه هنا ← يطلع زر «مباشر» عند كل الطلاب ويوصلهم إشعار.</li>
        </ul>
      </div>
    </div>`;
}
window.renderAdminLive = renderAdminLive;

/* تسجيل خروج → نقفل كل شي */
function liveReset(){
  try{ if(LIVE.open) closeLive(); }catch(e){}
  liveLeave();
  if(LIVE.streamsCh){ try{ sb.removeChannel(LIVE.streamsCh); }catch(e){} LIVE.streamsCh = null; }
  clearInterval(LIVE.pollTimer); LIVE.pollTimer = null;
  LIVE.stream = null; LIVE.started = false;
  liveRenderFab();
}
window.liveReset = liveReset;

/* ================== الربط ================== */
document.addEventListener('keydown', e => { if(e.key === 'Escape' && LIVE.open) closeLive(); });

/* البث يتقفل لو المستخدم طلع */
window.addEventListener('pagehide', () => { liveLeave(); });

document.addEventListener('DOMContentLoaded', () => {
  /* يبدأ بعد الدخول (ويعيد التشغيل لو سجّل خروج ودخل بحساب ثاني) */
  setInterval(() => {
    if(currentUserObj && !LIVE.started){
      LIVE.started = true;
      liveLoadActive();
      liveSubscribeStreams();
    }
  }, 1500);
  /* تحديث «منذ كم دقيقة» */
  setInterval(() => { if(LIVE.open) liveRenderHead(); }, 60000);

  /* تبويب الأدمن */
  document.addEventListener('click', e => {
    const b = e.target.closest('.admin-tabs button[data-panel="live"]');
    if(b) setTimeout(renderAdminLive, 0);
  });
});
