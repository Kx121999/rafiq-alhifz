// Child profiles: the switcher bar and the look that follows the active child (mode, text size, colour).
import { $ } from './util.js';
import { shopTheme, shopFrame, kids, activeKid, switchKid, save } from './state.js';
import { applyReading } from './reading.js';

let onChange = () => {};
export const onKidsChange = fn => { onChange = fn };

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e };

/** Young children get bigger text, star buttons and no tafsir; readers get the full page. */
export function applyMode() {
  const k = activeKid(); document.body.dataset.mode = k ? k.mode : 'reader';
  applyReading();   // the child's reading size
  const th = shopTheme(); if (th) document.body.dataset.theme = th; else delete document.body.dataset.theme;   // a pastel colour from the shop
}

export function renderKidBar() {
  const box = $('kids'); box.textContent = '';
  const act = activeKid();
  kids().forEach(k => {
    const b = el('button', 'kid'); b.type = 'button'; b.dataset.id = k.id;
    b.setAttribute('aria-pressed', act && k.id === act.id);
    const fr = shopFrame(k); if (fr) b.dataset.frame = fr;
    b.append(el('span', 'kicon', k.icon), el('span', 'kname', k.name));
    box.appendChild(b);
  });
}

/** After a change to a child (name, mode, friend, the active child): repaint what depends on it, then tell the pages. */
export function refreshKids() { applyMode(); renderKidBar(); onChange() }

export function initKids() {
  $('kids').addEventListener('click', e => { const b = e.target.closest('.kid'); if (!b) return; switchKid(b.dataset.id); refreshKids() });
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { save(); renderKidBar(); onChange() }));
  refreshKids();
}
