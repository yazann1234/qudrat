/* ============================================================
   04) THEME — إدارة الثيمات (نسخة نظيفة)
============================================================ */

function isDark(){
  try{
    if(!userData) return false;
    if(userData.darkMode === 'dark') return true;
    if(userData.darkMode === 'auto') return !!(darkQuery && darkQuery.matches);
    return false;
  }catch(e){ return false; }
}

function applyTheme(){
  try{
    if(!userData) userData = defaultUD();
    const t = THEMES.find(x => x.id === userData.theme) || THEMES[0];
    const root = document.documentElement;

    root.style.setProperty('--primary', t.c1);
    root.style.setProperty('--primary-2', t.c2);
    root.style.setProperty('--primary-rgb', t.rgb);

    const dark = isDark();
    if(dark){
      root.setAttribute('data-theme','dark');
      root.style.setProperty('--primary-soft', `color-mix(in srgb, ${t.c1} 15%, #111a2f)`);
    } else {
      root.removeAttribute('data-theme');
      root.style.setProperty('--primary-soft', `color-mix(in srgb, ${t.c1} 10%, #ffffff)`);
    }

    root.style.setProperty('--fs', userData.font || 1);
    document.body.classList.toggle('no-anim', !!userData.reduceMotion);

    const tb = document.getElementById('themeBtn');
    if(tb) tb.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

    const mc = document.querySelector('meta[name="theme-color"]');
    if(mc) mc.setAttribute('content', dark ? '#070c19' : '#eef1fa');

    if(typeof drawTimerDial === 'function'){ try{ drawTimerDial(); }catch(e){} }
    if(typeof renderHomeStats === 'function'){ try{ renderHomeStats(); }catch(e){} }
    if(typeof renderThemesGrid === 'function'){ try{ renderThemesGrid(); }catch(e){} }
    if(typeof syncSettingsUI === 'function'){ try{ syncSettingsUI(); }catch(e){} }
  }catch(e){
    console.warn('applyTheme error:', e);
  }
}

function renderThemesGrid(){
  try{
    const grid = document.getElementById('themesGrid');
    if(!grid) return;
    if(typeof THEMES === 'undefined' || !userData) return;

    grid.innerHTML = THEMES.map(t => `
      <div class="theme-swatch ${t.id === userData.theme ? 'on' : ''}" data-theme-id="${t.id}">
        <div class="sw-bg" style="--c1:${t.c1};--c2:${t.c2}"></div>
        <div class="sw-check"><i class="fas fa-check"></i></div>
        <div class="sw-name">${t.name}</div>
      </div>`).join('');

    grid.querySelectorAll('.theme-swatch').forEach(el => {
      el.addEventListener('click', () => {
        userData.theme = el.dataset.themeId;
        savePrefs();
        applyTheme();
        toast('تم تغيير الثيم بنجاح', 'ok');
      });
    });
  }catch(e){ console.warn('renderThemesGrid error:', e); }
}

function syncSettingsUI(){
  try{
    if(!userData) return;
    const q = id => document.getElementById(id);

    const modeSeg = q('modeSeg');
    if(modeSeg) modeSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === userData.darkMode));

    const fontSeg = q('fontSeg');
    if(fontSeg) fontSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseFloat(b.dataset.f) === userData.font));

    const readSeg = q('readThemeSeg');
    if(readSeg) readSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === userData.readTheme));

    const snapSeg = q('snapSeg');
    if(snapSeg) snapSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.s === '1') === !!userData.snap));

    const zoomSeg = q('zoomSeg');
    if(zoomSeg) zoomSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseFloat(b.dataset.z) === (userData.defaultZoom||1)));

    const focusSeg = q('focusSeg');
    if(focusSeg) focusSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.m,10) === (userData.focus||25)));

    const brkSeg = q('breakSeg');
    if(brkSeg) brkSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.m,10) === (userData.brk||5)));

    const longSeg = q('longSeg');
    if(longSeg) longSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.m,10) === (userData.longBrk||15)));

    const sa = q('setAnim'); if(sa) sa.checked = !!userData.reduceMotion;
    const sm = q('setMarks'); if(sm) sm.checked = !!userData.showMarks;
    const sr = q('setResume'); if(sr) sr.checked = !!userData.autoResume;
    const sAuto = q('setAuto'); if(sAuto) sAuto.checked = !!userData.autoStart;
    const sSound = q('setSound'); if(sSound) sSound.checked = !!userData.sound;

    const gp = q('goalPagesRange');
    if(gp){ gp.value = userData.goalPages; const v = q('goalPagesVal'); if(v) v.textContent = userData.goalPages; }
    const gm = q('goalMinRange');
    if(gm){ gm.value = userData.goalMinutes; const v = q('goalMinVal'); if(v) v.textContent = userData.goalMinutes; }
    const gt = q('goalTarget'); if(gt) gt.textContent = userData.goalPages;
  }catch(e){ console.warn('syncSettingsUI error:', e); }
}

if(darkQuery){
  const handler = () => { if(userData && userData.darkMode === 'auto') applyTheme(); };
  if(darkQuery.addEventListener) darkQuery.addEventListener('change', handler);
  else if(darkQuery.addListener) darkQuery.addListener(handler);
}

document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('themeBtn');
  if(themeBtn){
    themeBtn.addEventListener('click', () => {
      if(!userData) return;
      userData.darkMode = isDark() ? 'light' : 'dark';
      savePrefs();
      applyTheme();
      toast(isDark() ? 'الوضع الداكن مُفعّل' : 'الوضع الفاتح مُفعّل', 'ok');
    });
  }
});
