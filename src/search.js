// Search inside the text of the mushaf. Works on a normalised copy (no tashkeel or Quranic marks), built once.
import { $, AR, el, norm } from './util.js';
import { Q } from './data.js';
import { rec } from './state.js';

const PAGE = 30;
const clean = s => norm(s).replace(/\s+/g, ' ').trim();

let index = null;
/** One normalised string per ayah, in mushaf order. */
const idx = () => index || (index = Q.map(c => c.v.map(clean)));
/** Forget the index (used when the data is reloaded, e.g. in tests). */
export const resetIndex = () => { index = null };

export function parseQuery(q) {
  const n = clean(q || '');
  return { n, words: n ? n.split(' ') : [] };
}

/**
 * Finds ayat containing the query. Ayat holding the whole phrase come first, then ayat that contain every word
 * (in any order). Returns {total, hits: [{id, i}], words}; queries under two letters match nothing.
 */
export function search(q) {
  const { n, words } = parseQuery(q);
  if (n.replace(/ /g, '').length < 2) return { total: 0, hits: [], words };
  const phrase = [], all = [];
  idx().forEach((ayat, s) => ayat.forEach((t, i) => {
    if (t.includes(n)) phrase.push({ id: s + 1, i });
    else if (words.length > 1 && words.every(w => t.includes(w))) all.push({ id: s + 1, i });
  }));
  const hits = phrase.concat(all);
  return { total: hits.length, hits, words };
}

/** Splits an ayah into its original words, flagging the ones that contain a searched word. */
export function highlight(text, words) {
  return text.trim().split(/\s+/).map(w => {
    const nw = clean(w);
    return { w, hit: !!nw && words.some(q => nw.includes(q)) };
  });
}

/* ---------- page ---------- */
let shown = PAGE, current = null;
const HINTS = ['الرحمن', 'الصبر', 'النور', 'الجنة'];

function resultItem(h, words) {
  const li = el('li', 'hit');
  const a = el('a', 'hitref', 'سورة ' + Q[h.id - 1].n + ' · الآية ' + AR(h.i + 1)); a.href = '#/surah/' + h.id + '/' + (h.i + 1);
  const head = el('div', 'hithead'); head.appendChild(a);
  const r = rec(h.id); if (r && r.m[h.i] === '1') head.appendChild(el('span', 'pill done', 'محفوظة'));
  const tx = el('p', 'hittx');
  highlight(Q[h.id - 1].v[h.i], words).forEach((p, k) => {
    if (k) tx.append(' ');
    if (p.hit) tx.appendChild(el('mark', '', p.w)); else tx.append(p.w);
  });
  li.append(head, tx);
  return li;
}

export function renderSearch() {
  const info = $('sInfo'), list = $('sList'), more = $('sMore');
  list.textContent = ''; more.hidden = true;
  if (!Q.length) return;
  const q = $('sq').value;
  current = search(q);
  const { n } = parseQuery(q);
  $('sHints').hidden = !!n;
  if (!n) { info.textContent = 'اكتب كلمة أو جزءًا من آية. لا يهم التشكيل ولا شكل الهمزة.'; return }
  if (n.replace(/ /g, '').length < 2) { info.textContent = 'اكتب حرفين على الأقل.'; return }
  if (!current.total) { info.textContent = 'لا توجد آية تحتوي «' + q.trim() + '». جرّب كلمة أقصر أو بدون «ال» التعريف.'; return }
  const visible = current.hits.slice(0, shown);
  info.textContent = 'عدد الآيات: ' + AR(current.total) + (current.total > visible.length ? ' (المعروض ' + AR(visible.length) + ')' : '');
  visible.forEach(h => list.appendChild(resultItem(h, current.words)));
  more.hidden = current.total <= visible.length;
}

export function initSearch() {
  const input = $('sq'); let timer = 0;
  const run = () => { shown = PAGE; renderSearch(); try { history.replaceState(null, '', input.value.trim() ? '#/search/' + encodeURIComponent(input.value.trim()) : '#/search') } catch (e) {} };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 150) });
  $('sMore').addEventListener('click', () => { shown += PAGE; renderSearch() });
  HINTS.forEach(h => { const b = el('button', 'chip', h); b.type = 'button'; b.addEventListener('click', () => { input.value = h; run(); input.focus() }); $('sHints').appendChild(b) });
}

/** Opening #/search/<query> fills the box and runs the search. */
export function openSearch(arg) {
  let q = ''; try { q = arg ? decodeURIComponent(arg) : '' } catch (e) {}
  $('sq').value = q; shown = PAGE; renderSearch();
}
