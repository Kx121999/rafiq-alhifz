import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { boot, today } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

describe('reading size per child', () => {
  it('starts normal, moves in steps, stays inside its limits and remembers per child', async () => {
    today('2026-05-01');
    const { state } = await boot();
    expect(state.fontLevel()).toBe(0);
    state.setFontLevel(2); expect(state.fontLevel()).toBe(2);
    state.setFontLevel(99); expect(state.fontLevel()).toBe(state.FS_MAX);
    state.setFontLevel(-9); expect(state.fontLevel()).toBe(state.FS_MIN);
    const first = state.activeKid().id;
    state.setFontLevel(3);
    state.addKid({ name: 'يوسف', icon: '🌙', mode: 'young' });
    expect(state.fontLevel()).toBe(0);
    state.switchKid(first); expect(state.fontLevel()).toBe(3);
    state.setFontLevel(0); expect(state.activeKid().fs).toBeUndefined();   // normal size leaves no trace
  });

  it('the A- / A+ buttons set the page scale and disable at the ends', async () => {
    today('2026-05-01');
    document.body.innerHTML = '<span class="fsctl"><button data-fs="-1"></button><span class="fsval"></span><button data-fs="1"></button></span><button id="azFocus"></button>';
    const { state } = await boot();
    const r = await import('../src/reading.js');
    r.initReading();
    const [less, more] = document.querySelectorAll('.fsctl button');
    expect(document.body.style.getPropertyValue('--rs')).toBe('1');
    more.click(); more.click();
    expect(state.fontLevel()).toBe(2);
    expect(Number(document.body.style.getPropertyValue('--rs'))).toBeCloseTo(1.28);
    for (let k = 0; k < 6; k++) more.click();
    expect(more.disabled).toBe(true); expect(state.fontLevel()).toBe(state.FS_MAX);
    for (let k = 0; k < 9; k++) less.click();
    expect(less.disabled).toBe(true); expect(state.fontLevel()).toBe(state.FS_MIN);
  });

  it('focus reading toggles a class and Escape leaves it', async () => {
    document.body.innerHTML = '<button id="azFocus"></button>';
    await boot();
    const r = await import('../src/reading.js');
    r.initReading();
    document.getElementById('azFocus').click();
    expect(document.body.classList.contains('focusread')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('focusread')).toBe(false);
  });
});

describe('favourite adhkar', () => {
  it('adds, removes, keeps order and the limit, rejects bad references', async () => {
    today('2026-05-01');
    const { state } = await boot();
    expect(state.toggleFav('1.3')).toBe(true);
    expect(state.toggleFav('2.1')).toBe(true);
    expect(state.favList()).toEqual(['1.3', '2.1']);
    expect(state.isFav('1.3')).toBe(true);
    expect(state.toggleFav('1.3')).toBe(false);
    expect(state.favList()).toEqual(['2.1']);
    expect(state.toggleFav('../x')).toBe(false);
    state.toggleFav('2.1'); expect(state.activeKid().fav).toBeUndefined();
    for (let i = 1; i <= state.MAX_FAV + 5; i++) state.toggleFav('1.' + i);
    expect(state.favList()).toHaveLength(state.MAX_FAV);
  });

  const file = k => JSON.stringify({ app: 'rafiq-alhifz', version: 1, kids: [{ name: 'سلمى', icon: '🌸', mode: 'young', S: { s: {}, goal: 5, day: '2026-05-01', n: 0, streak: 0, last: '' }, ...k }] });
  it('backups keep valid favourites and sizes and drop junk', async () => {
    today('2026-05-01');
    await boot();
    const b = await import('../src/backup.js');
    const r = b.parseBackup(file({ fs: 2, fav: ['1.3', '1.3', 'x', 7, '12.4', '1.2.3'] }));
    expect(r.kids[0].fs).toBe(2); expect(r.kids[0].fav).toEqual(['1.3', '12.4']);
    const bad = b.parseBackup(file({ fs: 77, fav: 'nope' }));
    expect(bad.kids[0].fs).toBeUndefined(); expect(bad.kids[0].fav).toBeUndefined();
  });
});

