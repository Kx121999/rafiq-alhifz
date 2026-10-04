// All animation lives here. Playful for children (a star that jumps, medals that pop in) but short and never
// in the way, and every function does nothing when the device asks for reduced motion. The one thing that
// still happens then is the text of a celebration or a new medal, which appears and is announced without movement.
import gsap from 'gsap';
import { charImg } from './util.js';
import { friendOf } from './state.js';

const mq = matchMedia('(prefers-reduced-motion: reduce)');
const calm = () => mq.matches;

/** Which elements of each page enter one after another. */
const STAGGER = {
  home: '.hero, .feats li',
  dashboard: '.summary, .today, .tiles, .rewards',
  mushaf: '.row',
  review: '.revcard',
  plan: '.planview, .planform',
  games: '.gamecard',
  achievements: '.rewards, .today',
  surah: '.ay',
};
const STATIC = new Set(['home', 'about', 'certificate']);
const MAX_STAGGER = 14;

let ready = false, last = { page: '', t: 0 }, lastNavX = null;
/** Data pages stay still until quran.json has rendered them, so the entrance plays on real content. */
export const motionReady = () => { ready = true };

export function pageIn(name) {
  if (calm() || (!ready && !STATIC.has(name))) return;
  const now = performance.now();
  if (last.page === name && now - last.t < 1500) return;
  last = { page: name, t: now };
  const page = document.getElementById('page-' + name); if (!page) return;
  gsap.killTweensOf(page);
  // slide in from the side of the tab that was tapped (the tab bar reads right to left); other pages just rise
  const cur = document.querySelector('#nav [aria-current]'), x = cur ? cur.getBoundingClientRect().left : null;
  const dir = x != null && lastNavX != null && Math.abs(x - lastNavX) > 4 ? (x < lastNavX ? -1 : 1) : 0;
  if (x != null) lastNavX = x;
  gsap.fromTo(page, { opacity: 0, y: dir ? 0 : 14, x: dir * 40 }, { opacity: 1, y: 0, x: 0, duration: 0.45, ease: 'power2.out', clearProps: 'opacity,transform' });
  const items = [...page.querySelectorAll('.banner, ' + (STAGGER[name] || '.none'))].slice(0, MAX_STAGGER);
  if (items.length) gsap.from(items, { opacity: 0, y: 10, duration: 0.4, stagger: 0.045, delay: 0.08, ease: 'power2.out', clearProps: 'opacity,transform' });
  page.querySelectorAll('.bar i').forEach(i => {
    const w = i.style.width; if (!w) return;
    i.style.transition = 'none';
    gsap.fromTo(i, { width: '0%' }, { width: w, duration: 0.9, delay: 0.15, ease: 'power2.out', onComplete: () => { i.style.transition = '' } });
  });
  // unlocked medals pop in one after another; today's goal stars pop in too
  const medals = [...page.querySelectorAll('.badge.on .bicon')];
  if (medals.length) gsap.from(medals, { scale: 0.2, rotation: -25, opacity: 0, duration: 0.6, stagger: 0.08, delay: 0.3, ease: 'back.out(2)', clearProps: 'transform,opacity' });
  const friends = [...page.querySelectorAll('.char')];
  if (friends.length) gsap.from(friends, { scale: 0, y: 30, rotation: -14, opacity: 0, duration: 0.7, stagger: 0.12, delay: 0.2, ease: 'back.out(2)', clearProps: 'transform,opacity' });
  const goal = [...page.querySelectorAll('.goalstars span')];
  if (goal.length) gsap.from(goal, { scale: 0, duration: 0.4, stagger: 0.06, delay: 0.35, ease: 'back.out(3)', clearProps: 'transform' });
}

/** Un-blurs an ayah in recitation mode. */
export function revealAyah(li) {
  const rest = li.querySelector('.rest');
  if (calm() || !rest) return;
  gsap.fromTo(rest, { filter: 'blur(9px)', opacity: 0.4 }, { filter: 'blur(0px)', opacity: 1, duration: 0.45, ease: 'power1.out', clearProps: 'filter,opacity' });
}

/** A handful of little stars (or sparkles) flying out from an element and fading. */
function burst(el, n = 6, glyph = '⭐') {
  if (calm() || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const s = Object.assign(document.createElement('span'), { className: 'fx-spark', textContent: glyph });
    s.setAttribute('aria-hidden', 'true'); s.style.left = cx + 'px'; s.style.top = cy + 'px'; document.body.appendChild(s);
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.6, d = 38 + Math.random() * 34;
    gsap.fromTo(s, { x: 0, y: 0, scale: 0.3, opacity: 1, rotation: 0 },
      { x: Math.cos(a) * d, y: Math.sin(a) * d - 14, scale: 1, rotation: (Math.random() - 0.5) * 120, duration: 0.7, ease: 'power2.out' });
    gsap.to(s, { opacity: 0, duration: 0.35, delay: 0.45, onComplete: () => s.remove() });
  }
}

