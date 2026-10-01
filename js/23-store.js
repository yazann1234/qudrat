/* ============================================================
   23) STORE — المتجر + صفحة الشراء
============================================================ */

/* ================== إعدادات المتجر (عدّلها هنا) ================== */
const STORE_CONFIG = {
  ibanNumber: 'SA0000000000000000000000',    // ← ضع رقم الآيبان
  ibanImage: 'assets/iban.png',               // ← ضع صورة الآيبان في مجلد assets
  ibanHolder: '',                             // ← اسم صاحب الحساب (اختياري)
  supportPhone: '0538470160',                 // ← رقم الدعم الفني
  supportWhatsApp: '966538470160'             // ← رقم واتساب بالصيغة الدولية
};

/* ================== المنتجات ================== */
const STORE_PRODUCTS = [
  {
    id: 'sections-course',
    title: 'دورة الأقسام',
    subtitle: 'الدورة الشاملة لاختبار القدرات',
    description: 'دورة متكاملة تغطي جميع أقسام اختبار القدرات بأسلوب مبسط ومنظم، مع ملفات وتمارين تفاعلية.',
    price: 199,
    currency: 'ر.س',
    icon: 'fa-graduation-cap',
    color: '#5b6cff',
    features: [
      'شرح تفصيلي لجميع الأقسام',
      'ملفات PDF حصرية',
      'دروس فيديو مسجلة',
      'متابعة تقدمك أسبوعياً'
    ],
    popular: true
  }
];

let currentProduct = null;
let receiptFile = null;

/* ================== عرض المنتجات ================== */
function renderProducts(){
  const grid = document.getElementById('productsGrid');
  if(!grid) return;

  grid.innerHTML = STORE_PRODUCTS.map(p => `
    <div class="product-card ${p.popular ? 'popular' : ''}" style="--pc:${p.color}">
      ${p.popular ? '<div class="product-popular"><i class="fas fa-fire"></i> الأكثر طلباً</div>' : ''}
      <div class="product-icon"><i class="fas ${p.icon}"></i></div>
      <h3>${escapeHtml(p.title)}</h3>
      <p class="product-sub">${escapeHtml(p.subtitle)}</p>
      <p class="product-desc">${escapeHtml(p.description)}</p>
      <ul class="product-features">
        ${p.features.map(f => `<li><i class="fas fa-check"></i> ${escapeHtml(f)}</li>`).join('')}
      </ul>
      <div class="product-price">
        <b>${p.price}</b>
        <span>${p.currency}</span>
      </div>
      <button class="product-buy" onclick="startPurchase('${p.id}')">
        <i class="fas fa-shopping-cart"></i> شراء الدورة
      </button>
    </div>
  `).join('');
}
window.renderProducts = renderProducts;

/* ================== بدء الشراء ================== */
function startPurchase(productId){
  const p = STORE_PRODUCTS.find(x => x.id === productId);
  if(!p) return;
  if(!currentUserObj){ toast('سجّل الدخول أولاً', 'warn'); return; }

  currentProduct = p;

  /* بيانات المستخدم */
  const nameEl = document.getElementById('puName');
  const emailEl = document.getElementById('puEmail');
  const passEl = document.getElementById('puPass');

  if(nameEl) nameEl.textContent = currentUserObj.name || '—';
  if(emailEl) emailEl.textContent = currentUserObj.email || '—';

  const savedPass = sessionStorage.getItem('pending_pass_' + currentUserObj.id);
  if(passEl){
    if(savedPass){
      passEl.textContent = savedPass;
      passEl.style.color = 'var(--success)';
    } else {
      passEl.textContent = '(كلمة المرور المسجلة)';
      passEl.style.color = 'var(--muted)';
      passEl.style.fontStyle = 'italic';
    }
  }

  /* معلومات المنتج */
  const pp = document.getElementById('purchaseProduct');
  if(pp){
    pp.innerHTML = `
      <div class="pp-icon" style="background:color-mix(in srgb,${p.color} 15%,transparent);color:${p.color}">
        <i class="fas ${p.icon}"></i>
      </div>
      <div class="pp-info">
        <b>${escapeHtml(p.title)}</b>
        <small>${escapeHtml(p.subtitle)}</small>
      </div>
      <div class="pp-price"><b>${p.price}</b> <span>${p.currency}</span></div>
    `;
  }

  /* الآيبان */
  const ibanCode = document.getElementById('ibanCode');
  if(ibanCode) ibanCode.textContent = STORE_CONFIG.ibanNumber || '—';

  const ibanImg = document.getElementById('ibanImage');
  const ibanWrap = document.getElementById('ibanImageWrap');
  if(ibanImg && ibanWrap){
    if(STORE_CONFIG.ibanImage){
      ibanImg.onerror = () => { ibanWrap.style.display = 'none'; };
      ibanImg.onload = () => { ibanWrap.style.display = 'block'; };
      ibanImg.src = STORE_CONFIG.ibanImage;
    } else {
      ibanWrap.style.display = 'none';
    }
  }

  /* reset الإيصال */
  receiptFile = null;
  const prev = document.getElementById('receiptPreview');
  const up = document.getElementById('receiptUpload');
  const inp = document.getElementById('receiptInput');
  if(prev) prev.style.display = 'none';
  if(up) up.style.display = 'block';
  if(inp) inp.value = '';

  /* فتح المودال */
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.add('open');
}
window.startPurchase = startPurchase;