describe('sounds', () => {
  it('are off by default and silent when off', async () => {
    const made = [];
    vi.stubGlobal('AudioContext', class { constructor() { made.push(this) } });
    vi.resetModules(); localStorage.clear();
    const s = await import('../src/sound.js');
    expect(s.soundOn()).toBe(false);
    s.sfx('star');
    expect(made).toHaveLength(0);                 // not even a synthesiser is created
  });

  it('play short notes once turned on, and an unknown name plays nothing', async () => {
    const notes = [];
    class Ctx {
      constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {} }
      createOscillator() { const o = { frequency: {}, connect() {}, start() { notes.push(o.frequency.value) }, stop() {} }; return o }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
    }
    vi.stubGlobal('AudioContext', Ctx);
    vi.resetModules(); localStorage.clear();
    const s = await import('../src/sound.js');
    s.setSound(true); expect(s.soundOn()).toBe(true);
    s.sfx('win'); expect(notes).toEqual([523, 659, 784, 1047]);
    s.sfx('nope'); expect(notes).toHaveLength(4);
    s.setSound(false); s.sfx('win'); expect(notes).toHaveLength(4);
  });
});

describe('reminders', () => {
  const at = (h, m) => new Date(2026, 4, 1, h, m);
  const none = { reviewDue: 0, adhkarDone: () => false };
  let R;
  beforeEach(async () => { vi.resetModules(); localStorage.clear(); R = await import('../src/remind.js') });

  it('stay silent until switched on', () => {
    expect(R.dueReminders(R.loadRemind(), at(6, 40), none)).toEqual([]);
  });

  it('become due at their time, for three hours, and not before', () => {
    const cfg = R.loadRemind(); cfg.on = true;
    expect(R.dueReminders(cfg, at(6, 29), none)).toEqual([]);
    expect(R.dueReminders(cfg, at(6, 30), none)).toEqual(['sabah']);
    expect(R.dueReminders(cfg, at(9, 30), none)).toEqual(['sabah']);
    expect(R.dueReminders(cfg, at(9, 31), none)).toEqual([]);
  });

  it('skip what the child already finished, and a review with nothing due', () => {
    const cfg = R.loadRemind(); cfg.on = true;
    expect(R.dueReminders(cfg, at(6, 40), { ...none, adhkarDone: id => id === 'sabah' })).toEqual([]);
    const done = { reviewDue: 0, adhkarDone: () => true };
    expect(R.dueReminders(cfg, at(18, 10), done)).toEqual([]);                       // review: nothing due
    expect(R.dueReminders(cfg, at(18, 10), { ...done, reviewDue: 3 })).toEqual(['review']);
  });

  it('respect a slot switched off and a custom time', () => {
    const cfg = R.loadRemind(); cfg.on = true; cfg.slots.sabah.on = false; cfg.slots.masaa.t = '15:15';
    expect(R.dueReminders(cfg, at(6, 40), none)).toEqual([]);
    expect(R.dueReminders(cfg, at(15, 20), none)).toEqual(['masaa']);
  });

  it('repair broken saved settings', () => {
    localStorage.setItem('hifz-remind-v1', JSON.stringify({ on: true, slots: { sabah: { on: false, t: '25:99' }, evil: { on: true, t: '07:00' } }, fired: { bad: ['sabah'], '2026-05-01': ['sabah', 'x'] } }));
    const cfg = R.loadRemind();
    expect(cfg.on).toBe(true); expect(cfg.slots.sabah).toEqual({ on: false, t: '06:30' }); expect(cfg.slots.evil).toBeUndefined();
    expect(cfg.fired).toEqual({ '2026-05-01': ['sabah'] });
    localStorage.setItem('hifz-remind-v1', '{not json');
    expect(R.loadRemind().on).toBe(false);
  });

  it('a tick notifies once per reminder per day and never quotes any text', async () => {
    const shown = [];
    vi.stubGlobal('Notification', Object.assign(function (t, o) { shown.push([t, o.body, o.data.url]) }, { permission: 'granted', requestPermission: async () => 'granted' }));
    const cfg = R.loadRemind(); cfg.on = true; R.saveRemind(cfg);
    R.setReminderContext(() => ({ reviewDue: 2, adhkarDone: () => false }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at(18, 5));
    expect(R.tick(at(18, 5))).toEqual(['masaa', 'review']);
    await vi.waitFor(() => expect(shown).toHaveLength(2));
    expect(shown.map(s => s[2])).toEqual(['#/adhkar/masaa', '#/review']);
    shown.forEach(s => expect(s[0]).toBe('رفيق الحفظ'));
    expect(R.tick(at(18, 6))).toEqual([]);                    // already shown today
    expect(shown).toHaveLength(2);
  });
});
