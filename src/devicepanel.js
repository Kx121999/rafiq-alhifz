// Device settings for the parents' hub: sounds and reminders (stored on the device, not per child), and the list of downloaded recitations.
import { el } from './util.js';
import { soundOn, setSound, sfx } from './sound.js';
import { downloadsList } from './offlineui.js';
import { SLOTS, loadRemind, saveRemind, supported, permission, askPermission, notify, tick } from './remind.js';

/** The downloaded recitations, with delete buttons. */
export function downloadsSection() {
  const card = el('section', 'kcard');
  card.appendChild(el('h2', '', 'التلاوات المحمّلة'));
  card.appendChild(el('p', 'note', 'تُحفظ على هذا الجهاز فقط لتسمعها بلا إنترنت. أما السور التي لم تنزّلها فتحتاج إنترنت للاستماع.'));
  const dl = el('div', 'dlwrap'); card.append(dl);
  const paintDl = () => { dl.textContent = ''; dl.appendChild(downloadsList(paintDl) || el('p', 'note', 'لم تنزّل أي تلاوة بعد. من صفحة أي سورة اضغط «نزّل السورة» لتسمعها بلا إنترنت.')) };
  paintDl();
  return card;
}

export function settingsSection() {
  const card = el('section', 'kcard');
  card.appendChild(el('h2', '', 'الأصوات والتذكيرات على هذا الجهاز'));

  /* sounds */
  const snd = el('button', 'chip', ''); snd.type = 'button';
  const paintSound = () => { snd.textContent = soundOn() ? 'الأصوات مفعّلة' : 'الأصوات مغلقة'; snd.setAttribute('aria-pressed', soundOn()) };
  snd.addEventListener('click', () => { setSound(!soundOn()); paintSound(); sfx('star') });
  paintSound();
  card.append(el('p', 'note', 'أصوات قصيرة مرحة عند الحفظ والإجابة الصحيحة. مغلقة افتراضيًا.'), snd);

  /* reminders */
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const cfg = loadRemind();
  card.append(el('h2', 'sub', 'التذكيرات'),
    el('p', 'note', 'تظهر التذكيرات على هذا الجهاز فقط، وبشرط أن يكون الموقع أو التطبيق مفتوحًا ولو في الخلفية. ليست منبّهًا مضمونًا، ولا يصلها شيء من الإنترنت.'));
  if (!supported()) { card.append(el('p', 'note', 'هذا المتصفح لا يدعم الإشعارات.')); return card }

  const main = el('button', 'chip', ''); main.type = 'button';
  const rows = el('div', 'remrows');
  const paint = () => {
    const on = cfg.on && permission() === 'granted';
    main.textContent = on ? 'التذكيرات مفعّلة' : 'التذكيرات مغلقة'; main.setAttribute('aria-pressed', on);
    rows.hidden = !on;
  };
  main.addEventListener('click', async () => {
    if (cfg.on && permission() === 'granted') { cfg.on = false; saveRemind(cfg); msg.textContent = ''; paint(); return }
    const p = permission() === 'granted' ? 'granted' : await askPermission();
    if (p === 'granted') { cfg.on = true; saveRemind(cfg); msg.textContent = 'تم التفعيل. سيظهر التذكير في موعده.'; tick() }
    else msg.textContent = p === 'denied' ? 'الإشعارات محجوبة لهذا الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة.' : 'لم تُمنح الصلاحية.';
    paint();
  });

  SLOTS.forEach(s => {
    const c = cfg.slots[s.id], row = el('div', 'remrow');
    const t = el('input'); t.type = 'time'; t.value = c.t; t.setAttribute('aria-label', 'وقت تذكير ' + s.label);
    const b = el('button', 'chip', s.label); b.type = 'button'; b.setAttribute('aria-pressed', c.on);
    b.addEventListener('click', () => { c.on = !c.on; b.setAttribute('aria-pressed', c.on); saveRemind(cfg) });
    t.addEventListener('change', () => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t.value)) { c.t = t.value; saveRemind(cfg) } else t.value = c.t });
    row.append(b, t); rows.appendChild(row);
  });
  const test = el('button', 'btn', 'جرّب إشعارًا الآن'); test.type = 'button';
  test.addEventListener('click', async () => { msg.textContent = (await notify('رفيق الحفظ', 'هكذا يظهر التذكير', 'hifz-test', '#/dashboard')) ? 'أُرسل إشعار تجريبي.' : 'تعذّر إظهار الإشعار.' });
  rows.appendChild(test);
  card.append(main, rows, msg);
  paint();
  return card;
}
