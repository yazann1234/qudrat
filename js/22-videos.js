/* ============================================================
   22) VIDEOS — نظام الفيديوهات + مشغل YouTube + XP
============================================================ */

const VP = {
  player: null,
  ready: false,
  video: null,
  duration: 0,
  lastPosition: 0,
  maxWatched: 0,
  completed: false,
  tickInterval: null,
  syncTimer: null,
  xpAwarded: false,
  xpAmount: 50,
  splitOpen: false,
  linkedFileId: null,
  linkedFileDoc: null,
  linkedFilePage: 1,
  linkedFileTotal: 0,
  linkedFilePages: [],
  linkedFileToken: 0,
  linkedFileObserver: null,
  linkedFileBaseWidth: 500,
  linkedFileZoom: 1
};

let videoFilter = 'all', videoSort = 'new';

/* ================= استخراج معرف يوتيوب ================= */
function extractYoutubeId(url){
  if(!url) return '';
  const s = String(url).trim();
  let m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  if(m) return m[1];
  if(/^[\w-]{11}$/.test(s)) return s;
  return '';
}
function youtubeThumb(id){ return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
function fmtDuration(sec){
  if(!sec || isNaN(sec)) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  if(h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  return m + ':' + String(s).padStart(2,'0');
}

/* ================= بطاقة الفيديو ================= */
function videoCard(v, prog){
  const id = v.youtube_id;
  const thumb = v.thumbnail || youtubeThumb(id);
  const pct = prog ? (prog.pct || 0) : 0;
  const done = prog ? prog.completed : false;
  const xpEarned = done;
  const dur = v.duration ? fmtDuration(v.duration) : '';
  return `
  <div class="video-card" onclick="openVideo('${v.id}')">
    <div class="video-thumb" style="background-image:url('${thumb}')">
      <img src="${thumb}" alt="${escapeHtml(v.title)}" loading="lazy">
      <div class="video-play"><i class="fas fa-play"></i></div>
      ${v.important ? '<div class="video-important"><i class="fas fa-star"></i> مهم</div>' : ''}
      <div class="video-xp-badge ${xpEarned ? 'earned' : ''}">
        <i class="fas fa-star"></i> ${xpEarned ? '+' + VP.xpAmount + ' ✓' : '+ ' + VP.xpAmount + ' XP'}
      </div>
      ${dur ? `<div class="video-duration">${dur}</div>` : ''}
      <div class="video-progress-strip"><i style="width:${pct}%"></i></div>
    </div>
    <div class="video-info">
      <h3>${escapeHtml(v.title)}</h3>
      <p>${escapeHtml(v.description || '—')}</p>
      <div class="video-meta">
        <span class="chip-cat">${escapeHtml(v.category || 'عام')}</span>
        ${pct > 0 ? `<span><i class="fas fa-eye"></i> ${pct}%</span>` : ''}
      </div>
    </div>
  </div>`;
}

/* ================= عرض قائمة الفيديوهات ================= */
function renderVideos(){
  const grid = $('#videosGrid'); if(!grid) return;
  let list = (DB.videos || []).slice();
  if(videoFilter !== 'all') list = list.filter(v => v.category === videoFilter);
  if(videoSort === 'new') list.sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
  else if(videoSort === 'old') list.sort((a,b)=> new Date(a.created_at||0) - new Date(b.created_at||0));
  else if(videoSort === 'alpha') list.sort((a,b)=> String(a.title).localeCompare(String(b.title), 'ar'));

  const cnt = $('#videosCountLabel'); if(cnt) cnt.textContent = list.length + ' فيديو';
  const nvc = document.getElementById('navVideoCount');
if(nvc){
  const count = typeof getUserCourseVideos === 'function' 
    ? getUserCourseVideos().length 
    : (DB.videos || []).length;
  nvc.textContent = count;
}

  if(!list.length){
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="admin-empty"><div class="em-ic"><i class="fas fa-video"></i></div><h3>لا توجد فيديوهات بعد</h3><p>سيتم إضافة الفيديوهات من لوحة الأدمن</p></div></div>`;
    return;
  }
  grid.innerHTML = list.map(v => videoCard(v, userData.videoProgress && userData.videoProgress[v.id])).join('');
}

/* ================= فتح فيديو ================= */
async function openVideo(videoId, opts = {}){
  if(!currentUserObj) return;
  if(!isSubscribed()){ showLockMessage(); return; }
  const v = (DB.videos || []).find(x => x.id === videoId);
  if(!v) return;

  VP.video = v;
  VP.completed = false;
  VP.xpAwarded = false;
  VP.maxWatched = 0;

  if(!userData.videoProgress) userData.videoProgress = {};
  const savedProg = userData.videoProgress[videoId];
  let startAt = 0;
  if(savedProg && !opts.fromStart){
    if(savedProg.completed){ startAt = 0; }
    else startAt = Math.max(0, (savedProg.last_position || 0) - 3);
    VP.maxWatched = savedProg.max_watched || 0;
    VP.completed = !!savedProg.completed;
    VP.xpAwarded = !!savedProg.completed;
  }

  $('#vpTitle').textContent = v.title;
  $('#vpMeta').textContent = `${v.category} • ${fmtDuration(v.duration || 0)}${v.important ? ' • مهم' : ''}`;
  const xpAmt = $('#vpXpAmount'); if(xpAmt) xpAmt.textContent = VP.xpAmount;
  updateVpXpBanner();

  $('#videoPlayer').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('#vpSplitToggle').style.display = 'none';
  closeLinkedFile(true);

  try{ history.replaceState(null, '', '#watch=' + videoId); }catch(e){}

  await mountYouTube(v.youtube_id, startAt);
}

window.openVideo = openVideo;

/* ================= تركيب مشغل يوتيوب ================= */
function mountYouTube(youtubeId, startAt){
  return new Promise(resolve => {
    const mount = $('#ytPlayerMount');
    mount.innerHTML = '<div id="ytPlayer"></div>';

    const init = () => {
      try{
        if(VP.player && VP.player.destroy){ try{ VP.player.destroy(); }catch(e){} }
        VP.player = new YT.Player('ytPlayer', {
          videoId: youtubeId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            start: Math.floor(startAt || 0),
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 1,
            origin: window.location.origin
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      }catch(e){ console.warn('YT init error', e); }
      resolve();
    };

    if(window.YT && window.YT.Player){
      init();
    } else {
      window.onYouTubeIframeAPIReady = init;
      setTimeout(() => { if(!VP.player) init(); }, 5000);
    }
  });
}

function onPlayerReady(e){
  VP.ready = true;
  try{
    VP.duration = VP.player.getDuration() || 0;
    $('#vpTimeTotal').textContent = fmtDuration(VP.duration);
  }catch(e){}
  startVpTicker();
}

function onPlayerStateChange(e){
  const playBtn = $('#vpPlayPause');
  if(e.data === 1){
    if(playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>';
  } else if(e.data === 2){
    if(playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
  } else if(e.data === 0){
    if(playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
    onVideoEnded();
  }
}

function onPlayerError(e){
  toast('تعذّر تشغيل الفيديو (كود ' + (e.data || '?') + ')', 'err');
}

/* ================= عداد التقدم ================= */
function startVpTicker(){
  stopVpTicker();
  VP.tickInterval = setInterval(() => {
    if(!VP.ready || !VP.player) return;
    try{
      const t = VP.player.getCurrentTime() || 0;
      const d = VP.player.getDuration() || VP.duration || 0;
      if(d > 0) VP.duration = d;

      $('#vpTimeNow').textContent = fmtDuration(t);
      $('#vpTimeTotal').textContent = fmtDuration(d);
      const pct = d > 0 ? Math.min(100, (t/d)*100) : 0;
      $('#vpVProgressFill').style.width = pct + '%';
      $('#vpVProgressDot').style.left = pct + '%';

      if(t > VP.maxWatched) VP.maxWatched = t;

      const myProg = userData.videoProgress && userData.videoProgress[VP.video.id];
      const oldPct = myProg ? (myProg.pct || 0) : 0;
      const newPct = Math.max(oldPct, Math.round(pct));
      const topBar = $('#vpBarTop'); if(topBar) topBar.style.width = newPct + '%';

      scheduleVideoSync(newPct);
    }catch(e){}
  }, 1000);
}
function stopVpTicker(){
  if(VP.tickInterval){ clearInterval(VP.tickInterval); VP.tickInterval = null; }
}

/* ================= عند نهاية الفيديو ================= */
async function onVideoEnded(){
  if(VP.completed){ toast('أكملت هذا الفيديو مسبقاً ✓', 'ok'); return; }
  VP.completed = true;

  if(!userData.videoProgress) userData.videoProgress = {};
  userData.videoProgress[VP.video.id] = {
    last_position: 0,
    pct: 100,
    max_watched: Math.max(VP.maxWatched, VP.duration || 0),
    completed: true,
    updated_at: Date.now()
  };
  savePrefs();

  if(!VP.xpAwarded){
    VP.xpAwarded = true;
    await grantVideoXp(VP.video.id, VP.xpAmount);
    updateVpXpBanner(true);
    toast('🎉 أكملت الفيديو! +' + VP.xpAmount + ' XP', 'ok');
    checkBadges();
    renderVideos();
  }
}

function updateVpXpBanner(forceEarned){
  const b = $('#vpXpBanner');
  if(!b) return;
  const earned = forceEarned || VP.xpAwarded;
  b.classList.toggle('earned', earned);
  b.innerHTML = earned
    ? `<i class="fas fa-circle-check"></i><span>حصلت على <b>+${VP.xpAmount}</b> XP من هذا الفيديو ✓</span>`
    : `<i class="fas fa-star"></i><span>شاهد الفيديو كاملاً لتربح <b>${VP.xpAmount}</b> XP</span>`;
}

/* ================= XP للفيديو ================= */
async function grantVideoXp(videoId, amount){
  try{
    if(!userData.awardedVideoXp) userData.awardedVideoXp = {};
    if(userData.awardedVideoXp[videoId]) return;
    userData.awardedVideoXp[videoId] = true;

    userData.extraXp = (userData.extraXp || 0) + amount;
    savePrefs();

    if(typeof syncMyXp === 'function') syncMyXp();
  }catch(e){ console.warn(e); }
}

/* ================= مزامنة تقدم الفيديو مع DB ================= */
function scheduleVideoSync(pct){
  if(!VP.video) return;
  if(!userData.videoProgress) userData.videoProgress = {};
  const prev = userData.videoProgress[VP.video.id] || {};
  userData.videoProgress[VP.video.id] = Object.assign({}, prev, {
    last_position: Math.floor(VP.player.getCurrentTime() || 0),
    pct: Math.max(prev.pct || 0, pct),
    max_watched: Math.max(prev.max_watched || 0, Math.floor(VP.maxWatched)),
    completed: prev.completed || VP.completed,
    updated_at: Date.now()
  });
  clearTimeout(VP.syncTimer);
  VP.syncTimer = setTimeout(pushVideoProgress, 1500);
}

async function pushVideoProgress(){
  if(!currentUserObj || currentUserObj.role === 'admin') return;
  if(!VP.video || !userData.videoProgress) return;
  const p = userData.videoProgress[VP.video.id];
  if(!p) return;
  try{
    await sb.from('video_progress').upsert({
      user_id: currentUserObj.id,
      video_id: VP.video.id,
      last_position: p.last_position || 0,
      pct: p.pct || 0,
      completed: !!p.completed,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,video_id' });
  }catch(e){ console.warn('video progress sync failed', e); }
}

/* ================= إغلاق المشغل ================= */
function closeVideoPlayer(){
  const vp = document.getElementById('videoPlayer');
  if(!vp || !vp.classList.contains('open')) return;

  /* ⭐ animation الإغلاق */
  vp.classList.add('closing');

  if(VP.video && VP.player && VP.ready){
    try{ if(!VP.completed) pushVideoProgress(); }catch(e){}
  }

  stopVpTicker();

  try{ if(VP.player && VP.player.pauseVideo) VP.player.pauseVideo(); }catch(e){}
  try{ if(VP.player && VP.player.destroy) VP.player.destroy(); }catch(e){}
  VP.player = null; VP.ready = false;
  $('#ytPlayerMount').innerHTML = '';
  VP.video = null;

  closeLinkedFile(true);

  setTimeout(() => {
    vp.classList.remove('open');
    vp.classList.remove('closing');
    document.body.style.overflow = '';
    try{ history.replaceState(null, '', '#videos'); }catch(e){}
    renderVideos();
    if(typeof syncMyXp === 'function'){ try{ syncMyXp(); }catch(e){} }
    if($('#view-profile') && $('#view-profile').classList.contains('active')) renderProfile();
  }, 500);
}

/* ================= أزرار التحكم ================= */
function vpPlayPause(){
  if(!VP.ready || !VP.player) return;
  try{
    const state = VP.player.getPlayerState();
    if(state === 1) VP.player.pauseVideo();
    else VP.player.playVideo();
  }catch(e){}
}
function vpSeekRel(sec){
  if(!VP.ready || !VP.player) return;
  try{
    const t = VP.player.getCurrentTime() || 0;
    const d = VP.player.getDuration() || 0;
    VP.player.seekTo(Math.max(0, Math.min(d, t + sec)), true);
  }catch(e){}
}
function vpToggleMute(){
  if(!VP.ready || !VP.player) return;
  try{
    if(VP.player.isMuted()){ VP.player.unMute(); $('#vpMute').innerHTML = '<i class="fas fa-volume-high"></i>'; }
    else { VP.player.mute(); $('#vpMute').innerHTML = '<i class="fas fa-volume-xmark"></i>'; }
  }catch(e){}
}
let vpSpeeds = [1, 1.25, 1.5, 2, 0.75];
function vpCycleSpeed(){
  if(!VP.ready || !VP.player) return;
  try{
    const cur = VP.player.getPlaybackRate() || 1;
    const idx = vpSpeeds.indexOf(cur);
    const next = vpSpeeds[(idx + 1) % vpSpeeds.length];
    VP.player.setPlaybackRate(next);
    const lbl = $('#vpSpeedLabel'); if(lbl) lbl.textContent = next + 'x';
  }catch(e){}
}
function vpToggleFullscreen(){
  const el = $('#vpVideoPane');
  if(!el) return;
  if(document.fullscreenElement){ document.exitFullscreen(); }
  else { el.requestFullscreen && el.requestFullscreen(); }
}

/* ================= منتقي الملفات ================= */
function openFilePicker(){
  const m = $('#filePickerModal');
  m.classList.add('open');
  renderFilePickerList('');
  setTimeout(() => { const s = $('#fpSearch'); if(s){ s.value=''; s.focus(); } }, 100);
}
function closeFilePicker(){
  $('#filePickerModal').classList.remove('open');
}
function renderFilePickerList(q){
  const box = $('#fpList'); if(!box) return;
  q = (q || '').trim().toLowerCase();
  let list = (DB.files || []).slice();
  if(q) list = list.filter(f => (f.title||'').toLowerCase().includes(q) || (f.category||'').toLowerCase().includes(q));
  if(!list.length){
    box.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.84rem">لا توجد ملفات مطابقة</div>';
    return;
  }
  box.innerHTML = list.map(f => `
    <div class="fp-item" onclick="selectFileForSplit('${f.id}')">
      <i class="fas fa-file-pdf"></i>
      <div class="fp-item-info">
        <b>${escapeHtml(f.title)}</b>
        <small>${escapeHtml(f.category || 'عام')} • ${f.page_count || '?'} صفحة</small>
      </div>
      <i class="fas fa-chevron-left" style="color:var(--muted)"></i>
    </div>`).join('');
}
window.selectFileForSplit = async (fileId) => {
  closeFilePicker();
  await openLinkedFile(fileId);
};

/* ================= فتح ملف بجانب الفيديو ================= */
async function openLinkedFile(fileId){
  if(!VP.video) return;
  const f = (DB.files || []).find(x => x.id === fileId);
  if(!f) return;

  VP.linkedFileId = fileId;
  VP.linkedFilePage = 1;
  VP.linkedFileToken++;
  const token = VP.linkedFileToken;

  $('#vpFileName').textContent = f.title;
  $('#vpFilePane').style.display = 'flex';
  $('#vpSplitToggle').style.display = 'grid';
  VP.splitOpen = true;

  const body = $('#vpFileBody');
  body.innerHTML = `
    <div id="vpFileScroll">
      <div class="pdf-stage" id="vpFileStage" style="gap:10px"></div>
    </div>
    <div class="pdf-loading" id="vpFileLoading" style="position:absolute;inset:0;display:flex">
      <i class="fas fa-spinner fa-spin"></i>
      <p>جاري تجهيز الملف...</p>
    </div>`;

  try{
    const { data: signed, error: sErr } = await sb.storage
      .from('pdfs').createSignedUrl(f.storage_path, 3600);
    if(sErr || !signed) throw new Error(sErr ? sErr.message : 'تعذر جلب الملف');
    if(token !== VP.linkedFileToken) return;

    const doc = await pdfjsLib.getDocument({
      url: signed.signedUrl,
      disableAutoFetch: false,
      disableStream: false,
      rangeChunkSize: 524288,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    }).promise;
    if(token !== VP.linkedFileToken){ try{doc.destroy();}catch(e){} return; }
    VP.linkedFileDoc = doc;
    VP.linkedFileTotal = doc.numPages;

    const p1 = await doc.getPage(1);
    const vp0 = p1.getViewport({ scale: 1 });
    const pw = vp0.width || 612;
    const ph = vp0.height || 792;
    try{ p1.cleanup(); }catch(e){}

    const avail = body.clientWidth - 24;
    VP.linkedFileBaseWidth = Math.max(180, Math.min(560, avail));

    const stage = document.getElementById('vpFileStage');
    if(!stage) return;
    stage.innerHTML = '';
    VP.linkedFilePages = [];

    const width = Math.round(VP.linkedFileBaseWidth * VP.linkedFileZoom);
    const height = Math.round(ph * (width / pw));
    stage.style.width = width + 'px';

    const email = currentUserObj ? (currentUserObj.email || '') : '';
    const frag = document.createDocumentFragment();
    for(let i = 0; i < VP.linkedFileTotal; i++){
      const el = document.createElement('div');
      el.className = 'pdf-page';
      el.dataset.page = String(i+1);
      el.style.width = width + 'px';
      el.style.height = height + 'px';
      el.innerHTML = `<div class="pg-num">${i+1} / ${VP.linkedFileTotal}</div><div class="pg-inner"></div><div class="pg-diag-wm">${escapeHtml(email)}</div>`;
      frag.appendChild(el); VP.linkedFilePages.push(el);
    }
    stage.appendChild(frag);

    VP.linkedFileObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const idx = parseInt(en.target.dataset.page, 10);
        if(en.isIntersecting) renderLinkedPage(idx);
      });
    }, { root: document.getElementById('vpFileScroll'), rootMargin: '600px 0px' });
    VP.linkedFilePages.forEach(el => VP.linkedFileObserver.observe(el));

    const l = document.getElementById('vpFileLoading');
    if(l) l.style.display = 'none';

    renderLinkedPage(1);
    if(VP.linkedFileTotal > 1) renderLinkedPage(2);
  }catch(e){
    console.warn(e);
    const l = document.getElementById('vpFileLoading');
    if(l) l.innerHTML = '<i class="fas fa-circle-exclamation" style="color:var(--danger)"></i><p style="color:#dc2626">تعذر تحميل الملف</p>';
  }
}

async function renderLinkedPage(num){
  if(!VP.linkedFileDoc) return;
  const holder = VP.linkedFilePages[num - 1];
  if(!holder || holder.dataset.done === '1') return;
  const token = VP.linkedFileToken;
  try{
    const page = await VP.linkedFileDoc.getPage(num);
    if(token !== VP.linkedFileToken) return;

    const pw = page.getViewport({ scale: 1 }).width || 612;
    const cssW = Math.round(VP.linkedFileBaseWidth * VP.linkedFileZoom);
    const scale = cssW / pw;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const vp = page.getViewport({ scale: scale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    canvas.style.width = '100%'; canvas.style.height = '100%';
    const ctx = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    if(token !== VP.linkedFileToken) return;

    const inner = holder.querySelector('.pg-inner');
    if(inner){ inner.innerHTML = ''; inner.appendChild(canvas); }
    holder.dataset.done = '1';
    try{ page.cleanup(); }catch(e){}
  }catch(e){ console.warn(e); }
}

function closeLinkedFile(silent){
  VP.linkedFileToken++;
  try{ if(VP.linkedFileObserver) VP.linkedFileObserver.disconnect(); }catch(e){}
  VP.linkedFileObserver = null;
  try{ if(VP.linkedFileDoc) VP.linkedFileDoc.destroy(); }catch(e){}
  VP.linkedFileDoc = null;
  VP.linkedFilePages = [];
  VP.linkedFileId = null;
  VP.splitOpen = false;
  const p = $('#vpFilePane'); if(p) p.style.display = 'none';
  const b = $('#vpFileBody'); if(b) b.innerHTML = '';
  const t = $('#vpSplitToggle'); if(t) t.style.display = 'none';
}

function toggleSplitView(){
  if(!VP.linkedFileId) return;
  const pane = $('#vpFilePane');
  const isHidden = pane.style.display === 'none';
  pane.style.display = isHidden ? 'flex' : 'none';
  if(!isHidden){ VP.splitOpen = false; }
  else {
    VP.splitOpen = true;
    VP.linkedFilePages.forEach((el, i) => { if(el.dataset.done === '1'){ el.dataset.done = '0'; const inner = el.querySelector('.pg-inner'); if(inner) inner.innerHTML = ''; } });
    VP.linkedFilePages.forEach((el, i) => { if(i < 3) renderLinkedPage(i+1); });
  }
}

/* ================= أزرار الواجهة ================= */
document.addEventListener('DOMContentLoaded', () => {
  const vpClose = document.getElementById('vpClose'); if(vpClose) vpClose.addEventListener('click', closeVideoPlayer);
  const vpOpen = document.getElementById('vpOpenFileBtn'); if(vpOpen) vpOpen.addEventListener('click', openFilePicker);
  const vpSplit = document.getElementById('vpSplitToggle'); if(vpSplit) vpSplit.addEventListener('click', toggleSplitView);
  const vpPlay = document.getElementById('vpPlayPause'); if(vpPlay) vpPlay.addEventListener('click', vpPlayPause);
  const vpB = document.getElementById('vpBack10'); if(vpB) vpB.addEventListener('click', () => vpSeekRel(-10));
  const vpF = document.getElementById('vpFwd10'); if(vpF) vpF.addEventListener('click', () => vpSeekRel(10));
  const vpM = document.getElementById('vpMute'); if(vpM) vpM.addEventListener('click', vpToggleMute);
  const vpFs = document.getElementById('vpFullscreen'); if(vpFs) vpFs.addEventListener('click', vpToggleFullscreen);
  const vpSp = document.getElementById('vpSpeed'); if(vpSp) vpSp.addEventListener('click', vpCycleSpeed);
  const vpCf = document.getElementById('vpCloseFile'); if(vpCf) vpCf.addEventListener('click', () => closeLinkedFile(false));

  const vprog = document.getElementById('vpVProgress');
  if(vprog){
    vprog.addEventListener('click', e => {
      if(!VP.ready || !VP.player) return;
      const r = vprog.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const d = VP.player.getDuration() || 0;
      VP.player.seekTo(pct * d, true);
    });
  }

  const fpCancel = document.getElementById('fpCancel'); if(fpCancel) fpCancel.addEventListener('click', closeFilePicker);
  const fpSearch = document.getElementById('fpSearch'); if(fpSearch) fpSearch.addEventListener('input', e => renderFilePickerList(e.target.value));
  const fpModal = document.getElementById('filePickerModal');
  if(fpModal) fpModal.addEventListener('click', e => { if(e.target === fpModal) closeFilePicker(); });

  document.querySelectorAll('[data-vcat]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-vcat]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); videoFilter = b.dataset.vcat; renderVideos();
    });
  });
  const vSort = document.getElementById('videoSortSelect');
  if(vSort) vSort.addEventListener('change', e => { videoSort = e.target.value; renderVideos(); });

  document.addEventListener('keydown', e => {
    const vpOpen2 = document.getElementById('videoPlayer').classList.contains('open');
    if(!vpOpen2) return;
    const editing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if(editing) return;
    if(e.key === 'Escape'){ closeVideoPlayer(); return; }
    if(e.key === ' '){ e.preventDefault(); vpPlayPause(); }
    if(e.key === 'ArrowLeft'){ e.preventDefault(); vpSeekRel(-5); }
    if(e.key === 'ArrowRight'){ e.preventDefault(); vpSeekRel(5); }
    if(e.key === 'j' || e.key === 'J'){ vpSeekRel(-10); }
    if(e.key === 'l' || e.key === 'L'){ vpSeekRel(10); }
    if(e.key === 'm' || e.key === 'M'){ vpToggleMute(); }
    if(e.key === 'f' || e.key === 'F'){ vpToggleFullscreen(); }
  });
});
