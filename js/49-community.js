/* ============================================================
   49) COMMUNITY — مجتمع العباقرة 🐦 (مثل تويتر)
   - منشور نص (500 حرف) + صورة • اسم الحساب وصورته • لايك ❤️ • ردود 💬
   - هاشتاقات قابلة للضغط • الأكثر تفاعلاً هذا الأسبوع • منشوراتي
   - 🚫 كلمات محظورة + صور محظورة (يفحصها السيرفر — حتى لو تغيّر حجم الصورة)
   - إبلاغ (5 بلاغات = يختفي تلقائياً) • تثبيت • إخفاء • كتم مستخدم
   - خفيف: 15 منشور بكل تحميل، صور مضغوطة وتحميل كسول، فحص المنشورات الجديدة كل 45 ثانية
============================================================ */

const CM = {
  tab: 'latest', tag: null, posts: [], liked: new Set(), cursor: null, offset: 0, done: false, loading: false,
  newest: null, pollTimer: null, imgFile: null, imgUrl: null, openThreads: new Set(), sending: false
};
const CM_PAGE = 15;
const CM_MAX = 500;

function cmMe(){ return currentUserObj; }
function cmStaff(){ return typeof isPrivileged === 'function' && isPrivileged(); }

function cmErr(msg){
  msg = String(msg || '');
  const map = {
    banned_word: '🚫 منشورك فيه كلمة غير مسموحة — عدّله وحاول مرة ثانية',
    banned_image: '🚫 هذه الصورة ممنوع نشرها في المجتمع',
    slow_down: '⏳ على مهلك! انتظر شوي قبل المنشور الجاي',
    daily_limit: 'وصلت الحد اليومي للنشر — نكمل بكرة 😊',
    muted: '🔇 حسابك موقوف عن النشر مؤقتاً',
    not_subscribed: 'النشر في المجتمع للمشتركين فقط',
    too_long: 'المنشور أطول من 500 حرف',
    empty_post: 'اكتب شي أو أضف صورة',
    parent_missing: 'المنشور الأصلي انحذف',
    image_hash_required: 'تعذّر فحص الصورة — جرّب صورة ثانية',
    bad_image: 'تعذّر رفع الصورة'
  };
  for(const k in map) if(msg.includes(k)) return map[k];
  if(/relation .* does not exist|community_posts/i.test(msg)) return 'ميزة المجتمع تحتاج تشغيل ملف supabase-update-8.sql';
  return msg || 'حدث خطأ';
}

/* ================== 🖼️ بصمة الصورة (dHash 64-bit) ================== */
function cmImageHash(blob){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try{
        const c = document.createElement('canvas'); c.width = 9; c.height = 8;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 9, 8);
        const d = ctx.getImageData(0, 0, 9, 8).data;
        const g = []; for(let i = 0; i < d.length; i += 4) g.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
        let bits = '';
        for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++) bits += g[y * 9 + x] > g[y * 9 + x + 1] ? '1' : '0';
        let hex = '';
        for(let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
        res(hex);
      }catch(e){ res(null); }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => res(null);
    img.src = URL.createObjectURL(blob);
  });
}

