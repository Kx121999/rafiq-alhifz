// Six memorisation games. Every question is built from ayat the child marked as memorised;
// wrong options are real words or endings taken from other ayat in quran.json. Nothing is generated.
import { $, AR, ayahs, el, norm, nujum, icon } from './util.js';
import { Q } from './data.js';
import { S, activeKid, addGameStars } from './state.js';
import { correct, wrong } from './motion.js';

const ROUNDS = 5, PUZZLES = 3;
const LETTER = /[ء-يٱ-ۓ]/;
const words = t => t.trim().split(/\s+/).filter(w => LETTER.test(w));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r };
const randomAyah = () => { const id = 1 + Math.floor(Math.random() * 114), c = Q[id - 1], i = Math.floor(Math.random() * c.v.length); return { id, i, t: c.v[i] } };
const young = () => (activeKid() || {}).mode === 'young';

/** A trial uses a few short surahs, taken from the mushaf text itself, as if they were memorised. Nothing from a trial is saved or counted. */
const TRIAL_IDS = [108, 109, 110, 111, 112, 113, 114];
const trialSource = () => Object.fromEntries(TRIAL_IDS.map(id => [id, { m: '1'.repeat(Q[id - 1].v.length) }]));
let G = null;
const source = () => (G && G.trial ? trialSource() : S.s);

/** Every ayah the active child has marked as memorised. */
export function memorisedPool() {
  const out = [];
  for (const [key, r] of Object.entries(source())) {
    const id = +key;
    for (let i = 0; i < r.m.length; i++) if (r.m[i] === '1') out.push({ id, i, t: Q[id - 1].v[i] });
  }
  return out;
}

/** Windows of three consecutive memorised ayat within one surah (for the ordering game). */
export function runs() {
  const out = [];
  for (const [key, r] of Object.entries(source())) {
    const id = +key;
    for (let i = 0; i + 2 < r.m.length; i++) if (r.m[i] === '1' && r.m[i + 1] === '1' && r.m[i + 2] === '1') out.push({ id, i });
  }
  return out;
}

/** Normalised ayah text -> the surahs it appears in. A question about "which surah" needs an ayah that is only in one. */
let IDX = null;
function textIndex() {
  if (!IDX) { IDX = new Map(); Q.forEach((c, k) => c.v.forEach(t => { const key = norm(t), set = IDX.get(key) || new Set(); set.add(k + 1); IDX.set(key, set) })) }
  return IDX;
}
const whichPool = () => memorisedPool().filter(a => { const n = words(a.t).length; return n >= 3 && n <= 30 && textIndex().get(norm(a.t)).size === 1 });

/** Memorised ayat whose next ayah (same surah) is memorised too, and where neither text repeats inside the surah, so there is one right answer. */
export function nextPairs() {
  const out = [];
  for (const [key, r] of Object.entries(source())) {
    const id = +key, v = Q[id - 1].v, count = new Map();
    v.forEach(t => { const k = norm(t); count.set(k, (count.get(k) || 0) + 1) });
    for (let i = 0; i + 1 < r.m.length; i++) {
      if (r.m[i] !== '1' || r.m[i + 1] !== '1') continue;
      const a = words(v[i]).length, b = words(v[i + 1]).length;
      if (a < 2 || a > 25 || b < 2 || b > 22 || count.get(norm(v[i])) > 1 || count.get(norm(v[i + 1])) > 1) continue;
      out.push({ id, i });
    }
  }
  return out;
}

const GAMES = {
  complete: { name: 'أكمل الآية', icon: 'puzzle', desc: 'تظهر بداية آية حفظتَها، اختر تتمتها الصحيحة.', ok: () => eligible(3, 16).length > 0, need: 'علّم بعض الآيات (٣ كلمات فأكثر) كمحفوظة أولًا.' },
  order: { name: 'رتّب الآيات', icon: 'list', desc: 'ثلاث آيات متتالية حفظتَها مخلوطة، اضغطها بالترتيب الصحيح.', ok: () => runs().length > 0, need: 'علّم ثلاث آيات متتالية على الأقل من سورة واحدة كمحفوظة.' },
  which: { name: 'من أي سورة؟', icon: 'compass', desc: 'تظهر آية حفظتَها، اختر اسم السورة التي هي منها.', ok: () => whichPool().length > 0, need: 'علّم بعض الآيات (٣ كلمات فأكثر) كمحفوظة أولًا.' },
  next: { name: 'ما الآية التالية؟', icon: 'forward', desc: 'آية حفظتَها، اختر الآية التي تأتي بعدها.', ok: () => nextPairs().length > 0, need: 'علّم آيتين متتاليتين على الأقل من سورة واحدة كمحفوظتين.' },
  count: { name: 'كم آية في السورة؟', icon: 'chart', desc: 'سورة بدأتَ حفظها، اختر عدد آياتها.', ok: () => Object.keys(source()).length > 0, need: 'ابدأ حفظ سورة أولًا.' },
  missing: { name: 'الكلمة الناقصة', icon: 'help', desc: 'آية حفظتَها وفيها كلمة ناقصة، اختر الكلمة الصحيحة.', ok: () => eligible(2, 30).length > 0, need: 'علّم بعض الآيات (كلمتين فأكثر) كمحفوظة أولًا.' },
};

