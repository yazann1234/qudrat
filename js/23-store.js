/* ============================================================
   23) STORE — المتجر + الشراء
   - يحفظ الدورة + المدة + السعر اللي اختارها الطالب
     (الأدمن يفعّل بضغطة واحدة بدون ما يختار شيء)
   - رمز الريال السعودي بدل «ر.س»
   - إزالة معالج الشراء القديم المكرر
============================================================ */

const STORE_DEFAULTS = {
  ibanNumber: 'SA0000000000000000000000',
  ibanImage: '',
  ibanHolder: '',
  supportPhone: '0552022058',
  supportWhatsApp: '966552022058'
};

let receiptFile = null;
let currentPurchaseData = null;

function getActiveProducts(){
  return (DB.products || []).filter(p => p.active !== false);
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

/* المتجر يعرض الدورات (courses) — المنتجات تُزامَن معها تلقائياً */
function renderProducts(){
  if(typeof renderCoursesGrid === 'function') renderCoursesGrid();
}
window.renderProducts = renderProducts;

/* توافق قديم: شراء منتج → حوّله للدورة المرتبطة */
window.startPurchase = function(productId){
  const p = (DB.products || []).find(x => x.id === productId);
  const code = p ? (p.course_code || ('auto_' + p.id)) : null;
  const c = code ? (CS.courses || []).find(x => x.code === code) : null;
  if(c) startCourseSubscription(c.id);
  else toast('هذه الدورة غير متاحة حالياً', 'warn');
};

/* ============================================================
   نافذة الشراء
============================================================ */
function openPurchaseModalInline(course, months, price){
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }
  currentPurchaseData = { course, months: parseInt(months, 10) || 1, price: Number(price) || 0 };
  renderPurchaseModal();
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.add('open');
}
window.openPurchaseModalInline = openPurchaseModalInline;

function renderPurchaseModal(){
  const d = currentPurchaseData;
  if(!d) return;

  const durationTxt = d.course.subscription_end_date
    ? 'اشتراك حتى ' + (typeof formatEndDate === 'function' ? formatEndDate(d.course.subscription_end_date) : d.course.subscription_end_date)
    : 'اشتراك ' + (typeof monthsLabel === 'function' ? monthsLabel(d.months) : d.months + ' شهر');

  const pp = document.getElementById('purchaseProduct');
  if(pp){
    pp.innerHTML = `
      <div class="pp-icon" style="background:color-mix(in srgb,${d.course.color || '#5b6cff'} 15%,transparent);color:${d.course.color || '#5b6cff'}">
        <i class="fas ${d.course.icon || 'fa-graduation-cap'}"></i>
      </div>
      <div class="pp-info">
        <b>${escapeHtml(d.course.name)}</b>
        <small>${escapeHtml(durationTxt)}</small>
      </div>
      <div class="pp-price"><b>${d.price}</b> <span>${sarIcon()}</span></div>
    `;
  }

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

  receiptFile = null;
  const prev = document.getElementById('receiptPreview'); if(prev) prev.style.display = 'none';
  const up = document.getElementById('receiptUpload'); if(up) up.style.display = 'block';
  const inp = document.getElementById('receiptInput'); if(inp) inp.value = '';
  const btn = document.getElementById('purchaseSubmit');
  if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> إتمام الدفع وإرسال للدعم'; }
}

function closePurchase(){
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.remove('open');
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

function openWhatsApp(url){
  let opened = false;
  try{
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link); link.click();
    setTimeout(() => { try{ document.body.removeChild(link); }catch(e){} }, 100);
    opened = true;
  }catch(e){}
  if(!opened){ try{ window.open(url, '_blank'); opened = true; }catch(e){} }
  if(!opened){ try{ window.location.href = url; }catch(e){} }
}

