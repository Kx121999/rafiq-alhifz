import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';
import { shiftDay } from '../src/util.js';

afterEach(() => vi.useRealTimers());

async function setup(date = '2026-05-10') {
  today(date);
  document.body.innerHTML = '<span id="repWeeks"><a data-off="0"></a><a data-off="1"></a></span><article id="reportBox"></article>';
  const { state, Q } = await boot();
  const report = await import('../src/report.js');
  return { state, Q, report };
}
const text = () => document.getElementById('reportBox').textContent;
const tiles = () => [...document.querySelectorAll('.rtile')].map(t => [t.querySelector('small').textContent, t.querySelector('b').textContent]);

describe('shiftDay()', () => {
  it('moves an ISO date across month, year and leap boundaries', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-05-10', 0)).toBe('2026-05-10');
  });
});

describe('weekDays()', () => {
  it('is the seven days ending today, oldest first', async () => {
    const { report } = await setup('2026-05-10');
    expect(report.weekDays(0)).toEqual(['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10']);
  });
  it('steps back a whole week per offset without overlapping', async () => {
    const { report } = await setup('2026-05-10');
    const [this_, last] = [report.weekDays(0), report.weekDays(1)];
    expect(last[6]).toBe('2026-05-03');
    expect(last).toHaveLength(7);
    expect(this_.filter(d => last.includes(d))).toEqual([]);
  });
});

describe('summarize()', () => {
  it('adds up the days in the window and counts the active ones', async () => {
    const { report } = await setup();
    const log = { '2026-05-05': { a: 3, r: 1, w: 0, g: 0 }, '2026-05-07': { a: 2, r: 0, w: 1, g: 5 }, '2026-04-01': { a: 99, r: 99, w: 99, g: 99 } };
    const s = report.summarize(log, report.weekDays(0));
    expect(s.total).toEqual({ a: 5, r: 1, w: 1, g: 5 });      // the April entry is outside the week
    expect(s.activeDays).toBe(2);
    expect(s.per).toHaveLength(7);
    expect(s.per.find(p => p.d === '2026-05-06')).toMatchObject({ a: 0, r: 0, w: 0, g: 0 });
  });
  it('copes with an empty log and with partial entries', async () => {
    const { report } = await setup();
    expect(report.summarize({}, report.weekDays(0)).total).toEqual({ a: 0, r: 0, w: 0, g: 0 });
    expect(report.summarize({ '2026-05-10': { a: 2 } }, report.weekDays(0)).total.a).toBe(2);
  });
});

describe('renderReport()', () => {
  it('shows this week\'s real numbers, the child and the date range', async () => {
    const { state, Q, report } = await setup();
    memoriseAll(state, Q, 112);                       // adds to the log only through bump(), as in the app
    let d = 0; for (let i = 0; i < Q[113].v.length; i++) d += state.setAyah(114, i, true);
    state.bump(d + 4);                                // 4 for surah 112 + 6 for surah 114 = 10
    state.grade(112, true); state.addGameStars(3);
    report.renderReport(0);
    const t = Object.fromEntries(tiles());
    expect(t['آيات جديدة حُفظت']).toBe((10).toLocaleString('ar-EG'));
    expect(t['مراجعات للسور']).toBe((1).toLocaleString('ar-EG'));
    expect(t['نجوم الألعاب']).toBe((3).toLocaleString('ar-EG'));
    expect(text()).toContain('طفلي');
    expect(document.querySelectorAll('.rcol')).toHaveLength(7);
    expect(text()).toContain('٢ من ١١٤'.replace('٢', (2).toLocaleString('ar-EG')));   // two surahs complete
  });

  it('shows last week separately and marks the chosen tab', async () => {
    const { state, report } = await setup('2026-05-10');
    state.bump(2);
    report.renderReport(1);
    expect(Object.fromEntries(tiles())['آيات جديدة حُفظت']).toBe((0).toLocaleString('ar-EG'));
    expect(document.querySelector('#repWeeks a[data-off="1"]').getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('#repWeeks a[data-off="0"]').hasAttribute('aria-current')).toBe(false);
  });

  it('clamps a silly week offset instead of failing', async () => {
    const { report } = await setup();
    for (const off of [-3, 1e9, NaN, 2.7]) expect(() => report.renderReport(off)).not.toThrow();
    expect(document.querySelectorAll('.rcol')).toHaveLength(7);
  });

  it('explains why there are no numbers when there is no log, or an empty week', async () => {
    const { state, report } = await setup();
    report.renderReport(0);
    expect(text()).toContain('سجل النشاط يبدأ');
    state.bump(1);
    report.renderReport(1);
    expect(text()).toContain('لا يوجد نشاط مسجّل');
  });

  it('includes the plan line only when there is a plan', async () => {
    const { state, report } = await setup();
    report.renderReport(0);
    expect(text()).not.toContain('الخطة:');
    state.setPlan({ id: 'amma', weeks: 8, start: '2026-05-10' });
    report.renderReport(0);
    expect(text()).toContain('الخطة: جزء عمّ');
  });

  it('shows the child\'s name as plain text', async () => {
    const { state, report } = await setup();
    state.updateKid(state.activeKid().id, { name: '<i>سلمى</i>', icon: '🌸', mode: 'reader' });
    report.renderReport(0);
    expect(text()).toContain('<i>سلمى</i>');
    expect(document.querySelector('.rep-name').children).toHaveLength(0);   // no element was created from the name
  });
});
