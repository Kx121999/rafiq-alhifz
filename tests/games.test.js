import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';
import { norm } from '../src/util.js';

afterEach(() => vi.useRealTimers());
const RUNS = 200;
const words = t => t.trim().split(/\s+/).filter(w => /[ء-يٱ-ۓ]/.test(w));

async function setup(surahs = [112, 114, 108]) {
  today('2026-05-01');
  const { state, Q } = await boot();
  const games = await import('../src/games.js');
  surahs.forEach(id => memoriseAll(state, Q, id));
  return { state, Q, games };
}

describe('what a child can play', () => {
  it('uses only memorised ayat', async () => {
    const { Q, games } = await setup([112]);
    const pool = games.memorisedPool();
    expect(pool).toHaveLength(4);
    expect(pool.every(a => a.id === 112 && Q[111].v[a.i] === a.t)).toBe(true);
  });

  it('finds windows of three consecutive memorised ayat, and gaps break them', async () => {
    today('2026-05-01');
    const { state } = await boot();
    const games = await import('../src/games.js');
    [0, 1, 2, 4, 5].forEach(i => state.setAyah(114, i, true));   // An-Nas: ayat 1-3 and 5-6
    expect(games.runs()).toEqual([{ id: 114, i: 0 }]);
    state.setAyah(114, 3, true);
    expect(games.runs().map(r => r.i)).toEqual([0, 1, 2, 3]);
  });

  it('offers nothing before anything is memorised', async () => {
    const { games } = await setup([]);
    expect(games.memorisedPool()).toEqual([]);
    expect(games.runs()).toEqual([]);
    expect(games.buildComplete()).toBeNull();
    expect(games.buildMissing()).toBeNull();
    expect(games.buildOrder()).toBeNull();
  });
});

describe('complete the ayah', () => {
  it('always offers the true ending among three distinct options', async () => {
    const { games } = await setup();
    const pool = games.memorisedPool().map(a => a.t);
    for (let k = 0; k < RUNS; k++) {
      const q = games.buildComplete();
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options.map(norm)).size).toBe(3);
      expect(q.options).toContain(q.correct);
      expect(pool).toContain(q.full);
      const head = q.prompt.replace(/\s*…$/, '').trim();
      expect(words(q.full).join(' ')).toBe(words(head + ' ' + q.correct).join(' '));
    }
  });
});

describe('the missing word', () => {
  it('hides exactly one word, which is among four distinct options', async () => {
    const { games } = await setup();
    const pool = games.memorisedPool().map(a => a.t);
    for (let k = 0; k < RUNS; k++) {
      const q = games.buildMissing();
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map(norm)).size).toBe(4);
      expect(q.options).toContain(q.correct);
      expect(q.prompt.split('＿＿＿')).toHaveLength(2);
      expect(pool).toContain(q.full);
      expect(words(q.prompt.replace('＿＿＿', q.correct)).join(' ')).toBe(words(q.full).join(' '));
    }
  });
});

describe('ordering ayat', () => {
  it('shuffles three consecutive ayat of one surah and never leaves them in order', async () => {
    const { Q, games } = await setup([114]);
    for (let k = 0; k < RUNS; k++) {
      const q = games.buildOrder();
      expect(q.items).toHaveLength(3);
      expect(q.items.map(x => x.n).sort()).toEqual([0, 1, 2]);
      expect(q.items.some((x, i) => x.n !== i)).toBe(true);
      const start = Q[113].v.indexOf(q.items.find(x => x.n === 0).t);
      expect(start).toBeGreaterThanOrEqual(0);
      q.items.forEach(x => expect(x.t).toBe(Q[113].v[start + x.n]));
    }
  });
});
