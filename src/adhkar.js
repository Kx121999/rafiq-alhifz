// The adhkar page: tabs for morning, evening, sleep, waking and after prayer, plus every other category of Hisn al-Muslim.
// The texts come from public/adhkar.json exactly as they are and are only ever shown with textContent. A tap counter
// per dhikr, saved per child and per day (see azSave in state.js), and a small celebration when a list is finished.
import { $, AR, el, norm } from './util.js';
import { loadAdhkar } from './data.js';
import { azToday, azSave } from './state.js';
import { celebrate, markPop } from './motion.js';
import { AZ_TABS, tabOf, azNow, COUNT_FIX } from './azmeta.js';

let token = 0, lastArg;

const ALL = { key: 'all', label: 'كل الأذكار', icon: '📚' };
const times = n => n === 1 ? 'ذكر واحد' : n === 2 ? 'ذكران' : n <= 10 ? AR(n) + ' أذكار' : AR(n) + ' ذكرًا';

function tabsBar(active) {
  const nav = $('azTabs'); nav.textContent = '';
  [...AZ_TABS, ALL].forEach(t => {
    const a = el('a', 'chip aztab'); a.href = '#/adhkar/' + t.key;
    const icon = el('span', '', t.icon); icon.setAttribute('aria-hidden', 'true');
    a.append(icon, el('span', '', t.label));
    if (t.key !== 'all' && azToday(t.key).d) { const ok = el('span', 'azok', '✓'); ok.setAttribute('aria-hidden', 'true'); a.append(ok, el('span', 'sr', 'تمّ اليوم')) }
    if (t.key === active) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
}

/** One list of adhkar with its counters. key is the progress key, title what the heading says. */
function showList(box, key, cat, title, back) {
  const entries = cat.array.map(a => ({ text: a.text, n: COUNT_FIX[cat.id + '.' + a.id] || a.count }));
  const saved = azToday(key), counts = entries.map((e, i) => Math.min(saved.c[i] || 0, e.n));
  const doneN = () => entries.filter((e, i) => counts[i] >= e.n).length;
  let finished = doneN() === entries.length;

  const head = el('section', 'azhead');
  if (back) { const b = el('a', 'btn', '→ كل الأذكار'); b.href = '#/adhkar/all'; head.appendChild(b) }
  const h = el('h2', '', title);
  const bar = el('div', 'bar'), fill = el('i'); bar.appendChild(fill);
  const prog = el('p', 'note azprog');
  const reset = el('button', 'btn', 'ابدأ من جديد'); reset.type = 'button';
  head.append(h, bar, prog, reset);

  const ol = el('ol', 'azlist');
  const cards = entries.map((e, i) => {
    const li = el('li', 'azcard');
    const text = el('p', 'azt', e.text);
    const row = el('div', 'azrow');
    const btn = el('button', 'azbtn'); btn.type = 'button';
    const more = el('button', 'azmini', 'أتممتُها'); more.type = 'button';
    const redo = el('button', 'azmini', 'إعادة'); redo.type = 'button';
    row.append(btn);
    if (e.n >= 10) row.append(more);
    if (e.n > 1) row.append(redo);
    li.append(text, row);
    ol.appendChild(li);
    return { li, btn, more, redo };
  });

  const live = $('azLive');
  const paint = i => {
    const e = entries[i], c = cards[i], done = counts[i] >= e.n;
    c.li.classList.toggle('done', done);
    c.btn.textContent = e.n === 1 ? (done ? '✓ تمّ' : 'قرأتُها') : AR(counts[i]) + ' / ' + AR(e.n);
    c.btn.setAttribute('aria-label', 'الذكر ' + AR(i + 1) + ': ' + (e.n === 1 ? (done ? 'تمّ، اضغط للتراجع' : 'اضغط إذا قرأته') : AR(counts[i]) + ' من ' + AR(e.n) + '، اضغط للعدّ'));
    c.btn.setAttribute('aria-pressed', done);
    c.more.hidden = done; c.redo.hidden = !counts[i];
  };
  const summary = () => {
    const d = doneN();
    fill.style.width = Math.round((d / entries.length) * 100) + '%';
    prog.textContent = d === entries.length ? 'أتممتَ القائمة كلها ✓' : 'أتممتَ ' + AR(d) + ' من ' + AR(entries.length);
    reset.hidden = !counts.some(n => n > 0);
  };
  const commit = (i, popped) => {
    paint(i); summary();
    const all = doneN() === entries.length;
    azSave(key, counts, all);
    if (live) live.textContent = AR(counts[i]) + ' من ' + AR(entries[i].n);
    if (popped) markPop(cards[i].btn);
    if (all && !finished) { celebrate('ما شاء الله، أتممتَ ' + title, true); tabsBar(tabOf(key) ? key : null) }
    if (!all && finished) tabsBar(tabOf(key) ? key : null);
    finished = all;
  };
  cards.forEach((c, i) => {
    const n = entries[i].n;
    c.btn.addEventListener('click', () => {
      if (n === 1) counts[i] = counts[i] ? 0 : 1; else if (counts[i] < n) counts[i]++; else return;
      commit(i, counts[i] >= n);
    });
    c.more.addEventListener('click', () => { counts[i] = n; commit(i, true) });
    c.redo.addEventListener('click', () => { counts[i] = 0; commit(i, false) });
    paint(i);
  });
  reset.addEventListener('click', () => { counts.fill(0); cards.forEach((c, i) => paint(i)); summary(); azSave(key, counts, false); const was = finished; finished = false; if (was) tabsBar(tabOf(key) ? key : null) });
  summary();
  box.append(head, ol);
}

/** Every category, with a filter box. */
function showAll(box, data) {
  const q = el('input', 'search'); q.type = 'search'; q.id = 'azq'; q.autocomplete = 'off';
  q.placeholder = 'ابحث في الأذكار (مثلًا: السفر، الطعام، المطر)'; q.setAttribute('aria-label', 'ابحث في أقسام الأذكار');
  const ul = el('ul', 'azcats');
  const paint = () => {
    const f = norm(q.value); ul.textContent = '';
    const hits = data.filter(c => !f || norm(c.category).includes(f));
    hits.forEach(c => {
      const li = el('li'), a = el('a', 'azcat'); a.href = '#/adhkar/c' + c.id;
      a.append(el('b', '', c.category), el('small', '', times(c.array.length)));
      li.appendChild(a); ul.appendChild(li);
    });
    if (!hits.length) ul.appendChild(el('li', 'empty', 'لا يوجد قسم بهذا الاسم.'));
  };
  q.addEventListener('input', paint); paint();
  box.append(q, ul);
}

/** Shows #/adhkar/<tab | c<id>>; with no argument, the list that fits the time of day. */
export async function renderAdhkar(arg) {
  lastArg = arg;
  const my = ++token, box = $('azBox'), key = arg || azNow();
  const m = /^c(\d{1,3})$/.exec(key), tab = tabOf(key);
  tabsBar(tab ? key : key === 'all' ? 'all' : null);
  box.setAttribute('aria-busy', 'true'); box.replaceChildren(el('p', 'empty', 'جارٍ تحميل الأذكار…'));
  let data; try { data = await loadAdhkar() } catch (e) {
    if (my === token) { box.setAttribute('aria-busy', 'false'); box.replaceChildren(el('p', 'empty', 'تعذّر تحميل الأذكار. تأكد من الاتصال وأعد فتح الصفحة.')) }
    return;
  }
  if (my !== token) return;
  box.textContent = ''; box.setAttribute('aria-busy', 'false');
  if (tab) {
    const cat = data.find(c => c.id === tab.cat);
    showList(box, key, cat, tab.title, false); document.title = tab.title + ' · رفيق الحفظ';
  } else if (m && data.some(c => c.id === +m[1])) {
    const cat = data.find(c => c.id === +m[1]);
    showList(box, 'c' + cat.id, cat, cat.category, true); document.title = cat.category + ' · رفيق الحفظ';
  } else {
    showAll(box, data); document.title = 'كل الأذكار · رفيق الحفظ';
  }
}

/** Repaints the page for another child (the progress belongs to the child). */
export function refreshAdhkar() { if (!$('page-adhkar').hidden) renderAdhkar(lastArg) }
