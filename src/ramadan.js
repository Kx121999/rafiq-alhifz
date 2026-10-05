// Ramadan with the site: the Hijri date comes from the browser's own Umm al-Qura calendar (nothing is fetched), a 30-day tracker
// fills in by itself from what the child did each day (a new ayah, a review, adhkar or a game), and medals reward steadiness.
// The calendar is calculated, so a country that sights the moon can differ by a day: a parent can shift it by one day.
// Nothing here is religious text; it is a calendar and a habit tracker.
import { $, AR, day, el, shiftDay, charImg } from './util.js';
import { activeKid, setRamadanDays } from './state.js';

const SHIFT_KEY = 'hifz-hijri-shift-v1';
export const hijriShift = () => { try { const v = Number(localStorage.getItem(SHIFT_KEY)); return v === -1 || v === 1 ? v : 0 } catch (e) { return 0 } };
export function setHijriShift(n) { try { if (n === -1 || n === 1) localStorage.setItem(SHIFT_KEY, String(n)); else localStorage.removeItem(SHIFT_KEY) } catch (e) {} }

const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
/** The Hijri date {y, m, d} of a Gregorian date (YYYY-MM-DD), moved by shift days (-1, 0 or +1) for local moon sighting. */
export function hijriOf(iso, shift = 0) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(shiftDay(iso, shift) + 'T12:00:00')).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day };
}

export const HIJRI_MONTHS = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة'];
export const hijriText = h => AR(h.d) + ' ' + HIJRI_MONTHS[h.m - 1] + ' ' + AR(h.y).replace(/٬/g, '') + ' هـ';

/**
 * The Ramadan of the current Hijri year: its dates, and where today stands.
 * phase: 'before' (it has not started), 'during', or 'after'. dayNo is today's number inside Ramadan (during only).
 */
