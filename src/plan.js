// Memorisation plan: pick a goal and a number of weeks; the page works out a daily target and the next surah.
import { $, AR, ayahs, day, el } from './util.js';
import { Q } from './data.js';
import { S, mem, save, kidPlan, setPlan } from './state.js';

/** Surah ranges are by surah number. Juz' Amma is memorised from An-Nas upward, as children usually do. */
export const PRESETS = {
  amma: { name: 'جزء عمّ', from: 78, to: 114, desc: 'من سورة النبأ إلى سورة الناس، نبدأ بالقصار', order: 'desc', weeks: 8 },
  tabarak: { name: 'جزء تبارك', from: 67, to: 77, desc: 'من سورة الملك إلى سورة المرسلات', order: 'asc', weeks: 8 },
  both: { name: 'جزء عمّ وتبارك', from: 67, to: 114, desc: 'من سورة الملك إلى سورة الناس', order: 'desc', weeks: 16 },
};

const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return d };
const diffDays = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Progress against a plan: ayat left, ayat per day needed, days left, and the next surah to work on. */
export function planStats(p) {
  const pr = PRESETS[p.id]; if (!pr || !Q.length) return null;
  const ids = []; for (let i = pr.from; i <= pr.to; i++) ids.push(i);
  if (pr.order === 'desc') ids.reverse();
  let total = 0, left = 0;
  ids.forEach(id => { const t = Q[id - 1].v.length; total += t; left += t - mem(id) });
  const end = ymd(addDays(p.start, p.weeks * 7)), daysLeft = Math.max(0, diffDays(day(), end));
  const daily = left === 0 ? 0 : daysLeft > 0 ? Math.ceil(left / daysLeft) : left;
  const next = ids.find(id => mem(id) < Q[id - 1].v.length) || 0;
  return { pr, total, left, done: total - left, end, daysLeft, daily, next, overdue: left > 0 && daysLeft === 0 };
}

let draft = { id: 'amma', weeks: 8 };

export function renderPlan() {
  const box = $('planBox'); box.textContent = '';
  if (!Q.length) return;
  const p = kidPlan(), st = p && planStats(p);
  if (st) box.appendChild(planView(p, st)); else box.appendChild(planForm());
}

function planForm() {
  const f = el('div', 'planform');
  f.appendChild(el('p', 'note', 'اختر هدفك ومدة الحفظ، وسنحسب لك الورد اليومي.'));
  const goals = el('div', 'icons');
  Object.entries(PRESETS).forEach(([id, pr]) => {
    const b = el('button', 'chip', pr.name); b.type = 'button'; b.setAttribute('aria-pressed', id === draft.id);
    b.addEventListener('click', () => { draft.id = id; draft.weeks = pr.weeks; renderPlan() });
    goals.appendChild(b);
  });
  const pr = PRESETS[draft.id];
  const stepper = el('div', 'step');
  const minus = el('button', '', '−'), plus = el('button', '', '+');
  minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'تقليل المدة'); plus.setAttribute('aria-label', 'زيادة المدة');
  minus.addEventListener('click', () => { draft.weeks = Math.max(1, draft.weeks - 1); renderPlan() });
  plus.addEventListener('click', () => { draft.weeks = Math.min(104, draft.weeks + 1); renderPlan() });
  stepper.append(el('strong', '', AR(draft.weeks) + (draft.weeks === 1 ? ' أسبوع' : draft.weeks === 2 ? ' أسبوعان' : draft.weeks <= 10 ? ' أسابيع' : ' أسبوعًا')), minus, plus);
  const go = el('button', 'btn primary', 'ابدأ الخطة'); go.type = 'button';
  go.addEventListener('click', () => { setPlan({ id: draft.id, weeks: draft.weeks, start: day() }); renderPlan(); onPlanChange() });
  f.append(goals, el('p', 'note', pr.desc), el('small', 'note', 'مدة الحفظ'), stepper, go);
  return f;
}

function planView(p, st) {
  const v = el('div', 'planview');
  const head = el('div', 'big'); head.append(el('b', '', AR(st.done)), el('span', '', 'من ' + AR(st.total) + ' آية في ' + st.pr.name));
  const bar = el('div', 'bar'), fill = el('i'); fill.style.width = (st.done / st.total * 100).toFixed(1) + '%'; bar.appendChild(fill);
  const facts = el('div', 'facts');
  const fact = (label, val) => { const d = el('div', 'fact'); d.append(el('small', '', label), el('strong', '', val)); return d };
  facts.append(
    fact('الورد المطلوب يوميًا', st.left === 0 ? '—' : ayahs(st.daily)),
    fact('الأيام المتبقية', AR(st.daysLeft)),
    fact('آيات متبقية', AR(st.left)));
  v.append(head, bar, facts);
  if (st.left === 0) v.appendChild(el('p', 'good', 'ما شاء الله، أتممتَ هذه الخطة كاملة. يمكنك اختيار خطة جديدة.'));
  else {
    if (st.overdue) v.appendChild(el('p', 'note', 'انتهت المدة المحددة. الورد المعروض يكفي لإنهاء المتبقي في أسبوع، أو غيّر الخطة لمدة أطول.'));
    const acts = el('div', 'acts');
    const next = el('a', 'btn primary', 'السورة التالية: ' + Q[st.next - 1].n); next.href = '#/surah/' + st.next;
    const goal = el('button', 'btn', 'اجعله وردي اليوم'); goal.type = 'button';
    goal.addEventListener('click', () => { S.goal = Math.max(1, Math.min(50, st.daily)); save(); goal.textContent = 'تم: وردك ' + ayahs(S.goal); onPlanChange() });
    acts.append(next, goal); v.appendChild(acts);
  }
  const change = el('button', 'btn', 'تغيير الخطة'); change.type = 'button';
  change.addEventListener('click', () => { setPlan(null); renderPlan(); onPlanChange() });
  v.appendChild(change);
  return v;
}

let onPlanChange = () => {};
export const onPlanChanged = fn => { onPlanChange = fn };
