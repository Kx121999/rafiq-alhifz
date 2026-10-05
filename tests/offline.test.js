import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { boot } from './helpers.js';

afterEach(() => { vi.unstubAllGlobals() });

/* a tiny Cache Storage, enough for the download code and for the service worker */
function fakeCaches() {
  const all = new Map();
  const open = async name => {
    if (!all.has(name)) all.set(name, new Map());
    const m = all.get(name);
    return { match: async u => m.get(typeof u === 'string' ? u : u.url), put: async (u, r) => { m.set(typeof u === 'string' ? u : u.url, r) }, delete: async u => m.delete(u), keys: async () => [...m.keys()] };
  };
  return { open, delete: async n => all.delete(n), all };
}
const okRes = size => ({ ok: true, status: 200, clone() { return this }, blob: async () => ({ size }) });
const bad = status => ({ ok: false, status, clone() { return this }, blob: async () => ({ size: 0 }) });

async function setup() {
  await boot();
  vi.stubGlobal('Audio', class { addEventListener() {} removeEventListener() {} pause() {} load() {} });
  const caches_ = fakeCaches(); vi.stubGlobal('caches', caches_);
  return { off: await import('../src/offline.js'), caches: caches_ };
}
const R = 'Alafasy_128kbps';

describe('which files a surah needs and about how big', () => {
  it('lists the basmala recording plus every ayah, except for Al-Fatiha and At-Tawbah', async () => {
    const { off } = await setup();
    const f = off.filesOf(112, R);
    expect(f).toHaveLength(5);
    expect(f[0]).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3');            // the basmala is the first ayah of Al-Fatiha
    expect(f.slice(1)).toEqual([1, 2, 3, 4].map(i => 'https://everyayah.com/data/Alafasy_128kbps/11200' + i + '.mp3'));
    expect(off.filesOf(1, R)).toHaveLength(7);                                             // no separate basmala
    expect(off.filesOf(9, R)).toHaveLength(129);
  });

  it('estimates sizes sensibly: small for a short surah, large for a long one, bigger for higher quality', async () => {
    const { off } = await setup();
    const small = off.estimateBytes(112, R), big = off.estimateBytes(2, R);
    expect(small).toBeGreaterThan(50e3); expect(small).toBeLessThan(1.5e6);
    expect(big).toBeGreaterThan(50e6);
    expect(off.isBig(big)).toBe(true); expect(off.isBig(small)).toBe(false);
    expect(off.estimateBytes(112, 'Abdul_Basit_Murattal_192kbps')).toBeCloseTo(small * 1.5, -3);
  });
});

describe('downloading', () => {
  it('stores every file, reports progress, and remembers the surah as complete', async () => {
    const { off, caches } = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => okRes(1000)));
    const seen = [];
    const r = await off.downloadSurah(112, R, { onProgress: (d, t) => seen.push([d, t]) });
    expect(r).toMatchObject({ ok: true, done: 5, total: 5, bytes: 5000 });
    expect(seen.at(-1)).toEqual([5, 5]);
    expect((await (await caches.open('audio-v1')).keys())).toHaveLength(5);
    expect(off.downloadedInfo(112, R)).toMatchObject({ n: 5, bytes: 5000 });
    expect(off.downloadedInfo(112, 'Husary_128kbps')).toBeNull();              // another reciter is a different download
    expect(fetch.mock.calls.every(c => c[1].mode === 'cors')).toBe(true);      // readable (non-opaque) answers, so sizes are known
  });

  it('a failed file leaves what was saved, does not mark the surah complete, and a retry only fetches what is missing', async () => {
    const { off, caches } = await setup();
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async url => { calls++; return url.endsWith('112003.mp3') ? bad(503) : okRes(500) }));
    const first = await off.downloadSurah(112, R);
    expect(first).toMatchObject({ ok: false, error: 'network' });
    expect(off.downloadedInfo(112, R)).toBeNull();
    const saved = (await (await caches.open('audio-v1')).keys()).length; expect(saved).toBeGreaterThanOrEqual(3);
    vi.stubGlobal('fetch', vi.fn(async () => okRes(500)));
    const again = await off.downloadSurah(112, R);
    expect(again.ok).toBe(true); expect(fetch.mock.calls.length).toBe(5 - saved);   // only the missing ones
    expect(off.downloadedInfo(112, R)).toBeTruthy();
  });

  it('can be cancelled', async () => {
    const { off } = await setup();
    const ctrl = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => { ctrl.abort(); return okRes(100) }));
    const r = await off.downloadSurah(112, R, { signal: ctrl.signal });
    expect(r.ok).toBe(false); expect(r.error).toBe('cancelled'); expect(off.downloadedInfo(112, R)).toBeNull();
  });

  it('refuses to start when there is no room, without downloading anything', async () => {
    const { off } = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => okRes(1)));
    vi.stubGlobal('navigator', { ...navigator, storage: { estimate: async () => ({ usage: 99e6, quota: 100e6 }) } });
    const r = await off.downloadSurah(2, R);
    expect(r).toMatchObject({ ok: false, error: 'space' }); expect(fetch).not.toHaveBeenCalled();
  });

  it('removing a surah (or everything) deletes the files and the record', async () => {
    const { off, caches } = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => okRes(10)));
    await off.downloadSurah(112, R); await off.downloadSurah(114, R);
    expect(off.listDownloads().map(x => x.id)).toEqual([112, 114]);
    expect(off.totalBytes()).toBeGreaterThan(0);
    await off.removeSurah(112, R);
    expect(off.listDownloads().map(x => x.id)).toEqual([114]);
    expect((await (await caches.open('audio-v1')).keys()).some(u => u.includes('/112'))).toBe(false);
    await off.removeAll();
    expect(off.listDownloads()).toEqual([]); expect(caches.all.has('audio-v1')).toBe(false);
  });
});

