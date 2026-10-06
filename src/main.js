import './styles.css';
import './shell.css';
import { $, AR, days } from './util.js';
import { Q, loadQuran } from './data.js';
import { S, save, rec, mem, isDue, bump, setAyah, grade, setLast, activeKid, isWeak, setWeak, weakList, azToday, surahSnapshot, restoreSurah, setPos, readPos, toggleBookmark, togglePin } from './state.js';
import { initGuard, offerUndo, clearUndo } from './guard.js';
import { renderList, renderMushafTop, setFilter } from './home.js';
import { view, renderSurah, toggleTafsir, setMode } from './surah.js';
import { go, onPage, onShown, startRouter, route } from './router.js';
import { pageIn, revealAyah, celebrate, markPop, markWave, motionReady, initCharacters } from './motion.js';
import { initPlayer, loadSurah, playFrom, stopPlayer, onPlayerPos } from './player.js';
import { initPwa } from './pwa.js';
import { initSearch, openSearch, renderSearch, searchUnavailable } from './search.js';
import { renderReport } from './report.js';
import { shareReport } from './reportcard.js';
import { initTour, needsTour, openTour } from './tour.js';
import { renderDashboard, sessionTarget } from './dashboard.js';
import { renderMore } from './more.js';
import { renderAdhkar, refreshAdhkar } from './adhkar.js';
import { initReading, setFocusRead } from './reading.js';
import { renderShop, onShopChange } from './shop.js';
import { renderChallenge, checkChallenge } from './challenge.js';
import { renderShare } from './share.js';
import { renderFamily } from './family.js';
import { initCheck } from './diagnose.js';
import { initSession, openSession } from './session.js';
import { initCompanion, companionPage, refreshCompanion } from './companion.js';
import { renderOffline } from './offlineui.js';
import { renderRamadan, recordRamadan } from './ramadan.js';
import { initReminders, setReminderContext } from './remind.js';
import { renderReview, renderWeak, onReviewGraded, clearReviewNote, dueList, ratingButtons, ratingNote } from './review.js';
import { renderPlan, onPlanChanged } from './plan.js';
import { renderGames, onGameStars, resetGame } from './games.js';
import { renderAchievements, renderMedalsPage, renderAchTabs, renderCertificate } from './achievements.js';
import { initKids, onKidsChange, renderKidBar, applyMode } from './kids.js';
import { announceBadges } from './medals.js';
import { initParents, showParents } from './parents.js';

function render() {
  if (!Q.length) return;
  applyMode(); renderDashboard(); renderList(); renderMushafTop(); renderReview(); renderWeak(); renderPlan(); updateDue(); renderAchievements();
  if (!$('page-games').hidden) renderGames();
  refreshAdhkar(); checkChallenge(); refreshCompanion(); recordRamadan();
  for (const [id, fn] of [['medals', renderMedalsPage], ['shop', renderShop], ['challenge', renderChallenge], ['share', renderShare], ['family', renderFamily], ['ramadan', renderRamadan]]) if (!$('page-' + id).hidden) fn();
  if (view.cur) renderSurah(false);
}
function updateDue() {
  const n = dueList().length + weakList().length, c = $('dueCount');
  c.textContent = AR(n); c.hidden = !n; c.setAttribute('aria-label', AR(n) + ' للمراجعة');
}
const refreshStats = () => { checkChallenge(); renderDashboard(); updateDue(); announceBadges() };

/** Celebrates when a surah goes from incomplete to fully memorised. */
function checkCompleted(id, wasComplete) {
  const c = Q[id - 1]; if (wasComplete || mem(id) !== c.v.length) return;
  const k = activeKid();
  celebrate('أتممتَ حفظ سورة ' + c.n + '، ما شاء الله', !!k && k.mode === 'young');
}

