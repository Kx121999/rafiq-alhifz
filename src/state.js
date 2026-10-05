// Progress is kept per child in localStorage under hifz-kids-v1.
// Each child's S has exactly the shape of the original single-user progress (hifz-progress-v1),
// which is migrated into the first child once and then left untouched as a backup.
import { day, shiftDay } from './util.js';
import { itemOf, EXTRA_FRIENDS } from './catalog.js';
import { Q } from './data.js';

const KEY = 'hifz-kids-v1';
const LEGACY_KEY = 'hifz-progress-v1';
const fresh = () => ({ s: {}, goal: 5, day: day(), n: 0, streak: 0, last: '' });
const clone = o => JSON.parse(JSON.stringify(o));

export const ICONS = ['⭐', '🌙', '☀️', '🌸', '🌳', '📖', '🌈', '💎'];
export const MODES = { young: 'صغير (٤–٦ سنوات)', reader: 'قارئ (٧–١٢ سنة)' };
/** The cartoon friends a child can pick as their companion. 'rafiq' is the default and the book on the home page. */
export const FRIENDS = [
  { id: 'rafiq', name: 'رفيق' }, { id: 'nujum', name: 'نجوم' }, { id: 'shams', name: 'شمس' }, { id: 'ghayma', name: 'غيمة' }, { id: 'sabr', name: 'صبر' },
];
export const isFriend = id => FRIENDS.some(f => f.id === id) || EXTRA_FRIENDS.some(f => f.id === id);
/** The free friends plus the ones this child bought in the shop. */
export const friendsFor = k => [...FRIENDS, ...EXTRA_FRIENDS.filter(f => ((k || {}).shop || {}).own && k.shop.own.includes(f.id))];

/** The active child's progress: {s: {<surah id>: {m: "0101…", d: "YYYY-MM-DD", i: days}}, goal, day, n, streak, last} */
export const S = fresh();

/** All children: {active: id, kids: [{id, name, icon, mode: 'young'|'reader', S}]} */
const store = { active: '', kids: [] };

function adopt(o) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, fresh(), o && typeof o === 'object' && o.s ? clone(o) : {});
  if (S.day !== day()) { S.day = day(); S.n = 0 }
}

function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)) } catch (e) {} }

function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)) } catch (e) {}
  if (saved && Array.isArray(saved.kids)) {
    store.kids = saved.kids.filter(k => k && k.id && k.S && k.S.s);
    store.active = store.kids.some(k => k.id === saved.active) ? saved.active : (store.kids[0] || {}).id || '';
  } else {
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) } catch (e) {}
    // The first child takes over any progress saved by the single-user version; a new visitor gets an empty profile.
    const first = legacy && typeof legacy === 'object' && legacy.s ? clone(legacy) : fresh();
    store.kids = [{ id: newId(), name: 'طفلي', icon: ICONS[0], mode: 'reader', S: first }];
    store.active = store.kids[0].id;
    persist();
  }
  adopt(activeKid() && activeKid().S);
}

const newId = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const kids = () => store.kids;
export const activeKid = () => store.kids.find(k => k.id === store.active) || null;

export function save() { const k = activeKid(); if (!k) return; k.S = clone(S); persist() }

/* Optional per-child fields, absent on older profiles: plan {id, weeks, start} and last (the surah opened most recently). */
export const kidPlan = () => (activeKid() || {}).plan || null;
export function setPlan(plan) { const k = activeKid(); if (!k) return; if (plan) k.plan = plan; else delete k.plan; persist() }
export const lastSurah = () => (activeKid() || {}).last || 0;
export function setLast(id) { const k = activeKid(); if (!k || k.last === id) return; k.last = id; persist() }

/** Game stars are kept apart from memorisation stars: they reward play, not progress. Optional field game: {stars}. */
export const gameStars = () => ((activeKid() || {}).game || {}).stars || 0;
export function addGameStars(n) {
  const k = activeKid(); if (!k || !(n > 0)) return;
  k.game = { ...(k.game || {}), stars: Math.min(1e6, gameStars() + Math.floor(n)) }; addLog('g', Math.floor(n)); persist();
}

/* Star shop. game.stars is everything ever earned (medals use it), game.spent what was spent; the balance is the difference.
   Optional field shop: {own: [item ids], theme?: id, frame?: id}. A bought friend is used through the child's friend field. */
