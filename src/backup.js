// Backup file: export every child's progress as JSON, and import one back after strict validation.
import { day } from './util.js';
import { Q } from './data.js';
import { ICONS, snapshot } from './state.js';
import { PRESETS } from './plan.js';

const APP = 'rafiq-alhifz', VERSION = 1, MAX_BYTES = 2e6, MAX_KIDS = 30;
const LAST_EXPORT = 'hifz-lastexport';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const int = (v, lo, hi, dflt) => Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;

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
  try { const d = new Date(localStorage.getItem(LAST_EXPORT)); return isNaN(d) ? null : d } catch (e) { return null }
}

/** Keeps only well-formed surah records; returns the cleaned progress object and how many records were dropped. */
function cleanProgress(S, skip) {
  const out = { s: {}, goal: int(S.goal, 1, 50, 5), day: DATE.test(S.day) ? S.day : day(), n: int(S.n, 0, 1e6, 0), streak: int(S.streak, 0, 1e5, 0), last: DATE.test(S.last) ? S.last : '' };
  const rows = S.s && typeof S.s === 'object' ? Object.entries(S.s) : [];
  for (const [key, r] of rows) {
    const id = Number(key), ok = Number.isInteger(id) && id >= 1 && id <= 114 && r && typeof r.m === 'string' &&
      /^[01]+$/.test(r.m) && r.m.length === Q[id - 1].v.length && DATE.test(r.d) && Number.isInteger(r.i) && r.i >= 1 && r.i <= 30;
    if (!ok) { skip.n++; continue }
    if (r.m.includes('1')) out.s[id] = { m: r.m, d: r.d, i: r.i };
  }
  return out;
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
  if (k.game && Number.isInteger(k.game.stars) && k.game.stars >= 0 && k.game.stars <= 1e6) kid.game = { stars: k.game.stars };
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
