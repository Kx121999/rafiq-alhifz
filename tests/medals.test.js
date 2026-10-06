import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => { vi.useRealTimers() });

async function setup(iso = '2026-05-12') {
  today(iso);
  document.body.innerHTML = '<div id="celebrate" hidden></div>';
  const { state, Q } = await boot();
  const m = await import('../src/medals.js');
  return { state, Q, m };
}
const byName = (list, name) => list.find(b => b.name === name);

describe('medals read from real data', () => {
  it('a new child has none earned, and the closest one is the first step', async () => {
    const { m } = await setup();
    const st = m.badgeStatus();
    expect(st.got).toEqual([]); expect(st.last).toBeNull();
    expect(st.next.name).toBe('البداية');
    expect(m.badgeList().every(b => !b.got && b.v === 0)).toBe(true);
  });

  it('progress counts toward the next medal, capped at its target, and the list is ordered by how close each is', async () => {
    const { state, m } = await setup();
    for (let i = 0; i < 7; i++) state.setAyah(2, i, true);
    const list = m.badgeList(), ten = byName(list, 'عشر آيات');
    expect(ten.got).toBe(false); expect(ten.v).toBe(7); expect(ten.n).toBe(10); expect(m.progressText(ten)).toContain('٧ من ١٠');
    expect(m.badgeStatus().next.name).toBe('عشر آيات');                  // 70% beats everything else that was started
    for (let i = 7; i < 40; i++) state.setAyah(2, i, true);
    expect(byName(m.badgeList(), 'عشر آيات')).toMatchObject({ got: true, v: 10 });
  });

  it('the first look records what is already earned with an unknown day; a medal earned later is dated today', async () => {
    const { state, m } = await setup();
    state.setAyah(2, 0, true);
    m.announceBadges();                                                   // first look: "البداية" was already earned
    expect(state.badgeDates()).toEqual({ 'البداية': '0' });
    expect(m.whenText(byName(m.badgeList(), 'البداية'))).toContain('قبل أن يسجّل');
    for (let i = 1; i < 10; i++) state.setAyah(2, i, true);
    m.announceBadges();
    expect(state.badgeDates()['عشر آيات']).toBe('2026-05-12');
    expect(m.whenText(byName(m.badgeList(), 'عشر آيات'))).toContain('٢٠٢٦');
    today('2026-06-01'); m.announceBadges();
    expect(state.badgeDates()['عشر آيات']).toBe('2026-05-12');          // never overwritten
  });

  it('a medal that depends on a streak stays earned after the streak breaks; one that depends on totals follows the totals', async () => {
    const { state, m } = await setup();
    state.S.streak = 7; state.S.last = '2026-05-12'; state.save();
    for (let i = 0; i < 12; i++) state.setAyah(2, i, true);
    m.announceBadges();
    expect(byName(m.badgeList(), 'أسبوع متواصل').got).toBe(true);
    today('2026-05-20');                                                    // eight days later the streak is gone
    expect(state.streakNow()).toBe(0);
    expect(byName(m.badgeList(), 'أسبوع متواصل').got).toBe(true);
    for (let i = 0; i < 12; i++) state.setAyah(2, i, false);               // un-marking ayat takes back a medal that counts ayat
    expect(byName(m.badgeList(), 'عشر آيات').got).toBe(false);
  });
});

describe('the weekly champion medal', () => {
  it('is earned only by a recorded challenge week, and shows which week', async () => {
    const { state, m } = await setup();
    expect(byName(m.badgeList(), 'بطل الأسبوع').got).toBe(false);
    state.markWeekDone('2026-05-09');
    const b = byName(m.badgeList(), 'بطل الأسبوع');
    expect(b.got).toBe(true); expect(b.date).toBe('2026-05-09');
    expect(m.whenText(b)).toContain('٢٠٢٦');
  });

  it('does not appear for a child with no recorded week, whatever else they did', async () => {
    const { state, Q, m } = await setup();
    memoriseAll(state, Q, 112); state.bump(4); state.addGameStars(30);
    expect(byName(m.badgeList(), 'بطل الأسبوع').got).toBe(false);
    expect(byName(m.badgeList(), 'ملك التحديات').got).toBe(false);
  });
});
