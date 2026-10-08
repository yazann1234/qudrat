/* ============================================================
   23) STORE — المتجر + الشراء (إصلاح الواتساب + IBAN اختياري)
============================================================ */

const STORE_DEFAULTS = {
  ibanNumber: 'SA0000000000000000000000',
  ibanImage: '',
  ibanHolder: '',
  supportPhone: '0538470160',
  supportWhatsApp: '966538470160'
};

const DEFAULT_PRODUCTS = [
  {
    id: 'sections-course',
    title: 'دورة الأقسام',
    subtitle: 'الدورة الشاملة لاختبار القدرات',
    description: 'دورة متكاملة تغطي جميع أقسام اختبار القدرات بأسلوب مبسط ومنظم، مع ملفات وتمارين تفاعلية.',
    price: 199, currency: 'ر.س',
    icon: 'fa-graduation-cap', color: '#5b6cff',
    features: ['شرح تفصيلي لجميع الأقسام','ملفات PDF حصرية','دروس فيديو مسجلة','متابعة تقدمك أسبوعياً'],
    popular: true, active: true
  }
];

let currentProduct = null;
let receiptFile = null;

function getActiveProducts(){
  const dbList = (DB.products || []).filter(p => p.active !== false);
  if(dbList.length) return dbList;
  return DEFAULT_PRODUCTS;
}

function getStoreConfig(){
  const s = DB.storeSettings || {};
  return {
    ibanNumber: s.iban_number || STORE_DEFAULTS.ibanNumber,
    ibanImage: s.iban_image || STORE_DEFAULTS.ibanImage,
    ibanHolder: s.iban_holder || STORE_DEFAULTS.ibanHolder,
    supportPhone: s.support_phone || STORE_DEFAULTS.supportPhone,
    supportWhatsApp: s.support_whatsapp || STORE_DEFAULTS.supportWhatsApp
  };
}

function getActualPassword(){
  if(currentUserObj && currentUserObj.password_hint) return currentUserObj.password_hint;
  if(currentUserObj){
    try{ const p = sessionStorage.getItem('pending_pass_' + currentUserObj.id); if(p) return p; }catch(e){}
    try{ const p = localStorage.getItem('pending_pass_' + currentUserObj.id); if(p) return p; }catch(e){}
  }
  return '';
}

/* ⭐ IBAN اختياري — لا يُظهر 404 */
function applyStoreSettings(){
  const cfg = getStoreConfig();
  const ibanCode = document.getElementById('ibanCode');
  if(ibanCode) ibanCode.textContent = cfg.ibanNumber || '—';

  const ibanImg = document.getElementById('ibanImage');
  const ibanWrap = document.getElementById('ibanImageWrap');
  if(ibanImg && ibanWrap){
    if(cfg.ibanImage && cfg.ibanImage.trim() && !cfg.ibanImage.includes('assets/iban.png')){
      ibanImg.onerror = () => { ibanWrap.style.display = 'none'; };
      ibanImg.onload = () => { ibanWrap.style.display = 'block'; };
      ibanImg.src = cfg.ibanImage;
    } else {
      ibanWrap.style.display = 'none';
      ibanImg.removeAttribute('src');
    }
  }
}
window.applyStoreSettings = applyStoreSettings;

