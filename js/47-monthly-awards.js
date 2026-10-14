/* ============================================================
   42) CERTIFICATES — شهادة شكر وتقدير لأول 3 في الصدارة فقط
   - التصميم الرسمي للمنصة (assets/cert/template.jpg) + توقيع تركي الظفيري
   - الأول: وسام ذهبي • الثاني: فضي • الثالث: برونزي
   - الاسم والمركز يُكتبان تلقائياً — معاينة + تحميل PNG + مشاركة
============================================================ */

const CERT_BASE_W = 1536, CERT_BASE_H = 1024, CERT_SCALE = 1.5;
const CERT_NAVY = '#14234d';

function certTier(rank){
  if(rank === 1) return { key: 'gold',   word: 'الأول',  accent: '#b8860b', ink: '#4a3010', ramp: null };
  if(rank === 2) return { key: 'silver', word: 'الثاني', accent: '#6b7584', ink: '#262c36', ramp: [[0,[40,44,52]],[.35,[105,112,124]],[.6,[178,186,198]],[.8,[222,228,236]],[1,[255,255,255]]] };
  if(rank === 3) return { key: 'bronze', word: 'الثالث', accent: '#a0522d', ink: '#3d1c09', ramp: [[0,[45,20,8]],[.35,[120,62,30]],[.6,[184,110,62]],[.8,[226,160,112]],[1,[255,226,196]]] };
  return null;
}

function loadImg(src){
  /* صورة عادية، ولو فشلت نجرب fetch + ImageBitmap (أضمن على بعض المتصفحات) */
  return new Promise(res => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = async () => {
      try{
        const r = await fetch(src, { cache: 'force-cache' });
        if(!r.ok) return res(null);
        res(await createImageBitmap(await r.blob()));
      }catch(e){ res(null); }
    };
    i.src = src;
  });
}

/* ⭐ تحميل القالب مسبقاً (يكون جاهز لحظة فتح الشهادة) */
const _certImgs = {};
function certImg(src){
  if(!_certImgs[src]) _certImgs[src] = loadImg(src + '?v=2');
  return _certImgs[src];
}
setTimeout(() => certImg('assets/cert/template.jpg'), 2000);

const FONT_SANS = "Tajawal, 'Segoe UI', Tahoma, Arial, sans-serif";
const FONT_NASKH = "'Noto Naskh Arabic', Tajawal, 'Traditional Arabic', serif";

/* يصغّر الخط لو السطر أعرض من المساحة */
const CERT_MAX_LINE = 880;
function fitFont(font, width){
  if(width <= CERT_MAX_LINE) return font;
  return font.replace(/(\d+)px/, (m, n) => Math.floor(Number(n) * CERT_MAX_LINE / width) + 'px');
}
function fitText(ctx, font, text, x, y){
  ctx.font = font;
  ctx.font = fitFont(font, ctx.measureText(text).width);
  ctx.fillText(text, x, y);
}

/* سطر بأجزاء ملونة (من اليمين لليسار) */
function drawRichLine(ctx, parts, cx, y){
  let widths = parts.map(p => { ctx.font = p.font; return ctx.measureText(p.text).width; });
  const sum = widths.reduce((a, b) => a + b, 0);
  if(sum > CERT_MAX_LINE){
    parts = parts.map(p => Object.assign({}, p, { font: fitFont(p.font, sum) }));
    widths = parts.map(p => { ctx.font = p.font; return ctx.measureText(p.text).width; });
  }
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx + total / 2;
  ctx.textAlign = 'right';
  parts.forEach((p, i) => {
    ctx.font = p.font; ctx.fillStyle = p.color;
    ctx.fillText(p.text, x, y);
    x -= widths[i];
  });
  ctx.textAlign = 'center';
}

