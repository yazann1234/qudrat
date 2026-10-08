/* ============================================================
   01) CONFIG — Supabase + الثوابت العامة
============================================================ */

const SUPABASE_URL = 'https://turhxyetqlxrfizggtaf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cmh4eWV0cWx4cmZpemdndGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mzc0NjcsImV4cCI6MjEwNjAxMzQ2N30._hxx8iQCnWzgiNS-0nACHluQvmsgtj3nsldTDr5QFGU';
const CHANGE_PASS_URL = SUPABASE_URL + '/functions/v1/change-user-password';

// sessionStorage: كل تبويب له جلسة مستقلة
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    storageKey: 'sb-auth-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
});

const sbTemp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, storageKey: 'sb-temp-' + Date.now(), persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

if (window.pdfjsLib) {
  try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch(e){}
}

const THEMES = [
  { id:'purple',  name:'بنفسجي', c1:'#5b6cff', c2:'#8b5cf6', rgb:'91,108,255' },
  { id:'ocean',   name:'محيطي',  c1:'#0284c7', c2:'#06b6d4', rgb:'2,132,199' },
  { id:'forest',  name:'غابة',   c1:'#16a34a', c2:'#22c55e', rgb:'22,163,74' },
  { id:'sunset',  name:'غروب',   c1:'#ea580c', c2:'#f59e0b', rgb:'234,88,12' },
  { id:'rose',    name:'وردي',   c1:'#db2777', c2:'#ec4899', rgb:'219,39,119' },
  { id:'royal',   name:'ملكي',   c1:'#7c3aed', c2:'#a855f7', rgb:'124,58,237' },
  { id:'teal',    name:'فيروزي', c1:'#0d9488', c2:'#14b8a6', rgb:'13,148,136' },
  { id:'crimson', name:'قرمزي',  c1:'#dc2626', c2:'#ef4444', rgb:'220,38,38' }
];

const ICONS = [
  { i:'fa-book', c:'#5b6cff' }, { i:'fa-calculator', c:'#8b5cf6' },
  { i:'fa-square-root-variable', c:'#f7b32b' }, { i:'fa-book-open', c:'#22c55e' },
  { i:'fa-pen-fancy', c:'#ef4444' }, { i:'fa-shapes', c:'#0ea5e9' },
  { i:'fa-ruler-combined', c:'#ec4899' }, { i:'fa-infinity', c:'#14b8a6' },
  { i:'fa-language', c:'#f97316' }, { i:'fa-spell-check', c:'#a855f7' },
  { i:'fa-list-check', c:'#06b6d4' }, { i:'fa-graduation-cap', c:'#dc2626' }
];

const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const BADGES = [
  { id:'first',   i:'fa-seedling',      t:'البداية الموفقة',  d:'فتحت أول ملف' },
  { id:'pages10', i:'fa-book-open',     t:'قارئ نشيط',        d:'قرأت 10 صفحات' },
  { id:'pages100',i:'fa-book-bookmark', t:'قارئ متمكن',       d:'قرأت 100 صفحة' },
  { id:'half',    i:'fa-fire',          t:'في منتصف الطريق',  d:'أنجزت ملفاً بنسبة 50%+' },
  { id:'done1',   i:'fa-star',          t:'إنجاز كامل',       d:'أكملت ملفاً بنسبة 100%' },
  { id:'three',   i:'fa-trophy',        t:'مثابر',            d:'3 ملفات بمعدل 50%+' },
  { id:'all',     i:'fa-crown',         t:'عبقري القدرات',    d:'أكملت جميع الملفات' },
  { id:'focus1',  i:'fa-hourglass-end', t:'مركّز',            d:'أتممت جلسة تركيز كاملة' },
  { id:'focus10', i:'fa-brain',         t:'عقل منظم',         d:'10 جلسات تركيز' },
  { id:'streak3', i:'fa-fire-flame-curved', t:'ثلاثة أيام',   d:'3 أيام مذاكرة متواصلة' },
  { id:'streak7', i:'fa-fire-flame-simple', t:'أسبوع كامل',   d:'7 أيام مذاكرة متواصلة' },
  { id:'goal',    i:'fa-bullseye',      t:'هدف محقق',         d:'حققت هدف اليوم كاملاً' },
  { id:'videos5', i:'fa-video',         t:'متعلم بالفيديو',   d:'شاهدت 5 فيديوهات كاملة' }
];

