import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() });

describe('where the child stopped', () => {
  it('is remembered per child, only for real ayat and modes', async () => {
    today('2026-05-12');
    const { state } = await boot();
    expect(state.readPos()).toBeNull();
    expect(state.setPos(112, 2, 'memorise')).toBe(true);
    expect(state.readPos()).toEqual({ id: 112, i: 2, mode: 'memorise' });
    expect(state.setPos(112, 4, 'read')).toBe(false);          // the surah has four ayat: 0..3
    expect(state.setPos(999, 0, 'read')).toBe(false);
    expect(state.setPos(112, 1, 'sing')).toBe(false);
    expect(state.readPos()).toEqual({ id: 112, i: 2, mode: 'memorise' });
    state.addKid({ name: 'يوسف', icon: '🌙', mode: 'young' });
    state.switchKid(state.kids()[1].id);
    expect(state.readPos()).toBeNull();                         // a second child does not inherit it
    state.switchKid(state.kids()[0].id);
    expect(state.readPos().id).toBe(112);
  });
  it('does not write again when nothing changed', async () => {
    today('2026-05-12');
    const { state } = await boot();
    state.setPos(112, 1, 'read');
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    state.setPos(112, 1, 'read');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('bookmarks, pins and medal dates', () => {
  it('toggle, stay unique, and respect their limits', async () => {
    today('2026-05-12');
    const { state } = await boot();
    expect(state.toggleBookmark(112, 0)).toBe(true);
    expect(state.isBookmarked(112, 0)).toBe(true);
    expect(state.bookmarks()).toEqual(['112.1']);
    expect(state.toggleBookmark(112, 0)).toBe(false);
    expect(state.bookmarks()).toEqual([]);
    expect(state.toggleBookmark(112, 9)).toBe(false);           // no such ayah
    expect(state.toggleBookmark(2, 0)).toBe(true);
    for (let i = 1; i < 80; i++) state.toggleBookmark(2, i);
    expect(state.bookmarks().length).toBe(state.MAX_BM);
    expect(state.togglePin(112)).toBe(true); expect(state.pinned()).toEqual([112]);
    expect(state.togglePin(112)).toBe(false); expect(state.pinned()).toEqual([]);
    expect(state.togglePin(115)).toBe(false);
  });
  it('a medal date is written once and never overwritten', async () => {
    today('2026-05-12');
    const { state } = await boot();
    expect(state.setBadgeDate('البداية', '2026-05-12')).toBe(true);
    expect(state.setBadgeDate('البداية', '2026-06-01')).toBe(false);
    expect(state.badgeDates()).toEqual({ 'البداية': '2026-05-12' });
  });
});

describe('the new fields survive a backup and cannot carry bad data', () => {
  const kid = over => ({ name: 'نور', icon: '🌸', mode: 'young', S: { s: {}, goal: 5, day: '2026-05-12', n: 0, streak: 0, last: '' }, ...over });
  const parse = async k => { const b = await import('../src/backup.js'); return b.parseBackup(JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids: [k] })) };

  it('keeps valid values', async () => {
    today('2026-05-12');
    await boot();
    const r = await parse(kid({ pos: { id: 112, i: 3, mode: 'recite' }, bm: ['112.1', '2.255'], pin: [67, 112], bd: { 'البداية': '2026-05-01' } }));
    expect(r.kids[0]).toMatchObject({ pos: { id: 112, i: 3, mode: 'recite' }, bm: ['112.1', '2.255'], pin: [67, 112], bd: { 'البداية': '2026-05-01' } });
  });
  it('drops anything that does not point at a real ayah, surah, mode or date', async () => {
    today('2026-05-12');
    await boot();
    const r = await parse(kid({ pos: { id: 112, i: 4, mode: 'read' }, bm: ['112.9', 'x', '300.1', '112.1', '112.1'], pin: [0, 115, 'a', 5, 5], bd: { x: 'yesterday', 'ok': '2026-05-01' } }));
    const k = r.kids[0];
    expect(k.pos).toBeUndefined(); expect(k.bm).toEqual(['112.1']); expect(k.pin).toEqual([5]); expect(k.bd).toEqual({ ok: '2026-05-01' });
    const r2 = await parse(kid({ pos: { id: 112, i: 0, mode: 'dance' } }));
    expect(r2.kids[0].pos).toBeUndefined();
  });
  it('an old backup without them still imports, and children have none', async () => {
    today('2026-05-12');
    await boot();
    const k = (await parse(kid({}))).kids[0];
    expect(k.pos).toBeUndefined(); expect(k.bm).toBeUndefined(); expect(k.pin).toBeUndefined(); expect(k.bd).toBeUndefined();
  });
});
