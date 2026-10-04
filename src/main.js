import './styles.css';
import { $, AR, days } from './util.js';
import { Q, loadQuran } from './data.js';
import { S, save, rec, mem, isDue, bump, setAyah, grade, setLast, activeKid } from './state.js';
import { renderSummary, renderList, setFilter } from './home.js';
import { view, renderSurah, toggleTafsir } from './surah.js';
import { go, onPage, onShown, startRouter, route } from './router.js';
import { pageIn, revealAyah, celebrate, motionReady } from './motion.js';
import { initPlayer, loadSurah, playFrom, stopPlayer } from './player.js';
import { initPwa } from './pwa.js';
import { renderToday } from './dashboard.js';
import { renderReview, onReviewGraded, clearReviewNote, dueList } from './review.js';
import { renderPlan, onPlanChanged } from './plan.js';
import { renderGames, onGameStars, resetGame } from './games.js';
import { renderAchievements, renderCertificate } from './achievements.js';
import { initKids, onKidsChange, renderRewards, applyMode } from './kids.js';

function render() {
  if (!Q.length) return;
  applyMode(); renderSummary(); renderToday(); renderRewards(); renderList(); renderReview(); renderPlan(); updateDue(); renderAchievements();
  if (!$('page-games').hidden) renderGames();
  if (view.cur) renderSurah(false);
}
function updateDue() {
  const n = dueList().length, c = $('dueCount');
  c.textContent = AR(n); c.hidden = !n; c.setAttribute('aria-label', '' + n + ' مراجعات مستحقة');
}
const refreshStats = () => { renderSummary(); renderToday(); renderRewards(); updateDue() };

/** Celebrates when a surah goes from incomplete to fully memorised. */
function checkCompleted(id, wasComplete) {
  const c = Q[id - 1]; if (wasComplete || mem(id) !== c.v.length) return;
  const k = activeKid();
  celebrate('أتممتَ حفظ سورة ' + c.n + '، ما شاء الله', !!k && k.mode === 'young');
}

/* ---------- routes ---------- */
onShown(page => { pageIn(page); if (page !== 'surah') stopPlayer() });
onPage('surah', arg => {
  const id = +arg; if (!(id >= 1 && id <= 114)) return false;
  if (!Q.length) { view.cur = 0; return }   // quran.json still loading: boot re-routes once it arrives
  view.cur = id; view.veil = isDue(id); setLast(id); renderSurah(true); loadSurah(id);
  document.title = 'سورة ' + Q[id - 1].n + ' · رفيق الحفظ';
});
for (const p of ['home', 'about']) onPage(p, () => { view.cur = 0 });
onPage('review', () => { view.cur = 0; clearReviewNote(); render() });
onPage('plan', () => { view.cur = 0; render() });
onPage('games', () => { view.cur = 0; resetGame(); render(); renderGames() });
onPage('achievements', () => { view.cur = 0; render() });
onPage('certificate', arg => {
  view.cur = 0; if (!Q.length) return;
  if (!renderCertificate(+arg)) return '/achievements';
  document.title = 'شهادة سورة ' + Q[+arg - 1].n + ' · رفيق الحفظ';
});
onGameStars(() => { renderRewards(); renderAchievements() });
$('printCert').addEventListener('click', () => window.print());
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
});
$('ayat').addEventListener('click', e => {
  const li = e.target.closest('.ay'); if (!li) return;
  if (e.target.closest('.pl')) { playFrom(+li.dataset.i); return }
  if (e.target.closest('.tf')) { toggleTafsir(li); return }
  if (e.target.closest('.tfx')) return;
  if (e.target.closest('.ck')) {
    const i = +li.dataset.i, r = rec(view.cur), was = mem(view.cur) === Q[view.cur - 1].v.length;
    bump(setAyah(view.cur, i, !(r && r.m[i] === '1'))); save(); renderSurah(false); refreshStats(); checkCompleted(view.cur, was);
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
initKids(); onKidsChange(render); initPlayer(); initPwa();
startRouter();
loadQuran().then(() => { render(); motionReady(); route() })
  .catch(() => { $('list').innerHTML = '<li class="empty">تعذّر تحميل نص المصحف. أعد فتح الصفحة للمحاولة مرة أخرى.</li>' });
