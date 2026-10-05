import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, today } from './helpers.js';
import { TIPS, tipFor } from '../src/companion.js';

afterEach(() => { vi.useRealTimers() });

describe('what the friend says', () => {
  it('has something for every page, and only about using the site', () => {
    const pages = ['home', 'dashboard', 'mushaf', 'search', 'review', 'plan', 'games', 'achievements', 'adhkar', 'shop', 'challenge', 'share', 'check'];
    for (const p of pages) { expect(TIPS[p].length, p).toBeGreaterThan(0); TIPS[p].forEach(t => expect(/[؀-ۿ]/.test(t) && t.length < 80).toBe(true)) }
    expect(tipFor('nowhere', 0)).toBe(TIPS.home[0]);                    // an unknown page still gets a friendly line
    expect(tipFor('games', 1)).toBe(TIPS.games[1]); expect(tipFor('games', 2)).toBe(TIPS.games[0]);   // taps rotate through the tips
  });
});

describe('the companion in the page', () => {
  let c, state;
  beforeEach(async () => {
    today('2026-05-12');
    sessionStorage.clear();
    document.body.innerHTML = '<div class="wrap"><nav class="kidbar"></nav></div>';
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    ({ state } = await boot());
    c = await import('../src/companion.js');
    c.initCompanion();
  });
  const bubble = () => document.getElementById('cBubble');
  const box = () => document.getElementById('companion');

  it('appears on a page, greets once, then goes quiet after a few seconds', async () => {
    vi.useFakeTimers();
    c.companionPage('games');
    expect(box().hidden).toBe(false);
    expect(bubble().textContent).toContain(TIPS.games[0]);
    expect(bubble().getAttribute('aria-hidden')).toBe('true');           // not read out on its own
    vi.advanceTimersByTime(7100);
    expect(bubble().hidden).toBe(true);
  });

  it('sits in the row of the kids names, speaks once per page per visit, and a tap on the bubble closes it', () => {
    expect(box().parentElement.className).toBe('kidbar');
    c.companionPage('review'); expect(bubble().hidden).toBe(false);
    bubble().click(); expect(bubble().hidden).toBe(true);
    c.companionPage('games'); c.companionPage('review');                   // coming back to a page already visited: quiet
    expect(bubble().hidden).toBe(true); expect(box().hidden).toBe(false);   // but the friend is still there to tap
  });

  it('tells another tip when tapped, and that one is announced', () => {
    c.companionPage('games');
    const first = bubble().textContent;
    document.getElementById('cBtn').click();
    expect(bubble().textContent).not.toBe(first); expect(bubble().getAttribute('role')).toBe('status');
    expect(bubble().textContent.startsWith('رفيق: ')).toBe(true);        // the name of the child's friend
  });

  it('stays out of the printed pages only', () => {
    for (const p of ['certificate', 'report', 'family']) { c.companionPage(p); expect(box().hidden, p).toBe(true) }
    for (const p of ['review', 'surah']) { c.companionPage(p); expect(box().hidden, p).toBe(false) }
  });

  it('can be turned off and on by a parent, and remembers it', () => {
    c.companionPage('home'); expect(c.companionOn()).toBe(true);
    c.setCompanion(false); expect(c.companionOn()).toBe(false); expect(box().hidden).toBe(true);
    c.companionPage('review'); expect(box().hidden).toBe(true);
    c.setCompanion(true); expect(box().hidden).toBe(false);
  });

  it('shows the friend the child chose, by name and picture', () => {
    state.addGameStars(60); state.buyItem('qamar'); state.useItem('qamar');
    c.companionPage('home'); c.refreshCompanion();
    expect(document.querySelector('#cBtn img').getAttribute('src')).toContain('qamar.svg');
    expect(document.getElementById('cBtn').getAttribute('aria-label')).toContain('قمر');
    document.getElementById('cBtn').click(); expect(bubble().textContent.startsWith('قمر: ')).toBe(true);
  });
});
