/* ============================================================
   40) ADMIN COURSES — إدارة الدورات (الأسعار لكل مدة)
   - تعديل أسعار دورة المحوسب / الورقي / أي دورة: شهر، 3 أشهر، 6، سنة
   - الاسم + الوصف + اللون + تاريخ النهاية الثابت + إظهار/إخفاء
   - إضافة دورة جديدة
============================================================ */

const ACS = { list: [] };
const ACS_DURS = [1, 3, 6, 12];

async function loadAdminCourses(){
  const { data, error } = await sb.from('courses').select('*').order('sort_order', { ascending: true });
  if(error){ toast('تعذّر تحميل الدورات: ' + error.message, 'err'); return []; }
  ACS.list = data || [];
  return ACS.list;
}

async function renderAdminCourses(){
  const box = document.getElementById('adminCoursesGrid');
  if(!box || !isPrivileged()) return;
  box.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px"><i class="fas fa-spinner fa-spin" style="font-size:1.6rem;color:var(--primary)"></i></div>';
  const list = await loadAdminCourses();
  if(!list.length){
    box.innerHTML = '<div class="admin-empty" style="grid-column:1/-1"><div class="em-ic"><i class="fas fa-graduation-cap"></i></div><h3>لا توجد دورات</h3></div>';
    return;
  }
  const students = (DB.users || []).filter(u => u.status === 'approved' && u.role !== 'admin' && u.role !== 'owner');
  box.innerHTML = list.map(c => {
    const prices = c.prices || {};
    const count = students.filter(u => typeof userHasCourse === 'function' && userHasCourse(c.id, u)).length;
    return `
      <div class="acs-card ${c.active === false ? 'off' : ''}" style="--cc:${c.color || '#5b6cff'}">
        <div class="acs-head">
          <div class="acs-ic"><i class="fas ${c.icon || 'fa-graduation-cap'}"></i></div>
          <div style="flex:1;min-width:0">
            <h4>${escapeHtml(c.name)}</h4>
            <small dir="ltr">${escapeHtml(c.code || '')}</small>
          </div>
          ${c.active === false ? '<span class="acs-off">مخفية</span>' : ''}
        </div>
        <div class="acs-prices">
          ${c.subscription_end_date
            ? `<div class="acs-fixed"><i class="fas fa-calendar-check"></i> حتى ${escapeHtml(String(c.subscription_end_date))} • ${priceHTML(getCourseDisplayPrice(c))}</div>`
            : ACS_DURS.map(m => `<div class="acs-p ${Number(prices[String(m)]) > 0 ? '' : 'none'}"><small>${monthsLabel(m)}</small>${Number(prices[String(m)]) > 0 ? priceHTML(prices[String(m)]) : '<b>—</b>'}</div>`).join('')}
        </div>
        <div class="acs-meta"><i class="fas fa-users"></i> ${count} طالب مشترك</div>
        <button class="btn btn-primary btn-sm" style="width:100%" onclick="editAdminCourse('${c.id}')"><i class="fas fa-pen"></i> تعديل الأسعار والبيانات</button>
      </div>`;
  }).join('');
}
window.renderAdminCourses = renderAdminCourses;

function acsField(id, label, value, type, extra){
  return `<div class="form-group" style="margin-bottom:10px"><label>${label}</label>
    <input type="${type || 'text'}" id="${id}" value="${escapeHtml(value == null ? '' : value)}" ${extra || ''}
      style="width:100%;font-family:inherit;font-size:.88rem;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text);outline:none"></div>`;
}

