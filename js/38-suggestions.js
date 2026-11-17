/* ============================================================
   38) SUGGESTIONS — صندوق الاقتراحات
   - الطالب يرسل اقتراح (ميزة / مشكلة / محتوى / أخرى)
   - يشوف اقتراحاته وحالتها ورد الإدارة
   - الأدمن: كل الاقتراحات + فلترة + رد + تغيير الحالة + حذف
   - تنبيه فوري للأدمن عند وصول اقتراح جديد
============================================================ */

const SUG = { mine: [], all: [], filter: 'all', channel: null };

const SUG_CATS = {
  feature: { t: 'ميزة جديدة', i: 'fa-wand-magic-sparkles', c: '#8b5cf6' },
  bug:     { t: 'مشكلة / خلل', i: 'fa-bug', c: '#ef4444' },
  content: { t: 'محتوى (ملفات/فيديو)', i: 'fa-book', c: '#0ea5e9' },
  other:   { t: 'أخرى', i: 'fa-comment-dots', c: '#64748b' }
};
const SUG_STATUS = {
  new:      { t: 'جديد', c: '#f59e0b', i: 'fa-circle-dot' },
  reviewed: { t: 'قيد الدراسة', c: '#3b82f6', i: 'fa-eye' },
  done:     { t: 'تم التنفيذ', c: '#22c55e', i: 'fa-circle-check' },
  rejected: { t: 'غير مناسب', c: '#94a3b8', i: 'fa-circle-xmark' }
};

/* ================== الطالب ================== */
async function submitSuggestion(){
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  const cat = (document.getElementById('sugCat') || {}).value || 'other';
  const textEl = document.getElementById('sugText');
  const text = (textEl ? textEl.value : '').trim();
  if(text.length < 5){ toast('اكتب اقتراحك بشكل أوضح (5 أحرف على الأقل)', 'warn'); return; }
  if(text.length > 1500){ toast('الاقتراح طويل جداً (1500 حرف كحد أقصى)', 'warn'); return; }

  /* حماية من الإرسال المتكرر: اقتراح كل 30 ثانية */
  const lastKey = 'sug_last_' + currentUserObj.id;
  try{
    const last = parseInt(localStorage.getItem(lastKey) || '0', 10);
    if(Date.now() - last < 30000){ toast('انتظر قليلاً قبل إرسال اقتراح جديد', 'warn'); return; }
  }catch(e){}

  const btn = document.getElementById('sugSend');
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...'; }

  const r = await sbSafeWrite(p => sb.from('suggestions').insert(p), {
    user_id: currentUserObj.id,
    user_name: currentUserObj.name || '',
    user_email: currentUserObj.email || '',
    category: cat,
    text,
    status: 'new'
  });

  if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الاقتراح'; }
  if(r && r.error){ toast('تعذّر الإرسال: ' + r.error.message, 'err'); return; }

  try{ localStorage.setItem(lastKey, String(Date.now())); }catch(e){}
  if(textEl) textEl.value = '';
  updateSugCounter();
  toast('✓ وصل اقتراحك للإدارة — شكراً لك 🌸', 'ok');
  renderMySuggestions();
}
window.submitSuggestion = submitSuggestion;

function updateSugCounter(){
  const t = document.getElementById('sugText');
  const c = document.getElementById('sugCount');
  if(t && c) c.textContent = `${t.value.length} / 1500`;
}

async function renderMySuggestions(){
  const box = document.getElementById('mySuggestions');
  if(!box || !currentUserObj) return;
  const { data, error } = await sb.from('suggestions').select('*').eq('user_id', currentUserObj.id).order('created_at', { ascending: false }).limit(50);
  if(error){ box.innerHTML = `<div class="admin-empty"><h3>تعذّر التحميل</h3><p>${escapeHtml(error.message)}</p></div>`; return; }
  SUG.mine = data || [];
  if(!SUG.mine.length){
    box.innerHTML = '<div class="sug-empty"><i class="far fa-lightbulb"></i><p>ما أرسلت اقتراحات بعد — شاركنا فكرتك!</p></div>';
    return;
  }
  box.innerHTML = SUG.mine.map(s => sugCard(s, false)).join('');
}
window.renderMySuggestions = renderMySuggestions;

