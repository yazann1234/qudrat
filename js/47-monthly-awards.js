/* ============================================================
   47) MONTHLY AWARDS — شهادات أبطال الشهر 🏆
   - نهاية كل شهر: رئيس المنصة يضغط «إرسال شهادات الشهر»
     → أول 3 يوصلهم هدية فيها شهادتهم (ذهبي / فضي / برونزي)
   - تنبيه تلقائي لرئيس المنصة آخر الشهر لو ما أرسلها
   - «أبطال الشهور» في صفحة المتصدرين: كل الشهادات السابقة محفوظة
   - خيار تصفير النقاط بعد الإرسال لبدء منافسة شهر جديد
============================================================ */

const MA = { list: [], loaded: false };
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function maMonthKey(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function maMonthLabel(d){ return AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function maKeyToLabel(k){
  const [y, m] = String(k).split('-').map(Number);
  return (AR_MONTHS[(m || 1) - 1] || '') + ' ' + y;
}

/* الشهر المستهدف: أول 5 أيام من الشهر = الشهر الماضي، غير كذا = الشهر الحالي */
function maTargetMonth(){
  const now = new Date();
  if(now.getDate() <= 5) return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function maIsAwardWindow(){
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() >= last - 2 || now.getDate() <= 5;
}

async function maLoad(){
  const { data, error } = await sb.from('monthly_awards').select('*')
    .order('month', { ascending: false }).order('rank', { ascending: true }).limit(60);
  if(error){ console.warn('[awards]', error.message); MA.list = []; return []; }
  MA.list = data || [];
  MA.loaded = true;
  return MA.list;
}

/* ================== 🏛️ أبطال الشهور (صفحة المتصدرين) ================== */
async function renderHallOfFame(){
  let box = document.getElementById('lbHall');
  const podium = document.getElementById('lbPodium');
  if(!box && podium){
    box = document.createElement('div');
    box.id = 'lbHall';
    const title = podium.previousElementSibling;
    podium.parentNode.insertBefore(box, title && title.classList.contains('sec-title') ? title : podium);
  }
  if(!box) return;
  await maLoad();

  const owner = typeof isPrivileged === 'function' && isPrivileged();
  const target = maMonthKey(maTargetMonth());
  const sentTarget = MA.list.some(a => a.month === target);
  const reminder = owner && maIsAwardWindow() && !sentTarget
    ? `<div class="ma-reminder"><i class="fas fa-bell"></i> حان وقت إرسال شهادات <b>${maKeyToLabel(target)}</b> لأول 3 🏆
         <button class="btn btn-primary btn-sm" onclick="openMonthlyAwards()"><i class="fas fa-gift"></i> أرسلها الآن</button></div>` : '';

  if(!MA.list.length){
    box.innerHTML = reminder + (owner ? '' : `
      <div class="ma-empty"><i class="fas fa-award"></i> نهاية كل شهر يحصل أول 3 في الصدارة على <b>شهادة شكر وتقدير</b> من رئيس المنصة — نافس الحين! 🔥</div>`);
    return;
  }

  /* نجمّع حسب الشهر (آخر 6 شهور) */
  const months = [];
  MA.list.forEach(a => {
    let g = months.find(x => x.month === a.month);
    if(!g){ g = { month: a.month, label: a.month_label || maKeyToLabel(a.month), items: [] }; months.push(g); }
    g.items.push(a);
  });
  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉';
  box.innerHTML = reminder + `
    <div class="sec-title"><i class="fas fa-crown" style="color:#f59e0b"></i> أبطال الشهور <span class="sub">شهادات الشكر والتقدير</span></div>
    <div class="ma-months">
      ${months.slice(0, 6).map(g => `
        <div class="ma-month">
          <div class="ma-month-head"><i class="fas fa-calendar"></i> ${escapeHtml(g.label)}
            ${owner ? `<button class="ma-del" onclick="deleteMonthlyAwards('${g.month}')" title="حذف شهادات هذا الشهر"><i class="fas fa-trash-can"></i></button>` : ''}
          </div>
          ${g.items.sort((a, b) => a.rank - b.rank).map(a => {
            const me = currentUserObj && a.user_id === currentUserObj.id;
            return `<button class="ma-winner r${a.rank} ${me ? 'me' : ''}" onclick="openAwardCertificate('${a.id}')">
              <span class="ma-medal">${medal(a.rank)}</span>
              <span class="ma-name">${escapeHtml(a.name || 'طالب')}${me ? ' <small>(أنت)</small>' : ''}</span>
              <span class="ma-xp">${Number(a.xp || 0).toLocaleString('en')} XP</span>
              <i class="fas fa-award"></i>
            </button>`;
          }).join('')}
        </div>`).join('')}
    </div>`;
}
window.renderHallOfFame = renderHallOfFame;

window.openAwardCertificate = async (awardId) => {
  let a = MA.list.find(x => x.id === awardId);
  if(!a){
    const { data } = await sb.from('monthly_awards').select('*').eq('id', awardId).maybeSingle();
    a = data;
  }
  if(!a){ toast('الشهادة غير موجودة', 'warn'); return; }
  if(typeof showCertificateModal !== 'function') return;
  showCertificateModal({ id: a.user_id, name: a.name || 'طالب', rank: a.rank, xp: a.xp, monthLabel: a.month_label || maKeyToLabel(a.month) });
};

/* ================== 🎁 إرسال شهادات الشهر (رئيس المنصة) ================== */
window.openMonthlyAwards = async () => {
  if(!(typeof isPrivileged === 'function' && isPrivileged())){ toast('هذه الصلاحية للإدارة فقط', 'err'); return; }
  if(!(window._lbUsers || []).length && typeof renderLeaderboard === 'function') await renderLeaderboard();
  const top = (window._lbUsers || []).filter(u => u.xp > 0).slice(0, 3);
  if(!top.length){ toast('ما فيه طلاب عندهم نقاط بعد', 'warn'); return; }

  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const tgt = maTargetMonth();
  const medal = r => r === 1 ? '🥇 الأول' : r === 2 ? '🥈 الثاني' : '🥉 الثالث';
  const IN = 'width:100%;font-family:inherit;font-size:.88rem;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)';

  openModal({
    title: '🏆 إرسال شهادات الشهر',
    text: 'كل طالب من أول 3 يوصله <b>هدية</b> فيها شهادته (ذهبي / فضي / برونزي) + إشعار.',
    bodyHTML: `
      <div class="form-group" style="margin-bottom:12px"><label>الشهر</label>
        <select id="maMonth" style="${IN}">
          ${[cur, prev].map(d => `<option value="${maMonthKey(d)}" data-label="${maMonthLabel(d)}" ${maMonthKey(d) === maMonthKey(tgt) ? 'selected' : ''}>${maMonthLabel(d)}</option>`).join('')}
        </select></div>
      <div class="ma-preview">
        ${top.map((u, i) => `<div class="ma-prev-row r${i + 1}"><b>${medal(i + 1)}</b><span>${escapeHtml(u.name)}</span><small>${u.xp.toLocaleString('en')} XP</small></div>`).join('')}
      </div>
      <div class="form-group" style="margin:12px 0"><label>رسالة الهدية</label>
        <textarea id="maMsg" style="${IN};min-height:80px">مبروك! 🎉 تميّزك هذا الشهر يستاهل التقدير — هذه شهادتك، واصل وخلك قدوة لزملائك 💙</textarea></div>
      <label style="display:flex;gap:8px;align-items:center;font-weight:700;font-size:.84rem;cursor:pointer">
        <input type="checkbox" id="maReset"> تصفير نقاط الجميع بعد الإرسال (بداية منافسة شهر جديد)
      </label>`,
    okText: '🎁 إرسال الشهادات',
    onOk: async () => {
      const sel = document.getElementById('maMonth');
      const month = sel.value;
      const label = sel.selectedOptions[0].dataset.label;
      const msg = (document.getElementById('maMsg').value || '').trim();
      const reset = document.getElementById('maReset').checked;
      await maSend(month, label, top, msg, reset);
    }
  });
};

async function maSend(month, label, top, msg, reset){
  const { data: exist } = await sb.from('monthly_awards').select('id').eq('month', month).limit(1);
  if(exist && exist.length){ toast(`شهادات ${label} مرسلة مسبقاً — احذفها من «أبطال الشهور» لو تبي تعيد`, 'warn'); return; }

  const rows = top.map((u, i) => ({
    month, month_label: label, user_id: u.id, rank: i + 1, name: u.name, xp: u.xp, created_by: currentUserObj.id
  }));
  const { data: awards, error } = await sb.from('monthly_awards').insert(rows).select();
  if(error){ toast('فشل: ' + error.message, 'err'); return; }

  const word = r => r === 1 ? 'الأول' : r === 2 ? 'الثاني' : 'الثالث';
  let sent = 0;
  const failed = [];
  for(const a of awards){
    const payload = {
      user_id: a.user_id,
      sender_id: currentUserObj.id,
      sender_name: currentUserObj.name || 'رئيس المنصة',
      title: `🏆 شهادة المركز ${word(a.rank)} — ${label}`,
      message: msg || 'مبروك! هذه شهادتك 🎉',
      gift_type: 'prize',
      gift_action: 'show',
      gift_extra_months: 0,
      award_id: a.id
    };
    const r = await sbSafeWrite(p => sb.from('student_gifts').insert(p), payload);
    if(r && !r.error) sent++;
    else failed.push((a.name || 'طالب') + ': ' + ((r && r.error && r.error.message) || 'خطأ'));
    if(typeof sendNotification === 'function'){
      try{ await sendNotification('gift', '🏆 وصلتك شهادة الشهر!', `حققت المركز ${word(a.rank)} في ${label} — افتح هداياك`, null, null, 'fa-award', '#f59e0b', a.user_id); }catch(e){}
    }
  }
  if(typeof logAdminAction === 'function') logAdminAction('send_gift', null, `إرسال شهادات ${label}`, { month, winners: awards.map(a => a.name) });

  if(reset){
    const { error: e2 } = await sb.rpc('reset_all_points');
    if(e2) toast('تم الإرسال لكن فشل التصفير: ' + e2.message, 'warn');
    else toast('🔄 تم تصفير النقاط — بدأت منافسة الشهر الجديد', 'ok');
  }
  if(failed.length){
    console.warn('[awards] gift insert failed', failed);
    toast(`⚠️ تم حفظ الشهادات لكن ${failed.length} هدية ما وصلت — شغّل ملف supabase-update-10.sql (${failed[0]})`, 'err');
  } else toast(`🎁 تم إرسال ${sent} شهادة لأبطال ${label}`, 'ok');
  if(typeof renderLeaderboard === 'function') renderLeaderboard();
}

window.deleteMonthlyAwards = (month) => {
  confirmBox('حذف شهادات الشهر', `حذف شهادات ${maKeyToLabel(month)} من «أبطال الشهور»؟ (الهدايا المرسلة تبقى عند الطلاب)`, async () => {
    const { error } = await sb.from('monthly_awards').delete().eq('month', month);
    if(error){ toast('فشل: ' + error.message, 'err'); return; }
    toast('تم الحذف', 'warn');
    renderHallOfFame();
  }, true);
};

/* ================== زر «عرض شهادتك» داخل الهدية ================== */
(function hookGift(){
  const wrap = () => {
    if(typeof window.showGiftCelebration !== 'function' || window._maHooked) return;
    window._maHooked = true;
    const orig = window.showGiftCelebration;
    window.showGiftCelebration = function(g){
      orig.apply(this, arguments);
      const actions = document.querySelector('#giftCelebrationModal .gift-celeb-actions');
      if(!actions) return;
      const old = document.getElementById('giftCertBtn'); if(old) old.remove();
      if(g && g.award_id){
        const b = document.createElement('button');
        b.id = 'giftCertBtn';
        b.className = 'btn gift-cert-btn';
        b.innerHTML = '<i class="fas fa-award"></i> عرض شهادتك 🏆';
        b.onclick = () => {
          try{ if(typeof closeGiftCelebration === 'function') closeGiftCelebration(); }catch(e){}
          openAwardCertificate(g.award_id);
        };
        actions.insertBefore(b, actions.firstChild);
      }
    };
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap); else wrap();
})();

/* ================== تنبيه رئيس المنصة آخر الشهر ================== */
document.addEventListener('DOMContentLoaded', () => {
  let tries = 0;
  const t = setInterval(async () => {
    tries++;
    if(!currentUserObj){ if(tries > 60) clearInterval(t); return; }
    clearInterval(t);
    if(!(typeof isPrivileged === 'function' && isPrivileged()) || !maIsAwardWindow()) return;
    const key = 'ma_remind_' + maMonthKey(maTargetMonth()) + '_' + new Date().getDate();
    try{ if(localStorage.getItem(key)) return; localStorage.setItem(key, '1'); }catch(e){}
    const { data } = await sb.from('monthly_awards').select('id').eq('month', maMonthKey(maTargetMonth())).limit(1);
    if(data && data.length) return;
    setTimeout(() => {
      openModal({
        title: '🏆 نهاية الشهر',
        text: `حان وقت إرسال شهادات <b>${maKeyToLabel(maMonthKey(maTargetMonth()))}</b> لأول 3 في الصدارة.`,
        okText: 'افتح الإرسال',
        onOk: () => openMonthlyAwards()
      });
    }, 4000);
  }, 1000);
});
