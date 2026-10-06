// Medals. Each one has a plain reason (what it asks for, and what the child did to earn it), a progress count for the
// ones not yet earned, and the day it was first earned when that is known. Whether a medal is earned is read from the child's
// real data; the few that depend on a streak or on the last 60 days of adhkar stay earned once they were (their day is saved
// in the optional field bd). Nothing here is religious text and no medal is ever handed out for nothing.
import { $, AR, day } from './util.js';
import { Q } from './data.js';
import { announce } from './motion.js';
import { mem, gameStars, azStats, streakNow, weeksDone, famWeeks, ramBest, activeKid, badgeDates, setBadgeDate } from './state.js';

export function totals() {
  let ay = 0, done = 0;
  Q.forEach((c, k) => { const m = mem(k + 1); ay += m; if (m === c.v.length) done++ });
  return { ay, done, streak: streakNow(), games: gameStars(), az: azStats(), weeks: weeksDone(), fam: famWeeks(), ram: ramBest() };
}

/** icon: the emoji used only on the picture that can be shared; ic: the sprite icon used on the pages; sticky: stays earned once earned. */
const M = (name, ic, icon, need, why, ok, prog, extra = {}) => ({ name, ic, icon, need, why, ok, prog, ...extra });
export const BADGES = [
  M('البداية', 'sprout', '🌱', 'علّم أول آية تحفظها', 'علّمتَ أول آية محفوظة', t => t.ay >= 1, t => [t.ay, 1, 'آية']),
  M('عشر آيات', 'star', '🌟', 'احفظ عشر آيات', 'حفظتَ عشر آيات', t => t.ay >= 10, t => [t.ay, 10, 'آية']),
  M('سورة كاملة', 'medal', '🏅', 'أكمل حفظ سورة كاملة', 'أكملتَ حفظ سورة كاملة', t => t.done >= 1, t => [t.done, 1, 'سورة']),
  M('خمس سور', 'trophy', '🏆', 'أكمل حفظ خمس سور', 'أكملتَ حفظ خمس سور', t => t.done >= 5, t => [t.done, 5, 'سورة']),
  M('أسبوع متواصل', 'flame', '🔥', 'تابع الحفظ سبعة أيام متتالية', 'تابعتَ الحفظ سبعة أيام متتالية', t => t.streak >= 7, t => [t.streak, 7, 'يوم'], { sticky: true }),
  M('مئة آية', 'crown', '👑', 'احفظ مئة آية', 'حفظتَ مئة آية', t => t.ay >= 100, t => [t.ay, 100, 'آية']),
  M('لاعب نشيط', 'gamepad', '🎮', 'اجمع عشر نجوم من الألعاب', 'جمعتَ عشر نجوم من الألعاب', t => t.games >= 10, t => [t.games, 10, 'نجمة']),
  M('بطل الألعاب', 'target', '🎯', 'اجمع خمسين نجمة من الألعاب', 'جمعتَ خمسين نجمة من الألعاب', t => t.games >= 50, t => [t.games, 50, 'نجمة']),
  M('أذكار الصباح', 'sunrise', '🌅', 'أنهِ أذكار الصباح مرة', 'أنهيتَ أذكار الصباح', t => t.az.sabah, t => [t.az.sabah ? 1 : 0, 1, 'مرة'], { sticky: true }),
  M('أذكار المساء', 'moon', '🌙', 'أنهِ أذكار المساء مرة', 'أنهيتَ أذكار المساء', t => t.az.masaa, t => [t.az.masaa ? 1 : 0, 1, 'مرة'], { sticky: true }),
  M('أذكار النوم', 'bed', '😴', 'أنهِ أذكار النوم مرة', 'أنهيتَ أذكار النوم', t => t.az.nawm, t => [t.az.nawm ? 1 : 0, 1, 'مرة'], { sticky: true }),
  M('ملتزم بالأذكار', 'beads', '📿', 'أنهِ الأذكار في سبعة أيام', 'أنهيتَ الأذكار في سبعة أيام', t => t.az.days >= 7, t => [t.az.days, 7, 'يوم'], { sticky: true }),
  M('بطل الأسبوع', 'trophy', '🏆', 'أتمّ تحدّي أسبوع', 'أتممتَ تحدّي أسبوع', t => t.weeks >= 1, t => [t.weeks, 1, 'أسبوع']),
  M('ملك التحديات', 'crown', '👑', 'أتمّ تحدّي أربعة أسابيع', 'أتممتَ تحدّي أربعة أسابيع', t => t.weeks >= 4, t => [t.weeks, 4, 'أسبوع']),
  M('أسرة متعاونة', 'heart', '🤝', 'أتمّوا تحدّي العائلة مرة', 'أتممتم تحدّي العائلة معًا', t => t.fam >= 1, t => [t.fam, 1, 'مرة']),
  M('رمضان معنا', 'calendar', '🌙', 'أكمل عشرة أيام في رمضان', 'أكملتَ عشرة أيام في رمضان', t => t.ram >= 10, t => [t.ram, 10, 'يوم']),
  M('بطل رمضان', 'lantern', '🏮', 'أكمل خمسة وعشرين يومًا في رمضان', 'أكملتَ خمسة وعشرين يومًا في رمضان', t => t.ram >= 25, t => [t.ram, 25, 'يوم']),
];