/* ================== النص: هاشتاقات + روابط ================== */
function cmFormat(text){
  let h = escapeHtml(text || '');
  h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>');
  h = h.replace(/(^|[\s\n])#([؀-ۿA-Za-z0-9_]{2,40})/g, (m, sp, tag) => `${sp}<button class="cm-tag" onclick="cmFilterTag('${tag}')">#${tag}</button>`);
  return h.replace(/\n/g, '<br>');
}

function cmAgo(iso){
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if(s < 60) return 'الآن';
  if(s < 3600) return Math.floor(s / 60) + 'د';
  if(s < 86400) return Math.floor(s / 3600) + 'س';
  if(s < 604800) return Math.floor(s / 86400) + 'ي';
  return new Date(iso).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' });
}

function cmAvatar(p, cls){
  const url = p.author_avatar;
  const ch = String(p.author_name || '؟').trim().charAt(0) || '؟';
  return `<div class="cm-av ${cls || ''}" ${url ? `style="background-image:url('${escapeHtml(url)}')"` : ''}>${url ? '' : escapeHtml(ch)}</div>`;
}

function cmBadge(role){
  if(role === 'owner') return '<span class="cm-verified owner" title="رئيس المنصة"><i class="fas fa-crown"></i></span>';
  if(role === 'admin') return '<span class="cm-verified" title="إدارة المنصة"><i class="fas fa-circle-check"></i></span>';
  return '';
}

/* ================== الصفحة ================== */
function renderCommunity(){
  const root = document.getElementById('cmRoot');
  if(!root) return;
  const me = cmMe();
  if(!root.dataset.built){
    root.dataset.built = '1';
    root.innerHTML = `
      <div class="cm-hero">
        <div class="cm-hero-ic"><i class="fas fa-comments"></i></div>
        <div><h2>مجتمع العباقرة</h2><p>شارك سؤالك، إنجازك، أو نصيحة لزملائك — بأدب واحترام 💙</p></div>
      </div>
      <div class="cm-composer" id="cmComposer"></div>
      <div class="cm-tabs" id="cmTabs"></div>
      <button class="cm-new-pill" id="cmNewPill" onclick="cmLoad(true)" style="display:none"></button>
      <div class="cm-feed" id="cmFeed"></div>
      <div class="cm-more" id="cmMore"></div>`;
  }
  cmRenderComposer();
  cmRenderTabs();
  if(!CM.posts.length) cmLoad(true);
  cmStartPoll();
}
window.renderCommunity = renderCommunity;

function cmRenderComposer(){
  const box = document.getElementById('cmComposer');
  if(!box) return;
  const me = cmMe();
  if(!me){ box.innerHTML = ''; return; }
  box.innerHTML = `
    ${cmAvatar({ author_avatar: me.avatar_url, author_name: me.name })}
    <div class="cm-comp-main">
      <textarea id="cmText" maxlength="${CM_MAX}" rows="2" placeholder="وش في بالك؟ شارك سؤال أو إنجاز… #قدرات"></textarea>
      <div class="cm-comp-img" id="cmCompImg" style="display:none">
        <img id="cmCompImgEl" alt="">
        <button onclick="cmClearImg()" title="إزالة الصورة"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cm-comp-bar">
        <label class="cm-icon-btn" title="أضف صورة"><input type="file" id="cmImg" accept="image/*" hidden><i class="fas fa-image"></i></label>
        <button class="cm-icon-btn" onclick="cmInsertTag()" title="هاشتاق"><i class="fas fa-hashtag"></i></button>
        <span class="cm-count" id="cmCount">${CM_MAX}</span>
        <button class="btn btn-primary btn-sm cm-post-btn" id="cmPostBtn" onclick="cmSubmit()"><i class="fas fa-paper-plane"></i> نشر</button>
      </div>
    </div>`;
  const ta = document.getElementById('cmText');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(220, ta.scrollHeight) + 'px';
    const left = CM_MAX - ta.value.length;
    const c = document.getElementById('cmCount');
    c.textContent = left; c.classList.toggle('warn', left < 40);
  });
  ta.addEventListener('keydown', e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) cmSubmit(); });
  document.getElementById('cmImg').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    if(!/^image\//.test(f.type)){ toast('اختر صورة', 'warn'); return; }
    if(f.size > 10 * 1024 * 1024){ toast('الصورة كبيرة (10 ميجا كحد أقصى)', 'warn'); return; }
    CM.imgFile = f;
    if(CM.imgUrl) URL.revokeObjectURL(CM.imgUrl);
    CM.imgUrl = URL.createObjectURL(f);
    document.getElementById('cmCompImgEl').src = CM.imgUrl;
    document.getElementById('cmCompImg').style.display = '';
    e.target.value = '';
  });
}

