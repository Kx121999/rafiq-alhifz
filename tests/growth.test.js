import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll, QURAN } from './helpers.js';

afterEach(() => vi.useRealTimers());

const norm = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىی]/g, 'ي').trim();
const AR = n => Number(n).toLocaleString('ar-EG');

async function setupGames() {
  today('2026-05-12');
  const { state, Q } = await boot();
  [112, 113, 114, 1, 55].forEach(id => memoriseAll(state, Q, id));   // 55 = Ar-Rahman, full of repeated refrains
  const games = await import('../src/games.js');
  return { state, Q, games };
}

describe('new games: every question has exactly one right answer', () => {
  it('"which surah" only uses an ayah that exists in a single surah', async () => {
    const { games } = await setupGames();
    const where = new Map();                                                    // normalised ayah -> surahs it is in (built once)
    QURAN.forEach((c, i) => c.v.forEach(t => { const k = norm(t); where.set(k, [...new Set([...(where.get(k) || []), i + 1])]) }));
    for (let k = 0; k < 40; k++) {
      const q = games.buildWhich(null); expect(q).toBeTruthy();
      expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.correct);
      expect(where.get(norm(q.prompt))).toEqual([q.a.id]);                      // the ayah is in one surah only
      expect(q.correct).toBe('سورة ' + QURAN[q.a.id - 1].n);
    }
  });

  it('"what comes next" asks for the real next ayah, never an ayah that repeats in its surah', async () => {
    const { games } = await setupGames();
    const pairs = games.nextPairs(); expect(pairs.length).toBeGreaterThan(5);
    for (let k = 0; k < 40; k++) {
      const q = games.buildNext(null); expect(q).toBeTruthy();
      const v = QURAN[q.a.id - 1].v;
      expect(q.prompt).toBe(v[q.a.i]); expect(q.correct).toBe(v[q.a.i + 1]);
      expect(new Set(q.options.map(norm)).size).toBe(3);
      expect(v.filter(t => norm(t) === norm(q.prompt))).toHaveLength(1);
      expect(v.filter(t => norm(t) === norm(q.correct))).toHaveLength(1);
    }
  });

  it('"how many ayat" offers the real count among four different numbers', async () => {
    const { games } = await setupGames();
    for (let k = 0; k < 30; k++) {
      const q = games.buildCount(null); expect(q).toBeTruthy();
      const id = q.a.id; expect(q.correct).toBe(AR(QURAN[id - 1].v.length));
      expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.correct);
      expect(q.options.every(o => /^[٠-٩]+$/.test(o) && !/^٠+$/.test(o))).toBe(true);
    }
  });

  it('are not offered before anything is memorised', async () => {
    today('2026-05-12');
    await boot();
    const games = await import('../src/games.js');
    expect(games.buildWhich(null)).toBeNull(); expect(games.buildNext(null)).toBeNull(); expect(games.buildCount(null)).toBeNull();
  });
});

describe('star shop', () => {
  it('spends game stars without touching the earned total, and refuses what you cannot afford', async () => {
    today('2026-05-12');
    const { state } = await boot();
    state.addGameStars(60);
    expect(state.starBalance()).toBe(60);
    expect(state.buyItem('qamar')).toBe('ok');
    expect(state.starBalance()).toBe(10); expect(state.gameStars()).toBe(60);       // earned total unchanged: medals keep counting it
    expect(state.buyItem('qamar')).toBe('owned');
    expect(state.buyItem('warda')).toBe('poor');
    expect(state.buyItem('nope')).toBe('unknown');
    state.addGameStars(5);
    expect(state.activeKid().game).toEqual({ stars: 65, spent: 50 });              // adding stars keeps what was spent
  });

  it('a bought friend becomes the child\'s friend, themes and frames switch on and off, nothing unowned can be used', async () => {
    today('2026-05-12');
    const { state } = await boot();
    state.addGameStars(200);
    expect(state.useItem('qamar')).toBe(false); expect(state.useItem('lilac')).toBe(false);
    state.buyItem('qamar'); state.buyItem('lilac'); state.buyItem('gold');
    expect(state.useItem('qamar')).toBe(true); expect(state.friendOf()).toBe('qamar');
    expect(state.friendsFor(state.activeKid()).map(f => f.id)).toContain('qamar');
    expect(state.friendsFor(state.activeKid()).map(f => f.id)).not.toContain('warda');
    state.useItem('lilac'); expect(state.shopTheme()).toBe('lilac');
    state.useItem('lilac'); expect(state.shopTheme()).toBe('');
    state.useItem('gold'); expect(state.shopFrame(state.activeKid())).toBe('gold');
  });
});

describe('rest day and streak', () => {
  it('weeks start on Saturday', async () => {
    today('2026-05-12');
    const { state } = await boot();
    expect(state.weekStartOf('2026-05-09')).toBe('2026-05-09');   // Saturday
    expect(state.weekStartOf('2026-05-15')).toBe('2026-05-09');   // Friday
    expect(state.weekStartOf('2026-05-16')).toBe('2026-05-16');   // next Saturday
  });

  it('a rest day keeps the streak alive across a missed day, once per week', async () => {
    today('2026-05-09');
    const { state } = await boot();
    Object.assign(state.S, { last: '2026-05-08', streak: 3 });
    expect(state.streakNow()).toBe(3);                            // yesterday: still alive
    expect(state.useRestDay()).toBe(true);                        // today is a rest day
    expect(state.useRestDay()).toBe(false);                       // only one a week
    today('2026-05-10');
    expect(state.streakNow()).toBe(3);                            // the gap is a rest day: not broken
    state.bump(1);
    expect(state.S.streak).toBe(4);                               // and it continues
    today('2026-05-13');
    expect(state.streakNow()).toBe(0);                            // two plain missed days break it
    today('2026-05-16');
    expect(state.useRestDay()).toBe(true);                        // a new week, a new rest day
  });

  it('without a rest day a missed day resets the streak as before', async () => {
    today('2026-05-10');
    const { state } = await boot();
    Object.assign(state.S, { last: '2026-05-08', streak: 3 });
    expect(state.streakNow()).toBe(0);
    state.bump(1); expect(state.S.streak).toBe(1);
  });
});

