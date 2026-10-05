// A guided memorising session: the child picks a few ayat of a surah and is walked through them one at a time.
// For each ayah: listen three times, read it, then recite it from memory (the text is blurred except its first word),
// reveal it and say honestly whether it was right. After all of them, recite them together. Only ayat the child says
// they got right are marked as memorised. The ayat are shown exactly as in quran.json; blurring is only CSS.
import { $, AR, ayahs, el, charImg } from './util.js';
import { Q } from './data.js';
import { rec, friendOf, activeKid } from './state.js';
import { ayahUrl } from './player.js';
import { sfx } from './sound.js';
import { registerAudio, takeAudio } from './audiobus.js';

const LISTENS = 3;
export const COUNTS = [1, 2, 3, 5];

/** The session as a small state machine, kept separate from the screen so it can be tested on its own. */
export const startState = (id, from, count) => ({ id, from, count, pos: 0, step: 'listen', retries: 0, marked: 0, done: false });

/** Moves on. action: 'next' (listen, read), 'good' / 'again' (recite, together). Returns a new state; mark is the ayah index to mark as memorised. */
export function advance(st, action) {
  const s = { ...st, mark: null };
  if (st.step === 'listen' && action === 'next') s.step = 'read';
  else if (st.step === 'read' && action === 'next') s.step = 'recite';
  else if (st.step === 'recite' && action === 'good') {
    s.mark = st.from + st.pos; s.marked = st.marked + 1; s.pos = st.pos + 1;
    if (s.pos < st.count) s.step = 'listen';
    else if (st.count > 1) { s.step = 'together'; s.pos = 0 }
    else s.done = true;
  } else if (st.step === 'recite' && action === 'again') { s.step = 'listen'; s.retries = st.retries + 1 }
  else if (st.step === 'together' && action === 'good') s.done = true;
  return s;
}

/** The first ayah that is not memorised yet (or the first one), where a session usually starts. */
export function suggestedStart(id) {
  const r = rec(id), len = Q[id - 1].v.length;
  if (!r) return 0;
  const i = [...r.m].findIndex(c => c !== '1');
  return i < 0 ? 0 : i;
}

let st = null, setup = { id: 0, from: 0, count: 3 }, onMark = () => {}, player = null;
export const initSession = opts => { onMark = (opts && opts.mark) || onMark; const d = $('session'); if (d) d.addEventListener('close', () => { stopAudio(); st = null }) };

registerAudio('session', () => stopAudio());
function stopAudio() { if (player) { try { player.pause() } catch (e) {} player.onended = player.onerror = null; player = null } }

/** Plays one ayah n times in a row, reporting how many have finished. Resolves to 'done' or 'error'. */
function playTimes(url, n, onCount) {
  stopAudio();
  return new Promise(res => {
    takeAudio('session');   // the surah player is silenced first: never two recitations at once
    let k = 0; const a = player = new Audio(url);
    a.onended = () => { k++; onCount(k); if (k >= n) { player = null; res('done') } else { a.currentTime = 0; a.play().catch(() => res('error')) } };
    a.onerror = () => { player = null; res('error') };
    a.play().catch(() => res('error'));
  });
}

export function openSession(id) {
  if (!Q[id - 1] || !activeKid()) return;
  const len = Q[id - 1].v.length;
  setup = { id, from: suggestedStart(id), count: Math.min(len, activeKid().mode === 'young' ? 2 : 3) };
  st = null; renderSetup(); $('session').showModal();
}

