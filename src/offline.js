// Download a surah's recitation to listen without internet. The files come from everyayah.com (the same ones the player
// uses) and are kept in this browser's own cache storage; the service worker serves them when they are asked for again.
// Nothing is uploaded, nothing goes to any other place, and every download can be removed. A small index in localStorage
// remembers which surahs are complete, per reciter.
import { Q } from './data.js';
import { urlFor, needsBasmala, RECITERS } from './player.js';

export const AUDIO_CACHE = 'audio-v1';
const INDEX = 'hifz-audio-v1';
const PARALLEL = 3;
const KB_PER_LETTER = 4.3;          // measured on the 128 kbps recitations: about 4.3 KB of audio for each letter of the text
const BIG = 25 * 1048576;

export const supported = () => typeof caches !== 'undefined';

/** Every file one surah needs for the given reciter: the basmala recording (when the surah has one) and each ayah. */
export function filesOf(id, reciter) {
  const n = Q[id - 1].v.length, out = [];
  if (needsBasmala(id)) out.push(urlFor(reciter, 1, 1));
  for (let i = 1; i <= n; i++) out.push(urlFor(reciter, id, i));
  return out;
}

/** About how many bytes the download will be. Higher-quality reciters (192 kbps) take more room. */
export function estimateBytes(id, reciter) {
  const letters = Q[id - 1].v.reduce((t, a) => t + a.replace(/[^ء-ي]/g, '').length, 0);
  const kbps = Number((/(\d+)kbps/.exec(reciter) || [])[1]) || 128;
  return Math.round((letters + (needsBasmala(id) ? 12 : 0)) * KB_PER_LETTER * 1024 * (kbps / 128));
}
export const isBig = bytes => bytes > BIG;
export const mb = bytes => (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0);

/* ---------- the index of what is complete ---------- */
const keyOf = (id, reciter) => reciter + '/' + id;
export function readIndex() {
  try { const o = JSON.parse(localStorage.getItem(INDEX) || '{}'); return o && typeof o === 'object' ? o : {} } catch (e) { return {} }
}
function writeIndex(o) { try { localStorage.setItem(INDEX, JSON.stringify(o)) } catch (e) {} }
export const downloadedInfo = (id, reciter) => readIndex()[keyOf(id, reciter)] || null;
export const totalBytes = () => Object.values(readIndex()).reduce((t, e) => t + ((e && e.bytes) || 0), 0);
/** The list for the parent corner: [{id, reciter, name, bytes}] */
export function listDownloads() {
  return Object.entries(readIndex()).map(([k, e]) => {
    const [reciter, id] = [k.slice(0, k.lastIndexOf('/')), Number(k.slice(k.lastIndexOf('/') + 1))];
    return { id, reciter, bytes: e.bytes || 0, surah: Q[id - 1] ? Q[id - 1].n : '' , reciterName: (RECITERS.find(r => r.id === reciter) || { name: reciter }).name };
  }).filter(x => x.surah).sort((a, b) => a.id - b.id);
}

/** Is there room? Looks at the browser's quota (when it tells us) and keeps a tenth free. */
export async function hasRoom(bytes) {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return true;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return !quota || usage + bytes < quota * 0.9;
  } catch (e) { return true }
}

/**
 * Downloads the surah. opts.signal cancels, opts.onProgress(done, total) reports.
 * Resolves to {ok, done, total, bytes, error?} where error is 'cancelled' | 'network' | 'space'.
 */
export async function downloadSurah(id, reciter, opts = {}) {
  const files = filesOf(id, reciter), total = files.length;
  let done = 0, bytes = 0, error = null, i = 0;
  if (!(await hasRoom(estimateBytes(id, reciter)))) return { ok: false, done: 0, total, bytes: 0, error: 'space' };
  const cache = await caches.open(AUDIO_CACHE);
  async function worker() {
    while (!error) {
      const url = files[i++]; if (!url) return;
      if (opts.signal && opts.signal.aborted) { error = 'cancelled'; return }
      try {
        let res = await cache.match(url);                                     // already there from an earlier try: keep it
        if (!res) {
          res = await fetch(url, { mode: 'cors', signal: opts.signal });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          await cache.put(url, res.clone());
        }
        const size = (await res.clone().blob()).size;      // read first: adding straight into bytes across an await loses updates from the parallel workers
        bytes += size; done++;
        if (opts.onProgress) opts.onProgress(done, total);
      } catch (e) {
        if (!error) error = (e && e.name === 'AbortError') || (opts.signal && opts.signal.aborted) ? 'cancelled' : (/quota/i.test(String(e && e.name) + String(e && e.message)) ? 'space' : 'network');
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  if (!error && done === total) {
    const idx = readIndex(); idx[keyOf(id, reciter)] = { n: total, bytes, at: Date.now() }; writeIndex(idx);
    return { ok: true, done, total, bytes };
  }
  return { ok: false, done, total, bytes, error: error || 'network' };
}

/** Removes one surah's recitation (for that reciter) from the cache and the index. */
export async function removeSurah(id, reciter) {
  if (supported()) { const cache = await caches.open(AUDIO_CACHE); await Promise.all(filesOf(id, reciter).map(u => cache.delete(u))) }
  const idx = readIndex(); delete idx[keyOf(id, reciter)]; writeIndex(idx);
}

export async function removeAll() {
  if (supported()) await caches.delete(AUDIO_CACHE);
  writeIndex({});
}
