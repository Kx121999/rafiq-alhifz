// "لوحتي": one question, "what do I do now?". A big card for today's session, then what is due, the goal, and what comes next.
// Everything shown is read from the child's real progress; a new child sees an invitation, never invented numbers.
import { $, AR, ayahs, el, icon, charImg } from './util.js';
import { Q } from './data.js';
import { S, activeKid, mem, isDue, kidPlan, lastSurah, weakList, azToday, friendOf, streakNow, save } from './state.js';
import { azNow, tabOf } from './azmeta.js';
import { ramadanLine } from './ramadan.js';
import { planStats } from './plan.js';
import { openSession, suggestedStart } from './session.js';
import { badgeStatus } from './medals.js';

const link = (href, text, cls = 'btn', ic) => { const a = el('a', cls); a.href = href; if (ic) a.append(icon(ic)); a.append(text); return a };
const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b };
const card = (box, title, ic) => { box.textContent = ''; const h = el('h3'); h.append(icon(ic), title); box.appendChild(h) };

/** The one sentence under the greeting. No emoji, no pressure. */
export function dashLine(ay, goal, doneToday, dueCount, weakCount) {
  if (!ay) return 'جلسة قصيرة اليوم تكفي لنبدأ.';
  if (doneToday >= goal) return 'أتممتَ هدف اليوم. ما شاء الله.';
  if (dueCount) return dueCount === 1 ? 'هناك سورة تنتظر مراجعتك.' : 'هناك ' + AR(dueCount) + ' سور تنتظر مراجعتك.';
  if (weakCount) return 'بعض الآيات تحتاج تثبيتًا.';
  if (doneToday > 0) return 'باقي ' + ayahs(goal - doneToday) + ' لإكمال هدفك.';
  return 'جاهز لجلسة اليوم؟';
}

/** Which surah today's session works on: where the child stopped, else the plan's next surah, else a surah in progress, else Al-Fatiha. */
export function sessionTarget() {
  const p = kidPlan(), st = p && planStats(p), last = lastSurah();
  if (last && mem(last) < Q[last - 1].v.length) return { id: last, why: 'last' };
  if (st && st.next) return { id: st.next, why: 'plan' };
  const doing = Q.findIndex((c, k) => mem(k + 1) > 0 && mem(k + 1) < c.v.length);
  if (doing >= 0) return { id: doing + 1, why: 'doing' };
  if (last) return { id: last, why: 'last' };
  return { id: 1, why: 'new' };
}

function sessionCard(box, ctx) {
  box.textContent = '';
  const { ay, doneToday, dueCount, weak } = ctx, t = sessionTarget(), c = Q[t.id - 1], from = suggestedStart(t.id);
  const goalDone = doneToday >= S.goal, p = kidPlan(), st = p && planStats(p), kind = st && st.left > 0 ? st.kindToday : 'm';
  const eyebrow = el('span', 'eyebrow'); eyebrow.append(icon('sparkle'), kind === 'x' ? 'يوم راحة في خطتك' : kind === 'r' ? 'يوم مراجعة في خطتك' : ay ? (goalDone ? 'اكتمل هدف اليوم' : 'جلسة اليوم') : 'ابدأ من هنا');
  const title = el('h2', '', ay ? (mem(t.id) ? 'أكمل سورة ' + c.n : 'ابدأ سورة ' + c.n) : 'جلستك الأولى');
  box.append(eyebrow, title);
  if (kind === 'x') box.appendChild(el('p', '', 'خطتك تجعل اليوم للراحة. إن أحببتَ فجلسة قصيرة أو مراجعة خفيفة لا بأس بها.'));
  else if (kind === 'r') box.appendChild(el('p', '', 'اليوم للمراجعة: ثبّت ما حفظتَه. ' + (dueCount ? 'عندك ' + AR(dueCount) + ' للمراجعة.' : 'لا مراجعات مستحقة الآن.')));
  else if (!ay) box.appendChild(el('p', '', 'سورة ' + c.n + '، من الآية الأولى. تستمع، ثم تكرّر، ثم تسمّع من حفظك. نحو خمس دقائق.'));
  else if (kind === 'm') box.appendChild(el('p', '', 'تكمل من الآية ' + AR(from + 1) + ' من ' + AR(c.v.length) + ' في سورة ' + c.n + '.'));
  const steps = [];
  if (dueCount) steps.push('تبدأ بمراجعة قصيرة (' + AR(dueCount) + ')');
  if (weak) steps.push('وتثبّت ' + ayahs(weak) + ' ضعيفة');
  if (steps.length) { const ul = el('ul'); steps.forEach(s => { const li = el('li'); li.append(icon('check'), s); ul.appendChild(li) }); box.appendChild(ul) }
  const acts = el('div', 'acts');
  if (kind === 'r' && dueCount) acts.appendChild(link('#/review', 'ابدأ المراجعة', 'btn'));
  else acts.appendChild(btn(ay ? (goalDone || kind !== 'm' ? 'جلسة إضافية' : 'ابدأ الجلسة') : 'ابدأ أول جلسة', 'btn', () => openSession(t.id)));
  acts.appendChild(link('#/surah/' + t.id, 'افتح السورة', 'btn ghost'));
  box.appendChild(acts);
  const fr = charImg(friendOf(), 'dbchar'); fr.width = fr.height = 72; box.appendChild(fr);
}

