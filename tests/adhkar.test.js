import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { boot, today } from './helpers.js';
import { azNow, tabOf, AZ_TABS, COUNT_FIX } from '../src/azmeta.js';

afterEach(() => vi.useRealTimers());

const SOURCE = JSON.parse(readFileSync('public/adhkar.json', 'utf8'));

describe('which list fits the hour', () => {
  const at = h => azNow(new Date(2026, 4, 1, h, 0));
  it('morning until noon, evening until nine, then bedtime', () => {
    expect([4, 8, 11].map(at)).toEqual(['sabah', 'sabah', 'sabah']);
    expect([12, 16, 20].map(at)).toEqual(['masaa', 'masaa', 'masaa']);
    expect([21, 23, 0, 3].map(at)).toEqual(['nawm', 'nawm', 'nawm', 'nawm']);
  });
  it('every tab points at a real category of the source file', () => {
    for (const t of AZ_TABS) expect(SOURCE.find(c => c.id === t.cat)).toBeTruthy();
    expect(tabOf('sabah').cat).toBe(tabOf('masaa').cat);
  });
  it('count corrections only touch entries that exist and only raise a count of 1 to what the text itself says', () => {
    for (const [ref, n] of Object.entries(COUNT_FIX)) {
      const [c, e] = ref.split('.').map(Number);
      const entry = SOURCE.find(x => x.id === c).array.find(x => x.id === e);
      expect(entry.count).toBe(1);
      expect(n).toBeGreaterThan(1);
    }
  });
});

describe('adhkar progress per child and day', () => {
  it('saves counts, remembers a finished list and forgets an untouched one', async () => {
    today('2026-05-01');
    const { state } = await boot();
    expect(state.azToday('sabah')).toEqual({ c: [], d: 0 });
    state.azSave('sabah', [1, 3, 0], false);
    expect(state.azToday('sabah')).toEqual({ c: [1, 3, 0], d: 0 });
    state.azSave('sabah', [1, 3, 2], true);
    expect(state.azToday('sabah').d).toBe(1);
    state.azSave('sabah', [0, 0, 0], false);
    expect(state.activeKid().az).toBeUndefined();   // nothing left: the field disappears
  });
  it('is separate for each child and for each day', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.azSave('nawm', [1], true);
    const first = state.activeKid().id;
    state.addKid({ name: 'يوسف', icon: '🌙', mode: 'young' });
    expect(state.azToday('nawm').d).toBe(0);
    state.switchKid(first);
    expect(state.azToday('nawm').d).toBe(1);
    today('2026-05-02');
    expect(state.azToday('nawm').d).toBe(0);
  });
  it('ignores unknown list keys and clamps silly counts', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.azSave('../etc', [1], true);
    expect(state.activeKid().az).toBeUndefined();
    state.azSave('c12', [999999, -4, 2.7], false);
    expect(state.azToday('c12').c).toEqual([1000, 0, 2]);
  });
  it('keeps only the last 60 days', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.azSave('sabah', [1], true);
    today('2026-08-01');
    state.azSave('masaa', [1], true);
    expect(Object.keys(state.activeKid().az)).toEqual(['2026-08-01']);
  });
  it('counts finished days and which daily lists were ever finished, for the medals', async () => {
    today('2026-05-01');
    const { state } = await boot();
    state.azSave('sabah', [1], true); state.azSave('nawm', [1], false);
    today('2026-05-02');
    state.azSave('sabah', [1], true); state.azSave('c5', [1], true);
    expect(state.azStats()).toEqual({ days: 2, sabah: true, masaa: false, nawm: false });
  });
});

