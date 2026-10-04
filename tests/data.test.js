import { describe, it, expect, afterEach, vi } from 'vitest';
import { QURAN, TAFSIR, boot, today, memoriseAll } from './helpers.js';

afterEach(() => vi.useRealTimers());

describe('Quran and tafsir data', () => {
  it('has 114 surahs and 6236 ayat', () => {
    expect(QURAN).toHaveLength(114);
    expect(QURAN.reduce((n, s) => n + s.v.length, 0)).toBe(6236);
  });
  it('has one non-empty tafsir entry per ayah', () => {
    expect(TAFSIR).toHaveLength(114);
    QURAN.forEach((s, i) => {
      expect(TAFSIR[i], 'surah ' + (i + 1)).toHaveLength(s.v.length);
      s.v.forEach(a => expect(a.trim()).not.toBe(''));
    });
  });
  it('marks every surah as Makki (0) or Madani (1)', () => {
    expect(QURAN.every(s => s.t === 0 || s.t === 1)).toBe(true);
  });
});

describe('achievements and certificates', () => {
  async function setup() {
    today('2026-05-01');
    document.body.innerHTML = '<article id="cert"></article><div id="achRewards"></div><div id="achSurahs"></div>';
    const { state, Q } = await boot();
    const ach = await import('../src/achievements.js');
    return { state, Q, ach };
  }

  it('lists only fully memorised surahs', async () => {
    const { state, Q, ach } = await setup();
    memoriseAll(state, Q, 114); state.setAyah(112, 0, true);
    expect(ach.completed()).toEqual([114]);
  });

  it('refuses a certificate for an incomplete or unknown surah', async () => {
    const { state, ach } = await setup();
    state.setAyah(112, 0, true);
    expect(ach.renderCertificate(112)).toBe(false);
    expect(ach.renderCertificate(0)).toBe(false);
    expect(ach.renderCertificate(999)).toBe(false);
  });

  it('writes the child\'s name and the surah on a completed one, as plain text', async () => {
    const { state, Q, ach } = await setup();
    state.updateKid(state.activeKid().id, { name: '<b>سلمى</b>', icon: '🌸', mode: 'young' });
    memoriseAll(state, Q, 114);
    expect(ach.renderCertificate(114)).toBe(true);
    const cert = document.getElementById('cert');
    expect(cert.textContent).toContain('سورة الناس');
    expect(cert.textContent).toContain('<b>سلمى</b>');     // shown literally, not parsed as HTML
    expect(cert.querySelector('b')).toBeNull();
  });
});