window.cmClearImg = () => {
  CM.imgFile = null;
  if(CM.imgUrl){ URL.revokeObjectURL(CM.imgUrl); CM.imgUrl = null; }
  const w = document.getElementById('cmCompImg'); if(w) w.style.display = 'none';
};
window.cmInsertTag = () => {
  const ta = document.getElementById('cmText'); if(!ta) return;
  ta.value += (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + '#';
  ta.focus(); ta.dispatchEvent(new Event('input'));
};

function cmRenderTabs(){
  const box = document.getElementById('cmTabs'); if(!box) return;
  const t = (k, ic, l) => `<button class="${CM.tab === k && !CM.tag ? 'on' : ''}" onclick="cmSetTab('${k}')"><i class="fas ${ic}"></i> ${l}</button>`;
  box.innerHTML = t('latest', 'fa-clock', 'الأحدث') + t('top', 'fa-fire', 'الأكثر تفاعلاً') + t('mine', 'fa-user', 'منشوراتي') +
    (CM.tag ? `<span class="cm-tag-chip">#${escapeHtml(CM.tag)} <button onclick="cmFilterTag(null)"><i class="fas fa-xmark"></i></button></span>` : '');
}
window.cmSetTab = k => { CM.tab = k; CM.tag = null; cmRenderTabs(); cmLoad(true); };
window.cmFilterTag = tag => { CM.tag = tag; if(tag) CM.tab = 'latest'; cmRenderTabs(); cmLoad(true); try{ document.getElementById('cmTabs').scrollIntoView({ behavior: 'smooth', block: 'start' }); }catch(e){} };

/* ================== التحميل ================== */
async function cmLoad(reset){
  if(CM.loading) return;
  if(reset){ CM.posts = []; CM.cursor = null; CM.offset = 0; CM.done = false; CM.openThreads.clear(); }
  if(CM.done) return;
  CM.loading = true;
  const feed = document.getElementById('cmFeed');
  if(reset && feed) feed.innerHTML = '<div class="cm-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  const pill = document.getElementById('cmNewPill'); if(pill && reset) pill.style.display = 'none';
  try{
    let rows = [];
    /* المثبّتة أولاً (في الأحدث فقط) */
    if(reset && CM.tab === 'latest' && !CM.tag){
      const { data } = await sb.from('community_posts').select('*').is('parent_id', null).eq('pinned', true).order('created_at', { ascending: false }).limit(3);
      rows = data || [];
    }
    let q = sb.from('community_posts').select('*').is('parent_id', null);
    if(CM.tab === 'top'){
      q = q.gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('like_count', { ascending: false }).order('created_at', { ascending: false })
        .range(CM.offset, CM.offset + CM_PAGE - 1);
    } else {
      if(CM.tab === 'mine' && cmMe()) q = q.eq('user_id', cmMe().id);
      if(CM.tag) q = q.ilike('body', '%#' + CM.tag + '%');
      if(CM.tab === 'latest' && !CM.tag) q = q.eq('pinned', false);
      if(CM.cursor) q = q.lt('created_at', CM.cursor);
      q = q.order('created_at', { ascending: false }).limit(CM_PAGE);
    }
    const { data, error } = await q;
    if(error) throw error;
    const page = data || [];
    if(page.length < CM_PAGE) CM.done = true;
    if(CM.tab === 'top') CM.offset += page.length;
    else if(page.length) CM.cursor = page[page.length - 1].created_at;
    rows = rows.concat(page).filter(p => !CM.posts.some(x => x.id === p.id));
    CM.posts = CM.posts.concat(rows);
    if(reset){
      const newestNormal = CM.posts.filter(p => !p.pinned).map(p => p.created_at).sort().pop();
      CM.newest = newestNormal || new Date().toISOString();
    }
    await cmLoadLikes(rows.map(p => p.id));
    cmRenderFeed();
  }catch(e){
    if(feed) feed.innerHTML = `<div class="cm-empty"><i class="fas fa-triangle-exclamation"></i><b>تعذّر تحميل المجتمع</b><small>${escapeHtml(cmErr(e.message))}</small></div>`;
  }finally{
    CM.loading = false;
  }
}
window.cmLoad = cmLoad;

async function cmLoadLikes(ids){
  if(!ids.length || !cmMe()) return;
  const { data } = await sb.from('community_likes').select('post_id').eq('user_id', cmMe().id).in('post_id', ids);
  (data || []).forEach(r => CM.liked.add(r.post_id));
}

function cmRenderFeed(){
  const feed = document.getElementById('cmFeed');
  if(!feed) return;
  if(!CM.posts.length){
    feed.innerHTML = `<div class="cm-empty"><i class="fas fa-feather-pointed"></i><b>${CM.tab === 'mine' ? 'ما نشرت شي بعد' : CM.tag ? 'ما فيه منشورات بهذا الهاشتاق' : 'كن أول من ينشر!'}</b><small>اكتب سؤالك أو شارك إنجازك من فوق ✍️</small></div>`;
  } else {
    feed.innerHTML = CM.posts.map(cmPostHTML).join('');
    CM.openThreads.forEach(id => cmLoadThread(id));
  }
  const more = document.getElementById('cmMore');
  if(more) more.innerHTML = !CM.done && CM.posts.length ? '<button class="btn btn-ghost" onclick="cmLoad(false)"><i class="fas fa-angles-down"></i> عرض المزيد</button>' : '';
}

function cmPostHTML(p){
  const me = cmMe();
  const mine = me && p.user_id === me.id;
  const liked = CM.liked.has(p.id);
  const staff = cmStaff();
  return `
    <article class="cm-post ${p.pinned ? 'pinned' : ''} ${p.hidden ? 'is-hidden' : ''}" id="cmp-${p.id}">
      ${p.pinned ? '<div class="cm-pin"><i class="fas fa-thumbtack"></i> منشور مثبّت</div>' : ''}
      ${p.hidden ? '<div class="cm-pin warn"><i class="fas fa-eye-slash"></i> مخفي عن الطلاب' + (p.report_count ? ` (${p.report_count} بلاغ)` : '') + '</div>' : ''}
      <div class="cm-post-in">
        ${cmAvatar(p)}
        <div class="cm-body">
          <div class="cm-head">
            <b>${escapeHtml(p.author_name || 'طالب')}</b>${cmBadge(p.author_role)}
            <span class="cm-time">· ${cmAgo(p.created_at)}</span>
            <button class="cm-menu-btn" onclick="cmMenu('${p.id}', event)"><i class="fas fa-ellipsis"></i></button>
          </div>
          ${p.body ? `<div class="cm-text">${cmFormat(p.body)}</div>` : ''}
          ${p.image_url ? `<button class="cm-img" onclick="cmLightbox('${escapeHtml(p.image_url)}')"><img src="${escapeHtml(p.image_url)}" loading="lazy" decoding="async" alt=""></button>` : ''}
          <div class="cm-actions">
            <button class="cm-act reply" onclick="cmToggleThread('${p.id}')"><i class="far fa-comment"></i> <span>${p.reply_count || ''}</span></button>
            <button class="cm-act like ${liked ? 'on' : ''}" onclick="cmLike('${p.id}', this)"><i class="${liked ? 'fas' : 'far'} fa-heart"></i> <span>${p.like_count || ''}</span></button>
            <button class="cm-act" onclick="cmShare('${p.id}')"><i class="fas fa-arrow-up-from-bracket"></i></button>
          </div>
          <div class="cm-thread" id="cmt-${p.id}" style="display:none"></div>
        </div>
      </div>
    </article>`;
}

/* ================== النشر ================== */
async function cmSubmit(parentId){
  if(CM.sending) return;
  const me = cmMe(); if(!me) return;
  const ta = document.getElementById(parentId ? 'cmr-' + parentId : 'cmText');
  const text = (ta ? ta.value : '').trim();
  const file = parentId ? null : CM.imgFile;
  if(!text && !file){ toast('اكتب شي أو أضف صورة', 'warn'); return; }
  if(text.length > CM_MAX){ toast('المنشور أطول من 500 حرف', 'warn'); return; }
  CM.sending = true;
  const btn = parentId ? document.getElementById('cmrb-' + parentId) : document.getElementById('cmPostBtn');
  const orig = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  let path = null;
  try{
    const row = { body: text };
    if(parentId) row.parent_id = parentId;
    if(file){
      const blob = await (typeof schCompress === 'function' ? schCompress(file, 1280, 0.8) : Promise.resolve(file));
      const hash = await cmImageHash(blob);
      if(!hash) throw new Error('image_hash_required');
      path = me.id + '/posts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.jpg';
      const up = await sb.storage.from('community').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if(up.error) throw new Error('bad_image');
      const { data: u } = sb.storage.from('community').getPublicUrl(path);
      row.image_url = u.publicUrl;
      row.image_hash = hash;
    }
    const { data, error } = await sb.from('community_posts').insert(row).select().single();
    if(error) throw error;
    if(ta){ ta.value = ''; ta.dispatchEvent(new Event('input')); }
    if(parentId){
      const p = CM.posts.find(x => x.id === parentId);
      if(p){ p.reply_count = (p.reply_count || 0) + 1; const s = document.querySelector(`#cmp-${parentId} .cm-act.reply span`); if(s) s.textContent = p.reply_count; }
      cmLoadThread(parentId);
    } else {
      cmClearImg();
      if(CM.tab !== 'top' && !CM.tag){
        CM.posts.splice(CM.posts.filter(x => x.pinned).length, 0, data);
        CM.newest = data.created_at;
        cmRenderFeed();
      }
      toast('✓ تم النشر', 'ok');
    }
  }catch(e){
    if(path){ try{ await sb.storage.from('community').remove([path]); }catch(x){} }
    toast(cmErr(e.message), 'err');
  }finally{
    CM.sending = false;
    if(btn){ btn.disabled = false; btn.innerHTML = orig; }
  }
}
window.cmSubmit = cmSubmit;

/* ================== لايك ================== */
window.cmLike = async (id, btn) => {
  const me = cmMe(); if(!me) return;
  const p = CM.posts.find(x => x.id === id) || (CM.replies && CM.replies[id]);
  const was = CM.liked.has(id);
  /* تحديث فوري (متفائل) */
  if(was) CM.liked.delete(id); else CM.liked.add(id);
  if(p) p.like_count = Math.max(0, (p.like_count || 0) + (was ? -1 : 1));
  if(btn){
    btn.classList.toggle('on', !was);
    btn.innerHTML = `<i class="${!was ? 'fas' : 'far'} fa-heart"></i> <span>${p && p.like_count ? p.like_count : ''}</span>`;
    if(!was){ btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
  }
  const r = was
    ? await sb.from('community_likes').delete().eq('post_id', id).eq('user_id', me.id)
    : await sb.from('community_likes').insert({ post_id: id, user_id: me.id });
  if(r.error && !/duplicate/i.test(r.error.message)){
    if(was) CM.liked.add(id); else CM.liked.delete(id);
    if(p) p.like_count = Math.max(0, (p.like_count || 0) + (was ? 1 : -1));
    toast(cmErr(r.error.message), 'err');
  }
};

/* ================== الردود ================== */
CM.replies = {};
window.cmToggleThread = id => {
  const box = document.getElementById('cmt-' + id);
  if(!box) return;
  const open = box.style.display === 'none';
  box.style.display = open ? '' : 'none';
  if(open){ CM.openThreads.add(id); cmLoadThread(id); }
  else CM.openThreads.delete(id);
};

async function cmLoadThread(id){
  const box = document.getElementById('cmt-' + id);
  if(!box) return;
  box.style.display = '';
  if(!box.innerHTML) box.innerHTML = '<div class="cm-loading sm"><i class="fas fa-spinner fa-spin"></i></div>';
  const { data, error } = await sb.from('community_posts').select('*').eq('parent_id', id).order('created_at', { ascending: true }).limit(100);
  if(error){ box.innerHTML = `<small class="cm-err">${escapeHtml(cmErr(error.message))}</small>`; return; }
  (data || []).forEach(r => { CM.replies[r.id] = r; });
  await cmLoadLikes((data || []).map(r => r.id));
  const me = cmMe();
  box.innerHTML = (data || []).map(r => `
    <div class="cm-reply" id="cmp-${r.id}">
      ${cmAvatar(r, 'sm')}
      <div class="cm-body">
        <div class="cm-head"><b>${escapeHtml(r.author_name || 'طالب')}</b>${cmBadge(r.author_role)}<span class="cm-time">· ${cmAgo(r.created_at)}</span>
          <button class="cm-menu-btn" onclick="cmMenu('${r.id}', event, '${id}')"><i class="fas fa-ellipsis"></i></button></div>
        ${r.body ? `<div class="cm-text">${cmFormat(r.body)}</div>` : ''}
        <div class="cm-actions sm">
          <button class="cm-act like ${CM.liked.has(r.id) ? 'on' : ''}" onclick="cmLike('${r.id}', this)"><i class="${CM.liked.has(r.id) ? 'fas' : 'far'} fa-heart"></i> <span>${r.like_count || ''}</span></button>
        </div>
      </div>
    </div>`).join('') + (me ? `
    <div class="cm-reply-box">
      <input type="text" id="cmr-${id}" maxlength="${CM_MAX}" placeholder="اكتب ردّك…" onkeydown="if(event.key==='Enter')cmSubmit('${id}')">
      <button class="btn btn-primary btn-sm" id="cmrb-${id}" onclick="cmSubmit('${id}')"><i class="fas fa-reply"></i></button>
    </div>` : '');
}

/* ================== مشاركة / صورة كاملة ================== */
window.cmShare = async id => {
  const p = CM.posts.find(x => x.id === id);
  const text = (p && p.body ? p.body.slice(0, 200) + '\n\n' : '') + '— من مجتمع عباقرة القدرات 💙\n' + location.origin + location.pathname + '#community';
  if(navigator.share){ try{ await navigator.share({ text }); return; }catch(e){ return; } }
  try{ await navigator.clipboard.writeText(text); toast('✓ تم نسخ المنشور', 'ok'); }catch(e){}
};

window.cmLightbox = url => {
  let lb = document.getElementById('cmLightbox');
  if(!lb){
    lb = document.createElement('div');
    lb.id = 'cmLightbox';
    lb.className = 'cm-lightbox';
    lb.addEventListener('click', () => lb.classList.remove('open'));
    document.body.appendChild(lb);
  }
  lb.innerHTML = `<img src="${escapeHtml(url)}" alt=""><button class="cm-lb-x"><i class="fas fa-xmark"></i></button>`;
  lb.classList.add('open');
};

/* ================== القائمة (⋯) ================== */
window.cmMenu = (id, ev, parentId) => {
  if(ev) ev.stopPropagation();
  const p = CM.posts.find(x => x.id === id) || CM.replies[id];
  if(!p) return;
  const me = cmMe();
  const mine = me && p.user_id === me.id;
  const staff = cmStaff();
  document.querySelectorAll('.cm-menu').forEach(m => m.remove());
  const items = [];
  if(!mine) items.push(`<button onclick="cmReport('${id}')"><i class="fas fa-flag"></i> إبلاغ</button>`);
  if(mine || staff) items.push(`<button class="danger" onclick="cmDelete('${id}', '${parentId || ''}')"><i class="fas fa-trash-can"></i> حذف</button>`);
  if(staff && !parentId){
    items.push(`<button onclick="cmModerate('${id}', 'pin')"><i class="fas fa-thumbtack"></i> ${p.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button>`);
    items.push(`<button onclick="cmModerate('${id}', 'hide')"><i class="fas fa-eye-slash"></i> ${p.hidden ? 'إظهار' : 'إخفاء'}</button>`);
  }
  if(staff && p.image_hash) items.push(`<button class="danger" onclick="cmBanImage('${id}')"><i class="fas fa-ban"></i> حظر هذه الصورة</button>`);
  if(staff && !mine) items.push(`<button class="danger" onclick="cmMute('${p.user_id}', '${escapeHtml(p.author_name || '').replace(/'/g, '')}')"><i class="fas fa-volume-xmark"></i> كتم الحساب</button>`);
  const m = document.createElement('div');
  m.className = 'cm-menu';
  m.innerHTML = items.join('');
  const btn = ev && ev.currentTarget ? ev.currentTarget : null;
  (btn ? btn.parentNode : document.body).appendChild(m);
  setTimeout(() => document.addEventListener('click', function close(){ m.remove(); document.removeEventListener('click', close); }), 0);
};

window.cmReport = id => {
  openModal({
    title: 'إبلاغ عن منشور',
    text: 'وش المشكلة في هذا المنشور؟',
    bodyHTML: `<select id="cmRepReason" style="width:100%;font-family:inherit;padding:11px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)">
      <option>محتوى مسيء أو غير لائق</option><option>إزعاج / سبام</option><option>معلومة خاطئة</option><option>صورة غير مناسبة</option><option>سبب آخر</option></select>`,
    okText: 'إرسال البلاغ',
    onOk: async () => {
      const reason = document.getElementById('cmRepReason').value;
      const { error } = await sb.from('community_reports').insert({ post_id: id, user_id: cmMe().id, reason });
      if(error && /duplicate/i.test(error.message)){ toast('أبلغت عن هذا المنشور من قبل', 'warn'); return; }
      if(error){ toast(cmErr(error.message), 'err'); return; }
      toast('✓ وصلنا بلاغك — شكراً لأنك تحافظ على المجتمع 💙', 'ok');
    }
  });
};

window.cmDelete = (id, parentId) => {
  confirmBox('حذف المنشور', 'حذف المنشور نهائياً؟', async () => {
    const p = CM.posts.find(x => x.id === id) || CM.replies[id];
    const { error } = await sb.from('community_posts').delete().eq('id', id);
    if(error){ toast(cmErr(error.message), 'err'); return; }
    if(p && p.image_url){
      const m = /\/community\/(.+)$/.exec(p.image_url.split('?')[0]);
      if(m){ try{ await sb.storage.from('community').remove([decodeURIComponent(m[1])]); }catch(e){} }
    }
    if(parentId){
      const par = CM.posts.find(x => x.id === parentId);
      if(par){ par.reply_count = Math.max(0, (par.reply_count || 1) - 1); const s = document.querySelector(`#cmp-${parentId} .cm-act.reply span`); if(s) s.textContent = par.reply_count || ''; }
      cmLoadThread(parentId);
    } else {
      CM.posts = CM.posts.filter(x => x.id !== id);
      cmRenderFeed();
    }
    toast('تم الحذف', 'ok');
  }, true);
};

window.cmModerate = async (id, action) => {
  const p = CM.posts.find(x => x.id === id); if(!p) return;
  const patch = action === 'pin' ? { pinned: !p.pinned } : { hidden: !p.hidden };
  if(action === 'hide' && p.hidden) patch.report_count = 0;
  const { error } = await sb.from('community_posts').update(patch).eq('id', id);
  if(error){ toast(cmErr(error.message), 'err'); return; }
  Object.assign(p, patch);
  if(action === 'pin') cmLoad(true); else cmRenderFeed();
  toast('✓ تم', 'ok');
};

window.cmBanImage = id => {
  const p = CM.posts.find(x => x.id === id) || CM.replies[id];
  if(!p || !p.image_hash) return;
  confirmBox('حظر الصورة', 'هذه الصورة (وأي نسخة مشابهة لها) ما راح يقدر أحد ينشرها مرة ثانية، وبينحذف هذا المنشور. متأكد؟', async () => {
    const { error } = await sb.from('community_banned_images').upsert({ hash: p.image_hash, note: 'من منشور ' + (p.author_name || ''), sample_url: null });
    if(error){ toast(cmErr(error.message), 'err'); return; }
    await sb.from('community_posts').delete().eq('id', id);
    const m = /\/community\/(.+)$/.exec(String(p.image_url || '').split('?')[0]);
    if(m){ try{ await sb.storage.from('community').remove([decodeURIComponent(m[1])]); }catch(e){} }
    CM.posts = CM.posts.filter(x => x.id !== id);
    cmRenderFeed();
    toast('🚫 تم حظر الصورة وحذف المنشور', 'ok');
  }, true);
};

window.cmMute = (userId, name) => {
  openModal({
    title: 'كتم الحساب',
    text: `منع «${escapeHtml(name || 'المستخدم')}» من النشر والرد في المجتمع:`,
    bodyHTML: `<select id="cmMuteDur" style="width:100%;font-family:inherit;padding:11px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)">
      <option value="1">يوم واحد</option><option value="7" selected>أسبوع</option><option value="30">شهر</option><option value="0">دائم</option></select>`,
    okText: 'كتم', danger: true,
    onOk: async () => {
      const d = parseInt(document.getElementById('cmMuteDur').value, 10);
      const until = d ? new Date(Date.now() + d * 86400000).toISOString() : null;
      const { error } = await sb.from('community_mutes').upsert({ user_id: userId, until, reason: 'من الأدمن' });
      if(error){ toast(cmErr(error.message), 'err'); return; }
      toast('🔇 تم كتم الحساب', 'ok');
    }
  });
};

/* ================== منشورات جديدة (كل 45 ثانية) ================== */
function cmStartPoll(){
  if(CM.pollTimer) return;
  CM.pollTimer = setInterval(async () => {
    const view = document.getElementById('view-community');
    if(!view || !view.classList.contains('active') || document.hidden || !CM.newest || CM.tab !== 'latest' || CM.tag) return;
    const { count } = await sb.from('community_posts').select('id', { count: 'exact', head: true })
      .is('parent_id', null).gt('created_at', CM.newest).neq('user_id', cmMe() ? cmMe().id : '00000000-0000-0000-0000-000000000000');
    const pill = document.getElementById('cmNewPill');
    if(pill && count > 0){ pill.innerHTML = `<i class="fas fa-arrow-up"></i> ${count} منشور جديد`; pill.style.display = ''; }
  }, 45000);
}

/* ============================================================
   🛡️ لوحة الأدمن: إدارة المجتمع
============================================================ */
async function renderCommunityAdmin(){
  const box = document.getElementById('adminCommunity');
  if(!box || !cmStaff()) return;
  box.innerHTML = '<div style="text-align:center;padding:24px"><i class="fas fa-spinner fa-spin" style="font-size:1.4rem;color:var(--primary)"></i></div>';
  const [w, im, rep, mu] = await Promise.all([
    sb.from('community_banned_words').select('*').order('created_at', { ascending: false }),
    sb.from('community_banned_images').select('*').order('created_at', { ascending: false }),
    sb.from('community_posts').select('*').gt('report_count', 0).order('report_count', { ascending: false }).limit(30),
    sb.from('community_mutes').select('*').order('created_at', { ascending: false })
  ]);
  if(w.error){ box.innerHTML = `<div class="adm-course-warn"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(cmErr(w.error.message))}</div>`; return; }
  const IN = 'flex:1;min-width:0;font-family:inherit;font-size:.88rem;padding:10px 13px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)';
  box.innerHTML = `
    <div class="card-basic">
      <h3><i class="fas fa-ban"></i> الكلمات المحظورة <small style="color:var(--muted);font-weight:600">(${(w.data || []).length})</small></h3>
      <p style="font-size:.78rem;color:var(--muted);margin:4px 0 10px">أي منشور أو رد فيه هذه الكلمات يُرفض تلقائياً — حتى لو كُتبت بهمزات مختلفة أو مسافات بين الحروف.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="text" id="cbwInput" placeholder="اكتب كلمة أو أكثر (افصل بفاصلة ،)" style="${IN}">
        <label style="display:flex;gap:5px;align-items:center;font-size:.78rem;font-weight:700"><input type="checkbox" id="cbwExact"> الكلمة كاملة فقط</label>
        <button class="btn btn-primary btn-sm" onclick="cmAddWords()"><i class="fas fa-plus"></i> إضافة</button>
      </div>
      <div class="cbw-list">${(w.data || []).map(x => `<span class="cbw-chip">${escapeHtml(x.word)}${x.exact ? ' <small>كاملة</small>' : ''}<button onclick="cmDelWord('${escapeHtml(x.word).replace(/'/g, '&#39;')}')"><i class="fas fa-xmark"></i></button></span>`).join('') || '<small style="color:var(--muted)">لا توجد كلمات</small>'}</div>
    </div>

    <div class="card-basic" style="margin-top:14px">
      <h3><i class="fas fa-flag"></i> البلاغات <small style="color:var(--muted);font-weight:600">(${(rep.data || []).length})</small></h3>
      <div class="cm-admin-reports">${(rep.data || []).map(p => `
        <div class="cm-rep">
          <div><b>${escapeHtml(p.author_name || '')}</b> <small>• ${p.report_count} بلاغ ${p.hidden ? '• <span style="color:var(--danger)">مخفي</span>' : ''}</small>
            <p>${escapeHtml((p.body || '').slice(0, 220))}</p>
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" loading="lazy" alt="">` : ''}</div>
          <div class="cm-rep-acts">
            <button class="btn btn-ghost btn-sm" onclick="cmAdminRestore('${p.id}')"><i class="fas fa-check"></i> سليم</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="cmAdminDelete('${p.id}')"><i class="fas fa-trash"></i> حذف</button>
            ${p.image_hash ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="cmAdminBanImg('${p.id}','${p.image_hash}')"><i class="fas fa-ban"></i> حظر الصورة</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="cmMute('${p.user_id}','${escapeHtml(p.author_name || '').replace(/'/g, '')}')"><i class="fas fa-volume-xmark"></i> كتم</button>
          </div>
        </div>`).join('') || '<small style="color:var(--muted)">لا توجد بلاغات 👌</small>'}</div>
    </div>

    <div class="card-basic" style="margin-top:14px">
      <h3><i class="fas fa-image"></i> الصور المحظورة <small style="color:var(--muted);font-weight:600">(${(im.data || []).length})</small></h3>
      <p style="font-size:.78rem;color:var(--muted);margin:4px 0 10px">ارفع صورة لحظرها مسبقاً، أو احظر صورة من قائمة ⋯ على أي منشور.</p>
      <label class="btn btn-ghost btn-sm" style="cursor:pointer"><input type="file" accept="image/*" hidden onchange="cmAdminBanUpload(this)"><i class="fas fa-upload"></i> رفع صورة لحظرها</label>
      <div class="cbw-list">${(im.data || []).map(x => `<span class="cbw-chip" dir="ltr"><i class="fas fa-fingerprint"></i> ${escapeHtml(x.hash.slice(0, 8))}… <small>${escapeHtml(x.note || '')}</small><button onclick="cmDelImgBan('${x.hash}')"><i class="fas fa-xmark"></i></button></span>`).join('') || '<small style="color:var(--muted)">لا توجد صور محظورة</small>'}</div>
    </div>

    <div class="card-basic" style="margin-top:14px">
      <h3><i class="fas fa-volume-xmark"></i> الحسابات المكتومة <small style="color:var(--muted);font-weight:600">(${(mu.data || []).length})</small></h3>
      <div class="cbw-list">${(mu.data || []).map(x => `<span class="cbw-chip"><i class="fas fa-user"></i> ${escapeHtml(((DB.users || []).find(u => u.id === x.user_id) || {}).name || x.user_id.slice(0, 8))} <small>${x.until ? 'حتى ' + new Date(x.until).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn') : 'دائم'}</small><button onclick="cmUnmute('${x.user_id}')"><i class="fas fa-xmark"></i></button></span>`).join('') || '<small style="color:var(--muted)">لا يوجد</small>'}</div>
    </div>`;
}
window.renderCommunityAdmin = renderCommunityAdmin;

window.cmAddWords = async () => {
  const raw = (document.getElementById('cbwInput').value || '').split(/[,،\n]+/).map(x => x.trim()).filter(Boolean);
  if(!raw.length){ toast('اكتب كلمة', 'warn'); return; }
  const exact = document.getElementById('cbwExact').checked;
  const { error } = await sb.from('community_banned_words').upsert(raw.map(word => ({ word, norm: word, exact })));
  if(error){ toast(cmErr(error.message), 'err'); return; }
  toast(`✓ أُضيفت ${raw.length} كلمة`, 'ok');
  renderCommunityAdmin();
};
window.cmDelWord = async word => { await sb.from('community_banned_words').delete().eq('word', word); renderCommunityAdmin(); };
window.cmDelImgBan = async hash => { await sb.from('community_banned_images').delete().eq('hash', hash); renderCommunityAdmin(); };
window.cmUnmute = async uid => { await sb.from('community_mutes').delete().eq('user_id', uid); toast('تم إلغاء الكتم', 'ok'); renderCommunityAdmin(); };
window.cmAdminRestore = async id => {
  await sb.from('community_reports').delete().eq('post_id', id);
  await sb.from('community_posts').update({ hidden: false, report_count: 0 }).eq('id', id);
  toast('✓ رجع المنشور', 'ok'); renderCommunityAdmin();
};
window.cmAdminDelete = id => confirmBox('حذف المنشور', 'حذف المنشور نهائياً؟', async () => {
  await sb.from('community_posts').delete().eq('id', id);
  toast('تم الحذف', 'ok'); renderCommunityAdmin();
}, true);
window.cmAdminBanImg = async (id, hash) => {
  await sb.from('community_banned_images').upsert({ hash, note: 'من البلاغات' });
  await sb.from('community_posts').delete().eq('id', id);
  toast('🚫 تم حظر الصورة', 'ok'); renderCommunityAdmin();
};
window.cmAdminBanUpload = async input => {
  const f = input.files[0]; if(!f) return;
  const blob = typeof schCompress === 'function' ? await schCompress(f, 1280, 0.8) : f;
  const hash = await cmImageHash(blob);
  if(!hash){ toast('تعذّر قراءة الصورة', 'err'); return; }
  const { error } = await sb.from('community_banned_images').upsert({ hash, note: f.name.slice(0, 40) });
  if(error){ toast(cmErr(error.message), 'err'); return; }
  toast('🚫 تم حظر الصورة', 'ok');
  renderCommunityAdmin();
};

document.addEventListener('click', e => {
  const tab = e.target.closest('.admin-tabs button[data-panel="community"]');
  if(tab) setTimeout(renderCommunityAdmin, 50);
});
