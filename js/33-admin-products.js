/* ============================================================
   33) ADMIN PRODUCTS — إدارة المنتجات الكاملة مع الصور
============================================================ */

/* ⭐ حساب نهاية الاشتراك + فرض التاريخ الثابت انتقلت إلى activateSubscription
   في 30-owner-features.js (بدل التغليف بـ setInterval) */

/* ⭐ 3) الثوابت */
const PRODUCT_ICONS = [
  'fa-graduation-cap','fa-book','fa-calculator','fa-brain',
  'fa-lightbulb','fa-star','fa-crown','fa-fire','fa-rocket',
  'fa-award','fa-medal','fa-trophy','fa-chalkboard-user',
  'fa-pen-ruler','fa-language','fa-infinity','fa-file-lines',
  'fa-laptop','fa-book-open','fa-bolt'
];
const PRODUCT_COLORS = [
  '#5b6cff','#8b5cf6','#7c3aed','#ec4899','#db2777','#ef4444',
  '#f59e0b','#f7b32b','#22c55e','#16a34a','#14b8a6','#06b6d4','#0ea5e9'
];

const PF_DURATIONS = [1, 3, 6, 12];

/* ⭐ قراءة/تعبئة حقول الأسعار (سعر مستقل لكل مدة) */
function readPriceInputs(){
  const prices = {};
  PF_DURATIONS.forEach(m => {
    const el = document.getElementById('pfPrice' + m);
    const v = el ? parseFloat(el.value) : NaN;
    if(v > 0) prices[String(m)] = v;
  });
  return prices;
}
function fillPriceInputs(prices){
  PF_DURATIONS.forEach(m => {
    const el = document.getElementById('pfPrice' + m);
    if(el) el.value = (prices && Number(prices[String(m)]) > 0) ? Number(prices[String(m)]) : '';
  });
}
/* أسعار المنتج: من المنتج نفسه، أو من الدورة المرتبطة، أو السعر القديم الموحد */
function getProductPrices(p){
  if(!p) return {};
  if(p.prices && typeof p.prices === 'object' && Object.keys(p.prices).length) return p.prices;
  const code = p.course_code || ('auto_' + p.id);
  const c = (typeof CS !== 'undefined' ? CS.courses : []).find(x => x.code === code);
  if(c && c.prices && Object.keys(c.prices).length) return c.prices;
  return Number(p.price) > 0 ? { '1': Number(p.price) } : {};
}
window.getProductPrices = getProductPrices;

let pfSelectedIcon  = 'fa-graduation-cap';
let pfSelectedColor = '#5b6cff';
let _productImageFile = null;

/* ⭐ 4) تبديل تبويب لوحة الأدمن */
function switchAdminPanel(panelName){
  document.querySelectorAll('.admin-tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.panel === panelName);
  });
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('on'));
  const panel = document.getElementById('panel-' + panelName);
  if(panel) panel.classList.add('on');
}
window.switchAdminPanel = switchAdminPanel;

window.backToProductsList = () => switchAdminPanel('products');

