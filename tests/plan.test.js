import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll, QURAN } from './helpers.js';

afterEach(() => vi.useRealTimers());
const ayatIn = (from, to) => QURAN.slice(from - 1, to).reduce((n, s) => n + s.v.length, 0);

async function setup() {
  today('2026-05-01');
  const { state, Q } = await boot();
  const plan = await import('../src/plan.js');
  return { state, Q, plan };
}

describe('planStats', () => {
  it('counts the ayat of the chosen range and spreads the remainder over the days left', async () => {
    const { plan } = await setup();
    const st = plan.planStats({ id: 'amma', weeks: 8, start: '2026-05-01' });
    const total = ayatIn(78, 114);
    expect(st.total).toBe(total);
    expect(st.left).toBe(total);
    expect(st.daysLeft).toBe(56);
    expect(st.daily).toBe(Math.ceil(total / 56));
    expect(st.end).toBe('2026-06-26');
  });

  it('memorises Juz\' Amma from An-Nas upward, and Juz\' Tabarak from Al-Mulk down', async () => {
    const { state, Q, plan } = await setup();
    expect(plan.planStats({ id: 'amma', weeks: 8, start: '2026-05-01' }).next).toBe(114);
    expect(plan.planStats({ id: 'tabarak', weeks: 8, start: '2026-05-01' }).next).toBe(67);
    memoriseAll(state, Q, 114);
    expect(plan.planStats({ id: 'amma', weeks: 8, start: '2026-05-01' }).next).toBe(113);
  });

  it('counts memorised ayat as done and lowers the daily target', async () => {
    const { state, Q, plan } = await setup();
    const before = plan.planStats({ id: 'tabarak', weeks: 4, start: '2026-05-01' });
    memoriseAll(state, Q, 67);
    const after = plan.planStats({ id: 'tabarak', weeks: 4, start: '2026-05-01' });
    expect(after.done).toBe(Q[66].v.length);
    expect(after.left).toBe(before.left - Q[66].v.length);
    expect(after.daily).toBeLessThanOrEqual(before.daily);
  });

  it('flags a plan whose time has run out and asks for the whole remainder', async () => {
    const { plan } = await setup();
    const st = plan.planStats({ id: 'tabarak', weeks: 8, start: '2026-02-01' });
    expect(st.daysLeft).toBe(0);
    expect(st.overdue).toBe(true);
    expect(st.daily).toBe(st.left);
  });

  it('is finished when everything is memorised', async () => {
    const { state, Q, plan } = await setup();
    for (let id = 67; id <= 77; id++) memoriseAll(state, Q, id);
    const st = plan.planStats({ id: 'tabarak', weeks: 8, start: '2026-05-01' });
    expect(st).toMatchObject({ left: 0, daily: 0, next: 0, overdue: false });
  });

  it('rejects unknown ids, including inherited property names', async () => {
    const { plan } = await setup();
    for (const id of ['nope', '__proto__', 'toString', 'constructor']) {
      expect(plan.planStats({ id, weeks: 8, start: '2026-05-01' })).toBeNull();
    }
  });
});
