// Memorisation plan: a goal (a ready one or surahs the parent picks), a number of weeks and which days are for memorising,
// reviewing or resting. The page works out the daily amount and the next surah. Progress always comes from what is really
// memorised, so changing or stretching a plan never wipes anything, and a late plan is spread over more days, not piled onto one.
import { $, AR, ayahs, day, el, icon } from './util.js';
import { Q } from './data.js';
import { S, mem, save, kidPlan, setPlan } from './state.js';

/** Surah ranges are by surah number. Juz' Amma is memorised from An-Nas upward, as children usually do. */
export const PRESETS = {
  amma: { name: 'جزء عمّ', from: 78, to: 114, desc: 'من سورة النبأ إلى سورة الناس، نبدأ بالقصار', order: 'desc', weeks: 8 },
  tabarak: { name: 'جزء تبارك', from: 67, to: 77, desc: 'من سورة الملك إلى سورة المرسلات', order: 'asc', weeks: 8 },
  both: { name: 'جزء عمّ وتبارك', from: 67, to: 114, desc: 'من سورة الملك إلى سورة الناس', order: 'desc', weeks: 16 },
  qisar: { name: 'قصار السور', from: 93, to: 114, desc: 'من سورة الضحى إلى سورة الناس: أقصر السور وأسهلها للبداية', order: 'desc', weeks: 6 },
};
export const MAX_CUSTOM = 30, MAX_WEEKS = 104;
/** The days of the week as the plan sees them: index = JS getDay() (Sunday is 0). m = memorise, r = review only, x = rest. */
export const DAY_KINDS = { m: 'حفظ', r: 'مراجعة', x: 'راحة' };
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];            // the Arabic week starts on Saturday
export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ALL_M = 'mmmmmmm';
export const validDays = d => typeof d === 'string' && /^[mrx]{7}$/.test(d) && d.includes('m');

const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return d };
const diffDays = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A plan as it may be stored: unknown fields dropped, every value checked. Returns null when it cannot be a plan. */
export function cleanPlan(p) {
  if (!p || typeof p !== 'object' || !DATE.test(p.start) || !Number.isInteger(p.weeks) || p.weeks < 1 || p.weeks > MAX_WEEKS) return null;
  const out = { id: p.id, weeks: p.weeks, start: p.start };
  if (p.id === 'custom') {
    if (!Array.isArray(p.s)) return null;
    const s = [...new Set(p.s.filter(n => Number.isInteger(n) && n >= 1 && n <= 114))].slice(0, MAX_CUSTOM);
    if (!s.length) return null;
    out.s = s; out.o = ['short', 'asc', 'desc'].includes(p.o) ? p.o : 'short';
  } else if (typeof p.id !== 'string' || !Object.hasOwn(PRESETS, p.id)) return null;
  if (validDays(p.d) && p.d !== ALL_M) out.d = p.d;
  if (Number.isInteger(p.a) && p.a >= 1 && p.a <= 300) out.a = p.a;
  return out;
}

/** The surah ids of a plan, in the order they are memorised. */
export function planIds(p) {
  if (p.id === 'custom') {
    const ids = [...p.s];
    if (p.o === 'desc') ids.sort((a, b) => b - a); else if (p.o === 'asc') ids.sort((a, b) => a - b);
    else ids.sort((a, b) => Q[a - 1].v.length - Q[b - 1].v.length || a - b);
    return ids;
  }
  const pr = PRESETS[p.id], ids = []; for (let i = pr.from; i <= pr.to; i++) ids.push(i);
  return pr.order === 'desc' ? ids.reverse() : ids;
}

/** How many days from `from` (included) up to `to` (excluded) are memorising days. */
export function memDays(from, to, mask = ALL_M) {
  let n = 0; const total = diffDays(from, to);
  for (let k = 0; k < total; k++) if (mask[addDays(from, k).getDay()] === 'm') n++;
  return n;
}
const maskOf = p => (validDays(p.d) ? p.d : ALL_M);
export const kindOn = (p, iso = day()) => maskOf(p)[new Date(iso + 'T12:00').getDay()];