/* ---------- the service worker: serves a downloaded file, including the Range requests an audio element makes ---------- */
describe('service worker audio', () => {
  const URL_ = 'https://everyayah.com/data/Alafasy_128kbps/112001.mp3';
  class FakeResponse {
    constructor(body, init = {}) { this.body = body; this.status = init.status || 200; this.headers = new Map(Object.entries(init.headers || {})) }
    async arrayBuffer() { return this.body }
  }
  async function loadSw(stored, fetchImpl) {
    const c = fakeCaches(); const cache = await c.open('audio-v1');
    if (stored) await cache.put(URL_, new FakeResponse(stored));
    const listeners = {};
    const self_ = { location: { origin: 'https://kx121999.github.io' }, registration: { scope: 'https://kx121999.github.io/rafiq-alhifz/' }, addEventListener: (t, f) => { listeners[t] = f }, skipWaiting() {}, clients: { claim() {} } };
    const code = readFileSync('public/sw.js', 'utf8').replace("'__VERSION__'", "'test'").replace('const PRECACHE = __PRECACHE__;', 'const PRECACHE = [];');
    new Function('self', 'caches', 'fetch', 'URL', 'Response', code)(self_, c, fetchImpl, URL, FakeResponse);
    return async (url, range) => {
      let promise = null;
      listeners.fetch({ request: { method: 'GET', url, mode: 'no-cors', headers: { get: n => (n === 'range' ? range : null) } }, respondWith: p => { promise = p } });
      return promise ? await promise : null;
    };
  }
  const bytes = n => Uint8Array.from({ length: n }, (_, i) => i).buffer;

  it('answers a Range request from the downloaded file with the right slice', async () => {
    const ask = await loadSw(bytes(100), vi.fn());
    let r = await ask(URL_, 'bytes=0-9');
    expect(r.status).toBe(206); expect(r.headers.get('Content-Range')).toBe('bytes 0-9/100'); expect(new Uint8Array(r.body)).toHaveLength(10);
    r = await ask(URL_, 'bytes=90-');
    expect(r.headers.get('Content-Range')).toBe('bytes 90-99/100'); expect([...new Uint8Array(r.body)][0]).toBe(90);
    r = await ask(URL_, 'bytes=-10');                                       // the last 10 bytes
    expect(r.headers.get('Content-Range')).toBe('bytes 90-99/100');
    r = await ask(URL_, 'bytes=0-9999');                                    // past the end: clipped
    expect(r.headers.get('Content-Range')).toBe('bytes 0-99/100');
    r = await ask(URL_, 'bytes=500-');
    expect(r.status).toBe(416);
  });

  it('serves the whole file when no range is asked for, and never touches the network for a downloaded file', async () => {
    const net = vi.fn();
    const ask = await loadSw(bytes(100), net);
    const r = await ask(URL_, null);
    expect(r.status).toBe(200); expect(r.body.byteLength).toBe(100); expect(net).not.toHaveBeenCalled();
  });

  it('for a file that was not downloaded, asks the network in CORS mode and passes the Range on', async () => {
    const net = vi.fn(async () => new FakeResponse(bytes(5), { status: 206 }));
    const ask = await loadSw(null, net);
    const r = await ask(URL_, 'bytes=0-');
    expect(net).toHaveBeenCalledWith(URL_, { mode: 'cors', headers: { Range: 'bytes=0-' } });
    expect(r.status).toBe(206);
    await ask(URL_, null);
    expect(net).toHaveBeenLastCalledWith(URL_, { mode: 'cors', headers: {} });
  });

  it('leaves every other website alone', async () => {
    const ask = await loadSw(null, vi.fn());
    expect(await ask('https://example.com/a.mp3', null)).toBeNull();        // no respondWith: the browser handles it
  });
});
