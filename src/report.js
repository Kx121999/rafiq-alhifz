// Weekly report for a parent: what the active child did in a 7-day window, plus where they stand overall.
// It reads the activity log (daily totals), so it only knows about days since the log started.
import { $, AR, ayahs, day, el, nujum, shiftDay } from './util.js';
import { Q } from './data.js';
import { S, activeKid, activityLog, mem, kidPlan, weakList } from './state.js';
import { planStats } from './plan.js';
import { dueList } from './review.js';

const MAX_OFFSET = 12;

/** The 7 ISO dates of a week, oldest first. offset 0 = the 7 days ending today, 1 = the 7 days before that. */
export function weekDays(offset = 0) {
  const end = shiftDay(day(), -7 * offset);
  return Array.from({ length: 7 }, (_, k) => shiftDay(end, k - 6));
}

/** Per-day figures for the given dates, their totals and how many days had any activity. */
export function summarize(log, dates) {
  const per = dates.map(d => ({ d, a: 0, r: 0, w: 0, g: 0, ...(log[d] || {}) }));
  const total = per.reduce((t, p) => ({ a: t.a + p.a, r: t.r + p.r, w: t.w + p.w, g: t.g + p.g }), { a: 0, r: 0, w: 0, g: 0 });
  return { per, total, activeDays: per.filter(p => p.a || p.r || p.w || p.g).length };
}

const fmt = (iso, opts) => new Date(iso + 'T12:00:00').toLocaleDateString('ar-EG', opts);

export function renderReport(offset = 0) {
  const box = $('reportBox'); box.textContent = '';
  const k = activeKid(); if (!k || !Q.length) return;
  offset = Math.max(0, Math.min(MAX_OFFSET, Math.floor(offset) || 0));
  const dates = weekDays(offset), log = activityLog(), sum = summarize(log, dates);

  box.appendChild(el('p', 'rep-brand', 'رفيق الحفظ · التقرير الأسبوعي'));
  box.appendChild(el('h1', 'rep-name', k.icon + ' ' + k.name));
  box.appendChild(el('p', 'rep-range', fmt(dates[0], { day: 'numeric', month: 'long' }) + ' – ' + fmt(dates[6], { day: 'numeric', month: 'long', year: 'numeric' })));

  const tiles = el('div', 'rtiles');
  const tile = (label, value) => { const t = el('div', 'rtile'); t.append(el('b', '', value), el('small', '', label)); tiles.appendChild(t) };
  tile('آيات جديدة حُفظت', AR(sum.total.a));
  tile('مراجعات للسور', AR(sum.total.r));
  tile('آيات تم تثبيتها', AR(sum.total.w));
  tile('أيام النشاط', AR(sum.activeDays) + ' من ٧');
  tile('نجوم الألعاب', AR(sum.total.g));
  box.appendChild(tiles);

  // one bar per day for new ayat
  const max = Math.max(1, ...sum.per.map(p => p.a));
  const chart = el('div', 'rchart'); chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', 'آيات جديدة في كل يوم: ' + sum.per.map(p => fmt(p.d, { weekday: 'long' }) + ' ' + AR(p.a)).join('، '));
  sum.per.forEach(p => {
    const col = el('div', 'rcol'), bar = el('div', 'rbar'), fill = el('i'); fill.style.height = (p.a / max * 100).toFixed(0) + '%'; bar.appendChild(fill);
    col.append(el('b', '', p.a ? AR(p.a) : ''), bar, el('small', '', fmt(p.d, { weekday: 'short' })));
    chart.appendChild(col);
  });
  box.append(el('h2', '', 'الآيات الجديدة يوميًا'), chart);

  // overall standing (now, not per week)
  let memorised = 0, done = 0;
  Q.forEach((c, i) => { const m = mem(i + 1); memorised += m; if (m === c.v.length) done++ });
  const streak = (S.last === day() || S.last === day(-1)) ? S.streak : 0;
  const rows = el('ul', 'rrows');
  const row = (label, value) => { const li = el('li'); li.append(el('span', '', label), el('b', '', value)); rows.appendChild(li) };
  row('الآيات المحفوظة إجمالًا', AR(memorised) + ' من ' + AR(6236));
  row('السور المكتملة', AR(done) + ' من ' + AR(114));
  row('الأيام المتتالية الآن', AR(streak));
  const due = dueList().length;
  row('مراجعات مستحقة الآن', due ? AR(due) + (due === 1 ? ' سورة' : ' سور') : 'لا توجد');
  const weak = weakList().length;
  row('آيات تحتاج تثبيتًا', weak ? ayahs(weak) : 'لا توجد');
  row('نجوم الألعاب (الإجمالي)', nujum(((k.game || {}).stars) || 0));
  const p = kidPlan(), st = p && planStats(p);
  if (st) row('الخطة: ' + st.pr.name, st.left === 0 ? 'اكتملت' : AR(st.done) + ' من ' + AR(st.total) + ' آية · الورد المطلوب ' + ayahs(st.daily));
  box.append(el('h2', '', 'الوضع الحالي'), rows);

  const empty = !Object.keys(log).length
    ? 'سجل النشاط يبدأ من أول مرة يُستخدم فيها الموقع بعد إضافة التقرير، لذلك لا توجد بيانات للأيام السابقة.'
    : (!sum.activeDays ? 'لا يوجد نشاط مسجّل في هذه الفترة.' : '');
  if (empty) box.appendChild(el('p', 'rep-note', empty));
  box.appendChild(el('p', 'rep-note', 'طُبع في ' + fmt(day(), { day: 'numeric', month: 'long', year: 'numeric' }) + '. الأرقام مجاميع يومية يسجّلها الموقع على هذا الجهاز، وليست تقييمًا للحفظ نفسه.'));

  // week switcher
  document.querySelectorAll('#repWeeks a').forEach(a => {
    const on = Number(a.dataset.off) === offset;
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
}