/* ⭐ 5) عرض قائمة المنتجات */
function renderAdminProducts(){
  const box = document.getElementById('adminProductsGrid');
  if(!box) return;

  const list = DB.products || [];
  const stat1 = document.getElementById('adProducts');
  if(stat1) stat1.textContent = list.filter(p => p.active).length;

  const counter = document.getElementById('productsCount');
  if(counter) counter.textContent = list.length;

  if(!list.length){
    box.innerHTML = `
      <div class="admin-empty" style="grid-column:1/-1">
        <div class="em-ic"><i class="fas fa-shopping-bag"></i></div>
        <h3>لا توجد منتجات بعد</h3>
        <p>اضغط «منتج جديد» لإضافة أول منتج</p>
      </div>`;
    return;
  }

  box.innerHTML = list.map(p => `
    <div class="admin-product-card ${p.active ? '' : 'inactive'}" style="--pc:${p.color || '#5b6cff'}">
      ${p.image_url ? `
        <div class="apc-image" style="background-image:url('${p.image_url}')"></div>
      ` : `
        <div class="apc-icon-wrap">
          <div class="apc-icon" style="background:color-mix(in srgb,${p.color || '#5b6cff'} 15%,transparent);color:${p.color || '#5b6cff'}">
            <i class="fas ${p.icon || 'fa-graduation-cap'}"></i>
          </div>
        </div>
      `}

      <div class="apc-body">
        <div class="apc-head">
          <h4>${escapeHtml(p.title || '—')}</h4>
          ${p.popular ? '<span class="apc-badge popular"><i class="fas fa-fire"></i> الأكثر طلباً</span>' : ''}
          ${!p.active ? '<span class="apc-badge inactive"><i class="fas fa-eye-slash"></i> مخفي</span>' : ''}
        </div>
        ${p.subtitle ? `<small class="apc-sub">${escapeHtml(p.subtitle)}</small>` : ''}
        ${p.description ? `<p class="apc-desc">${escapeHtml(p.description)}</p>` : ''}

        <div class="apc-durations">
          ${(() => {
            const pr = getProductPrices(p);
            const items = PF_DURATIONS.filter(m => Number(pr[String(m)]) > 0);
            if(!items.length) return '<span class="apc-no-price">لا توجد أسعار</span>';
            return items.map(m => `<div class="apc-dur"><small>${typeof monthsLabel === 'function' ? monthsLabel(m) : m + ' شهر'}</small>${priceHTML(pr[String(m)], p.currency)}</div>`).join('');
          })()}
        </div>

        ${p.course_code ? `<div class="apc-features-count"><i class="fas fa-link"></i> مرتبط بدورة: ${escapeHtml(p.course_code)}</div>` : ''}
${p.subscription_end_date ? `<div class="apc-features-count" style="color:var(--accent)"><i class="fas fa-calendar-check"></i> ينتهي: ${escapeHtml(p.subscription_end_date)}</div>` : ''}
        ${p.features && p.features.length ? `<div class="apc-features-count"><i class="fas fa-list-check"></i> ${p.features.length} ميزة</div>` : ''}

        <div class="apc-actions">
          <button class="btn btn-ghost btn-sm" onclick="adminEditProduct('${p.id}')" style="flex:1">
            <i class="fas fa-pen"></i> تعديل
          </button>
          <button class="btn btn-ghost btn-sm" onclick="adminToggleProductActive('${p.id}')" title="${p.active ? 'إخفاء' : 'إظهار'}">
            <i class="fas ${p.active ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteProduct('${p.id}')" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}
window.renderAdminProducts = renderAdminProducts;

/* ⭐ 6) منتج جديد */
window.adminNewProduct = () => {
  document.getElementById('productFormTitle').textContent = 'إضافة منتج جديد';
  document.getElementById('pfId').value = '';
  document.getElementById('pfTitle').value = '';
  document.getElementById('pfSubtitle').value = '';
  document.getElementById('pfDesc').value = '';
  fillPriceInputs({});
  document.getElementById('pfCurrency').value = 'ر.س';
  if(document.getElementById('pfEndDate')) document.getElementById('pfEndDate').value = '';
  if(document.getElementById('pfCourseCode')) document.getElementById('pfCourseCode').value = '';
  document.getElementById('pfFeatures').value = '';
  document.getElementById('pfPopular').checked = false;
  document.getElementById('pfActive').checked = true;
  pfSelectedIcon = 'fa-graduation-cap';
  pfSelectedColor = '#5b6cff';
  renderIconPicker();
  renderColorPicker();
  clearProductImage();
  switchAdminPanel('addproduct');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ⭐ 7) تعديل منتج */
window.adminEditProduct = id => {
  const p = (DB.products || []).find(x => x.id === id);
  if(!p) return;

  document.getElementById('productFormTitle').textContent = 'تعديل المنتج';
  document.getElementById('pfId').value = p.id;
  document.getElementById('pfTitle').value = p.title || '';
  document.getElementById('pfSubtitle').value = p.subtitle || '';
  document.getElementById('pfDesc').value = p.description || '';
  fillPriceInputs(getProductPrices(p));
  document.getElementById('pfCurrency').value = p.currency || 'ر.س';
  if(document.getElementById('pfEndDate')) document.getElementById('pfEndDate').value = p.subscription_end_date ? String(p.subscription_end_date).slice(0, 10) : '';
  if(document.getElementById('pfCourseCode')) document.getElementById('pfCourseCode').value = p.course_code || '';
  document.getElementById('pfFeatures').value = (p.features || []).join('\n');
  document.getElementById('pfPopular').checked = !!p.popular;
  document.getElementById('pfActive').checked = p.active !== false;
  pfSelectedIcon = p.icon || 'fa-graduation-cap';
  pfSelectedColor = p.color || '#5b6cff';
  renderIconPicker();
  renderColorPicker();

  /* عرض الصورة الحالية */
  _productImageFile = null;
  const inp = document.getElementById('pfImageInput');
  if(inp) inp.value = '';
  const prev = document.getElementById('pfImagePreview');
  if(prev){
    if(p.image_url){
      prev.innerHTML = `
        <div style="position:relative;display:inline-block">
          <img src="${p.image_url}" style="max-width:180px;max-height:140px;border-radius:10px;border:1px solid var(--border)">
          <button type="button" onclick="clearProductImage()" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer">
            <i class="fas fa-times"></i>
          </button>
        </div>`;
    } else {
      prev.innerHTML = '';
    }
  }

  switchAdminPanel('addproduct');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ⭐ 8) منتقي الأيقونات */
function renderIconPicker(){
  const box = document.getElementById('pfIconPicker');
  if(!box) return;
  box.innerHTML = PRODUCT_ICONS.map(ic => `
    <button type="button" class="icon-pick ${ic === pfSelectedIcon ? 'on' : ''}" data-icon="${ic}">
      <i class="fas ${ic}"></i>
    </button>
  `).join('');
  box.querySelectorAll('.icon-pick').forEach(b => {
    b.addEventListener('click', () => {
      pfSelectedIcon = b.dataset.icon;
      box.querySelectorAll('.icon-pick').forEach(x => x.classList.toggle('on', x === b));
    });
  });
}

/* ⭐ 9) منتقي الألوان */
function renderColorPicker(){
  const box = document.getElementById('pfColorPicker');
  if(!box) return;
  box.innerHTML = PRODUCT_COLORS.map(c => `
    <button type="button" class="color-pick ${c === pfSelectedColor ? 'on' : ''}" data-c="${c}" style="--cc:${c}"></button>
  `).join('');
  box.querySelectorAll('.color-pick').forEach(b => {
    b.addEventListener('click', () => {
      pfSelectedColor = b.dataset.c;
      box.querySelectorAll('.color-pick').forEach(x => x.classList.toggle('on', x === b));
    });
  });
}

/* ⭐ 10) معاينة وحذف صورة المنتج */
window.previewProductImage = function(input){
  const f = input.files[0];
  if(!f) return;
  if(!f.type.startsWith('image/')){ toast('اختر صورة صحيحة', 'warn'); return; }
  if(f.size > 5 * 1024 * 1024){ toast('الحد 5 ميجا', 'warn'); return; }
  _productImageFile = f;
  const prev = document.getElementById('pfImagePreview');
  if(!prev) return;
  const reader = new FileReader();
  reader.onload = e => {
    prev.innerHTML = `
      <div style="position:relative;display:inline-block">
        <img src="${e.target.result}" style="max-width:180px;max-height:140px;border-radius:10px;border:1px solid var(--border)">
        <button type="button" onclick="clearProductImage()" style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  };
  reader.readAsDataURL(f);
};

