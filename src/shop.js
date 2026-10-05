// The star shop: a child spends game stars on cartoon friends, pastel page colours and name frames.
// Game stars are earned in the games and the weekly challenge; the memorisation stars and medals are never spent.
import { $, AR, el, nujum, charImg } from './util.js';
import { SHOP } from './catalog.js';
import { activeKid, starBalance, owns, buyItem, useItem, friendOf, shopTheme, shopFrame } from './state.js';
import { announce } from './motion.js';
import { sfx } from './sound.js';

const GROUPS = [
  { type: 'friend', title: 'أصدقاء جدد', note: 'صديق جديد يظهر معك في الرئيسية وفي الاحتفالات.' },
  { type: 'theme', title: 'ألوان الصفحات', note: 'لون فاتح هادئ لخلفية الموقع.' },
  { type: 'frame', title: 'إطارات الاسم', note: 'إطار حول اسمك في شريط الأطفال.' },
];
let onChange = () => {};
export const onShopChange = fn => { onChange = fn };

function preview(it) {
  const box = el('div', 'shpre');
  if (it.type === 'friend') box.appendChild(charImg(it.char));
  else if (it.type === 'theme') { box.classList.add('sw'); box.style.background = 'linear-gradient(160deg,' + it.swatch[0] + ',' + it.swatch[1] + ')' }
  else { const k = activeKid(); const s = el('span', 'kid frameprev'); s.dataset.frame = it.id; s.append(el('span', 'kicon', k ? k.icon : '⭐'), el('span', 'kname', k ? k.name : '')); box.appendChild(s) }
  return box;
}

export function renderShop() {
  const root = $('shopBox'); root.textContent = '';
  const k = activeKid(); if (!k) return;
  const bal = starBalance();
  const head = el('p', 'shopbal'); head.append(el('span', 'big-star', '🎮'), el('b', '', AR(bal)), ' نجمة ألعاب في رصيدك');
  root.append(head, el('p', 'note', 'تكسب نجوم الألعاب من ألعاب رفيق ومن تحدّي الأسبوع. الشراء من نجوم الألعاب فقط، ونجوم الحفظ والأوسمة لا تُصرف أبدًا.'));
  const msg = el('p', 'note'); msg.setAttribute('role', 'status'); root.appendChild(msg);

  GROUPS.forEach(g => {
    const sec = el('section', 'shopsec'); sec.append(el('h2', '', g.title), el('p', 'note', g.note));
    const list = el('ul', 'shoplist');
    SHOP.filter(i => i.type === g.type).forEach(it => {
      const li = el('li', 'shopitem'), own = owns(it.id);
      const on = it.type === 'friend' ? friendOf() === it.id : it.type === 'theme' ? shopTheme() === it.id : shopFrame(k) === it.id;
      const btn = el('button', 'btn' + (own ? '' : ' primary')); btn.type = 'button';
      if (own) { btn.textContent = on ? 'قيد الاستخدام ✓' : 'استخدمه'; btn.setAttribute('aria-pressed', on) }
      else { btn.textContent = 'اشترِ بـ ' + AR(it.price) + ' ⭐'; btn.disabled = bal < it.price; if (btn.disabled) btn.setAttribute('aria-label', it.name + ': ينقصك ' + nujum(it.price - bal)) }
      btn.addEventListener('click', () => {
        if (!own) {
          if (buyItem(it.id) !== 'ok') return;
          sfx('win'); announce('اشتريتَ ' + it.name + '! 🎉'); useItem(it.id);   // a new thing is put to use right away
          msg.textContent = 'اشتريتَ ' + it.name + ' وهو الآن قيد الاستخدام.';
        } else useItem(it.id);
        onChange(); renderShop();
        const again = [...document.querySelectorAll('#shopBox .shopitem')].find(x => x.dataset.id === it.id); if (again) again.querySelector('button').focus();
      });
      li.dataset.id = it.id;
      const info = el('div', 'shopinfo'); info.append(el('b', '', it.name), el('span', 'note', own ? 'عندك' : AR(it.price) + ' نجمة'));
      li.append(preview(it), info, btn);
      list.appendChild(li);
    });
    sec.appendChild(list); root.appendChild(sec);
  });
}
