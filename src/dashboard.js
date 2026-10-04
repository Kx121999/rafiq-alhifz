import { $, AR } from './util.js';
import { Q } from './data.js';
import { mem, isDue } from './state.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e };

/** "Today" card on the dashboard: surahs due for review, or a nudge to start. */
export function renderToday() {
  const box = $('today'); box.textContent = '';
  if (!Q.length) return;
  const due = [], doing = [];
  Q.forEach((c, k) => { const id = k + 1, m = mem(id); if (isDue(id)) due.push(id); else if (m > 0 && m < c.v.length) doing.push(id) });
  box.appendChild(el('h3', '', 'اليوم'));
  const list = el('ul', 'links');
  const link = (id, note) => {
    const li = el('li'), a = el('a', 'btn', 'سورة ' + Q[id - 1].n + ' · ' + note); a.href = '#/surah/' + id; li.appendChild(a); list.appendChild(li);
  };
  due.slice(0, 5).forEach(id => link(id, 'مراجعة اليوم'));
  doing.slice(0, 3).forEach(id => link(id, 'أكمل الحفظ (' + AR(mem(id)) + ' من ' + AR(Q[id - 1].v.length) + ')'));
  if (list.children.length) box.appendChild(list);
  else {
    box.appendChild(el('p', 'note', 'لم تبدأ حفظ أي سورة بعد. اختر سورة من المصحف وعلّم الآيات التي تحفظها.'));
    const a = el('a', 'btn primary', 'ابدأ الحفظ'); a.href = '#/mushaf'; box.appendChild(a);
  }
}
