// "إنجازاتي": what the child has done, the latest and the nearest medals (each with its reason and day), the surahs they
// finished with their certificates, and the star shop. The full set of medals is a page of its own.
import { $, AR, ayahs, el, icon } from './util.js';
import { Q } from './data.js';
import { mem, activeKid, gameStars, starBalance } from './state.js';
import { badgeList, badgeStatus, totals, progressText, whenText } from './medals.js';

/** Surahs the active child has memorised completely. */
export const completed = () => Q.map((c, k) => k + 1).filter(id => mem(id) === Q[id - 1].v.length);

const TABS = [['achievements', 'إنجازاتي', 'trophy'], ['medals', 'كل الأوسمة', 'medal'], ['shop', 'المتجر', 'bag']];
/** The strip at the top of the three pages that belong together (achievements, all medals, the shop). */
export function renderAchTabs() {
  document.querySelectorAll('.achtabs').forEach(nav => {
    nav.textContent = '';
    const page = nav.closest('.page').dataset.page;
    TABS.forEach(([id, label, ic]) => {
      const a = el('a', 'chip'); a.href = '#/' + id; a.append(icon(ic), label);
      if (id === page) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
  });
}

/** A round medal picture: the sprite icon, gold when earned, quiet grey when not. */
export const medalPic = b => { const m = el('span', 'medal' + (b.got ? ' on' : '')); m.setAttribute('aria-hidden', 'true'); m.appendChild(icon(b.ic)); return m };

function medalRow(b, kind) {
  const li = el('li', 'medalrow' + (b.got ? ' on' : ''));
  const text = el('span', 'mtext');
  text.append(el('b', '', b.name));
  if (b.got) text.append(el('small', '', b.why + ' · ' + whenText(b)));
  else {
    text.append(el('small', '', b.need));
    if (kind !== 'plain') {
      const bar = el('span', 'mbar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'تقدّم وسام ' + b.name);
      bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(b.n)); bar.setAttribute('aria-valuenow', String(b.v));
      const i = el('i'); i.style.width = Math.round(b.ratio * 100) + '%'; bar.appendChild(i); text.appendChild(bar);
      text.append(el('small', 'mprog', progressText(b)));
    }
  }
  li.append(medalPic(b), text);
  if (!b.got) li.appendChild(el('span', 'sr', 'لم يُفتح بعد'));
  return li;
}

export function renderAchievements() {
  renderAchTabs();
  const k = activeKid(); if (!k || !Q.length) return;
  const t = totals(), st = badgeStatus();

  // the numbers, as they really are
  const sum = $('achSummary'); sum.textContent = '';
  const tile = (n, label) => { const d = el('div', 'achtile'); d.append(el('b', '', n), el('span', '', label)); return d };
  sum.append(tile(AR(t.ay), 'آية محفوظة'), tile(AR(t.done) + ' من ١١٤', 'سورة مكتملة'), tile(AR(t.streak), 'أيام متتالية'));
  const games = el('p', 'note achgames'); games.append(icon('gamepad'), 'نجوم الألعاب: ' + AR(gameStars()) + ' (رصيدك للمتجر ' + AR(starBalance()) + '). هي نجوم داخل التطبيق، منفصلة عن الحفظ، ولا علاقة لها بالمال.');
  sum.appendChild(games);

  const latest = $('achLatest'); latest.textContent = '';
  latest.appendChild(el('h2', '', 'آخر ما حصلتَ عليه'));
  if (!st.latest.length) latest.appendChild(el('p', 'note', 'لم تحصل على أي وسام بعد. ابدأ بجلسة قصيرة وسيأتيك أول وسام.'));
  else { const ul = el('ul', 'medallist'); st.latest.slice(0, 3).forEach(b => ul.appendChild(medalRow(b, 'plain'))); latest.appendChild(ul) }

  const next = $('achNext'); next.textContent = '';
  next.appendChild(el('h2', '', 'الأقرب إليك'));
  if (!st.nextList.length) next.appendChild(el('p', 'good', 'ما شاء الله، حصلتَ على كل الأوسمة.'));
  else { const ul = el('ul', 'medallist'); st.nextList.slice(0, 3).forEach(b => ul.appendChild(medalRow(b, 'progress'))); next.appendChild(ul) }
  const all = el('a', 'btn', 'كل الأوسمة (' + AR(st.got.length) + ' من ' + AR(badgeList().length) + ')'); all.href = '#/medals'; next.appendChild(all);

  const box = $('achSurahs'); box.textContent = '';
  box.appendChild(el('h2', '', 'السور التي أتممتَ حفظها'));
  const done = completed();
  if (!done.length) { box.appendChild(el('p', 'note', 'لم تُتمّ أي سورة بعد. خطوة بخطوة. عند إتمام سورة كاملة تظهر هنا مع شهادة يمكنك طباعتها.')); return }
  const ul = el('ul', 'links');
  done.forEach(id => {
    const li = el('li', 'certrow'), a = el('a', 'btn', 'شهادة'); a.href = '#/certificate/' + id;
    li.append(el('span', '', 'سورة ' + Q[id - 1].n + ' · ' + ayahs(Q[id - 1].v.length)), a); ul.appendChild(li);
  });
  box.appendChild(ul);
}

/** The page with every medal, earned ones first with their day, then the rest with what they ask for. */
export function renderMedalsPage() {
  renderAchTabs();
  const box = $('medalGrid'); box.textContent = '';
  if (!activeKid() || !Q.length) return;
  const list = badgeList(), got = list.filter(b => b.got), rest = list.filter(b => !b.got);
  box.appendChild(el('p', 'note', 'حصلتَ على ' + AR(got.length) + ' من ' + AR(list.length) + ' وسامًا. لكل وسام سببه الواضح، ولا يُمنح وسام بلا عمل.'));
  const sec = (title, items, kind) => {
    if (!items.length) return;
    const s = el('section', 'today'); s.appendChild(el('h2', '', title));
    const ul = el('ul', 'medallist'); items.forEach(b => ul.appendChild(medalRow(b, kind))); s.appendChild(ul); box.appendChild(s);
  };
  sec('حصلتَ عليها', got, 'plain'); sec('لم تفتحها بعد', rest.sort((a, b) => b.ratio - a.ratio), 'progress');
}

/** Fills the printable certificate for a completed surah. Returns false if the surah is not complete. */
export function renderCertificate(id) {
  const c = Q[id - 1], k = activeKid();
  if (!c || !k || mem(id) !== c.v.length) return false;
  const box = $('cert'); box.textContent = '';
  const date = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  box.append(
    el('p', 'cert-brand', 'رفيق الحفظ'),
    el('h1', 'cert-title', 'شهادة إتمام حفظ'),
    el('p', 'cert-line', 'تشهد منصة رفيق الحفظ بأن'),
    el('p', 'cert-name', k.icon + ' ' + k.name),
    el('p', 'cert-line', 'قد أتمّ حفظ'),
    el('p', 'cert-surah', 'سورة ' + c.n),
    el('p', 'cert-line', 'وهي ' + ayahs(c.v.length) + '. ما شاء الله، بارك الله فيه.'),
    el('p', 'cert-date', 'التاريخ: ' + date));
  return true;
}
