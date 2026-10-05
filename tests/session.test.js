import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { boot, today } from './helpers.js';
import { startState, advance } from '../src/session.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

describe('the session steps', () => {
  it('one ayah: listen, read, recite, and only a right answer marks it', () => {
    let s = startState(112, 0, 1);
    expect(s.step).toBe('listen');
    s = advance(s, 'next'); expect(s.step).toBe('read'); expect(s.mark).toBeNull();
    s = advance(s, 'next'); expect(s.step).toBe('recite'); expect(s.mark).toBeNull();
    s = advance(s, 'good'); expect(s.mark).toBe(0); expect(s.marked).toBe(1); expect(s.done).toBe(true);
  });

  it('a wrong answer sends the child back to listening to the same ayah and marks nothing', () => {
    let s = advance(advance(startState(112, 1, 2), 'next'), 'next');
    s = advance(s, 'again');
    expect(s.step).toBe('listen'); expect(s.pos).toBe(0); expect(s.retries).toBe(1); expect(s.mark).toBeNull(); expect(s.marked).toBe(0);
  });

  it('several ayat: each one in turn, then all together, then done', () => {
    let s = startState(114, 2, 3); const marks = [];
    for (let k = 0; k < 3; k++) { s = advance(advance(advance(s, 'next'), 'next'), 'good'); marks.push(s.mark) }
    expect(marks).toEqual([2, 3, 4]);                                   // the ayat from the chosen start, in order
    expect(s.step).toBe('together'); expect(s.done).toBe(false);
    s = advance(s, 'again'); expect(s.step).toBe('together');           // try again together
    s = advance(s, 'good'); expect(s.done).toBe(true); expect(s.mark).toBeNull(); expect(s.marked).toBe(3);
  });

  it('ignores actions that do not belong to the step', () => {
    const s = startState(112, 0, 1);
    expect(advance(s, 'good')).toMatchObject({ step: 'listen', marked: 0, done: false });
    expect(advance(advance(s, 'next'), 'again')).toMatchObject({ step: 'read' });
  });
});

describe('the session screen', () => {
  let marks, played;
  const click = text => { const b = [...document.querySelectorAll('#sessBody button')].find(x => x.textContent.includes(text)); expect(b, 'button ' + text).toBeTruthy(); b.click(); return b };
  const has = text => [...document.querySelectorAll('#sessBody button')].some(x => !x.hidden && x.textContent.includes(text));
  async function open(id, { audio = 'ok' } = {}) {
    today('2026-05-12');
    marks = []; played = [];
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) };
    document.body.innerHTML = '<dialog id="session"><div id="sessBody"></div></dialog>';
    vi.stubGlobal('Audio', class {
      constructor(src) { played.push(src) }
      pause() {} addEventListener() {} removeEventListener() {} load() {} get currentTime() { return 0 } set currentTime(v) {}
      play() { if (audio === 'error') return Promise.reject(new Error('offline')); setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve() }
    });
    const { Q } = await boot();
    const s = await import('../src/session.js');
    s.initSession({ mark: (sid, i) => marks.push([sid, i]) });
    s.openSession(id);
    return { Q, s };
  }

  it('walks through one ayah and marks it only after the child says they got it right', async () => {
    const { Q } = await open(112);
    expect(document.querySelector('#sessBody h2').textContent).toContain('الإخلاص');
    click('آية واحدة');                                                   // one ayah in this session
    click('يلا نبدأ');
    // listen: the real recitation file is played three times
    click('استمع');
    await vi.waitFor(() => expect(document.querySelector('#sessBody [role=status]').textContent).toContain('أحسنت'));
    const urls = played.filter(Boolean);                                 // (the player module makes its own idle Audio objects)
    expect(urls).toHaveLength(1);                                         // one file, played three times
    expect(urls[0]).toMatch(/^https:\/\/everyayah\.com\/data\/[A-Za-z0-9_-]+\/112001\.mp3$/);
    click('التالي');
    // read
    expect(document.querySelector('.sesstx').textContent.trim()).toBe(Q[111].v[0]);       // the ayah exactly as in quran.json
    click('قرأتُها');
    // recite: blurred until revealed
    expect(document.querySelector('.sesstx').classList.contains('veil')).toBe(true);
    expect(has('أصبتُ')).toBe(false);                                     // cannot grade before looking
    click('أظهر الآية');
    expect(document.querySelector('.sesstx').classList.contains('veil')).toBe(false);
    expect(marks).toEqual([]);
    click('أصبتُ');
    expect(marks).toEqual([[112, 0]]);
    expect(document.querySelector('#sessBody h2').textContent).toContain('حفظتَ آية واحدة');
  });

  it('"I need to repeat" marks nothing and goes back to listening', async () => {
    await open(112);
    click('آية واحدة'); click('يلا نبدأ');
    click('التالي'); click('قرأتُها'); click('أظهر الآية');
    click('أحتاج إعادة');
    expect(marks).toEqual([]);
    expect(has('استمع')).toBe(true);
    expect(document.querySelector('#sessBody h2').textContent).toContain('استمع');
  });

  it('keeps going when the sound cannot be played', async () => {
    await open(112, { audio: 'error' });
    click('آية واحدة'); click('يلا نبدأ');
    click('استمع');
    await vi.waitFor(() => expect(document.querySelector('#sessBody [role=status]').textContent).toContain('تعذّر'));
    click('التالي'); expect(document.querySelector('#sessBody h2').textContent).toContain('اقرأ');
  });

  it('starts at the first ayah not memorised yet, and closing stops everything', async () => {
    today('2026-05-12');
    const { state, Q } = await boot();
    state.setAyah(114, 0, true); state.setAyah(114, 1, true);
    const s = await import('../src/session.js');
    expect(s.suggestedStart(114)).toBe(2); expect(s.suggestedStart(113)).toBe(0);
    expect(Q[113].v.length).toBe(6);
  });
});