/* يلوّن بكسلات الوسام الذهبية فقط (داخل دائرة الوسام) بتدرّج فضي أو برونزي */
function recolorSeal(ctx, ramp){
  const S = CERT_SCALE, x0 = Math.round(1200 * S), y0 = Math.round(90 * S), w = Math.round(300 * S), h = w;
  const cx = 150 * S, cy = 150 * S, rOut = 145 * S, rIn = 118 * S;
  const img = ctx.getImageData(x0, y0, w, h), d = img.data;
  const lut = new Uint8ClampedArray(256 * 3);
  for(let v = 0; v < 256; v++){
    const L = v / 255;
    let k = 0; while(k < ramp.length - 2 && L > ramp[k + 1][0]) k++;
    const [a, ca] = ramp[k], [b, cb] = ramp[k + 1];
    const f = Math.max(0, Math.min(1, (L - a) / (b - a)));
    for(let c = 0; c < 3; c++) lut[v * 3 + c] = ca[c] + (cb[c] - ca[c]) * f;
  }
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      const dist = Math.hypot(x - cx, y - cy);
      if(dist > rOut) continue;
      const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if(dist > rIn){
        /* الحافة: فقط الألوان الذهبية/البنية (نتجاهل الشريط الكحلي والخلفية) */
        if(mx === 0 || (mx - mn) / mx < 0.2) continue;
        let hue = mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
        if(hue < 0) hue += 360;
        if(hue < 10 || hue > 70) continue;
      }
      const L = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      d[i] = lut[L * 3]; d[i + 1] = lut[L * 3 + 1]; d[i + 2] = lut[L * 3 + 2];
    }
  }
  ctx.putImageData(img, x0, y0);
}

async function drawCertificate(u){
  const t = certTier(u.rank);
  if(!t) throw new Error('not top 3');
  const timeout = ms => new Promise(r => setTimeout(r, ms));
  try{
    await Promise.race([
      Promise.all([
        document.fonts.load('800 46px Tajawal'), document.fonts.load('800 40px Tajawal'),
        document.fonts.load('500 24px "Noto Naskh Arabic"'), document.fonts.load('700 24px "Noto Naskh Arabic"')
      ]),
      timeout(3000)
    ]);
  }catch(e){}
  const tpl = await Promise.race([certImg('assets/cert/template.jpg'), timeout(20000).then(() => null)]);
  if(!tpl) throw new Error('template');

  const c = document.createElement('canvas');
  c.width = CERT_BASE_W * CERT_SCALE; c.height = CERT_BASE_H * CERT_SCALE;
  const ctx = c.getContext('2d');
  ctx.scale(CERT_SCALE, CERT_SCALE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tpl, 0, 0, CERT_BASE_W, CERT_BASE_H);

  /* ---- الوسام: نحوّل الذهبي إلى فضي / برونزي ---- */
  if(t.ramp) recolorSeal(ctx, t.ramp);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  /* نص الوسام */
  ctx.fillStyle = t.ink;
  ctx.font = `800 31px ${FONT_SANS}`;
  ctx.fillText('المركز', 1350, 214);
  let ws = 46;
  ctx.font = `900 ${ws}px ${FONT_SANS}`;
  while(ctx.measureText(t.word).width > 118 && ws > 30){ ws -= 2; ctx.font = `900 ${ws}px ${FONT_SANS}`; }
  ctx.fillText(t.word, 1350, 258);

  /* ---- اسم الطالب ---- */
  let ns = 50;
  const name = String(u.name || '').trim();
  ctx.font = `800 ${ns}px ${FONT_SANS}`;
  while(ctx.measureText(name).width > 560 && ns > 26){ ns -= 2; ctx.font = `800 ${ns}px ${FONT_SANS}`; }
  ctx.fillStyle = CERT_NAVY;
  ctx.fillText(name, 768, 536);

  /* ---- نص الشهادة ---- */
  const cx = 706;
  const F = `700 27px ${FONT_NASKH}`, FB = `800 28px ${FONT_NASKH}`;
  if(u.monthLabel){
    /* ⭐ شهادة الشهر */
    drawRichLine(ctx, [
      { text: 'وذلك بمناسبة تحقيقه ', font: F, color: CERT_NAVY },
      { text: 'المركز ' + t.word, font: FB, color: t.accent },
      { text: ' في صدارة ', font: F, color: CERT_NAVY },
      { text: 'شهر ' + u.monthLabel, font: FB, color: t.accent },
      { text: '،', font: F, color: CERT_NAVY }
    ], cx, 624);
    ctx.fillStyle = CERT_NAVY;
    fitText(ctx, F, 'تقديرًا لتميّزه الاستثنائي واجتهاده المستمر، وما أظهره من عزيمة وإصرار على بلوغ القمة.', cx, 665);
  } else {
    drawRichLine(ctx, [
      { text: 'وذلك بمناسبة تحقيقه ', font: F, color: CERT_NAVY },
      { text: 'المركز ' + t.word, font: FB, color: t.accent },
      { text: '، تقديرًا لتميّزه الاستثنائي واجتهاده المستمر،', font: F, color: CERT_NAVY }
    ], cx, 624);
    ctx.fillStyle = CERT_NAVY;
    fitText(ctx, F, 'وما أظهره من عزيمة وإصرار على بلوغ القمة.', cx, 665);
  }
  ctx.fillStyle = CERT_NAVY;
  fitText(ctx, F, 'وإننا في منصة عباقرة القدرات، إذ نبارك له هذا الإنجاز المستحق، لنتمنى له دوام التوفيق', cx, 713);
  fitText(ctx, F, 'ومزيدًا من النجاحات والإنجازات في مسيرته العلمية، سائلين الله أن يجعل هذا التفوق', cx, 751);
  fitText(ctx, F, 'بدايةً لمستقبل حافل بالتميّز والعطاء.', cx, 790);

  return c;
}

