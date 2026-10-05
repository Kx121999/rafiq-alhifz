// Child profiles: the switcher bar, rewards (stars and badges), and the parent corner behind a math gate.
import { $, AR, day, charImg } from './util.js';
import { Q } from './data.js';
import { announce } from './motion.js';
import { S, mem, gameStars, azStats, FRIENDS, kids, activeKid, switchKid, addKid, updateKid, removeKid, save, applyImport, ICONS, MODES } from './state.js';
import { downloadBackup, lastExport, parseBackup } from './backup.js';
import { go } from './router.js';
import { applyReading } from './reading.js';
import { deviceSection } from './devicepanel.js';

let onChange = () => {};
export const onKidsChange = fn => { onChange = fn };

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e };

/** Young children get bigger text, star buttons and no tafsir; readers get the full page. */
export function applyMode() {
  const k = activeKid(); document.body.dataset.mode = k ? k.mode : 'reader';
  applyReading();   // the child's reading size
}

export function renderKidBar() {
  const box = $('kids'); box.textContent = '';
  const act = activeKid();
  kids().forEach(k => {
    const b = el('button', 'kid'); b.type = 'button'; b.dataset.id = k.id;
    b.setAttribute('aria-pressed', act && k.id === act.id);
    b.append(el('span', 'kicon', k.icon), el('span', 'kname', k.name));
    box.appendChild(b);
  });
}

/* ---------- rewards: derived from progress, so nothing extra is stored ---------- */
function totals() {
  let ay = 0, done = 0;
  Q.forEach((c, k) => { const m = mem(k + 1); ay += m; if (m === c.v.length) done++ });
  const streak = (S.last === day() || S.last === day(-1)) ? S.streak : 0;
  return { ay, done, streak, games: gameStars(), az: azStats() };
}
const BADGES = [
  { icon: '🌱', name: 'البداية', ok: t => t.ay >= 1 },
  { icon: '🌟', name: 'عشر آيات', ok: t => t.ay >= 10 },
  { icon: '🏅', name: 'سورة كاملة', ok: t => t.done >= 1 },
  { icon: '🏆', name: 'خمس سور', ok: t => t.done >= 5 },
  { icon: '🔥', name: 'أسبوع متواصل', ok: t => t.streak >= 7 },
  { icon: '👑', name: 'مئة آية', ok: t => t.ay >= 100 },
  { icon: '🎮', name: 'لاعب نشيط', ok: t => t.games >= 10 },
  { icon: '🎯', name: 'بطل الألعاب', ok: t => t.games >= 50 },
  { icon: '🌅', name: 'أذكار الصباح', ok: t => t.az.sabah },
  { icon: '🌙', name: 'أذكار المساء', ok: t => t.az.masaa },
  { icon: '😴', name: 'أذكار النوم', ok: t => t.az.nawm },
  { icon: '📿', name: 'ملتزم بالأذكار', ok: t => t.az.days >= 7 },
];

export function renderRewards(id = 'rewards') {
  const box = $(id); box.textContent = '';
  const t = totals();
  const stars = el('p', 'stars'); stars.append(el('span', 'big-star', '⭐'), el('b', '', AR(t.ay)), ' نجمة');
  const row = el('ul', 'badges');
  BADGES.forEach(b => {
    const on = b.ok(t), li = el('li', 'badge' + (on ? ' on' : ''));
    li.append(el('span', 'bicon', b.icon), el('span', 'bname', b.name));
    if (!on) li.append(el('span', 'sr', 'لم يُفتح بعد'));
    li.title = on ? 'حصلتَ على وسام ' + b.name : 'وسام ' + b.name + ' لم يُفتح بعد';
    row.appendChild(li);
  });
  const games = el('p', 'stars game'); games.append(el('span', 'big-star', '🎮'), el('b', '', AR(t.games)), ' نجمة ألعاب (منفصلة عن نجوم الحفظ)');
  box.append(stars, games, row);
}

/** Tells the child when a medal is newly unlocked. The first call per child only records what is already unlocked. */
const unlocked = new Map();
export function announceBadges() {
  const k = activeKid(); if (!k) return;
  const t = totals(), now = new Set(BADGES.filter(b => b.ok(t)).map(b => b.name)), before = unlocked.get(k.id);
  unlocked.set(k.id, now);
  if (!before) return;
  BADGES.filter(b => now.has(b.name) && !before.has(b.name)).forEach(b => announce('وسام جديد: ' + b.icon + ' ' + b.name + '!'));
}

/* ---------- parent corner ---------- */
let answer = 0;
function openGate() {
  const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
  answer = a * b; $('gateQ').textContent = AR(a) + ' × ' + AR(b) + ' = ؟';
  $('gateA').value = ''; $('gateErr').hidden = true; $('gate').showModal(); $('gateA').focus();
}

