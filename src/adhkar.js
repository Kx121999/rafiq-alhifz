// The adhkar page: tabs for morning, evening, sleep, waking and after prayer, plus every other category of Hisn al-Muslim.
// The texts come from public/adhkar.json exactly as they are and are only ever shown with textContent. A tap counter
// per dhikr, saved per child and per day (see azSave in state.js), and a small celebration when a list is finished.
import { $, AR, el, norm, icon } from './util.js';
import { offerUndo } from './guard.js';
import { loadAdhkar } from './data.js';
import { azToday, azSave, favList, isFav, toggleFav } from './state.js';
import { celebrate, markPop } from './motion.js';
import { sfx } from './sound.js';
import { checkChallenge } from './challenge.js';
import { AZ_TABS, tabOf, azNow, COUNT_FIX } from './azmeta.js';

let token = 0, lastArg;

const FAV = { key: 'fav', label: 'المفضلة', icon: 'star' };
const ALL = { key: 'all', label: 'كل الأذكار', icon: 'list' };
const times = n => n === 1 ? 'ذكر واحد' : n === 2 ? 'ذكران' : n <= 10 ? AR(n) + ' أذكار' : AR(n) + ' ذكرًا';

function tabsBar(active) {
  const nav = $('azTabs'); nav.textContent = '';
  [...AZ_TABS, FAV, ALL].forEach(t => {
    const a = el('a', 'chip aztab'); a.href = '#/adhkar/' + t.key;
    a.append(icon(t.icon), el('span', '', t.label));
    if (t.key !== 'all' && t.key !== 'fav' && azToday(t.key).d) { const ok = el('span', 'azok'); ok.setAttribute('aria-hidden', 'true'); ok.appendChild(icon('check')); a.append(ok, el('span', 'sr', 'تمّ اليوم')) }
    if (t.key === active) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
}

const entryOf = (cat, a) => ({ ref: cat.id + '.' + a.id, text: a.text, n: COUNT_FIX[cat.id + '.' + a.id] || a.count });

/** One list of adhkar with its counters. key is the progress key, title what the heading says.
    With persist off (the favourites tab, whose list changes) counts live only on screen and nothing is celebrated. */
function showList(box, key, entries, title, { back = false, persist = true, onUnfav } = {}) {
  const saved = persist ? azToday(key) : { c: [] }, counts = entries.map((e, i) => Math.min(saved.c[i] || 0, e.n));
  const doneN = () => entries.filter((e, i) => counts[i] >= e.n).length;
  let finished = doneN() === entries.length;

  const head = el('section', 'azhead');
  if (back) { const b = el('a', 'btn', '→ كل الأذكار'); b.href = '#/adhkar/all'; head.appendChild(b) }
  const h = el('h2', '', title);
  const bar = el('div', 'bar'), fill = el('i'); bar.appendChild(fill);
  const prog = el('p', 'note azprog');
  const reset = el('button', 'btn ghost', 'ابدأ من جديد'); reset.type = 'button';
  const cont = el('button', 'btn primary'); cont.type = 'button'; cont.id = 'azContinue';
  const undo = el('button', 'btn'); undo.type = 'button'; undo.id = 'azUndo'; undo.append(icon('undo'), 'تراجع عن آخر ضغطة'); undo.disabled = true;
  const tools = el('div', 'acts azacts'); tools.append(cont, undo, reset);
  head.append(h, bar, prog, tools);
  const history = [];   // [{i, prev}] of this visit: "undo" walks back through the last taps one by one
  const remember = i => { history.push({ i, prev: counts[i] }); if (history.length > 100) history.shift(); undo.disabled = false };

  const ol = el('ol', 'azlist');
  const cards = entries.map((e, i) => {
    const li = el('li', 'azcard');
    const text = el('p', 'azt', e.text);
    const row = el('div', 'azrow');
    const btn = el('button', 'azbtn'); btn.type = 'button';
    const more = el('button', 'azmini', 'أتممتُها'); more.type = 'button';
    const redo = el('button', 'azmini', 'إعادة'); redo.type = 'button';
    const fav = el('button', 'azfav'); fav.type = 'button';
    row.append(btn);
    if (e.n >= 10) row.append(more);
    if (e.n > 1) row.append(redo);
    row.append(fav);
    li.append(text, row);
    ol.appendChild(li);
    return { li, btn, more, redo, fav };
  });

  const live = $('azLive');
  const paint = i => {
    const e = entries[i], c = cards[i], done = counts[i] >= e.n;
    c.li.classList.toggle('done', done);
    c.btn.textContent = e.n === 1 ? (done ? 'تمّ' : 'قرأتُها') : AR(counts[i]) + ' من ' + AR(e.n);
    c.btn.setAttribute('aria-label', 'الذكر ' + AR(i + 1) + ': ' + (e.n === 1 ? (done ? 'تمّ، اضغط للتراجع' : 'اضغط إذا قرأته') : AR(counts[i]) + ' من ' + AR(e.n) + '، اضغط للعدّ'));
    c.btn.setAttribute('aria-pressed', done);
    c.more.hidden = done; c.redo.hidden = !counts[i];
  };
  const paintFav = i => {
    const on = isFav(entries[i].ref), f = cards[i].fav;
    f.replaceChildren(icon('star'), on ? 'في المفضلة' : 'أضف للمفضلة'); f.setAttribute('aria-pressed', on);
    f.setAttribute('aria-label', (on ? 'إزالة الذكر ' : 'إضافة الذكر ') + AR(i + 1) + (on ? ' من المفضلة' : ' إلى المفضلة'));
  };
  const summary = () => {
    const d = doneN();
    fill.style.width = Math.round((d / entries.length) * 100) + '%';
    prog.textContent = d === entries.length ? 'أتممتَ القائمة كلها' : 'أتممتَ ' + AR(d) + ' من ' + AR(entries.length);
    const started = counts.some(n => n > 0);
    reset.hidden = !started; cont.hidden = d === entries.length;
    cont.textContent = started ? 'تابع الباقي (' + AR(entries.length - d) + ')' : 'ابدأ';
  };
  const commit = (i, popped) => {
    paint(i); summary();
    const all = doneN() === entries.length;
    if (persist) { azSave(key, counts, all); if (all) checkChallenge() }
    if (live) live.textContent = AR(counts[i]) + ' من ' + AR(entries[i].n);
    if (popped) markPop(cards[i].btn);
    if (persist && all && !finished) { celebrate('ما شاء الله، أتممتَ ' + title, true); tabsBar(tabOf(key) ? key : null) }
    if (persist && !all && finished) tabsBar(tabOf(key) ? key : null);
    finished = all;
  };
  cards.forEach((c, i) => {
    const n = entries[i].n;
    c.btn.addEventListener('click', () => {
      if (n !== 1 && counts[i] >= n) return;
      remember(i);
      if (n === 1) counts[i] = counts[i] ? 0 : 1; else counts[i]++;
      if (counts[i] < n) sfx('tap');   // finishing a dhikr plays the star sound instead
      commit(i, counts[i] >= n);
    });
    c.more.addEventListener('click', () => { remember(i); counts[i] = n; commit(i, true) });
    c.redo.addEventListener('click', () => { remember(i); counts[i] = 0; commit(i, false) });
    c.fav.addEventListener('click', () => {
      const on = toggleFav(entries[i].ref);
      if (live) live.textContent = on ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة';
      if (onUnfav && !on) { onUnfav(); return }
      paintFav(i);
    });
    paint(i); paintFav(i);
  });
  undo.addEventListener('click', () => {
    const last = history.pop(); if (!last) return;
    counts[last.i] = last.prev; undo.disabled = !history.length; commit(last.i, false);
    cards[last.i].btn.focus();
  });
  // "continue": straight to the first dhikr that is not finished
  cont.addEventListener('click', () => {
    const at = entries.findIndex((e, i) => counts[i] < e.n); if (at < 0) return;
    cards[at].li.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    cards[at].btn.focus({ preventScroll: true });
  });
  const restore = snap => { counts.splice(0, counts.length, ...snap); cards.forEach((c, i) => paint(i)); summary(); if (persist) azSave(key, counts, doneN() === entries.length); finished = doneN() === entries.length; if (persist) tabsBar(tabOf(key) ? key : null) };
  reset.addEventListener('click', () => {
    if (!confirm('البدء من جديد يمسح عدّ اليوم لهذه القائمة. هل تريد المتابعة؟')) return;
    const snap = counts.slice(); history.length = 0; undo.disabled = true;
    counts.fill(0); cards.forEach((c, i) => paint(i)); summary(); if (persist) azSave(key, counts, false);
    const was = finished; finished = false; if (persist && was) tabsBar(tabOf(key) ? key : null);
    offerUndo('بدأتَ القائمة من جديد.', () => restore(snap));
  });
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

/** The adhkar this child starred, from every category, in the order they were added. */
function showFavs(box, data) {
  const entries = favList().map(ref => {
    const [c, e] = ref.split('.').map(Number), cat = data.find(x => x.id === c), a = cat && cat.array.find(x => x.id === e);
    return a ? entryOf(cat, a) : null;
  }).filter(Boolean);
  if (!entries.length) {
    const p = el('p', 'empty', 'لم تضف أذكارًا إلى المفضلة بعد. اضغط «أضف للمفضلة» تحت أي ذكر ليظهر هنا.');
    const a = el('a', 'btn primary', 'تصفّح كل الأذكار'); a.href = '#/adhkar/all';
    const wrap = el('div', 'azempty'); wrap.append(p, a); box.appendChild(wrap); return;
  }
  showList(box, 'fav', entries, 'أذكاري المفضلة', { persist: false, onUnfav: () => renderAdhkar('fav') });
}

/** Shows #/adhkar/<tab | fav | c<id>>; with no argument, the list that fits the time of day. */
export async function renderAdhkar(arg) {
  lastArg = arg;
  const my = ++token, box = $('azBox'), key = arg || azNow();
  const m = /^c(\d{1,3})$/.exec(key), tab = tabOf(key);
  tabsBar(tab || key === 'all' || key === 'fav' ? key : null);
  box.setAttribute('aria-busy', 'true'); box.replaceChildren(el('p', 'empty', 'جارٍ تحميل الأذكار…'));
  let data; try { data = await loadAdhkar() } catch (e) {
    if (my === token) { box.setAttribute('aria-busy', 'false'); box.replaceChildren(el('p', 'empty', 'تعذّر تحميل الأذكار. تأكد من الاتصال وأعد فتح الصفحة.')) }
    return;
  }
  if (my !== token) return;
  box.textContent = ''; box.setAttribute('aria-busy', 'false');
  if (tab) {
    const cat = data.find(c => c.id === tab.cat);
    showList(box, key, cat.array.map(a => entryOf(cat, a)), tab.title); document.title = tab.title + ' · رفيق الحفظ';
  } else if (m && data.some(c => c.id === +m[1])) {
    const cat = data.find(c => c.id === +m[1]);
    showList(box, 'c' + cat.id, cat.array.map(a => entryOf(cat, a)), cat.category, { back: true }); document.title = cat.category + ' · رفيق الحفظ';
  } else if (key === 'fav') {
    showFavs(box, data); document.title = 'المفضلة · رفيق الحفظ';
  } else {
    showAll(box, data); document.title = 'كل الأذكار · رفيق الحفظ';
  }
}

/** Repaints the page for another child (the progress belongs to the child). */
export function refreshAdhkar() { if (!$('page-adhkar').hidden) renderAdhkar(lastArg) }
