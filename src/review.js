import { $, AR, day, days, el } from './util.js';
import { Q } from './data.js';
import { S, mem, isDue, grade, weakList, masterWeak, save } from './state.js';
import { revealAyah } from './motion.js';

/** Surahs whose review is due today, in surah order. */
export const dueList = () => Q.map((_, k) => k + 1).filter(isDue);

let note = '';
let onGraded = () => {};
export const onReviewGraded = fn => { onGraded = fn };

/** One due surah at a time: open it to recite, then grade yourself. */
export function renderReview() {
  const box = $('reviewBox'); box.textContent = '';
  if (!Q.length) return;
  const due = dueList();
  if (note) box.appendChild(el('p', 'good', note));
  if (!due.length) {
    box.appendChild(el('p', 'note', 'لا توجد مراجعات مستحقة الآن. أحسنت!'));
    const next = Object.entries(S.s).filter(([id]) => mem(+id) > 0).map(([id, r]) => r.d).sort()[0];
    if (next) box.appendChild(el('p', 'note', 'أقرب مراجعة قادمة: ' + new Date(next + 'T12:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) + '.'));
    const a = el('a', 'btn primary', 'اذهب إلى المصحف'); a.href = '#/mushaf'; box.appendChild(a);
    return;
  }
  const id = due[0], c = Q[id - 1];
  const card = el('article', 'revcard');
  card.append(
    el('p', 'note', 'المتبقي اليوم: ' + AR(due.length) + (due.length === 1 ? ' سورة' : ' سور')),
    el('h2', '', 'سورة ' + c.n),
    el('p', 'meta', 'حفظتَ ' + AR(mem(id)) + ' من ' + AR(c.v.length) + ' آية'),
    el('p', 'note', 'افتح السورة وسمّع ما حفظتَه من غير نظر، ثم ارجع وقيّم مراجعتك.'));
  const open = el('a', 'btn', 'افتح السورة للتسميع'); open.href = '#/surah/' + id;
  const good = el('button', 'btn primary', 'راجعتُها وأتقنتُها'); good.type = 'button';
  const bad = el('button', 'btn', 'تحتاج إعادة'); bad.type = 'button';
  const finish = ok => { const i = grade(id, ok); note = (ok ? 'أحسنت. ' : 'لا بأس، كرّرها اليوم. ') + 'سورة ' + c.n + ': المراجعة القادمة بعد ' + days(i) + '.'; renderReview(); onGraded() };
  good.addEventListener('click', () => finish(true));
  bad.addEventListener('click', () => finish(false));
  const acts = el('div', 'acts'); acts.append(open, good, bad);
  card.appendChild(acts);
  box.appendChild(card);
}

export const clearReviewNote = () => { note = ''; weakNote = '' };

/* ---------- weak ayat: one at a time, from memory ---------- */
let weakIdx = 0, weakNote = '';
export function renderWeak() {
  const box = $('weakBox'); box.textContent = '';
  if (!Q.length) return;
  box.appendChild(el('h2', '', 'آيات تحتاج تثبيتًا'));
  if (weakNote) box.appendChild(el('p', 'good', weakNote));
  const list = weakList();
  if (!list.length) {
    box.appendChild(el('p', 'note', 'لا توجد آيات ضعيفة. من صفحة أي سورة اضغط «علّمها ضعيفة» تحت الآية التي تتعثّر فيها لتظهر هنا.'));
    return;
  }
  const a = list[weakIdx % list.length], c = Q[a.id - 1], text = c.v[a.i];
  const card = el('article', 'weakq');
  card.appendChild(el('p', 'note', 'المتبقي: ' + AR(list.length) + ' · سورة ' + c.n + ' · الآية ' + AR(a.i + 1)));
  const sp = text.indexOf(' '), first = sp > 0 ? text.slice(0, sp) : '', rest = sp > 0 ? text.slice(sp) : text;
  const tx = el('div', 'tx'); tx.tabIndex = 0; tx.setAttribute('role', 'button'); tx.setAttribute('aria-label', 'اكشف الآية');
  tx.append(first, el('span', 'rest', rest));
  const reveal = () => { if (!card.classList.contains('shown')) { card.classList.add('shown'); revealAyah(card) } };
  tx.addEventListener('click', reveal);
  tx.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal() } });
  card.append(tx, el('p', 'note', 'اقرأ الآية من حفظك ثم اضغطها لتتحقق.'));
  const good = el('button', 'btn primary', 'أتقنتُها'), again = el('button', 'btn', 'ما زالت ضعيفة'), open = el('a', 'btn', 'افتح السورة');
  good.type = again.type = 'button'; open.href = '#/surah/' + a.id;
  good.addEventListener('click', () => { masterWeak(a.id, a.i); save(); weakNote = 'أحسنت! أتقنتَ الآية ' + AR(a.i + 1) + ' من سورة ' + c.n + '.'; renderWeak(); onGraded() });
  again.addEventListener('click', () => { weakIdx++; weakNote = ''; renderWeak() });
  const acts = el('div', 'acts'); acts.append(good, again, open); card.appendChild(acts);
  box.appendChild(card);
}