/* ---------- routes ---------- */
/** Opening #/surah/<n>/<ayah> (from a search result) scrolls to that ayah and highlights it for a moment. */
let pendingAyah = 0, quietJump = false, tracking = false;
function jumpToAyah() {
  const n = pendingAyah, quiet = quietJump; pendingAyah = 0; quietJump = false;
  const li = n && document.querySelector('#ayat .ay[data-i="' + (n - 1) + '"]');
  if (li) {
    li.scrollIntoView({ block: 'center' });
    if (!quiet) { li.classList.add('found'); setTimeout(() => li.classList.remove('found'), 3500) }   // from a search result: shown; from "where I stopped": just there
  }
  setTimeout(() => { tracking = true }, 600);   // only now do scrolls count as "where the child is"
}
/** Remembers the ayah at the top of the screen (and the study mode) as the child's place in this surah. */
function savePlace(i) { if (view.cur && tracking) setPos(view.cur, i == null ? topAyah() : i, view.mode) }
function topAyah() {
  const list = document.querySelectorAll('#ayat .ay');
  for (const li of list) if (li.getBoundingClientRect().bottom > 150) return +li.dataset.i;
  return 0;
}
let scrollTimer = 0;
window.addEventListener('scroll', () => { if (!view.cur || !tracking) return; clearTimeout(scrollTimer); scrollTimer = setTimeout(savePlace, 400) }, { passive: true });
onPlayerPos((id, i) => { if (id === view.cur) { tracking = true; setPos(id, i, view.mode) } });
onShown(page => {
  pageIn(page); companionPage(page);
  if (page !== 'adhkar' && page !== 'surah') setFocusRead(false);
  if (page !== 'surah') stopPlayer(); else setTimeout(jumpToAyah, 450);
  if (page === 'search' && !$('sq').value) $('sq').focus();
});
onPage('report', arg => { view.cur = 0; if (Q.length) renderReport(+arg || 0) });
onPage('search', arg => { view.cur = 0; openSearch(arg) });
onPage('surah', (arg, ayah) => {
  clearUndo();
  const id = +arg; if (!(id >= 1 && id <= 114)) return false;
  if (!Q.length) { view.cur = 0; return }   // quran.json still loading: boot re-routes once it arrives
  const pos = readPos(), back = pos && pos.id === id ? pos : null, len = Q[id - 1].v.length;
  view.cur = id; tracking = false; setLast(id);
  // where the child was last time (mode and ayah) comes back, without playing anything; a surah that is due opens in recitation mode
  setMode(back ? back.mode : isDue(id) ? 'recite' : mem(id) > 0 && mem(id) < len ? 'memorise' : 'read');
  renderSurah(true); loadSurah(id, back ? back.i : 0); renderOffline(id);
  pendingAyah = +ayah >= 1 && +ayah <= len ? +ayah : back && back.i > 0 ? back.i + 1 : 0;
  quietJump = !(+ayah >= 1);
  document.title = 'سورة ' + Q[id - 1].n + ' · رفيق الحفظ';
});
for (const p of ['home', 'about']) onPage(p, () => { view.cur = 0 });
onPage('review', () => { view.cur = 0; clearReviewNote(); render() });
onPage('plan', () => { view.cur = 0; render() });
onPage('adhkar', arg => { view.cur = 0; renderAdhkar(arg) });
onPage('shop', () => { view.cur = 0; renderAchTabs(); renderShop() });
onPage('medals', () => { view.cur = 0; renderMedalsPage() });
onPage('challenge', () => { view.cur = 0; checkChallenge(); renderChallenge() });
onPage('share', () => { view.cur = 0; renderShare() });
onPage('family', () => { view.cur = 0; if (Q.length) renderFamily() });
onShopChange(() => render());
onPage('ramadan', () => { view.cur = 0; recordRamadan(); renderRamadan() });
document.addEventListener('hifz-ramadan', () => render());
document.addEventListener('hifz-reciter', () => { if (view.cur) renderOffline(view.cur) });
$('sessBtn').addEventListener('click', () => { if (view.cur) openSession(view.cur) });
initSession({ mark: (id, i) => {
  const was = mem(id) === Q[id - 1].v.length;
  bump(setAyah(id, i, true)); save(); if (view.cur === id) renderSurah(false); refreshStats(); checkCompleted(id, was);
}, review: () => { render() } });
onPage('check', () => { view.cur = 0 });
onPage('more', () => { view.cur = 0; renderMore() });
onPage('parents', arg => { view.cur = 0; return showParents(arg) ? undefined : '/dashboard' });
initCheck();
$('printFamily').addEventListener('click', () => window.print());
onPage('games', () => { view.cur = 0; resetGame(); render(); renderGames() });
onPage('achievements', () => { view.cur = 0; render() });
onPage('certificate', arg => {
  view.cur = 0; if (!Q.length) return;
  if (!renderCertificate(+arg)) return '/achievements';
  document.title = 'شهادة سورة ' + Q[+arg - 1].n + ' · رفيق الحفظ';
});
onGameStars(() => { checkChallenge(); renderAchievements(); announceBadges() });
$('printCert').addEventListener('click', () => window.print());
$('printReport').addEventListener('click', () => window.print());
$('shareReport').addEventListener('click', async () => {
  const r = await shareReport();
  $('shareReportMsg').textContent = ({ shared: 'تمت المشاركة.', saved: 'تم حفظ صورة التقرير على جهازك.', cancelled: '', unsupported: 'تعذّر رسم الصورة في هذا المتصفح. استخدم «طباعة التقرير» واحفظه PDF.' })[r];
});
onReviewGraded(() => { renderDashboard(); updateDue() });
onPlanChanged(() => { renderDashboard() });
for (const p of ['dashboard', 'mushaf']) onPage(p, () => { view.cur = 0; render() });

/* ---------- index ---------- */
$('list').addEventListener('click', e => { const b = e.target.closest('.row'); if (b) go('/surah/' + b.dataset.id) });
$('q').addEventListener('input', renderList);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return; setFilter(b.dataset.f);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b)); renderList();
});