export const starBalance = () => { const g = (activeKid() || {}).game || {}; return Math.max(0, (g.stars || 0) - (g.spent || 0)) };
export const owns = id => { const k = activeKid(); return !!(k && k.shop && k.shop.own && k.shop.own.includes(id)) };
export const shopTheme = () => { const k = activeKid(); return k && k.shop && k.shop.theme && owns(k.shop.theme) ? k.shop.theme : '' };
export const shopFrame = k => (k && k.shop && k.shop.frame && k.shop.own && k.shop.own.includes(k.shop.frame)) ? k.shop.frame : '';
/** Buys an item with stars. Returns 'ok' | 'owned' | 'poor' | 'unknown'. */
export function buyItem(id) {
  const k = activeKid(), it = itemOf(id); if (!k || !it) return 'unknown';
  if (owns(id)) return 'owned';
  if (starBalance() < it.price) return 'poor';
  k.game = { ...(k.game || {}), spent: ((k.game || {}).spent || 0) + it.price };
  const sh = k.shop || (k.shop = { own: [] }); sh.own.push(id);
  persist(); return 'ok';
}
/** Uses an owned item: a friend becomes the child's friend, a theme or frame is switched on. Passing the item that is already on switches it off (themes and frames). */
export function useItem(id) {
  const k = activeKid(), it = itemOf(id); if (!k || !it || !owns(id)) return false;
  if (it.type === 'friend') k.friend = id;
  else { const sh = k.shop, key = it.type; if (sh[key] === id) delete sh[key]; else sh[key] = id }
  persist(); return true;
}

/* Rest days and weekly challenges. Optional fields on the child: rest {date: 1} (days off that keep the streak alive,
   one per week) and wk {week start date: 1} (weeks whose challenge was finished). Weeks start on Saturday. */
export const weekStartOf = iso => { const w = new Date(iso + 'T12:00:00').getDay(); return shiftDay(iso, -((w + 1) % 7)) };
export const restDays = () => (activeKid() || {}).rest || {};
export const restUsedThisWeek = () => { const ws = weekStartOf(day()); return Object.keys(restDays()).some(d => weekStartOf(d) === ws) };
/** True when every day between the last active day and today is a rest day (so the streak did not break). */
const gapIsRest = (last, rest) => { let d = day(-1); for (let i = 0; i < 9; i++) { if (d === last) return true; if (!rest[d]) return false; d = shiftDay(d, -1) } return false };
/** The streak as it stands now: alive if the child was active today, or only rest days lie between then and today. */
export const streakNow = (p = S, rest = restDays()) => (!p.last ? 0 : p.last === day() || gapIsRest(p.last, rest) ? p.streak : 0);
export function useRestDay() {
  const k = activeKid(); if (!k || restUsedThisWeek()) return false;
  const r = k.rest || (k.rest = {}); r[day()] = 1;
  const cutoff = day(-60); for (const d of Object.keys(r)) if (d < cutoff) delete r[d];
  persist(); return true;
}
export const weeksDone = () => Object.keys((activeKid() || {}).wk || {}).length;
export const weekDone = ws => !!((activeKid() || {}).wk || {})[ws];
export function markWeekDone(ws) {
  const k = activeKid(); if (!k) return false;
  const w = k.wk || (k.wk = {}); if (w[ws]) return false;
  w[ws] = 1; const keep = Object.keys(w).sort().slice(-26); for (const d of Object.keys(w)) if (!keep.includes(d)) delete w[d];
  persist(); return true;
}

/* Family goal: when two or more children together reach the week's target, every child gets a medal. Optional field fam on each child
   {week start date: 1}, like wk. */
export const famWeeks = () => Object.keys((activeKid() || {}).fam || {}).length;
export const famDone = ws => !!((activeKid() || {}).fam || {})[ws];
/** Marks the week as won for every child at once. Returns false if it already was. */
export function markFamilyWeek(ws) {
  if (famDone(ws)) return false;
  for (const k of store.kids) {
    const f = k.fam || (k.fam = {}); f[ws] = 1;
    const keep = Object.keys(f).sort().slice(-26); for (const d of Object.keys(f)) if (!keep.includes(d)) delete f[d];
  }
  persist(); return true;
}

