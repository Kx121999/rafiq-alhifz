import { $, ayahs, el } from './util.js';
import { Q } from './data.js';
import { mem, activeKid } from './state.js';
import { renderRewards } from './kids.js';

/** Surahs the active child has memorised completely. */
export const completed = () => Q.map((c, k) => k + 1).filter(id => mem(id) === Q[id - 1].v.length);

export function renderAchievements() {
  renderRewards('achRewards');
  const box = $('achSurahs'); box.textContent = '';
  if (!Q.length) return;
  box.appendChild(el('h3', '', 'السور التي أتممتَ حفظها'));
  const done = completed();
  if (!done.length) { box.appendChild(el('p', 'note', 'لم تُتمّ أي سورة بعد. عند إتمام سورة كاملة تظهر هنا مع شهادة يمكنك طباعتها.')); return }
  const ul = el('ul', 'links');
  done.forEach(id => {
    const li = el('li', 'certrow'), a = el('a', 'btn', 'شهادة'); a.href = '#/certificate/' + id;
    li.append(el('span', '', 'سورة ' + Q[id - 1].n + ' · ' + ayahs(Q[id - 1].v.length)), a); ul.appendChild(li);
  });
  box.appendChild(ul);
}

/** Fills the printable certificate for a completed surah. Returns false if the surah is not complete. */
export function renderCertificate(id) {
  const c = Q[id - 1], k = activeKid();
  if (!c || !k || mem(id) !== c.v.length) return false;
  const box = $('cert'); box.textContent = '';
  const date = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  box.append(
    el('p', 'cert-brand', 'رفيق الحفظ'),
    el('h2', 'cert-title', 'شهادة إتمام حفظ'),
    el('p', 'cert-line', 'تشهد منصة رفيق الحفظ بأن'),
    el('p', 'cert-name', k.icon + ' ' + k.name),
    el('p', 'cert-line', 'قد أتمّ حفظ'),
    el('p', 'cert-surah', 'سورة ' + c.n),
    el('p', 'cert-line', 'وهي ' + ayahs(c.v.length) + '. ما شاء الله، بارك الله فيه.'),
    el('p', 'cert-date', 'التاريخ: ' + date));
  return true;
}
