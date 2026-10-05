// First-run set-up for a brand-new child: three short steps (a display name, a mode, a daily goal) that end in a real first session.
// It shows once (the flag is remembered), never for someone who already has progress. The goal can be changed later on the dashboard.
import { $, AR, ayahs, el } from './util.js';
import { S, kids, activeKid, updateKid, save, MODES } from './state.js';

const FLAG = 'hifz-tour-v1';
const STEPS = ['name', 'mode', 'goal'];
const TITLES = { name: 'ما اسم الطفل؟', mode: 'ما الوضع المناسب؟', goal: 'كم آية في اليوم؟' };
const MODE_NOTE = { young: 'خط أكبر وأزرار أسهل، بدون تفسير.', reader: 'النص كاملًا مع التفسير، لمن يقرأ بطلاقة.' };

let step = 0, draft = {}, onDone = () => {}, started = false;
const markSeen = () => { try { localStorage.setItem(FLAG, '1') } catch (e) {} };

/** True only for a visitor who has not seen the set-up, has one default-named child and no progress yet. */
export function needsTour() {
  try { if (localStorage.getItem(FLAG)) return false } catch (e) { return false }   // cannot remember it: do not nag
  const k = activeKid();
  return !!k && kids().length === 1 && k.name === 'طفلي' && Object.keys(S.s).length === 0;
}

function body(box) {
  const s = STEPS[step];
  if (s === 'name') {
    const lab = el('label', '', 'اسم للعرض فقط، لا حاجة للاسم الكامل'), input = el('input', 'search'); input.id = 'tourName'; input.maxLength = 20; input.autocomplete = 'off'; input.value = draft.name || '';
    lab.setAttribute('for', 'tourName'); input.addEventListener('input', () => { draft.name = input.value });
    box.append(lab, input); return input;
  }
  if (s === 'mode') {
    const g = el('div', 'choices'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'وضع الطفل');
    Object.entries(MODES).forEach(([id, label]) => {
      const b = el('button', 'choice'); b.type = 'button'; b.setAttribute('aria-pressed', id === draft.mode);
      b.append(el('b', '', label), el('span', '', MODE_NOTE[id]));
      b.addEventListener('click', () => { draft.mode = id; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)) });
      g.appendChild(b);
    });
    box.appendChild(g); return g.querySelector('[aria-pressed=true]') || g.firstChild;
  }
  if (!draft.goalSet) draft.goal = draft.mode === 'young' ? 3 : 5;   // a small start for the little ones, until the parent chooses
  const out = el('p', 'goalnum'); out.setAttribute('aria-live', 'polite');
  const paint = () => { out.textContent = ayahs(draft.goal) };
  const minus = el('button', 'btn', '−'), plus = el('button', 'btn', '+');
  minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'تقليل الهدف'); plus.setAttribute('aria-label', 'زيادة الهدف');
  minus.addEventListener('click', () => { draft.goal = Math.max(1, draft.goal - 1); draft.goalSet = true; paint() });
  plus.addEventListener('click', () => { draft.goal = Math.min(50, draft.goal + 1); draft.goalSet = true; paint() });
  paint();
  const row = el('div', 'stepper'); row.append(minus, out, plus);
  box.append(row, el('p', 'note', 'هدف صغير يُنجَز كل يوم أفضل من هدف كبير يُترك. تغيّره متى شئت من لوحتك.'));
  return plus;
}

function render() {
  const box = $('tourBody'); box.textContent = '';
  const last = step === STEPS.length - 1;
  const title = el('h2', '', TITLES[STEPS[step]]); title.id = 'tourT';
  const dots = el('p', 'dots', 'الخطوة ' + AR(step + 1) + ' من ' + AR(STEPS.length)); dots.setAttribute('role', 'status');
  box.append(dots, title);
  const focus = body(box);
  const skip = el('button', 'btn ghost', 'لاحقًا'); skip.type = 'button'; skip.addEventListener('click', () => $('tour').close());
  const back = el('button', 'btn', 'السابق'); back.type = 'button'; back.addEventListener('click', () => { step--; render() });
  const next = el('button', 'btn primary', last ? 'ابدأ أول جلسة' : 'التالي'); next.type = 'button';
  next.addEventListener('click', () => {
    if (!last) { step++; render(); return }
    const k = activeKid();
    updateKid(k.id, { name: (draft.name || '').trim() || k.name, icon: k.icon, mode: draft.mode || k.mode, friend: k.friend });
    S.goal = draft.goal; save();
    started = true; $('tour').close();
  });
  const acts = el('div', 'acts'); if (step) acts.appendChild(back); acts.append(skip, next);
  box.appendChild(acts);
  (focus || next).focus();
}

/** Opens the set-up from the first step, with the current child's details pre-filled. */
export function openTour() {
  const k = activeKid(); if (!k) return;
  step = 0; started = false;
  draft = { name: k.name === 'طفلي' ? '' : k.name, mode: k.mode, goal: S.goal, goalSet: false };
  render(); $('tour').showModal();
  ($('tourName') || document.querySelector('#tourBody .primary')).focus();   // showModal() puts focus on the first button; the field should have it
}

export function initTour(opts = {}) {
  onDone = opts.onDone || onDone;
  // closing in any way (finish, later, Escape) counts as having seen it; only "start" carries on into a session
  $('tour').addEventListener('close', () => { markSeen(); const go = started; started = false; onDone({ start: go }) });
  const again = $('tourBtn'); if (again) again.addEventListener('click', openTour);
}