function renderSetup() {
  const body = $('sessBody'); body.textContent = '';
  const { id } = setup, c = Q[id - 1], len = c.v.length;
  setup.count = Math.min(setup.count, len - setup.from);
  const pic = charImg(friendOf(), 'big'); pic.width = pic.height = 110;
  body.append(pic, el('h2', '', 'جلسة حفظ · سورة ' + c.n), el('p', 'note', 'نمشي معًا خطوة بخطوة: استمع، اقرأ، ثم سمّع من حفظك. تُعلَّم الآية محفوظة فقط إن قلتَ إنك أصبتَ.'));
  const lab = el('label', '', 'ابدأ من الآية'); lab.setAttribute('for', 'sessFrom');
  const sel = el('select', 'search'); sel.id = 'sessFrom';
  for (let i = 0; i < len; i++) { const o = el('option', '', AR(i + 1)); o.value = String(i); sel.appendChild(o) }
  sel.value = String(setup.from);
  const cnt = el('div', 'icons'); cnt.setAttribute('role', 'group'); cnt.setAttribute('aria-label', 'عدد الآيات');
  const paintCounts = () => { cnt.textContent = ''; COUNTS.filter(n => n <= len - setup.from).forEach(n => {
    const b = el('button', 'chip', ayahs(n)); b.type = 'button'; b.setAttribute('aria-pressed', n === setup.count);
    b.addEventListener('click', () => { setup.count = n; paintCounts() }); cnt.appendChild(b) }) };
  sel.addEventListener('change', () => { setup.from = Number(sel.value); setup.count = Math.min(setup.count, len - setup.from) || 1; paintCounts() });
  paintCounts();
  const go = el('button', 'btn primary', 'يلا نبدأ!'); go.type = 'button'; go.addEventListener('click', () => { st = startState(id, setup.from, setup.count); sfx('tap'); renderStep() });
  const close = el('button', 'btn', 'إغلاق'); close.type = 'button'; close.addEventListener('click', () => $('session').close());
  const acts = el('div', 'acts'); acts.append(go, close);
  body.append(lab, sel, el('p', 'note', 'كم آية في هذه الجلسة؟'), cnt, acts);
  sel.focus();
}

/** The text of an ayah with everything but its first word blurred (the words stay, only the look changes). */
function veiled(text, open) {
  const words = text.trim().split(/\s+/), p = el('p', 'sesstx tx' + (open ? '' : ' veil'));
  words.forEach((w, i) => { const s = el('span', i === 0 ? '' : 'sw', w + (i < words.length - 1 ? ' ' : '')); p.appendChild(s) });
  return p;
}

