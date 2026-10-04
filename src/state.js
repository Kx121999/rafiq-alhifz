// Progress is kept per child in localStorage under hifz-kids-v1.
// Each child's S has exactly the shape of the original single-user progress (hifz-progress-v1),
// which is migrated into the first child once and then left untouched as a backup.
import { day } from './util.js';
import { Q } from './data.js';

const KEY = 'hifz-kids-v1';
const LEGACY_KEY = 'hifz-progress-v1';
const fresh = () => ({ s: {}, goal: 5, day: day(), n: 0, streak: 0, last: '' });
const clone = o => JSON.parse(JSON.stringify(o));

export const ICONS = ['⭐', '🌙', '☀️', '🌸', '🌳', '📖', '🌈', '💎'];
export const MODES = { young: 'صغير (٤–٦ سنوات)', reader: 'قارئ (٧–١٢ سنة)' };

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
  k.game = { stars: Math.min(1e6, gameStars() + Math.floor(n)) }; addLog('g', Math.floor(n)); persist();
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

export function addKid({ name, icon, mode }) {
  save();
  const k = { id: newId(), name, icon, mode, S: fresh() };
  store.kids.push(k); store.active = k.id; adopt(k.S); persist();
  return k;
}

export function updateKid(id, { name, icon, mode }) {
  const k = store.kids.find(x => x.id === id); if (!k) return;
  Object.assign(k, { name, icon, mode }); persist();
}

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
  if (delta > 0 && S.last !== day()) { S.streak = (S.last === day(-1) ? S.streak : 0) + 1; S.last = day() }
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