describe('weekly challenge', () => {
  it('is the same for everyone in a week, changes the next week, and young children get easier targets', async () => {
    today('2026-05-12');
    await boot();
    const c = await import('../src/challenge.js');
    expect(c.challengeOf('2026-05-09').id).toBe(c.challengeOf('2026-05-09').id);
    const ids = new Set([0, 1, 2, 3, 4].map(i => c.challengeOf(new Date(Date.UTC(2026, 4, 9 + 7 * i)).toISOString().slice(0, 10)).id));
    expect(ids.size).toBe(c.CHALLENGES.length);                   // five weeks cover all five challenges
    c.CHALLENGES.forEach(ch => expect(c.targetOf(ch, { mode: 'young' })).toBeLessThan(c.targetOf(ch, { mode: 'reader' })));
  });

  it('measures the week from the activity log and the adhkar, and pays the reward once', async () => {
    // find a Saturday whose challenge is "memorise ayat"
    const probe = await (async () => { await boot(); return import('../src/challenge.js') })();
    let ws = '2026-05-09'; while (probe.challengeOf(ws).id !== 'ayat') ws = new Date(Date.UTC(+ws.slice(0, 4), +ws.slice(5, 7) - 1, +ws.slice(8) + 7)).toISOString().slice(0, 10);
    today(ws);
    const { state } = await boot();
    const c = await import('../src/challenge.js');
    const kid = () => state.activeKid();
    state.bump(4);
    expect(c.progressOf(c.challengeOf(ws), kid(), ws)).toBe(4);
    expect(c.checkChallenge()).toBe(false);
    state.bump(6);
    expect(c.progressOf(c.challengeOf(ws), kid(), ws)).toBe(10);
    expect(c.checkChallenge()).toBe(true);
    expect(state.weeksDone()).toBe(1);
    expect(state.gameStars()).toBe(c.BONUS_STARS);
    expect(c.checkChallenge()).toBe(false);                       // never twice for the same week
    expect(state.gameStars()).toBe(c.BONUS_STARS);
  });

  it('counts finished adhkar days for the adhkar challenges', async () => {
    today('2026-05-12');
    const { state } = await boot();
    const c = await import('../src/challenge.js');
    const sabah = c.CHALLENGES.find(x => x.id === 'sabah');
    state.azSave('sabah', [1], true);
    expect(c.progressOf(sabah, state.activeKid(), '2026-05-09')).toBe(1);
    state.azSave('masaa', [1], true);
    expect(c.progressOf(sabah, state.activeKid(), '2026-05-09')).toBe(1);   // evening does not count for the morning challenge
  });
});

describe('backups carry the new fields safely', () => {
  const file = k => JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids: [{ name: 'سلمى', icon: '🌸', mode: 'young', S: { s: {}, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' }, ...k }] });
  it('keeps real purchases, rest days and finished weeks', async () => {
    today('2026-05-12');
    await boot();
    const b = await import('../src/backup.js');
    const r = b.parseBackup(file({ game: { stars: 100, spent: 90 }, shop: { own: ['qamar', 'lilac', 'qamar'], theme: 'lilac', frame: 'gold' }, friend: 'qamar', rest: { '2026-05-09': 1 }, wk: { '2026-05-02': 1 } }));
    const k = r.kids[0];
    expect(k.game).toEqual({ stars: 100, spent: 90 });
    expect(k.shop).toEqual({ own: ['qamar', 'lilac'], theme: 'lilac' });          // the frame was not owned: dropped
    expect(k.friend).toBe('qamar'); expect(k.rest).toEqual({ '2026-05-09': 1 }); expect(k.wk).toEqual({ '2026-05-02': 1 });
  });
  it('rejects spending more than was earned, unknown items, and a shop friend that was never bought', async () => {
    today('2026-05-12');
    await boot();
    const b = await import('../src/backup.js');
    const k = b.parseBackup(file({ game: { stars: 10, spent: 999 }, shop: { own: ['hacked', 7] }, friend: 'warda', rest: { x: 1, '2026-05-09': 2 }, wk: 'no' })).kids[0];
    expect(k.game).toEqual({ stars: 10, spent: 10 }); expect(k.shop).toBeUndefined();
    expect(k.friend).toBeUndefined(); expect(k.rest).toBeUndefined(); expect(k.wk).toBeUndefined();
  });
});

describe('family report', () => {
  it('summarises each child separately from their own saved data', async () => {
    today('2026-05-12');
    const { state, Q } = await boot();
    memoriseAll(state, Q, 112); state.bump(4);
    state.addKid({ name: 'يوسف', icon: '🌙', mode: 'young' });
    memoriseAll(state, Q, 114); state.bump(6);
    state.azSave('sabah', [1], true);
    const fam = await import('../src/family.js');
    const rows = state.snapshot().kids.map(k => fam.familyRow(k));
    expect(rows.map(r => r.name)).toEqual(['طفلي', 'يوسف']);
    expect(rows[0]).toMatchObject({ memorised: 4, done: 1, azDays: 0 }); expect(rows[0].week.a).toBe(4);
    expect(rows[1]).toMatchObject({ memorised: 6, done: 1, azDays: 1 }); expect(rows[1].week.a).toBe(6);
  });
});
