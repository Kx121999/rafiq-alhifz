// The parents' hub: a page (not a pop-up) with the children, how they are doing, device settings, downloads and the data.
// It sits behind a small gate (a local PIN if one was set, otherwise a multiplication question). The gate keeps a child
// from wandering in; it is not an account and it protects nothing that leaves the device, because nothing does.
import { $, AR, el, icon, charImg, day } from './util.js';
import { kids, activeKid, switchKid, addKid, updateKid, removeKid, save, friendsFor, streakNow, ICONS, MODES, storageState } from './state.js';
import { kidSummary } from './backup.js';
import { backupSection } from './backupui.js';
import { settingsSection, downloadsSection } from './devicepanel.js';
import { planStats } from './plan.js';
import { refreshKids } from './kids.js';
import { hasPin, setPin, clearPin, checkPin, lockLeft, PIN_RE, unlockParents, lockParents, parentsOpen } from './pin.js';
import { go } from './router.js';

const TABS = [['children', 'الأطفال', 'users'], ['track', 'المتابعة', 'chart'], ['settings', 'الإعدادات', 'gear'], ['downloads', 'التنزيلات', 'download'], ['data', 'البيانات', 'file']];
let tab = 'children', answer = 0;

export { parentsOpen };

/* ---------- the gate ---------- */
export function openGate() {
  const pin = hasPin(), q = $('gateQ'), input = $('gateA');
  if (pin) { q.textContent = 'أدخل رمز الأهل'; input.type = 'password'; input.setAttribute('inputmode', 'numeric'); input.maxLength = 6; input.setAttribute('autocomplete', 'off') }
  else {
    const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    answer = a * b; q.textContent = AR(a) + ' × ' + AR(b) + ' = ؟'; input.type = 'number'; input.removeAttribute('maxlength');
  }
  input.value = ''; $('gateErr').hidden = true; $('gate').showModal(); input.focus();
}

async function submitGate(e) {
  e.preventDefault();
  const v = $('gateA').value.trim(), err = $('gateErr');
  let ok;
  if (hasPin()) {
    if (lockLeft()) { err.textContent = 'محاولات كثيرة. انتظر ' + AR(lockLeft()) + ' ثانية ثم حاول.'; err.hidden = false; return }
    ok = await checkPin(v);
    if (!ok) err.textContent = lockLeft() ? 'محاولات كثيرة. انتظر ' + AR(lockLeft()) + ' ثانية ثم حاول.' : 'الرمز غير صحيح.';
  } else { ok = Number(v) === answer; if (!ok) err.textContent = 'إجابة غير صحيحة، حاول مرة أخرى.' }
  if (!ok) { err.hidden = false; $('gateA').select(); return }
  unlockParents(); $('gate').close(); go('/parents');
}

