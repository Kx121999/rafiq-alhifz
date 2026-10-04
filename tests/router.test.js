import { describe, it, expect, beforeEach, vi } from 'vitest';

const PAGES = ['home', 'dashboard', 'mushaf', 'review', 'plan', 'games', 'achievements', 'certificate', 'surah', 'about'];
const tick = () => new Promise(r => setTimeout(r, 0));

async function setup() {
  vi.resetModules();
  document.body.innerHTML =
    '<nav id="nav">' + ['dashboard', 'mushaf', 'achievements'].map(n => `<a data-nav="${n}"></a>`).join('') + '</nav>' +
    PAGES.map(p => `<main class="page" id="page-${p}" data-page="${p}" tabindex="-1" hidden></main>`).join('');
  location.hash = '';
  return import('../src/router.js');
}
const visible = () => [...document.querySelectorAll('.page')].filter(p => !p.hidden).map(p => p.dataset.page);
const current = () => [...document.querySelectorAll('#nav a')].filter(a => a.getAttribute('aria-current')).map(a => a.dataset.nav);

describe('router', () => {
  let r;
  beforeEach(async () => { r = await setup() });

  it('shows the home page for an empty or unknown path', async () => {
    r.startRouter(); expect(visible()).toEqual(['home']);
    location.hash = '#/nonsense'; await tick();
    expect(visible()).toEqual(['home']);
  });

  it('shows one page at a time and marks its nav link', async () => {
    r.startRouter();
    location.hash = '#/dashboard'; await tick();
    expect(visible()).toEqual(['dashboard']); expect(current()).toEqual(['dashboard']);
    location.hash = '#/mushaf'; await tick();
    expect(visible()).toEqual(['mushaf']); expect(current()).toEqual(['mushaf']);
  });

  it('keeps the mushaf link active on a surah, and achievements on a certificate', async () => {
    r.startRouter();
    location.hash = '#/surah/112'; await tick();
    expect(visible()).toEqual(['surah']); expect(current()).toEqual(['mushaf']);
    location.hash = '#/certificate/114'; await tick();
    expect(current()).toEqual(['achievements']);
  });

  it('passes the path argument to the page handler', async () => {
    const seen = vi.fn(); r.onPage('surah', seen); r.startRouter();
    location.hash = '#/surah/114'; await tick();
    expect(seen).toHaveBeenCalledWith('114', undefined);
  });

  it('passes a second path segment too (a surah and an ayah)', async () => {
    const seen = vi.fn(); r.onPage('surah', seen); r.startRouter();
    location.hash = '#/surah/112/3'; await tick();
    expect(seen).toHaveBeenCalledWith('112', '3');
  });

  it('sends the visitor to the mushaf when a handler says no', async () => {
    r.onPage('surah', () => false); r.startRouter();
    location.hash = '#/surah/999'; await tick(); await tick();
    expect(location.hash).toBe('#/mushaf');
    expect(visible()).toEqual(['mushaf']);
  });

  it('follows a redirect path returned by a handler', async () => {
    r.onPage('certificate', () => '/achievements'); r.startRouter();
    location.hash = '#/certificate/5'; await tick(); await tick();
    expect(location.hash).toBe('#/achievements');
    expect(visible()).toEqual(['achievements']);
  });

  it('tells the shown callback which page opened', async () => {
    const shown = vi.fn(); r.onShown(shown); r.startRouter();
    location.hash = '#/games'; await tick();
    expect(shown).toHaveBeenLastCalledWith('games');
  });
});