function eligible(min, max) {
  let p = memorisedPool().filter(a => { const n = words(a.t).length; return n >= min && n <= max });
  if (young()) { const short = p.filter(a => words(a.t).length <= 8); if (short.length) p = short }
  return p;
}

/* ---------- question builders ---------- */
function distinctOptions(correct, make, count) {
  const seen = new Set([norm(correct)]), out = [correct];
  for (let k = 0; k < 400 && out.length < count; k++) {
    const o = make(); if (!o) continue;
    const key = norm(o); if (seen.has(key)) continue;
    seen.add(key); out.push(o);
  }
  return out.length === count ? shuffle(out) : null;
}

export function buildComplete(prev) {
  const pool = eligible(3, 16); if (!pool.length) return null;
  let a = pick(pool); for (let t = 0; t < 5 && pool.length > 1 && prev && a.id === prev.id && a.i === prev.i; t++) a = pick(pool);
  const w = words(a.t), cut = Math.ceil(w.length / 2), tailLen = w.length - cut, correct = w.slice(cut).join(' ');
  const opts = distinctOptions(correct, () => {
    const r = randomAyah(), rw = words(r.t); return rw.length >= tailLen + 1 ? rw.slice(-tailLen).join(' ') : null;
  }, 3);
  if (!opts) return null;
  return { a, prompt: w.slice(0, cut).join(' ') + ' …', options: opts, correct, full: a.t };
}

export function buildMissing(prev) {
  const pool = eligible(2, 30); if (!pool.length) return null;
  let a = pick(pool); for (let t = 0; t < 5 && pool.length > 1 && prev && a.id === prev.id && a.i === prev.i; t++) a = pick(pool);
  const w = words(a.t), h = Math.floor(Math.random() * w.length), correct = w[h];
  const sameSurah = Q[a.id - 1].v.flatMap(words);
  const opts = distinctOptions(correct, () => pick(Math.random() < 0.5 ? sameSurah : words(randomAyah().t)), 4);
  if (!opts) return null;
  return { a, prompt: w.map((x, i) => i === h ? '＿＿＿' : x).join(' '), options: opts, correct, full: a.t };
}

/** "Which surah?": an ayah the child memorised and that exists in exactly one surah. */
export function buildWhich(prev) {
  let pool = whichPool(); if (!pool.length) return null;
  if (young()) { const short = pool.filter(a => words(a.t).length <= 10); if (short.length) pool = short }
  let a = pick(pool); for (let t = 0; t < 5 && pool.length > 1 && prev && a.id === prev.id && a.i === prev.i; t++) a = pick(pool);
  const correct = 'سورة ' + Q[a.id - 1].n;
  const opts = distinctOptions(correct, () => 'سورة ' + Q[Math.floor(Math.random() * 114)].n, 4);
  if (!opts) return null;
  return { a, prompt: a.t, options: opts, correct, full: 'سورة ' + Q[a.id - 1].n + ' · الآية ' + AR(a.i + 1) };
}

