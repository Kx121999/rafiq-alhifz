import { $, AR, ayahs, el, charImg } from './util.js';
import { Q } from './data.js';
import { mem, isDue, kidPlan, lastSurah, weakList, azToday, friendOf } from './state.js';
import { azNow, tabOf } from './azmeta.js';
import { ramadanLine } from './ramadan.js';
import { planStats } from './plan.js';

const link = (href, text, cls = 'btn') => { const a = el('a', cls, text); a.href = href; return a };

/** "Today" card on the dashboard: continue, reviews due, plan target, or a nudge to start. */
export function renderToday() {
  const box = $('today'); box.textContent = '';
  if (!Q.length) return;
  const due = [], doing = [];
  Q.forEach((c, k) => { const id = k + 1, m = mem(id); if (isDue(id)) due.push(id); else if (m > 0 && m < c.v.length) doing.push(id) });
  const ram = ramadanLine(); if (ram) box.appendChild(ram);
  const hd = el('div', 'todayhead'); hd.append(el('h2', '', 'اليوم'), charImg(friendOf(), 'mini')); box.appendChild(hd);

  const last = lastSurah(), p = kidPlan(), st = p && planStats(p);
  const acts = el('div', 'acts');
  const az = tabOf(azNow()), azDone = azToday(az.key).d;
  acts.appendChild(link('#/adhkar/' + az.key, azDone ? '✓ أنهيتَ ' + az.title + ' اليوم' : az.icon + ' ' + az.title, azDone ? 'btn' : 'btn primary'));
  if (last) acts.appendChild(link('#/surah/' + last, 'كمّل من حيث وقفت: سورة ' + Q[last - 1].n, 'btn primary'));
  if (due.length) acts.appendChild(link('#/review', 'ابدأ المراجعة (' + AR(due.length) + ')', last ? 'btn' : 'btn primary'));
  const weak = weakList().length;
  if (weak) acts.appendChild(link('#/review', 'ثبّت الآيات الضعيفة (' + AR(weak) + ')', 'btn'));
  if (acts.children.length) box.appendChild(acts);

  if (st && st.left > 0) {
    box.appendChild(el('p', 'note', 'خطتك (' + st.pr.name + '): ورد اليوم ' + ayahs(st.daily) + '، والسورة التالية: ' + Q[st.next - 1].n + '.'));
    box.appendChild(link('#/surah/' + st.next, 'افتح سورة ' + Q[st.next - 1].n));
  } else if (!st) box.appendChild(link('#/plan', 'ضع خطة حفظ'));

  const list = el('ul', 'links');
  doing.filter(id => id !== last).slice(0, 3).forEach(id => {
    const li = el('li'); li.appendChild(link('#/surah/' + id, 'سورة ' + Q[id - 1].n + ' · أكمل الحفظ (' + AR(mem(id)) + ' من ' + AR(Q[id - 1].v.length) + ')')); list.appendChild(li);
  });
  if (list.children.length) box.appendChild(list);
  if (!last && !due.length && !doing.length) {
    box.appendChild(el('p', 'note', 'لم تبدأ حفظ أي سورة بعد. اختر سورة من المصحف وعلّم الآيات التي تحفظها.'));
    box.appendChild(link('#/mushaf', 'ابدأ الحفظ', 'btn primary'));
  }
}
