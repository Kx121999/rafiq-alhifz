import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => { vi.useRealTimers() });

const DOM = '<h1 id="dbGreet"></h1><p id="dbSub"></p><section id="dbSession"></section><div id="dbDue"></div><div id="dbGoal"></div><div id="dbMeta"></div><nav id="dbTools"></nav>';
async function page(setup, iso = '2026-05-12') {
  today(iso);
  document.body.innerHTML = DOM;
  const { state, Q } = await boot();
  if (setup) setup(state, Q);
  const d = await import('../src/dashboard.js');
  d.renderDashboard();
  return { state, Q, d };
}
const text = id => document.getElementById(id).textContent;
const due = (st, id, d = '2026-05-11') => { st.rec(id).d = d };

describe('the dashboard answers "what do I do now?"', () => {
  it('a new child gets an invitation to a first session, never numbers that did not happen', async () => {
    await page();
    expect(text('dbSession')).toContain('جلستك الأولى');
    expect(text('dbSession')).toContain('الفاتحة');
    expect(text('dbSession')).toContain('ابدأ أول جلسة');
    expect(text('dbDue')).toContain('بعد أن تعلّم أول آية');
    expect(text('dbMeta')).toContain('لم تبدأ الحفظ بعد');
    expect(text('dbSub')).not.toMatch(/[١-٩]/);
  });

  it('continues from the exact ayah where the child stopped in that surah', async () => {
    await page((st, Q) => { st.setAyah(114, 0, true); st.setAyah(114, 1, true); st.setLast(114) });
    expect(text('dbSession')).toContain('الناس');
    expect(text('dbSession')).toContain('تكمل من الآية ' + (3).toLocaleString('ar-EG'));
    expect(text('dbSession')).toContain('ابدأ الجلسة');
  });

  it('puts due reviews and weak ayat on the card, and counts them on the review card', async () => {
    await page((st, Q) => { memoriseAll(st, Q, 112); memoriseAll(st, Q, 114); due(st, 112); st.setWeak(114, 2, true) });
    expect(text('dbSession')).toContain('تبدأ بمراجعة قصيرة');
    expect(text('dbSession')).toContain('ضعيفة');
    expect(text('dbDue')).toContain((2).toLocaleString('ar-EG'));
    expect(document.querySelector('#dbDue a').getAttribute('href')).toBe('#/review');
    expect(text('dbSub')).toContain('سورة');
  });

  it('shows what is left of today\'s goal, and a finished goal says so', async () => {
    await page((st, Q) => { memoriseAll(st, Q, 114); st.bump(2) });
    expect(text('dbGoal')).toContain('باقي ' + (3).toLocaleString('ar-EG') + ' آيات');
    expect(document.querySelector('#dbGoal [role=progressbar]').getAttribute('aria-valuenow')).toBe('2');
    await page((st, Q) => { memoriseAll(st, Q, 114); st.bump(5) });
    expect(text('dbGoal')).toContain('أتممتَ الهدف');
    expect(text('dbSession')).toContain('جلسة إضافية');
  });

  it('never shows a lone zero (it is drawn like a dot) and the goal buttons change the goal', async () => {
    const { state, d } = await page();
    expect(text('dbGoal')).not.toMatch(/^\s*٠\s/);
    document.getElementById('gPlus').click();
    expect(state.S.goal).toBe(6);
    document.getElementById('gMinus').click(); document.getElementById('gMinus').click();
    expect(state.S.goal).toBe(4);
    for (let i = 0; i < 10; i++) document.getElementById('gMinus').click();
    expect(state.S.goal).toBe(1);                                              // never below one
  });

  it('shows the next medal with what it asks for, and the last one earned', async () => {
    await page((st, Q) => { st.setAyah(114, 0, true) });
    expect(text('dbMeta')).toContain('وسامك القادم');
    expect(text('dbMeta')).toContain('عشر آيات');
  });

  it('follows the plan\'s kind of day: rest, review, or memorise', async () => {
    await page(st => st.setPlan({ id: 'amma', weeks: 8, start: '2026-05-01', d: 'xxxxxxm' }), '2026-05-12');   // a Tuesday: rest
    expect(text('dbSession')).toContain('يوم راحة');
    await page(st => st.setPlan({ id: 'amma', weeks: 8, start: '2026-05-01', d: 'rrrrrrm' }), '2026-05-12');
    expect(text('dbSession')).toContain('يوم مراجعة');
    await page(st => st.setPlan({ id: 'amma', weeks: 8, start: '2026-05-01' }), '2026-05-12');
    expect(text('dbSession')).not.toContain('يوم راحة');
  });

  it('shows the tool links and puts the name in the greeting as plain text', async () => {
    await page((st) => { st.updateKid(st.activeKid().id, { name: '<b>نور</b>', icon: '🌸', mode: 'reader' }) });
    expect(text('dbGreet')).toContain('<b>نور</b>');
    expect(document.querySelector('#dbGreet b')).toBeNull();
    expect([...document.querySelectorAll('#dbTools a')].map(a => a.getAttribute('href'))).toContain('#/plan');
  });
});

describe('sessionTarget', () => {
  it('prefers where the child stopped, then the plan, then a surah in progress, then Al-Fatiha', async () => {
    const { state, d } = await page();
    expect(d.sessionTarget()).toEqual({ id: 1, why: 'new' });
    state.setAyah(110, 0, true);
    expect(d.sessionTarget()).toEqual({ id: 110, why: 'doing' });
    state.setPlan({ id: 'tabarak', weeks: 8, start: '2026-05-01' });
    expect(d.sessionTarget()).toEqual({ id: 67, why: 'plan' });
    state.setAyah(112, 0, true); state.setLast(112);
    expect(d.sessionTarget()).toEqual({ id: 112, why: 'last' });
  });
});

describe('dashLine', () => {
  it('says one calm thing for each state', async () => {
    const { d } = await page();
    expect(d.dashLine(0, 5, 0, 0, 0)).toContain('جلسة قصيرة');
    expect(d.dashLine(40, 5, 5, 3, 3)).toContain('أتممتَ هدف اليوم');
    expect(d.dashLine(40, 5, 1, 1, 0)).toContain('سورة تنتظر');
    expect(d.dashLine(40, 5, 1, 0, 2)).toContain('تثبيتًا');
    expect(d.dashLine(40, 5, 2, 0, 0)).toContain('باقي ' + (3).toLocaleString('ar-EG') + ' آيات');
    expect(d.dashLine(40, 5, 0, 0, 0)).toContain('جاهز');
  });
});
