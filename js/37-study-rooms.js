/* ============================================================
   37) STUDY ROOMS — المذاكرة الجماعية (مؤقت مشترك)
   - إنشاء غرفة (عامة أو خاصة) بمدة حتى 3 ساعات
   - دخول برمز الغرفة (حتى لو بدأت الجلسة)
   - انضمام عشوائي: يدخلك غرفة عامة ما بدأت بعد
   - أو تذاكر لوحدك (المؤقت العادي / أو غرفة لك وحدك)
   - نفس الوقت للجميع (من ends_at في السيرفر) + Realtime + فحص احتياطي
   - لو المضيف خرج تنتقل الإدارة تلقائياً لأقدم عضو
   - النقاط حسب الوقت الفعلي اللي ذاكرته داخل الغرفة
============================================================ */

const SR = {
  room: null,
  members: [],
  channel: null,
  pollTimer: null,
  tickTimer: null,
  beatTimer: null,
  studiedSec: 0,
  runKey: null,
  credited: {},
  lastTickAt: 0
};

const SR_STALE_MS = 90 * 1000;

function srEl(id){ return document.getElementById(id); }
function srIsHost(){ return SR.room && currentUserObj && SR.room.host_id === currentUserObj.id; }
function srCode(){ return String(Math.floor(100000 + Math.random() * 900000)); }

function srCanUse(){
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return false; }
  if(typeof isSubscribed === 'function' && !isSubscribed()){ toast('المذاكرة الجماعية للمشتركين', 'warn'); return false; }
  return true;
}

/* ================== إنشاء ================== */
async function srCreateRoom(opts){
  if(!srCanUse() || SR.room) return;
  if(!opts || opts instanceof Event) opts = {};
  const schedule = opts.schedule || null;
  const minutes = schedule ? schedule.focus : Math.min(180, Math.max(5, parseInt((srEl('srMinutes') || {}).value, 10) || 25));
  /* ⭐ الافتراضي «خاصة» — العامة فقط لو اختارها الطالب صراحةً */
  const privSel = document.querySelector('input[name="srPrivacy"]:checked');
  const isPublic = typeof opts.isPublic === 'boolean' ? opts.isPublic : (privSel ? privSel.value === 'public' : !!(srEl('srPublic') && srEl('srPublic').checked));
  const btn = srEl('srCreateBtn'); if(btn) btn.disabled = true;

  let room = null, err = null;
  for(let i = 0; i < 4 && !room; i++){
    const row = {
      code: srCode(),
      host_id: currentUserObj.id,
      host_name: currentUserObj.name || 'طالب',
      focus_minutes: minutes,
      is_public: isPublic,
      status: 'waiting',
      max_members: 10
    };
    if(schedule){ row.schedule = schedule; row.phase_index = 0; }
    const r = await sb.from('study_rooms').insert(row).select().single();
    if(r.error) err = r.error; else room = r.data;
    if(err && /schedule|phase_index/.test(err.message || '')) break;
  }
  if(!room && err && /schedule|phase_index/.test(err.message || '')){
    if(btn) btn.disabled = false;
    toast('ميزة الجدول تحتاج تشغيل ملف supabase-update-8.sql', 'err');
    return;
  }
  if(btn) btn.disabled = false;
  if(!room){ toast('تعذّر إنشاء الغرفة: ' + (err ? err.message : ''), 'err'); return; }
  await srJoinRoomRow(room);
}
window.srCreateRoom = srCreateRoom;

/* ================== دخول برمز ================== */
async function srJoinByCode(){
  if(!srCanUse() || SR.room) return;
  const code = ((srEl('srCode') || {}).value || '').trim();
  if(!/^\d{6}$/.test(code)){ toast('أدخل رمز غرفة صحيح (6 أرقام)', 'warn'); return; }
  const { data, error } = await sb.from('study_rooms').select('*').eq('code', code)
    .neq('status', 'closed').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if(error || !data){ toast('الغرفة غير موجودة أو انتهت', 'err'); return; }
  await srJoinRoomRow(data);
}
window.srJoinByCode = srJoinByCode;