function renderStep() {
  const body = $('sessBody'); body.textContent = '';
  stopAudio();
  const c = Q[st.id - 1];
  if (st.done) return renderDone();
  const idx = st.step === 'together' ? null : st.from + st.pos;
  const total = st.count * 3 + (st.count > 1 ? 1 : 0), doneSteps = st.pos * 3 + ({ listen: 0, read: 1, recite: 2, together: 0 })[st.step] + (st.step === 'together' ? st.count * 3 : 0);
  const head = el('p', 'note sesshead', st.step === 'together' ? 'سورة ' + c.n + ' · الآيات ' + AR(st.from + 1) + ' إلى ' + AR(st.from + st.count) : 'سورة ' + c.n + ' · الآية ' + AR(idx + 1) + ' (' + AR(st.pos + 1) + ' من ' + AR(st.count) + ')');
  const bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.round(doneSteps / total * 100) + '%'; bar.append(fill);
  bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(total)); bar.setAttribute('aria-valuenow', String(doneSteps)); bar.setAttribute('aria-label', 'تقدّم الجلسة');
  body.append(head, bar);
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const acts = el('div', 'acts');
  const text = k => c.v[k];
  const step = (title, hint) => { body.append(el('h2', 'sesstitle', title), el('p', 'sesshint', hint)) };

  if (st.step === 'listen') {
    step('١. استمع', 'استمع للآية ' + AR(LISTENS) + ' مرات وانظر إلى الكلمات.');
    body.appendChild(veiled(text(idx), true));
    const play = el('button', 'btn primary', '▶ استمع'); play.type = 'button';
    const next = el('button', 'btn', 'التالي'); next.type = 'button';
    play.addEventListener('click', async () => {
      play.disabled = true; msg.textContent = 'جارٍ التشغيل…';
      const r = await playTimes(ayahUrl(st.id, idx + 1), LISTENS, n => { msg.textContent = 'سمعتَها ' + AR(n) + ' من ' + AR(LISTENS) });
      play.disabled = false;
      if (r === 'error') msg.textContent = 'تعذّر تشغيل الصوت (تحقق من الإنترنت). يمكنك قراءتها بنفسك والمتابعة.';
      else { msg.textContent = 'أحسنت! سمعتَها ' + AR(LISTENS) + ' مرات.'; next.classList.add('primary'); next.focus() }
    });
    next.addEventListener('click', () => { st = advance(st, 'next'); renderStep() });
    acts.append(play, next); body.append(acts, msg); play.focus();
  } else if (st.step === 'read') {
    step('٢. اقرأ', 'اقرأ الآية بصوتك وأنت تنظر إليها.');
    body.appendChild(veiled(text(idx), true));
    const ok = el('button', 'btn primary', 'قرأتُها'); ok.type = 'button'; ok.addEventListener('click', () => { st = advance(st, 'next'); renderStep() });
    acts.appendChild(ok); body.appendChild(acts); ok.focus();
  } else {
    const together = st.step === 'together';
    step(together ? '٤. سمّع الآيات معًا' : '٣. سمّع من حفظك', together ? 'قل الآيات كلها بالترتيب من حفظك، ثم اكشفها وتحقّق.' : 'قل الآية من حفظك (تظهر لك أول كلمة فقط)، ثم اكشفها وتحقّق.');
    const box = el('div', 'sessbox');
    const lines = together ? Array.from({ length: st.count }, (_, k) => st.from + k) : [idx];
    const ps = lines.map(k => { const p = veiled(text(k), false); box.appendChild(p); return p });
    body.appendChild(box);
    const show = el('button', 'btn primary', 'أظهر الآية'); show.type = 'button';
    const good = el('button', 'btn primary', 'أصبتُ ✅'); good.type = 'button';
    const again = el('button', 'btn', 'أحتاج إعادة 🔁'); again.type = 'button';
    good.hidden = again.hidden = true;
    show.addEventListener('click', () => { ps.forEach(p => p.classList.remove('veil')); show.hidden = true; good.hidden = again.hidden = false; msg.textContent = 'هل قلتها صحيحة؟ كن صادقًا مع نفسك.'; good.focus() });
    good.addEventListener('click', () => {
      const prev = st; st = advance(st, 'good');
      if (prev.step === 'recite') { sfx('star'); onMark(st.id, prev.from + prev.pos) }
      renderStep();
    });
    again.addEventListener('click', () => {
      st = advance(st, 'again');
      if (together) { ps.forEach(p => p.classList.add('veil')); show.hidden = false; good.hidden = again.hidden = true; msg.textContent = 'كرّرها من حفظك مرة أخرى ثم اكشفها.'; show.focus(); return }
      renderStep();
    });
    acts.append(show, good, again); body.append(acts, msg); show.focus();
  }
  const quit = el('button', 'btn sessquit', 'إنهاء الجلسة'); quit.type = 'button'; quit.addEventListener('click', () => $('session').close());
  body.appendChild(quit);
}

function renderDone() {
  const body = $('sessBody'); body.textContent = '';
  const c = Q[st.id - 1];
  const pic = charImg(friendOf(), 'big'); pic.width = pic.height = 120; sfx('win');
  body.append(pic, el('h2', '', st.marked ? 'أحسنت! حفظتَ ' + ayahs(st.marked) + ' 🎉' : 'انتهت الجلسة'),
    el('p', 'note', st.marked ? 'سورة ' + c.n + ': علّمتُ لك ما أصبتَ فيه كمحفوظ، وسيأتيك موعد مراجعته.' : 'لا بأس، كرّرها كل يوم قليلًا وستحفظها بإذن الله.'));
  const more = el('button', 'btn primary', 'جلسة أخرى'); more.type = 'button';
  more.addEventListener('click', () => { setup.from = Math.min(st.from + st.count, Q[st.id - 1].v.length - 1); setup.id = st.id; st = null; renderSetup() });
  const close = el('button', 'btn', 'إغلاق'); close.type = 'button'; close.addEventListener('click', () => $('session').close());
  const acts = el('div', 'acts'); acts.append(more, close); body.appendChild(acts); more.focus();
}
