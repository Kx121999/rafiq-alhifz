import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let pin;
beforeEach(async () => { vi.resetModules(); localStorage.clear(); sessionStorage.clear(); pin = await import('../src/pin.js') });
afterEach(() => { vi.useRealTimers() });

describe('the local PIN', () => {
  it('has none at first, and then everything is allowed', async () => {
    expect(pin.hasPin()).toBe(false);
    expect(await pin.checkPin('anything')).toBe(true);
  });
  it('accepts only 4 to 6 digits', async () => {
    for (const bad of ['', '123', '1234567', 'abcd', '12 34', '١٢٣٤']) expect(await pin.setPin(bad), bad).toBe(false);
    expect(pin.hasPin()).toBe(false);
    expect(await pin.setPin('2468')).toBe(true);
    expect(pin.hasPin()).toBe(true);
  });
  it('is stored as a salted hash, never as the digits', async () => {
    await pin.setPin('2468');
    const raw = localStorage.getItem('hifz-pin-v1');
    expect(raw).not.toContain('2468');
    const o = JSON.parse(raw); expect(o.s.length).toBeGreaterThan(8); expect(o.h.length).toBeGreaterThan(20);
    await pin.setPin('2468');                                                // the same PIN gets a different salt, so a different hash
    expect(JSON.parse(localStorage.getItem('hifz-pin-v1')).h).not.toBe(o.h);
  });
  it('checks the right PIN and refuses a wrong one', async () => {
    await pin.setPin('135790');
    expect(await pin.checkPin('135790')).toBe(true);
    expect(await pin.checkPin('135791')).toBe(false);
    expect(await pin.checkPin('')).toBe(false);
  });
  it('locks for half a minute after five wrong tries, even for the right PIN, then opens again', async () => {
    await pin.setPin('2468');
    for (let i = 0; i < pin.MAX_TRIES; i++) expect(await pin.checkPin('0000')).toBe(false);
    expect(pin.lockLeft()).toBeGreaterThan(0);
    expect(await pin.checkPin('2468')).toBe(false);                          // locked
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + pin.LOCK_MS + 1000);
    expect(pin.lockLeft()).toBe(0);
    expect(await pin.checkPin('2468')).toBe(true);
  });
  it('can be removed, and a damaged record means no PIN', async () => {
    await pin.setPin('2468'); pin.clearPin(); expect(pin.hasPin()).toBe(false);
    localStorage.setItem('hifz-pin-v1', '{"s":5}'); expect(pin.hasPin()).toBe(false);
    localStorage.setItem('hifz-pin-v1', 'nope'); expect(pin.hasPin()).toBe(false);
  });
});

describe('the parents area stays open for a while', () => {
  it('opens after the gate, closes when locked, and expires', () => {
    expect(pin.parentsOpen()).toBe(false);
    pin.unlockParents(); expect(pin.parentsOpen()).toBe(true);
    pin.lockParents(); expect(pin.parentsOpen()).toBe(false);
    pin.unlockParents();
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(pin.parentsOpen()).toBe(false);
  });
});
