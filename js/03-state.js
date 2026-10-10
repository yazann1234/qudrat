/* ============================================================
   03) STATE — الحالة العامة + تخزين البيانات
============================================================ */

let session = null;
let currentUserObj = null;
let DB = { users: [], files: [], videos: [], products: [], storeSettings: null };
let userData = null;
let myProfileChannel = null, filesChannel = null, profilesChannel = null;

function defaultUD(){
  return {
    progress:{}, opened:[], favs:[], badges:[],
    minutes:0, sessions:0, notes:'', tasks:[],
    theme:'purple', darkMode:'light', font:1, reduceMotion:false,
    focus:25, brk:5, longBrk:15, autoStart:false, sound:true,
    goalPages:10, goalMinutes:30,
    readTheme:'light', snap:false, showMarks:true, defaultZoom:1, autoResume:true,
    log:{}, streak:0, drawings:{},
    videoProgress:{}, awardedVideoXp:{}, extraXp:0
  };
}
function resetUD(){ userData = defaultUD(); }
function prefsKey(){ if(!session) return 'abdq_prefs_guest'; return 'abdq_prefs_' + session.user.id; }

function pickLocalFields(ud){
  return {
    favs: ud.favs, tasks: ud.tasks, notes: ud.notes,
    theme: ud.theme, darkMode: ud.darkMode, font: ud.font,
    reduceMotion: ud.reduceMotion, focus: ud.focus, brk: ud.brk,
    longBrk: ud.longBrk, autoStart: ud.autoStart, sound: ud.sound,
    goalPages: ud.goalPages, goalMinutes: ud.goalMinutes,
    readTheme: ud.readTheme, snap: ud.snap, showMarks: ud.showMarks,
    defaultZoom: ud.defaultZoom, autoResume: ud.autoResume,
    log: ud.log, opened: ud.opened, minutes: ud.minutes, sessions: ud.sessions,
    badges: ud.badges,
    videoProgress: ud.videoProgress,
    awardedVideoXp: ud.awardedVideoXp,
    extraXp: ud.extraXp,
    /* ⭐ نسخة احتياطية من التقدم — حتى لا تضيع النقاط لو فشلت مزامنة user_progress */
    progress: ud.progress
  };
}

let prefsSaveTimer = null;

function savePrefs(){
  if(!session) return;
  try{ sessionStorage.setItem(prefsKey(), JSON.stringify(pickLocalFields(userData))); }catch(e){}
  clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(pushUserDataToDB, 900);
}

async function pushUserDataToDB(){
  if(!currentUserObj || currentUserObj.role === 'admin' || currentUserObj.role === 'owner') return;
  try{
    const payload = pickLocalFields(userData);
    const { error } = await sb.from('profiles').update({ user_data: payload }).eq('id', currentUserObj.id);
    if(error) console.warn('user_data sync failed:', error.message);
  }catch(e){}
}

function loadPrefs(){
  resetUD();
  try{
    const raw = sessionStorage.getItem(prefsKey());
    if(raw){ const d = JSON.parse(raw); if(d && typeof d === 'object') Object.assign(userData, d); }
  }catch(e){}
}

/* ⭐ دمج تقدّم ملفين: نأخذ الأعلى دائماً (لا يضيع أي تقدم) */
function mergeProgressEntry(a, b){
  const norm = v => (v && typeof v === 'object') ? v : (typeof v === 'number' ? { pct: v } : {});
  const x = norm(a), y = norm(b);
  const out = Object.assign({}, x, y);
  out.pct = Math.max(x.pct || 0, y.pct || 0);
  out.maxPage = Math.max(x.maxPage || 0, y.maxPage || 0);
  out.lastPage = (y.at || 0) >= (x.at || 0) ? (y.lastPage || x.lastPage || 1) : (x.lastPage || y.lastPage || 1);
  if(x.bookmark || y.bookmark) out.bookmark = y.bookmark || x.bookmark;
  out.at = Math.max(x.at || 0, y.at || 0);
  return out;
}
function mergeProgressMaps(a, b){
  const out = {};
  const A = (a && typeof a === 'object') ? a : {};
  const B = (b && typeof b === 'object') ? b : {};
  new Set([...Object.keys(A), ...Object.keys(B)]).forEach(k => { out[k] = mergeProgressEntry(A[k], B[k]); });
  return out;
}
window.mergeProgressMaps = mergeProgressMaps;

function loadPrefsFromDB(){
  try{
    if(currentUserObj && currentUserObj.user_data && typeof currentUserObj.user_data === 'object'){
      const localProgress = userData.progress;
      const localExtra = userData.extraXp || 0;
      Object.assign(userData, currentUserObj.user_data);
      userData.progress = mergeProgressMaps(localProgress, currentUserObj.user_data.progress);
      /* XP الإضافي: خذ الأعلى بين المحلي والمحفوظ */
      if(typeof currentUserObj.user_data.extraXp === 'number'){
        userData.extraXp = Math.max(localExtra, currentUserObj.user_data.extraXp);
      }
    }
  }catch(e){}
  if(!userData.log || typeof userData.log !== 'object') userData.log = {};
  if(!Array.isArray(userData.favs)) userData.favs = [];
  if(!Array.isArray(userData.tasks)) userData.tasks = [];
  if(!Array.isArray(userData.badges)) userData.badges = [];
  if(!Array.isArray(userData.opened)) userData.opened = [];
  if(!userData.progress || typeof userData.progress !== 'object') userData.progress = {};
  if(!userData.drawings || typeof userData.drawings !== 'object') userData.drawings = {};
  if(!userData.videoProgress || typeof userData.videoProgress !== 'object') userData.videoProgress = {};
  if(!userData.awardedVideoXp || typeof userData.awardedVideoXp !== 'object') userData.awardedVideoXp = {};
  if(typeof userData.extraXp !== 'number') userData.extraXp = 0;
}

/* ============================================================
   ⭐ دوال مساعدة للصلاحيات
============================================================ */
function isOwner(){
  return currentUserObj && currentUserObj.role === 'owner';
}

function isAdmin(){
  return currentUserObj && currentUserObj.role === 'admin';
}

function isPrivileged(){
  return currentUserObj && (currentUserObj.role === 'admin' || currentUserObj.role === 'owner');
}

window.isOwner = isOwner;
window.isAdmin = isAdmin;
window.isPrivileged = isPrivileged;

/* ⭐ هل يجب عرض المتجر؟ (فقط للمستخدم الجديد pending) */
function shouldShowStore(){
  try{
    if(!currentUserObj) return false;
    /* الإداريون و owner لا يرون المتجر أبداً */
    if(isPrivileged()) return false;
    /* المشترك المعتمد لا يراه */
    if(currentUserObj.status === 'approved') return false;
    /* من أرسل طلب شراء من قبل لا يراه */
    if(currentUserObj.purchase_submitted === true) return false;
    const lsKey = 'purchase_submitted_' + currentUserObj.id;
    if(localStorage.getItem(lsKey)) return false;
    /* الباقي فقط (pending جديد) */
    return true;
  }catch(e){
    console.warn('shouldShowStore error:', e);
    return false;
  }
}
window.shouldShowStore = shouldShowStore;