function renderParent() {
  const box = $('parentBody'); box.textContent = '';
  const act = activeKid();
  kids().forEach(k => {
    const card = el('section', 'kcard'); card.dataset.id = k.id;
    const name = el('input', 'search'); name.value = k.name; name.maxLength = 20; name.setAttribute('aria-label', 'اسم الطفل');
    name.addEventListener('change', () => { updateKid(k.id, { ...k, name: name.value.trim() || k.name }); name.value = k.name; refresh(false) });
    const icons = el('div', 'icons');
    ICONS.forEach(ic => {
      const b = el('button', 'chip', ic); b.type = 'button'; b.setAttribute('aria-pressed', ic === k.icon); b.setAttribute('aria-label', 'الرمز ' + ic);
      b.addEventListener('click', () => { updateKid(k.id, { ...k, icon: ic }); refresh(true) });
      icons.appendChild(b);
    });
    const modes = el('div', 'icons');
    Object.entries(MODES).forEach(([m, label]) => {
      const b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', m === k.mode);
      b.addEventListener('click', () => { updateKid(k.id, { ...k, mode: m }); refresh(true) });
      modes.appendChild(b);
    });
    const friends = el('div', 'icons friends'); friends.setAttribute('role', 'group'); friends.setAttribute('aria-label', 'صديق ' + k.name);
    FRIENDS.forEach(f => {
      const b = el('button', 'chip friendchip'); b.type = 'button';
      b.setAttribute('aria-pressed', f.id === (k.friend || 'rafiq')); b.setAttribute('aria-label', 'الصديق ' + f.name);
      b.append(charImg(f.id), el('span', '', f.name));
      b.addEventListener('click', () => { updateKid(k.id, { ...k, friend: f.id }); refresh(true) });
      friends.appendChild(b);
    });
    const foot = el('div', 'acts');
    const rep = el('button', 'btn', 'تقرير الأسبوع'); rep.type = 'button';
    rep.addEventListener('click', () => { if (!act || k.id !== act.id) switchKid(k.id); $('parent').close(); go('/report') });
    foot.appendChild(rep);
    if (!act || k.id !== act.id) { const sw = el('button', 'btn', 'تحويل إلى ' + k.name); sw.type = 'button'; sw.addEventListener('click', () => { switchKid(k.id); refresh(true) }); foot.appendChild(sw) }
    if (kids().length > 1) {
      const del = el('button', 'btn danger', 'حذف'); del.type = 'button';
      del.addEventListener('click', () => {
        if (confirm('حذف ملف «' + k.name + '» وكل تقدّمه نهائيًا؟ لا يمكن التراجع.')) { removeKid(k.id); refresh(true) }
      });
      foot.appendChild(del);
    }
    card.append(el('h3', '', k.icon + ' ' + k.name), name, icons, modes, friends, foot);
    box.appendChild(card);
  });
  box.appendChild(deviceSection());
  box.appendChild(backupSection());
}

/* ---------- backup: export / import ---------- */
function backupSection() {
  const card = el('section', 'kcard');
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const choice = el('div', 'importbox'); choice.hidden = true;
  const when = lastExport();
  const hint = el('p', 'note', when ? 'آخر نسخة احتياطية: ' + when.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) + '.' : 'لم تُصدَّر نسخة احتياطية بعد. صدّر نسخة بين الحين والآخر، فالتقدّم محفوظ في هذا المتصفح فقط.');
  const exp = el('button', 'btn primary', 'تصدير نسخة احتياطية'); exp.type = 'button';
  exp.addEventListener('click', () => { downloadBackup(); msg.textContent = 'تم تنزيل الملف. احتفظ به في مكان آمن، ويمكنك استيراده على أي جهاز.'; hint.textContent = 'آخر نسخة احتياطية: اليوم.' });
  const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
  const imp = el('button', 'btn', 'استيراد من ملف'); imp.type = 'button';
  imp.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = ''; choice.hidden = true; choice.textContent = ''; msg.textContent = '';
    if (!f) return;
    const r = parseBackup(f.size > 2e6 ? null : await f.text());
    if (r.error) { msg.textContent = r.error; return }
    const names = r.kids.map(k => k.icon + ' ' + k.name).join('، ');
    choice.append(el('p', '', 'يحتوي الملف على ' + AR(r.kids.length) + (r.kids.length === 1 ? ' طفل: ' : ' أطفال: ') + names + '.' + (r.skipped ? ' (تم تجاهل ' + AR(r.skipped) + ' عنصر غير صالح)' : '')));
    const add = el('button', 'btn primary', 'إضافتهم إلى الأطفال الحاليين'); add.type = 'button';
    add.addEventListener('click', () => { applyImport(r.kids, 'append'); msg.textContent = 'تمت الإضافة.'; refresh(true) });
    const rep = el('button', 'btn danger', 'استبدال كل البيانات الحالية'); rep.type = 'button';
    rep.addEventListener('click', () => {
      if (confirm('سيُحذف كل ما في هذا المتصفح الآن ويُستبدل بمحتوى الملف. هل صدّرتَ نسخة احتياطية أولًا؟ لا يمكن التراجع.')) { applyImport(r.kids, 'replace'); msg.textContent = 'تم الاستبدال.'; refresh(true) }
    });
    const no = el('button', 'btn', 'إلغاء'); no.type = 'button'; no.addEventListener('click', () => { choice.hidden = true; choice.textContent = '' });
    const acts = el('div', 'acts'); acts.append(add, rep, no); choice.append(acts); choice.hidden = false;
  });
  const acts = el('div', 'acts'); acts.append(exp, imp, file);
  card.append(el('h3', '', 'النسخ الاحتياطي'), hint, acts, choice, msg);
  return card;
}

function refresh(rerenderParent) { applyMode(); renderKidBar(); if (rerenderParent) renderParent(); onChange() }

export function initKids() {
  $('kids').addEventListener('click', e => { const b = e.target.closest('.kid'); if (!b) return; switchKid(b.dataset.id); refresh(false) });
  $('parentBtn').addEventListener('click', openGate);
  $('gateForm').addEventListener('submit', e => {
    e.preventDefault();
    if (Number($('gateA').value) === answer) { $('gate').close(); renderParent(); $('parent').showModal() }
    else { $('gateErr').hidden = false; $('gateA').select() }
  });
  $('addKid').addEventListener('click', () => {
    const n = kids().length + 1;
    addKid({ name: 'طفل ' + AR(n), icon: ICONS[n % ICONS.length], mode: 'reader' }); refresh(true);
  });
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { save(); renderKidBar(); onChange() }));
  refresh(false);
}