/* ================== انضمام عشوائي ================== */
async function srJoinRandom(){
  if(!srCanUse() || SR.room) return;
  const btn = srEl('srRandomBtn'); if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> نبحث عن غرفة...'; }
  try{
    const since = new Date(Date.now() - 3 * 3600000).toISOString();
    const { data: rooms } = await sb.from('study_rooms').select('*')
      .eq('status', 'waiting').eq('is_public', true).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(25);

    const candidates = [];
    for(const r of (rooms || [])){
      /* ⭐ تأكيد مزدوج: لا ندخل غرفة خاصة أبداً */
      if(r.is_public !== true || r.status !== 'waiting') continue;
      const { data: mem } = await sb.from('study_room_members').select('user_id,last_seen').eq('room_id', r.id);
      const active = (mem || []).filter(m => Date.now() - Date.parse(m.last_seen || 0) < SR_STALE_MS);
      if(active.length && active.length < (r.max_members || 10) && !active.some(m => m.user_id === currentUserObj.id)){
        candidates.push({ r, n: active.length });
      }
    }
    if(!candidates.length){
      openModal({
        title: 'لا توجد غرف متاحة الآن',
        text: 'ما فيه غرفة عامة تنتظر حالياً. تبي تنشئ غرفة عامة وينضم لك غيرك؟',
        okText: 'إنشاء غرفة عامة',
        onOk: () => { const pub = document.querySelector('input[name="srPrivacy"][value="public"]'); if(pub) pub.checked = true; srCreateRoom(); }
      });
      return;
    }
    /* الغرفة الأكثر أعضاء أولاً (عشان تمتلئ الغرف) ثم عشوائي */
    candidates.sort((a, b) => b.n - a.n || Math.random() - .5);
    await srJoinRoomRow(candidates[0].r);
  } finally {
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-shuffle"></i> انضمام عشوائي'; }
  }
}
window.srJoinRandom = srJoinRandom;

/* ================== دخول الغرفة ================== */
async function srJoinRoomRow(room){
  const { data: mem } = await sb.from('study_room_members').select('user_id,last_seen').eq('room_id', room.id);
  const active = (mem || []).filter(m => Date.now() - Date.parse(m.last_seen || 0) < SR_STALE_MS);
  const already = active.some(m => m.user_id === currentUserObj.id);
  if(!already && active.length >= (room.max_members || 10)){ toast('الغرفة ممتلئة', 'warn'); return; }

  const { error } = await sb.from('study_room_members').upsert({
    room_id: room.id,
    user_id: currentUserObj.id,
    name: currentUserObj.name || 'طالب',
    avatar_url: currentUserObj.avatar_url || null,
    last_seen: new Date().toISOString()
  }, { onConflict: 'room_id,user_id' });
  if(error){ toast('تعذّر الدخول: ' + error.message, 'err'); return; }

  SR.room = room;
  SR.joinedAt = Date.now();
  SR.studiedSec = 0;
  SR.runKey = null;
  try{ localStorage.setItem('sr_room_' + currentUserObj.id, room.id); }catch(e){}

  /* أوقف المؤقت الشخصي حتى لا يتعارض */
  try{ if(typeof TIMER !== 'undefined' && TIMER.running) startTimer(); }catch(e){}

  srSubscribe();
  srStartLoops();
  await srLoadMembers();
  srRender();
  toast(room.host_id === currentUserObj.id ? '✓ تم إنشاء الغرفة' : '✓ دخلت الغرفة', 'ok');
}

