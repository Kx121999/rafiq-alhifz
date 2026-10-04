// Hash router: #/ #/dashboard #/mushaf #/surah/<n> #/about. Works on static hosting with no server rules.
import { $ } from './util.js';

const TITLES = { home: '', dashboard: 'لوحتي', mushaf: 'المصحف', search: 'بحث', review: 'المراجعة', plan: 'الخطة', games: 'ألعاب', achievements: 'إنجازاتي', certificate: 'شهادة', surah: 'السورة', about: 'عن المنصة' };
const handlers = {};
let shown = () => {};
/** Called with the page name after a page has been shown (used for entrance animation). */
export const onShown = fn => { shown = fn };

/** Register a callback run when a page opens: fn(arg, arg2) may return false (go to the mushaf) or a path string to redirect. */
export const onPage = (name, fn) => { handlers[name] = fn };

export const go = path => { if (location.hash === '#' + path) route(); else location.hash = path };

export function route() {
  const [name = '', arg, arg2] = location.hash.replace(/^#\/?/, '').split('/');
  const page = name in TITLES ? name : 'home';
  const r = handlers[page] && handlers[page](arg, arg2);
  if (r === false) { go('/mushaf'); return }
  if (typeof r === 'string') { go(r); return }
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== page });
  document.querySelectorAll('#nav a').forEach(a => {
    const on = a.dataset.nav === page || (page === 'surah' && a.dataset.nav === 'mushaf') || (page === 'certificate' && a.dataset.nav === 'achievements');
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (page !== 'surah') document.title = TITLES[page] ? TITLES[page] + ' · رفيق الحفظ' : 'رفيق الحفظ';
  window.scrollTo(0, 0);
  $('page-' + page).focus({ preventScroll: true });
  shown(page);
}

export const startRouter = () => { window.addEventListener('hashchange', route); route() };
