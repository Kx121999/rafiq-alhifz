import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { boot } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

const ADHKAR = JSON.parse(readFileSync('public/adhkar.json', 'utf8'));
const fakeStore = () => { const m = {}; return { setItem: (k, v) => { m[k] = v }, getItem: k => m[k] ?? null, removeItem: k => { delete m[k] } } };
const goodEnv = over => ({
  nav: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome', onLine: true, language: 'ar', standalone: false,
    serviceWorker: { getRegistration: async () => ({}), controller: {} },
    storage: { persisted: async () => true, estimate: async () => ({ usage: 2097152 }) }, canShare: () => true },
  win: { isSecureContext: true, matchMedia: () => ({ matches: true }), Notification: { permission: 'granted' }, AudioContext: class {}, File: class {}, Blob: class {}, innerWidth: 400, innerHeight: 800, devicePixelRatio: 2 },
  doc: { fonts: { check: () => true }, createElement: () => ({ getContext: () => ({}) }) },
  store: fakeStore(), ...over,
});
async function setup() {
  await boot();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ADHKAR })));
  return import('../src/diagnose.js');
}
const by = rows => Object.fromEntries(rows.map(r => [r.id, r]));

describe('device check', () => {
  it('reports a healthy installed phone as all good', async () => {
    const d = await setup();
    const rows = by(await d.runChecks(goodEnv()));
    expect(Object.values(rows).filter(r => r.status === 'bad')).toEqual([]);
    expect(rows.install.status).toBe('ok'); expect(rows.offline.status).toBe('ok'); expect(rows.storage.detail).toContain('2.0');
    expect(rows.data.status).toBe('ok'); expect(rows.notify.status).toBe('ok'); expect(rows.share.status).toBe('ok');
  });

  it('explains each problem and what to do about it', async () => {
    const d = await setup();
    const env = goodEnv();
    env.nav = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Safari', onLine: false, language: 'ar', storage: { persisted: async () => false } };
    env.win = { isSecureContext: false, matchMedia: () => ({ matches: false }), innerWidth: 390, innerHeight: 800 };
    env.store = { setItem() { throw new Error('quota') }, getItem: () => null, removeItem() {} };
    env.doc = { fonts: { check: () => false }, createElement: () => ({}) };
    const rows = by(await d.runChecks(env));
    expect(rows.secure.status).toBe('bad');
    expect(rows.install.status).toBe('warn'); expect(rows.install.detail).toContain('إضافة إلى الشاشة الرئيسية');   // the iPhone way
    expect(rows.offline.status).toBe('bad');
    expect(rows.storage.status).toBe('bad');
    expect(rows.notify.status).toBe('warn'); expect(rows.notify.detail).toContain('iOS');
    expect(rows.share.status).toBe('warn'); expect(rows.sound.status).toBe('warn'); expect(rows.canvas.status).toBe('warn');
    expect(rows.fonts.status).toBe('warn'); expect(rows.online.status).toBe('warn');
  });

  it('a service worker that is registered but not in control yet is a hint, and a throwing check never stops the others', async () => {
    const d = await setup();
    const env = goodEnv(); env.nav.serviceWorker = { getRegistration: async () => ({}), controller: null };
    env.nav.storage = { persisted: async () => { throw new Error('boom') } };
    const rows = by(await d.runChecks(env));
    expect(rows.offline.status).toBe('warn'); expect(rows.offline.detail).toContain('أعد فتح');
    expect(rows.storage.status).toBe('bad');
    expect(rows.screen).toBeTruthy();                                    // later checks still ran
  });

  it('the copied report lists every line and the browser', async () => {
    const d = await setup();
    const text = d.reportText(await d.runChecks(goodEnv()), 'TestBrowser/1');
    expect(text.split('\n')[0]).toBe('فحص جهاز: رفيق الحفظ');
    expect(text).toContain('سليم · العمل بدون إنترنت'); expect(text).toContain('المتصفح: TestBrowser/1');
  });
});

describe('sound test', () => {
  const player = events => class { constructor(src) { this.src = src; this.l = {} } addEventListener(e, f) { this.l[e] = f } pause() {} play() { return events(this) } };
  it('succeeds once the sound starts', async () => {
    vi.useFakeTimers();
    const d = await setup();
    const p = d.testAudio(player(a => { setTimeout(() => a.l.playing(), 100); return Promise.resolve() }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toEqual({ ok: true, why: 'بدأ الصوت بنجاح.' });
  });
  it('says what went wrong: blocked, failed to load, or silent', async () => {
    vi.useFakeTimers();
    const d = await setup();
    const blocked = d.testAudio(player(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))));
    expect((await blocked).why).toContain('منع');
    const failed = d.testAudio(player(a => { setTimeout(() => a.l.error(), 50); return Promise.resolve() }));
    await vi.advanceTimersByTimeAsync(100); expect((await failed).ok).toBe(false);
    const silent = d.testAudio(player(() => Promise.resolve()), 3000);
    await vi.advanceTimersByTimeAsync(3100); expect((await silent).why).toContain('خلال');
  });
  it('uses a real recitation file of the first ayah', async () => {
    let src = '';
    vi.useFakeTimers();
    const d = await setup();
    const p = d.testAudio(class { constructor(s) { src = s } addEventListener() {} pause() {} play() { return Promise.resolve() } }, 10);
    await vi.advanceTimersByTimeAsync(20); await p;
    expect(src).toMatch(/^https:\/\/everyayah\.com\/data\/[A-Za-z0-9_-]+\/001001\.mp3$/);
  });
});