/* ---------- sections ---------- */
const kidCard = k => {
  const act = activeKid(), card = el('section', 'kcard'); card.dataset.id = k.id;
  const head = el('h2'); head.append(el('span', 'kicon', k.icon), k.name); card.appendChild(head);
  const name = el('input', 'search'); name.value = k.name; name.maxLength = 20; name.setAttribute('aria-label', 'اسم الطفل');
  name.addEventListener('change', () => { updateKid(k.id, { ...k, name: name.value.trim() || k.name }); name.value = k.name; refresh() });
  const row = (label, node) => { const g = el('div', 'kfield'); g.append(el('span', 'note', label), node); return g };
  const icons = el('div', 'icons');
  ICONS.forEach(ic => {
    const b = el('button', 'chip', ic); b.type = 'button'; b.setAttribute('aria-pressed', ic === k.icon); b.setAttribute('aria-label', 'الرمز ' + ic);
    b.addEventListener('click', () => { updateKid(k.id, { ...k, icon: ic }); refresh() }); icons.appendChild(b);
  });
  const modes = el('div', 'icons');
  Object.entries(MODES).forEach(([m, label]) => {
    const b = el('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', m === k.mode);
    b.addEventListener('click', () => { updateKid(k.id, { ...k, mode: m }); refresh() }); modes.appendChild(b);
  });
  const friends = el('div', 'icons friends'); friends.setAttribute('role', 'group'); friends.setAttribute('aria-label', 'صديق ' + k.name);
  friendsFor(k).forEach(f => {
    const b = el('button', 'chip friendchip'); b.type = 'button';
    b.setAttribute('aria-pressed', f.id === (k.friend || 'rafiq')); b.setAttribute('aria-label', 'الصديق ' + f.name);
    b.append(charImg(f.id), el('span', '', f.name));
    b.addEventListener('click', () => { updateKid(k.id, { ...k, friend: f.id }); refresh() }); friends.appendChild(b);
  });
  const foot = el('div', 'acts');
  if (!act || k.id !== act.id) { const sw = el('button', 'btn', 'تحويل إلى ' + k.name); sw.type = 'button'; sw.addEventListener('click', () => { switchKid(k.id); refresh() }); foot.appendChild(sw) }
  if (kids().length > 1) {
    const del = el('button', 'btn danger', 'حذف الملف'); del.type = 'button';
    del.addEventListener('click', () => { if (confirm('حذف ملف «' + k.name + '» وكل تقدّمه نهائيًا؟ لا يمكن التراجع. يُنصح بتصدير نسخة احتياطية قبل ذلك.')) { removeKid(k.id); refresh() } });
    foot.appendChild(del);
  }
  card.append(name, row('الرمز', icons), row('الوضع', modes), row('الصديق في الاحتفالات', friends), foot);
  return card;
};

function children(box) {
  const add = el('button', 'btn primary'); add.type = 'button'; add.append(icon('plus'), 'إضافة طفل');
  add.addEventListener('click', () => { const n = kids().length + 1; addKid({ name: 'طفل ' + AR(n), icon: ICONS[n % ICONS.length], mode: 'reader' }); refresh() });
  box.appendChild(el('p', 'note', 'لكل طفل ملفه المنفصل: حفظه ومراجعاته ونجومه وعلاماته. لا يتشاركون أي شيء.'));
  kids().forEach(k => box.appendChild(kidCard(k)));
  box.appendChild(add);
}

/** How each child is doing, from real saved data only. Other children's progress is read from their saved copy. */
function track(box) {
  save();
  box.appendChild(el('p', 'note', 'أرقام حقيقية من نشاط كل طفل على هذا الجهاز. لا نُظهر شيئًا لم يحدث.'));
  const list = el('div', 'trackgrid');
  kids().forEach(k => {
    const sum = kidSummary(k), s = k.S, today = day();
    let due = 0; for (const r of Object.values(s.s || {})) if (r.m.includes('1') && r.d <= today) due++;
    const p = k.plan ? planStats(k.plan) : null;
    const card = el('section', 'kcard');
    const head = el('h2'); head.append(el('span', 'kicon', k.icon), k.name); card.appendChild(head);
    const dl = el('dl', 'facts');
    const fact = (t, v) => { dl.append(el('dt', '', t), el('dd', '', v)) };
    fact('آيات محفوظة', AR(sum.ay)); fact('سور مكتملة', AR(sum.done) + ' من ١١٤');
    fact('أيام متتالية', AR(streakNow(s, k.rest || {}))); fact('مراجعات مستحقة', AR(due));
    fact('الخطة', p ? p.pr.name + ': باقي ' + AR(p.left) + ' آية' : 'لا توجد خطة');
    card.appendChild(dl);
    const acts = el('div', 'acts');
    const view = (text, path) => { const b = el('button', 'btn', text); b.type = 'button'; b.addEventListener('click', () => { if (k.id !== (activeKid() || {}).id) { switchKid(k.id); refreshKids() } go(path) }); acts.appendChild(b) };
    view('التقرير الأسبوعي', '/report'); view('الخطة', '/plan'); view('بطاقة الإنجاز', '/share');
    card.appendChild(acts); list.appendChild(card);
  });
  box.appendChild(list);
  if (kids().length > 1) { const a = el('a', 'btn', 'تقرير العائلة'); a.href = '#/family'; box.appendChild(a) }
}