/** A character pops into view (used when the tour changes card). */
export function popIn(el) {
  if (calm() || !el) return;
  gsap.from(el, { scale: 0.3, rotation: -14, opacity: 0, duration: 0.6, ease: 'back.out(2)', clearProps: 'transform,opacity' });
}

/** Tap or click any cartoon friend and it hops with a wiggle and a few sparkles. */
export function initCharacters() {
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.char');
    if (!c || calm() || gsap.isTweening(c)) return;
    gsap.timeline({ defaults: { overwrite: 'auto' } })
      .to(c, { y: -26, rotation: -10, duration: 0.18, ease: 'power2.out' })
      .to(c, { y: 0, rotation: 8, duration: 0.2, ease: 'power2.in' })
      .to(c, { rotation: 0, duration: 0.35, ease: 'elastic.out(1.2,.35)', clearProps: 'transform' });
    burst(c, 5, '✨');
  });
}

/** The memorise button jumps and throws a few stars when an ayah is marked as memorised. */
export function markPop(btn) {
  if (calm() || !btn) return;
  gsap.fromTo(btn, { scale: 0.55 }, { scale: 1, duration: 0.5, ease: 'back.out(2.4)', clearProps: 'transform' });
  burst(btn, 6);
}

/** A wave of jumping stars down the page when a whole surah is marked at once. */
export function markWave(btns) {
  const list = [...btns].slice(0, 14);
  if (calm() || !list.length) return;
  gsap.fromTo(list, { scale: 0.65 }, { scale: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(2.2)', clearProps: 'transform' });
  burst(list[0], 6);
}

/** Feedback on a game answer: a happy hop and stars for a right one, a little shake for a wrong one. */
export function correct(el) {
  if (calm()) return;
  gsap.fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'transform' });
  burst(el, 4);
}
export function wrong(el) { if (!calm()) gsap.fromTo(el, { x: 0 }, { x: 6, duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut', clearProps: 'transform' }) }

/* ---------- celebrations and new-medal notices: shown one at a time so none hides another ---------- */
const queue = [];
let busy = false, current = null, hideTimer = 0;
const MAX_QUEUE = 4;

function enqueue(item) { if (queue.length >= MAX_QUEUE) queue.shift(); queue.push(item); if (!busy) next() }
function next() { const it = queue.shift(); if (!it) { busy = false; return } busy = true; show(it) }

function show({ text, withStars, friend }) {
  const box = document.getElementById('celebrate'); if (!box) { busy = false; return }
  current && current.kill(); clearTimeout(hideTimer);
  box.removeAttribute('style');   // drop the end state of any earlier animation so the message is always visible
  document.querySelectorAll('.fx-star').forEach(s => s.remove());
  box.hidden = false; box.textContent = '';
  if (friend) box.appendChild(charImg(friend));
  box.appendChild(Object.assign(document.createElement('p'), { textContent: text }));
  const done = () => { box.hidden = true; next() };
  if (calm()) { hideTimer = setTimeout(done, 4000); return }
  current = gsap.timeline({ onComplete: done })
    .fromTo(box, { opacity: 0, y: 24, scale: 0.9, boxShadow: '0 0 0 0 rgba(255,184,0,.55)' }, { opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 18px rgba(255,184,0,0)', duration: 0.7, ease: 'back.out(1.7)' })
    .to(box, { opacity: 0, y: -10, duration: 0.5, ease: 'power1.in' }, '+=2.2');
  if (withStars) {
    const stars = Array.from({ length: 10 }, () => {
      const s = Object.assign(document.createElement('span'), { className: 'fx-star', textContent: '⭐' });
      s.setAttribute('aria-hidden', 'true'); s.style.insetInlineStart = (15 + Math.random() * 70) + '%'; document.body.appendChild(s); return s;
    });
    gsap.fromTo(stars, { y: 0, opacity: 0, scale: 0.6 }, {
      y: () => -(120 + Math.random() * 140), opacity: 1, scale: 1, rotation: () => (Math.random() - 0.5) * 40,
      duration: 1.5, stagger: 0.07, ease: 'power1.out',
      onComplete() { gsap.to(stars, { opacity: 0, duration: 0.5, onComplete: () => stars.forEach(s => s.remove()) }) },
    });
  }
}

/** A completed surah: a message with a gold ring, and falling-up stars for young children. */
export const celebrate = (text, withStars) => enqueue({ text, withStars, friend: friendOf() });
/** A plain notice (for example a newly unlocked medal). */
export const announce = text => enqueue({ text, withStars: false, friend: 'nujum' });
