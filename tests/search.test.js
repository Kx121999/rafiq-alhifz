import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll, QURAN } from './helpers.js';
import { norm } from '../src/util.js';

afterEach(() => vi.useRealTimers());

async function setup() {
  today('2026-05-01');
  const { state, Q } = await boot();
  const s = await import('../src/search.js');
  return { state, Q, s };
}
const at = (r, id, i) => r.hits.some(h => h.id === id && h.i === i - 1);

describe('normalising the whole mushaf', () => {
  it('leaves nothing but letters and spaces in any ayah', () => {
    const left = new Set();
    QURAN.forEach(s => s.v.forEach(a => [...norm(a)].forEach(c => { const x = c.codePointAt(0); if (!(x >= 0x621 && x <= 0x64a) && !/\s/.test(c)) left.add(x.toString(16)) })));
    expect([...left]).toEqual([]);
  });
});

describe('search()', () => {
  it('finds a phrase typed without tashkeel and with other letter spellings', async () => {
    const { s } = await setup();
    expect(at(s.search('الرحمن الرحيم'), 1, 3)).toBe(true);
    expect(at(s.search('الرحمن الرحيم'), 1, 1)).toBe(true);      // the basmala line of Al-Fatiha
    expect(at(s.search('قل هو الله احد'), 112, 1)).toBe(true);
    expect(at(s.search('قُلْ هُوَ ٱللَّهُ أَحَدٌ'), 112, 1)).toBe(true);   // fully voweled input works too
    expect(at(s.search('مومنين'), 2, 8)).toBe(true);               // 2:8 reads (بِمُؤۡمِنِينَ): typing it without the hamza still finds it
    expect(at(s.search('مؤمنين'), 2, 8)).toBe(true);
  });

  it('puts ayat with the whole phrase before ayat that merely contain every word', async () => {
    const { s } = await setup();
    const r = s.search('الرحيم الرحمن');                           // reversed order: no ayah has the phrase as typed
    expect(r.total).toBeGreaterThan(0);
    const exact = s.search('الرحمن الرحيم');
    expect(exact.total).toBeGreaterThan(0);
    // for the phrase query, every one of the leading hits contains the phrase
    const { Q } = await import('../src/data.js');
    const phraseHits = exact.hits.filter(h => norm(Q[h.id - 1].v[h.i]).includes('الرحمن الرحيم')).length;
    expect(exact.hits.slice(0, phraseHits).every(h => norm(Q[h.id - 1].v[h.i]).includes('الرحمن الرحيم'))).toBe(true);
  });

  it('matches part of a word, ignores the order of unrelated words, and reports a total', async () => {
    const { s } = await setup();
    const r = s.search('رحم');
    expect(r.total).toBe(r.hits.length);
    expect(r.total).toBeGreaterThan(50);
    expect(s.search('جنة').total).toBeGreaterThan(0);
  });

  it('ignores queries shorter than two letters and queries that match nothing', async () => {
    const { s } = await setup();
    expect(s.search('').total).toBe(0);
    expect(s.search('ا').total).toBe(0);
    expect(s.search('   ').total).toBe(0);
    expect(s.search('zzzzqqq').total).toBe(0);
  });

  it('every hit really contains the searched words', async () => {
    const { s } = await setup();
    const { Q } = await import('../src/data.js');
    for (const q of ['الصبر', 'يا ايها الذين امنوا', 'نور']) {
      const { hits, words } = s.search(q);
      expect(hits.length).toBeGreaterThan(0);
      hits.forEach(h => { const t = norm(Q[h.id - 1].v[h.i]); words.forEach(w => expect(t.includes(w), q + ' @' + h.id + ':' + (h.i + 1)).toBe(true)) });
    }
  });

  it('lists every ayah at most once', async () => {
    const { s } = await setup();
    const { hits } = s.search('الله');
    expect(new Set(hits.map(h => h.id + ':' + h.i)).size).toBe(hits.length);
  });
});

describe('highlight()', () => {
  it('flags the words that contain a searched word, keeping the original spelling', async () => {
    const { s } = await setup();
    const parts = s.highlight('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', ['رحمن']);
    expect(parts.map(p => p.w).join(' ')).toBe('بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ');
    expect(parts.map(p => p.hit)).toEqual([false, false, true, false]);
  });
  it('does not flag a stray stop sign', async () => {
    const { s } = await setup();
    expect(s.highlight('ۖ قل', ['قل']).filter(p => p.hit).map(p => p.w)).toEqual(['قل']);
  });
});

describe('parseQuery()', () => {
  it('collapses spaces and normalises', async () => {
    const { s } = await setup();
    expect(s.parseQuery('  الرَّحمٰن    الرحيم ')).toEqual({ n: 'الرحمن الرحيم', words: ['الرحمن', 'الرحيم'] });
    expect(s.parseQuery(null)).toEqual({ n: '', words: [] });
  });
});