function srSubscribe(){
  if(SR.channel){ try{ sb.removeChannel(SR.channel); }catch(e){} SR.channel = null; }
  if(!SR.room) return;
  const id = SR.room.id;
  SR.channel = sb.channel('sr-' + id + '-' + Date.now())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'study_rooms', filter: 'id=eq.' + id },
      p => srApplyRoom(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'study_rooms', filter: 'id=eq.' + id },
      () => { toast('أُغلقت الغرفة', 'warn'); srCleanup(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'study_room_members', filter: 'room_id=eq.' + id },
      debounce(() => srLoadMembers().then(srRenderMembers), 300))
    .subscribe();
}

function srStartLoops(){
  srStopLoops();
  /* فحص احتياطي كل 3 ثواني */
  SR.pollTimer = setInterval(async () => {
    if(!SR.room) return;
    const { data, error } = await sb.from('study_rooms').select('*').eq('id', SR.room.id).maybeSingle();
    if(error) return;
    if(!data || data.status === 'closed'){ toast('أُغلقت الغرفة', 'warn'); srCleanup(); return; }
    srApplyRoom(data);
  }, 3000);
  /* نبضة حضور كل 25 ثانية */
  SR.beatTimer = setInterval(srHeartbeat, 25000);
  /* عداد الشاشة */
  SR.lastTickAt = Date.now();
  SR.tickTimer = setInterval(srTick, 1000);
}
function srStopLoops(){
  clearInterval(SR.pollTimer); clearInterval(SR.beatTimer); clearInterval(SR.tickTimer);
  SR.pollTimer = SR.beatTimer = SR.tickTimer = null;
}

async function srHeartbeat(){
  if(!SR.room || !currentUserObj) return;
  try{
    await sb.from('study_room_members').update({ last_seen: new Date().toISOString() })
      .eq('room_id', SR.room.id).eq('user_id', currentUserObj.id);
  }catch(e){}
  await srLoadMembers();
  srRenderMembers();
  srMaybeTakeOver();
}

async function srLoadMembers(){
  if(!SR.room) return;
  const { data, error } = await sb.from('study_room_members').select('*').eq('room_id', SR.room.id).order('joined_at', { ascending: true });
  if(error) return;
  /* ⭐ لو المضيف أخرجني من الغرفة */
  if(SR.joinedAt && Date.now() - SR.joinedAt > 5000 && !(data || []).some(m => m.user_id === currentUserObj.id)){
    toast('تم إخراجك من الغرفة', 'warn');
    if(SR.room.status === 'running') srCredit();
    srCleanup();
    return;
  }
  SR.members = (data || []).filter(m => m.user_id === currentUserObj.id || Date.now() - Date.parse(m.last_seen || 0) < SR_STALE_MS);
}

/* لو المضيف اختفى → أقدم عضو نشط يصير مضيف */
async function srMaybeTakeOver(){
  if(!SR.room || srIsHost()) return;
  const hostActive = SR.members.some(m => m.user_id === SR.room.host_id);
  if(hostActive) return;
  const first = SR.members[0];
  if(!first || first.user_id !== currentUserObj.id) return;
  const { data } = await sb.from('study_rooms').update({ host_id: currentUserObj.id, host_name: currentUserObj.name || 'طالب' })
    .eq('id', SR.room.id).eq('host_id', SR.room.host_id).select().maybeSingle();
  if(data){ toast('👑 أصبحت مضيف الغرفة', 'ok'); srApplyRoom(data); }
}

function srApplyRoom(n){
  if(!SR.room || !n || n.id !== SR.room.id) return;
  const old = SR.room;
  SR.room = n;
  if(n.status === 'closed'){ toast('أُغلقت الغرفة', 'warn'); srCleanup(); return; }
  if(old.status !== n.status || old.host_id !== n.host_id || old.ends_at !== n.ends_at || old.phase_index !== n.phase_index){
    if(n.schedule && n.status === 'running' && old.status === 'running' && old.phase_index !== n.phase_index){
      const p = schPhases(n.schedule)[n.phase_index || 0];
      if(p) toast(p.type === 'break' ? `☕ بريك ${p.min} دقائق — ارتاح شوي` : `🔥 بدأت الجلسة ${p.n} — ركّز!`, 'ok');
      try{ beep(); }catch(e){}
    }
    if(n.status === 'finished' && old.status === 'running' && n.schedule) toast('🎉 خلصتوا الجدول كامل — فخورين فيكم!', 'ok');
    if(n.status === 'running' && old.status !== 'running'){ toast('▶️ بدأت الجلسة الجماعية — بالتوفيق!', 'ok'); try{ beep(); }catch(e){} }
    if(n.status === 'paused' && old.status === 'running') toast('⏸️ أوقف المضيف الجلسة مؤقتاً', 'warn');
    srRender();
  }
}