/* Activity log for the weekly report: per day {a: ayat memorised, r: surah reviews, w: weak ayat mastered, g: game stars}.
   Daily totals only (not every tap), kept for LOG_DAYS days, as an optional field log on the child. */
const LOG_DAYS = 90;
function addLog(field, n) {
  const k = activeKid(); if (!k || !n) return;
  const log = k.log || (k.log = {}), d = day();
  const e = log[d] || (log[d] = { a: 0, r: 0, w: 0, g: 0 });
  e[field] = Math.max(0, (e[field] || 0) + n);
  if (!e.a && !e.r && !e.w && !e.g) delete log[d];
  const cutoff = day(-LOG_DAYS);
  for (const key of Object.keys(log)) if (key < cutoff) delete log[key];
}
export const activityLog = () => (activeKid() || {}).log || {};
/* Adhkar progress: per day and per list (sabah, masaa, nawm, istiqaz, salah, or c<id> for any other category)
   {c: [count per dhikr], d: 1 once the whole list is finished}. Kept AZ_DAYS days, as an optional field az on the child. */
const AZ_DAYS = 60;
export const AZ_KEY = /^(sabah|masaa|nawm|istiqaz|salah|c\d{1,3})$/;
export const azToday = key => { const e = (((activeKid() || {}).az || {})[day()] || {})[key]; return e ? { c: e.c.slice(), d: e.d } : { c: [], d: 0 } };
export function azSave(key, counts, done) {
  const k = activeKid(); if (!k || !AZ_KEY.test(key)) return;
  const az = k.az || (k.az = {}), d = day(), e = az[d] || (az[d] = {});
  if (counts.some(n => n > 0)) e[key] = { c: counts.map(n => Math.max(0, Math.min(1000, Math.floor(n) || 0))), d: done ? 1 : 0 };
  else delete e[key];
  if (!Object.keys(e).length) delete az[d];
  const cutoff = day(-AZ_DAYS);
  for (const x of Object.keys(az)) if (x < cutoff) delete az[x];
  if (!Object.keys(az).length) delete k.az;
  persist();
}
/** For the medals: how many days had a finished list, and which of the three daily lists were ever finished. */
export function azStats() {
  const az = (activeKid() || {}).az || {}, seen = new Set(); let days = 0;
  for (const e of Object.values(az)) { let any = false; for (const [key, v] of Object.entries(e)) if (v.d) { any = true; seen.add(key) } if (any) days++ }
  return { days, sabah: seen.has('sabah'), masaa: seen.has('masaa'), nawm: seen.has('nawm') };
}
/* Reading size, per child: optional field fs, a whole step from FS_MIN to FS_MAX (0 or missing = normal). */
export const FS_MIN = -1, FS_MAX = 4;
export const fontLevel = () => { const v = (activeKid() || {}).fs; return Number.isInteger(v) && v >= FS_MIN && v <= FS_MAX ? v : 0 };
export function setFontLevel(n) {
  const k = activeKid(); if (!k) return;
  n = Math.max(FS_MIN, Math.min(FS_MAX, Math.round(n)));
  if (n) k.fs = n; else delete k.fs;
  persist();
}

/* Favourite adhkar, per child: optional field fav, a list of "<category id>.<entry id>" in the order they were added. */
export const FAV_REF = /^\d{1,3}\.\d{1,3}$/;
export const MAX_FAV = 100;
export const favList = () => ((activeKid() || {}).fav || []).slice();
export const isFav = ref => favList().includes(ref);
/** Adds or removes a favourite; returns whether it is a favourite afterwards (false too when the list is full). */
export function toggleFav(ref) {
  const k = activeKid(); if (!k || !FAV_REF.test(ref)) return false;
  const f = k.fav || [], i = f.indexOf(ref);
  if (i >= 0) f.splice(i, 1); else if (f.length < MAX_FAV) f.push(ref);
  if (f.length) k.fav = f; else delete k.fav;
  persist();
  return f.includes(ref);
}
/** Marks a weak ayah as mastered (as opposed to un-flagging it by mistake) and counts it for the report. */
export function masterWeak(id, i) { if (!setWeak(id, i, false)) return false; addLog('w', 1); return true }

/** A deep copy of every profile, for backups. */
export function snapshot() { save(); return clone(store) }

