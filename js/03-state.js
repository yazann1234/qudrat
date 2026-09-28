/* ============================================================
   03) STATE — الحالة العامة + تخزين البيانات
============================================================ */

let session = null;
let currentUserObj = null;
let DB = { users: [], files: [] };
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
    log:{}, streak:0, drawings:{}
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
    badges: ud.badges
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
}
