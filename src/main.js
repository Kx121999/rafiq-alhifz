import './styles.css';
import { $, days } from './util.js';
import { Q, loadQuran } from './data.js';
import { S, save, rec, mem, isDue, bump, setAyah, grade } from './state.js';
import { renderSummary, renderList, setFilter } from './home.js';
import { view, renderSurah, toggleTafsir } from './surah.js';
import { initKids, onKidsChange, renderRewards, applyMode } from './kids.js';

function render() { if (!Q.length) return; applyMode(); renderSummary(); renderRewards(); renderList(); if (view.cur) renderSurah(false) }

function open(id) { view.cur = id; view.veil = isDue(id); $('home').hidden = true; $('surah').hidden = false; renderSurah(true); window.scrollTo(0, 0) }
function close() { view.cur = 0; $('surah').hidden = true; $('home').hidden = false; render() }

/* ---------- index ---------- */
$('list').addEventListener('click', e => { const b = e.target.closest('.row'); if (b) open(+b.dataset.id) });
$('q').addEventListener('input', renderList);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return; setFilter(b.dataset.f);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b)); renderList();
});
$('gMinus').addEventListener('click', () => { S.goal = Math.max(1, S.goal - 1); save(); renderSummary() });
$('gPlus').addEventListener('click', () => { S.goal = Math.min(50, S.goal + 1); save(); renderSummary() });

/* ---------- surah ---------- */
$('back').addEventListener('click', close);
$('veilBtn').addEventListener('click', () => { view.veil = !view.veil; $('ayat').querySelectorAll('.shown').forEach(x => x.classList.remove('shown')); renderSurah(false) });
$('allBtn').addEventListener('click', () => {
  const tot = Q[view.cur - 1].v.length, on = mem(view.cur) !== tot; let d = 0;
  for (let i = 0; i < tot; i++) d += setAyah(view.cur, i, on);
  bump(d); save(); renderSurah(false); renderSummary(); renderRewards();
});
$('ayat').addEventListener('click', e => {
  const li = e.target.closest('.ay'); if (!li) return;
  if (e.target.closest('.tf')) { toggleTafsir(li); return }
  if (e.target.closest('.tfx')) return;
  if (e.target.closest('.ck')) { const i = +li.dataset.i, r = rec(view.cur); bump(setAyah(view.cur, i, !(r && r.m[i] === '1'))); save(); renderSurah(false); renderSummary(); renderRewards() }
  else if (view.veil) li.classList.toggle('shown');
});
$('ayat').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tx') && view.veil) { e.preventDefault(); e.target.closest('.ay').classList.toggle('shown') }
});
function onGrade(good) {
  const i = grade(view.cur, good); if (i == null) return;
  renderSurah(false); renderSummary();
  $('revText').textContent = (good ? 'أحسنت. ' : 'لا بأس، كرّرها اليوم. ') + 'المراجعة القادمة بعد ' + days(i) + '.';
}
$('revGood').addEventListener('click', () => onGrade(true));
$('revBad').addEventListener('click', () => onGrade(false));

/* ---------- boot ---------- */
initKids(); onKidsChange(render);
loadQuran().then(render)
  .catch(() => { $('list').innerHTML = '<li class="empty">تعذّر تحميل نص المصحف. أعد فتح الصفحة للمحاولة مرة أخرى.</li>' });
