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
    extraXp: ud.extraXp
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
  if(!currentUserObj || currentUserObj.role === 'admin') return;
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

function loadPrefsFromDB(){
  try{
    if(currentUserObj && currentUserObj.user_data && typeof currentUserObj.user_data === 'object'){
      Object.assign(userData, currentUserObj.user_data);
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

/* ================= هل يجب عرض المتجر؟ ================= */
function shouldShowStore(){
  try{
    if(!currentUserObj) return false;
    if(currentUserObj.role === 'admin') return false;
    if(currentUserObj.status === 'approved') return false;
    if(currentUserObj.purchase_submitted === true) return false;
    const lsKey = 'purchase_submitted_' + currentUserObj.id;
    if(localStorage.getItem(lsKey)) return false;
    return true;
  }catch(e){
    console.warn('shouldShowStore error:', e);
    return false;
  }
}
window.shouldShowStore = shouldShowStore;

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
