/* ============================================================
   39) DEVICES — حماية الحساب
   1) حد أقصى جهازين لكل حساب: لو دخل جهاز ثالث → يُطرد الجهاز
      الأقدم دخولاً تلقائياً (خلال ثوانٍ عبر Realtime + فحص دوري)
   2) حساب واحد فقط لكل جهاز: ما يقدر يسوي حسابات كثيرة من نفس الجهاز
   (الأدمن ورئيس المنصة مستثنون)
============================================================ */

const DEV = {
  MAX: 2,
  id: null,
  fp: null,
  channel: null,
  timer: null,
  kicked: false
};

const DEV_ID_KEY = 'abdq_device_id';
const DEV_OWNER_KEY = 'abdq_device_owner';

function getDeviceId(){
  if(DEV.id) return DEV.id;
  let id = null;
  try{ id = localStorage.getItem(DEV_ID_KEY); }catch(e){}
  if(!id){
    id = (typeof uuidv4 === 'function' ? uuidv4() : String(Date.now()) + Math.random().toString(36).slice(2));
    try{ localStorage.setItem(DEV_ID_KEY, id); }catch(e){}
  }
  DEV.id = id;
  return id;
}

/* بصمة الجهاز (تبقى حتى لو انمسحت بيانات المتصفح أو وضع التصفح الخفي) */
async function getDeviceFingerprint(){
  if(DEV.fp) return DEV.fp;
  const parts = [
    navigator.userAgent, navigator.language, navigator.platform,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
    (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
    navigator.hardwareConcurrency || '', navigator.deviceMemory || '', navigator.maxTouchPoints || ''
  ];
  try{
    const c = document.createElement('canvas');
    c.width = 220; c.height = 40;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top'; ctx.font = '16px Arial';
    ctx.fillStyle = '#f60'; ctx.fillRect(10, 5, 90, 20);
    ctx.fillStyle = '#069'; ctx.fillText('عباقرة القدرات ✓ 123', 4, 12);
    parts.push(c.toDataURL().slice(-120));
  }catch(e){}
  const raw = parts.join('|');
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    DEV.fp = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  }catch(e){
    let h = 0; for(let i = 0; i < raw.length; i++){ h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
    DEV.fp = 'h' + Math.abs(h);
  }
  return DEV.fp;
}

function getDeviceName(){
  const ua = navigator.userAgent;
  let os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'جهاز';
  let br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return os + (br ? ' • ' + br : '');
}

function devExempt(){
  return !currentUserObj || (typeof isPrivileged === 'function' && isPrivileged());
}

/* ================== تسجيل الجهاز عند الدخول ================== */
async function registerDevice(){
  if(devExempt()) return;
  DEV.kicked = false;
  const now = new Date().toISOString();
  const row = {
    user_id: currentUserObj.id,
    device_id: getDeviceId(),
    fingerprint: await getDeviceFingerprint(),
    device_name: getDeviceName(),
    last_login: now,
    last_seen: now
  };
  const r = await sbSafeWrite(p => sb.from('user_devices').upsert(p, { onConflict: 'user_id,device_id' }), row);
  if(r && r.error){ console.warn('device register failed:', r.error.message); return; }

  /* هذا الجهاز صار مرتبطاً بهذا الحساب */
  try{ if(!localStorage.getItem(DEV_OWNER_KEY)) localStorage.setItem(DEV_OWNER_KEY, currentUserObj.id); }catch(e){}

  await enforceDeviceLimit();
  subscribeDevices();
  clearInterval(DEV.timer);
  DEV.timer = setInterval(checkThisDevice, 45000);
}
window.registerDevice = registerDevice;

/* أبقِ أحدث جهازين فقط — الأقدم دخولاً يُحذف (ويُطرد) */
async function enforceDeviceLimit(){
  const { data, error } = await sb.from('user_devices').select('device_id,last_login')
    .eq('user_id', currentUserObj.id).order('last_login', { ascending: false });
  if(error || !data) return;
  const extra = data.filter(d => d.device_id !== DEV.id).slice(DEV.MAX - 1);
  if(!extra.length) return;
  await sb.from('user_devices').delete().eq('user_id', currentUserObj.id).in('device_id', extra.map(d => d.device_id));
  toast(`🔒 تم تسجيل خروج ${extra.length === 1 ? 'جهاز قديم' : extra.length + ' أجهزة قديمة'} (الحد جهازين)`, 'warn');
}

function subscribeDevices(){
  if(DEV.channel){ try{ sb.removeChannel(DEV.channel); }catch(e){} }
  DEV.channel = sb.channel('dev-' + currentUserObj.id + '-' + Date.now())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user_devices', filter: 'user_id=eq.' + currentUserObj.id },
      () => checkThisDevice())
    .subscribe();
}