/* ================== الوقت ================== */
/* 📅 مراحل الجدول (جلسة/بريك) — null لو الغرفة بدون جدول */
function srPhases(){ return SR.room && SR.room.schedule && typeof schPhases === 'function' ? schPhases(SR.room.schedule) : null; }
function srPhase(){
  const ph = srPhases();
  if(!ph) return null;
  return ph[Math.max(0, Math.min(ph.length - 1, SR.room.phase_index || 0))];
}
function srIsBreak(){ const p = srPhase(); return !!(p && p.type === 'break'); }

function srRemainingSec(){
  const r = SR.room;
  if(!r) return 0;
  if(r.status === 'running' && r.ends_at) return Math.max(0, Math.round((Date.parse(r.ends_at) - Date.now()) / 1000));
  if(r.status === 'paused') return Math.max(0, r.paused_remaining || 0);
  if(r.status === 'finished') return 0;
  const ph = srPhases();
  if(ph) return ph[0].min * 60;
  return (r.focus_minutes || 25) * 60;
}

function srTick(){
  if(!SR.room) return;
  const now = Date.now();
  const dt = Math.min(5, (now - SR.lastTickAt) / 1000);
  SR.lastTickAt = now;

  if(SR.room.status === 'running'){
    SR.runKey = SR.room.id + ':' + (SR.room.started_at || '') + (SR.room.schedule ? ':' + (SR.room.phase_index || 0) : '');
    const brk = srIsBreak();
    /* ⭐ بداية جولة/جلسة (أو دخول أثناءها) → السيرفر يسجّل وقت البداية */
    if(!brk && SR.xpKey !== SR.runKey && typeof xpFocusStart === 'function'){
      SR.xpKey = SR.runKey;
      xpFocusStart(Math.max(1, Math.ceil(srRemainingSec() / 60)), 'room');
    }
    if(!brk && !document.hidden) SR.studiedSec += dt;   /* نحسب وقت التركيز الفعلي فقط (بدون البريك) */
    if(srRemainingSec() <= 0) srOnFinished();
  } else if(SR.room.status === 'waiting' && SR.room.schedule && SR.room.schedule.start_at && srIsHost()){
    /* ⏰ بداية تلقائية في الوقت المحدد */
    if(Date.now() >= Date.parse(SR.room.schedule.start_at) && SR.autoStartKey !== SR.room.id + SR.room.schedule.start_at){
      SR.autoStartKey = SR.room.id + SR.room.schedule.start_at;
      window.srStart();
    }
  }
  /* تحديث أوقات بطاقة الجدول كل 30 ثانية */
  if(SR.room.schedule && now - (SR.cardAt || 0) > 30000){
    SR.cardAt = now;
    const card = srEl('srSchCard');
    if(card && typeof schCardHTML === 'function') card.innerHTML = schCardHTML(SR.room);
  }
  srRenderTime();
}

async function srOnFinished(){
  if(SR.room && SR.room.schedule) return srPhaseEnd();
  srCredit();
  if(srIsHost() && SR.room.status === 'running'){
    const { data } = await sb.from('study_rooms').update({ status: 'finished' })
      .eq('id', SR.room.id).eq('status', 'running').select().maybeSingle();
    if(data) srApplyRoom(data);
  }
}

