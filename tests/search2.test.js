import { describe, it, expect, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { boot, today, QURAN } from './helpers.js';

afterEach(() => vi.useRealTimers());

const DOM = '<main id="page-search"><input id="sq"><p id="sInfo" role="status"></p><div id="sHints"></div><ol id="sList"></ol><button id="sMore" hidden></button></main>';
async function page({ loaded = true } = {}) {
  today('2026-05-01');
  document.body.innerHTML = DOM;
  const { state, Q } = loaded ? await boot() : await (async () => { vi.resetModules(); localStorage.clear(); const s = await import('../src/state.js'); return { state: s, Q: (await import('../src/data.js')).Q } })();
  const s = await import('../src/search.js');
  s.initSearch();
  return { state, Q, s };
}
const type = (v, key) => { const i = document.getElementById('sq'); i.value = v; if (key) i.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); };
const info = () => document.getElementById('sInfo').textContent;

describe('the search page states', () => {
  it('says it is loading while the mushaf text is not there yet, and says so when it cannot load', async () => {
    const { s } = await page({ loaded: false });
    s.openSearch('');
    expect(info()).toContain('جارٍ تحميل');
    s.searchUnavailable();
    expect(info()).toContain('تعذّر تحميل المصحف');
  });

  it('invites a search when empty, asks for two letters, and explains a miss', async () => {
    const { s } = await page();
    s.openSearch(''); expect(info()).toContain('اكتب كلمة');
    s.openSearch('ا'); expect(info()).toContain('حرفين');
    s.openSearch('zzzzqqq'); expect(info()).toContain('لا توجد آية');
    expect(document.querySelectorAll('#sList .hit')).toHaveLength(0);
  });

  it('shows each result with its surah and ayah, a link that opens it there, and its neighbours', async () => {
    const { Q, s } = await page();
    s.openSearch(encodeURIComponent('قل هو الله احد'));
    const hit = [...document.querySelectorAll('#sList .hit')].find(h => h.querySelector('.hitref').getAttribute('href') === '#/surah/112/1');
    expect(hit).toBeTruthy();
    expect(hit.querySelector('.hitref').textContent).toContain('الإخلاص');
    expect(hit.querySelector('mark')).toBeTruthy();
    const ctx = [...hit.querySelectorAll('.hitctx')].map(p => p.textContent);
    expect(ctx).toHaveLength(1);                                                       // the first ayah has nothing before it
    expect(ctx[0]).toContain(Q[111].v[1]);                                              // the next ayah, whole and unchanged
  });

  it('keyboard: Enter or the down arrow searches and moves to the first result; Escape clears', async () => {
    await page();
    const input = document.getElementById('sq');
    type('الصبر', 'Enter');
    const first = document.querySelector('#sList .hitref');
    expect(first).toBeTruthy(); expect(document.activeElement).toBe(first);
    type('الصبر', 'Escape');
    expect(input.value).toBe(''); expect(info()).toContain('اكتب كلمة');
  });

  it('pages through many results', async () => {
    const { s } = await page();
    s.openSearch(encodeURIComponent('الله'));
    expect(document.querySelectorAll('#sList .hit')).toHaveLength(30);
    expect(document.getElementById('sMore').hidden).toBe(false);
    document.getElementById('sMore').click();
    expect(document.querySelectorAll('#sList .hit')).toHaveLength(60);
  });
});

describe('the search index never touches the source text', () => {
  const fingerprint = list => createHash('sha256').update(JSON.stringify(list.map(c => c.v))).digest('hex');
  it('searching, highlighting and re-indexing leave every ayah exactly as loaded', async () => {
    const { Q, s } = await page();
    const before = fingerprint(Q), original = fingerprint(QURAN);
    expect(before).toBe(original);
    for (const q of ['الرحمن', 'مؤمنين', 'قل هو الله احد', 'ٱلرَّحۡمَٰنِ']) { const r = s.search(q); r.hits.slice(0, 5).forEach(h => s.highlight(Q[h.id - 1].v[h.i], r.words)) }
    s.resetIndex(); s.search('الرحمن');
    expect(fingerprint(Q)).toBe(before);
  });
});
