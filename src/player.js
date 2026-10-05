// In-page audio player. Recitations come from everyayah.com, one mp3 per ayah, so a surah plays ayah by ayah,
// any ayah can be repeated for memorising, and the page can highlight what is playing. Nothing is hosted here.
import { $, AR, el, icon } from './util.js';
import { registerAudio, takeAudio } from './audiobus.js';
import { Q } from './data.js';

const BASE = 'https://everyayah.com/data/';
/** Reciters whose files were checked one by one (basmala, first and last ayat of several surahs). */
export const RECITERS = [
  { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' },
  { id: 'Husary_Muallim_128kbps', name: 'محمود خليل الحصري (المعلّم)' },
  { id: 'Husary_128kbps', name: 'محمود خليل الحصري (مرتّل)' },
  { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي (مرتّل)' },
  { id: 'Abdul_Basit_Murattal_192kbps', name: 'عبد الباسط عبد الصمد (مرتّل)' },
  { id: 'MaherAlMuaiqly128kbps', name: 'ماهر المعيقلي' },
  { id: 'Abu_Bakr_Ash-Shaatree_128kbps', name: 'أبو بكر الشاطري' },
  { id: 'Saood_ash-Shuraym_128kbps', name: 'سعود الشريم' },
];
const REPEATS = [1, 3, 5], SPEEDS = [0.75, 1, 1.25], GAPS = [0, 2, 4, 6];
const KEY = { reciter: 'hifz-reciter', repeat: 'hifz-repeat', speed: 'hifz-speed', gap: 'hifz-gap' };

const read = (k, ok, dflt) => { try { const v = JSON.parse(localStorage.getItem(k)); return ok(v) ? v : dflt } catch (e) { return dflt } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} };

const pref = {
  reciter: read(KEY.reciter, v => RECITERS.some(r => r.id === v), RECITERS[0].id),
  repeat: read(KEY.repeat, v => REPEATS.includes(v), 1),
  speed: read(KEY.speed, v => SPEEDS.includes(v), 1),
  gap: read(KEY.gap, v => GAPS.includes(v), 0),   // seconds of silence after each ayah, to recite it from memory before the next one
};

const pad = (n, w) => String(n).padStart(w, '0');
const srcOf = (surah, ayah) => BASE + pref.reciter + '/' + pad(surah, 3) + pad(ayah, 3) + '.mp3';
/** The recitation file of one ayah with the chosen reciter (used by the device check to test sound). */
export const ayahUrl = srcOf;
/** The same file for any reciter, and whether a surah starts with the separate basmala recording (all but Al-Fatiha and At-Tawbah). */
export const urlFor = (reciter, surah, ayah) => BASE + reciter + '/' + pad(surah, 3) + pad(ayah, 3) + '.mp3';
export const needsBasmala = surah => surah !== 1 && surah !== 9;
export const currentReciter = () => pref.reciter;
export const reciterLabel = id => (RECITERS.find(r => r.id === id) || { name: id }).name;

const audio = new Audio();
audio.preload = 'auto';
const warm = new Audio(); warm.preload = 'auto';   // fetches the next ayah ahead of time

/** surah: open surah id, pos: 0-based ayah, rep: current repetition, pre: basmala is playing, key: what audio currently holds,
    range: {a, b} (0-based, inclusive) when a passage is being repeated, wait: in the silent gap between ayat. */
const st = { surah: 0, n: 0, pos: 0, rep: 1, pre: false, key: '', range: null, wait: false };
let ui = null, gapTimer = 0, posCb = () => {};
/** Called with (surah, ayah index) whenever playback reaches an ayah, so the page can remember where the child is. */
export const onPlayerPos = fn => { posCb = fn };
const clearGap = () => { clearTimeout(gapTimer); gapTimer = 0; st.wait = false };

const hasBasmala = () => st.surah !== 1 && st.surah !== 9;
const reciterName = () => (RECITERS.find(r => r.id === pref.reciter) || RECITERS[0]).name;
const currentSrc = () => st.pre ? srcOf(1, 1) : srcOf(st.surah, st.pos + 1);

function say(msg) { ui.status.textContent = msg || '' }

function paint() {
  if (!ui) return;
  const playing = st.wait || (!audio.paused && !audio.ended);
  ui.play.replaceChildren(icon(playing ? 'pause' : 'play'));
  ui.play.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
  ui.label.textContent = st.surah ? 'سورة ' + Q[st.surah - 1].n + ' · ' + (st.pre ? 'البسملة' : 'الآية ' + AR(st.pos + 1) + ' من ' + AR(st.n)) : '';
  ui.seek.max = st.n; ui.seek.value = st.pos + 1;
  ui.seek.setAttribute('aria-valuetext', 'الآية ' + AR(st.pos + 1) + ' من ' + AR(st.n));
  document.querySelectorAll('#ayat .ay.playing').forEach(x => x.classList.remove('playing'));
  const li = playing && !st.pre && document.querySelector('#ayat .ay[data-i="' + st.pos + '"]');
  if (li) {
    li.classList.add('playing');
    const r = li.getBoundingClientRect();
    if (r.top < 110 || r.bottom > innerHeight - 190) li.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function playCurrent() {
  clearGap(); takeAudio('player');
  st.key = currentSrc(); audio.src = st.key;
  audio.defaultPlaybackRate = audio.playbackRate = pref.speed;
  say(pref.repeat > 1 && !st.pre ? 'التكرار ' + AR(st.rep) + ' من ' + AR(pref.repeat) : '');
  const p = audio.play();
  if (p) p.catch(e => { if (e && e.name === 'AbortError') return; fail() });
  if (!st.pre && st.pos + 1 < st.n) warm.src = srcOf(st.surah, st.pos + 2);
  if (!st.pre) posCb(st.surah, st.pos);
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'سورة ' + Q[st.surah - 1].n + (st.pre ? ' · البسملة' : ' · الآية ' + (st.pos + 1)), artist: reciterName(), album: 'رفيق الحفظ' }) } catch (e) {}
  }
  paint();
}

