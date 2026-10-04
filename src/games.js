// Three memorisation games. Every question is built from ayat the child marked as memorised;
// wrong options are real words or endings taken from other ayat in quran.json. Nothing is generated.
import { $, AR, el, norm, nujum } from './util.js';
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

/** Every ayah the active child has marked as memorised. */
export function memorisedPool() {
  const out = [];
  for (const [key, r] of Object.entries(S.s)) {
    const id = +key;
    for (let i = 0; i < r.m.length; i++) if (r.m[i] === '1') out.push({ id, i, t: Q[id - 1].v[i] });
  }
  return out;
}

/** Windows of three consecutive memorised ayat within one surah (for the ordering game). */
export function runs() {
  const out = [];
  for (const [key, r] of Object.entries(S.s)) {
    const id = +key;
    for (let i = 0; i + 2 < r.m.length; i++) if (r.m[i] === '1' && r.m[i + 1] === '1' && r.m[i + 2] === '1') out.push({ id, i });
  }
  return out;
}

const GAMES = {
  complete: { name: 'أكمل الآية', icon: '🧩', desc: 'تظهر بداية آية حفظتَها، اختر تتمتها الصحيحة.', ok: () => eligible(3, 16).length > 0, need: 'علّم بعض الآيات (٣ كلمات فأكثر) كمحفوظة أولًا.' },
  order: { name: 'رتّب الآيات', icon: '🔢', desc: 'ثلاث آيات متتالية حفظتَها مخلوطة، اضغطها بالترتيب الصحيح.', ok: () => runs().length > 0, need: 'علّم ثلاث آيات متتالية على الأقل من سورة واحدة كمحفوظة.' },
  missing: { name: 'الكلمة الناقصة', icon: '❓', desc: 'آية حفظتَها وفيها كلمة ناقصة، اختر الكلمة الصحيحة.', ok: () => eligible(2, 30).length > 0, need: 'علّم بعض الآيات (كلمتين فأكثر) كمحفوظة أولًا.' },
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

/* ---------- play ---------- */
let G = null;
let onStars = () => {};
export const onGameStars = fn => { onStars = fn };

export function renderGames() {
  const box = $('gameBox'); box.textContent = '';
  if (!Q.length) return;
  if (G) return G.type === 'order' ? orderRound() : choiceRound();
  box.appendChild(el('p', 'note', 'العب بالآيات التي علّمتَها كمحفوظة. نجوم الألعاب منفصلة عن نجوم الحفظ.'));
  const list = el('div', 'gamelist');
  Object.entries(GAMES).forEach(([type, g]) => {
    const ok = g.ok(), b = el('button', 'gamecard'); b.type = 'button'; b.disabled = !ok;
    b.append(el('span', 'gicon', g.icon), el('b', '', g.name), el('span', 'note', ok ? g.desc : g.need));
    b.addEventListener('click', () => start(type));
    list.appendChild(b);
  });
  box.appendChild(list);
}

function start(type) { G = { type, round: 0, stars: 0, total: type === 'order' ? PUZZLES : ROUNDS, cur: null, prev: null }; next() }
function leave() { G = null; renderGames() }

function next() {
  G.round++;
  if (G.round > G.total) return finish();
  G.cur = G.type === 'complete' ? buildComplete(G.prev) : G.type === 'missing' ? buildMissing(G.prev) : buildOrder();
  if (!G.cur) { G.round--; return finish() }
  G.prev = G.cur.a || null;
  renderGames();
}

function head(box) {
  const bar = el('div', 'ghead');
  const back = el('button', 'btn', '→ الألعاب'); back.type = 'button'; back.addEventListener('click', leave);
  bar.append(back, el('span', 'note', GAMES[G.type].name + ' · ' + AR(G.round) + ' من ' + AR(G.total)), el('span', 'gstars', '🎮 ' + AR(G.stars)));
  box.appendChild(bar);
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
      if (o === q.correct) { G.stars++; fb.textContent = 'أحسنت! ⭐'; correct(b) } else { b.classList.add('wrong'); wrong(b); fb.textContent = 'ليست هذه. الصحيح مُلوَّن بالأخضر.' }
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
        const s = q.mistakes === 0 ? 2 : 1; G.stars += s; fb.textContent = 'أحسنت! +' + AR(s) + ' ⭐';
        nextBtn(box, G.round === G.total);
      }
    });
    list.appendChild(b);
  });
  box.append(list, fb);
}

function finish() {
  const box = $('gameBox'); box.textContent = '';
  const n = G.stars; addGameStars(n); onStars();
  box.append(el('h3', '', n ? 'أحسنت! حصلتَ على ' + nujum(n) + ' في الألعاب 🎮' : 'انتهت الجولة'),
    el('p', 'note', n ? '' : 'لا بأس، راجع آياتك ثم جرّب مرة أخرى.'));
  const again = el('button', 'btn primary', 'العب مرة أخرى'), back = el('button', 'btn', 'الألعاب');
  again.type = back.type = 'button';
  const type = G.type; again.addEventListener('click', () => start(type)); back.addEventListener('click', leave);
  const acts = el('div', 'acts'); acts.append(again, back); box.appendChild(acts);
  G = null;
}

/** Leaving the games page (or switching child) abandons the round without awarding stars. */
export const resetGame = () => { G = null };
