import { describe, it, expect, beforeEach, vi } from 'vitest';
import { boot } from './helpers.js';

// jsdom has no modal <dialog>; a tiny stand-in that fires the same 'close' event
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) };
  document.body.innerHTML = '<dialog id="tour"><div id="tourBody"></div></dialog><button id="tourBtn"></button>';
});

async function setup(seed = {}) {
  const { state } = await boot(seed);
  const tour = await import('../src/tour.js');
  const onDone = vi.fn();
  tour.initTour({ onDone });
  return { state, tour, onDone };
}
const btn = text => [...document.querySelectorAll('#tourBody button')].find(b => b.textContent.includes(text));
const flag = () => localStorage.getItem('hifz-tour-v1');

describe('who gets the tour', () => {
  it('a brand-new visitor does', async () => {
    const { tour } = await setup();
    expect(tour.needsTour()).toBe(true);
  });
  it('nobody who has already seen it', async () => {
    const { tour } = await setup({ 'hifz-tour-v1': '1' });
    expect(tour.needsTour()).toBe(false);
  });
  it('nobody who already has progress, a renamed child, or several children', async () => {
    const withProgress = await setup({ 'hifz-progress-v1': { s: { 112: { m: '1000', d: '2026-05-02', i: 1 } } } });
    expect(withProgress.tour.needsTour()).toBe(false);
    const renamed = await setup();
    renamed.state.updateKid(renamed.state.activeKid().id, { name: 'نور', icon: '🌟', mode: 'young' });
    expect(renamed.tour.needsTour()).toBe(false);
    const several = await setup();
    several.state.addKid({ name: 'يوسف', icon: '🌙', mode: 'reader' });
    expect(several.tour.needsTour()).toBe(false);
  });
});

describe('the tour itself', () => {
  it('walks through four cards and saves the child\'s name, friend and mode', async () => {
    const { state, tour, onDone } = await setup();
    tour.openTour();
    expect(document.getElementById('tour').hasAttribute('open')).toBe(true);
    const titles = [];
    for (let k = 0; k < 3; k++) { titles.push(document.getElementById('tourT').textContent); btn('التالي').click() }
    titles.push(document.getElementById('tourT').textContent);
    expect(new Set(titles).size).toBe(4);
    expect(btn('يلا نبدأ')).toBeTruthy();                       // the last card has the finish button
    const name = document.getElementById('tourName'); name.value = 'ليلى'; name.dispatchEvent(new Event('input'));
    [...document.querySelectorAll('#tourBody [role=group]')][0].querySelectorAll('button')[1].click();   // second friend: Nujum
    [...document.querySelectorAll('#tourBody [role=group]')][1].querySelectorAll('button')[0].click();   // first mode: young
    btn('يلا نبدأ').click();
    expect(state.activeKid()).toMatchObject({ name: 'ليلى', friend: 'nujum', mode: 'young' });
    expect(flag()).toBe('1');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(document.getElementById('tour').hasAttribute('open')).toBe(false);
  });

  it('keeps the existing name when the box is left empty', async () => {
    const { state, tour } = await setup();
    tour.openTour();
    for (let k = 0; k < 3; k++) btn('التالي').click();
    btn('يلا نبدأ').click();
    expect(state.activeKid().name).toBe('طفلي');
  });

  it('skipping or pressing Escape changes nothing but is remembered', async () => {
    const { state, tour } = await setup();
    tour.openTour(); btn('تخطّي').click();
    expect(state.activeKid()).toMatchObject({ name: 'طفلي', mode: 'reader' });
    expect(flag()).toBe('1');
    localStorage.removeItem('hifz-tour-v1');
    tour.openTour(); document.getElementById('tour').dispatchEvent(new Event('close'));   // Escape closes a dialog like this
    expect(flag()).toBe('1');
  });

  it('can be opened again from the about page button and starts from the first card', async () => {
    const { tour } = await setup({ 'hifz-tour-v1': '1' });
    document.getElementById('tourBtn').click();
    expect(document.getElementById('tour').hasAttribute('open')).toBe(true);
    expect(document.getElementById('tourT').textContent).toContain('رفيق');
    expect(tour.needsTour()).toBe(false);
  });

  it('shows the name as plain text and never builds HTML from it', async () => {
    const { state, tour } = await setup();
    state.updateKid(state.activeKid().id, { name: '<b>x</b>', icon: '🌟', mode: 'young' });
    tour.openTour();
    for (let k = 0; k < 3; k++) btn('التالي').click();
    expect(document.getElementById('tourName').value).toBe('<b>x</b>');
    expect(document.querySelector('#tourBody b')).toBeNull();
  });
});
