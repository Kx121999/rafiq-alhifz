import './styles.css';
import { $, AR, days } from './util.js';
import { Q, loadQuran } from './data.js';
import { S, save, rec, mem, isDue, bump, setAyah, grade, setLast, activeKid, isWeak, setWeak, weakList } from './state.js';
import { renderSummary, renderList, setFilter } from './home.js';
import { view, renderSurah, toggleTafsir } from './surah.js';
import { go, onPage, onShown, startRouter, route } from './router.js';
import { pageIn, revealAyah, celebrate, markPop, markWave, motionReady, initCharacters } from './motion.js';
import { initPlayer, loadSurah, playFrom, stopPlayer } from './player.js';
import { initPwa } from './pwa.js';
import { initSearch, openSearch } from './search.js';
import { renderReport } from './report.js';
import { initTour, needsTour, openTour } from './tour.js';
import { renderToday } from './dashboard.js';
import { renderAdhkar, refreshAdhkar } from './adhkar.js';
import { renderReview, renderWeak, onReviewGraded, clearReviewNote, dueList } from './review.js';
import { renderPlan, onPlanChanged } from './plan.js';
import { renderGames, onGameStars, resetGame } from './games.js';
import { renderAchievements, renderCertificate } from './achievements.js';
import { initKids, onKidsChange, renderRewards, renderKidBar, applyMode, announceBadges } from './kids.js';

function render() {
  if (!Q.length) return;
  applyMode(); renderSummary(); renderToday(); renderRewards(); renderList(); renderReview(); renderWeak(); renderPlan(); updateDue(); renderAchievements();
  if (!$('page-games').hidden) renderGames();
  refreshAdhkar();
  if (view.cur) renderSurah(false);
}
function updateDue() {
  const n = dueList().length + weakList().length, c = $('dueCount');
  c.textContent = AR(n); c.hidden = !n; c.setAttribute('aria-label', AR(n) + ' للمراجعة');
}
const refreshStats = () => { renderSummary(); renderToday(); renderRewards(); updateDue(); announceBadges() };

/** Celebrates when a surah goes from incomplete to fully memorised. */
function checkCompleted(id, wasComplete) {
  const c = Q[id - 1]; if (wasComplete || mem(id) !== c.v.length) return;
  const k = activeKid();
  celebrate('أتممتَ حفظ سورة ' + c.n + '، ما شاء الله', !!k && k.mode === 'young');
}

/* ---------- routes ---------- */
/** Opening #/surah/<n>/<ayah> (from a search result) scrolls to that ayah and highlights it for a moment. */
let pendingAyah = 0;
function jumpToAyah() {
  const n = pendingAyah; pendingAyah = 0; if (!n) return;
  const li = document.querySelector('#ayat .ay[data-i="' + (n - 1) + '"]'); if (!li) return;
  li.scrollIntoView({ block: 'center' }); li.classList.add('found');
  setTimeout(() => li.classList.remove('found'), 3500);
}
onShown(page => {
  pageIn(page);
  if (page !== 'surah') stopPlayer(); else setTimeout(jumpToAyah, 450);
  if (page === 'search' && !$('sq').value) $('sq').focus();
});
onPage('report', arg => { view.cur = 0; if (Q.length) renderReport(+arg || 0) });
onPage('search', arg => { view.cur = 0; openSearch(arg) });
onPage('surah', (arg, ayah) => {
  const id = +arg; if (!(id >= 1 && id <= 114)) return false;
  if (!Q.length) { view.cur = 0; return }   // quran.json still loading: boot re-routes once it arrives
  view.cur = id; view.veil = isDue(id); setLast(id); renderSurah(true); loadSurah(id);
  pendingAyah = +ayah >= 1 && +ayah <= Q[id - 1].v.length ? +ayah : 0;
  document.title = 'سورة ' + Q[id - 1].n + ' · رفيق الحفظ';
});
for (const p of ['home', 'about']) onPage(p, () => { view.cur = 0 });
onPage('review', () => { view.cur = 0; clearReviewNote(); render() });
onPage('plan', () => { view.cur = 0; render() });
onPage('adhkar', arg => { view.cur = 0; renderAdhkar(arg) });
onPage('games', () => { view.cur = 0; resetGame(); render(); renderGames() });
onPage('achievements', () => { view.cur = 0; render() });
onPage('certificate', arg => {
  view.cur = 0; if (!Q.length) return;
  if (!renderCertificate(+arg)) return '/achievements';
  document.title = 'شهادة سورة ' + Q[+arg - 1].n + ' · رفيق الحفظ';
});
onGameStars(() => { renderRewards(); renderAchievements(); announceBadges() });
$('printCert').addEventListener('click', () => window.print());
$('printReport').addEventListener('click', () => window.print());
onReviewGraded(() => { renderSummary(); renderToday(); renderRewards(); updateDue() });
onPlanChanged(() => { renderSummary(); renderToday() });
for (const p of ['dashboard', 'mushaf']) onPage(p, () => { view.cur = 0; render() });

