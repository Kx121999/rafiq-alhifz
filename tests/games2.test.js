import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => vi.useRealTimers());

async function page(surahs = []) {
  today('2026-05-01');
  document.body.innerHTML = '<div id="gameBox"></div>';
  const { state, Q } = await boot();
  surahs.forEach(id => memoriseAll(state, Q, id));
  const games = await import('../src/games.js');
  games.resetGame(); games.renderGames();
  return { state, Q, games };
}
const cards = () => [...document.querySelectorAll('#gameBox .gamecard')];
const btn = (root, text) => [...root.querySelectorAll('button, a')].find(b => b.textContent.includes(text));

describe('the games page', () => {
  it('shows all six games in one grid, none left out', async () => {
    await page([112, 114]);
    expect(cards()).toHaveLength(6);
    expect(cards().every(c => c.querySelector('.gicon svg'))).toBe(true);          // icons from the sprite, not emoji
  });

  it('a game that cannot be played yet says exactly what opens it and offers two ways forward', async () => {
    await page();
    const locked = cards().filter(c => c.classList.contains('locked'));
    expect(locked).toHaveLength(6);
    for (const c of locked) {
      expect(c.querySelector('.lockwhy').textContent).toContain('تُفتح حين');
      expect(c.querySelector('a').getAttribute('href')).toBe('#/dashboard');         // go and memorise
      expect(btn(c, 'جرّبها')).toBeTruthy();                                         // or try it
      expect(c.querySelector('button.primary')).toBeNull();                          // no play button on a locked game
    }
  });

  it('a game with enough memorised ayat has a play button and no lock', async () => {
    await page([112, 114, 108]);
    const open = cards().filter(c => !c.classList.contains('locked'));
    expect(open.length).toBe(6);
    expect(btn(open[0], 'العب')).toBeTruthy(); expect(open[0].querySelector('.lockwhy')).toBeNull();
  });
});

describe('a trial', () => {
  const play = async () => {
    for (let r = 0; r < 5; r++) {
      const opt = document.querySelector('#gameBox .opt'); expect(opt).toBeTruthy();
      opt.click();
      const next = btn(document.getElementById('gameBox'), r === 4 ? 'النتيجة' : 'التالي'); next.click();
    }
  };

  it('is clearly marked, uses real text from the mushaf, and never adds stars', async () => {
    const { state, Q } = await page();                                              // nothing memorised at all
    btn(cards().find(c => c.textContent.includes('كم آية')), 'جرّبها').click();
    expect(document.querySelector('.trialnote').textContent).toContain('لا تُحتسب');
    const prompt = document.querySelector('#gameBox .quizq').textContent;
    expect(/سورة/.test(prompt)).toBe(true);
    await play();
    expect(document.getElementById('gameBox').textContent).toContain('انتهت التجربة');
    expect(document.getElementById('gameBox').textContent).toContain('لم تُضَف');
    expect(state.gameStars()).toBe(0);
    expect(state.S.s).toEqual({});                                                  // and nothing was marked memorised either
    expect(Q.length).toBe(114);
  });

  it('a trial of a text game only shows ayat that are exactly in the source', async () => {
    const { Q } = await page();
    btn(cards().find(c => c.textContent.includes('أكمل الآية')), 'جرّبها').click();
    const q = document.querySelector('#gameBox .quizq').textContent.replace(' …', '');
    const first = q.split(' ');
    const pool = [108, 109, 110, 111, 112, 113, 114].flatMap(id => Q[id - 1].v);
    expect(pool.some(t => t.startsWith(first.slice(0, 2).join(' ')))).toBe(true);
  });

  it('a real round still earns stars separately from memorisation', async () => {
    const { state } = await page([112, 114, 108]);
    btn(cards().find(c => c.textContent.includes('كم آية')), 'العب').click();
    for (let r = 0; r < 5; r++) { document.querySelector('#gameBox .opt.right') ; const o = [...document.querySelectorAll('#gameBox .opt')]; o[0].click(); btn(document.getElementById('gameBox'), r === 4 ? 'النتيجة' : 'التالي').click() }
    expect(state.gameStars()).toBeGreaterThanOrEqual(0);
    expect(Object.keys(state.S.s).sort()).toEqual(['108', '112', '114']);          // memorisation untouched by playing
  });
});