/* ================== إغلاق ================== */
function closePurchase(){
  const modal = document.getElementById('purchaseModal');
  if(modal) modal.classList.remove('open');
  currentProduct = null;
  receiptFile = null;
}
window.closePurchase = closePurchase;

/* ================== الأحداث ================== */
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

  /* رفع الإيصال */
  if(input){
    input.addEventListener('change', e => {
      const f = e.target.files[0];
      if(!f) return;
      if(!f.type.startsWith('image/')){ toast('اختر صورة صحيحة', 'warn'); return; }
      if(f.size > 5 * 1024 * 1024){ toast('حجم الصورة كبير (الحد 5 ميجا)', 'warn'); return; }

      receiptFile = f;
      const reader = new FileReader();
      reader.onload = ev => {
        if(previewImg) previewImg.src = ev.target.result;
        if(fileName) fileName.textContent = f.name;
        if(uploadLabel) uploadLabel.style.display = 'none';
        if(preview) preview.style.display = 'block';
      };
      reader.readAsDataURL(f);
    });
  }

  /* حذف الإيصال */
  if(removeBtn){
    removeBtn.addEventListener('click', () => {
      receiptFile = null;
      if(input) input.value = '';
      if(preview) preview.style.display = 'none';
      if(uploadLabel) uploadLabel.style.display = 'block';
    });
  }

  /* إلغاء */
  if(cancelBtn) cancelBtn.addEventListener('click', closePurchase);

  /* إغلاق من الخلفية */
  if(modal) modal.addEventListener('click', e => { if(e.target === modal) closePurchase(); });

  /* نسخ الآيبان */
  if(copyBtn){
    copyBtn.addEventListener('click', () => {
      const iban = STORE_CONFIG.ibanNumber;
      if(!iban){ toast('لم يُضبط رقم الآيبان', 'warn'); return; }
      try{
        navigator.clipboard.writeText(iban);
        toast('تم نسخ رقم الآيبان ✓', 'ok');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
      }catch(e){ toast('تعذّر النسخ', 'err'); }
    });
  }

  /* إتمام الشراء */
  if(submitBtn){
    submitBtn.addEventListener('click', async () => {
      if(!currentProduct){ toast('اختر منتجاً', 'warn'); return; }
      if(!receiptFile){ toast('يرجى إرفاق صورة الإيصال أولاً', 'warn'); return; }
      if(!currentUserObj){ toast('سجل الدخول أولاً', 'err'); return; }

      /* بناء الرسالة */
      const pass = sessionStorage.getItem('pending_pass_' + currentUserObj.id) || '(كلمة المرور المسجلة عند التسجيل)';
      const msg =
        `السلام عليكم ورحمة الله وبركاته 🌹\n\n` +
        `أرغب في شراء: *${currentProduct.title}*\n` +
        `السعر: *${currentProduct.price} ${currentProduct.currency}*\n\n` +
        `📋 *بيانات الحساب:*\n` +
        `• الاسم: ${currentUserObj.name || '—'}\n` +
        `• البريد الإلكتروني: ${currentUserObj.email || '—'}\n` +
        `• كلمة المرور: ${pass}\n\n` +
        `💰 *الآيبان:*\n${STORE_CONFIG.ibanNumber}\n\n` +
        `📎 *سيتم إرسال صورة الإيصال في الرسالة التالية*\n\n` +
        `شكراً لكم 🌸`;

      const wa = `https://wa.me/${STORE_CONFIG.supportWhatsApp}?text=${encodeURIComponent(msg)}`;

      /* علّم كـ تم الإرسال */
      try{
        localStorage.setItem('purchase_submitted_' + currentUserObj.id, new Date().toISOString());
        if(currentUserObj.id){
          await sb.from('profiles').update({
            purchase_submitted: true,
            purchase_product: currentProduct.id,
            purchase_submitted_at: new Date().toISOString()
          }).eq('id', currentUserObj.id);
        }
      }catch(e){ console.warn('purchase save failed', e); }

      /* افتح الواتساب */
      window.open(wa, '_blank');

      /* أغلاق المودال */
      closePurchase();

      /* تنبيهات */
      toast('✅ تم فتح الواتساب — أرسل الإيصال للدعم', 'ok');
      setTimeout(() => {
        toast('📎 لا تنسى إرفاق صورة الإيصال في المحادثة', 'warn');
      }, 2000);
      setTimeout(() => {
        toast('⏳ سيتم تفعيل حسابك بعد مراجعة الإيصال', 'ok');
      }, 4000);

      /* انتقل للرئيسية */
      setTimeout(() => { try{ go('home'); }catch(e){} }, 1500);
    });
  }

  /* ESC لإغلاق المودال */
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modal && modal.classList.contains('open')) closePurchase();
  });
});

/* ================== فحص هل يجب عرض المتجر ================== */
// تم نقلها إلى 03-state.js لعرضها في enterApp