/* ⭐ إرسال طلب الشراء */
async function submitPurchase(){
  const btn = document.getElementById('purchaseSubmit');
  if(!currentPurchaseData){ toast('اختر الدورة والمدة أولاً', 'warn'); return; }
  if(!receiptFile){ toast('أرفق الإيصال أولاً', 'warn'); return; }
  if(!currentUserObj){ toast('سجل الدخول', 'err'); return; }
  if(btn && btn.disabled) return;

  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري رفع الإيصال...'; }

  let uploaded = null;
  try{ uploaded = await uploadReceipt(receiptFile); }
  catch(e){
    toast(e.message || 'فشل رفع الإيصال', 'err');
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> إتمام الدفع وإرسال للدعم'; }
    return;
  }

  const cfg = getStoreConfig();
  const pass = getActualPassword() || '(غير متاحة)';
  const d = currentPurchaseData;
  const durTxt = d.course.subscription_end_date
    ? 'حتى ' + (typeof formatEndDate === 'function' ? formatEndDate(d.course.subscription_end_date) : d.course.subscription_end_date)
    : (typeof monthsLabel === 'function' ? monthsLabel(d.months) : d.months + ' شهر');

  /* رسالة واتساب نصية — لا تدعم الصور، لذلك نكتب «ريال» */
  const msg =
    `السلام عليكم 🌹\n` +
    `طلب اشتراك: *${d.course.name}* — *${durTxt}* (${d.price} ريال)\n\n` +
    `👤 ${currentUserObj.name || '—'}\n` +
    `📧 ${currentUserObj.email || '—'}\n` +
    `🔑 ${pass}\n\n` +
    `🧾 الإيصال: ${uploaded.url}`;

  /* ⭐ احفظ تفاصيل الطلب كاملة (الدورة + المدة + السعر) */
  const nowIso = new Date().toISOString();
  const upd = {
    purchase_submitted: true,
    purchase_product: (d.course.code || d.course.id) + '_' + d.months + 'm',
    purchase_course_id: d.course.id,
    purchase_months: d.months,
    purchase_price: d.price,
    purchase_submitted_at: nowIso,
    purchase_receipt_url: uploaded.url,
    purchase_receipt_path: uploaded.path
  };
  try{
    localStorage.setItem('purchase_submitted_' + currentUserObj.id, nowIso);
    const r = await sbSafeWrite(p => sb.from('profiles').update(p).eq('id', currentUserObj.id), upd);
    if(r && r.error) console.warn('purchase save failed:', r.error.message);
    Object.assign(currentUserObj, upd);
  }catch(e){ console.warn('purchase save failed', e); }

  openWhatsApp('https://wa.me/' + cfg.supportWhatsApp + '?text=' + encodeURIComponent(msg));

  if(btn) btn.innerHTML = '<i class="fas fa-check"></i> تم الإرسال';
  toast('✅ تم فتح واتساب — أرسل الرسالة', 'ok');

  setTimeout(() => {
    closePurchase();
    const appEl = document.getElementById('app');
    if(appEl) appEl.classList.remove('store-only');
    try{ if(typeof renderSubBanners === 'function') renderSubBanners(); }catch(e){}
    try{ if(typeof renderCoursesGrid === 'function') renderCoursesGrid(); }catch(e){}
    try{ if(typeof go === 'function') go('home'); }catch(e){}
    setTimeout(() => { try{ toast('✅ تم استلام طلبك — حسابك قيد المراجعة', 'ok'); }catch(e){} }, 400);
  }, 1500);
}
window.submitPurchase = submitPurchase;

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
  const cancelBtn = document.getElementById('purchaseCancel');
  const copyBtn = document.getElementById('ibanCopyBtn');
  const modal = document.getElementById('purchaseModal');

  /* ⭐ ربط زر الإرسال مرة واحدة فقط (كان مربوطاً بمعالجين) */
  const submitBtn = document.getElementById('purchaseSubmit');
  if(submitBtn && !submitBtn.dataset.bound){
    const clean = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(clean, submitBtn);
    clean.dataset.bound = '1';
    clean.addEventListener('click', submitPurchase);
  }

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

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modal && modal.classList.contains('open')) closePurchase();
  });
});
