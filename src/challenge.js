// The weekly challenge: one simple goal per week (weeks start on Saturday), measured from what the site already records
// for the child (activity log and adhkar progress). Finishing it once gives bonus game stars and a medal. A "rest day"
// (one per week) keeps the streak alive when the child needs a day off. Nothing here is religious text.
import { $, AR, day, el, nujum, shiftDay } from './util.js';
import { activeKid, kids, addGameStars, markWeekDone, weekDone, weeksDone, weekStartOf, restUsedThisWeek, restDays, useRestDay, streakNow, famDone, markFamilyWeek } from './state.js';
import { celebrate } from './motion.js';

export const BONUS_STARS = 5;
/** New ayat per child per week that the whole family aims for together (young children: fewer). */
export const FAMILY_PER_KID = { reader: 15, young: 8 };

/** The family's goal for the week that starts on ws: everyone's new ayat added up against a target. Needs two children or more. */
export function familyGoalOf(list, ws) {
  const dates = Array.from({ length: 7 }, (_, k) => shiftDay(ws, k));
  const target = list.reduce((t, k) => t + (k.mode === 'young' ? FAMILY_PER_KID.young : FAMILY_PER_KID.reader), 0);
  const total = list.reduce((t, k) => t + dates.reduce((s, d) => s + (((k.log || {})[d] || {}).a || 0), 0), 0);
  return { on: list.length >= 2, target, total: Math.min(total, target), reached: total >= target };
}

/** Gives every child the family medal the first time the family target is reached in a week. */
export function checkFamilyGoal() {
  const ws = weekStartOf(day()), g = familyGoalOf(kids(), ws);
  if (!g.on || !g.reached || famDone(ws)) return false;
  if (!markFamilyWeek(ws)) return false;
  celebrate('ما شاء الله، حقّقتم هدف الأسرة معًا 🤝 ونلتم وسام «أسرة متعاونة»', true);
  return true;
}

/** n: the target for readers, young: the target for young children. */
export const CHALLENGES = [
  { id: 'ayat', icon: '📖', title: n => 'احفظ ' + n + ' آيات جديدة', measure: 'a', n: 10, young: 5, unit: 'آية' },
  { id: 'review', icon: '🔁', title: n => 'راجع ' + n + ' سور', measure: 'r', n: 3, young: 2, unit: 'مراجعة' },
  { id: 'sabah', icon: '🌅', title: n => 'أنهِ أذكار الصباح في ' + n + ' أيام', measure: 'sabah', n: 5, young: 3, unit: 'يوم' },
  { id: 'games', icon: '🎮', title: n => 'اجمع ' + n + ' نجمة في الألعاب', measure: 'g', n: 20, young: 10, unit: 'نجمة' },
  { id: 'masaa', icon: '🌙', title: n => 'أنهِ أذكار المساء في ' + n + ' أيام', measure: 'masaa', n: 5, young: 3, unit: 'يوم' },
];

/** The challenge of the week that starts on ws (the same one for everybody, rotating through the list). */
export function challengeOf(ws) {
  const weeks = Math.floor(new Date(ws + 'T12:00:00').getTime() / 864e5 / 7);
  return CHALLENGES[((weeks % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}
export const targetOf = (ch, kid) => kid && kid.mode === 'young' ? ch.young : ch.n;

/** How far a child is in the week that starts on ws. */
export function progressOf(ch, kid, ws) {
  const dates = Array.from({ length: 7 }, (_, k) => shiftDay(ws, k)), log = (kid && kid.log) || {}, az = (kid && kid.az) || {};
  let v = 0;
  for (const d of dates) {
    if (ch.measure === 'sabah' || ch.measure === 'masaa') { const e = (az[d] || {})[ch.measure]; if (e && e.d) v++ }
    else v += ((log[d] || {})[ch.measure]) || 0;
  }
  return Math.min(v, targetOf(ch, kid));
}

/** Call after anything that can move the goal. Gives the reward once per week and returns true when it just did. */
export function checkChallenge() {
  const k = activeKid(); if (!k) return false;
  const ws = weekStartOf(day()), ch = challengeOf(ws);
  checkFamilyGoal();
  if (weekDone(ws) || progressOf(ch, k, ws) < targetOf(ch, k)) return false;
  if (!markWeekDone(ws)) return false;
  addGameStars(BONUS_STARS);
  celebrate('ما شاء الله، أنهيتَ تحدّي الأسبوع 🏆 ونلتَ ' + nujum(BONUS_STARS) + ' للألعاب', true);
  return true;
}

export function renderChallenge() {
  const box = $('chBox'); box.textContent = '';
  const k = activeKid(); if (!k) return;
  const ws = weekStartOf(day()), ch = challengeOf(ws), n = targetOf(ch, k), v = progressOf(ch, k, ws), done = weekDone(ws) || v >= n;

  const card = el('section', 'chcard' + (done ? ' done' : ''));
  const ic = el('span', 'chicon', ch.icon); ic.setAttribute('aria-hidden', 'true');
  card.append(ic, el('h2', '', 'تحدّي هذا الأسبوع'), el('p', 'chtitle', ch.title(AR(n))));
  const bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.round(v / n * 100) + '%'; bar.appendChild(fill);
  bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(n)); bar.setAttribute('aria-valuenow', String(v)); bar.setAttribute('aria-label', 'تقدّم التحدّي');
  card.append(bar, el('p', done ? 'good' : 'note', done ? 'أنهيتَ التحدّي، أحسنت! 🏆' : AR(v) + ' من ' + AR(n) + ' ' + ch.unit + '. الجائزة: ' + nujum(BONUS_STARS) + ' للألعاب ووسام.'));
  const end = shiftDay(ws, 6), fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  card.appendChild(el('p', 'note', 'من ' + fmt(ws) + ' إلى ' + fmt(end) + '. يتجدّد كل سبت.'));
  box.appendChild(card);

  const w = weeksDone();
  box.appendChild(el('p', 'chweeks', w ? '🏆 أنهيتَ ' + (w === 1 ? 'تحدّي أسبوع واحد' : 'تحدّي ' + AR(w) + ' أسابيع') + ' حتى الآن.' : 'لم تُنهِ أي تحدٍّ بعد، ابدأ من هذا الأسبوع!'));

  // rest day
  const rest = el('section', 'chcard rest');
  const ri = el('span', 'chicon', '🛌'); ri.setAttribute('aria-hidden', 'true');
  rest.append(ri, el('h2', '', 'يوم راحة'), el('p', 'note', 'تعبان أو مسافر؟ يوم راحة واحد في الأسبوع يحافظ على أيامك المتتالية فلا تنقطع إن فاتك يوم.'));
  rest.appendChild(el('p', '', '🔥 أيامك المتتالية الآن: ' + AR(streakNow())));
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const used = restUsedThisWeek(), today = !!restDays()[day()];
  const b = el('button', 'btn' + (used ? '' : ' primary'), today ? 'اليوم يوم راحة ✓' : used ? 'استخدمتَ يوم الراحة هذا الأسبوع' : 'اجعل اليوم يوم راحة');
  b.type = 'button'; b.disabled = used;
  b.addEventListener('click', () => { if (useRestDay()) { msg.textContent = 'تم. اليوم يوم راحة، وأيامك المتتالية محفوظة.'; renderChallenge() } });
  rest.append(b, msg);
  box.appendChild(rest);
}