let cache = { key: '', w: null };
export function ramadanWindow(today = day(), shift = hijriShift()) {
  const key = today + '|' + shift;
  if (cache.key !== key) cache = { key, w: findWindow(today, shift) };     // about 700 calendar lookups: do it once per day
  return cache.w;
}
function findWindow(today, shift) {
  const now = hijriOf(today, shift);
  let start = null;
  for (let i = -330; i <= 400 && !start; i++) { const d = shiftDay(today, i), h = hijriOf(d, shift); if (h.y === now.y && h.m === 9 && h.d === 1) start = d }
  if (!start) return null;
  const days = [start];
  for (let i = 1; i < 31; i++) { const d = shiftDay(start, i); if (hijriOf(d, shift).m !== 9) break; days.push(d) }
  const idx = days.indexOf(today);
  const phase = today < start ? 'before' : today > days[days.length - 1] ? 'after' : 'during';
  const dayAfter = shiftDay(days[days.length - 1], 1);
  return {
    year: now.y, start, end: days[days.length - 1], days, phase,
    dayNo: idx >= 0 ? idx + 1 : 0,
    daysUntil: phase === 'before' ? Math.round((new Date(start + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5) : 0,
    daysSinceEnd: phase === 'after' ? Math.round((new Date(today + 'T12:00:00') - new Date(dayAfter + 'T12:00:00')) / 864e5) + 1 : 0,
  };
}

/** Is the banner shown on the dashboard? A few weeks before, during, and a week after. */
export const showBanner = w => !!w && ((w.phase === 'before' && w.daysUntil <= 21) || w.phase === 'during' || (w.phase === 'after' && w.daysSinceEnd <= 7));

/** Did this child do something on that date? A new ayah, a review, a weak ayah mastered, game stars, or a finished adhkar list. */
export function activeOn(k, iso) {
  const e = (k.log || {})[iso];
  if (e && (e.a || e.r || e.w || e.g)) return true;
  return Object.values((k.az || {})[iso] || {}).some(v => v && v.d);
}

/** The tracker: one entry per day of Ramadan. state: 'done' | 'missed' | 'today' | 'future'. */
export function trackerOf(k, w, today = day()) {
  const per = w.days.map((iso, i) => {
    const done = activeOn(k, iso);
    return { iso, no: i + 1, state: done ? 'done' : iso === today ? 'today' : iso > today ? 'future' : 'missed' };
  });
  return { per, active: per.filter(p => p.state === 'done').length };
}

/** Remembers the child's best Ramadan so far (for the medals), once Ramadan has begun. */
export function recordRamadan(today = day()) {
  const k = activeKid(); if (!k) return 0;
  const w = ramadanWindow(today); if (!w || w.phase === 'before') return 0;
  const n = trackerOf(k, w, today).active;
  if (n) setRamadanDays(w.year, n);
  return n;
}

export function renderRamadan() {
  const box = $('ramBox'); box.textContent = '';
  const k = activeKid(); if (!k) return;
  const w = ramadanWindow(), shift = hijriShift(), todayH = hijriOf(day(), shift);
  if (!w) { box.appendChild(el('p', 'empty', 'تعذّر حساب التاريخ الهجري في هذا المتصفح.')); return }
  const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });

  const card = el('section', 'ramcard');
  const ic = el('span', 'chicon', '🌙'); ic.setAttribute('aria-hidden', 'true');
  card.append(ic, el('h2', '', w.phase === 'during' ? 'اليوم ' + AR(w.dayNo) + ' من رمضان' : w.phase === 'before' ? 'رمضان بعد ' + (w.daysUntil === 1 ? 'يوم واحد' : w.daysUntil === 2 ? 'يومين' : AR(w.daysUntil) + (w.daysUntil <= 10 ? ' أيام' : ' يومًا')) : 'انتهى رمضان'));
  card.appendChild(el('p', 'note', 'اليوم: ' + hijriText(todayH) + '. رمضان ' + AR(w.year).replace(/٬/g, '') + ' هـ من ' + fmtDate(w.start) + ' إلى ' + fmtDate(w.end) + ' (بحسب التقويم المحسوب).'));
  if (w.phase === 'after') card.appendChild(el('p', 'good', 'كل عام وأنتم بخير! 🌙'));
  box.appendChild(card);

  if (w.phase !== 'before') {
    const t = trackerOf(k, w), sec = el('section', 'ramtrack');
    sec.append(el('h2', '', 'تحدّي رمضان'), el('p', 'note', 'اجعل لك نشاطًا واحدًا كل يوم: آية جديدة أو مراجعة أو أذكارًا أو لعبة. تُملأ الأيام تلقائيًا.'));
    const grid = el('ol', 'ramgrid'); grid.setAttribute('aria-label', 'أيام رمضان');
    t.per.forEach(p => {
      const li = el('li', 'ramday ' + p.state, AR(p.no));
      const word = p.state === 'done' ? 'أنجزتَ نشاطًا' : p.state === 'missed' ? 'لم يُسجَّل نشاط' : p.state === 'today' ? 'اليوم' : 'لم يحن بعد';
      li.setAttribute('aria-label', 'اليوم ' + AR(p.no) + ': ' + word); if (p.state === 'done') li.appendChild(el('span', 'ramtick', '✓')); grid.appendChild(li);
    });
    sec.append(grid, el('p', 'chweeks', '🌙 أنجزتَ ' + AR(t.active) + ' من ' + AR(w.days.length) + ' يومًا.'));
    sec.appendChild(el('p', 'note', 'الأوسمة: «رمضان معنا» عند ' + AR(10) + ' أيام، و«بطل رمضان» عند ' + AR(25) + ' يومًا.'));
    box.appendChild(sec);
  } else {
    box.appendChild(el('p', 'note', 'عندما يبدأ الشهر ستجد هنا تحدّي رمضان: نشاط واحد كل يوم يملأ لك لوحة الأيام ويفتح أوسمة خاصة.'));
  }

  // moon sighting: shift the calendar by a day
  const adj = el('section', 'ramadj');
  adj.append(el('h2', '', 'هل يختلف التاريخ في بلدك؟'), el('p', 'note', 'التقويم هنا محسوب (أم القرى) وقد يختلف يومًا عن إعلان بلدك. اضبطه هنا ويُحفظ على هذا الجهاز.'));
  const row = el('div', 'icons'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'ضبط التاريخ الهجري');
  [[-1, 'يوم أقل'], [0, 'كما هو'], [1, 'يوم أكثر']].forEach(([v, label]) => {
    const b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', v === shift);
    b.addEventListener('click', () => { setHijriShift(v); recordRamadan(); renderRamadan(); document.dispatchEvent(new Event('hifz-ramadan')) });
    row.appendChild(b);
  });
  adj.appendChild(row); box.appendChild(adj);
}

/** The line at the top of the dashboard's "today" card, or null when it is not the season. */
export function ramadanLine() {
  const k = activeKid(), w = ramadanWindow(); if (!k || !showBanner(w)) return null;
  const a = el('a', 'rambanner'); a.href = '#/ramadan';
  a.append(charImg('fanous', 'mini'));
  const t = el('span', ''), b = el('b', '', w.phase === 'during' ? 'رمضان كريم 🌙 اليوم ' + AR(w.dayNo) + ' من ' + AR(w.days.length) : w.phase === 'before' ? 'يقترب رمضان 🌙 بعد ' + AR(w.daysUntil) + (w.daysUntil === 1 ? ' يوم' : w.daysUntil <= 10 ? ' أيام' : ' يومًا') : 'كل عام وأنتم بخير 🌙');
  t.append(b, el('small', '', w.phase === 'before' ? 'استعدّ لتحدّي رمضان' : 'افتح تحدّي رمضان'));
  a.appendChild(t); return a;
}