const FEATURES = [
  { i:'fa-user-shield',      t:'حساب شخصي آمن',        d:'كل مستخدم له حسابه الخاص وتقدمه المستقل.', c:'#ef4444' },
  { i:'fa-file-pdf',         t:'ملفات PDF حقيقية',     d:'رفع ملفات PDF من الجهاز وعرضها داخل المنصة.', c:'#dc2626' },
  { i:'fa-video',            t:'دروس فيديو مدمجة',     d:'شاهد دروس يوتيوب داخل المنصة مع تتبع تلقائي.', c:'#ef4444' },
  { i:'fa-pen-ruler',        t:'رسم على الملف',        d:'اكتب وارسم فوق صفحات PDF بأقلام وألوان متعددة.', c:'#0ea5e9' },
  { i:'fa-chalkboard',       t:'سبورة بيضاء جانبية',   d:'سبورة بجانب الملف للشرح والتفكير — تبقى محفوظة.', c:'#8b5cf6' },
  { i:'fa-table-columns',    t:'وضع منقسم للفيديو+ملف', d:'شاهد الفيديو واكتب على الملف في نفس الوقت.', c:'#06b6d4' },
  { i:'fa-highlighter',      t:'هايلايت وممحاة',       d:'قلم هايلايت شفاف وممحاة دقيقة، مع تراجع ومسح.', c:'#facc15' },
  { i:'fa-user-circle',      t:'ملف شخصي مخصص',        d:'عدّل اسمك وارفع صورتك الشخصية بسهولة.', c:'#8b5cf6' },
  { i:'fa-bolt',             t:'قارئ فائق السرعة',      d:'تحميل كسول للصفحات: يفتح الملفات الكبيرة فوراً.', c:'#f59e0b' },
  { i:'fa-magnifying-glass-plus', t:'تكبير وتصغير',    d:'تحكم كامل في حجم الصفحة مع ملء تلقائي للعرض.', c:'#0ea5e9' },
  { i:'fa-list-ul',          t:'قائمة الصفحات',        d:'انتقل لأي صفحة بسرعة من قائمة جانبية منظمة.', c:'#6366f1' },
  { i:'fa-bookmark',         t:'علامة مرجعية',         d:'احفظ موضعك المفضل وارجع إليه في أي وقت.', c:'#a855f7' },
  { i:'fa-circle-half-stroke',t:'أوضاع قراءة مريحة',   d:'خلفيات فاتح وسيبيا وداكن لتقليل إجهاد العين.', c:'#14b8a6' },
  { i:'fa-scroll',           t:'تمرير مستمر أو صفحة واحدة', d:'اختر طريقة التصفح الأنسب لك.', c:'#ec4899' },
  { i:'fa-chart-simple',     t:'تتبع إنجاز تلقائي',     d:'النظام يحسب إنجازك من الصفحة التي وصلت إليها.', c:'#5b6cff' },
  { i:'fa-star',             t:'ملفات مميزة',          d:'إبراز الملفات المهمة بنجمة ليراها الطالب فوراً.', c:'#f7b32b' },
  { i:'fa-heart',            t:'المفضلة',              d:'ثبّت ملفاتك المفضلة وارجع لها بضغطة واحدة.', c:'#e11d48' },
  { i:'fa-medal',            t:'شارات تحفيزية',        d:'13 شارة مختلفة تكسبها عند تحقيق إنجازات.', c:'#22c55e' },
  { i:'fa-fire',             t:'سلسلة الأيام',          d:'تابع أيامك المتواصلة وحافظ على استمراريتك.', c:'#f97316' },
  { i:'fa-crosshairs',       t:'هدف يومي',             d:'حدّد عدد صفحات ودقائق يومية وتابع تحقيقها.', c:'#8b5cf6' },
  { i:'fa-stopwatch',        t:'مؤقت بومودورو',        d:'جلسات تركيز وراحات قصيرة وطويلة قابلة للتخصيص.', c:'#06b6d4' },
  { i:'fa-chart-column',     t:'تقارير أسبوعية',       d:'رسم بياني لدقائق مذاكرتك خلال آخر ٧ أيام.', c:'#0891b2' },
  { i:'fa-palette',          t:'ثيمات متعددة',         d:'8 ألوان + وضع ليلي تلقائي لتخصيص تجربتك.', c:'#db2777' },
  { i:'fa-key',              t:'استعادة كلمة المرور',  d:'نسيت كلمتك؟ رابط إعادة تعيين يصل لبريدك.', c:'#14b8a6' },
  { i:'fa-user-check',       t:'نظام موافقات ذكي',     d:'الطلاب الجدد ينتظرون موافقة الأدمن.', c:'#f59e0b' },
  { i:'fa-note-sticky',      t:'ملاحظاتي الخاصة',      d:'مساحة لكتابة القواعد مع حفظ فوري وتصدير.', c:'#f97316' },
  { i:'fa-list-check',       t:'قائمة المهام',         d:'نظّم مهامك الدراسية وأنجزها واحداً تلو الآخر.', c:'#6366f1' },
  { i:'fa-magnifying-glass', t:'بحث وفلترة فورية',     d:'ابحث بالاسم أو التصنيف مع ترتيب ذكي.', c:'#a855f7' },
  { i:'fa-mobile-screen',    t:'تجربة جوال ممتازة',    d:'تصميم متجاوب مع قائمة مستخدم خاصة للجوال.', c:'#22c55e' },
];
