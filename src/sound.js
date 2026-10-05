// Small cheerful sounds, made with the browser's own synthesiser (no audio files, nothing downloaded).
// Off unless a parent turns them on in the parent corner; the choice belongs to the device (not to a child).
const KEY = 'hifz-sound-v1';

export const soundOn = () => { try { return localStorage.getItem(KEY) === '1' } catch (e) { return false } };
export function setSound(on) { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY) } catch (e) {} }

let ctx = null;
function audio() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C() } catch (e) { return null } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** One soft note with a quick fade in and out, so it never clicks. */
function note(a, freq, at, len, type = 'sine', vol = 0.11) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g); g.connect(a.destination);
  o.start(at); o.stop(at + len + 0.05);
}

const SOUNDS = {
  tap: (a, t) => note(a, 520, t, 0.08, 'triangle', 0.07),
  star: (a, t) => { note(a, 660, t, 0.12); note(a, 990, t + 0.08, 0.2) },
  right: (a, t) => { note(a, 600, t, 0.1, 'triangle'); note(a, 900, t + 0.09, 0.18, 'triangle') },
  wrong: (a, t) => note(a, 220, t, 0.2, 'sine', 0.07),
  win: (a, t) => [523, 659, 784, 1047].forEach((f, i) => note(a, f, t + i * 0.12, 0.32)),
};

/** Plays one of: tap, star, right, wrong, win. Does nothing while sounds are off or the browser has no synthesiser. */
export function sfx(name) {
  if (!soundOn() || !SOUNDS[name]) return;
  const a = audio(); if (!a) return;
  SOUNDS[name](a, a.currentTime);
}