describe('backups carry adhkar progress safely', () => {
  const kid = az => ({ name: 'سلمى', icon: '🌸', mode: 'young', az, S: { s: {}, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' } });
  const file = k => JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids: [k] });
  it('round-trips', async () => {
    today('2026-05-01');
    const { state } = await boot();
    const backup = await import('../src/backup.js');
    state.azSave('sabah', [1, 2], false);
    const r = backup.parseBackup(JSON.stringify(backup.buildBackup()));
    expect(r.kids[0].az).toEqual({ '2026-05-01': { sabah: { c: [1, 2], d: 0 } } });
  });
  it('drops malformed entries instead of trusting them', async () => {
    today('2026-05-01');
    await boot();
    const backup = await import('../src/backup.js');
    const r = backup.parseBackup(file(kid({
      '2026-05-01': { sabah: { c: [1, 2], d: 1 }, evil: { c: [1], d: 1 }, masaa: { c: 'x', d: 1 }, nawm: { c: [0, 0], d: 1 }, c9: { c: [5000, 1], d: 7 } },
      'not-a-date': { sabah: { c: [1], d: 1 } },
    })));
    expect(r.kids[0].az).toEqual({ '2026-05-01': { sabah: { c: [1, 2], d: 1 }, c9: { c: [0, 1], d: 0 } } });
  });
  it('leaves the field out when nothing valid remains', async () => {
    today('2026-05-01');
    await boot();
    const backup = await import('../src/backup.js');
    expect(backup.parseBackup(file(kid({ x: 1 }))).kids[0].az).toBeUndefined();
  });
});

describe('the adhkar page', () => {
  const SMALL = [
    { id: 1, category: 'قسم تجريبي', array: [{ id: 1, text: 'نص أول', count: 1 }, { id: 2, text: 'نص ثانٍ', count: 3 }, { id: 3, text: '<b>x</b>', count: 10 }] },
    { id: 2, category: 'قسم آخر', array: [{ id: 1, text: 'نص', count: 1 }] },
    { id: 3, category: 'ثالث', array: [{ id: 1, text: 'نص', count: 1 }] },
  ];
  beforeEach(() => {
    document.body.innerHTML = '<main id="page-adhkar"><nav id="azTabs"></nav><div id="azBox"></div><p id="azLive"></p></main><div id="celebrate" hidden></div>';
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => SMALL }));
  });
  async function open(arg) {
    today('2026-05-01');
    const { state } = await boot();
    const mod = await import('../src/adhkar.js');
    await mod.renderAdhkar(arg);
    return { state, mod };
  }
  const buttons = () => [...document.querySelectorAll('.azbtn')];
  const flush = () => new Promise(r => setTimeout(r, 0));

  it('shows each dhikr as plain text with its own counter', async () => {
    await open('c1');
    expect(document.querySelectorAll('.azcard')).toHaveLength(3);
    expect(document.querySelector('#azBox b')).toBeNull();                       // text is never turned into HTML
    expect(document.querySelectorAll('.azt')[2].textContent).toBe('<b>x</b>');
    expect(buttons().map(b => b.textContent)).toEqual(['قرأتُها', '٠ / ٣', '٠ / ١٠']);
  });

  it('counts taps up to the target, saves them, and finishes the list', async () => {
    const { state } = await open('c1');
    const b = buttons();
    b[0].click();
    for (let k = 0; k < 5; k++) b[1].click();                                    // more taps than needed stop at 3
    expect(b[1].textContent).toBe('٣ / ٣');
    expect(state.azToday('c1')).toMatchObject({ c: [1, 3, 0], d: 0 });
    const done = [...document.querySelectorAll('.azmini')].find(x => x.textContent === 'أتممتُها'); done.click();   // «أتممتُها» exists only for the 10x dhikr
    expect(state.azToday('c1')).toMatchObject({ c: [1, 3, 10], d: 1 });
    expect(document.querySelector('.azprog').textContent).toContain('كلها');
    expect(document.getElementById('celebrate').hidden).toBe(false);              // celebrated once
  });

  it('can be undone and started over', async () => {
    const { state } = await open('c1');
    buttons()[0].click(); buttons()[0].click();                                   // a single dhikr toggles
    expect(buttons()[0].textContent).toBe('قرأتُها');
    buttons()[1].click();
    [...document.querySelectorAll('.azmini')].find(x => x.textContent === 'إعادة').click();
    expect(state.azToday('c1').c).toEqual([]);                                    // everything back to zero: nothing stored
  });

  it('restores saved progress when the page is opened again', async () => {
    const { state, mod } = await open('c1');
    buttons()[1].click(); buttons()[1].click();
    await mod.renderAdhkar('c1');
    expect(buttons()[1].textContent).toBe('٢ / ٣');
    expect(state.azToday('c1').c[1]).toBe(2);
  });

  it('lists every category on the "all" tab and filters by name, ignoring diacritics', async () => {
    await open('all');
    expect(document.querySelectorAll('.azcat')).toHaveLength(3);
    const q = document.getElementById('azq'); q.value = 'اخَر'; q.dispatchEvent(new Event('input'));
    expect([...document.querySelectorAll('.azcat b')].map(x => x.textContent)).toEqual(['قسم آخر']);
    q.value = 'لا يوجد'; q.dispatchEvent(new Event('input'));
    expect(document.querySelector('.azcats .empty')).toBeTruthy();
  });

  it('falls back to the list of categories for an unknown address and says so when the file cannot be loaded', async () => {
    await open('c999');
    expect(document.querySelectorAll('.azcat')).toHaveLength(3);
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') });
    document.body.innerHTML = '<main id="page-adhkar"><nav id="azTabs"></nav><div id="azBox"></div><p id="azLive"></p></main>';
    await open('sabah');
    await flush();
    expect(document.getElementById('azBox').textContent).toContain('تعذّر');
  });

  it('stars a dhikr, lists it on the favourites tab with its own counter, and removes it again', async () => {
    const { state, mod } = await open('c1');
    const favs = () => [...document.querySelectorAll('.azfav')];
    favs()[1].click();
    expect(state.favList()).toEqual(['1.2']);
    expect(favs()[1].getAttribute('aria-pressed')).toBe('true');
    await mod.renderAdhkar('fav');
    expect(document.querySelectorAll('.azcard')).toHaveLength(1);
    expect(document.querySelector('.azt').textContent).toBe('نص ثانٍ');
    buttons()[0].click();
    expect(state.azToday('fav').c).toEqual([]);                                   // the favourites list is never saved as progress
    document.querySelector('.azfav').click();                                     // un-star: the card leaves the list
    await flush();
    expect(state.favList()).toEqual([]);
    expect(document.querySelector('.azempty')).toBeTruthy();
  });

  it('shows a friendly empty favourites tab', async () => {
    await open('fav');
    expect(document.querySelector('.azempty a').getAttribute('href')).toBe('#/adhkar/all');
    expect(document.querySelector('.aztab[aria-current="page"]').textContent).toContain('المفضلة');
  });

  it('marks the tab of a list finished today', async () => {
    SMALL[0].id = 1;
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => SOURCE }));
    const { state, mod } = await open('nawm');
    const n = SOURCE.find(c => c.id === 2).array.map(a => a.count);
    state.azSave('nawm', n, true);
    await mod.renderAdhkar('nawm');
    const tab = [...document.querySelectorAll('.aztab')].find(a => a.getAttribute('href') === '#/adhkar/nawm');
    expect(tab.textContent).toContain('✓');
    expect(tab.getAttribute('aria-current')).toBe('page');
  });
});