window.clearProductImage = function(){
  _productImageFile = null;
  const inp = document.getElementById('pfImageInput');
  if(inp) inp.value = '';
  const prev = document.getElementById('pfImagePreview');
  if(prev) prev.innerHTML = '';
};

/* ⭐ 11) حفظ المنتج (مع رفع الصورة) */
(function bindProductSave(){
  const btn = document.getElementById('pfSave');
  if(!btn || btn.dataset.finalBound) return;
  const clone = btn.cloneNode(true);
  clone.dataset.finalBound = '1';
  btn.parentNode.replaceChild(clone, btn);

  clone.addEventListener('click', async () => {
    if(!isPrivileged()){ toast('غير مصرح', 'err'); return; }
    if(clone.disabled) return;

    const id          = document.getElementById('pfId').value.trim();
    const title       = document.getElementById('pfTitle').value.trim();
    const subtitle    = document.getElementById('pfSubtitle').value.trim();
    const description = document.getElementById('pfDesc').value.trim();
    const prices      = readPriceInputs();
    const priceVals   = Object.values(prices);
    const price       = priceVals.length ? Math.min(...priceVals) : 0;
    const endDateEl   = document.getElementById('pfEndDate');
    const endDate     = endDateEl && endDateEl.value ? endDateEl.value : null;
    const currency    = document.getElementById('pfCurrency').value.trim() || 'ر.س';
    const features    = document.getElementById('pfFeatures').value.split('\n').map(s => s.trim()).filter(Boolean);
    const popular     = document.getElementById('pfPopular').checked;
    const active      = document.getElementById('pfActive').checked;
    const courseCode  = document.getElementById('pfCourseCode') ? document.getElementById('pfCourseCode').value.trim() : '';

    if(!title){ toast('أدخل اسم المنتج', 'warn'); return; }
    if(!priceVals.length){ toast('أدخل سعراً لمدة واحدة على الأقل', 'warn'); return; }

    clone.disabled = true;
    const orig = clone.innerHTML;
    clone.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    /* رفع الصورة */
    let imageUrl = null;
    if(_productImageFile){
      try{
        const blob = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const ratio = Math.min(800 / img.width, 800 / img.height, 1);
              const w = Math.round(img.width * ratio);
              const h = Math.round(img.height * ratio);
              const c = document.createElement('canvas');
              c.width = w; c.height = h;
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.85);
            };
            img.onerror = rej;
            img.src = reader.result;
          };
          reader.onerror = rej;
          reader.readAsDataURL(_productImageFile);
        });

        const path = '_products/' + (id || Date.now()) + '_' + Math.random().toString(36).slice(2,8) + '.jpg';
        const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, {
          cacheControl: '3600', upsert: true, contentType: 'image/jpeg'
        });
        if(!upErr){
          const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
          imageUrl = urlData ? urlData.publicUrl + '?t=' + Date.now() : null;
        } else {
          console.warn('Image upload failed:', upErr.message);
          toast('تعذّر رفع الصورة، سيتم الحفظ بدونها', 'warn');
        }
      }catch(e){ console.warn('Image process failed:', e); }
    }

    const payload = {
      title, subtitle, description, price, currency,
      prices,
      subscription_end_date: endDate,
      icon: pfSelectedIcon, color: pfSelectedColor,
      features, popular, active
    };
    if(imageUrl) payload.image_url = imageUrl;
    if(courseCode) payload.course_code = courseCode;

        let error;
    let savedId = id;
    /* sbSafeWrite: لو عمود prices غير موجود بجدول products يحفظ الباقي
       (الأسعار تُحفظ دائماً في جدول courses عبر syncProductToCourse) */
    if(id){
      const r = await sbSafeWrite(pl => sb.from('products').update(pl).eq('id', id), payload);
      error = r.error;
    } else {
      const r = await sbSafeWrite(pl => sb.from('products').insert(pl).select('id').single(), payload);
      error = r.error;
      if(r.data && r.data.id) savedId = r.data.id;
    }

    clone.disabled = false;
    clone.innerHTML = orig;

    if(error){ toast('فشل: ' + error.message, 'err'); return; }

    if(typeof logAdminAction === 'function'){
      await logAdminAction(id ? 'edit_product' : 'add_product', null, `${id ? 'تعديل' : 'إضافة'} منتج: ${title}`);
    }

    toast(id ? '✓ تم التحديث' : '✓ تم الإضافة', 'ok');

    /* ⭐⭐⭐ دائماً ازامن مع الدورات (حتى لو ما فيه course_code) */
    if(typeof syncProductToCourse === 'function'){
      const existing = (DB.products || []).find(x => x.id === savedId);
      await syncProductToCourse({ ...payload, id: savedId, course_code: courseCode || (existing && existing.course_code) || undefined });
    }

    /* ⭐ أعِد تحميل الدورات واعرضها في المتجر */
    try{
      if(typeof loadCourses === 'function') await loadCourses();
      if(typeof renderCoursesGrid === 'function') renderCoursesGrid();
    }catch(e){}

    if(typeof loadProducts === 'function') await loadProducts();
    if(typeof renderProducts === 'function') renderProducts();
    backToProductsList();

    _productImageFile = null;
    const prev = document.getElementById('pfImagePreview');
    if(prev) prev.innerHTML = '';
  });
})();

