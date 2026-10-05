// Reading comfort: a text size per child (the A- / A+ buttons on the surah and adhkar pages) and a quiet "focus reading"
// view of the adhkar. The size is the optional field fs on the child; CSS multiplies the Quran and adhkar text by --rs.
import { $, AR } from './util.js';
import { fontLevel, setFontLevel, FS_MIN, FS_MAX } from './state.js';

const STEP = 0.14;
export const scaleOf = level => 1 + level * STEP;

/** Sets --rs and every size control (percentage, disabled at the ends) from the active child. */
export function applyReading() {
  const lv = fontLevel();
  document.body.style.setProperty('--rs', String(scaleOf(lv)));
  document.querySelectorAll('.fsctl').forEach(box => {
    const val = box.querySelector('.fsval'), less = box.querySelector('[data-fs="-1"]'), more = box.querySelector('[data-fs="1"]');
    if (val) val.textContent = AR(Math.round(scaleOf(lv) * 100)) + '٪';
    if (less) less.disabled = lv <= FS_MIN;
    if (more) more.disabled = lv >= FS_MAX;
  });
}

export function setFocusRead(on) {
  document.body.classList.toggle('focusread', on);
  const b = $('azFocus'); if (b) { b.setAttribute('aria-pressed', on); b.textContent = on ? 'إنهاء القراءة المركّزة' : 'قراءة مركّزة' }
  const sb = $('focusBtn'); if (sb) { sb.setAttribute('aria-pressed', on); sb.querySelector('span').textContent = on ? 'إنهاء القراءة المركّزة' : 'قراءة مركّزة' }
}

export function initReading() {
  document.querySelectorAll('.fsctl').forEach(box => box.addEventListener('click', e => {
    const b = e.target.closest('[data-fs]'); if (!b || b.disabled) return;
    setFontLevel(fontLevel() + Number(b.dataset.fs)); applyReading();
  }));
  const f = $('azFocus'); if (f) f.addEventListener('click', () => setFocusRead(!document.body.classList.contains('focusread')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('focusread')) setFocusRead(false) });
  applyReading();
}
