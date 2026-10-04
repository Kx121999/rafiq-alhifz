import { describe, it, expect } from 'vitest';
import { moodText } from '../src/home.js';

describe('what Rafiq says (moodText)', () => {
  it('cheers when the daily goal is reached, whatever else is pending', () => {
    expect(moodText(40, 5, 5, 3, 2)).toContain('خلّصتَ وردك');
    expect(moodText(40, 5, 9, 0, 0)).toContain('خلّصتَ وردك');
  });
  it('reminds about reviews first, then weak ayat', () => {
    expect(moodText(40, 5, 1, 2, 4)).toContain('تنتظر المراجعة');
    expect(moodText(40, 5, 1, 0, 4)).toContain('نثبّت الآيات');
  });
  it('says how much of the goal is left once the day has started', () => {
    expect(moodText(40, 5, 2, 0, 0)).toContain((3).toLocaleString('ar-EG'));
  });
  it('invites a brand-new child to start, and a returning one to begin the day', () => {
    expect(moodText(0, 5, 0, 0, 0)).toContain('أول آية');
    expect(moodText(12, 5, 0, 0, 0)).toContain('جاهز');
  });
  it('uses singular for one surah to review', () => {
    expect(moodText(10, 5, 0, 1, 0)).toContain('سورة تنتظر');
  });
});
