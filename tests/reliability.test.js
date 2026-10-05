import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() });

/** Makes the browser refuse writes (full or blocked storage) until the returned function is called. */
function breakStorage(name = 'QuotaExceededError') {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { throw new DOMException('full', name) };
  return () => { Storage.prototype.setItem = real };
}

describe('the site knows when saving fails', () => {
  it('reports a refused write, says why, and recovers when writing works again', async () => {
    today('2026-05-12');
    const { state, Q } = await boot();
    const seen = []; state.onStorageState(s => seen.push(s.ok + ':' + s.error));
    expect(state.storageState.ok).toBe(true);
    const fix = breakStorage();
    state.setAyah(112, 0, true); state.save();
    expect(state.storageState).toMatchObject({ ok: false, error: 'QuotaExceededError' });
    expect(state.retrySave()).toBe(false);
    fix();
    expect(state.retrySave()).toBe(true);
    expect(state.storageState.ok).toBe(true);
    expect(seen).toEqual(['false:QuotaExceededError', 'true:']);          // told once when it broke, once when it came back
    expect(JSON.parse(localStorage.getItem('hifz-kids-v1')).kids[0].S.s[112].m).toBe('1000');   // and the data really did get written
  });
});

describe('the "not saved" bar and undo', () => {
  async function page() {
    document.body.innerHTML = '<div id="saveBar" hidden><span id="saveWhy"></span><button id="saveExport"></button><button id="saveRetry"></button></div><div id="undoBar" hidden></div>';
    today('2026-05-12');
    const { state } = await boot();
    const guard = await import('../src/guard.js');
    guard.initGuard();
    return { state, guard };
  }
  it('appears with a reason when saving fails and goes away when it works', async () => {
    const { state } = await page();
    const bar = document.getElementById('saveBar');
    expect(bar.hidden).toBe(true);
    const fix = breakStorage('SecurityError'); state.save();
    expect(bar.hidden).toBe(false);
    expect(document.getElementById('saveWhy').textContent).toContain('يمنع التخزين');
    document.getElementById('saveRetry').click();
    expect(bar.hidden).toBe(false);                                        // still broken: still shown, with a hint
    fix(); document.getElementById('saveRetry').click();
    expect(bar.hidden).toBe(true);
  });
  it('undo runs once, and disappears by itself', async () => {
    const { guard } = await page();
    vi.useFakeTimers();                                                    // after the page is built (building it sets its own clock)
    const fn = vi.fn();
    guard.offerUndo('تم', fn, 5000);
    const bar = document.getElementById('undoBar');
    expect(bar.hidden).toBe(false); expect(bar.textContent).toContain('تم');
    bar.querySelector('button').click();
    expect(fn).toHaveBeenCalledTimes(1); expect(bar.hidden).toBe(true);
    guard.offerUndo('مرة أخرى', fn, 5000); vi.advanceTimersByTime(5100);
    expect(bar.hidden).toBe(true); expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('undoing a change to a surah', () => {
  it('puts the record back exactly, including weak ayat, and the daily count', async () => {
    today('2026-05-12');
    const { state, Q } = await boot();
    memoriseAll(state, Q, 112); state.setWeak(112, 1, true); state.bump(4);
    const snap = state.surahSnapshot(112);
    let d = 0; for (let i = 0; i < 4; i++) d += state.setAyah(112, i, false);
    state.bump(d);
    expect(state.mem(112)).toBe(0); expect(state.S.n).toBe(0);
    state.restoreSurah(112, snap); state.bump(-d);
    expect(state.S.s[112]).toEqual(snap); expect(state.mem(112)).toBe(4); expect(state.isWeak(112, 1)).toBe(true);
    expect(state.S.n).toBe(4);
    snap.m = 'x'; expect(state.S.s[112].m).toBe('1111');                    // the stored copy cannot be changed by accident
    state.restoreSurah(114, null); expect(state.S.s[114]).toBeUndefined();
  });
});

describe('importing is all or nothing', () => {
  const kid = (name, over = {}) => ({ name, icon: '🌸', mode: 'young', S: { s: {}, goal: 5, day: '2026-05-12', n: 0, streak: 0, last: '' }, ...over });

  it('a refused write changes nothing, on screen or on disk', async () => {
    today('2026-05-12');
    const { state, Q } = await boot();
    memoriseAll(state, Q, 112);
    const before = JSON.stringify(state.snapshot());
    const fix = breakStorage();
    expect(state.applyImport([kid('جديد')], 'replace')).toBe(false);
    expect(state.applyImport([kid('جديد')], 'append')).toBe(false);
    fix();
    expect(state.kids()).toHaveLength(1); expect(state.activeKid().name).toBe('طفلي'); expect(state.mem(112)).toBe(4);
    expect(JSON.stringify(state.snapshot())).toBe(before);
  });

  it('adds new children without touching the current ones, and renames a clash', async () => {
    today('2026-05-12');
    const { state } = await boot();
    expect(state.applyImport([kid('طفلي'), kid('طفلي'), kid('نور')], 'append')).toBe(true);
    expect(state.kids().map(k => k.name)).toEqual(['طفلي', 'طفلي (٢)', 'طفلي (٣)', 'نور']);
    expect(state.activeKid().name).toBe('طفلي');                            // the child on screen does not change
  });

  it('replaces everything and makes the first imported child the active one', async () => {
    today('2026-05-12');
    const { state } = await boot();
    expect(state.applyImport([kid('سلمى'), kid('يوسف')], 'replace')).toBe(true);
    expect(state.kids().map(k => k.name)).toEqual(['سلمى', 'يوسف']); expect(state.activeKid().name).toBe('سلمى');
    expect(state.applyImport([], 'replace')).toBe(false);                    // an empty list never wipes anything
    expect(state.kids()).toHaveLength(2);
  });
});

describe('the restore point', () => {
  it('keeps what was there before a replace, and can give it back', async () => {
    today('2026-05-12');
    const { state, Q } = await boot();
    memoriseAll(state, Q, 112);
    const b = await import('../src/backup.js');
    expect(b.restorePoint()).toBeNull();
    expect(b.makeRestorePoint()).toBe(true);
    state.applyImport([{ name: 'آخر', icon: '🌙', mode: 'reader', S: { s: {}, goal: 5, day: '2026-05-12', n: 0, streak: 0, last: '' } }], 'replace');
    const pt = b.restorePoint();
    expect(pt.kids).toHaveLength(1); expect(pt.kids[0].S.s[112].m).toBe('1111');
    expect(b.kidSummary(pt.kids[0])).toEqual({ ay: 4, done: 1 });
    state.applyImport(pt.kids, 'replace'); b.dropRestorePoint();
    expect(state.mem(112)).toBe(4); expect(b.restorePoint()).toBeNull();
  });
  it('cannot be tricked: a damaged kept copy is ignored', async () => {
    today('2026-05-12');
    await boot();
    const b = await import('../src/backup.js');
    localStorage.setItem('hifz-restore-v1', '{"at":"x","data":{"app":"other"}}');
    expect(b.restorePoint()).toBeNull();
    localStorage.setItem('hifz-restore-v1', 'not json');
    expect(b.restorePoint()).toBeNull();
  });
  it('says so when it cannot be kept', async () => {
    today('2026-05-12');
    await boot();
    const b = await import('../src/backup.js');
    const fix = breakStorage(); expect(b.makeRestorePoint()).toBe(false); fix();
  });
});