function fail() {
  audio.pause(); st.key = '';
  say('تعذّر تشغيل الصوت. تحقّق من اتصالك بالإنترنت أو جرّب قارئًا آخر، أو استمع على Quran.com.');
  paint();
}

function goTo(pos, autoplay) {
  clearGap();
  st.pos = Math.max(0, Math.min(st.n - 1, pos)); st.rep = 1; st.pre = false;
  if (autoplay) playCurrent(); else { audio.pause(); st.key = ''; paint() }
}

function toggle() {
  if (!st.surah) return;
  if (st.wait) { clearGap(); say(''); paint(); return }   // pause during the silent gap: the next ayah is ready, play starts it
  if (!audio.paused) { audio.pause(); return }
  // fresh start from the first ayah: begin with the basmala, as it is recited before every surah
  if (!st.key && st.pos === 0 && st.rep === 1 && hasBasmala()) st.pre = true;
  if (st.key === currentSrc() && audio.src) { const p = audio.play(); if (p) p.catch(e => { if (e && e.name !== 'AbortError') fail() }); paint() } else playCurrent();
}

/** What comes after an ayah finished: its next repetition, the next ayah, the start of the repeated passage, or the end. Returns false at the end. */
function advance() {
  if (st.rep < pref.repeat) { st.rep++; return true }
  st.rep = 1;
  if (st.range && st.pos >= st.range.b) { st.pos = st.range.a; return true }
  if (st.pos + 1 < st.n) { st.pos++; return true }
  return false;
}
audio.addEventListener('ended', () => {
  if (st.pre) { st.pre = false; return playCurrent() }
  if (!advance()) { st.pos = 0; st.rep = 1; st.key = ''; say('انتهت السورة.'); paint(); ui.bar.style.width = '0%'; return }
  if (!pref.gap) return playCurrent();
  st.wait = true; say('وقفة ' + AR(pref.gap) + ' ثوانٍ: سمّع الآية من حفظك'); paint();
  gapTimer = setTimeout(() => { gapTimer = 0; st.wait = false; playCurrent() }, pref.gap * 1000);
});
audio.addEventListener('error', () => { if (audio.getAttribute('src')) fail() });
audio.addEventListener('play', paint);
audio.addEventListener('pause', paint);
audio.addEventListener('timeupdate', () => { if (ui && audio.duration) ui.bar.style.width = (audio.currentTime / audio.duration * 100).toFixed(1) + '%' });