/* 📅 نهاية مرحلة في الجدول → ننتقل للي بعدها (المضيف، أو أي عضو لو المضيف تأخر) */
async function srPhaseEnd(){
  const r = SR.room;
  const ph = srPhases();
  if(!r || !ph) return;
  const idx = r.phase_index || 0;
  const key = r.id + ':' + (r.started_at || '') + ':' + idx;
  if(SR.phaseEndKey !== key){
    SR.phaseEndKey = key;
    SR.phaseEndAt = Date.now();
    if(ph[idx] && ph[idx].type === 'focus') srCredit();
    if(srIsHost()) await srAdvance(idx);
    return;
  }
  if(!srIsHost() && Date.now() - SR.phaseEndAt > 6000 && Date.now() - (SR.advanceTry || 0) > 5000){
    SR.advanceTry = Date.now();
    await srAdvance(idx);
  }
}

async function srAdvance(idx){
  const ph = srPhases();
  if(!ph || !SR.room) return;
  const next = idx + 1;
  const patch = next >= ph.length
    ? { status: 'finished' }
    : { phase_index: next, ends_at: new Date(Date.now() + ph[next].min * 60000).toISOString() };
  const { data } = await sb.from('study_rooms').update(patch)
    .eq('id', SR.room.id).eq('status', 'running').eq('phase_index', idx).select().maybeSingle();
  if(data) srApplyRoom(data);
}

/* ⭐ احتساب الجلسة للطالب — مرة واحدة لكل جولة */
function srCredit(){
  const key = SR.runKey;
  if(!key || SR.credited[key]) return;
  SR.credited[key] = true;
  try{ if(localStorage.getItem('sr_cred_' + key)) return; localStorage.setItem('sr_cred_' + key, '1'); }catch(e){}

  const minutes = Math.round(SR.studiedSec / 60);
  const target = SR.room.focus_minutes || 25;
  SR.studiedSec = 0;
  if(minutes < 1){ try{ if(typeof xpFocusFinish === 'function') xpFocusFinish('مذاكرة جماعية'); }catch(e){} return; }

  addMinutesToday(minutes);
  if(minutes >= target * 0.6){
    userData.sessions = (userData.sessions || 0) + 1;
    todayLog().sessions = (todayLog().sessions || 0) + 1;
  }
  /* ⭐ النقاط: دقيقة = نقطة (يحسبها السيرفر من الوقت الحقيقي) */
  try{ if(typeof xpFocusFinish === 'function') xpFocusFinish('مذاكرة جماعية'); }catch(e){}
  try{ beep(); }catch(e){}
  savePrefs();
  try{ renderHomeStats(); checkBadges(); renderBadges(); }catch(e){}
}

/* ================== تحكم المضيف ================== */
async function srHostUpdate(patch, guard){
  if(!srIsHost()) return;
  let q = sb.from('study_rooms').update(patch).eq('id', SR.room.id);
  if(guard) q = q.eq('status', guard);
  const { data, error } = await q.select().maybeSingle();
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  if(data) srApplyRoom(data);
}

window.srStart = () => {
  const ph = srPhases();
  const secs = ph ? ph[0].min * 60 : (SR.room.focus_minutes || 25) * 60;
  const now = new Date();
  SR.studiedSec = 0;
  const patch = { status: 'running', started_at: now.toISOString(), ends_at: new Date(now.getTime() + secs * 1000).toISOString(), paused_remaining: null };
  if(ph) patch.phase_index = 0;
  srHostUpdate(patch, 'waiting');
};
window.srPause = () => srHostUpdate({ status: 'paused', paused_remaining: srRemainingSec() }, 'running');
window.srResume = () => {
  const left = SR.room.paused_remaining || 0;
  srHostUpdate({ status: 'running', ends_at: new Date(Date.now() + left * 1000).toISOString() }, 'paused');
};
window.srEndNow = () => confirmBox('إنهاء الجلسة', 'إنهاء الجلسة الآن للجميع؟ يُحتسب لكل عضو الوقت الذي ذاكره.', () => {
  srCredit();
  srHostUpdate({ status: 'finished' });
});
window.srNewRound = () => {
  const patch = { status: 'waiting', started_at: null, ends_at: null, paused_remaining: null };
  if(SR.room && SR.room.schedule){
    patch.phase_index = 0;
    patch.schedule = Object.assign({}, SR.room.schedule, { start_at: null });
  }
  srHostUpdate(patch);
};
window.srSetMinutes = (m) => {
  m = Math.min(180, Math.max(5, parseInt(m, 10) || 25));
  srHostUpdate({ focus_minutes: m }, 'waiting');
};