/** Progress against a plan: ayat left, ayat per memorising day needed, days left, the next surah, and whether the plan is late. */
export function planStats(p) {
  if (!p || !Q.length) return null;
  const clean = cleanPlan(p); if (!clean) return null;
  p = clean;
  const pr = p.id === 'custom' ? { name: 'سوري المختارة' } : PRESETS[p.id];
  const ids = planIds(p);
  let total = 0, left = 0;
  ids.forEach(id => { const t = Q[id - 1].v.length; total += t; left += t - mem(id) });
  const mask = maskOf(p), end = ymd(addDays(p.start, p.weeks * 7)), daysLeft = Math.max(0, diffDays(day(), end));
  const mLeft = memDays(day(), end, mask);
  const daily = left === 0 ? 0 : mLeft > 0 ? Math.ceil(left / mLeft) : left;
  const next = ids.find(id => mem(id) < Q[id - 1].v.length) || 0;
  const pace = p.a || Math.max(1, Math.ceil(total / Math.max(1, memDays(p.start, end, mask))));   // the pace the plan was made for
  return { pr, total, left, done: total - left, end, daysLeft, daily, next, overdue: left > 0 && daysLeft === 0, memDaysLeft: mLeft, kindToday: kindOn(p), pace, behind: left > 0 && daily >= pace + Math.max(2, Math.ceil(pace * 0.2)), ids };
}

/** Spreads a late plan over more weeks, at the pace it was made for. Never touches progress and never raises today's amount. Returns {plan, added} or null. */
export function redistribute(p) {
  const st = planStats(p); if (!st || !st.left) return null;
  const clean = cleanPlan(p), mask = maskOf(clean);
  let weeks = clean.weeks;
  while (weeks < MAX_WEEKS) {
    const end = ymd(addDays(clean.start, weeks * 7)), m = memDays(day(), end, mask);
    if (m > 0 && Math.ceil(st.left / m) <= st.pace) break;
    weeks++;
  }
  if (weeks === clean.weeks) return null;
  return { plan: { ...clean, weeks, a: st.pace }, added: weeks - clean.weeks };
}

/** Weeks needed to memorise `total` ayat at `amount` per memorising day (for the "set the amount" control). */
export function weeksFor(total, amount, mask = ALL_M) {
  const perWeek = [...mask].filter(c => c === 'm').length * Math.max(1, amount);
  return Math.max(1, Math.min(MAX_WEEKS, Math.ceil(total / perWeek)));
}

/* ---------- the page ---------- */
let draft = { id: 'amma', weeks: 8, s: [], o: 'short', d: ALL_M, filter: '' };
let onPlanChange = () => {};
export const onPlanChanged = fn => { onPlanChange = fn };

export function renderPlan() {
  const box = $('planBox'); box.textContent = '';
  if (!Q.length) return;
  const p = kidPlan(), st = p && planStats(p);
  if (st) box.appendChild(planView(p, st)); else box.appendChild(planForm());
}

const weeksText = n => AR(n) + (n === 1 ? ' أسبوع' : n === 2 ? ' أسبوعان' : n <= 10 ? ' أسابيع' : ' أسبوعًا');
const stepper = (label, value, onMinus, onPlus) => {
  const row = el('div', 'stepper'), minus = el('button', 'btn'), plus = el('button', 'btn'), v = el('p', 'goalnum', value);
  minus.type = plus.type = 'button'; minus.append(icon('minus')); plus.append(icon('plus'));
  minus.setAttribute('aria-label', 'تقليل ' + label); plus.setAttribute('aria-label', 'زيادة ' + label);
  minus.addEventListener('click', onMinus); plus.addEventListener('click', onPlus); v.setAttribute('aria-live', 'polite');
  row.append(minus, v, plus); return row;
};
const draftPlan = () => ({ id: draft.id, weeks: draft.weeks, start: day(), ...(draft.id === 'custom' ? { s: draft.s, o: draft.o } : {}), d: draft.d });

