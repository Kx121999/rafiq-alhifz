import './styles.css';
import { $, AR, days } from './util.js';
import { Q, loadQuran } from './data.js';
import { S, save, rec, mem, isDue, bump, setAyah, grade, setLast, activeKid, isWeak, setWeak, weakList, azToday, surahSnapshot, restoreSurah } from './state.js';
import { initGuard, offerUndo, clearUndo } from './guard.js';
import { renderSummary, renderList, setFilter } from './home.js';
import { view, renderSurah, toggleTafsir } from './surah.js';
import { go, onPage, onShown, startRouter, route } from './router.js';
import { pageIn, revealAyah, celebrate, markPop, markWave, motionReady, initCharacters } from './motion.js';
import { initPlayer, loadSurah, playFrom, stopPlayer } from './player.js';
import { initPwa } from './pwa.js';
import { initSearch, openSearch } from './search.js';
import { renderReport } from './report.js';
import { shareReport } from './reportcard.js';
import { initTour, needsTour, openTour } from './tour.js';
import { renderToday } from './dashboard.js';
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
import { renderReview, renderWeak, onReviewGraded, clearReviewNote, dueList } from './review.js';
import { renderPlan, onPlanChanged } from './plan.js';
import { renderGames, onGameStars, resetGame } from './games.js';
import { renderAchievements, renderCertificate } from './achievements.js';
import { initKids, onKidsChange, renderRewards, renderKidBar, applyMode, announceBadges } from './kids.js';

function render() {
  if (!Q.length) return;
  applyMode(); renderSummary(); renderToday(); renderRewards(); renderList(); renderReview(); renderWeak(); renderPlan(); updateDue(); renderAchievements();
  if (!$('page-games').hidden) renderGames();
  refreshAdhkar(); checkChallenge(); refreshCompanion(); recordRamadan();
  for (const [id, fn] of [['shop', renderShop], ['challenge', renderChallenge], ['share', renderShare], ['family', renderFamily], ['ramadan', renderRamadan]]) if (!$('page-' + id).hidden) fn();
  if (view.cur) renderSurah(false);
}
function updateDue() {
  const n = dueList().length + weakList().length, c = $('dueCount');
  c.textContent = AR(n); c.hidden = !n; c.setAttribute('aria-label', AR(n) + ' للمراجعة');
}
const refreshStats = () => { checkChallenge(); renderSummary(); renderToday(); renderRewards(); updateDue(); announceBadges() };

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
  pageIn(page); companionPage(page);
  if (page !== 'adhkar') setFocusRead(false);
  if (page !== 'surah') stopPlayer(); else setTimeout(jumpToAyah, 450);
  if (page === 'search' && !$('sq').value) $('sq').focus();
});
onPage('report', arg => { view.cur = 0; if (Q.length) renderReport(+arg || 0) });
onPage('search', arg => { view.cur = 0; openSearch(arg) });
onPage('surah', (arg, ayah) => {
  clearUndo();
  const id = +arg; if (!(id >= 1 && id <= 114)) return false;
  if (!Q.length) { view.cur = 0; return }   // quran.json still loading: boot re-routes once it arrives
  view.cur = id; view.veil = isDue(id); setLast(id); renderSurah(true); loadSurah(id); renderOffline(id);
  pendingAyah = +ayah >= 1 && +ayah <= Q[id - 1].v.length ? +ayah : 0;
  document.title = 'سورة ' + Q[id - 1].n + ' · رفيق الحفظ';
});
for (const p of ['home', 'about']) onPage(p, () => { view.cur = 0 });
onPage('review', () => { view.cur = 0; clearReviewNote(); render() });
onPage('plan', () => { view.cur = 0; render() });
onPage('adhkar', arg => { view.cur = 0; renderAdhkar(arg) });
onPage('shop', () => { view.cur = 0; renderShop() });
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
} });
onPage('check', () => { view.cur = 0 });
initCheck();
$('printFamily').addEventListener('click', () => window.print());
onPage('games', () => { view.cur = 0; resetGame(); render(); renderGames() });
onPage('achievements', () => { view.cur = 0; render() });
onPage('certificate', arg => {
  view.cur = 0; if (!Q.length) return;
  if (!renderCertificate(+arg)) return '/achievements';
  document.title = 'شهادة سورة ' + Q[+arg - 1].n + ' · رفيق الحفظ';
});
onGameStars(() => { checkChallenge(); renderRewards(); renderAchievements(); announceBadges() });
$('printCert').addEventListener('click', () => window.print());
$('printReport').addEventListener('click', () => window.print());
$('shareReport').addEventListener('click', async () => {
  const r = await shareReport();
  $('shareReportMsg').textContent = ({ shared: 'تمت المشاركة.', saved: 'تم حفظ صورة التقرير على جهازك.', cancelled: '', unsupported: 'تعذّر رسم الصورة في هذا المتصفح. استخدم «طباعة التقرير» واحفظه PDF.' })[r];
});
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
/** Puts a surah back as it was (after "undo"), with the daily count and the lists redrawn. */
function undoSurah(id, snap, delta) { restoreSurah(id, snap); bump(-delta); save(); if (view.cur === id) renderSurah(false); refreshStats() }

