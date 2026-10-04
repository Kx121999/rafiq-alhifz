// Hash router: #/ #/dashboard #/mushaf #/surah/<n> #/about. Works on static hosting with no server rules.
import { $ } from './util.js';

const TITLES = { home: '', dashboard: 'لوحتي', mushaf: 'المصحف', review: 'المراجعة', plan: 'الخطة', surah: 'السورة', about: 'عن المنصة' };
const handlers = {};

/** Register a callback run when a page opens: fn(arg) may return false to cancel (e.g. bad surah id). */
export const onPage = (name, fn) => { handlers[name] = fn };

export const go = path => { if (location.hash === '#' + path) route(); else location.hash = path };

export function route() {
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const page = name in TITLES ? name : 'home';
  if (handlers[page] && handlers[page](arg) === false) { go('/mushaf'); return }
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== page });
  document.querySelectorAll('#nav a').forEach(a => {
    const on = a.dataset.nav === page || (page === 'surah' && a.dataset.nav === 'mushaf');
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (page !== 'surah') document.title = TITLES[page] ? TITLES[page] + ' · رفيق الحفظ' : 'رفيق الحفظ';
  window.scrollTo(0, 0);
  $('page-' + page).focus({ preventScroll: true });
}

export const startRouter = () => { window.addEventListener('hashchange', route); route() };
