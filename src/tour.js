// A short welcome tour for a brand-new visitor: three cards about what the site does, then the child picks a name,
// a friend and a mode. It shows once (the flag is remembered), never for someone who already has progress.
import { $, AR, el, charImg } from './util.js';
import { S, kids, activeKid, updateKid, FRIENDS, MODES } from './state.js';
import { popIn } from './motion.js';

const FLAG = 'hifz-tour-v1';
const STEPS = [
  { char: 'rafiq', title: 'أهلًا! أنا رفيق 👋', text: 'سنحفظ القرآن معًا خطوة بخطوة، بالمرح واللعب.' },
  { char: 'nujum', title: 'علّم ما حفظتَ', text: 'اضغط الدائرة تحت كل آية حفظتَها، فتأخذ نجمة ⭐ وتنتظرك أوسمة جميلة.' },
  { char: 'sabr', title: 'راجع في موعدك', text: 'سأذكّرك بالمراجعة، والألعاب تثبّت الحفظ وتجعله ممتعًا.' },
  { char: 'shams', title: 'لنتعرّف عليك!', text: 'ما اسمك؟ ومن صديقك المفضّل؟', form: true },
];

let step = 0, draft = {}, onDone = () => {};
const markSeen = () => { try { localStorage.setItem(FLAG, '1') } catch (e) {} };

/** True only for a visitor who has not seen the tour, has one default-named child and no progress yet. */
export function needsTour() {
  try { if (localStorage.getItem(FLAG)) return false } catch (e) { return false }   // cannot remember it: do not nag
  const k = activeKid();
  return !!k && kids().length === 1 && k.name === 'طفلي' && Object.keys(S.s).length === 0;
}

function group(label, items, current, pick) {
  const g = el('div', 'icons'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
  items.forEach(it => {
    const b = el('button', 'chip friendchip'); b.type = 'button'; b.setAttribute('aria-pressed', it.id === current);
    if (it.char) b.append(charImg(it.char)); b.append(el('span', '', it.label));
    b.addEventListener('click', () => { pick(it.id); g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)) });
    g.appendChild(b);
  });
  return g;
}

function render() {
  const body = $('tourBody'); body.textContent = '';
  const s = STEPS[step], last = step === STEPS.length - 1;
  const pic = charImg(s.char, 'big'); pic.width = pic.height = 130;
  const title = el('h2', '', s.title); title.id = 'tourT';
  const dots = el('p', 'dots', STEPS.map((_, k) => k === step ? '●' : '○').join(' ')); dots.setAttribute('aria-label', 'الخطوة ' + AR(step + 1) + ' من ' + AR(STEPS.length));
  body.append(pic, title, el('p', 'tourtext', s.text));
  let input = null;
  if (s.form) {
    const lab = el('label', '', 'اسمك'); input = el('input', 'search'); input.id = 'tourName'; input.maxLength = 20; input.autocomplete = 'off'; input.value = draft.name || '';
    lab.setAttribute('for', 'tourName'); input.addEventListener('input', () => { draft.name = input.value });
    body.append(lab, input,
      group('اختر صديقك', FRIENDS.map(f => ({ id: f.id, label: f.name, char: f.id })), draft.friend, id => { draft.friend = id }),
      group('اختر وضعك', Object.entries(MODES).map(([id, label]) => ({ id, label })), draft.mode, id => { draft.mode = id }));
  }
  const skip = el('button', 'btn', 'تخطّي'); skip.type = 'button'; skip.addEventListener('click', () => $('tour').close());
  const next = el('button', 'btn primary', last ? 'يلا نبدأ!' : 'التالي'); next.type = 'button';
  next.addEventListener('click', () => {
    if (!last) { step++; render(); return }
    const k = activeKid();
    updateKid(k.id, { name: (draft.name || '').trim() || k.name, icon: k.icon, mode: draft.mode || k.mode, friend: draft.friend || k.friend });
    $('tour').close();
  });
  const acts = el('div', 'acts'); acts.append(skip, next);
  body.append(dots, acts);
  popIn(pic);
  (input || next).focus();
}

/** Opens the tour from the first step, with the current child's name, friend and mode pre-selected. */
export function openTour() {
  const k = activeKid(); if (!k) return;
  step = 0; draft = { name: k.name === 'طفلي' ? '' : k.name, friend: k.friend || 'rafiq', mode: k.mode };
  render(); $('tour').showModal();
  ($('tourName') || document.querySelector('#tourBody .primary')).focus();   // showModal() puts focus on the first button; the main action should have it
}

export function initTour(opts = {}) {
  onDone = opts.onDone || onDone;
  // closing in any way (finish, skip, Escape) counts as having seen it
  $('tour').addEventListener('close', () => { markSeen(); onDone() });
  const again = $('tourBtn'); if (again) again.addEventListener('click', openTour);
}
