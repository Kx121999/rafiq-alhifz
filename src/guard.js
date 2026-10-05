// Two small safety nets the whole site uses:
//  1. the "not saved" bar: shown whenever the browser refuses to store the children's data, with the way out (export, retry);
//  2. "undo": a short-lived bar after an action that is easy to regret (marking a whole surah, un-marking an ayah).
import { $, el } from './util.js';
import { storageState, onStorageState, retrySave } from './state.js';
import { downloadBackup } from './backup.js';

const WHY = {
  QuotaExceededError: 'المساحة على هذا الجهاز ممتلئة',
  SecurityError: 'المتصفح يمنع التخزين (ربما التصفح الخاص)',
};

function paintSaveBar() {
  const bar = $('saveBar'); if (!bar) return;
  bar.hidden = storageState.ok;
  if (storageState.ok) return;
  $('saveWhy').textContent = (WHY[storageState.error] || 'تعذّر الكتابة في تخزين المتصفح') + '. ما فعلتَه الآن لن يبقى بعد إغلاق الصفحة.';
}

export function initGuard() {
  onStorageState(paintSaveBar);
  const exp = $('saveExport'), retry = $('saveRetry');
  if (exp) exp.addEventListener('click', () => { downloadBackup(); $('saveWhy').textContent = 'بدأ تنزيل نسخة احتياطية من كل بياناتك. احتفظ بالملف.' });
  if (retry) retry.addEventListener('click', () => { if (retrySave()) paintSaveBar(); else $('saveWhy').textContent = 'ما زال الحفظ غير ممكن. صدّر نسخة احتياطية أو حرّر مساحة ثم أعد المحاولة.' });
  paintSaveBar();
}

/* ---------- undo ---------- */
let timer = 0;
/** Shows "text [undo]" for a few seconds; the button runs fn once. A new offer replaces the old one. */
export function offerUndo(text, fn, ms = 9000) {
  const bar = $('undoBar'); if (!bar) return;
  clearTimeout(timer); bar.textContent = '';
  const b = el('button', 'btn', 'تراجع'); b.type = 'button';
  b.addEventListener('click', () => { clearTimeout(timer); bar.hidden = true; fn() });
  bar.append(el('span', '', text), b); bar.hidden = false;
  timer = setTimeout(() => { bar.hidden = true }, ms);
}
export function clearUndo() { clearTimeout(timer); const bar = $('undoBar'); if (bar) bar.hidden = true }
