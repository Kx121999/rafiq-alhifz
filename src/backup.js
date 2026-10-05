// Backup file: export every child's progress as JSON, and import one back after strict validation.
import { day } from './util.js';
import { Q } from './data.js';
import { ICONS, isFriend, AZ_KEY, FAV_REF, MAX_FAV, FS_MIN, FS_MAX, POS_MODES, BM_REF, MAX_BM, MAX_PIN, snapshot } from './state.js';
import { SHOP, itemOf } from './catalog.js';
import { PRESETS } from './plan.js';

const APP = 'rafiq-alhifz', VERSION = 1, MAX_BYTES = 2e6, MAX_KIDS = 30;
const LAST_EXPORT = 'hifz-lastexport';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, lo, hi, dflt) => Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;

const RESTORE = 'hifz-restore-v1';
/** A copy of everything, kept on this device before something replaces it (an import), so it can be put back. Returns false if it could not be kept. */
export function makeRestorePoint() {
  try { localStorage.setItem(RESTORE, JSON.stringify({ at: new Date().toISOString(), data: buildBackup() })); return true } catch (e) { return false }
}
/** The kept copy, validated like any import: {at, kids} or null. */
export function restorePoint() {
  try {
    const raw = JSON.parse(localStorage.getItem(RESTORE) || 'null'); if (!raw || !raw.data) return null;
    const r = parseBackup(JSON.stringify(raw.data)); if (r.error) return null;
    return { at: new Date(raw.at), kids: r.kids };
  } catch (e) { return null }
}
export const dropRestorePoint = () => { try { localStorage.removeItem(RESTORE) } catch (e) {} };

/** What a child's saved progress amounts to, for the preview before an import: ayat memorised and surahs finished. */
export function kidSummary(k) {
  let ay = 0, done = 0;
  for (const [key, r] of Object.entries((k.S && k.S.s) || {})) { const id = Number(key); const n = [...r.m].filter(c => c === '1').length; ay += n; if (Q[id - 1] && n === Q[id - 1].v.length) done++ }
  return { ay, done };
}

export function buildBackup() {
  const s = snapshot();
  return { app: APP, version: VERSION, exported: new Date().toISOString(), active: s.active, kids: s.kids };
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'rafiq-alhifz-backup-' + day() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  try { localStorage.setItem(LAST_EXPORT, new Date().toISOString()) } catch (e) {}
}

export function lastExport() {
  try {
    const raw = localStorage.getItem(LAST_EXPORT);
    if (!raw) return null;   // new Date(null) would be 1970, not "never"
    const d = new Date(raw); return isNaN(d) ? null : d;
  } catch (e) { return null }
}

/** Keeps only well-formed surah records; returns the cleaned progress object and how many records were dropped. */
function cleanProgress(S, skip) {
  const out = { s: {}, goal: int(S.goal, 1, 50, 5), day: DATE.test(S.day) ? S.day : day(), n: int(S.n, 0, 1e6, 0), streak: int(S.streak, 0, 1e5, 0), last: DATE.test(S.last) ? S.last : '' };
  const rows = S.s && typeof S.s === 'object' ? Object.entries(S.s) : [];
  for (const [key, r] of rows) {
    const id = Number(key), ok = Number.isInteger(id) && id >= 1 && id <= 114 && r && typeof r.m === 'string' &&
      /^[01]+$/.test(r.m) && r.m.length === Q[id - 1].v.length && DATE.test(r.d) && Number.isInteger(r.i) && r.i >= 1 && r.i <= 30;
    if (!ok) { skip.n++; continue }
    if (!r.m.includes('1')) continue;
    out.s[id] = { m: r.m, d: r.d, i: r.i };
    // optional weak-ayat mask: must match the length and can only flag memorised ayat
    if (typeof r.w === 'string' && /^[01]+$/.test(r.w) && r.w.length === r.m.length) {
      const w = [...r.w].map((c, k) => (c === '1' && r.m[k] === '1' ? '1' : '0')).join('');
      if (w.includes('1')) out.s[id].w = w;
    }
  }
  return out;
}