/** "What comes next?": two consecutive memorised ayat; the wrong options are other ayat of the same surah (or of the mushaf). */
export function buildNext(prev) {
  let pool = nextPairs(); if (!pool.length) return null;
  if (young()) { const short = pool.filter(p => words(Q[p.id - 1].v[p.i + 1]).length <= 8); if (short.length) pool = short }
  let p = pick(pool); for (let t = 0; t < 5 && pool.length > 1 && prev && p.id === prev.id && p.i === prev.i; t++) p = pick(pool);
  const v = Q[p.id - 1].v, correct = v[p.i + 1];
  const near = v.filter((t, k) => k !== p.i && k !== p.i + 1 && words(t).length >= 2 && words(t).length <= 22);
  const opts = distinctOptions(correct, () => near.length >= 3 ? pick(near) : randomAyah().t, 3);
  if (!opts) return null;
  return { a: { id: p.id, i: p.i }, prompt: v[p.i], options: opts, correct, full: v[p.i] + ' ' + correct };
}

/** "How many ayat?": a surah the child started; the wrong options are nearby numbers. */
export function buildCount(prev) {
  const ids = Object.keys(source()).map(Number); if (!ids.length) return null;
  let id = pick(ids); for (let t = 0; t < 5 && ids.length > 1 && prev && id === prev.id; t++) id = pick(ids);
  const n = Q[id - 1].v.length, correct = AR(n);
  const near = [];
  for (let d = 1; d <= 8; d++) { if (n + d <= 300) near.push(n + d); if (n - d >= 1) near.push(n - d) }
  const opts = [correct, ...shuffle(near).slice(0, 3).map(AR)];
  if (opts.length !== 4) return null;
  return { a: { id, i: 0 }, prompt: 'كم عدد آيات سورة ' + Q[id - 1].n + '؟', options: shuffle(opts), correct, full: 'سورة ' + Q[id - 1].n + ' فيها ' + ayahs(n) + '.' };
}

/* ---------- play ---------- */
let onStars = () => {};
export const onGameStars = fn => { onStars = fn };

export function renderGames() {
  const box = $('gameBox'); box.textContent = '';
  if (!Q.length) return;
  if (G) return G.type === 'order' ? orderRound() : choiceRound();
  box.appendChild(el('p', 'note gamesintro', 'العب بالآيات التي علّمتَها كمحفوظة. نجوم الألعاب منفصلة عن نجوم الحفظ، ولا تُحتسب في تقدّم حفظك.'));
  const list = el('ul', 'gamelist');
  Object.entries(GAMES).forEach(([type, g]) => {
    const ok = g.ok(), li = el('li', 'gamecard' + (ok ? '' : ' locked'));
    const top = el('span', 'gtop'); top.append(el('span', 'gicon', ''), el('b', '', g.name)); top.firstChild.appendChild(icon(g.icon));
    li.appendChild(top);
    if (ok) {
      li.appendChild(el('span', 'note', g.desc));
      const b = el('button', 'btn primary', 'العب'); b.type = 'button'; b.addEventListener('click', () => start(type)); li.appendChild(b);
    } else {
      // locked: say exactly what unlocks it, and give two ways forward (go and do it, or try it without counting)
      const why = el('span', 'note lockwhy'); why.append(icon('lock'), 'تُفتح حين: ' + g.need.replace(/ أولًا\.$/, '').replace(/\.$/, ''));
      li.append(el('span', 'note', g.desc), why);
      const acts = el('span', 'acts');
      const go = el('a', 'btn', 'ابدأ الحفظ'); go.href = '#/dashboard';
      const trial = el('button', 'btn ghost', 'جرّبها تجربة'); trial.type = 'button';
      trial.setAttribute('aria-label', 'جرّب لعبة ' + g.name + ' تجربة لا تُحتسب نجومها');
      trial.addEventListener('click', () => start(type, true));
      acts.append(go, trial); li.appendChild(acts);
    }
    list.appendChild(li);
  });
  box.appendChild(list);
}

function start(type, trial = false) { G = { type, trial, round: 0, stars: 0, total: type === 'order' ? PUZZLES : ROUNDS, cur: null, prev: null }; next() }
function leave() { G = null; renderGames() }

function next() {
  G.round++;
  if (G.round > G.total) return finish();
  G.cur = ({ complete: buildComplete, missing: buildMissing, which: buildWhich, next: buildNext, count: buildCount, order: buildOrder })[G.type](G.prev);
  if (!G.cur) { G.round--; return finish() }
  G.prev = G.cur.a || null;
  renderGames();
}

