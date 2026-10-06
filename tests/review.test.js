import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => { vi.useRealTimers() });

async function page(setup) {
  today('2026-05-12');
  document.body.innerHTML = '<section id="reviewBox"></section><section id="weakBox"></section>';
  const { state, Q } = await boot();
  if (setup) setup(state, Q);
  const r = await import('../src/review.js');
  r.clearReviewNote(); r.renderReview(); r.renderWeak();
  return { state, Q, r };
}
const text = id => document.getElementById(id).textContent;
const rating = k => document.querySelector('#reviewBox [data-rating="' + k + '"]');
const due = (state, id, d = '2026-05-11', i = 2) => { const r = state.rec(id); r.d = d; r.i = i };

describe('the review page', () => {
  it('a child who has not memorised anything is told why there is nothing, with a way to begin', async () => {
    await page();
    expect(text('reviewBox')).toContain('لا مراجعات بعد');
    expect(document.querySelector('#reviewBox a').getAttribute('href')).toBe('#/dashboard');
  });

  it('with progress but nothing due, says when the next review is', async () => {
    await page((st, Q) => { memoriseAll(st, Q, 112) });                // a new surah is first reviewed tomorrow
    expect(text('reviewBox')).toContain('لا مراجعات مستحقة');
    expect(text('reviewBox')).toContain('أقرب مراجعة');
  });

  it('shows one due surah with three honest ratings, and each rating moves the schedule differently', async () => {
    const { state } = await page((st, Q) => { memoriseAll(st, Q, 112); due(st, 112) });
    expect(text('reviewBox')).toContain('الإخلاص');
    expect([...document.querySelectorAll('#reviewBox [data-rating]')].map(b => b.textContent)).toEqual(['احتجت مساعدة', 'جيد', 'متقن']);
    rating('mastered').click();
    expect(state.rec(112).i).toBe(6);                                    // the wait tripled: 2 -> 6 days
    expect(text('reviewBox')).toContain('متقن');
    expect(text('reviewBox')).toContain('المراجعة القادمة بعد');
  });

  it('"I needed help" brings it back tomorrow, "good" doubles the wait', async () => {
    const { state } = await page((st, Q) => { memoriseAll(st, Q, 112); due(st, 112, '2026-05-11', 4) });
    rating('help').click(); expect(state.rec(112).i).toBe(1);
    due(state, 112, '2026-05-11', 4);
    const r = await import('../src/review.js'); r.renderReview();
    rating('good').click(); expect(state.rec(112).i).toBe(8);
  });

  it('moves on to the next due surah and tells the page it was rated', async () => {
    const seen = vi.fn();
    const { r } = await page((st, Q) => { memoriseAll(st, Q, 112); memoriseAll(st, Q, 114); due(st, 112); due(st, 114) });
    r.onReviewGraded(seen);
    expect(text('reviewBox')).toContain('المتبقي اليوم: ' + (2).toLocaleString('ar-EG'));
    rating('good').click();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(text('reviewBox')).toContain('الناس');                         // 112 done, 114 next (the note above names the first)
  });
});

describe('the weak ayat', () => {
  it('lists every weak ayah with a link that opens it, and explains how to add one when there are none', async () => {
    await page();
    expect(text('weakBox')).toContain('لا توجد آيات ضعيفة');
    await page((st, Q) => { memoriseAll(st, Q, 112); memoriseAll(st, Q, 114); st.setWeak(112, 1, true); st.setWeak(114, 4, true) });
    const links = [...document.querySelectorAll('#weakBox .weaklist a')];
    expect(links.map(a => a.getAttribute('href'))).toEqual(['#/surah/112/2', '#/surah/114/5']);
  });

  it('mastering an ayah removes it from the list and counts it', async () => {
    const { state } = await page((st, Q) => { memoriseAll(st, Q, 112); st.setWeak(112, 1, true) });
    [...document.querySelectorAll('#weakBox button')].find(b => b.textContent === 'أتقنتُها').click();
    expect(state.isWeak(112, 1)).toBe(false);
    expect(text('weakBox')).toContain('لا توجد آيات ضعيفة');
  });

  it('shows the ayah exactly as in the source, hidden after its first word until revealed', async () => {
    const { Q } = await page((st, Q) => { memoriseAll(st, Q, 112); st.setWeak(112, 0, true) });
    expect(document.querySelector('#weakBox .tx').textContent.trim()).toBe(Q[111].v[0]);
    expect(document.querySelector('#weakBox .weakq').classList.contains('shown')).toBe(false);
  });
});
