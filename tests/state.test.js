import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => vi.useRealTimers());
const stored = () => JSON.parse(localStorage.getItem('hifz-kids-v1'));

describe('first run and migration', () => {
  it('gives a new visitor one empty reader profile', async () => {
    today('2026-05-01');
    const { state } = await boot();
    expect(state.kids()).toHaveLength(1);
    expect(state.activeKid()).toMatchObject({ name: 'طفلي', mode: 'reader' });
    expect(state.S).toMatchObject({ s: {}, goal: 5, n: 0, streak: 0, last: '' });
    expect(stored().kids).toHaveLength(1);
  });

  it('moves the old single-user progress into the first child and leaves the old key untouched', async () => {
    today('2026-05-01');
    const legacy = { s: { 112: { m: '1100', d: '2026-05-03', i: 2 } }, goal: 9, day: '2026-05-01', n: 2, streak: 4, last: '2026-05-01' };
    const { state } = await boot({ 'hifz-progress-v1': legacy });
    expect(state.activeKid().name).toBe('طفلي');
    expect(state.S.s[112]).toEqual(legacy.s[112]);
    expect(state.S.goal).toBe(9);
    expect(JSON.parse(localStorage.getItem('hifz-progress-v1'))).toEqual(legacy);
  });

  it('does not migrate again once the new store exists', async () => {
    today('2026-05-01');
    const { state } = await boot({ 'hifz-progress-v1': { s: { 114: { m: '111111', d: '2026-05-02', i: 1 } } } });
    const saved = JSON.stringify(stored());
    localStorage.setItem('hifz-progress-v1', JSON.stringify({ s: {}, goal: 50 }));   // changed afterwards
    const again = await boot({ 'hifz-kids-v1': saved });
    expect(again.state.kids()).toHaveLength(1);
    expect(again.state.S.s[114]).toBeTruthy();
    expect(again.state.S.goal).toBe(5);
  });

  it('survives a corrupted store by starting fresh', async () => {
    const { state } = await boot({ 'hifz-kids-v1': '{not json' });
    expect(state.kids()).toHaveLength(1);
  });

  it('rolls the daily count over when the stored day is old', async () => {
    today('2026-05-02');
    const { state } = await boot({ 'hifz-progress-v1': { s: {}, goal: 5, day: '2026-05-01', n: 4, streak: 1, last: '2026-05-01' } });
    expect(state.S.n).toBe(0);
    expect(state.S.day).toBe('2026-05-02');
  });
});

describe('memorising ayat', () => {
  it('starts the schedule tomorrow when the first ayah is marked', async () => {
    today('2026-05-01');
    const { state } = await boot();
    expect(state.setAyah(112, 0, true)).toBe(1);
    expect(state.rec(112)).toEqual({ m: '1000', d: '2026-05-02', i: 1 });
    expect(state.mem(112)).toBe(1);
  });

  it('reports 0 for a no-op and -1 for un-marking, and drops an empty record', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.setAyah(112, 0, true);
    expect(state.setAyah(112, 0, true)).toBe(0);
    expect(state.setAyah(112, 0, false)).toBe(-1);
    expect(state.rec(112)).toBeUndefined();
  });

  it('is due only on or after its review date', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.setAyah(112, 0, true);
    expect(state.isDue(112)).toBe(false);
    today('2026-05-02');
    expect(state.isDue(112)).toBe(true);
    expect(state.isDue(113)).toBe(false);
  });
});

describe('daily count and streak', () => {
  it('counts up, never below zero, and a streak needs consecutive days', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.bump(2); expect(state.S.n).toBe(2); expect(state.S.streak).toBe(1);
    state.bump(1); expect(state.S.streak).toBe(1);            // same day: no double count
    state.bump(-10); expect(state.S.n).toBe(0);
    today('2026-05-02'); state.bump(1);
    expect(state.S.streak).toBe(2); expect(state.S.n).toBe(1);   // new day resets the count
    today('2026-05-05'); state.bump(1);
    expect(state.S.streak).toBe(1);                              // a gap restarts it
  });
});

describe('spaced review', () => {
  it('doubles the interval up to 30 days, and resets to 1 when it needs repeating', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.setAyah(112, 0, true);
    const seen = [1, 2, 3, 4, 5, 6].map(() => state.grade(112, true));
    expect(seen).toEqual([2, 4, 8, 16, 30, 30]);
    expect(state.rec(112).d).toBe('2026-05-31');
    expect(state.grade(112, false)).toBe(1);
    expect(state.rec(112).d).toBe('2026-05-02');
  });
  it('ignores a surah with no progress', async () => {
    const { state } = await boot();
    expect(state.grade(113, true)).toBeNull();
  });
});