window.editAdminCourse = (id) => {
  const c = id ? ACS.list.find(x => x.id === id) : null;
  const prices = (c && c.prices) || {};
  openModal({
    title: c ? 'تعديل الدورة: ' + c.name : 'دورة جديدة',
    text: 'اترك سعر المدة فارغاً لإخفائها من المتجر.',
    bodyHTML: `
      ${acsField('acsName', 'اسم الدورة *', c ? c.name : '')}
      ${c ? '' : acsField('acsCode', 'كود الدورة (إنجليزي بدون مسافات) *', '', 'text', 'dir="ltr" placeholder="computerized"')}
      <div class="form-group" style="margin-bottom:10px"><label>الوصف</label>
        <textarea id="acsDesc" style="width:100%;min-height:60px;font-family:inherit;font-size:.86rem;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--text)">${escapeHtml(c ? (c.description || '') : '')}</textarea></div>
      <label style="font-weight:800;font-size:.84rem">الأسعار لكل مدة</label>
      <div class="price-grid" style="margin:8px 0 12px">
        ${ACS_DURS.map(m => `
          <label class="price-field"><span>${monthsLabel(m)}</span>
            <div class="pf-input"><input type="number" min="0" step="1" id="acsP${m}" value="${Number(prices[String(m)]) > 0 ? Number(prices[String(m)]) : ''}"><i class="sar"></i></div>
          </label>`).join('')}
      </div>
      ${acsField('acsEnd', 'تاريخ نهاية ثابت (اختياري — يُستخدم أقل سعر)', c && c.subscription_end_date ? String(c.subscription_end_date).slice(0, 10) : '', 'date')}
      ${acsField('acsColor', 'اللون', c ? (c.color || '#5b6cff') : '#5b6cff', 'color', 'style="height:44px"')}
      <label class="checkbox-row" style="display:flex;gap:8px;align-items:center;font-weight:700;font-size:.86rem;margin-top:6px">
        <input type="checkbox" id="acsActive" ${!c || c.active !== false ? 'checked' : ''}> الدورة ظاهرة في المتجر
      </label>`,
    okText: 'حفظ',
    onOk: async () => {
      const name = (document.getElementById('acsName').value || '').trim();
      if(!name){ toast('أدخل اسم الدورة', 'warn'); return; }
      const newPrices = {};
      ACS_DURS.forEach(m => { const v = parseFloat(document.getElementById('acsP' + m).value); if(v > 0) newPrices[String(m)] = v; });
      if(!Object.keys(newPrices).length){ toast('أدخل سعراً لمدة واحدة على الأقل', 'warn'); return; }
      const payload = {
        name,
        description: (document.getElementById('acsDesc').value || '').trim(),
        prices: newPrices,
        subscription_end_date: document.getElementById('acsEnd').value || null,
        color: document.getElementById('acsColor').value || '#5b6cff',
        active: document.getElementById('acsActive').checked
      };
      let r;
      if(c){
        r = await sbSafeWrite(p => sb.from('courses').update(p).eq('id', c.id), payload);
      } else {
        const code = (document.getElementById('acsCode').value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if(!code){ toast('أدخل كود الدورة بالإنجليزي', 'warn'); return; }
        payload.code = code;
        payload.icon = 'fa-graduation-cap';
        payload.sort_order = ACS.list.length + 1;
        r = await sbSafeWrite(p => sb.from('courses').insert(p), payload);
      }
      if(r.error){ toast('فشل: ' + r.error.message, 'err'); return; }

      /* حدّث المنتج المرتبط (لو موجود) بنفس الأسعار حتى لا ترجع القديمة */
      if(c && c.code){
        try{
          await sbSafeWrite(p => sb.from('products').update(p).eq('course_code', c.code),
            { prices: newPrices, price: Math.min(...Object.values(newPrices)), subscription_end_date: payload.subscription_end_date });
        }catch(e){}
      }
      if(typeof logAdminAction === 'function') logAdminAction('update_settings', null, (c ? 'تعديل دورة: ' : 'إضافة دورة: ') + name, payload);
      toast('✓ تم حفظ الدورة', 'ok');
      try{ await loadCourses(); }catch(e){}
      try{ renderCoursesGrid(); }catch(e){}
      renderAdminCourses();
    }
  });
};

document.addEventListener('click', e => {
  const tab = e.target.closest('.admin-tabs button[data-panel="courses"]');
  if(tab) setTimeout(renderAdminCourses, 50);
});