function head(box) {
  const bar = el('div', 'ghead');
  const back = el('button', 'btn'); back.type = 'button'; back.append(icon('back'), 'الألعاب'); back.addEventListener('click', leave);
  const stars = el('span', 'gstars'); stars.append(icon('star'), AR(G.stars));
  bar.append(back, el('span', 'note', GAMES[G.type].name + ' · ' + AR(G.round) + ' من ' + AR(G.total)), stars);
  box.appendChild(bar);
  if (G.trial) { const t = el('p', 'trialnote'); t.append(icon('info'), 'تجربة: بآيات من قصار السور، ولا تُحتسب نجومها.'); box.appendChild(t) }
}

function nextBtn(box, last) {
  const b = el('button', 'btn primary', last ? 'النتيجة' : 'التالي'); b.type = 'button'; b.addEventListener('click', next); box.appendChild(b); b.focus();
}

function choiceRound() {
  const box = $('gameBox'), q = G.cur; head(box);
  box.appendChild(el('p', 'quizq', q.prompt));
  const fb = el('p', 'note'); fb.setAttribute('role', 'status');
  const opts = el('div', 'opts');
  q.options.forEach(o => {
    const b = el('button', 'btn opt', o); b.type = 'button';
    b.addEventListener('click', () => {
      opts.querySelectorAll('button').forEach(x => { x.disabled = true; if (x.textContent === q.correct) x.classList.add('right') });
      if (o === q.correct) { G.stars++; fb.textContent = 'أحسنت!'; correct(b) } else { b.classList.add('wrong'); wrong(b); fb.textContent = 'ليست هذه. الصحيح مُلوَّن بالأخضر.' }
      const full = el('p', 'quizfull', q.full); box.insertBefore(full, fb);
      nextBtn(box, G.round === G.total);
    });
    opts.appendChild(b);
  });
  box.append(opts, fb);
}

/* ordering: three consecutive memorised ayat, tapped in the right order */
export function buildOrder() {
  const rs = runs(); if (!rs.length) return null;
  const r = pick(rs), items = [0, 1, 2].map(k => ({ n: k, t: Q[r.id - 1].v[r.i + k] }));
  let mixed = shuffle(items); for (let t = 0; t < 20 && mixed.every((x, k) => x.n === k); t++) mixed = shuffle(items);
  return { items: mixed, got: 0, mistakes: 0 };
}

function orderRound() {
  const box = $('gameBox'), q = G.cur; head(box);
  box.appendChild(el('p', 'note', 'اضغط الآيات بترتيبها الصحيح في السورة.'));
  const fb = el('p', 'note'); fb.setAttribute('role', 'status');
  const list = el('div', 'ordlist');
  q.items.forEach(it => {
    const b = el('button', 'ordcard'); b.type = 'button'; b.append(el('span', 'ordn'), el('span', 'tx', it.t));
    b.addEventListener('click', () => {
      if (it.n !== q.got) { q.mistakes++; fb.textContent = 'ليست هذه الآية التالية، جرّب غيرها.'; wrong(b); return }
      q.got++; b.disabled = true; b.classList.add('right'); correct(b); b.firstChild.textContent = AR(q.got); fb.textContent = '';
      if (q.got === 3) {
        const s = q.mistakes === 0 ? 2 : 1; G.stars += s; fb.textContent = 'أحسنت! +' + nujum(s);
        nextBtn(box, G.round === G.total);
      }
    });
    list.appendChild(b);
  });
  box.append(list, fb);
}

function finish() {
  const box = $('gameBox'); box.textContent = '';
  const n = G.stars, trial = G.trial;
  if (!trial) { addGameStars(n); onStars() }   // a trial never counts
  box.append(el('h2', '', trial ? 'انتهت التجربة' : n ? 'أحسنت! حصلتَ على ' + nujum(n) + ' في الألعاب' : 'انتهت الجولة'),
    el('p', 'note', trial ? 'هذه تجربة بآيات من قصار السور، ولم تُضَف أي نجوم. حين تعلّم آياتك كمحفوظة تفتح لك اللعبة بآياتك أنت.' : n ? '' : 'لا بأس، راجع آياتك ثم جرّب مرة أخرى.'));
  const again = el('button', 'btn primary', 'العب مرة أخرى'), back = el('button', 'btn', 'الألعاب');
  again.type = back.type = 'button';
  const type = G.type; again.addEventListener('click', () => start(type, trial)); back.addEventListener('click', leave);
  const acts = el('div', 'acts'); acts.append(again, back); box.appendChild(acts);
  G = null;
}

/** Leaving the games page (or switching child) abandons the round without awarding stars. */
export const resetGame = () => { G = null };
