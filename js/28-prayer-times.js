/* ============================================================
   28) PRAYER TIMES — تذكير وقت الصلاة في المؤقت
============================================================ */

const PRAYER = {
  times: null,
  city: 'Riyadh',
  country: 'SA',
  checkInterval: null,
  pausedTimer: false
};

/* ================== جلب مواقيت الصلاة ================== */
async function fetchPrayerTimes(){
  try{
    const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${PRAYER.city}&country=${PRAYER.country}&method=4`);
    const data = await res.json();

    if(data.code === 200 && data.data){
      PRAYER.times = data.data.timings;
      console.log('🕌 Prayer times loaded:', PRAYER.times);
      return true;
    }
  }catch(e){
    console.warn('Prayer times fetch failed:', e);
  }
  return false;
}

/* ================== التحقق من وقت الصلاة ================== */
function checkPrayerTime(){
  if(!PRAYER.times) return false;
  if(typeof TIMER === 'undefined' || !TIMER.running) return false;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const prayers = [
    { name: 'الفجر', time: PRAYER.times.Fajr },
    { name: 'الظهر', time: PRAYER.times.Dhuhr },
    { name: 'العصر', time: PRAYER.times.Asr },
    { name: 'المغرب', time: PRAYER.times.Maghrib },
    { name: 'العشاء', time: PRAYER.times.Isha }
  ];

  for(const p of prayers){
    if(!p.time) continue;
    const [h, m] = p.time.split(':').map(Number);
    const prayerMinutes = h * 60 + m;

    /* إذا حان وقت الصلاة (خلال دقيقة) */
    if(Math.abs(currentTime - prayerMinutes) <= 1){
      triggerPrayerPause(p.name);
      return true;
    }
  }
  return false;
}

/* ================== إيقاف المؤقت مؤقتًا للصلاة ================== */
function triggerPrayerPause(prayerName){
  if(PRAYER.pausedTimer) return;
  PRAYER.pausedTimer = true;

  /* أوقف المؤقت */
  if(typeof TIMER !== 'undefined' && TIMER.running){
    TIMER.remain = Math.max(0, Math.round((TIMER.endAt - Date.now()) / 1000));
    clearInterval(TIMER.int);
    TIMER.int = null;
    TIMER.running = false;
    if(typeof updateTimerUI === 'function') updateTimerUI();
  }

  /* أظهر تنبيه */
  showPrayerModal(prayerName);
}

/* ================== نافذة تنبيه الصلاة ================== */
function showPrayerModal(prayerName){
  const modal = document.getElementById('prayerModal');
  if(!modal) return;

  const nameEl = document.getElementById('prayerName');
  if(nameEl) nameEl.textContent = `حان الآن وقت صلاة ${prayerName}`;

  modal.classList.add('open');
}

/* ================== استئناف الجلسة ================== */
function resumeAfterPrayer(){
  const modal = document.getElementById('prayerModal');
  if(modal) modal.classList.remove('open');

  PRAYER.pausedTimer = false;

  /* استئناف المؤقت تلقائيًا */
  if(typeof TIMER !== 'undefined' && TIMER.remain > 0){
    if(typeof startTimer === 'function'){
      startTimer();
      toast('🕌 تقبل الله — تم استئناف جلستك', 'ok');
    }
  }
}

/* ================== تهيئة ================== */
document.addEventListener('DOMContentLoaded', async () => {
  /* جلب المواقيت */
  await fetchPrayerTimes();

  /* فحص كل دقيقة */
  PRAYER.checkInterval = setInterval(() => {
    if(checkPrayerTime()){
      clearInterval(PRAYER.checkInterval);
      /* أعد الجدولة بعد ساعة */
      setTimeout(() => {
        PRAYER.checkInterval = setInterval(checkPrayerTime, 60000);
      }, 3600000);
    }
  }, 60000);
});

window.resumeAfterPrayer = resumeAfterPrayer;
window.fetchPrayerTimes = fetchPrayerTimes;