window.srTogglePrivacy = () => {
  if(!srIsHost()) return;
  const toPublic = !SR.room.is_public;
  srHostUpdate({ is_public: toPublic });
  toast(toPublic ? '🌐 أصبحت الغرفة عامة' : '🔒 أصبحت الغرفة خاصة — الدخول بالرمز فقط', 'ok');
};
window.srKick = (userId) => {
  if(!srIsHost() || userId === currentUserObj.id) return;
  const m = SR.members.find(x => x.user_id === userId);
  confirmBox('إخراج عضو', `إخراج ${escapeHtml(m ? m.name : 'العضو')} من الغرفة؟`, async () => {
    const { error } = await sb.from('study_room_members').delete().eq('room_id', SR.room.id).eq('user_id', userId);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    await srLoadMembers(); srRenderMembers();
    toast('تم إخراج العضو', 'ok');
  });
};

window.srCopyCode = () => {
  if(!SR.room) return;
  try{ navigator.clipboard.writeText(SR.room.code); toast('✓ تم نسخ رمز الغرفة', 'ok'); }catch(e){}
};

/* ================== الخروج ================== */
async function srDoLeave(){
  if(!SR.room) return;
  const room = SR.room;
  if(room.status === 'running') srCredit();
  try{
    await srLoadMembers();
    const others = SR.members.filter(m => m.user_id !== currentUserObj.id);
    if(srIsHost()){
      if(others.length){
        await sb.from('study_rooms').update({ host_id: others[0].user_id, host_name: others[0].name }).eq('id', room.id);
      } else {
        await sb.from('study_rooms').update({ status: 'closed' }).eq('id', room.id);
      }
    }
    await sb.from('study_room_members').delete().eq('room_id', room.id).eq('user_id', currentUserObj.id);
  }catch(e){}
  srCleanup();
  toast('خرجت من الغرفة', 'ok');
}
window.srDoLeave = srDoLeave;
window.srLeave = () => {
  if(SR.room && SR.room.status === 'running'){
    confirmBox('مغادرة الغرفة', 'الجلسة شغالة. تبي تطلع؟ يُحتسب لك الوقت اللي ذاكرته.', srDoLeave);
  } else srDoLeave();
};

function srCleanup(){
  srStopLoops();
  if(SR.channel){ try{ sb.removeChannel(SR.channel); }catch(e){} SR.channel = null; }
  try{ if(currentUserObj) localStorage.removeItem('sr_room_' + currentUserObj.id); }catch(e){}
  SR.room = null; SR.members = []; SR.studiedSec = 0; SR.runKey = null;
  srRender();
}
window.srCleanup = srCleanup;

/* إغلاق الصفحة → خروج من الغرفة (أفضل محاولة) */
window.addEventListener('pagehide', () => {
  try{
    if(SR.room && currentUserObj){
      if(SR.room.status === 'running') srCredit();
      sb.from('study_room_members').delete().eq('room_id', SR.room.id).eq('user_id', currentUserObj.id).then(() => {});
    }
  }catch(e){}
});