function planForm() {
  const f = el('div', 'planform');
  f.appendChild(el('p', 'note', 'اختر هدفك، ثم المدة وأيام الحفظ، وسنحسب لك الورد اليومي. خطوة صغيرة كل يوم تكفي.'));
  const goals = el('div', 'icons'); goals.setAttribute('role', 'group'); goals.setAttribute('aria-label', 'الهدف');
  const pick = (id, label, weeks) => {
    const b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', id === draft.id);
    b.addEventListener('click', () => { draft.id = id; if (weeks) draft.weeks = weeks; renderPlan() }); goals.appendChild(b);
  };
  Object.entries(PRESETS).forEach(([id, pr]) => pick(id, pr.name, pr.weeks));
  pick('custom', 'سور أختارها', 0);
  f.appendChild(goals);
  const total = draft.id === 'custom' ? draft.s.reduce((t, id) => t + Q[id - 1].v.length, 0) : planIds({ id: draft.id }).reduce((t, id) => t + Q[id - 1].v.length, 0);
  if (draft.id === 'custom') f.appendChild(customPicker()); else f.appendChild(el('p', 'note', PRESETS[draft.id].desc));

  const mask = draft.d;
  const perWeek = [...mask].filter(c => c === 'm').length;
  f.appendChild(el('h2', 'sub', 'مدة الحفظ'));
  f.appendChild(stepper('المدة', weeksText(draft.weeks), () => { draft.weeks = Math.max(1, draft.weeks - 1); renderPlan() }, () => { draft.weeks = Math.min(MAX_WEEKS, draft.weeks + 1); renderPlan() }));
  const amount = total ? Math.ceil(total / (draft.weeks * perWeek)) : 0;
  f.appendChild(el('h2', 'sub', 'الورد في يوم الحفظ'));
  f.appendChild(stepper('الورد', total ? ayahs(amount) : '—',
    () => { if (total) { draft.weeks = weeksFor(total, Math.max(1, amount - 1), mask); renderPlan() } },
    () => { if (total) { draft.weeks = weeksFor(total, amount + 1, mask); renderPlan() } }));
  f.appendChild(el('p', 'note', 'غيّر المدة أو الورد، وأحدهما يتبع الآخر. المجموع: ' + ayahs(total) + '.'));

  f.appendChild(el('h2', 'sub', 'أيام الأسبوع'));
  const week = el('div', 'weekdays'); week.setAttribute('role', 'group'); week.setAttribute('aria-label', 'نوع كل يوم');
  WEEK_ORDER.forEach(d => {
    const kind = mask[d], b = el('button', 'daykind'); b.type = 'button'; b.dataset.kind = kind;
    b.append(el('b', '', DAY_NAMES[d]), el('span', '', DAY_KINDS[kind]));
    b.setAttribute('aria-label', DAY_NAMES[d] + ': ' + DAY_KINDS[kind] + '. اضغط للتغيير');
    b.addEventListener('click', () => {
      const order = ['m', 'r', 'x'], next = order[(order.indexOf(kind) + 1) % 3], m2 = mask.slice(0, d) + next + mask.slice(d + 1);
      if (validDays(m2)) { draft.d = m2; renderPlan() } else { msg.textContent = 'يلزم يوم واحد على الأقل للحفظ.' }
    });
    week.appendChild(b);
  });
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  f.append(week, msg);

  const go = el('button', 'btn primary', 'ابدأ الخطة'); go.type = 'button';
  go.addEventListener('click', () => {
    if (draft.id === 'custom' && !draft.s.length) { msg.textContent = 'اختر سورة واحدة على الأقل.'; return }
    const plan = cleanPlan({ ...draftPlan(), a: Math.max(1, amount) }); if (!plan) { msg.textContent = 'تعذّر إنشاء الخطة.'; return }
    setPlan(plan); renderPlan(); onPlanChange();
  });
  f.appendChild(go);
  return f;
}

/** The picker for "surahs I choose": a filter box and a list of checkboxes, with the order they will be memorised in. */
function customPicker() {
  const box = el('div', 'custompick');
  const q = el('input', 'search'); q.type = 'search'; q.placeholder = 'ابحث عن سورة'; q.setAttribute('aria-label', 'ابحث عن سورة لإضافتها'); q.value = draft.filter;
  const list = el('ul', 'pickgrid'); list.setAttribute('aria-label', 'السور');
  const paint = () => {
    list.textContent = '';
    const f = q.value.trim();
    Q.forEach((c, k) => {
      const id = k + 1; if (f && !c.n.includes(f) && String(id) !== f && AR(id) !== f) return;
      const li = el('li'), lab = el('label', 'pickrow'), cb = el('input'); cb.type = 'checkbox'; cb.checked = draft.s.includes(id);
      cb.addEventListener('change', () => {
        if (cb.checked && draft.s.length >= MAX_CUSTOM) { cb.checked = false; sum.textContent = 'الحد الأقصى ' + AR(MAX_CUSTOM) + ' سورة في الخطة الواحدة.'; return }
        draft.s = cb.checked ? [...draft.s, id] : draft.s.filter(x => x !== id); draft.filter = q.value; renderPlan();
      });
      lab.append(cb, el('span', '', 'سورة ' + c.n), el('small', '', AR(c.v.length) + ' آية')); li.appendChild(lab); list.appendChild(li);
    });
  };
  q.addEventListener('input', () => { draft.filter = q.value; paint() });
  const sum = el('p', 'note', draft.s.length ? 'اخترتَ ' + AR(draft.s.length) + ' سورة.' : 'لم تختر سورًا بعد.'); sum.setAttribute('role', 'status');
  const order = el('div', 'icons'); order.setAttribute('role', 'group'); order.setAttribute('aria-label', 'ترتيب الحفظ');
  [['short', 'الأقصر أولًا'], ['asc', 'ترتيب المصحف'], ['desc', 'عكس المصحف']].forEach(([id, label]) => {
    const b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', id === draft.o);
    b.addEventListener('click', () => { draft.o = id; renderPlan() }); order.appendChild(b);
  });
  paint(); box.append(q, list, sum, order);
  return box;
}

