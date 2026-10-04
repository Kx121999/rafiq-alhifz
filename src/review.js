import { $, AR, day, days, el } from './util.js';
import { Q } from './data.js';
import { S, mem, isDue, grade } from './state.js';

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
    el('h3', '', 'سورة ' + c.n),
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

export const clearReviewNote = () => { note = '' };
