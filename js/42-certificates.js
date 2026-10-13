/* ============================================================
   42) CERTIFICATES — شهادات شكر وتقدير للمتصدرين
   - شهادة لكل طالب في قائمة المتصدرين: اسمه + مركزه + نقاطه
   - تصميم المنصة + شعار القناة + ختم المركز + توقيع الإدارة
   - لون الشهادة حسب المركز (ذهبي / فضي / برونزي / نخبة / تقدير)
   - معاينة + تحميل PNG + مشاركة
============================================================ */

const CERT_W = 2000, CERT_H = 1414;
const CERT_NAVY = '#0b1250';

function certTier(rank){
  if(rank === 1) return { key: 'gold',   label: 'وسام المركز الأول',   main: '#b8860b', light: '#f7d774', dark: '#6b4e00' };
  if(rank === 2) return { key: 'silver', label: 'وسام المركز الثاني',  main: '#7c8796', light: '#e6eaf0', dark: '#3f4753' };
  if(rank === 3) return { key: 'bronze', label: 'وسام المركز الثالث',  main: '#b0683a', light: '#f3c9a2', dark: '#5e3214' };
  if(rank <= 10) return { key: 'elite',  label: 'شهادة نخبة العشرة',   main: '#6d28d9', light: '#d6c8fb', dark: '#3b1078' };
  return { key: 'merit', label: 'شهادة تميّز', main: '#1d4ed8', light: '#c7d7fb', dark: '#13306f' };
}

function rankWord(r){
  const w = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  return w[r] || String(r);
}