function dueCard(box, ctx) {
  card(box, 'المراجعة', 'repeat');
  const n = ctx.dueCount + ctx.weak;
  if (!ctx.ay) { box.appendChild(el('p', '', 'ستظهر المراجعات هنا بعد أن تعلّم أول آية محفوظة.')); return }
  if (!n) { box.appendChild(el('p', '', 'لا شيء مستحق الآن. المراجعة القادمة تظهر هنا عند موعدها.')); return }
  const kv = el('p', 'kv'); kv.append(el('b', '', AR(n)), n === 1 ? 'بند للمراجعة' : 'بنود للمراجعة'); box.appendChild(kv);
  const parts = []; if (ctx.dueCount) parts.push(ctx.dueCount === 1 ? 'سورة واحدة' : AR(ctx.dueCount) + ' سور'); if (ctx.weak) parts.push(ayahs(ctx.weak) + ' ضعيفة');
  box.appendChild(el('p', '', parts.join(' و')));
  const a = el('div', 'acts'); a.appendChild(link('#/review', 'ابدأ المراجعة', 'btn primary')); box.appendChild(a);
}

function goalCard(box, ctx) {
  card(box, 'هدف اليوم', 'target');
  const goal = S.goal, left = Math.max(0, goal - ctx.doneToday), pct = Math.min(100, ctx.doneToday / goal * 100);
  const kv = el('p', 'kv'); if (ctx.doneToday) kv.append(el('b', '', AR(ctx.doneToday)), 'من ' + ayahs(goal)); else kv.append(el('b', '', ayahs(goal)), 'هدفك اليوم'); box.appendChild(kv);   // no lone zero: a dot-like digit reads badly
  const bar = el('div', 'goalbar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'تقدّم هدف اليوم');
  bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(goal)); bar.setAttribute('aria-valuenow', String(Math.min(goal, ctx.doneToday)));
  const i = el('i'); i.style.width = pct.toFixed(1) + '%'; bar.appendChild(i); box.appendChild(bar);
  box.appendChild(el('p', '', left ? 'باقي ' + ayahs(left) + ' لإكمال هدفك.' : 'أتممتَ الهدف. ما شاء الله.'));
  const a = el('div', 'acts');
  const minus = btn('', 'btn', () => { S.goal = Math.max(1, S.goal - 1); save(); renderDashboard() }); minus.append(icon('minus')); minus.setAttribute('aria-label', 'تقليل هدف اليوم');
  const plus = btn('', 'btn', () => { S.goal = Math.min(50, S.goal + 1); save(); renderDashboard() }); plus.append(icon('plus')); plus.setAttribute('aria-label', 'زيادة هدف اليوم');
  minus.id = 'gMinus'; plus.id = 'gPlus';
  a.append(minus, plus); box.appendChild(a);
}

function metaCard(box, ctx) {
  card(box, 'رحلتك', 'flame');
  const streak = streakNow(), bs = badgeStatus();
  const rows = [];
  rows.push(ctx.ay ? AR(ctx.ay) + ' آية محفوظة، و' + (ctx.done === 1 ? 'سورة مكتملة واحدة' : AR(ctx.done) + ' سور مكتملة') : 'لم تبدأ الحفظ بعد');
  rows.push(streak ? 'أيام متتالية: ' + AR(streak) : 'ابدأ اليوم لتبدأ سلسلة أيامك');
  rows.forEach(r => box.appendChild(el('p', '', r)));
  if (bs.last) box.appendChild(el('p', '', 'آخر وسام: ' + bs.last.name));
  if (bs.next) box.appendChild(el('p', '', 'وسامك القادم «' + bs.next.name + '»: ' + bs.next.need));
  const ram = ramadanLine(); if (ram) box.appendChild(ram);
}

function tools(box) {
  box.textContent = '';
  const az = tabOf(azNow()), done = azToday(az.key).d;
  const items = [
    ['#/adhkar/' + az.key, 'beads', done ? az.title + ' ✓' : az.title],
    ['#/plan', 'target', 'خطتي'],
    ['#/games', 'gamepad', 'ألعاب'],
    ['#/search', 'search', 'بحث'],
    ['#/report', 'chart', 'التقرير'],
    ['#/more', 'more', 'المزيد'],
  ];
  for (const [href, ic, text] of items) { const a = el('a'); a.href = href; a.append(icon(ic), el('span', '', text)); box.appendChild(a) }
}

export function renderDashboard() {
  if (!Q.length) return;
  const k = activeKid(); if (!k) return;
  let ay = 0, done = 0, dueCount = 0;
  Q.forEach((c, i) => { const m = mem(i + 1); ay += m; if (m === c.v.length) done++; if (isDue(i + 1)) dueCount++ });
  const weak = weakList().length, ctx = { ay, done, dueCount, weak, doneToday: S.n };
  $('dbGreet').textContent = 'أهلًا يا ' + k.name;
  $('dbSub').textContent = dashLine(ay, S.goal, S.n, dueCount, weak);
  sessionCard($('dbSession'), ctx); dueCard($('dbDue'), ctx); goalCard($('dbGoal'), ctx); metaCard($('dbMeta'), ctx); tools($('dbTools'));
}
