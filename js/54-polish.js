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