function certNumber(userId){
  let h = 0; const s = String(userId || '') + new Date().getFullYear();
  for(let i = 0; i < s.length; i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return 'ABQ-' + new Date().getFullYear() + '-' + Math.abs(h).toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
}

function loadImg(src){
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/* ⭐ تحميل الشعار مسبقاً (يكون جاهز لحظة فتح الشهادة) */
let _certLogoPromise = null;
function getCertLogo(){
  if(!_certLogoPromise) _certLogoPromise = loadImg('assets/logo.png');
  return _certLogoPromise;
}
setTimeout(getCertLogo, 1500);

const FONT = "Tajawal, 'Segoe UI', Tahoma, Arial, sans-serif";

function wrapLines(ctx, text, maxW){
  const words = String(text).split(/\s+/);
  const lines = []; let line = '';
  for(const w of words){
    const test = line ? line + ' ' + w : w;
    if(ctx.measureText(test).width > maxW && line){ lines.push(line); line = w; }
    else line = test;
  }
  if(line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawStar(ctx, cx, cy, spikes, outer, inner){
  let rot = Math.PI / 2 * 3; const step = Math.PI / spikes;
  ctx.beginPath(); ctx.moveTo(cx, cy - outer);
  for(let i = 0; i < spikes; i++){
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer); rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner); rot += step;
  }
  ctx.closePath();
}

async function drawCertificate(u){
  const t = certTier(u.rank);
  /* الخط والشعار مع مهلة (لو الشبكة بطيئة نكمل بخط بديل بدل ما نعلّق) */
  const timeout = ms => new Promise(r => setTimeout(r, ms));
  try{
    await Promise.race([
      Promise.all([document.fonts.load('900 100px Tajawal'), document.fonts.load('700 40px Tajawal'), document.fonts.load('500 36px Tajawal')]),
      timeout(2500)
    ]);
  }catch(e){}
  const logo = await Promise.race([getCertLogo(), timeout(6000).then(() => null)]);

  const c = document.createElement('canvas');
  c.width = CERT_W; c.height = CERT_H;
  const ctx = c.getContext('2d');
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  /* ---- الخلفية ---- */
  const bg = ctx.createRadialGradient(CERT_W / 2, CERT_H / 2, 200, CERT_W / 2, CERT_H / 2, 1300);
  bg.addColorStop(0, '#fffefa'); bg.addColorStop(1, '#f7f1e3');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CERT_W, CERT_H);

  /* نقش خفيف */
  ctx.save();
  ctx.globalAlpha = 0.05; ctx.strokeStyle = t.main; ctx.lineWidth = 2;
  for(let x = -CERT_H; x < CERT_W; x += 46){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + CERT_H, CERT_H); ctx.stroke(); }
  ctx.restore();

  /* علامة مائية كبيرة للشعار */
  if(logo){
    ctx.save(); ctx.globalAlpha = 0.045;
    const s = 900; ctx.drawImage(logo, CERT_W / 2 - s / 2, CERT_H / 2 - s / 2 + 40, s, s);
    ctx.restore();
  }

  /* ---- الإطار ---- */
  const fg = ctx.createLinearGradient(0, 0, CERT_W, CERT_H);
  fg.addColorStop(0, t.dark); fg.addColorStop(0.25, t.light); fg.addColorStop(0.5, t.main); fg.addColorStop(0.75, t.light); fg.addColorStop(1, t.dark);
  ctx.lineWidth = 26; ctx.strokeStyle = fg;
  roundRect(ctx, 38, 38, CERT_W - 76, CERT_H - 76, 26); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = t.main;
  roundRect(ctx, 82, 82, CERT_W - 164, CERT_H - 164, 16); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = CERT_NAVY; ctx.globalAlpha = 0.35;
  roundRect(ctx, 96, 96, CERT_W - 192, CERT_H - 192, 12); ctx.stroke();
  ctx.globalAlpha = 1;

  /* زخارف الزوايا */
  [[110, 110, 0], [CERT_W - 110, 110, 1], [110, CERT_H - 110, 2], [CERT_W - 110, CERT_H - 110, 3]].forEach(([x, y]) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = t.main; drawStar(ctx, 0, 0, 8, 34, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  /* ---- الشعار ---- */
  const lx = CERT_W / 2, ly = 205, lr = 98;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 8; ctx.strokeStyle = fg; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.stroke();
  if(logo){
    ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, lr - 10, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logo, lx - (lr - 10), ly - (lr - 10), (lr - 10) * 2, (lr - 10) * 2);
    ctx.restore();
  }

  /* ---- العنوان ---- */
  ctx.fillStyle = CERT_NAVY;
  ctx.font = `900 104px ${FONT}`;
  ctx.fillText('شهادة شكر وتقدير', CERT_W / 2, 395);

  /* شريط اسم الوسام */
  ctx.font = `800 36px ${FONT}`;
  const tw = ctx.measureText(t.label).width + 90;
  const rg = ctx.createLinearGradient(CERT_W / 2 - tw / 2, 0, CERT_W / 2 + tw / 2, 0);
  rg.addColorStop(0, t.dark); rg.addColorStop(0.5, t.main); rg.addColorStop(1, t.dark);
  ctx.fillStyle = rg; roundRect(ctx, CERT_W / 2 - tw / 2, 455, tw, 62, 31); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(t.label, CERT_W / 2, 487);

  /* ---- المقدمة ---- */
  ctx.fillStyle = '#4b5563';
  ctx.font = `500 40px ${FONT}`;
  ctx.fillText('تتشرّف منصة عباقرة القدرات بأن تمنح هذه الشهادة إلى', CERT_W / 2, 585);

  /* ---- الاسم ---- */
  let ns = 118;
  ctx.font = `900 ${ns}px ${FONT}`;
  while(ctx.measureText(u.name).width > 1300 && ns > 60){ ns -= 6; ctx.font = `900 ${ns}px ${FONT}`; }
  const nameW = ctx.measureText(u.name).width;
  const ng = ctx.createLinearGradient(CERT_W / 2 - nameW / 2, 0, CERT_W / 2 + nameW / 2, 0);
  ng.addColorStop(0, t.dark); ng.addColorStop(0.5, t.main); ng.addColorStop(1, t.dark);
  ctx.fillStyle = ng;
  ctx.fillText(u.name, CERT_W / 2, 705);
  /* خطوط جانبية للاسم */
  ctx.strokeStyle = t.main; ctx.lineWidth = 3;
  const half = Math.min(700, nameW / 2 + 60);
  [[-1], [1]].forEach(([d]) => {
    ctx.beginPath(); ctx.moveTo(CERT_W / 2 + d * half, 705); ctx.lineTo(CERT_W / 2 + d * (half + 160), 705); ctx.stroke();
    ctx.fillStyle = t.main; drawStar(ctx, CERT_W / 2 + d * (half + 175), 705, 4, 13, 5); ctx.fill();
  });

  /* ---- نص الشكر ---- */
  ctx.fillStyle = '#1f2937';
  ctx.font = `500 42px ${FONT}`;
  const body = `تقديراً للتميّز والمثابرة في رحلة الاستعداد لاختبار القدرات، وتحقيق المركز ${rankWord(u.rank)} في قائمة متصدري المنصة برصيد ${Number(u.xp || 0).toLocaleString('en')} نقطة. مع خالص تمنياتنا بدوام التفوق والنجاح وتحقيق أعلى الدرجات.`;
  wrapLines(ctx, body, 1450).forEach((line, i) => ctx.fillText(line, CERT_W / 2, 815 + i * 66));

  /* ---- الإحصائيات ---- */
  const stats = [
    ['نقطة XP', Number(u.xp || 0).toLocaleString('en')],
    ['صفحة مقروءة', Number(u.pages || 0).toLocaleString('en')],
    ['ملف مكتمل', Number(u.completed || 0).toLocaleString('en')],
    ['جلسة تركيز', Number(u.sessions || 0).toLocaleString('en')]
  ];
  const pw = 250, gap = 34, totalW = stats.length * pw + (stats.length - 1) * gap;
  stats.forEach((s, i) => {
    const x = CERT_W / 2 + totalW / 2 - pw - i * (pw + gap);   /* من اليمين لليسار */
    ctx.fillStyle = '#fff'; roundRect(ctx, x, 985, pw, 112, 20); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = t.light; roundRect(ctx, x, 985, pw, 112, 20); ctx.stroke();
    ctx.fillStyle = t.dark; ctx.font = `900 48px ${FONT}`; ctx.fillText(s[1], x + pw / 2, 1028);
    ctx.fillStyle = '#6b7280'; ctx.font = `700 26px ${FONT}`; ctx.fillText(s[0], x + pw / 2, 1072);
  });

  /* ---- الختم (يمين) ---- */
  const sx = 330, sy = 1180;
  ctx.save();
  /* أشرطة */
  ctx.fillStyle = t.dark;
  ctx.beginPath(); ctx.moveTo(sx - 60, sy + 40); ctx.lineTo(sx - 95, sy + 175); ctx.lineTo(sx - 55, sy + 150); ctx.lineTo(sx - 25, sy + 185); ctx.lineTo(sx - 5, sy + 60); ctx.fill();
  ctx.beginPath(); ctx.moveTo(sx + 60, sy + 40); ctx.lineTo(sx + 95, sy + 175); ctx.lineTo(sx + 55, sy + 150); ctx.lineTo(sx + 25, sy + 185); ctx.lineTo(sx + 5, sy + 60); ctx.fill();
  const sg = ctx.createRadialGradient(sx - 30, sy - 30, 10, sx, sy, 130);
  sg.addColorStop(0, t.light); sg.addColorStop(0.6, t.main); sg.addColorStop(1, t.dark);
  ctx.fillStyle = sg; drawStar(ctx, sx, sy, 24, 125, 108); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 88, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `800 26px ${FONT}`; ctx.fillText('المركز', sx, sy - 38);
  ctx.font = `900 76px ${FONT}`; ctx.fillText(String(u.rank), sx, sy + 18);
  ctx.font = `700 20px ${FONT}`; ctx.fillText('عباقرة القدرات', sx, sy + 62);
  ctx.restore();

  /* ---- التوقيع (يسار) ---- */
  const gx = CERT_W - 360, gy = 1205;
  ctx.fillStyle = CERT_NAVY; ctx.font = `800 34px ${FONT}`;
  ctx.fillText('إدارة منصة عباقرة القدرات', gx, gy + 38);
  ctx.strokeStyle = CERT_NAVY; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(gx - 210, gy); ctx.lineTo(gx + 210, gy); ctx.stroke();
  ctx.save(); ctx.strokeStyle = t.main; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx - 150, gy - 22);
  ctx.bezierCurveTo(gx - 90, gy - 90, gx - 40, gy + 10, gx + 10, gy - 50);
  ctx.bezierCurveTo(gx + 50, gy - 95, gx + 90, gy - 10, gx + 150, gy - 45);
  ctx.stroke(); ctx.restore();

  /* ---- التاريخ ورقم الشهادة (وسط) ---- */
  const dateStr = new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillStyle = '#374151'; ctx.font = `700 30px ${FONT}`;
  ctx.fillText('بتاريخ: ' + dateStr, CERT_W / 2, 1195);
  ctx.fillStyle = '#9ca3af'; ctx.font = `600 24px ${FONT}`;
  ctx.direction = 'ltr';
  ctx.fillText(certNumber(u.id), CERT_W / 2, 1245);
  ctx.direction = 'rtl';
  ctx.fillStyle = t.main; ctx.font = `700 24px ${FONT}`;
  ctx.fillText('رقم الشهادة', CERT_W / 2, 1282);

  return c;
}