const earned = (b, t, bd) => b.ok(t) || (!!b.sticky && !!bd[b.name]);
/** The day a medal was first earned: the saved day, or, for the challenge and family medals, the week that is already recorded. '' when it is not known. */
function dateOf(b, bd) {
  const k = activeKid() || {};
  const weeks = Object.keys(k.wk || {}).sort(), fams = Object.keys(k.fam || {}).sort();
  if (b.name === 'بطل الأسبوع' && weeks[0]) return weeks[0];
  if (b.name === 'ملك التحديات' && weeks[3]) return weeks[3];
  if (b.name === 'أسرة متعاونة' && fams[0]) return fams[0];
  const d = bd[b.name]; return d && d !== '0' ? d : '';
}

/** Every medal with what the pages need: earned or not, its date, progress and reason. */
export function badgeList() {
  const t = totals(), bd = badgeDates();
  return BADGES.map(b => {
    const got = earned(b, t, bd), [v, n, unit] = b.prog(t);
    return { ...b, got, date: got ? dateOf(b, bd) : '', v: Math.min(v, n), n, unit, ratio: n ? Math.min(1, v / n) : 0 };
  });
}
/** Latest earned (dated ones first, newest first; undated after) and the closest not yet earned (most progress first). */
export function badgeStatus() {
  const all = badgeList(), got = all.filter(b => b.got);
  const dated = got.filter(b => b.date).sort((a, b) => b.date.localeCompare(a.date)), undated = got.filter(b => !b.date);
  const latest = [...dated, ...undated];
  const next = all.filter(b => !b.got).sort((a, b) => b.ratio - a.ratio);
  return { got, latest, last: latest[0] || null, next: next[0] || null, nextList: next };
}
export const kidTotals = totals;
export const unlockedBadges = () => badgeList().filter(b => b.got);

export const progressText = b => AR(b.v) + ' من ' + AR(b.n) + ' ' + b.unit;
export const dateText = iso => new Date(iso + 'T12:00:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
export const whenText = b => b.date ? dateText(b.date) : 'قبل أن يسجّل التطبيق التواريخ';

/** Tells the child when a medal is newly earned and saves the day. The first look at a child only records what is already earned (day unknown). */
const seen = new Map();
export function announceBadges() {
  const k = activeKid(); if (!k) return;
  const t = totals(), bd = badgeDates(), now = new Set(BADGES.filter(b => earned(b, t, bd)).map(b => b.name)), before = seen.get(k.id);
  seen.set(k.id, now);
  for (const b of BADGES) {
    if (!now.has(b.name) || bd[b.name]) continue;
    if (before) { if (!before.has(b.name)) { setBadgeDate(b.name, day()); announce('وسام جديد: ' + b.name + '!') } }
    else setBadgeDate(b.name, '0');   // earned before the days were recorded
  }
}
