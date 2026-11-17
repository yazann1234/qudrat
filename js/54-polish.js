/* ============================================================
   54) POLISH — لمسات عامة للمنصة
   - 📶 تنبيه انقطاع/رجوع الاتصال (عشان الطالب يعرف ليش ما يتحمّل شي)
   - ⌨️ إطار واضح للعنصر المحدد عند استخدام لوحة المفاتيح (إمكانية الوصول)
============================================================ */

(function netStatus(){
  let bar = null, hideT = null;
  const show = (online) => {
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'netBar';
      bar.className = 'net-bar';
      bar.setAttribute('role', 'status');
      document.body.appendChild(bar);
    }
    clearTimeout(hideT);
    bar.className = 'net-bar show ' + (online ? 'on' : 'off');
    bar.innerHTML = online
      ? '<i class="fas fa-wifi"></i> رجع الاتصال — كل شي يشتغل طبيعي ✓'
      : '<i class="fas fa-plug-circle-xmark"></i> انقطع الاتصال بالإنترنت — نكمّل لما يرجع';
    if(online) hideT = setTimeout(() => { bar.classList.remove('show'); }, 3500);
  };
  window.addEventListener('offline', () => show(false));
  window.addEventListener('online', () => show(true));
  document.addEventListener('DOMContentLoaded', () => { if(navigator.onLine === false) show(false); });
})();

/* ⌨️ نميّز استخدام الكيبورد عن الماوس → الإطار يطلع للكيبورد فقط */
document.addEventListener('keydown', e => { if(e.key === 'Tab') document.body.classList.add('kb-nav'); });
document.addEventListener('pointerdown', () => document.body.classList.remove('kb-nav'));

/* ============================================================
   🎉 شريط «ميزة جديدة» أعلى الصفحة — الدفع بالتقسيط مع تمارا
   - يظهر لكل المستخدمين لمدة 21 يوم من الإطلاق
   - يختفي للأبد لو الطالب قفله (يتذكره الجهاز)
============================================================ */
(function featureBar(){
  const KEY = 'abq_feat_tamara_closed';
  const LAUNCH = Date.parse('2026-11-17T00:00:00+03:00');
  const show = () => {
    try{ if(localStorage.getItem(KEY)) return; }catch(e){}
    if(Date.now() - LAUNCH > 21 * 86400000) return;
    const main = document.getElementById('mainScroll');
    if(!main || document.getElementById('featBar')) return;
    const bar = document.createElement('div');
    bar.id = 'featBar';
    bar.className = 'feat-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `
      <span class="fb-new">جديد 🎉</span>
      <span class="fb-txt">أضفنا الدفع بالتقسيط مع <b class="tamara-logo sm">tamara</b> — قسّم اشتراكك على دفعات بدون فوائد، استمتع فيها!</span>
      <button class="fb-go" id="featBarGo">جرّبها الحين <i class="fas fa-arrow-left"></i></button>
      <button class="fb-x" id="featBarX" aria-label="إغلاق"><i class="fas fa-xmark"></i></button>`;
    main.insertBefore(bar, main.firstChild);
    const close = () => { bar.classList.add('out'); setTimeout(() => bar.remove(), 300); try{ localStorage.setItem(KEY, '1'); }catch(e){} };
    document.getElementById('featBarX').onclick = close;
    document.getElementById('featBarGo').onclick = () => {
      try{ if(typeof PAY !== 'undefined') PAY.method = 'tamara'; }catch(e){}
      try{ go('store'); }catch(e){}
      close();
    };
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(show, 1200));
  else setTimeout(show, 1200);
})();