/* ================== النافذة ================== */
async function openCertificate(userId){
  const list = window._lbUsers || [];
  const u = list.find(x => x.id === userId);
  if(!u){ toast('افتح قائمة المتصدرين أولاً', 'warn'); return; }

  let m = document.getElementById('certModal');
  if(!m){
    m = document.createElement('div');
    m.id = 'certModal';
    m.className = 'cert-overlay';
    m.addEventListener('click', e => { if(e.target === m) closeCertificate(); });
    document.body.appendChild(m);
  }
  m.innerHTML = `<div class="cert-box"><div class="cert-loading"><i class="fas fa-spinner fa-spin"></i> نجهّز الشهادة...</div></div>`;
  m.classList.add('open');

  try{
    const canvas = await drawCertificate(u);
    const url = canvas.toDataURL('image/png');
    const isMe = currentUserObj && currentUserObj.id === u.id;
    const fileName = `شهادة-عباقرة-القدرات-${String(u.name).replace(/\s+/g, '-')}.png`;
    m.innerHTML = `
      <div class="cert-box">
        <div class="cert-head">
          <b><i class="fas fa-award"></i> ${isMe ? 'شهادتك' : 'شهادة ' + escapeHtml(u.name)} — المركز ${u.rank}</b>
          <button class="cert-x" onclick="closeCertificate()"><i class="fas fa-xmark"></i></button>
        </div>
        <img class="cert-img" src="${url}" alt="شهادة ${escapeHtml(u.name)}">
        <div class="cert-actions">
          <a class="btn btn-primary" href="${url}" download="${escapeHtml(fileName)}"><i class="fas fa-download"></i> تحميل الشهادة</a>
          ${navigator.share ? '<button class="btn btn-ghost" id="certShareBtn"><i class="fas fa-share-nodes"></i> مشاركة</button>' : ''}
          <button class="btn btn-ghost" onclick="closeCertificate()">إغلاق</button>
        </div>
        ${isMe ? '<p class="cert-tip"><i class="fas fa-lightbulb"></i> كل ما تقدّمت في الترتيب تتحدّث شهادتك تلقائياً — حافظ على مركزك! 🔥</p>' : ''}
      </div>`;
    const sh = document.getElementById('certShareBtn');
    if(sh) sh.addEventListener('click', async () => {
      try{
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], fileName, { type: 'image/png' });
        if(navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'شهادة عباقرة القدرات' });
        else await navigator.share({ title: 'شهادة عباقرة القدرات', text: `حصلت على المركز ${u.rank} في منصة عباقرة القدرات 🏆` });
      }catch(e){}
    });
  }catch(e){
    m.innerHTML = `<div class="cert-box"><div class="cert-loading">تعذّر تجهيز الشهادة</div><div class="cert-actions"><button class="btn btn-ghost" onclick="closeCertificate()">إغلاق</button></div></div>`;
  }
}
window.openCertificate = openCertificate;

function closeCertificate(){
  const m = document.getElementById('certModal');
  if(m) m.classList.remove('open');
}
window.closeCertificate = closeCertificate;

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeCertificate(); });
