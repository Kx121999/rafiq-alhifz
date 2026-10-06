// Hash router: #/ #/dashboard #/mushaf #/surah/<n> #/about. Works on static hosting with no server rules.
import { $ } from './util.js';

const TITLES = { home: '', dashboard: 'لوحتي', more: 'المزيد', parents: 'ركن الأهل', mushaf: 'المصحف', search: 'بحث', review: 'المراجعة', plan: 'الخطة', games: 'ألعاب', adhkar: 'الأذكار', shop: 'متجر النجوم', check: 'فحص الجهاز', ramadan: 'رمضان معنا', challenge: 'تحدّي الأسبوع', share: 'بطاقة الإنجاز', family: 'تقرير العائلة', achievements: 'إنجازاتي', medals: 'كل الأوسمة', certificate: 'شهادة', report: 'التقرير الأسبوعي', surah: 'السورة', about: 'عن المنصة' };
/** Pages that are not a tab light up the tab they belong to. */
const NAV_OF = { surah: 'mushaf', search: 'mushaf', certificate: 'achievements', plan: 'dashboard', report: 'dashboard', shop: 'achievements', medals: 'achievements', challenge: 'dashboard', share: 'achievements', family: 'dashboard', check: 'dashboard', ramadan: 'dashboard' };
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
  document.body.dataset.view = page === 'home' ? 'landing' : 'app';
  // the link of the page itself when it has one; otherwise the tab it belongs to. A tool that only the side menu lists lights "المزيد" on the phone's bottom bar.
  const links = [...document.querySelectorAll('#nav a')], exact = links.find(a => a.dataset.nav === page);
  const lit = new Set(exact ? [exact] : links.filter(a => a.dataset.nav === NAV_OF[page]));
  if (exact && exact.closest('.navtools')) links.filter(a => a.classList.contains('navmorelink')).forEach(a => lit.add(a));
  links.forEach(a => lit.has(a) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (page !== 'surah') document.title = TITLES[page] ? TITLES[page] + ' · رفيق الحفظ' : 'رفيق الحفظ';
  window.scrollTo(0, 0);
  $('page-' + page).focus({ preventScroll: true });
  shown(page);
  document.body.classList.add('ready');   // until the first page is on screen the footer stays hidden, so it does not jump down when the page appears
}

export const startRouter = () => {
  window.addEventListener('hashchange', route);
  const skip = $('skip');   // "skip to content" moves focus to the page that is open
  if (skip) skip.addEventListener('click', e => { e.preventDefault(); const p = document.querySelector('.page:not([hidden])'); if (p) p.focus() });
  route();
};
/** Stops listening for hash changes (used by tests so one test's router cannot react to the next test's navigation). */
export const stopRouter = () => window.removeEventListener('hashchange', route);