/** Adds imported (already validated) profiles as new children, or replaces everything with them. */
export function applyImport(list, mode) {
  if (!list.length) return;
  save();
  const fresh = list.map(k => ({ ...clone(k), id: newId() }));
  if (mode === 'replace') { store.kids = fresh; store.active = fresh[0].id }
  else store.kids.push(...fresh);
  adopt(activeKid().S); persist();
}

export function switchKid(id) {
  if (!store.kids.some(k => k.id === id)) return;
  save(); store.active = id; adopt(activeKid().S); persist();
}

export function addKid({ name, icon, mode, friend }) {
  save();
  const k = { id: newId(), name, icon, mode, S: fresh() };
  if (isFriend(friend)) k.friend = friend;
  store.kids.push(k); store.active = k.id; adopt(k.S); persist();
  return k;
}

export function updateKid(id, { name, icon, mode, friend }) {
  const k = store.kids.find(x => x.id === id); if (!k) return;
  Object.assign(k, { name, icon, mode });
  if (isFriend(friend)) k.friend = friend;
  persist();
}

/** The active child's friend (Rafiq unless they picked another). */
export const friendOf = () => { const f = (activeKid() || {}).friend; return isFriend(f) ? f : 'rafiq' };

export function removeKid(id) {
  save();
  store.kids = store.kids.filter(k => k.id !== id);
  if (store.active === id) store.active = (store.kids[0] || {}).id || '';
  adopt(activeKid() && activeKid().S); persist();
}

load();

export const rec = id => S.s[id];
export const mem = id => { const r = rec(id); if (!r) return 0; let c = 0; for (const ch of r.m) if (ch === '1') c++; return c };
export const isDue = id => { const r = rec(id); return !!r && mem(id) > 0 && r.d <= day() };

export function bump(delta) {
  addLog('a', delta);
  if (S.day !== day()) { S.day = day(); S.n = 0 }
  S.n = Math.max(0, S.n + delta);
  if (delta > 0 && S.last !== day()) { S.streak = (gapIsRest(S.last, restDays()) ? S.streak : 0) + 1; S.last = day() }
}

/** Marks ayah i of surah id as memorised (on) or not. Returns +1, -1 or 0 for the daily count. */
export function setAyah(id, i, on) {
  const len = Q[id - 1].v.length; let r = rec(id);
  if (!r) r = S.s[id] = { m: '0'.repeat(len), d: day(1), i: 1 };
  if ((r.m[i] === '1') === on) return 0;
  if (on && !r.m.includes('1')) { r.d = day(1); r.i = 1 }
  r.m = r.m.slice(0, i) + (on ? '1' : '0') + r.m.slice(i + 1);
  if (!on && r.w) { r.w = r.w.slice(0, i) + '0' + r.w.slice(i + 1); if (!r.w.includes('1')) delete r.w }   // an ayah that is no longer memorised is no longer weak
  if (!r.m.includes('1')) delete S.s[id];
  return on ? 1 : -1;
}

/* Weak ayat: an optional mask w on a surah record (same length as m). Only memorised ayat can be weak. */
export const isWeak = (id, i) => { const r = rec(id); return !!(r && r.w && r.w[i] === '1') };
export function setWeak(id, i, on) {
  const r = rec(id); if (!r || r.m[i] !== '1') return false;
  const cur = r.w || '0'.repeat(r.m.length);
  if ((cur[i] === '1') === on) return false;
  const w = cur.slice(0, i) + (on ? '1' : '0') + cur.slice(i + 1);
  if (w.includes('1')) r.w = w; else delete r.w;
  return true;
}
/** Every weak ayah of the active child, in mushaf order. */
export function weakList() {
  const out = [];
  for (const [key, r] of Object.entries(S.s)) if (r.w) for (let i = 0; i < r.w.length; i++) if (r.w[i] === '1' && r.m[i] === '1') out.push({ id: +key, i });
  return out.sort((a, b) => a.id - b.id || a.i - b.i);
}

/** Spaced review: doubles the interval up to 30 days, or resets to 1 day. Returns the new interval. */
export function grade(id, good) {
  const r = rec(id); if (!r) return null;
  r.i = good ? Math.min(30, Math.max(1, r.i) * 2) : 1; r.d = day(r.i); addLog('r', 1); save();
  return r.i;
}
