// All animation lives here. It is deliberately calm (short fades and small shifts, no bounce)
// and every function does nothing when the device asks for reduced motion.
import gsap from 'gsap';

const mq = matchMedia('(prefers-reduced-motion: reduce)');
const calm = () => mq.matches;

/** Which elements of each page enter one after another. */
const STAGGER = {
  home: '.hero, .feats li',
  dashboard: '.summary, .today, .rewards',
  mushaf: '.row',
  review: '.revcard',
  plan: '.planview, .planform',
  games: '.gamecard',
  achievements: '.rewards, .today',
  surah: '.ay',
};
const STATIC = new Set(['home', 'about', 'certificate']);
const MAX_STAGGER = 14;

let ready = false, last = { page: '', t: 0 };
/** Data pages stay still until quran.json has rendered them, so the entrance plays on real content. */
export const motionReady = () => { ready = true };

export function pageIn(name) {
  if (calm() || (!ready && !STATIC.has(name))) return;
  const now = performance.now();
  if (last.page === name && now - last.t < 1500) return;
  last = { page: name, t: now };
  const page = document.getElementById('page-' + name); if (!page) return;
  gsap.killTweensOf(page);
  gsap.fromTo(page, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'opacity,transform' });
  const items = [...page.querySelectorAll(STAGGER[name] || '.none')].slice(0, MAX_STAGGER);
  if (items.length) gsap.from(items, { opacity: 0, y: 10, duration: 0.4, stagger: 0.045, delay: 0.08, ease: 'power2.out', clearProps: 'opacity,transform' });
  page.querySelectorAll('.bar i').forEach(i => {
    const w = i.style.width; if (!w) return;
    i.style.transition = 'none';
    gsap.fromTo(i, { width: '0%' }, { width: w, duration: 0.9, delay: 0.15, ease: 'power2.out', onComplete: () => { i.style.transition = '' } });
  });
}

/** Un-blurs an ayah in recitation mode. */
export function revealAyah(li) {
  const rest = li.querySelector('.rest');
  if (calm() || !rest) return;
  gsap.fromTo(rest, { filter: 'blur(9px)', opacity: 0.4 }, { filter: 'blur(0px)', opacity: 1, duration: 0.45, ease: 'power1.out', clearProps: 'filter,opacity' });
}

/** Gentle feedback on a game answer. */
export function correct(el) { if (!calm()) gsap.fromTo(el, { scale: 1 }, { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'transform' }) }
export function wrong(el) { if (!calm()) gsap.fromTo(el, { x: 0 }, { x: 6, duration: 0.07, yoyo: true, repeat: 3, ease: 'sine.inOut', clearProps: 'transform' }) }

/** Quiet celebration when a surah is completed: a message with a soft gold ring, plus a few stars for young children. */
let celebration = null, hideTimer = 0;
export function celebrate(text, withStars) {
  const box = document.getElementById('celebrate'); if (!box) return;
  celebration && celebration.kill(); clearTimeout(hideTimer);
  box.removeAttribute('style');   // drop the end state of any earlier animation so the message is always visible
  document.querySelectorAll('.fx-star').forEach(s => s.remove());
  box.hidden = false; box.textContent = ''; box.appendChild(Object.assign(document.createElement('p'), { textContent: text }));
  if (calm()) { hideTimer = setTimeout(() => { box.hidden = true }, 4000); return }
  celebration = gsap.timeline({ onComplete: () => { box.hidden = true } })
    .fromTo(box, { opacity: 0, y: 20, scale: 0.96, boxShadow: '0 0 0 0 rgba(169,122,28,.55)' }, { opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 18px rgba(169,122,28,0)', duration: 0.9, ease: 'power2.out' })
    .to(box, { opacity: 0, y: -10, duration: 0.6, ease: 'power1.in' }, '+=2.2');
  if (withStars) {
    const stars = Array.from({ length: 10 }, () => {
      const s = Object.assign(document.createElement('span'), { className: 'fx-star', textContent: '⭐', ariaHidden: 'true' });
      s.style.insetInlineStart = (15 + Math.random() * 70) + '%'; document.body.appendChild(s); return s;
    });
    gsap.fromTo(stars, { y: 0, opacity: 0, scale: 0.6 }, {
      y: i => -(120 + Math.random() * 140), opacity: 1, scale: 1, rotation: i => (Math.random() - 0.5) * 40,
      duration: 1.5, stagger: 0.07, ease: 'power1.out',
      onComplete() { gsap.to(stars, { opacity: 0, duration: 0.5, onComplete: () => stars.forEach(s => s.remove()) }) },
    });
  }
}
