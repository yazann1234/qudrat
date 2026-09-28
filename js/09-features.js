/* ============================================================
   09) FEATURES — صفحة المزايا
============================================================ */

function renderFeatures(){
  const grid = $('#featGrid'); if(!grid) return;
  grid.innerHTML = FEATURES.map((f, i) => `
    <div class="feat-new" style="--fc:${f.c}">
      <span class="num-badge">${String(i+1).padStart(2,'0')}</span>
      <div class="fi"><i class="fas ${f.i}"></i></div>
      <h3>${f.t}</h3>
      <p>${f.d}</p>
    </div>`).join('');
  const fc = $('#featCount'); if(fc) fc.textContent = FEATURES.length;
  const ft = $('#featHeroTitle');
  if(ft) ft.textContent = `${FEATURES.length} ميزة احترافية صُمّمت لتُحسّن رحلتك الدراسية`;
}
