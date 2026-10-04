import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

const pub = f => join(process.cwd(), 'public', f);
export const QURAN = JSON.parse(readFileSync(pub('quran.json'), 'utf8'));
export const TAFSIR = JSON.parse(readFileSync(pub('tafsir.json'), 'utf8'));

/** Fixes "today" (local noon) so date maths is deterministic. */
export function today(iso) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso + 'T12:00:00'));
}

/**
 * Loads fresh copies of the data and state modules over a clean localStorage.
 * `seed` pre-fills localStorage keys (objects are stored as JSON) before state.js reads them.
 */
export async function boot(seed = {}) {
  vi.resetModules();
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  const data = await import('../src/data.js');
  data.Q.push(...QURAN);
  const state = await import('../src/state.js');
  return { Q: data.Q, state };
}

/** Marks every ayah of a surah as memorised for the active child. */
export function memoriseAll(state, Q, id) {
  for (let i = 0; i < Q[id - 1].v.length; i++) state.setAyah(id, i, true);
}
