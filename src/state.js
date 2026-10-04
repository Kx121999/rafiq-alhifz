// Progress lives in localStorage under the same key and shape as the original single-file site.
import { $, day } from './util.js';
import { Q } from './data.js';

const KEY = 'hifz-progress-v1';
const fresh = () => ({ s: {}, goal: 5, day: day(), n: 0, streak: 0, last: '' });

/** S = {s: {<surah id>: {m: "0101…", d: "YYYY-MM-DD", i: days}}, goal, day, n, streak, last} */
export const S = fresh();

function adopt(o) {
  if (o && typeof o === 'object' && o.s) {
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, fresh(), JSON.parse(JSON.stringify(o)));
  }
  if (S.day !== day()) { S.day = day(); S.n = 0 }
}
try { adopt(JSON.parse(localStorage.getItem(KEY))) } catch (e) {}

export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) {} }
export function showSync() { $('sync').textContent = 'تقدّمك محفوظ على هذا المتصفح فقط' }

export const rec = id => S.s[id];
export const mem = id => { const r = rec(id); if (!r) return 0; let c = 0; for (const ch of r.m) if (ch === '1') c++; return c };
export const isDue = id => { const r = rec(id); return !!r && mem(id) > 0 && r.d <= day() };

export function bump(delta) {
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
  if (!r.m.includes('1')) delete S.s[id];
  return on ? 1 : -1;
}

/** Spaced review: doubles the interval up to 30 days, or resets to 1 day. Returns the new interval. */
export function grade(id, good) {
  const r = rec(id); if (!r) return null;
  r.i = good ? Math.min(30, Math.max(1, r.i) * 2) : 1; r.d = day(r.i); save();
  return r.i;
}