/* ---------- surah ---------- */
$('modes').addEventListener('click', e => {
  const b = e.target.closest('.mode'); if (!b) return;
  tracking = true; setMode(b.dataset.mode); renderSurah(false); savePlace();
});
$('pinBtn').addEventListener('click', () => { togglePin(view.cur); renderSurah(false) });
$('focusBtn').addEventListener('click', () => setFocusRead(!document.body.classList.contains('focusread')));
$('focusExit').addEventListener('click', () => setFocusRead(false));
/** Puts a surah back as it was (after "undo"), with the daily count and the lists redrawn. */
function undoSurah(id, snap, delta) { restoreSurah(id, snap); bump(-delta); save(); if (view.cur === id) renderSurah(false); refreshStats() }

$('allBtn').addEventListener('click', () => {
  const id = view.cur, c = Q[id - 1], tot = c.v.length, was = mem(id) === tot, on = !was;
  // a change to the whole surah at once is asked about first, and can be taken back
  const ask = on ? 'هل حفظتَ كل آيات سورة ' + c.n + ' (' + AR(tot) + ' آية)؟ ستُعلَّم كلها محفوظة كتسجيل لحفظ سابق، ولا تُحتسب في ورد اليوم ولا في تحدّي الأسبوع.' : 'إلغاء حفظ سورة ' + c.n + ' كلها؟ سيُمسح تعليم ' + AR(mem(id)) + ' آية.';
  if (!confirm(ask)) return;
  const snap = surahSnapshot(id); let d = 0;
  for (let i = 0; i < tot; i++) d += setAyah(id, i, on);
  // recording memorisation that already existed is not new work today: no daily count, no streak, no weekly challenge
  save(); renderSurah(false); refreshStats(); checkCompleted(id, was);
  if (on) markWave(document.querySelectorAll('#ayat .ck'));
  if (d) offerUndo(on ? 'عُلّمت سورة ' + c.n + ' كاملة.' : 'أُلغي حفظ سورة ' + c.n + '.', () => undoSurah(id, snap, 0));
});
$('ayat').addEventListener('click', e => {
  const li = e.target.closest('.ay'); if (!li) return;
  if (e.target.closest('.wk')) { const i = +li.dataset.i; setWeak(view.cur, i, !isWeak(view.cur, i)); save(); renderSurah(false); refreshStats(); return }
  if (e.target.closest('.bm')) { toggleBookmark(view.cur, +li.dataset.i); renderSurah(false); return }
  if (e.target.closest('.pl')) { tracking = true; playFrom(+li.dataset.i); return }
  if (e.target.closest('.tf')) { toggleTafsir(li); return }
  if (e.target.closest('.tfx')) return;
  if (e.target.closest('.ck')) {
    const id = view.cur, i = +li.dataset.i, r = rec(id), was = mem(id) === Q[id - 1].v.length, turnOn = !(r && r.m[i] === '1'), snap = surahSnapshot(id);
    const d = setAyah(id, i, turnOn); bump(d); save(); renderSurah(false); refreshStats(); checkCompleted(id, was);
    if (turnOn) markPop(li.querySelector('.ck'));
    else offerUndo('أُلغي تعليم الآية ' + AR(i + 1) + '.', () => undoSurah(id, snap, d), 7000);   // an un-mark is often an accidental tap
  } else if (view.veil && li.classList.toggle('shown')) revealAyah(li);
});
$('ayat').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tx') && view.veil) { e.preventDefault(); const li = e.target.closest('.ay'); if (li.classList.toggle('shown')) revealAyah(li) }
});
function onGrade(key) {
  const i = grade(view.cur, key); if (i == null) return;
  renderSurah(false); refreshStats();
  $('revText').textContent = ratingNote(key, i);
}
$('revActs').appendChild(ratingButtons(onGrade));

/* ---------- landing ---------- */
/** The landing page's main button: a new child sets up and starts a session, a returning one goes to the dashboard. */
$('startBtn').addEventListener('click', () => { if (needsTour()) openTour(); else go('/dashboard') });
$('howBtn').addEventListener('click', () => { const h = $('how'); h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); h.querySelector('h2').focus({ preventScroll: true }) });

/* ---------- boot ---------- */
initGuard(); initCharacters(); initKids(); initParents(); initReading(); initCompanion(); onKidsChange(render); initTour({ onDone: r => { renderKidBar(); render(); if (r && r.start) { go('/dashboard'); openSession(sessionTarget().id) } } }); initPlayer(); initPwa(); initSearch();
setReminderContext(() => ({ reviewDue: Q.length ? dueList().length + weakList().length : 0, adhkarDone: id => azToday(id).d === 1 }));
startRouter();
// someone who is already using the app (progress, or the installed app) lands on the dashboard, not on the landing page
const atHome = () => ['', '#', '#/'].includes(location.hash);
const launchHome = () => atHome() && (Object.keys(S.s).length > 0 || matchMedia('(display-mode: standalone)').matches);
loadQuran().then(() => { if (launchHome()) location.replace('#/dashboard'); render(); document.body.classList.add('dataready'); initReminders(); announceBadges(); motionReady(); route(); if (!$('page-search').hidden) renderSearch() })
  .catch(() => { searchUnavailable(); $('list').innerHTML = '<li class="empty">تعذّر تحميل نص المصحف. أعد فتح الصفحة للمحاولة مرة أخرى.</li>' });
