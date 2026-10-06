// Child profiles: the switcher bar, rewards (stars and badges), and the parent corner behind a math gate.
import { $, AR } from './util.js';
import { Q } from './data.js';
import { announce } from './motion.js';
import { mem, gameStars, azStats, streakNow, shopTheme, shopFrame, weeksDone, famWeeks, ramBest, kids, activeKid, switchKid, save } from './state.js';
import { applyReading } from './reading.js';

let onChange = () => {};
export const onKidsChange = fn => { onChange = fn };

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e };

/** Young children get bigger text, star buttons and no tafsir; readers get the full page. */
export function applyMode() {
  const k = activeKid(); document.body.dataset.mode = k ? k.mode : 'reader';
  applyReading();   // the child's reading size
  const th = shopTheme(); if (th) document.body.dataset.theme = th; else delete document.body.dataset.theme;   // a pastel colour from the shop
}

export function renderKidBar() {
  const box = $('kids'); box.textContent = '';
  const act = activeKid();
  kids().forEach(k => {
    const b = el('button', 'kid'); b.type = 'button'; b.dataset.id = k.id;
    b.setAttribute('aria-pressed', act && k.id === act.id);
    const fr = shopFrame(k); if (fr) b.dataset.frame = fr;
    b.append(el('span', 'kicon', k.icon), el('span', 'kname', k.name));
    box.appendChild(b);
  });
}

/* ---------- rewards: derived from progress, so nothing extra is stored ---------- */
function totals() {
  let ay = 0, done = 0;
  Q.forEach((c, k) => { const m = mem(k + 1); ay += m; if (m === c.v.length) done++ });
  const streak = streakNow();
  return { ay, done, streak, games: gameStars(), az: azStats(), weeks: weeksDone(), fam: famWeeks(), ram: ramBest() };
}
const BADGES = [
  { icon: '🌱', name: 'البداية', need: 'علّم أول آية تحفظها', ok: t => t.ay >= 1 },
  { icon: '🌟', name: 'عشر آيات', need: 'احفظ عشر آيات', ok: t => t.ay >= 10 },
  { icon: '🏅', name: 'سورة كاملة', need: 'أكمل حفظ سورة كاملة', ok: t => t.done >= 1 },
  { icon: '🏆', name: 'خمس سور', need: 'أكمل حفظ خمس سور', ok: t => t.done >= 5 },
  { icon: '🔥', name: 'أسبوع متواصل', need: 'تابع الحفظ سبعة أيام متتالية', ok: t => t.streak >= 7 },
  { icon: '👑', name: 'مئة آية', need: 'احفظ مئة آية', ok: t => t.ay >= 100 },
  { icon: '🎮', name: 'لاعب نشيط', need: 'اجمع عشر نجوم من الألعاب', ok: t => t.games >= 10 },
  { icon: '🎯', name: 'بطل الألعاب', need: 'اجمع خمسين نجمة من الألعاب', ok: t => t.games >= 50 },
  { icon: '🌅', name: 'أذكار الصباح', need: 'أنهِ أذكار الصباح مرة', ok: t => t.az.sabah },
  { icon: '🌙', name: 'أذكار المساء', need: 'أنهِ أذكار المساء مرة', ok: t => t.az.masaa },
  { icon: '😴', name: 'أذكار النوم', need: 'أنهِ أذكار النوم مرة', ok: t => t.az.nawm },
  { icon: '📿', name: 'ملتزم بالأذكار', need: 'أنهِ الأذكار في سبعة أيام', ok: t => t.az.days >= 7 },
  { icon: '🏆', name: 'بطل الأسبوع', need: 'أتمّ تحدّي أسبوع', ok: t => t.weeks >= 1 },
  { icon: '👑', name: 'ملك التحديات', need: 'أتمّ تحدّي أربعة أسابيع', ok: t => t.weeks >= 4 },
  { icon: '🤝', name: 'أسرة متعاونة', need: 'أتمّوا تحدّي العائلة مرة', ok: t => t.fam >= 1 },
  { icon: '🌙', name: 'رمضان معنا', need: 'أكمل عشرة أيام في رمضان', ok: t => t.ram >= 10 },
  { icon: '🏮', name: 'بطل رمضان', need: 'أكمل خمسة وعشرين يومًا في رمضان', ok: t => t.ram >= 25 },
];

/** What the child has earned so far, for the share card. */
export const kidTotals = totals;
/** What the child has earned and what is closest: the last medal in the list that is unlocked, and the first one that is not (with what it asks for). */
export function badgeStatus() {
  const t = totals(), got = BADGES.filter(b => b.ok(t));
  return { got, last: got[got.length - 1] || null, next: BADGES.find(b => !b.ok(t)) || null };
}
export const unlockedBadges = () => { const t = totals(); return BADGES.filter(b => b.ok(t)) };

export function renderRewards(id = 'achRewards') {
  const box = $(id); if (!box) return; box.textContent = '';
  const t = totals();
  const stars = el('p', 'stars'); stars.append(el('span', 'big-star', '⭐'), el('b', '', AR(t.ay)), ' نجمة');
  const row = el('ul', 'badges');
  BADGES.forEach(b => {
    const on = b.ok(t), li = el('li', 'badge' + (on ? ' on' : ''));
    li.append(el('span', 'bicon', b.icon), el('span', 'bname', b.name));
    if (!on) li.append(el('span', 'sr', 'لم يُفتح بعد'));
    li.title = on ? 'حصلتَ على وسام ' + b.name : 'وسام ' + b.name + ' لم يُفتح بعد';
    row.appendChild(li);
  });
  const games = el('p', 'stars game'); games.append(el('span', 'big-star', '🎮'), el('b', '', AR(t.games)), ' نجمة ألعاب (منفصلة عن نجوم الحفظ)');
  box.append(stars, games, row);
}

/** Tells the child when a medal is newly unlocked. The first call per child only records what is already unlocked. */
const unlocked = new Map();
export function announceBadges() {
  const k = activeKid(); if (!k) return;
  const t = totals(), now = new Set(BADGES.filter(b => b.ok(t)).map(b => b.name)), before = unlocked.get(k.id);
  unlocked.set(k.id, now);
  if (!before) return;
  BADGES.filter(b => now.has(b.name) && !before.has(b.name)).forEach(b => announce('وسام جديد: ' + b.icon + ' ' + b.name + '!'));
}

/** After a change to a child (name, mode, friend, the active child): repaint what depends on it, then tell the pages. */
export function refreshKids() { applyMode(); renderKidBar(); onChange() }

export function initKids() {
  $('kids').addEventListener('click', e => { const b = e.target.closest('.kid'); if (!b) return; switchKid(b.dataset.id); refreshKids() });
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { save(); renderKidBar(); onChange() }));
  refreshKids();
}
