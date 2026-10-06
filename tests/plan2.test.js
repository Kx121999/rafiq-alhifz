import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => vi.useRealTimers());

async function setup(iso = '2026-05-01') {
  today(iso);
  const { state, Q } = await boot();
  const plan = await import('../src/plan.js');
  return { state, Q, plan };
}

describe('plans with chosen surahs, day types and a late start', () => {
  it('a plan of chosen surahs is memorised shortest first by default, and only counts those surahs', async () => {
    const { state, Q, plan } = await setup();
    const p = { id: 'custom', s: [2, 112, 108, 114], o: 'short', weeks: 4, start: '2026-05-01' };
    expect(plan.planIds(p)).toEqual([108, 112, 114, 2]);                  // 3, 4, 6 and 286 ayat
    const st = plan.planStats(p);
    expect(st.total).toBe(3 + 4 + 6 + 286); expect(st.next).toBe(108);
    memoriseAll(state, Q, 108);
    expect(plan.planStats(p).next).toBe(112); expect(plan.planStats(p).done).toBe(3);
    expect(plan.planIds({ ...p, o: 'asc' })).toEqual([2, 108, 112, 114]);
    expect(plan.planIds({ ...p, o: 'desc' })).toEqual([114, 112, 108, 2]);
  });

  it('refuses a custom plan with no valid surah, and drops invalid ones', async () => {
    const { plan } = await setup();
    expect(plan.cleanPlan({ id: 'custom', s: [], weeks: 4, start: '2026-05-01' })).toBeNull();
    expect(plan.cleanPlan({ id: 'custom', s: [0, 115, 'x'], weeks: 4, start: '2026-05-01' })).toBeNull();
    expect(plan.cleanPlan({ id: 'custom', s: [112, 112, 999], weeks: 4, start: '2026-05-01' })).toMatchObject({ s: [112], o: 'short' });
    expect(plan.cleanPlan({ id: 'amma', weeks: 0, start: '2026-05-01' })).toBeNull();
    expect(plan.cleanPlan({ id: 'amma', weeks: 8, start: 'yesterday' })).toBeNull();
    expect(plan.cleanPlan({ id: 'amma', weeks: 8, start: '2026-05-01', d: 'xxxxxxx' })).toEqual({ id: 'amma', weeks: 8, start: '2026-05-01' });   // no memorising day: ignored
  });

  it('spreads the work over the memorising days only', async () => {
    const { plan } = await setup();
    const all = plan.planStats({ id: 'tabarak', weeks: 4, start: '2026-05-01' });
    const half = plan.planStats({ id: 'tabarak', weeks: 4, start: '2026-05-01', d: 'mmmxxxm' });   // 4 memorising days a week
    expect(half.memDaysLeft).toBeLessThan(all.memDaysLeft);
    expect(half.daily).toBeGreaterThan(all.daily);
    expect(half.daily).toBe(Math.ceil(half.left / half.memDaysLeft));
  });

  it('knows what kind of day today is', async () => {
    const { plan } = await setup();                                          // 2026-05-01 is a Friday (getDay 5)
    expect(plan.kindOn({ d: 'mmmmmxm' }, '2026-05-01')).toBe('x');
    expect(plan.kindOn({ d: 'mmmmmrm' }, '2026-05-01')).toBe('r');
    expect(plan.kindOn({}, '2026-05-01')).toBe('m');
  });

  it('a late plan is stretched at its own pace; progress is untouched and the daily amount does not jump', async () => {
    const { state, Q, plan } = await setup();
    const p = { id: 'tabarak', weeks: 8, start: '2026-02-01', a: 5 };         // started three months ago: the time is over
    memoriseAll(state, Q, 67);
    const before = JSON.stringify(state.snapshot());
    const st = plan.planStats(p);
    expect(st.overdue).toBe(true); expect(st.behind).toBe(true); expect(st.daily).toBe(st.left);   // everything piled on one day: that is what we avoid
    const re = plan.redistribute(p);
    expect(re.added).toBeGreaterThan(0); expect(re.plan.weeks).toBe(8 + re.added); expect(re.plan.a).toBe(5);
    const after = plan.planStats(re.plan);
    expect(after.daily).toBeLessThanOrEqual(5); expect(after.overdue).toBe(false); expect(after.behind).toBe(false);
    expect(after.done).toBe(st.done);                                          // nothing was lost
    expect(JSON.stringify(state.snapshot())).toBe(before);                      // and nothing was written by the calculation
    expect(plan.redistribute(re.plan)).toBeNull();                              // nothing more to do
  });

  it('an on-time plan has nothing to redistribute', async () => {
    const { plan } = await setup();
    expect(plan.redistribute({ id: 'tabarak', weeks: 8, start: '2026-05-01' })).toBeNull();
  });

  it('turns an amount into a number of weeks', async () => {
    const { plan } = await setup();
    expect(plan.weeksFor(70, 5, 'mmmmmmm')).toBe(2);                            // 35 a week
    expect(plan.weeksFor(70, 10, 'mmmmmmm')).toBe(1);
    expect(plan.weeksFor(70, 5, 'mmmxxxm')).toBe(4);                            // 20 a week
    expect(plan.weeksFor(100000, 1)).toBe(104);                                 // capped
  });
});

