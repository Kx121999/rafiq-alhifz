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

describe('the first-run set-up', () => {
  it('takes three steps (name, mode, daily goal) and ends by asking to start a session', async () => {
    const { state, tour, onDone } = await setup();
    tour.openTour();
    expect(document.getElementById('tour').hasAttribute('open')).toBe(true);
    const titles = [];
    for (let k = 0; k < 2; k++) { titles.push(document.getElementById('tourT').textContent); btn('التالي').click() }
    titles.push(document.getElementById('tourT').textContent);
    expect(new Set(titles).size).toBe(3);
    expect(btn('ابدأ أول جلسة')).toBeTruthy();                   // the last step has the finish button
    state.S.goal = 5;
  });

  it('saves the name, mode and goal, and reports that a session should start', async () => {
    const { state, tour, onDone } = await setup();
    tour.openTour();
    const name = document.getElementById('tourName'); name.value = 'ليلى'; name.dispatchEvent(new Event('input'));
    btn('التالي').click();
    document.querySelectorAll('#tourBody [role=group] button')[0].click();                // first mode: young
    btn('التالي').click();
    document.querySelector('#tourBody [aria-label="زيادة الهدف"]').click();
    btn('ابدأ أول جلسة').click();
    expect(state.activeKid()).toMatchObject({ name: 'ليلى', mode: 'young' });
    expect(state.S.goal).toBe(4);                                 // young starts at 3, one tap up
    expect(flag()).toBe('1');
    expect(onDone).toHaveBeenCalledWith({ start: true });
    expect(document.getElementById('tour').hasAttribute('open')).toBe(false);
  });

  it('keeps the existing name when the box is left empty', async () => {
    const { state, tour } = await setup();
    tour.openTour(); btn('التالي').click(); btn('التالي').click(); btn('ابدأ أول جلسة').click();
    expect(state.activeKid().name).toBe('طفلي');
  });

  it('"later" or Escape changes nothing, is remembered, and does not start a session', async () => {
    const { state, tour, onDone } = await setup();
    tour.openTour(); btn('لاحقًا').click();
    expect(state.activeKid()).toMatchObject({ name: 'طفلي', mode: 'reader' });
    expect(flag()).toBe('1'); expect(onDone).toHaveBeenLastCalledWith({ start: false });
    localStorage.removeItem('hifz-tour-v1');
    tour.openTour(); document.getElementById('tour').dispatchEvent(new Event('close'));   // Escape closes a dialog like this
    expect(flag()).toBe('1');
  });

  it('can be opened again from a button and starts from the first step', async () => {
    const { tour } = await setup({ 'hifz-tour-v1': '1' });
    document.getElementById('tourBtn').click();
    expect(document.getElementById('tour').hasAttribute('open')).toBe(true);
    expect(document.getElementById('tourT').textContent).toContain('اسم');
    expect(tour.needsTour()).toBe(false);
  });

  it('shows the name as plain text and never builds HTML from it', async () => {
    const { state, tour } = await setup();
    state.updateKid(state.activeKid().id, { name: '<b>x</b>', icon: '🌟', mode: 'young' });
    tour.openTour();
    expect(document.getElementById('tourName').value).toBe('<b>x</b>');
    expect(document.querySelector('#tourBody b')).toBeNull();
  });
});
