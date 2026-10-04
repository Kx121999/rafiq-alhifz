// jsdom has no matchMedia; motion.js reads it when it loads.
if (!window.matchMedia) {
  window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
window.scrollTo = () => {};
