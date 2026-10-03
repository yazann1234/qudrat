/* ============================================================
   26) ADHKAR — الأذكار
============================================================ */

const ADHKAR_DATA = {
  morning: {
    title: 'أذكار الصباح',
    icon: 'fa-sun',
    color: '#f59e0b',
    items: [
      { text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَٰهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', count: 1, fadl: 'من قالها حين يصبح فقد أدى شكر يومه' },
      { text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ', count: 1, fadl: 'دعاء النبي ﷺ عند الصباح' },
      { text: 'اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَٰهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ', count: 1, fadl: 'سيد الاستغفار — من قالها موقنًا بها حين يصبح فمات من يومه دخل الجنة' },
      { text: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالإِسْلاَمِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا', count: 3, fadl: 'كان حقًا على الله أن يرضيه يوم القيامة' },
      { text: 'بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', count: 3, fadl: 'لم يضره شيء' },
      { text: 'حَسْبِيَ اللَّهُ لاَ إِلَٰهَ إِلاَّ هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ', count: 7, fadl: 'كفاه الله ما أهمه' },
      { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', count: 100, fadl: 'حُطَّت خطاياه وإن كانت مثل زبد البحر' },
      { text: 'لاَ إِلَٰهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', count: 10, fadl: 'عِدل عشر رقاب' }
    ]
  },
  evening: {
    title: 'أذكار المساء',
    icon: 'fa-moon',
    color: '#6366f1',
    items: [
      { text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَٰهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', count: 1, fadl: 'من قالها حين يمسي فقد أدى شكر ليلته' },
      { text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ', count: 1, fadl: 'دعاء النبي ﷺ عند المساء' },
      { text: 'اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَٰهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ', count: 1, fadl: 'سيد الاستغفار — من قالها موقنًا بها حين يمسي فمات من ليلته دخل الجنة' },
      { text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', count: 3, fadl: 'لم تضره حُمَة تلك الليلة' },
      { text: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَٰهَ إِلاَّ أَنْتَ', count: 3, fadl: 'من قالها حفظه الله' },
      { text: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', count: 100, fadl: 'لم يأت أحد يوم القيامة بأفضل مما جاء به' }
    ]
  },
  beforeStudy: {
    title: 'أذكار قبل المذاكرة',
    icon: 'fa-book-open',
    color: '#22c55e',
    items: [
      { text: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِنْ لِسَانِي يَفْقَهُوا قَوْلِي', count: 1, fadl: 'دعاء موسى عليه السلام — لطلب الفهم والتيسير' },
      { text: 'اللَّهُمَّ لاَ سَهْلَ إِلاَّ مَا جَعَلْتَهُ سَهْلاً، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلاً', count: 1, fadl: 'تيسير الصعب' },
      { text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلاً مُتَقَبَّلاً', count: 1, fadl: 'طلب العلم النافع' },
      { text: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلاَ إِلَٰهَ إِلاَّ اللَّهُ، وَاللَّهُ أَكْبَرُ', count: 1, fadl: 'الباقيات الصالحات' },
      { text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', count: 1, fadl: 'الاستعانة بالله في كل أمر' }
    ]
  },
  beforeSleep: {
    title: 'أذكار قبل النوم',
    icon: 'fa-bed',
    color: '#8b5cf6',
    items: [
      { text: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', count: 1, fadl: 'دعاء النوم' },
      { text: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ', count: 3, fadl: 'من قالها حين يضع جنبه للفراش' },
      { text: 'سُبْحَانَ اللَّهِ', count: 33, fadl: 'تسبيح فاطمة رضي الله عنها' },
      { text: 'الْحَمْدُ لِلَّهِ', count: 33, fadl: 'تسبيح فاطمة رضي الله عنها' },
      { text: 'اللَّهُ أَكْبَرُ', count: 34, fadl: 'تسبيح فاطمة رضي الله عنها' },
      { text: 'آيَةُ الْكُرْسِيِّ', count: 1, fadl: 'من قرأها عند نومه لم يزل عليه حافظ من الله' }
    ]
  }
};

let adhkarState = {
  currentCategory: 'morning',
  counters: {}
};

/* ================== عرض قسم الأذكار ================== */
function renderAdhkarSection(){
  const container = document.getElementById('adhkarContent');
  if(!container) return;

  const cat = ADHKAR_DATA[adhkarState.currentCategory];
  if(!cat) return;

  container.innerHTML = `
    <div class="adhkar-cat-header">
      <div class="adhkar-cat-icon" style="background:${cat.color}20;color:${cat.color}">
        <i class="fas ${cat.icon}"></i>
      </div>
      <h3>${cat.title}</h3>
    </div>
    <div class="adhkar-list">
      ${cat.items.map((item, i) => {
        const key = adhkarState.currentCategory + '_' + i;
        const current = adhkarState.counters[key] || 0;
        const done = current >= item.count;
        return `
          <div class="adhkar-item ${done ? 'done' : ''}" data-key="${key}" data-max="${item.count}">
            <div class="adhkar-text">${item.text}</div>
            ${item.fadl ? `<div class="adhkar-fadl"><i class="fas fa-star"></i> ${item.fadl}</div>` : ''}
            <div class="adhkar-footer">
              <button class="adhkar-count-btn" onclick="incrementAdhkar('${key}', ${item.count})">
                <i class="fas fa-hand-pointer"></i>
                <span class="adhkar-counter">${current}</span> / ${item.count}
              </button>
              ${done ? '<span class="adhkar-done-badge"><i class="fas fa-check"></i> تم</span>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* ================== زيادة العداد ================== */
window.incrementAdhkar = (key, max) => {
  adhkarState.counters[key] = (adhkarState.counters[key] || 0) + 1;

  if(adhkarState.counters[key] > max){
    adhkarState.counters[key] = 0;
    renderAdhkarSection();
    return;
  }

  /* +2 XP لكل ذكر */
  if(adhkarState.counters[key] <= max){
    userData.extraXp = (userData.extraXp || 0) + 2;
    savePrefs();
  }

  if(adhkarState.counters[key] === max){
    toast('🌸 تقبل الله', 'ok');
  }

  renderAdhkarSection();
};

/* ================== تبديل الفئة ================== */
function switchAdhkarCategory(cat){
  adhkarState.currentCategory = cat;
  document.querySelectorAll('.adhkar-tab').forEach(t => {
    t.classList.toggle('on', t.dataset.cat === cat);
  });
  renderAdhkarSection();
}
window.switchAdhkarCategory = switchAdhkarCategory;

/* ================== تهيئة ================== */
document.addEventListener('DOMContentLoaded', () => {
  renderAdhkarSection();
});