describe('plans and the calendar', () => {
  const inZone = async (tz, iso, fn) => {
    const old = process.env.TZ; process.env.TZ = tz;
    try { const { plan } = await setup(iso); return fn(plan) } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; vi.useRealTimers() }
  };

  it('counts whole days across a clock change (daylight saving) without losing or gaining a day', async () => {
    await inZone('America/New_York', '2026-03-07', plan => {
      const st = plan.planStats({ id: 'tabarak', weeks: 2, start: '2026-03-07' });   // the clocks go forward on 2026-03-08
      expect(st.end).toBe('2026-03-21'); expect(st.daysLeft).toBe(14);
      expect(plan.memDays('2026-03-07', '2026-03-21')).toBe(14);
    });
    await inZone('America/New_York', '2026-11-01', plan => {                         // and back on 2026-11-01
      expect(plan.planStats({ id: 'tabarak', weeks: 1, start: '2026-11-01' })).toMatchObject({ end: '2026-11-08', daysLeft: 7 });
    });
  });

  it('gives the same answer wherever the device is, because it works in calendar days', async () => {
    const answers = [];
    for (const tz of ['Asia/Riyadh', 'Africa/Cairo', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      await inZone(tz, '2026-05-12', plan => { const s = plan.planStats({ id: 'amma', weeks: 8, start: '2026-05-12' }); answers.push([s.end, s.daysLeft, s.daily]) });
    }
    expect(new Set(answers.map(a => a.join())).size).toBe(1);
  });

  it('keeps counting correctly when the date moves on', async () => {
    const { plan } = await setup('2026-05-12');
    const p = { id: 'tabarak', weeks: 2, start: '2026-05-12' };
    expect(plan.planStats(p).daysLeft).toBe(14);
    today('2026-05-13'); expect(plan.planStats(p).daysLeft).toBe(13);
    today('2026-06-30'); expect(plan.planStats(p)).toMatchObject({ daysLeft: 0, overdue: true });
  });
});

describe('plans in a backup', () => {
  const file = plan => JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids: [{ name: 'نور', icon: '🌸', mode: 'reader', plan, S: { s: {}, goal: 5, day: '2026-05-12', n: 0, streak: 0, last: '' } }] });
  it('keeps a chosen-surahs plan with its day types and pace, and drops bad values', async () => {
    await setup('2026-05-12');
    const b = await import('../src/backup.js');
    const ok = b.parseBackup(file({ id: 'custom', s: [112, 114], o: 'asc', weeks: 3, start: '2026-05-01', d: 'mmmmmrx', a: 4, extra: 'x' }));
    expect(ok.kids[0].plan).toEqual({ id: 'custom', s: [112, 114], o: 'asc', weeks: 3, start: '2026-05-01', d: 'mmmmmrx', a: 4 });
    const bad = b.parseBackup(file({ id: 'amma', weeks: 8, start: '2026-05-01', d: 'zzzzzzz', a: -3 }));
    expect(bad.kids[0].plan).toEqual({ id: 'amma', weeks: 8, start: '2026-05-01' });
    expect(b.parseBackup(file({ id: 'nope', weeks: 8, start: '2026-05-01' })).kids[0].plan).toBeUndefined();
  });
  it('an older plan (three fields only) still loads and works', async () => {
    const { plan } = await setup('2026-05-12');
    expect(plan.planStats({ id: 'amma', weeks: 8, start: '2026-05-12' })).toMatchObject({ daysLeft: 56, kindToday: 'm', behind: false });
  });
});
