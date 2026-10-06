import { $, AR, el, icon, norm } from './util.js';
import { Q } from './data.js';
import { mem, isDue, readPos, bookmarks, pinned } from './state.js';

let filter = 'all';
export const setFilter = f => { filter = f };

const MODE_NAME = { read: 'قراءة', listen: 'استماع', memorise: 'حفظ', recite: 'تسميع' };

/** The top of the mushaf page: where the child stopped, bookmarks and pinned surahs. Nothing is shown for a child who has none of them. */
export function renderMushafTop() {
  const box = $('mushafNow'); box.textContent = '';
  if (!Q.length) { box.hidden = true; return }
  const pos = readPos(), bm = bookmarks(), pins = pinned();
  box.hidden = !pos && !bm.length && !pins.length;
  if (box.hidden) return;
  if (pos) {
    const a = el('a', 'resume'); a.href = '#/surah/' + pos.id;
    const t = el('span'); t.append(el('b', '', 'تابع من حيث توقفت'), el('small', '', 'سورة ' + Q[pos.id - 1].n + ' · الآية ' + AR(pos.i + 1) + ' · ' + MODE_NAME[pos.mode]));
    a.append(icon('book'), t, icon('chevleft', 'chev')); box.appendChild(a);
  }
  const chips = (title, ic, items) => {
    if (!items.length) return;
    const row = el('div', 'nowrow'), h = el('h2'); h.append(icon(ic), title); row.appendChild(h);
    const list = el('ul'); items.forEach(([href, text]) => { const li = el('li'), a2 = el('a', 'chip', text); a2.href = href; li.appendChild(a2); list.appendChild(li) });
    row.appendChild(list); box.appendChild(row);
  };
  chips('علاماتي', 'bookmark', bm.map(r => { const [id, n] = r.split('.').map(Number); return ['#/surah/' + id + '/' + n, 'سورة ' + Q[id - 1].n + ' · آية ' + AR(n)] }));
  chips('السور المثبّتة', 'flag', pins.map(id => ['#/surah/' + id, 'سورة ' + Q[id - 1].n]));
}

export function renderList() {
  const q = norm($('q').value), ul = $('list'), pins = pinned(); ul.textContent = '';
  let shown = 0;
  Q.forEach((c, k) => {
    const id = k + 1, tot = c.v.length, m = mem(id), due = isDue(id);
    if (q && !norm(c.n).includes(q) && String(id) !== q && AR(id) !== q) return;
    if (filter === 'due' && !due) return;
    if (filter === 'pinned' && !pins.includes(id)) return;
    if (filter === 'doing' && !(m > 0 && m < tot)) return;
    if (filter === 'done' && m !== tot) return;
    shown++;
    const li = document.createElement('li');
    li.innerHTML = '<button type="button" class="row" data-id="' + id + '">' +
      '<span class="num"><span>' + AR(id) + '</span></span>' +
      '<span><span class="name">سورة ' + c.n + '</span><br><span class="meta">' + (c.t ? 'مدنية' : 'مكية') + ' · ' + AR(tot) + ' آية</span>' +
      (m ? '<span class="bar"><i style="width:' + (m / tot * 100) + '%"></i></span>' : '') + '</span>' +
      '<span class="side">' + (m ? AR(m) + ' من ' + AR(tot) : '') +
      (pins.includes(id) ? '<span class="pill">مثبّتة</span>' : '') + (due ? '<span class="pill due">مراجعة اليوم</span>' : m === tot ? '<span class="pill done">مكتملة</span>' : '') + '</span></button>';
    ul.appendChild(li);
  });
  if (!shown) {
    const msg = {
      pinned: 'لا توجد سور مثبّتة. افتح سورة واضغط «تثبيت السورة» لتظهر هنا.',
      due: 'لا توجد مراجعات مستحقة اليوم. تظهر هنا كل سورة حفظتَ منها عند حلول موعد مراجعتها.',
      doing: 'لم تبدأ حفظ أي سورة بعد. افتح سورة وعلّم الآيات التي تحفظها.',
      done: 'لا توجد سور مكتملة بعد.', all: 'لا توجد سورة بهذا الاسم.'
    }[q ? 'all' : filter];
    ul.innerHTML = '<li class="empty"></li>'; ul.firstChild.textContent = msg;
  }
}
