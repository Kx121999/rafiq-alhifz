import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

/** A stand-in for the browser's audio element that records what it was told, and lets the test say "this ayah ended". */
function fakeAudio() {
  const made = [];
  vi.stubGlobal('Audio', class {
    constructor() { this.src = ''; this.listeners = {}; this.paused = true; this.ended = false; this.log = []; made.push(this) }
    addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f) }
    removeEventListener() {}
    setAttribute(k, v) { if (k === 'src') this.src = v }
    getAttribute(k) { return k === 'src' ? this.src : null }
    removeAttribute(k) { if (k === 'src') this.src = '' }
    load() {}
    pause() { this.paused = true; this.log.push('pause'); (this.listeners.pause || []).forEach(f => f()) }
    play() { this.paused = false; this.ended = false; this.log.push('play ' + this.src); (this.listeners.play || []).forEach(f => f()); return Promise.resolve() }
    end() { this.paused = true; this.ended = true; (this.listeners.ended || []).forEach(f => f()) }
  });
  return made;
}
const tail = a => a.src.split('/').pop();

async function setup({ seed = {}, surah = 112, start = 0 } = {}) {
  document.body.innerHTML = '<section id="player"></section><ol id="ayat"></ol>';
  localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  const made = fakeAudio();
  const { Q } = await boot(seed);
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  const p = await import('../src/player.js');
  p.initPlayer(); p.loadSurah(surah, start);
  return { p, main: made[0], Q };
}
const playBtn = () => document.querySelector('.pl-play');
const label = () => document.querySelector('.pl-label').textContent;

describe('the player', () => {
  it('shows the saved place without playing anything', async () => {
    const { main } = await setup({ start: 2 });
    expect(label()).toContain((3).toLocaleString('ar-EG'));
    expect(main.log.filter(l => l.startsWith('play'))).toEqual([]);                                          // restored, never started by itself
    expect(playBtn().querySelector('use').getAttribute('href')).toBe('#i-play');
  });

  it('plays the basmala first from the start, then each ayah in order', async () => {
    const { main } = await setup();
    playBtn().click();
    expect(tail(main)).toBe('001001.mp3');                                 // the basmala recording
    main.end(); expect(tail(main)).toBe('112001.mp3');
    main.end(); expect(tail(main)).toBe('112002.mp3');
  });

  it('repeats a passage from one ayah to another until stopped', async () => {
    const { main } = await setup({ surah: 114 });
    document.getElementById('plFrom').value = '1'; document.getElementById('plTo').value = '2';
    document.getElementById('plRange').click();
    expect(tail(main)).toBe('114002.mp3');                                 // starts at the first ayah of the passage
    main.end(); expect(tail(main)).toBe('114003.mp3');
    main.end(); expect(tail(main)).toBe('114002.mp3');                     // back to the start of the passage
    document.getElementById('plRange').click();                            // switched off: carries on to the end
    main.end(); expect(tail(main)).toBe('114003.mp3');
    main.end(); expect(tail(main)).toBe('114004.mp3');
  });

  it('refuses a passage that ends before it starts', async () => {
    await setup({ surah: 114 });
    document.getElementById('plFrom').value = '3'; document.getElementById('plTo').value = '1';
    document.getElementById('plRange').click();
    expect(document.getElementById('plRange').getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.pl-status').textContent).toContain('قبل');
  });

  it('waits in silence after each ayah when a gap is set, and the play button shows "playing" meanwhile', async () => {
    const { main } = await setup({ seed: { 'hifz-gap': 4 }, surah: 114, start: 1 });
    playBtn().click();
    expect(tail(main)).toBe('114002.mp3');
    vi.useFakeTimers();
    main.end();
    expect(tail(main)).toBe('114002.mp3');                                 // not yet: it is the gap
    expect(playBtn().querySelector('use').getAttribute('href')).toBe('#i-pause');
    expect(document.querySelector('.pl-status').textContent).toContain('وقفة');
    vi.advanceTimersByTime(3900); expect(tail(main)).toBe('114002.mp3');
    vi.advanceTimersByTime(200); expect(tail(main)).toBe('114003.mp3');
  });

  it('pausing during the gap cancels it; play then starts the next ayah', async () => {
    const { main } = await setup({ seed: { 'hifz-gap': 2 }, surah: 114, start: 1 });
    playBtn().click(); vi.useFakeTimers(); main.end();
    playBtn().click();                                                      // pause in the gap
    vi.advanceTimersByTime(5000); expect(tail(main)).toBe('114002.mp3');
    playBtn().click(); expect(tail(main)).toBe('114003.mp3');
  });

  it('is silenced when the guided session takes the sound', async () => {
    const { main } = await setup({ surah: 114, start: 1 });
    playBtn().click(); expect(main.paused).toBe(false);
    const bus = await import('../src/audiobus.js'); bus.takeAudio('session');
    expect(main.paused).toBe(true);
  });

  it('reports the ayah it reaches so the page can remember the place', async () => {
    const { p, main } = await setup({ surah: 114, start: 1 });
    const seen = []; p.onPlayerPos((id, i) => seen.push([id, i]));
    playBtn().click(); main.end();
    expect(seen).toEqual([[114, 1], [114, 2]]);
  });
});
