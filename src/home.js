import { $, AR, day, norm } from './util.js';
import { Q } from './data.js';
import { S, mem, isDue } from './state.js';

let filter = 'all';
export const setFilter = f => { filter = f };

export function renderSummary() {
  let ay = 0, done = 0;
  Q.forEach((c, k) => { const m = mem(k + 1); ay += m; if (m === c.v.length) done++ });
  $('sAyat').textContent = AR(ay);
  $('sBar').style.width = (ay / 6236 * 100).toFixed(2) + '%';
  $('sSurahs').textContent = AR(done) + ' من ١١٤';
  $('sToday').textContent = AR(S.n) + ' / ' + AR(S.goal);
  $('sStreak').textContent = AR((S.last === day() || S.last === day(-1)) ? S.streak : 0);
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