/* ⭐ 12) تفعيل/إخفاء منتج */
window.adminToggleProductActive = async id => {
  const p = (DB.products || []).find(x => x.id === id);
  if(!p) return;
  const { error } = await sb.from('products').update({ active: !p.active }).eq('id', id);
  if(error){ toast('فشل', 'err'); return; }
  toast(p.active ? 'تم الإخفاء' : 'أصبح معروضاً', 'ok');
};

/* ⭐ 13) حذف منتج */
window.adminDeleteProduct = id => {
  const p = (DB.products || []).find(x => x.id === id);
  if(!p) return;
  confirmBox('حذف المنتج', `حذف «${escapeHtml(p.title)}»؟`, async () => {
    const { error } = await sb.from('products').delete().eq('id', id);
    if(error){ toast('فشل', 'err'); return; }
    if(typeof logAdminAction === 'function'){
      await logAdminAction('delete_product', null, `حذف منتج: ${p.title}`);
    }
    toast('تم الحذف', 'ok');
  }, true);
};

/* ⭐ 14) ربط الأزرار */
document.addEventListener('click', (e) => {
  if(e.target.closest('#newProductBtn')){ e.preventDefault(); adminNewProduct(); }
  if(e.target.closest('#pfCancel')){ e.preventDefault(); backToProductsList(); }
});

/* ⭐ 15) اربط renderAdminProducts بعد renderAdmin الأصلي */
(function hookRenderAdmin(){
  const orig = window.renderAdmin;
  if(typeof orig === 'function' && !window._renderAdminHooked){
    window._renderAdminHooked = true;
    window.renderAdmin = function(){
      orig.apply(this, arguments);
      try{ renderAdminProducts(); }catch(e){}
    };
  } else {
    /* لو renderAdmin لم يُعرّف بعد، انتظر */
    const t = setInterval(() => {
      if(typeof window.renderAdmin === 'function' && !window._renderAdminHooked){
        clearInterval(t);
        const o = window.renderAdmin;
        window._renderAdminHooked = true;
        window.renderAdmin = function(){
          o.apply(this, arguments);
          try{ renderAdminProducts(); }catch(e){}
        };
      }
    }, 200);
    setTimeout(() => clearInterval(t), 6000);
  }
})();