describe('several children', () => {
  it('keeps each child\'s progress separate and across a reload', async () => {
    today('2026-05-01');
    const { state } = await boot();
    const first = state.activeKid().id;
    state.setAyah(112, 0, true); state.save();
    const second = state.addKid({ name: 'يوسف', icon: '🌙', mode: 'young' });
    expect(state.activeKid().id).toBe(second.id);
    expect(state.S.s).toEqual({});                        // the new child starts empty
    state.setAyah(114, 0, true); state.setAyah(114, 1, true); state.save();
    state.switchKid(first);
    expect(Object.keys(state.S.s)).toEqual(['112']);
    state.switchKid(second.id);
    expect(Object.keys(state.S.s)).toEqual(['114']);

    const again = await boot({ 'hifz-kids-v1': localStorage.getItem('hifz-kids-v1') });
    expect(again.state.kids().map(k => k.name)).toEqual(['طفلي', 'يوسف']);
    expect(again.state.activeKid().id).toBe(second.id);
    expect(again.state.mem(114)).toBe(2);
  });

  it('removing the active child falls back to another one and adopts their progress', async () => {
    today('2026-05-01');
    const { state } = await boot();
    const first = state.activeKid().id;
    state.setAyah(112, 0, true); state.save();
    const second = state.addKid({ name: 'سلمى', icon: '🌸', mode: 'reader' });
    state.removeKid(second.id);
    expect(state.kids()).toHaveLength(1);
    expect(state.activeKid().id).toBe(first);
    expect(state.mem(112)).toBe(1);
  });

  it('updates a child\'s name, icon and mode', async () => {
    const { state } = await boot();
    const k = state.activeKid();
    state.updateKid(k.id, { name: 'نور', icon: '🌳', mode: 'young' });
    expect(state.activeKid()).toMatchObject({ name: 'نور', icon: '🌳', mode: 'young' });
  });
});

describe('per-child extras', () => {
  it('stores the plan and the last surah on the active child only', async () => {
    const { state } = await boot();
    const first = state.activeKid().id;
    state.setPlan({ id: 'amma', weeks: 8, start: '2026-05-01' }); state.setLast(113);
    const second = state.addKid({ name: 'يوسف', icon: '🌙', mode: 'reader' });
    expect(state.kidPlan()).toBeNull(); expect(state.lastSurah()).toBe(0);
    state.switchKid(first);
    expect(state.kidPlan()).toEqual({ id: 'amma', weeks: 8, start: '2026-05-01' }); expect(state.lastSurah()).toBe(113);
    state.setPlan(null);
    expect(state.kidPlan()).toBeNull();
    expect(second.id).not.toBe(first);
  });

  it('adds game stars separately from memorisation, ignoring junk and capping the total', async () => {
    const { state } = await boot();
    state.addGameStars(5); state.addGameStars(0); state.addGameStars(-3); state.addGameStars(2.9);
    expect(state.gameStars()).toBe(7);
    expect(state.mem(112)).toBe(0);
    state.addGameStars(5e6);
    expect(state.gameStars()).toBe(1e6);
  });
});

describe('importing children', () => {
  const kid = (name, s = {}) => ({ name, icon: '⭐', mode: 'reader', S: { s, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' } });

  it('adds imported children with fresh ids and keeps the existing ones', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.setAyah(112, 0, true);
    state.applyImport([kid('أ'), kid('ب')], 'append');
    expect(state.kids().map(k => k.name)).toEqual(['طفلي', 'أ', 'ب']);
    expect(new Set(state.kids().map(k => k.id)).size).toBe(3);
    expect(state.activeKid().name).toBe('طفلي');
    expect(state.mem(112)).toBe(1);
  });

  it('replaces everything and activates the first imported child', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.setAyah(112, 0, true);
    state.applyImport([kid('جديد', { 114: { m: '111111', d: '2026-05-02', i: 1 } })], 'replace');
    expect(state.kids().map(k => k.name)).toEqual(['جديد']);
    expect(state.activeKid().name).toBe('جديد');
    expect(state.mem(114)).toBe(6); expect(state.mem(112)).toBe(0);
  });

  it('does nothing for an empty list', async () => {
    const { state } = await boot();
    state.applyImport([], 'replace');
    expect(state.kids()).toHaveLength(1);
  });
});

describe('whole surahs', () => {
  it('memoriseAll fills every ayah', async () => {
    today('2026-05-01');
    const { state, Q } = await boot();
    memoriseAll(state, Q, 114);
    expect(state.mem(114)).toBe(Q[113].v.length);
  });
});