function sugCard(s, admin){
  const cat = SUG_CATS[s.category] || SUG_CATS.other;
  const st = SUG_STATUS[s.status] || SUG_STATUS.new;
  const date = s.created_at ? (typeof getTimeAgo === 'function' ? getTimeAgo(new Date(s.created_at)) : new Date(s.created_at).toLocaleDateString('ar-SA')) : '';
  return `
    <div class="sug-card" style="--sc:${cat.c}">
      <div class="sug-top">
        <span class="sug-cat"><i class="fas ${cat.i}"></i> ${cat.t}</span>
        <span class="sug-status" style="--st:${st.c}"><i class="fas ${st.i}"></i> ${st.t}</span>
      </div>
      ${admin ? `<div class="sug-user"><i class="fas fa-user"></i> ${escapeHtml(s.user_name || '—')} <small dir="ltr">${escapeHtml(s.user_email || '')}</small></div>` : ''}
      <p class="sug-text">${escapeHtml(s.text)}</p>
      ${s.admin_reply ? `<div class="sug-reply"><b><i class="fas fa-reply"></i> رد الإدارة:</b> ${escapeHtml(s.admin_reply)}</div>` : ''}
      <div class="sug-foot">
        <small><i class="far fa-clock"></i> ${date}</small>
        ${admin ? `
          <div class="sug-actions">
            <select onchange="setSuggestionStatus('${s.id}', this.value)" class="sort-select">
              ${Object.keys(SUG_STATUS).map(k => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${SUG_STATUS[k].t}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="replySuggestion('${s.id}')"><i class="fas fa-reply"></i> رد</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSuggestion('${s.id}')"><i class="fas fa-trash"></i></button>
          </div>` : ''}
      </div>
    </div>`;
}

/* ================== الأدمن ================== */
async function renderAdminSuggestions(){
  const box = document.getElementById('adminSuggestions');
  if(!box || !isPrivileged()) return;
  const { data, error } = await sb.from('suggestions').select('*').order('created_at', { ascending: false }).limit(300);
  if(error){ box.innerHTML = `<div class="admin-empty"><h3>تعذّر التحميل</h3><p>${escapeHtml(error.message)}</p></div>`; return; }
  SUG.all = data || [];
  updateSugBadge();

  const counts = { all: SUG.all.length };
  Object.keys(SUG_STATUS).forEach(k => counts[k] = SUG.all.filter(s => s.status === k).length);
  const bar = document.getElementById('sugFilterBar');
  if(bar){
    bar.innerHTML = [['all', 'الكل'], ...Object.keys(SUG_STATUS).map(k => [k, SUG_STATUS[k].t])].map(([k, t]) =>
      `<button class="filter-chip ${SUG.filter === k ? 'on' : ''}" onclick="filterSuggestions('${k}')">${t} <b>${counts[k] || 0}</b></button>`).join('');
  }

  const list = SUG.filter === 'all' ? SUG.all : SUG.all.filter(s => s.status === SUG.filter);
  box.innerHTML = list.length
    ? list.map(s => sugCard(s, true)).join('')
    : '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="far fa-lightbulb"></i></div><h3>لا توجد اقتراحات</h3></div>';
}
window.renderAdminSuggestions = renderAdminSuggestions;

window.filterSuggestions = k => { SUG.filter = k; renderAdminSuggestions(); };

function updateSugBadge(){
  const n = SUG.all.filter(s => s.status === 'new').length;
  const b = document.getElementById('sugAdminBadge');
  if(b){ b.textContent = n; b.style.display = n ? 'inline-flex' : 'none'; }
}

window.setSuggestionStatus = async (id, status) => {
  const { error } = await sb.from('suggestions').update({ status }).eq('id', id);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  const s = SUG.all.find(x => x.id === id);
  if(s && typeof sendNotification === 'function' && (status === 'done' || status === 'reviewed')){
    sendNotification('general', status === 'done' ? '💡 تم تنفيذ اقتراحك!' : '💡 اقتراحك قيد الدراسة',
      String(s.text).slice(0, 80), null, null, 'fa-lightbulb', '#8b5cf6', s.user_id);
  }
  toast('✓ تم تحديث الحالة', 'ok');
  renderAdminSuggestions();
};

window.replySuggestion = id => {
  const s = SUG.all.find(x => x.id === id);
  if(!s) return;
  openModal({
    title: 'الرد على الاقتراح',
    text: escapeHtml(String(s.text).slice(0, 200)),
    bodyHTML: `<div class="form-group"><textarea id="sugReplyText" style="min-height:120px;width:100%" placeholder="اكتب ردك...">${escapeHtml(s.admin_reply || '')}</textarea></div>`,
    okText: 'إرسال الرد',
    onOk: async () => {
      const reply = (document.getElementById('sugReplyText').value || '').trim();
      if(!reply){ toast('اكتب الرد', 'warn'); return; }
      const { error } = await sbSafeWrite(p => sb.from('suggestions').update(p).eq('id', id),
        { admin_reply: reply, replied_at: new Date().toISOString(), status: s.status === 'new' ? 'reviewed' : s.status });
      if(error){ toast('فشل: ' + error.message, 'err'); return; }
      if(typeof sendNotification === 'function'){
        sendNotification('general', '💬 ردّت الإدارة على اقتراحك', reply.slice(0, 100), null, null, 'fa-reply', '#5b6cff', s.user_id);
      }
      toast('✓ تم إرسال الرد', 'ok');
      renderAdminSuggestions();
    }
  });
};

window.deleteSuggestion = id => {
  confirmBox('حذف الاقتراح', 'حذف هذا الاقتراح نهائياً؟', async () => {
    const { error } = await sb.from('suggestions').delete().eq('id', id);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    toast('تم الحذف', 'ok');
    renderAdminSuggestions();
  }, true);
};

/* تنبيه للأدمن عند وصول اقتراح جديد */
function subscribeSuggestionsForAdmin(){
  if(!isPrivileged()) return;
  if(SUG.channel){ try{ sb.removeChannel(SUG.channel); }catch(e){} }
  SUG.channel = sb.channel('sug-admin-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suggestions' }, p => {
      const s = p.new || {};
      toast(`💡 اقتراح جديد من ${s.user_name || 'طالب'}`, 'ok');
      SUG.all.unshift(s);
      updateSugBadge();
      const panel = document.getElementById('panel-suggestions');
      if(panel && panel.classList.contains('on')) renderAdminSuggestions();
    })
    .subscribe();
  /* حمّل العدد مرة عند البداية */
  sb.from('suggestions').select('id,status').eq('status', 'new').then(({ data }) => {
    if(data){ SUG.all = data.concat(SUG.all.filter(x => !data.some(d => d.id === x.id))); updateSugBadge(); }
  });
}
window.subscribeSuggestionsForAdmin = subscribeSuggestionsForAdmin;

document.addEventListener('DOMContentLoaded', () => {
  const send = document.getElementById('sugSend'); if(send) send.addEventListener('click', submitSuggestion);
  const t = document.getElementById('sugText'); if(t) t.addEventListener('input', updateSugCounter);

  /* فتح تبويب الاقتراحات في لوحة الأدمن → تحميل */
  document.addEventListener('click', e => {
    const tab = e.target.closest('.admin-tabs button[data-panel="suggestions"]');
    if(tab) setTimeout(renderAdminSuggestions, 50);
  });
});
