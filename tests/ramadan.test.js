import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today } from './helpers.js';
import { hijriOf, hijriText, ramadanWindow, showBanner, trackerOf, activeOn } from '../src/ramadan.js';

afterEach(() => { vi.useRealTimers(); localStorage.clear() });

describe('the Hijri calendar from the browser', () => {
  it('knows the start of Ramadan 1447 and 1448 (Umm al-Qura)', () => {
    expect(hijriOf('2026-02-17')).toEqual({ y: 1447, m: 8, d: 29 });
    expect(hijriOf('2026-02-18')).toEqual({ y: 1447, m: 9, d: 1 });
    expect(hijriOf('2027-02-08')).toEqual({ y: 1448, m: 9, d: 1 });
    expect(hijriOf('2027-03-09')).toEqual({ y: 1448, m: 10, d: 1 });
  });
  it('can be moved a day for moon sighting', () => {
    expect(hijriOf('2027-02-08', -1)).toEqual({ y: 1448, m: 8, d: 30 });
    expect(hijriOf('2027-02-08', 1)).toEqual({ y: 1448, m: 9, d: 2 });
  });
  it('writes a date in Arabic', () => {
    expect(hijriText({ y: 1448, m: 9, d: 1 })).toBe('١ رمضان ١٤٤٨ هـ');
  });
});

describe('where we are in Ramadan', () => {
  it('before: counts the days to the next one', () => {
    const w = ramadanWindow('2026-10-05', 0);
    expect(w).toMatchObject({ phase: 'before', year: 1448, start: '2027-02-08', end: '2027-03-08', daysUntil: 126, dayNo: 0 });
    expect(w.days).toHaveLength(29);
  });
  it('during: numbers the day', () => {
    expect(ramadanWindow('2027-02-08', 0)).toMatchObject({ phase: 'during', dayNo: 1 });
    expect(ramadanWindow('2027-02-20', 0)).toMatchObject({ phase: 'during', dayNo: 13 });
    expect(ramadanWindow('2027-03-08', 0)).toMatchObject({ phase: 'during', dayNo: 29 });
  });
  it('after: says how long ago it ended, and by then it is the next year\'s calendar', () => {
    expect(ramadanWindow('2027-03-12', 0)).toMatchObject({ phase: 'after', daysSinceEnd: 4 });
  });
  it('moving the calendar by a day moves the start by a day', () => {
    expect(ramadanWindow('2027-02-20', 1).start).toBe('2027-02-07');
    expect(ramadanWindow('2027-02-20', -1).start).toBe('2027-02-09');
  });
  it('shows the banner three weeks before, all month, and a week after, but not otherwise', () => {
    const at = d => showBanner(ramadanWindow(d, 0));
    expect(at('2026-10-05')).toBe(false);   // months away
    expect(at('2027-01-18')).toBe(true);    // 21 days before
    expect(at('2027-01-17')).toBe(false);   // 22 days before
    expect(at('2027-02-20')).toBe(true);
    expect(at('2027-03-15')).toBe(true);    // a week after
    expect(at('2027-03-20')).toBe(false);
  });
});

describe('the tracker', () => {
  const w = ramadanWindow('2027-02-12', 0);
  const kid = { log: { '2027-02-08': { a: 2, r: 0, w: 0, g: 0 }, '2027-02-09': { a: 0, r: 0, w: 0, g: 0 }, '2027-02-10': { g: 3 } }, az: { '2027-02-11': { sabah: { c: [1], d: 1 }, masaa: { c: [1], d: 0 } } } };
  it('counts a day when anything was done: an ayah, a review, game stars or a finished adhkar list', () => {
    expect(activeOn(kid, '2027-02-08')).toBe(true);
    expect(activeOn(kid, '2027-02-09')).toBe(false);          // an all-zero entry is not activity
    expect(activeOn(kid, '2027-02-10')).toBe(true);
    expect(activeOn(kid, '2027-02-11')).toBe(true);           // a finished morning list
    expect(activeOn({ az: { '2027-02-11': { masaa: { c: [1], d: 0 } } } }, '2027-02-11')).toBe(false);   // started but not finished
  });
  it('marks every day done, missed, today or still to come', () => {
    const t = trackerOf(kid, w, '2027-02-12');
    expect(t.per).toHaveLength(29);
    expect(t.per.slice(0, 5).map(p => p.state)).toEqual(['done', 'missed', 'done', 'done', 'today']);
    expect(t.per[5].state).toBe('future'); expect(t.per.at(-1).state).toBe('future');
    expect(t.active).toBe(3);
  });
});

describe('medals and the page', () => {
  it('remembers the best Ramadan of a child, never lowers it, and backups keep only sensible values', async () => {
    today('2027-02-20');
    const { state } = await boot();
    const r = await import('../src/ramadan.js');
    state.bump(1);                                            // activity today
    expect(r.recordRamadan('2027-02-20')).toBe(1);
    expect(state.activeKid().ram).toEqual({ 1448: 1 });
    state.setRamadanDays(1448, 0); state.setRamadanDays(1448, 1); expect(state.ramBest()).toBe(1);
    state.setRamadanDays(1448, 12); state.setRamadanDays(1448, 5); expect(state.ramBest()).toBe(12);
    expect(r.recordRamadan('2026-10-05')).toBe(0);            // before Ramadan: nothing to record
    const b = await import('../src/backup.js');
    const file = ram => JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids: [{ name: 'س', icon: '🌸', mode: 'young', ram, S: { s: {}, goal: 5, day: '2027-02-20', n: 0, streak: 0, last: '' } }] });
    expect(b.parseBackup(file({ 1448: 12, 1447: 99, abc: 3, 1500: 31, 1449: 4 })).kids[0].ram).toEqual({ 1448: 12, 1449: 4 });
    expect(b.parseBackup(file('x')).kids[0].ram).toBeUndefined();
  });

  it('the page shows the countdown before, and the 29 days during', async () => {
    document.body.innerHTML = '<div id="ramBox"></div>';
    today('2026-10-05');
    await boot();
    let r = await import('../src/ramadan.js');
    r.renderRamadan();
    expect(document.querySelector('#ramBox h2').textContent).toContain('بعد');
    expect(document.querySelectorAll('.ramday')).toHaveLength(0);
    vi.resetModules(); today('2027-02-20');
    await boot();
    r = await import('../src/ramadan.js');
    r.renderRamadan();
    expect(document.querySelector('#ramBox h2').textContent).toContain('١٣');
    expect(document.querySelectorAll('.ramday')).toHaveLength(29);
    expect(document.querySelector('.ramday.today').textContent).toContain('١٣');
  });
});
