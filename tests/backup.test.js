import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => vi.useRealTimers());

async function setup() {
  today('2026-05-01');
  const { state, Q } = await boot();
  const backup = await import('../src/backup.js');
  return { state, Q, backup };
}
const kid = over => ({ name: 'سلمى', icon: '🌸', mode: 'young', S: { s: {}, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' }, ...over });
const file = (kids, over = {}) => JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids, ...over });

describe('building a backup', () => {
  it('contains every child with their extras and the app marker', async () => {
    const { state, Q, backup } = await setup();
    memoriseAll(state, Q, 112);
    state.setPlan({ id: 'amma', weeks: 8, start: '2026-05-01' }); state.setLast(112); state.addGameStars(4);
    const b = backup.buildBackup();
    expect(b).toMatchObject({ app: 'rafiq-alhifz', version: 1 });
    expect(b.kids).toHaveLength(1);
    expect(b.kids[0]).toMatchObject({ plan: { id: 'amma' }, last: 112, game: { stars: 4 } });
  });

  it('round-trips through parseBackup without losing anything', async () => {
    const { state, Q, backup } = await setup();
    memoriseAll(state, Q, 112); memoriseAll(state, Q, 114);
    state.setPlan({ id: 'tabarak', weeks: 6, start: '2026-04-01' }); state.setLast(114); state.addGameStars(9);
    state.addKid({ name: 'يوسف', icon: '🌙', mode: 'reader' });
    const original = backup.buildBackup();
    const r = backup.parseBackup(JSON.stringify(original));
    expect(r.error).toBeUndefined();
    expect(r.skipped).toBe(0);
    expect(r.kids).toHaveLength(2);
    const strip = k => ({ name: k.name, icon: k.icon, mode: k.mode, s: k.S.s, plan: k.plan, last: k.last, game: k.game });
    expect(r.kids.map(strip)).toEqual(original.kids.map(strip));
  });
});

describe('rejecting bad files', () => {
  it.each([
    ['not JSON', 'hello'],
    ['null', null],
    ['another app', JSON.stringify({ app: 'x', version: 1, kids: [kid()] })],
    ['an unsupported version', file([kid()], { version: 9 })],
    ['no children', file([])],
    ['too many children', file(Array.from({ length: 31 }, () => kid()))],
    ['too large', 'x'.repeat(2e6 + 1)],
    ['no valid child', file([null, { S: 5 }])],
  ])('rejects %s with an Arabic message', async (_n, text) => {
    const { backup } = await setup();
    const r = backup.parseBackup(text);
    expect(r.kids).toBeUndefined();
    expect(r.error).toMatch(/[؀-ۿ]/);
  });
});

describe('cleaning a tampered file', () => {
  it('drops malformed surah records and counts them', async () => {
    const { Q, backup } = await setup();
    const s = {
      1: { m: '1'.repeat(Q[0].v.length), d: '2026-05-02', i: 2 },     // valid
      2: { m: '11', d: '2026-05-02', i: 2 },                          // wrong length
      3: { m: '1'.repeat(Q[2].v.length), d: 'tomorrow', i: 2 },       // bad date
      4: { m: '1'.repeat(Q[3].v.length), d: '2026-05-02', i: 99 },    // interval out of range
      5: { m: 'x'.repeat(Q[4].v.length), d: '2026-05-02', i: 1 },     // not a bit mask
      999: { m: '1', d: '2026-05-02', i: 1 },                         // no such surah
    };
    const r = backup.parseBackup(file([kid({ S: { s, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' } })]));
    expect(Object.keys(r.kids[0].S.s)).toEqual(['1']);
    expect(r.skipped).toBe(5);
  });

  it('clamps numbers and falls back for unknown names, icons and modes', async () => {
    const { backup } = await setup();
    const evil = kid({ name: 'ا'.repeat(100), icon: '💣', mode: 'admin', S: { s: {}, goal: 9999, day: 'bad', n: -5, streak: 'x', last: 'nope' }, last: 500, game: { stars: -1 } });
    const k = backup.parseBackup(file([evil])).kids[0];
    expect(k.name).toHaveLength(20);
    expect(k.icon).toBe('⭐');
    expect(k.mode).toBe('reader');
    expect(k.S).toMatchObject({ goal: 5, n: 0, streak: 0, last: '' });
    expect(k.S.day).toBe('2026-05-01');
    expect(k.last).toBeUndefined();
    expect(k.game).toBeUndefined();
  });

  it('gives an unnamed child a default name and keeps text as plain strings', async () => {
    const { backup } = await setup();
    const k = backup.parseBackup(file([kid({ name: '   ' }), kid({ name: '<img src=x onerror=alert(1)>' })])).kids;
    expect(k[0].name).toMatch(/[؀-ۿ]/);
    expect(typeof k[1].name).toBe('string');
    expect(k[1].name.length).toBeLessThanOrEqual(20);
  });

  it('accepts only real plans and never inherited property names', async () => {
    const { backup } = await setup();
    const plans = [{ id: 'amma', weeks: 8, start: '2026-05-01' }, { id: '__proto__', weeks: 8, start: '2026-05-01' }, { id: 'amma', weeks: 0, start: '2026-05-01' }, { id: 'amma', weeks: 8, start: 'soon' }];
    const kids = backup.parseBackup(file(plans.map(plan => kid({ plan })))).kids;
    expect(kids.map(k => k.plan && k.plan.id)).toEqual(['amma', undefined, undefined, undefined]);
  });

  it('records the time of the last export', async () => {
    const { backup } = await setup();
    expect(backup.lastExport()).toBeNull();
    localStorage.setItem('hifz-lastexport', new Date('2026-05-01T10:00:00').toISOString());
    expect(backup.lastExport()).toBeInstanceOf(Date);
  });
});

describe('weak ayat in backups', () => {
  it('keeps a valid weak mask through a round trip', async () => {
    const { state, Q, backup } = await setup();
    memoriseAll(state, Q, 112); state.setWeak(112, 1, true);
    const r = backup.parseBackup(JSON.stringify(backup.buildBackup()));
    expect(r.kids[0].S.s[112].w).toBe('0100');
  });

  it('ignores a mask of the wrong length or with junk, and never flags an ayah that is not memorised', async () => {
    const { Q, backup } = await setup();
    const rec = (m, w) => ({ m, d: '2026-05-02', i: 1, w });
    const s = {
      112: rec('1111', '0100'),           // fine
      113: rec('11100', '01'),            // wrong length
      114: rec('111111', 'zzzzzz'),       // not a mask
      108: rec('110', '011'),             // flags ayah 3, which is not memorised -> only ayah 2 survives
      110: rec('111', '000'),             // all zero -> no mask
    };
    expect(Q[111].v.length).toBe(4);
    const r = backup.parseBackup(file([kid({ S: { s, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' } })]));
    const out = r.kids[0].S.s;
    expect(out[112].w).toBe('0100');
    expect(out[113]).not.toHaveProperty('w');
    expect(out[114]).not.toHaveProperty('w');
    expect(out[108].w).toBe('010');
    expect(out[110]).not.toHaveProperty('w');
  });
});

describe('activity log in backups', () => {
  it('round-trips and keeps only sane entries', async () => {
    const { state, backup } = await setup();
    state.bump(3); state.addGameStars(2);
    const r = backup.parseBackup(JSON.stringify(backup.buildBackup()));
    expect(r.kids[0].log['2026-05-01']).toEqual({ a: 3, r: 0, w: 0, g: 2 });
  });

  it('drops bad dates, junk values and empty days, and clamps numbers', async () => {
    const { backup } = await setup();
    const log = {
      '2026-05-01': { a: 2, r: 'x', w: -4, g: 9e9 },    // r/w/g are junk -> 0, g clamps to 0 (out of range)
      'yesterday': { a: 1 },                              // not a date
      '2026-04-30': { a: 0, r: 0, w: 0, g: 0 },           // empty
      '2026-04-29': 'many',                               // not an object
      '2026-04-28': { a: 1.5 },                           // not a whole number
    };
    const k = backup.parseBackup(file([kid({ log })])).kids[0];
    expect(k.log).toEqual({ '2026-05-01': { a: 2, r: 0, w: 0, g: 0 } });
    expect(backup.parseBackup(file([kid({ log: 'nope' })])).kids[0].log).toBeUndefined();
    expect(backup.parseBackup(file([kid({ log: {} })])).kids[0].log).toBeUndefined();
  });
});