/** The activity log: only ISO-date keys with small non-negative whole numbers; all-zero days are dropped. */
function cleanLog(log) {
  if (!log || typeof log !== 'object') return null;
  const out = {};
  for (const [d, e] of Object.entries(log).slice(0, 400)) {
    if (!DATE.test(d) || !e || typeof e !== 'object') continue;
    const v = { a: int(e.a, 0, 1e5, 0), r: int(e.r, 0, 1e5, 0), w: int(e.w, 0, 1e5, 0), g: int(e.g, 0, 1e5, 0) };
    if (v.a || v.r || v.w || v.g) out[d] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Adhkar progress: ISO-date keys, known list keys, small whole-number counts (at most 300 dhikr per list), done as 0 or 1. */
function cleanAz(az) {
  if (!az || typeof az !== 'object') return null;
  const out = {};
  for (const [d, e] of Object.entries(az).slice(0, 400)) {
    if (!DATE.test(d) || !e || typeof e !== 'object') continue;
    const day = {};
    for (const [key, v] of Object.entries(e).slice(0, 200)) {
      if (!AZ_KEY.test(key) || !v || !Array.isArray(v.c) || v.c.length < 1 || v.c.length > 300) continue;
      const c = v.c.map(n => int(n, 0, 1000, 0));
      if (c.some(n => n > 0)) day[key] = { c, d: v.d === 1 ? 1 : 0 };
    }
    if (Object.keys(day).length) out[d] = day;
  }
  return Object.keys(out).length ? out : null;
}

/** Shop: only known item ids, each once; a theme or frame in use must be owned and of the right type. */
function cleanShop(sh) {
  if (!sh || typeof sh !== 'object' || !Array.isArray(sh.own)) return null;
  const own = [...new Set(sh.own.filter(id => typeof id === 'string' && itemOf(id)))];
  if (!own.length) return null;
  const out = { own };
  for (const type of ['theme', 'frame']) { const it = itemOf(sh[type]); if (it && it.type === type && own.includes(it.id)) out[type] = it.id }
  return out;
}

/** An object of ISO dates mapped to 1 (rest days, finished challenge weeks): bad keys are dropped, at most max kept (the latest). */
function cleanDates(o, max) {
  if (!o || typeof o !== 'object') return null;
  const keys = Object.keys(o).filter(d => DATE.test(d) && o[d] === 1).sort().slice(-max);
  return keys.length ? Object.fromEntries(keys.map(d => [d, 1])) : null;
}

function cleanKid(k, idx, skip) {
  if (!k || typeof k !== 'object' || !k.S || typeof k.S !== 'object') { skip.kids++; return null }
  const kid = {
    name: (typeof k.name === 'string' && k.name.trim().slice(0, 20)) || 'طفل ' + (idx + 1),
    icon: ICONS.includes(k.icon) ? k.icon : ICONS[0],
    mode: k.mode === 'young' ? 'young' : 'reader',
    S: cleanProgress(k.S, skip),
  };
  const p = k.plan;
  if (p && Object.hasOwn(PRESETS, p.id) && DATE.test(p.start) && Number.isInteger(p.weeks) && p.weeks >= 1 && p.weeks <= 104) kid.plan = { id: p.id, weeks: p.weeks, start: p.start };
  if (Number.isInteger(k.last) && k.last >= 1 && k.last <= 114) kid.last = k.last;
  if (isFriend(k.friend)) kid.friend = k.friend;
  const log = cleanLog(k.log);
  if (log) kid.log = log;
  const az = cleanAz(k.az);
  if (az) kid.az = az;
  if (Number.isInteger(k.fs) && k.fs >= FS_MIN && k.fs <= FS_MAX && k.fs !== 0) kid.fs = k.fs;
  if (Array.isArray(k.fav)) {
    const fav = [...new Set(k.fav.filter(r => typeof r === 'string' && FAV_REF.test(r)))].slice(0, MAX_FAV);
    if (fav.length) kid.fav = fav;
  }
  // resume position, bookmarks, pinned surahs, medal dates: each must point at a real surah and ayah
  const p0 = k.pos;
  if (p0 && Number.isInteger(p0.id) && Q[p0.id - 1] && Number.isInteger(p0.i) && p0.i >= 0 && p0.i < Q[p0.id - 1].v.length && POS_MODES.includes(p0.mode)) kid.pos = { id: p0.id, i: p0.i, mode: p0.mode };
  if (Array.isArray(k.bm)) {
    const bm = [...new Set(k.bm.filter(r => { if (typeof r !== 'string' || !BM_REF.test(r)) return false; const [a, b] = r.split('.').map(Number); return Q[a - 1] && b >= 1 && b <= Q[a - 1].v.length }))].slice(0, MAX_BM);
    if (bm.length) kid.bm = bm;
  }
  if (Array.isArray(k.pin)) {
    const pin = [...new Set(k.pin.filter(n => Number.isInteger(n) && n >= 1 && n <= 114))].slice(0, MAX_PIN);
    if (pin.length) kid.pin = pin;
  }
  if (k.bd && typeof k.bd === 'object') {
    const bd = {};
    for (const [n, d] of Object.entries(k.bd).slice(0, 60)) if (n.length <= 30 && DATE.test(d)) bd[n] = d;
    if (Object.keys(bd).length) kid.bd = bd;
  }
  if (k.game && Number.isInteger(k.game.stars) && k.game.stars >= 0 && k.game.stars <= 1e6) {
    kid.game = { stars: k.game.stars };
    if (Number.isInteger(k.game.spent) && k.game.spent > 0) kid.game.spent = Math.min(k.game.spent, k.game.stars);   // can never have spent more than was earned
  }
  const shop = cleanShop(k.shop);
  if (shop) kid.shop = shop;
  const rest = cleanDates(k.rest, 60), wk = cleanDates(k.wk, 26), fam = cleanDates(k.fam, 26);
  if (rest) kid.rest = rest;
  if (wk) kid.wk = wk;
  if (fam) kid.fam = fam;
  if (k.ram && typeof k.ram === 'object') {
    const ram = {};
    for (const [y, n] of Object.entries(k.ram).slice(0, 20)) if (/^1[4-5]\d\d$/.test(y) && Number.isInteger(n) && n >= 1 && n <= 30) ram[y] = n;
    if (Object.keys(ram).length) kid.ram = ram;
  }
  // a bought friend can only be used if it is owned
  if (kid.friend && SHOP.some(i => i.id === kid.friend && i.type === 'friend') && !(shop && shop.own.includes(kid.friend))) delete kid.friend;
  return kid;
}

/** Parses backup text. Returns {kids, skipped} on success or {error} (an Arabic message) on failure. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return { error: 'الملف كبير جدًا أو غير صالح.' };
  let d; try { d = JSON.parse(text) } catch (e) { return { error: 'هذا الملف ليس نسخة احتياطية صالحة (تعذّرت قراءته).' } }
  if (!d || d.app !== APP || !Array.isArray(d.kids)) return { error: 'هذا الملف ليس نسخة احتياطية من رفيق الحفظ.' };
  if (d.version !== VERSION) return { error: 'إصدار هذه النسخة غير مدعوم.' };
  if (!d.kids.length || d.kids.length > MAX_KIDS) return { error: 'عدد الأطفال في الملف غير صالح.' };
  const skip = { n: 0, kids: 0 };
  const kids = d.kids.map((k, i) => cleanKid(k, i, skip)).filter(Boolean);
  if (!kids.length) return { error: 'لا يوجد في الملف أي ملف طفل صالح.' };
  return { kids, skipped: skip.n + skip.kids };
}