/* ================== النافذة ================== */
async function openCertificate(userId){
  const list = window._lbUsers || [];
  const u = list.find(x => x.id === userId);
  if(!u){ toast('افتح قائمة المتصدرين أولاً', 'warn'); return; }
  if(!certTier(u.rank) || !(u.xp > 0)){ toast('الشهادة لأول 3 في الصدارة فقط 🏆', 'warn'); return; }
  return showCertificateModal(u);
}
window.openCertificate = openCertificate;

/* ⭐ شهادة محفوظة (شهادات الشهر): { id, name, rank, xp, monthLabel } */
async function showCertificateModal(u){

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
    const fileName = `شهادة-عباقرة-القدرات-${u.monthLabel ? String(u.monthLabel).replace(/\s+/g, '-') + '-' : ''}${String(u.name).replace(/\s+/g, '-')}.png`;
    m.innerHTML = `
      <div class="cert-box">
        <div class="cert-head">
          <b><i class="fas fa-award"></i> ${isMe ? 'شهادتك' : 'شهادة ' + escapeHtml(u.name)} — المركز ${u.rank}${u.monthLabel ? ' • ' + escapeHtml(u.monthLabel) : ''}</b>
          <button class="cert-x" onclick="closeCertificate()"><i class="fas fa-xmark"></i></button>
        </div>
        <img class="cert-img" src="${url}" alt="شهادة ${escapeHtml(u.name)}">
        <div class="cert-actions">
          <a class="btn btn-primary" href="${url}" download="${escapeHtml(fileName)}"><i class="fas fa-download"></i> تحميل الشهادة</a>
          ${navigator.share ? '<button class="btn btn-ghost" id="certShareBtn"><i class="fas fa-share-nodes"></i> مشاركة</button>' : ''}
          <button class="btn btn-ghost" onclick="closeCertificate()">إغلاق</button>
        </div>
        ${isMe ? '<p class="cert-tip"><i class="fas fa-lightbulb"></i> مبروك! 🎉 شهادتك محفوظة في «أبطال الشهر» بصفحة المتصدرين — تقدر ترجع لها أي وقت.</p>' : ''}
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
window.showCertificateModal = showCertificateModal;

function closeCertificate(){
  const m = document.getElementById('certModal');
  if(m) m.classList.remove('open');
}
window.closeCertificate = closeCertificate;

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeCertificate(); });
