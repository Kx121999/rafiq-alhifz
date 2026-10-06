import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, today, memoriseAll } from './helpers.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() });

const DOM = '<div id="kids"></div><button id="parentBtn"></button><button id="parentsLock"></button><dialog id="gate"><form id="gateForm"><p id="gateQ"></p><input id="gateA"><p id="gateErr" hidden></p></form></dialog><nav id="parentTabs"></nav><div id="parentBody"></div>';
async function page(setup) {
  today('2026-05-12');
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') };
  document.body.innerHTML = DOM; sessionStorage.clear();
  const { state, Q } = await boot();
  if (setup) setup(state, Q);
  const p = await import('../src/parents.js'), pin = await import('../src/pin.js');
  p.initParents();
  return { state, Q, p, pin };
}
const tab = id => document.querySelector('#parentTabs [data-tab="' + id + '"]');
const body = () => document.getElementById('parentBody');

describe('the gate', () => {
  it('keeps the page closed until it is passed, and asks a multiplication question when there is no PIN', async () => {
    const { p } = await page();
    expect(p.showParents()).toBe(false);
    expect(document.getElementById('gate').hasAttribute('open')).toBe(true);
    expect(document.getElementById('gateQ').textContent).toMatch(/×/);
    expect(document.getElementById('gateA').type).toBe('number');
  });

  it('opens after the right answer and stays open for a while, a wrong answer shows an error', async () => {
    const { p, pin } = await page();
    p.showParents();
    const nums = document.getElementById('gateQ').textContent.match(/[٠-٩]+/g).map(s => +s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    document.getElementById('gateA').value = String(nums[0] * nums[1] + 1);
    document.getElementById('gateForm').dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
    expect(document.getElementById('gateErr').hidden).toBe(false); expect(pin.parentsOpen()).toBe(false);
    document.getElementById('gateA').value = String(nums[0] * nums[1]);
    document.getElementById('gateForm').dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve(); await Promise.resolve();
    expect(pin.parentsOpen()).toBe(true);
    expect(p.showParents()).toBe(true);
  });

  it('asks for the PIN, as a password field, when one is set', async () => {
    const { p, pin } = await page();
    await pin.setPin('2468');
    p.showParents();
    expect(document.getElementById('gateQ').textContent).toContain('رمز');
    expect(document.getElementById('gateA').type).toBe('password');
  });
});

describe('the hub', () => {
  const open = async setup => { const r = await page(setup); r.pin.unlockParents(); expect(r.p.showParents()).toBe(true); return r };

  it('has five sections and shows one at a time', async () => {
    await open();
    expect([...document.querySelectorAll('#parentTabs button')].map(b => b.dataset.tab)).toEqual(['children', 'track', 'settings', 'downloads', 'data']);
    expect(tab('children').getAttribute('aria-pressed')).toBe('true');
    tab('track').click();
    expect(tab('track').getAttribute('aria-pressed')).toBe('true'); expect(body().textContent).toContain('أرقام حقيقية');
  });

  it('adds a child and deletes one only after asking', async () => {
    const { state } = await open();
    [...body().querySelectorAll('button')].find(b => b.textContent.includes('إضافة طفل')).click();
    expect(state.kids()).toHaveLength(2);
    vi.stubGlobal('confirm', vi.fn(() => false));
    const del = () => [...body().querySelectorAll('button')].find(b => b.textContent.includes('حذف الملف'));
    del().click(); expect(state.kids()).toHaveLength(2);
    vi.stubGlobal('confirm', vi.fn(() => true)); del().click(); expect(state.kids()).toHaveLength(1);
  });

  it('shows each child\'s own real numbers, and nothing for a child who has done nothing', async () => {
    const { state, Q } = await open();
    memoriseAll(state, Q, 112); state.save();
    state.addKid({ name: 'نور', icon: '🌸', mode: 'young' });
    tab('track').click();
    const cards = [...body().querySelectorAll('.kcard')];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('٤'); expect(cards[0].textContent).toContain('١ من ١١٤');
    expect(cards[1].textContent).toContain('لا توجد خطة');
    expect(cards[1].querySelector('dd').textContent).toBe('٠');
  });

  it('names go in as plain text', async () => {
    await open(st => st.updateKid(st.activeKid().id, { name: '<i>x</i>', icon: '🌸', mode: 'reader' }));
    expect(body().querySelector('i')).toBeNull(); expect(body().textContent).toContain('<i>x</i>');
  });

  it('the settings section can set a PIN and says what it is for', async () => {
    const { pin } = await open();
    tab('settings').click();
    expect(body().textContent).toContain('ليس حسابًا');
    document.getElementById('pinNew').value = '12';
    [...body().querySelectorAll('button')].find(b => b.textContent === 'اضبط الرمز').click();
    expect(body().textContent).toContain('من ٤ إلى ٦'); expect(pin.hasPin()).toBe(false);
    document.getElementById('pinNew').value = '4821';
    [...body().querySelectorAll('button')].find(b => b.textContent === 'اضبط الرمز').click();
    await vi.waitFor(() => expect(pin.hasPin()).toBe(true));
  });
});