/* هل هذا الجهاز ما زال مسموحاً؟ */
async function checkThisDevice(){
  if(devExempt() || DEV.kicked) return;
  const { data, error } = await sb.from('user_devices').select('device_id')
    .eq('user_id', currentUserObj.id).eq('device_id', getDeviceId()).maybeSingle();
  if(error) return;
  if(!data){ kickThisDevice(); return; }
  sb.from('user_devices').update({ last_seen: new Date().toISOString() })
    .eq('user_id', currentUserObj.id).eq('device_id', getDeviceId()).then(() => {});
}

async function kickThisDevice(){
  if(DEV.kicked) return;
  DEV.kicked = true;
  stopDeviceWatch();
  try{
    openModal({
      title: 'تم تسجيل خروجك',
      text: 'تم تسجيل الدخول لحسابك من جهاز آخر. الحد المسموح جهازين فقط لكل حساب، فتم إخراج هذا الجهاز تلقائياً.<br><br>إذا لم تكن أنت، غيّر كلمة المرور فوراً وتواصل مع الدعم.',
      okText: 'حسناً'
    });
  }catch(e){}
  try{ if(typeof performLogout === 'function') await performLogout(true, { keepDevice: true }); }catch(e){}
}

function stopDeviceWatch(){
  clearInterval(DEV.timer); DEV.timer = null;
  if(DEV.channel){ try{ sb.removeChannel(DEV.channel); }catch(e){} DEV.channel = null; }
}
window.stopDeviceWatch = stopDeviceWatch;

/* تسجيل خروج عادي → حرّر مكان الجهاز */
async function unregisterDevice(){
  stopDeviceWatch();
  if(devExempt() || DEV.kicked) return;
  try{ await sb.from('user_devices').delete().eq('user_id', currentUserObj.id).eq('device_id', getDeviceId()); }catch(e){}
}
window.unregisterDevice = unregisterDevice;

/* ================== حساب واحد لكل جهاز ================== */
async function checkDeviceCanRegister(){
  try{
    const owner = localStorage.getItem(DEV_OWNER_KEY);
    if(owner) return { allowed: false, msg: 'يوجد حساب مسجّل مسبقاً على هذا الجهاز — سجّل دخولك بحسابك. لو تحتاج مساعدة تواصل مع الدعم.' };
  }catch(e){}
  try{
    const { data, error } = await sb.rpc('device_account_count', { p_fingerprint: await getDeviceFingerprint(), p_device_id: getDeviceId() });
    if(!error && Number(data) > 0){
      try{ localStorage.setItem(DEV_OWNER_KEY, 'existing'); }catch(e){}
      return { allowed: false, msg: 'يوجد حساب مسجّل مسبقاً على هذا الجهاز — مسموح حساب واحد فقط لكل جهاز.' };
    }
  }catch(e){}
  return { allowed: true };
}
window.checkDeviceCanRegister = checkDeviceCanRegister;

function markDeviceOwner(userId){
  try{ localStorage.setItem(DEV_OWNER_KEY, userId); }catch(e){}
}
window.markDeviceOwner = markDeviceOwner;

/* ================== الأدمن: إدارة أجهزة طالب ================== */
window.manageUserDevices = async (userId) => {
  if(!isPrivileged()) return;
  const u = (DB.users || []).find(x => x.id === userId);
  const { data, error } = await sb.from('user_devices').select('*').eq('user_id', userId).order('last_login', { ascending: false });
  if(error){ toast('تعذّر جلب الأجهزة: ' + error.message, 'err'); return; }
  const rows = data || [];
  openModal({
    title: 'أجهزة ' + (u ? (u.name || u.email) : 'الطالب'),
    text: `مسموح ${DEV.MAX} أجهزة كحد أقصى. حذف جهاز يسجّل خروجه فوراً.`,
    bodyHTML: rows.length ? `<div class="dev-list">${rows.map(d => `
      <div class="dev-row">
        <i class="fas ${/iPhone|Android/.test(d.device_name || '') ? 'fa-mobile-screen' : 'fa-laptop'}"></i>
        <div><b>${escapeHtml(d.device_name || 'جهاز')}</b>
          <small>آخر دخول: ${d.last_login ? new Date(d.last_login).toLocaleString('ar-SA') : '—'}</small></div>
        <button class="btn btn-danger btn-sm" onclick="adminRemoveDevice('${userId}','${escapeHtml(d.device_id)}')"><i class="fas fa-right-from-bracket"></i></button>
      </div>`).join('')}</div>` : '<div style="text-align:center;color:var(--muted);padding:16px">لا توجد أجهزة مسجلة</div>',
    okText: 'إغلاق'
  });
};
window.adminRemoveDevice = async (userId, deviceId) => {
  const { error } = await sb.from('user_devices').delete().eq('user_id', userId).eq('device_id', deviceId);
  if(error){ toast('فشل: ' + error.message, 'err'); return; }
  toast('✓ تم إخراج الجهاز', 'ok');
  manageUserDevices(userId);
};
