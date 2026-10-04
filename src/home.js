import { $, AR, day, norm } from './util.js';
import { Q } from './data.js';
import { S, activeKid, mem, isDue, weakList } from './state.js';

let filter = 'all';
export const setFilter = f => { filter = f };

/** What Rafiq says to the child, depending on how the day is going. */
export function moodText(ayat, goal, doneToday, dueCount, weakCount) {
  if (doneToday >= goal) return 'ما شاء الله! خلّصتَ وردك اليوم 🎉';
  if (dueCount) return 'عندك ' + (dueCount === 1 ? 'سورة' : AR(dueCount) + ' سور') + ' تنتظر المراجعة 🔁';
  if (weakCount) return 'تعال نثبّت الآيات اللي تحتاج تثبيتًا 💪';
  if (doneToday > 0) return 'أحسنت! باقي ' + AR(goal - doneToday) + ' للورد 🌟';
  return ayat ? 'جاهز لورد اليوم؟ يلا! 😄' : 'يلا نبدأ أول آية معًا! 🌱';
}

export function renderSummary() {
  let ay = 0, done = 0;
  Q.forEach((c, k) => { const m = mem(k + 1); ay += m; if (m === c.v.length) done++ });
  $('sAyat').textContent = AR(ay);
  // a visible sliver as soon as there is any progress, so a young child sees that something counts
  $('sBar').style.width = (ay ? Math.max(3, ay / 6236 * 100) : 0).toFixed(2) + '%';
  $('sSurahs').textContent = AR(done) + ' من ١١٤';
  $('sToday').textContent = AR(S.n) + ' / ' + AR(S.goal);
  $('sStreak').textContent = AR((S.last === day() || S.last === day(-1)) ? S.streak : 0);
  const dueCount = Q.filter((_, i) => isDue(i + 1)).length;
  $('bubble').textContent = moodText(ay, S.goal, S.n, dueCount, weakList().length);
  const k = activeKid();
  $('greet').textContent = k ? 'أهلًا يا ' + k.name + ' ' + k.icon : 'أهلًا بك!';
  // today's goal as star slots (at most 10 shown); the exact numbers are in the text next to them
  const slots = Math.min(S.goal, 10), filled = Math.min(S.n, slots), g = $('goalStars'); g.textContent = '';
  for (let i = 0; i < slots; i++) { const s = document.createElement('span'); s.textContent = i < filled ? '⭐' : '☆'; g.appendChild(s) }
}

export function renderList() {
  const q = norm($('q').value), ul = $('list'); ul.textContent = '';
  let shown = 0;
  Q.forEach((c, k) => {
    const id = k + 1, tot = c.v.length, m = mem(id), due = isDue(id);
    if (q && !norm(c.n).includes(q) && String(id) !== q && AR(id) !== q) return;
    if (filter === 'due' && !due) return;
    if (filter === 'doing' && !(m > 0 && m < tot)) return;
    if (filter === 'done' && m !== tot) return;
    shown++;
    const li = document.createElement('li');
    li.innerHTML = '<button type="button" class="row" data-id="' + id + '">' +
      '<span class="num"><span>' + AR(id) + '</span></span>' +
      '<span><span class="name">سورة ' + c.n + '</span><br><span class="meta">' + (c.t ? 'مدنية' : 'مكية') + ' · ' + AR(tot) + ' آية</span>' +
      (m ? '<span class="bar"><i style="width:' + (m / tot * 100) + '%"></i></span>' : '') + '</span>' +
      '<span class="side">' + (m ? AR(m) + ' / ' + AR(tot) : '') +
      (due ? '<span class="pill due">مراجعة اليوم</span>' : m === tot ? '<span class="pill done">مكتملة</span>' : '') + '</span></button>';
    ul.appendChild(li);
  });
  if (!shown) {
    const msg = {
      due: 'لا توجد مراجعات مستحقة اليوم. تظهر هنا كل سورة حفظتَ منها عند حلول موعد مراجعتها.',
      doing: 'لم تبدأ حفظ أي سورة بعد. افتح سورة وعلّم الآيات التي تحفظها.',
      done: 'لا توجد سور مكتملة بعد.', all: 'لا توجد سورة بهذا الاسم.'
    }[q ? 'all' : filter];
    ul.innerHTML = '<li class="empty"></li>'; ul.firstChild.textContent = msg;
  }
}
