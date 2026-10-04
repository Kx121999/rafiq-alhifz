import { describe, it, expect, afterEach, vi } from 'vitest';
import { today } from './helpers.js';
import { day, days, ayahs, nujum, norm, AR } from '../src/util.js';

afterEach(() => vi.useRealTimers());

describe('day()', () => {
  it('formats the local date as YYYY-MM-DD and offsets it', () => {
    today('2026-03-09');
    expect(day()).toBe('2026-03-09');
    expect(day(1)).toBe('2026-03-10');
    expect(day(-9)).toBe('2026-02-28');
  });
  it('crosses month and year boundaries', () => {
    today('2026-12-31');
    expect(day(1)).toBe('2027-01-01');
    today('2024-02-28');
    expect(day(1)).toBe('2024-02-29');   // leap year
  });
});

describe('Arabic number words', () => {
  it('days() uses the singular, dual, few and many forms', () => {
    expect(days(1)).toBe('يوم واحد');
    expect(days(2)).toBe('يومين');
    expect(days(5)).toBe(AR(5) + ' أيام');
    expect(days(11)).toBe(AR(11) + ' يومًا');
  });
  it('ayahs() and nujum() agree on 1, 2, 3-10 and 11+', () => {
    expect([1, 2, 3, 10, 11].map(ayahs)).toEqual(['آية واحدة', 'آيتان', AR(3) + ' آيات', AR(10) + ' آيات', AR(11) + ' آية']);
    expect([1, 2, 3, 10, 11].map(nujum)).toEqual(['نجمة واحدة', 'نجمتان', AR(3) + ' نجوم', AR(10) + ' نجوم', AR(11) + ' نجمة']);
  });
  it('AR() renders Arabic-Indic digits', () => {
    expect(AR(6236)).toMatch(/^[٠-٩٬,]+$/);
  });
});

describe('norm()', () => {
  it('strips diacritics and unifies letter variants for searching', () => {
    expect(norm('أَحَدٌ')).toBe('احد');
    expect(norm('الإخلاص')).toBe(norm('الاخلاص'));
    expect(norm('الفاتحة')).toBe(norm('الفاتحه'));
    expect(norm('موسى')).toBe(norm('موسي'));
  });
  it('removes Quranic marks and the alef wasla so mushaf text can be searched', () => {
    expect(norm('ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ')).toBe('الرحمن الرحيم');
    expect(norm('مُؤۡمِنِينَ')).toBe(norm('مومنين'));
  });
  it('leaves digits alone, so a surah number typed in Arabic digits still matches', () => {
    expect(norm('١١٢')).toBe('١١٢');
    expect(norm('112')).toBe('112');
  });
});