/* ---------- index ---------- */
$('list').addEventListener('click', e => { const b = e.target.closest('.row'); if (b) go('/surah/' + b.dataset.id) });
$('q').addEventListener('input', renderList);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return; setFilter(b.dataset.f);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b)); renderList();
});
$('gMinus').addEventListener('click', () => { S.goal = Math.max(1, S.goal - 1); save(); renderSummary() });
$('gPlus').addEventListener('click', () => { S.goal = Math.min(50, S.goal + 1); save(); renderSummary() });

/* ---------- surah ---------- */
$('veilBtn').addEventListener('click', () => { view.veil = !view.veil; $('ayat').querySelectorAll('.shown').forEach(x => x.classList.remove('shown')); renderSurah(false) });
$('allBtn').addEventListener('click', () => {
  const tot = Q[view.cur - 1].v.length, was = mem(view.cur) === tot, on = !was; let d = 0;
  for (let i = 0; i < tot; i++) d += setAyah(view.cur, i, on);
  bump(d); save(); renderSurah(false); refreshStats(); checkCompleted(view.cur, was);
  if (on) markWave(document.querySelectorAll('#ayat .ck'));
});
$('ayat').addEventListener('click', e => {
  const li = e.target.closest('.ay'); if (!li) return;
  if (e.target.closest('.wk')) { const i = +li.dataset.i; setWeak(view.cur, i, !isWeak(view.cur, i)); save(); renderSurah(false); refreshStats(); return }
  if (e.target.closest('.pl')) { playFrom(+li.dataset.i); return }
  if (e.target.closest('.tf')) { toggleTafsir(li); return }
  if (e.target.closest('.tfx')) return;
  if (e.target.closest('.ck')) {
    const i = +li.dataset.i, r = rec(view.cur), was = mem(view.cur) === Q[view.cur - 1].v.length, turnOn = !(r && r.m[i] === '1');
    bump(setAyah(view.cur, i, turnOn)); save(); renderSurah(false); refreshStats(); checkCompleted(view.cur, was);
    if (turnOn) markPop(li.querySelector('.ck'));
  } else if (view.veil && li.classList.toggle('shown')) revealAyah(li);
});
$('ayat').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tx') && view.veil) { e.preventDefault(); const li = e.target.closest('.ay'); if (li.classList.toggle('shown')) revealAyah(li) }
});
function onGrade(good) {
  const i = grade(view.cur, good); if (i == null) return;
  renderSurah(false); refreshStats();
  $('revText').textContent = (good ? 'أحسنت. ' : 'لا بأس، كرّرها اليوم. ') + 'المراجعة القادمة بعد ' + days(i) + '.';
}
$('revGood').addEventListener('click', () => onGrade(true));
$('revBad').addEventListener('click', () => onGrade(false));

/* ---------- boot ---------- */
initCharacters(); initKids(); onKidsChange(render); initTour({ onDone: () => { renderKidBar(); render() } }); initPlayer(); initPwa(); initSearch();
startRouter();
loadQuran().then(() => { render(); announceBadges(); motionReady(); route(); if (needsTour()) openTour() })
  .catch(() => { $('list').innerHTML = '<li class="empty">تعذّر تحميل نص المصحف. أعد فتح الصفحة للمحاولة مرة أخرى.</li>' });
