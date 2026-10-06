// The review page: surahs that are due, one at a time (recite from memory, then rate yourself in three honest levels),
// and the ayat marked as weak, as a list that can be acted on. The rating is a self-assessment; nothing here checks the recitation.
import { $, AR, days, el, icon } from './util.js';
import { Q } from './data.js';
import { S, mem, isDue, grade, weakList, masterWeak, save, RATINGS } from './state.js';
import { revealAyah } from './motion.js';

/** Surahs whose review is due today, in surah order. */
export const dueList = () => Q.map((_, k) => k + 1).filter(isDue);

let note = '';
let onGraded = () => {};
export const onReviewGraded = fn => { onGraded = fn };

const dateText = iso => new Date(iso + 'T12:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
const link = (href, text, cls = 'btn') => { const a = el('a', cls, text); a.href = href; return a };

/** The three rating buttons shared by this page and the surah page: calls pick(key) with 'help', 'good' or 'mastered'. */
export function ratingButtons(pick) {
  const acts = el('div', 'acts rating'); acts.setAttribute('role', 'group'); acts.setAttribute('aria-label', 'كيف كانت مراجعتك؟');
  for (const [key, label] of Object.entries(RATINGS)) {
    const b = el('button', key === 'good' ? 'btn primary' : 'btn'); b.type = 'button'; b.dataset.rating = key;
    b.append(icon(key === 'help' ? 'repeat' : key === 'good' ? 'check' : 'star'), label);
    b.addEventListener('click', () => pick(key)); acts.appendChild(b);
  }
  return acts;
}
export const ratingNote = (key, i) => (key === 'help' ? 'لا بأس، كرّرها اليوم. ' : key === 'mastered' ? 'ما شاء الله، متقن. ' : 'أحسنت. ') + 'المراجعة القادمة بعد ' + days(i) + '.';

/** One due surah at a time: open it to recite, then rate yourself. */
export function renderReview() {
  const box = $('reviewBox'); box.textContent = '';
  if (!Q.length) return;
  const due = dueList();
  if (note) box.appendChild(el('p', 'good', note));
  if (!due.length) {
    const started = Object.keys(S.s).some(id => mem(+id) > 0);
    if (!started) {
      box.append(el('h2', '', 'لا مراجعات بعد'), el('p', 'note', 'تظهر المراجعة هنا بعد أن تعلّم أول آية حفظتَها. ابدأ بجلسة حفظ قصيرة.'), link('#/dashboard', 'العودة إلى لوحتي', 'btn primary'));
      return;
    }
    box.appendChild(el('h2', '', 'لا مراجعات مستحقة الآن'));
    const next = Object.entries(S.s).filter(([id]) => mem(+id) > 0).map(([id, r]) => r.d).sort()[0];
    box.appendChild(el('p', 'note', next ? 'أقرب مراجعة قادمة: ' + dateText(next) + '.' : 'أحسنت.'));
    box.appendChild(link('#/mushaf', 'اذهب إلى المصحف', 'btn primary'));
    return;
  }
  const id = due[0], c = Q[id - 1];
  const card = el('article', 'revcard');
  card.append(
    el('p', 'note', 'المتبقي اليوم: ' + AR(due.length) + (due.length === 1 ? ' سورة' : ' سور')),
    el('h2', '', 'سورة ' + c.n),
    el('p', 'meta', 'حفظتَ ' + AR(mem(id)) + ' من ' + AR(c.v.length) + ' آية'),
    el('p', 'note', 'افتح السورة وسمّع ما حفظتَه من غير نظر، ثم ارجع وقيّم مراجعتك بصدق.'));
  card.appendChild(link('#/surah/' + id, 'افتح السورة للتسميع', 'btn'));
  card.appendChild(ratingButtons(key => { const i = grade(id, key); note = ratingNote(key, i).replace(/^/, 'سورة ' + c.n + ': '); renderReview(); onGraded() }));
  box.appendChild(card);
}

export const clearReviewNote = () => { note = ''; weakNote = '' };

/* ---------- weak ayat: one at a time from memory, and the whole list below ---------- */
let weakIdx = 0, weakNote = '';
export function renderWeak() {
  const box = $('weakBox'); box.textContent = '';
  if (!Q.length) return;
  box.appendChild(el('h2', '', 'آيات تحتاج تثبيتًا'));
  if (weakNote) box.appendChild(el('p', 'good', weakNote));
  const list = weakList();
  if (!list.length) {
    box.appendChild(el('p', 'note', 'لا توجد آيات ضعيفة. حين تتعثّر في آية حفظتَها، افتح سورتها في وضع «حفظ» واضغط «علّمها ضعيفة» لتظهر هنا وتثبّتها.'));
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
  const good = el('button', 'btn primary', 'أتقنتُها'), again = el('button', 'btn', 'ما زالت ضعيفة'), open = link('#/surah/' + a.id + '/' + (a.i + 1), 'افتح الآية');
  good.type = again.type = 'button';
  good.addEventListener('click', () => { masterWeak(a.id, a.i); save(); weakNote = 'أحسنت! أتقنتَ الآية ' + AR(a.i + 1) + ' من سورة ' + c.n + '.'; renderWeak(); onGraded() });
  again.addEventListener('click', () => { weakIdx++; weakNote = ''; renderWeak() });
  const acts = el('div', 'acts'); acts.append(good, again, open); card.appendChild(acts);
  box.appendChild(card);
  // the whole list: every weak ayah with a direct way to open it
  const ul = el('ul', 'weaklist'); ul.setAttribute('aria-label', 'كل الآيات الضعيفة');
  list.forEach(w => {
    const li = el('li'); li.appendChild(link('#/surah/' + w.id + '/' + (w.i + 1), 'سورة ' + Q[w.id - 1].n + ' · الآية ' + AR(w.i + 1), 'chip'));
    ul.appendChild(li);
  });
  box.appendChild(ul);
}