$('allBtn').addEventListener('click', () => {
  const id = view.cur, c = Q[id - 1], tot = c.v.length, was = mem(id) === tot, on = !was;
  // a change to the whole surah at once is asked about first, and can be taken back
  const ask = on ? 'هل حفظتَ كل آيات سورة ' + c.n + ' (' + AR(tot) + ' آية)؟ ستُعلَّم كلها محفوظة.' : 'إلغاء حفظ سورة ' + c.n + ' كلها؟ سيُمسح تعليم ' + AR(mem(id)) + ' آية.';
  if (!confirm(ask)) return;
  const snap = surahSnapshot(id); let d = 0;
  for (let i = 0; i < tot; i++) d += setAyah(id, i, on);
  bump(d); save(); renderSurah(false); refreshStats(); checkCompleted(id, was);
  if (on) markWave(document.querySelectorAll('#ayat .ck'));
  if (d) offerUndo(on ? 'عُلّمت سورة ' + c.n + ' كاملة.' : 'أُلغي حفظ سورة ' + c.n + '.', () => undoSurah(id, snap, d));
});
$('ayat').addEventListener('click', e => {
  const li = e.target.closest('.ay'); if (!li) return;
  if (e.target.closest('.wk')) { const i = +li.dataset.i; setWeak(view.cur, i, !isWeak(view.cur, i)); save(); renderSurah(false); refreshStats(); return }
  if (e.target.closest('.pl')) { playFrom(+li.dataset.i); return }
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
function onGrade(good) {
  const i = grade(view.cur, good); if (i == null) return;
  renderSurah(false); refreshStats();
  $('revText').textContent = (good ? 'أحسنت. ' : 'لا بأس، كرّرها اليوم. ') + 'المراجعة القادمة بعد ' + days(i) + '.';
}
$('revGood').addEventListener('click', () => onGrade(true));
$('revBad').addEventListener('click', () => onGrade(false));

/* ---------- boot ---------- */
initGuard(); initCharacters(); initKids(); initReading(); initCompanion(); onKidsChange(render); initTour({ onDone: () => { renderKidBar(); render() } }); initPlayer(); initPwa(); initSearch();
setReminderContext(() => ({ reviewDue: Q.length ? dueList().length + weakList().length : 0, adhkarDone: id => azToday(id).d === 1 }));
startRouter();
loadQuran().then(() => { render(); initReminders(); announceBadges(); motionReady(); route(); if (needsTour()) openTour() })
  .catch(() => { $('list').innerHTML = '<li class="empty">تعذّر تحميل نص المصحف. أعد فتح الصفحة للمحاولة مرة أخرى.</li>' });