function planView(p, st) {
  const v = el('div', 'planview');
  const head = el('div', 'big'); head.append(el('b', '', AR(st.done)), el('span', '', 'من ' + AR(st.total) + ' آية في ' + st.pr.name));
  const bar = el('div', 'bar'), fill = el('i'); fill.style.width = (st.done / st.total * 100).toFixed(1) + '%'; bar.appendChild(fill);
  const facts = el('div', 'facts');
  const fact = (label, val) => { const d = el('div', 'fact'); d.append(el('small', '', label), el('strong', '', val)); return d };
  facts.append(
    fact('الورد في يوم الحفظ', st.left === 0 ? '—' : ayahs(st.daily)),
    fact('الأيام المتبقية', AR(st.daysLeft)),
    fact('آيات متبقية', AR(st.left)));
  v.append(head, bar, facts);
  if (st.left > 0) v.appendChild(el('p', 'note', ({ m: 'اليوم يوم حفظ في خطتك.', r: 'اليوم يوم مراجعة في خطتك: راجع ما حفظتَه ولا تحفظ جديدًا إن شئت.', x: 'اليوم يوم راحة في خطتك. استرح، وإن أحببت فراجع قليلًا.' })[st.kindToday]));
  if (st.left === 0) v.appendChild(el('p', 'good', 'ما شاء الله، أتممتَ هذه الخطة كاملة. يمكنك اختيار خطة جديدة.'));
  else {
    if (st.behind || st.overdue) {
      const late = el('div', 'planlate');
      late.appendChild(el('p', '', st.overdue ? 'انتهت المدة المحددة وما زال ' + ayahs(st.left) + ' متبقية.' : 'أنت متأخر عن وتيرة خطتك: الورد المطلوب الآن ' + ayahs(st.daily) + ' بدل ' + ayahs(st.pace) + '.'));
      late.appendChild(el('p', 'note', 'يمكنك مدّ المدة ليعود الورد إلى ' + ayahs(st.pace) + '. هذا لا يمسح ما حفظتَه ولا يضاعف ورد اليوم.'));
      const re = redistribute(p);
      if (re) {
        const b = el('button', 'btn primary', 'أعد توزيع الخطة (إضافة ' + weeksText(re.added) + ')'); b.type = 'button'; b.id = 'planRedistribute';
        b.addEventListener('click', () => { setPlan(re.plan); renderPlan(); onPlanChange() });
        late.appendChild(b);
      }
      v.appendChild(late);
    }
    const acts = el('div', 'acts');
    const next = el('a', 'btn primary', 'السورة التالية: ' + Q[st.next - 1].n); next.href = '#/surah/' + st.next;
    const goal = el('button', 'btn', 'اجعله وردي اليوم'); goal.type = 'button';
    goal.addEventListener('click', () => { S.goal = Math.max(1, Math.min(50, st.daily)); save(); goal.textContent = 'تم: وردك ' + ayahs(S.goal); onPlanChange() });
    acts.append(next, goal); v.appendChild(acts);
  }
  const change = el('button', 'btn', 'تغيير الخطة'); change.type = 'button';
  change.addEventListener('click', () => { if (st.done && !confirm('تغيير الخطة لا يمسح ما حفظتَه، فتقدّمك يبقى. هل تريد اختيار خطة أخرى؟')) return; setPlan(null); renderPlan(); onPlanChange() });
  v.appendChild(change);
  return v;
}
