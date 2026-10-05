// A one-page report for the whole family: every child side by side for the last 7 days and overall. Printable.
// It reads the same activity log as the weekly report (daily totals kept on this device).
import { $, AR, day, el, nujum } from './util.js';
import { Q } from './data.js';
import { snapshot, streakNow, weekStartOf } from './state.js';
import { weekDays, summarize } from './report.js';
import { challengeOf, targetOf, progressOf } from './challenge.js';

/** The numbers for one child object (as saved), without touching the active child. */
export function familyRow(k, dates = weekDays(0)) {
  const sum = summarize(k.log || {}, dates);
  let memorised = 0, done = 0;
  for (const [key, r] of Object.entries(k.S.s || {})) { const id = +key; if (!Q[id - 1]) continue; const m = [...r.m].filter(c => c === '1').length; memorised += m; if (m === Q[id - 1].v.length) done++ }
  const az = k.az || {}; let azDays = 0;
  for (const d of dates) if (Object.values(az[d] || {}).some(v => v.d)) azDays++;
  const ws = weekStartOf(day()), ch = challengeOf(ws), n = targetOf(ch, k);
  return {
    id: k.id, name: k.name, icon: k.icon,
    week: sum.total, activeDays: sum.activeDays, azDays,
    memorised, done, streak: streakNow(k.S, k.rest || {}), stars: ((k.game || {}).stars) || 0,
    challenge: { title: ch.title(AR(n)), v: progressOf(ch, k, ws), n, won: !!(k.wk || {})[ws] },
  };
}

export function renderFamily() {
  const box = $('famBox'); box.textContent = '';
  if (!Q.length) return;
  const dates = weekDays(0), rows = snapshot().kids.map(k => familyRow(k, dates));
  const fmt = (iso, o) => new Date(iso + 'T12:00:00').toLocaleDateString('ar-EG', o);
  box.appendChild(el('p', 'rep-brand', 'رفيق الحفظ'));
  box.appendChild(el('h1', 'rep-name', 'تقرير العائلة'));
  box.appendChild(el('p', 'rep-range', fmt(dates[0], { day: 'numeric', month: 'long' }) + ' – ' + fmt(dates[6], { day: 'numeric', month: 'long', year: 'numeric' })));

  // who memorised the most new ayat this week
  const max = Math.max(1, ...rows.map(r => r.week.a));
  const chart = el('ul', 'famchart'); chart.setAttribute('aria-label', 'الآيات الجديدة هذا الأسبوع');
  rows.forEach(r => {
    const li = el('li'), bar = el('div', 'rbar h'), fill = el('i'); fill.style.width = (r.week.a / max * 100).toFixed(0) + '%'; bar.appendChild(fill);
    li.append(el('span', 'famname', r.icon + ' ' + r.name), bar, el('b', '', AR(r.week.a)));
    chart.appendChild(li);
  });
  box.append(el('h2', '', 'الآيات الجديدة هذا الأسبوع'), chart);

  // one card per child
  const grid = el('div', 'famgrid');
  rows.forEach(r => {
    const card = el('section', 'famcard'); card.appendChild(el('h3', '', r.icon + ' ' + r.name));
    const list = el('ul', 'rrows');
    const row = (label, value) => { const li = el('li'); li.append(el('span', '', label), el('b', '', value)); list.appendChild(li) };
    row('آيات جديدة', AR(r.week.a));
    row('مراجعات للسور', AR(r.week.r));
    row('آيات تم تثبيتها', AR(r.week.w));
    row('أيام النشاط', AR(r.activeDays) + ' من ٧');
    row('أيام أنهى فيها أذكارًا', AR(r.azDays) + ' من ٧');
    row('نجوم الألعاب (الإجمالي)', nujum(r.stars));
    row('الآيات المحفوظة', AR(r.memorised) + ' من ' + AR(6236));
    row('السور المكتملة', AR(r.done) + ' من ' + AR(114));
    row('الأيام المتتالية الآن', AR(r.streak));
    row('تحدّي الأسبوع', r.challenge.won ? 'أُنجز ✓' : AR(r.challenge.v) + ' من ' + AR(r.challenge.n));
    card.appendChild(list); grid.appendChild(card);
  });
  box.append(el('h2', '', 'كل طفل'), grid);
  box.appendChild(el('p', 'rep-note', 'طُبع في ' + fmt(day(), { day: 'numeric', month: 'long', year: 'numeric' }) + '. الأرقام مجاميع يومية يسجّلها الموقع على هذا الجهاز، وليست تقييمًا للحفظ نفسه.'));
}