/** Build the player into #player once. */
export function initPlayer() {
  const box = $('player');
  const prev = el('button', 'btn pl-step'), play = el('button', 'pl-play'), next = el('button', 'btn pl-step');
  prev.append(icon('back')); next.append(icon('forward')); play.append(icon('play'));
  [prev, play, next].forEach(b => { b.type = 'button' });
  prev.setAttribute('aria-label', 'الآية السابقة'); next.setAttribute('aria-label', 'الآية التالية');
  const label = el('span', 'pl-label'), row = el('div', 'pl-row');
  const tog = el('button', 'btn pl-step'); tog.append(icon('more')); tog.type = 'button'; tog.id = 'plToggle';
  tog.setAttribute('aria-expanded', 'false'); tog.setAttribute('aria-controls', 'plMore'); tog.setAttribute('aria-label', 'المزيد: الانتقال بين الآيات والقارئ والتكرار والسرعة');
  row.append(play, label, prev, next, tog);
  const seek = el('input'); seek.type = 'range'; seek.min = 1; seek.step = 1; seek.setAttribute('aria-label', 'الانتقال بين آيات السورة');
  const barWrap = el('div', 'pl-bar'), bar = el('i'); barWrap.appendChild(bar);
  const status = el('p', 'note pl-status'); status.setAttribute('role', 'status');

  const select = (label, opts, cur, fmt, onPick) => {
    const lab = el('label', 'pl-field'), s = el('select');
    s.setAttribute('aria-label', label);
    opts.forEach(o => { const op = el('option', '', fmt(o)); op.value = o.id ?? o; s.appendChild(op) });
    s.value = cur; s.addEventListener('change', () => onPick(s.value));
    lab.append(el('span', 'note', label), s); return lab;
  };
  const sets = el('details', 'pl-set'); sets.appendChild(el('summary', '', 'القارئ والتكرار والسرعة'));
  const fields = el('div', 'pl-fields');
  fields.append(
    select('القارئ', RECITERS, pref.reciter, r => r.name, v => {
      pref.reciter = v; write(KEY.reciter, v); document.dispatchEvent(new Event('hifz-reciter'));
      const was = !audio.paused; st.key = ''; warm.removeAttribute('src');
      if (st.surah && was) playCurrent(); else { audio.pause(); paint() }
    }),
    select('تكرار الآية', REPEATS, pref.repeat, n => n === 1 ? 'مرة واحدة' : AR(n) + ' مرات', v => { pref.repeat = +v; write(KEY.repeat, +v); st.rep = 1; say('') }),
    select('السرعة', SPEEDS, pref.speed, n => AR(n) + '×', v => { pref.speed = +v; write(KEY.speed, +v); audio.defaultPlaybackRate = audio.playbackRate = +v }),
    select('وقفة بعد كل آية', GAPS, pref.gap, n => n ? AR(n) + ' ثوانٍ' : 'بدون وقفة', v => { pref.gap = +v; write(KEY.gap, +v); if (!+v) clearGap(); say('') }));
  // repeat a passage: from one ayah to another, over and over until stopped
  const rf = el('select'), rt = el('select'), rb = el('button', 'btn', 'كرّر المقطع'); rb.type = 'button'; rb.id = 'plRange'; rb.setAttribute('aria-pressed', 'false');
  rf.setAttribute('aria-label', 'من الآية'); rt.setAttribute('aria-label', 'إلى الآية'); rf.id = 'plFrom'; rt.id = 'plTo';
  const rangeBox = el('div', 'pl-range'); rangeBox.append(el('span', 'note', 'مقطع للتكرار'), rf, el('span', 'note', 'إلى'), rt, rb);
  const fill = () => { for (const sel of [rf, rt]) { sel.textContent = ''; for (let i = 0; i < st.n; i++) { const o = el('option', '', AR(i + 1)); o.value = String(i); sel.appendChild(o) } } rt.value = String(Math.max(0, st.n - 1)) };
  const setRange = () => {
    const a = +rf.value, b = +rt.value;
    if (rb.getAttribute('aria-pressed') !== 'true') return;
    if (b < a) { st.range = null; rb.setAttribute('aria-pressed', 'false'); say('اختر آية البداية قبل آية النهاية.'); return }
    st.range = { a, b }; say('سيتكرر المقطع من الآية ' + AR(a + 1) + ' إلى ' + AR(b + 1));
  };
  rb.addEventListener('click', () => {
    const on = rb.getAttribute('aria-pressed') !== 'true';
    rb.setAttribute('aria-pressed', String(on));
    if (!on) { st.range = null; say('توقّف تكرار المقطع.'); return }
    setRange();
    if (st.range) goTo(st.range.a, true);
  });
  rf.addEventListener('change', setRange); rt.addEventListener('change', setRange);
  fields.appendChild(rangeBox);
  ui = { fillRange: () => { fill(); rb.setAttribute('aria-pressed', 'false') } };
  sets.appendChild(fields);
  const more = el('div', 'pl-more'); more.id = 'plMore'; more.hidden = true; more.append(seek, sets);
  tog.addEventListener('click', () => { more.hidden = !more.hidden; tog.setAttribute('aria-expanded', String(!more.hidden)) });
  box.append(row, barWrap, status, more);
  Object.assign(ui, { play, label, seek, bar, status });

  play.addEventListener('click', toggle);
  prev.addEventListener('click', () => { if (st.pre) return playCurrent(); goTo(st.pos - 1, !audio.paused) });
  next.addEventListener('click', () => { if (st.pre) { st.pre = false; return playCurrent() } goTo(st.pos + 1, !audio.paused) });
  seek.addEventListener('input', () => goTo(+seek.value - 1, !audio.paused));

  if ('mediaSession' in navigator) {
    const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f) } catch (e) {} };
    h('play', toggle); h('pause', () => audio.pause());
    h('previoustrack', () => prev.click()); h('nexttrack', () => next.click());
  }
}

/** Called when a surah page opens. Keeps playing if it is the same surah, otherwise stops and resets. */
export function loadSurah(id, start = 0) {
  if (!ui || !Q.length || id === st.surah) return;
  stopPlayer();
  st.surah = id; st.n = Q[id - 1].v.length; st.range = null; st.rep = 1; st.pre = false; st.key = '';
  st.pos = Number.isInteger(start) && start >= 0 && start < st.n ? start : 0;   // the child's last place, shown but never played by itself
  ui.fillRange(); ui.bar.style.width = '0%'; say(''); paint();
}

/** Starts playing from a given ayah (0-based) — used by the per-ayah listen buttons. */
export function playFrom(i) { if (st.surah) goTo(i, true) }

export function stopPlayer() {
  clearGap(); audio.pause(); audio.removeAttribute('src'); audio.load(); warm.removeAttribute('src');
  st.key = ''; st.pre = false; st.rep = 1;
  if (ui) { ui.bar.style.width = '0%'; paint() }
}

/** The surah the player is attached to (0 when none). */
export const playerSurah = () => st.surah;

registerAudio('player', () => { clearGap(); audio.pause(); paint() });