function renderProducts(){
  const grid = document.getElementById('productsGrid');
  if(!grid) return;
  const list = getActiveProducts();
  if(!list.length){
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="admin-empty"><div class="em-ic"><i class="fas fa-shopping-bag"></i></div><h3>لا توجد دورات متاحة</h3></div></div>`;
    return;
  }
  grid.innerHTML = list.map(p => `
    <div class="product-card ${p.popular ? 'popular' : ''}" style="--pc:${p.color || '#5b6cff'}">
      ${p.popular ? '<div class="product-popular"><i class="fas fa-fire"></i> الأكثر طلباً</div>' : ''}
      <div class="product-icon"><i class="fas ${p.icon || 'fa-graduation-cap'}"></i></div>
      <h3>${escapeHtml(p.title)}</h3>
      ${p.subtitle ? `<p class="product-sub">${escapeHtml(p.subtitle)}</p>` : ''}
      ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ''}
      ${(p.features && p.features.length) ? `<ul class="product-features">${p.features.map(f => `<li><i class="fas fa-check"></i> ${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
      <div class="product-price"><b>${p.price}</b><span>${escapeHtml(p.currency || 'ر.س')}</span></div>
      <button class="product-buy" onclick="startPurchase('${p.id}')"><i class="fas fa-shopping-cart"></i> شراء الدورة</button>
    </div>
  `).join('');
}
window.renderProducts = renderProducts;

/* ============================================================
   الشراء للدورات
============================================================ */
let currentPurchaseData = null;

function openPurchaseModalInline(course, months, price){
  currentPurchaseData = { course, months, price };
  renderPurchaseModal();
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.add('open');
}
window.openPurchaseModalInline = openPurchaseModalInline;

function renderPurchaseModal(){
  const d = currentPurchaseData;
  if(!d) return;

  /* معلومات المنتج */
  const pp = document.getElementById('purchaseProduct');
  if(pp){
    pp.innerHTML = `
      <div class="pp-icon" style="background:color-mix(in srgb,${d.course.color || '#5b6cff'} 15%,transparent);color:${d.course.color || '#5b6cff'}">
        <i class="fas ${d.course.icon || 'fa-graduation-cap'}"></i>
      </div>
      <div class="pp-info">
        <b>${escapeHtml(d.course.name)}</b>
        <small>اشتراك ${d.months} شهر</small>
      </div>
      <div class="pp-price"><b>${d.price}</b> <span>ر.س</span></div>
    `;
  }

  /* بيانات المستخدم */
  const nameEl = document.getElementById('puName'); if(nameEl) nameEl.textContent = currentUserObj.name || '—';
  const emailEl = document.getElementById('puEmail'); if(emailEl) emailEl.textContent = currentUserObj.email || '—';

  const actualPass = getActualPassword();
  const passEl = document.getElementById('puPass');
  if(passEl){
    if(actualPass){
      passEl.textContent = actualPass;
      passEl.style.color = 'var(--success)';
      passEl.style.fontStyle = 'normal';
    } else {
      passEl.textContent = 'غير متاحة';
      passEl.style.color = 'var(--danger)';
      passEl.style.fontStyle = 'italic';
    }
  }

  applyStoreSettings();

  /* reset receipt */
  receiptFile = null;
  const prev = document.getElementById('receiptPreview'); if(prev) prev.style.display = 'none';
  const up = document.getElementById('receiptUpload'); if(up) up.style.display = 'block';
  const inp = document.getElementById('receiptInput'); if(inp) inp.value = '';
}

/* ⭐ استبدل معالج الشراء القديم */
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('purchaseSubmit');
  if(submitBtn && !submitBtn.dataset.newBound){
    /* أزل الربط القديم */
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);
    newBtn.dataset.newBound = '1';

    newBtn.addEventListener('click', async () => {
      if(!currentPurchaseData){ toast('لا توجد بيانات شراء', 'warn'); return; }
      if(!receiptFile){ toast('أرفق الإيصال أولاً', 'warn'); return; }
      if(!currentUserObj){ toast('سجل الدخول', 'err'); return; }
      if(newBtn.disabled) return;

      newBtn.disabled = true;
      const orig = newBtn.innerHTML;
      newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

      let uploaded = null;
      try{ uploaded = await uploadReceipt(receiptFile); }
      catch(e){
        toast('فشل رفع الإيصال: ' + e.message, 'err');
        newBtn.disabled = false; newBtn.innerHTML = orig;
        return;
      }

      const cfg = getStoreConfig();
      const pass = getActualPassword() || '(غير متاحة)';
      const d = currentPurchaseData;

      const msg =
        `السلام عليكم 🌹\n` +
        `طلب اشتراك: *${d.course.name}* — *${d.months} شهر* (${d.price} ر.س)\n\n` +
        `👤 ${currentUserObj.name || '—'}\n` +
        `📧 ${currentUserObj.email || '—'}\n` +
        `🔑 ${pass}\n\n` +
        `📎 الإيصال مرفق في الرسالة التالية`;

      try{
        localStorage.setItem('purchase_submitted_' + currentUserObj.id, new Date().toISOString());
        await sb.from('profiles').update({
          purchase_submitted: true,
          purchase_product: d.course.code + '_' + d.months + 'm',
          purchase_submitted_at: new Date().toISOString(),
          purchase_receipt_url: uploaded.url,
          purchase_receipt_path: uploaded.path
        }).eq('id', currentUserObj.id);

        currentUserObj.purchase_submitted = true;
        currentUserObj.purchase_receipt_url = uploaded.url;
      }catch(e){}

      const wa = 'https://wa.me/' + cfg.supportWhatsApp + '?text=' + encodeURIComponent(msg);

      let opened = false;
      try{
        const link = document.createElement('a');
        link.href = wa; link.target = '_blank'; link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link); link.click();
        setTimeout(() => { try{ document.body.removeChild(link); }catch(e){} }, 100);
        opened = true;
      }catch(e){}

      if(!opened) try{ window.open(wa, '_blank'); opened = true; }catch(e){}

      newBtn.innerHTML = '<i class="fas fa-check"></i> تم الإرسال';

      setTimeout(() => {
        closePurchase();

        const appEl = document.getElementById('app');
        if(appEl) appEl.classList.remove('store-only');

        (async () => {
          try{ if(typeof loadProfilesAndFiles === 'function') await loadProfilesAndFiles(); }catch(e){}
          try{ if(typeof loadVideos === 'function') await loadVideos(); }catch(e){}
          try{ if(typeof renderSubBanners === 'function') renderSubBanners(); }catch(e){}
          try{ if(typeof renderFiles === 'function') renderFiles(); }catch(e){}
          try{ if(typeof renderRecent === 'function') renderRecent(); }catch(e){}
          try{ if(typeof go === 'function') go('home'); }catch(e){}
          setTimeout(() => { try{ toast('✅ تم استلام طلبك — قيد المراجعة', 'ok'); }catch(e){} }, 400);
        })();
      }, 1500);
    });
  }
});

function closePurchase(){
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.remove('open');
  currentProduct = null;
  receiptFile = null;
}
window.closePurchase = closePurchase;

async function uploadReceipt(file){
  if(!currentUserObj) throw new Error('غير مسجل');
  if(!file) throw new Error('لا يوجد ملف');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const safeExt = ['jpg','jpeg','png','webp','pdf'].includes(ext) ? ext : 'jpg';
  const path = currentUserObj.id + '/receipt_' + Date.now() + '.' + safeExt;

  const { error: upErr } = await sb.storage
    .from('receipts')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg' });

  if(upErr) throw new Error('فشل رفع الإيصال: ' + upErr.message);

  const { data: signed, error: sErr } = await sb.storage
    .from('receipts')
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  if(sErr || !signed || !signed.signedUrl) throw new Error('فشل إنشاء رابط الإيصال');

  return { url: signed.signedUrl, path: path };
}

/* ============================================================
   الأحداث
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('receiptInput');
  const uploadLabel = document.getElementById('receiptUpload');
  const preview = document.getElementById('receiptPreview');
  const previewImg = document.getElementById('receiptPreviewImg');
  const fileName = document.getElementById('receiptFileName');
  const removeBtn = document.getElementById('receiptRemove');
  const submitBtn = document.getElementById('purchaseSubmit');
  const cancelBtn = document.getElementById('purchaseCancel');
  const copyBtn = document.getElementById('ibanCopyBtn');
  const modal = document.getElementById('purchaseModal');

  if(input){
    input.addEventListener('change', e => {
      const f = e.target.files[0]; if(!f) return;
      const okTypes = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
      if(!okTypes.includes(f.type) && !f.name.toLowerCase().endsWith('.pdf')){ toast('اختر صورة أو PDF', 'warn'); return; }
      if(f.size > 5 * 1024 * 1024){ toast('حجم الملف كبير (5 ميجا)', 'warn'); return; }
      receiptFile = f;
      const reader = new FileReader();
      reader.onload = ev => {
        if(previewImg){
          if(f.type === 'application/pdf'){
            previewImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2VmNDQ0NCI+UERGPC90ZXh0Pjwvc3ZnPg==';
          } else { previewImg.src = ev.target.result; }
        }
        if(fileName) fileName.textContent = f.name;
        if(uploadLabel) uploadLabel.style.display = 'none';
        if(preview) preview.style.display = 'block';
      };
      reader.readAsDataURL(f);
    });
  }

  if(removeBtn){
    removeBtn.addEventListener('click', () => {
      receiptFile = null;
      if(input) input.value = '';
      if(preview) preview.style.display = 'none';
      if(uploadLabel) uploadLabel.style.display = 'block';
    });
  }

  if(cancelBtn) cancelBtn.addEventListener('click', closePurchase);
  if(modal) modal.addEventListener('click', e => { if(e.target === modal) closePurchase(); });

  if(copyBtn){
    copyBtn.addEventListener('click', () => {
      const cfg = getStoreConfig();
      try{
        navigator.clipboard.writeText(cfg.ibanNumber);
        toast('✓ تم نسخ الآيبان', 'ok');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
      }catch(e){ toast('تعذّر النسخ', 'err'); }
    });
  }

  /* ⭐ إتمام الشراء */
  if(submitBtn){
    submitBtn.addEventListener('click', async () => {
      if(!currentProduct){ toast('اختر منتجاً', 'warn'); return; }
      if(!receiptFile){ toast('أرفق صورة الإيصال أولاً', 'warn'); return; }
      if(!currentUserObj){ toast('سجل الدخول أولاً', 'err'); return; }
      if(submitBtn.disabled) return;

      submitBtn.disabled = true;
      const orig = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الإيصال...';

      let uploaded = null;
      try{
        uploaded = await uploadReceipt(receiptFile);
      }catch(e){
        console.error('upload failed', e);
        toast('فشل رفع الإيصال: ' + e.message, 'err');
        submitBtn.disabled = false;
        submitBtn.innerHTML = orig;
        return;
      }

      const cfg = getStoreConfig();
      const pass = getActualPassword() || '(غير متاحة)';
      const receiptUrl = uploaded.url;

      const msg =
        `السلام عليكم ورحمة الله وبركاته \n\n` +
        `أرغب في شراء: *${currentProduct.title}*\n` +
        `السعر: *${currentProduct.price} ${currentProduct.currency || 'ر.س'}*\n\n` +
        ` *بيانات الحساب:*\n` +
        `• الاسم: ${currentUserObj.name || '—'}\n` +
        `• البريد: ${currentUserObj.email || '—'}\n` +
        `• كلمة المرور: ${pass}\n\n` +
        ` *الآيبان:*\n${cfg.ibanNumber}\n\n` +
        `🧾 *رابط الإيصال:*\n${receiptUrl}\n\n` +
        `شكراً لكم `;

      /* احفظ الحالة */
      try{
        localStorage.setItem('purchase_submitted_' + currentUserObj.id, new Date().toISOString());
        await sb.from('profiles').update({
          purchase_submitted: true,
          purchase_product: currentProduct.id,
          purchase_submitted_at: new Date().toISOString(),
          purchase_receipt_url: receiptUrl,
          purchase_receipt_path: uploaded.path
        }).eq('id', currentUserObj.id);
        currentUserObj.purchase_submitted = true;
        currentUserObj.purchase_receipt_url = receiptUrl;
      }catch(e){ console.warn('save failed', e); }

      const wa = 'https://wa.me/' + cfg.supportWhatsApp + '?text=' + encodeURIComponent(msg);

      /* ⭐ افتح الواتساب بطريقة مضمونة */
      let opened = false;
      try{
        const link = document.createElement('a');
        link.href = wa;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { try{ document.body.removeChild(link); }catch(e){} }, 100);
        opened = true;
      }catch(e){ console.warn('open link failed', e); }

      /* Fallback */
      if(!opened){
        try{ window.open(wa, '_blank'); opened = true; }catch(e){}
      }
      if(!opened){
        try{ window.location.href = wa; }catch(e){}
      }

      submitBtn.innerHTML = '<i class="fas fa-check"></i> تم الإرسال ✓';
      toast('✅ تم فتح واتساب — أرسل الرسالة', 'ok');

      setTimeout(() => { toast('📎 لا تنسى إرفاق صورة الإيصال أيضاً', 'warn'); }, 2000);

            /* ⭐ بعد الإرسال: أخرج من وضع المتجر واظهر "قيد المراجعة" */
      setTimeout(() => {
        closePurchase();

        /* اقفل وضع المتجر فقط */
        const appEl = document.getElementById('app');
        if(appEl) appEl.classList.remove('store-only');

        /* أعد عرض البانرات */
        try{ if(typeof renderSubBanners === 'function') renderSubBanners(); }catch(e){}

        /* اذهب للرئيسية (فيها بانر "قيد المراجعة") */
        try{ if(typeof go === 'function') go('home'); }catch(e){}

        /* أظهر رسالة واضحة */
        setTimeout(() => {
          try{ toast('✅ تم استلام طلبك — حسابك قيد المراجعة', 'ok'); }catch(e){}
        }, 400);
      }, 1800);
    });
  }

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modal && modal.classList.contains('open')) closePurchase();
  });
});