/** Setting, changing or removing the PIN. Says plainly what it is for. */
function pinCard() {
  const card = el('section', 'kcard'); card.appendChild(el('h2', '', 'رمز الأهل'));
  card.appendChild(el('p', 'note', 'رمز من ٤ إلى ٦ أرقام يحمي هذا الركن من الأطفال أثناء اللعب. يُحفظ على هذا الجهاز فقط ولا يدخل في النسخة الاحتياطية، وهو ليس حسابًا ولا حماية سحابية. بدونه يُطلب حل سؤال ضرب بسيط.'));
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const field = el('input', 'search'); field.type = 'password'; field.setAttribute('inputmode', 'numeric'); field.maxLength = 6; field.autocomplete = 'off';
  field.id = 'pinNew'; field.setAttribute('aria-label', hasPin() ? 'رمز جديد' : 'رمز الأهل الجديد');
  const set = el('button', 'btn primary', hasPin() ? 'غيّر الرمز' : 'اضبط الرمز'); set.type = 'button';
  set.addEventListener('click', async () => {
    if (!PIN_RE.test(field.value)) { msg.textContent = 'اكتب من ٤ إلى ٦ أرقام.'; field.focus(); return }
    msg.textContent = (await setPin(field.value)) ? 'تم حفظ الرمز على هذا الجهاز.' : 'تعذّر حفظ الرمز. تحقّق من مساحة التخزين.';
    field.value = ''; if (hasPin()) render(true);
  });
  const acts = el('div', 'acts'); acts.append(set);
  if (hasPin()) { const rm = el('button', 'btn', 'احذف الرمز'); rm.type = 'button'; rm.addEventListener('click', () => { if (confirm('حذف رمز الأهل؟ سيُطلب سؤال ضرب بدلًا منه.')) { clearPin(); render(true) } }); acts.appendChild(rm) }
  card.append(field, acts, msg);
  return card;
}

function settings(box) {
  box.append(settingsSection(), pinCard());
  const lock = el('button', 'btn', 'اقفل ركن الأهل الآن'); lock.type = 'button';
  lock.addEventListener('click', () => { lockParents(); go('/dashboard') });
  box.appendChild(lock);
}

function data(box) {
  if (!storageState.ok) box.appendChild(el('p', 'savebar inline', 'التخزين على هذا الجهاز لا يعمل الآن، وما تفعله لن يبقى. صدّر نسخة احتياطية أولًا.'));
  box.appendChild(backupSection(() => { refreshKids(); render(true) }));
  const priv = el('section', 'kcard'); priv.appendChild(el('h2', '', 'الخصوصية'));
  priv.appendChild(el('p', 'note', 'لا حسابات ولا خوادم ولا تتبّع ولا دردشة عامة ولا تسجيلات تلقائية. كل ما تراه محفوظ في متصفح هذا الجهاز فقط، ولا يخرج منه إلا إذا صدّرتَ ملفًا بنفسك.'));
  box.appendChild(priv);
}

const SECTIONS = { children, track, settings, downloads: box => box.appendChild(downloadsSection()), data };

function render(keepFocus) {
  const tabs = $('parentTabs'), body = $('parentBody'); tabs.textContent = ''; body.textContent = '';
  TABS.forEach(([id, label, ic]) => {
    const b = el('button', 'chip'); b.type = 'button'; b.dataset.tab = id; b.setAttribute('aria-pressed', id === tab); b.append(icon(ic), label);
    b.addEventListener('click', () => { tab = id; render() }); tabs.appendChild(b);
  });
  SECTIONS[tab](body);
  if (keepFocus) { const t = tabs.querySelector('[aria-pressed="true"]'); if (t) t.focus({ preventScroll: true }) }
}
const refresh = () => { refreshKids(); render() };

/** Opens the page: false (go back) when the gate has not been passed in the last quarter hour. */
export function showParents(section) {
  if (!parentsOpen()) { openGate(); return false }
  if (section && SECTIONS[section]) tab = section;
  render(); return true;
}

export function initParents() {
  $('parentBtn').addEventListener('click', () => { if (parentsOpen()) go('/parents'); else openGate() });
  $('gateForm').addEventListener('submit', submitGate);
  $('parentsLock').addEventListener('click', () => { lockParents(); go('/dashboard') });
}