/* ================== الواجهة ================== */
function srRender(){
  const lobby = srEl('srLobby');
  const roomBox = srEl('srRoom');
  if(!lobby || !roomBox) return;
  if(!SR.room){
    lobby.style.display = '';
    roomBox.style.display = 'none';
    roomBox.innerHTML = '';
    return;
  }
  lobby.style.display = 'none';
  roomBox.style.display = '';

  const r = SR.room;
  const host = srIsHost();
  const statusTxt = { waiting: '⏳ بانتظار البدء', running: '▶️ جارية', paused: '⏸️ متوقفة مؤقتاً', finished: '✅ انتهت' }[r.status] || r.status;
  const minuteOpts = [25, 40, 50, 60, 90, 120, 180];

  let controls = '';
  if(host){
    if(r.status === 'waiting' && r.schedule){
      controls = `<button class="btn btn-primary" onclick="srStart()"><i class="fas fa-play"></i> ابدأ الجدول الآن</button>`;
    } else if(r.status === 'waiting'){
      controls = `
        <select class="sort-select" onchange="srSetMinutes(this.value)">
          ${minuteOpts.map(m => `<option value="${m}" ${m === r.focus_minutes ? 'selected' : ''}>${m >= 60 ? (m / 60) + ' ساعة' : m + ' دقيقة'}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="srStart()"><i class="fas fa-play"></i> ابدأ الجلسة</button>`;
    } else if(r.status === 'running'){
      controls = `<button class="btn btn-ghost" onclick="srPause()"><i class="fas fa-pause"></i> إيقاف مؤقت</button>
                  <button class="btn btn-danger" onclick="srEndNow()"><i class="fas fa-stop"></i> إنهاء</button>`;
    } else if(r.status === 'paused'){
      controls = `<button class="btn btn-primary" onclick="srResume()"><i class="fas fa-play"></i> استئناف</button>
                  <button class="btn btn-danger" onclick="srEndNow()"><i class="fas fa-stop"></i> إنهاء</button>`;
    } else if(r.status === 'finished'){
      controls = `<button class="btn btn-primary" onclick="srNewRound()"><i class="fas fa-rotate"></i> جولة جديدة</button>`;
    }
  } else {
    controls = `<span class="sr-wait-host"><i class="fas fa-crown"></i> المضيف: ${escapeHtml(r.host_name || '—')} يتحكم بالجلسة</span>`;
  }

  roomBox.innerHTML = `
    <div class="sr-room-head">
      <div>
        <small>${r.is_public ? '🌐 غرفة عامة' : '🔒 غرفة خاصة'} • ${statusTxt}</small>
        <h3>غرفة المذاكرة <span class="sr-code" onclick="srCopyCode()" title="نسخ الرمز">${escapeHtml(r.code)} <i class="fas fa-copy"></i></span></h3>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${host ? `<button class="btn btn-ghost btn-sm" onclick="srTogglePrivacy()">${r.is_public ? '<i class="fas fa-lock"></i> اجعلها خاصة' : '<i class="fas fa-globe"></i> اجعلها عامة'}</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="srLeave()"><i class="fas fa-door-open"></i> مغادرة</button>
      </div>
    </div>
    ${r.schedule && typeof schCardHTML === 'function' ? `<div id="srSchCard">${schCardHTML(r)}</div>` : ''}
    <div class="sr-body">
      <div class="sr-clock ${r.status} ${srIsBreak() && r.status !== 'waiting' ? 'is-break' : ''}">
        ${r.schedule ? `<div class="sr-phase" id="srPhase"></div>` : ''}
        <div class="sr-time" id="srTime">${fmtTime(srRemainingSec())}</div>
        <div class="sr-bar"><i id="srBar"></i></div>
        <small id="srStudied"></small>
      </div>
      <div class="sr-members" id="srMembers"></div>
    </div>
    <div class="sr-controls">${controls}</div>
  `;
  srRenderMembers();
  srRenderTime();
}

function srRenderTime(){
  if(!SR.room) return;
  const t = srEl('srTime'); if(t) t.textContent = fmtTime(srRemainingSec());
  const cur = srPhase();
  const total = cur && SR.room.status !== 'waiting' ? cur.min * 60 : (srPhases() ? srPhases()[0].min * 60 : (SR.room.focus_minutes || 25) * 60);
  const ph = srEl('srPhase');
  if(ph && cur){
    const n = srPhases().filter(p => p.type === 'focus').length;
    const clock = ph.closest('.sr-clock');
    if(clock) clock.classList.toggle('is-break', cur.type === 'break' && SR.room.status !== 'waiting');
    ph.innerHTML = SR.room.status === 'waiting'
      ? (SR.room.schedule.start_at && Date.parse(SR.room.schedule.start_at) > Date.now()
          ? `⏰ يبدأ تلقائياً بعد <b>${fmtTime(Math.round((Date.parse(SR.room.schedule.start_at) - Date.now()) / 1000))}</b>`
          : `📅 جاهزين — ${n} جلسات`)
      : SR.room.status === 'finished' ? '🎉 انتهى الجدول'
      : cur.type === 'break' ? `☕ بريك ${cur.min} دقائق` : `🔥 الجلسة ${cur.n} من ${n}`;
  }
  const bar = srEl('srBar'); if(bar) bar.style.width = Math.min(100, ((total - srRemainingSec()) / total) * 100) + '%';
  const st = srEl('srStudied');
  if(st) st.textContent = SR.studiedSec >= 60 ? `ذاكرت ${Math.floor(SR.studiedSec / 60)} دقيقة في هذه الجولة` : (SR.room.status === 'waiting' ? `مدة الجلسة: ${SR.room.focus_minutes} دقيقة` : '');
}

function srRenderMembers(){
  const box = srEl('srMembers');
  if(!box || !SR.room) return;
  box.innerHTML = `<div class="sr-members-title"><i class="fas fa-users"></i> ${SR.members.length} يذاكرون الآن</div>` +
    SR.members.map(m => {
      const av = m.avatar_url ? `background-image:url('${m.avatar_url}')` : '';
      const isHost = m.user_id === SR.room.host_id;
      const isMe = m.user_id === currentUserObj.id;
      return `<div class="sr-member ${isMe ? 'me' : ''}">
        <div class="sr-av" style="${av}">${av ? '' : escapeHtml(String(m.name || '؟').charAt(0))}</div>
        <span>${escapeHtml(m.name || 'طالب')}${isMe ? ' (أنت)' : ''}</span>
        ${isHost ? '<i class="fas fa-crown sr-crown"></i>' : ''}
        ${srIsHost() && !isMe ? `<button class="sr-kick" onclick="srKick('${m.user_id}')" title="إخراج"><i class="fas fa-user-xmark"></i></button>` : ''}
      </div>`;
    }).join('');
}

/* ================== تهيئة ================== */
document.addEventListener('DOMContentLoaded', () => {
  const c = srEl('srCreateBtn'); if(c) c.addEventListener('click', srCreateRoom);
  const j = srEl('srJoinBtn'); if(j) j.addEventListener('click', srJoinByCode);
  const r = srEl('srRandomBtn'); if(r) r.addEventListener('click', srJoinRandom);
  const code = srEl('srCode');
  if(code){
    code.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    code.addEventListener('keydown', e => { if(e.key === 'Enter') srJoinByCode(); });
  }
});

/* لو رجع الطالب للصفحة وهو داخل غرفة (تحديث الصفحة) → أعِده لها */
async function srRestore(){
  if(!currentUserObj || SR.room) return;
  let id = null;
  try{ id = localStorage.getItem('sr_room_' + currentUserObj.id); }catch(e){}
  if(!id) return;
  const { data } = await sb.from('study_rooms').select('*').eq('id', id).maybeSingle();
  if(data && data.status !== 'closed') await srJoinRoomRow(data);
  else { try{ localStorage.removeItem('sr_room_' + currentUserObj.id); }catch(e){} }
}
window.srRestore = srRestore;
