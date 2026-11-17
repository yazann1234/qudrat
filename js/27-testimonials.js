/* ============================================================
   27) TESTIMONIALS — تجارب الطلاب (تظهر فقط في انتظار التفعيل)
============================================================ */

const TESTIMONIALS_TELEGRAM = 'https://t.me/xu4cii';

function renderTestimonials(){
  const container = document.getElementById('testimonialsSection');
  if(!container) return;

  /* ⭐ لا تعرض إلا في وضع "انتظار التفعيل" */
  const appEl = document.getElementById('app');
  if(!appEl || !appEl.classList.contains('store-only')){
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const testimonials = [
    { name: 'عبدالله م.', score: '96', text: 'الحمد لله، بفضل الله ثم منصة العباقرة قدرت أجيب درجة عالية. أفضل شي فيها الجدول الذكي والمتابعة.', avatar: 'ع' },
    { name: 'سارة ع.', score: '94', text: 'كنت أعاني من ضعف في الكمي، والذكاء الاصطناعي ساعدني أذاكر بشكل منظم. تجربة ممتازة!', avatar: 'س' },
    { name: 'محمد ا.', score: '92', text: 'أفضل منصة عربية للقدرات. الملفات مرتبة والفيديوهات تشرح بطريقة سهلة.', avatar: 'م' }
  ];

  container.innerHTML = `
    <div class="testimonials-header">
      <h3><i class="fas fa-quote-right"></i> تجارب طلابنا</h3>
      <p>قصص نجاح حقيقية من طلاب مثلك</p>
    </div>
    <div class="testimonials-list">
      ${testimonials.map(t => `
        <div class="testimonial-card">
          <div class="testimonial-top">
            <div class="testimonial-avatar">${t.avatar}</div>
            <div>
              <b>${t.name}</b>
              <span class="testimonial-score">درجة ${t.score}</span>
            </div>
          </div>
          <p class="testimonial-text">"${t.text}"</p>
        </div>
      `).join('')}
    </div>
    <a href="${TESTIMONIALS_TELEGRAM}" target="_blank" class="telegram-btn">
      <i class="fab fa-telegram"></i> انضم لقناة تجارب الطلاب على تيليجرام
    </a>
  `;
}
window.renderTestimonials = renderTestimonials;

/* ⭐ عرضها تلقائياً عند الدخول في وضع المتجر */
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver(() => {
    const appEl = document.getElementById('app');
    if(appEl && appEl.classList.contains('store-only')){
      if(typeof renderTestimonials === 'function') renderTestimonials();
    }
  });

  const appEl = document.getElementById('app');
  if(appEl){
    observer.observe(appEl, { attributes: true, attributeFilter: ['class'] });
  }
});
