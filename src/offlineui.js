// The screens for downloading recitations: a box under the surah (download, progress, remove) and the list in the parent corner.
import { $, AR, el } from './util.js';
import { Q } from './data.js';
import { currentReciter, reciterLabel } from './player.js';
import { supported, estimateBytes, isBig, mb, downloadedInfo, downloadSurah, removeSurah, removeAll, listDownloads, totalBytes } from './offline.js';
import { announce } from './motion.js';

let job = null;   // the one download in progress: {id, reciter, ctrl, done, total}
const WHY = {
  network: 'انقطع الاتصال. ما تم تنزيله محفوظ، حاول مرة أخرى وسيكمل من حيث توقف.',
  space: 'لا توجد مساحة كافية على هذا الجهاز. احذف تنزيلات قديمة أو حرّر مساحة.',
  cancelled: 'أُلغي التنزيل. ما تم تنزيله محفوظ.',
};

/** Fills the box under the surah for surah id with the reciter chosen in the player. */
export function renderOffline(id) {
  const box = $('offline'); if (!box) return;
  box.textContent = '';
  if (!supported() || !Q.length || !id) { box.hidden = true; return }
  box.hidden = false;
  const reciter = currentReciter(), who = reciterLabel(reciter), c = Q[id - 1];
  box.appendChild(el('h2', '', '🎧 الاستماع بدون إنترنت'));
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const acts = el('div', 'acts');

  if (job && job.id === id && job.reciter === reciter) {
    const bar = el('div', 'bar'), fill = el('i'); bar.appendChild(fill);
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(job.total)); bar.setAttribute('aria-label', 'تقدّم التنزيل');
    const paint = () => { fill.style.width = Math.round(job.done / job.total * 100) + '%'; bar.setAttribute('aria-valuenow', String(job.done)); msg.textContent = 'جارٍ تنزيل سورة ' + c.n + ' بصوت ' + who + ': ' + AR(job.done) + ' من ' + AR(job.total) };
    job.paint = paint; paint();
    const stop = el('button', 'btn', 'إلغاء'); stop.type = 'button'; stop.addEventListener('click', () => job && job.ctrl.abort());
    acts.appendChild(stop); box.append(bar, msg, acts); return;
  }

  const info = downloadedInfo(id, reciter);
  if (info) {
    box.appendChild(el('p', 'good', '✅ سورة ' + c.n + ' بصوت ' + who + ' محمّلة (' + AR(mb(info.bytes)) + ' م.ب.) وتعمل بدون إنترنت.'));
    const del = el('button', 'btn', 'احذف التنزيل'); del.type = 'button';
    del.addEventListener('click', async () => { await removeSurah(id, reciter); renderOffline(id); const m = $('offline').querySelector('[role=status]'); if (m) m.textContent = 'تم حذف التنزيل.' });
    acts.appendChild(del); box.append(acts, msg); return;
  }

  const bytes = estimateBytes(id, reciter);
  box.appendChild(el('p', 'note', 'نزّل سورة ' + c.n + ' بصوت ' + who + ' لتسمعها في أي مكان بلا إنترنت. الحجم حوالي ' + AR(mb(bytes)) + ' م.ب.'));
  const go = el('button', 'btn primary', '⬇ نزّل السورة'); go.type = 'button';
  go.addEventListener('click', async () => {
    if (isBig(bytes) && !confirm('هذه سورة كبيرة (حوالي ' + AR(mb(bytes)) + ' م.ب.). يفضّل التنزيل على شبكة واي فاي. هل تكمل؟')) return;
    job = { id, reciter, ctrl: new AbortController(), done: 0, total: 1, paint: null };
    const mine = job; renderOffline(id);
    const r = await downloadSurah(id, reciter, { signal: mine.ctrl.signal, onProgress: (d, t) => { mine.done = d; mine.total = t; if (mine.paint) mine.paint() } });
    job = null;
    const shown = $('offline') && !$('offline').hidden;
    if (shown) renderOffline(id);
    if (r.ok) announce('تم تنزيل سورة ' + c.n + ' 🎧');
    else { const m = $('offline') && $('offline').querySelector('[role=status]'); if (m) m.textContent = WHY[r.error] || WHY.network }
  });
  acts.appendChild(go);
  box.append(acts, msg, el('p', 'note', 'على الآيفون: ثبّت التطبيق (من «عن المنصة») حتى لا يمسح سفاري التنزيلات إن لم تفتح الموقع أسبوعًا.'));
}

/** The list of downloaded recitations for the parent corner, with delete buttons. Returns null when there is nothing. */
export function downloadsList(onChange) {
  const items = listDownloads(); if (!items.length) return null;
  const box = el('div', 'dlist');
  box.appendChild(el('p', 'note', 'التلاوات المحمّلة على هذا الجهاز: ' + AR(items.length) + ' (' + AR(mb(totalBytes())) + ' م.ب.)'));
  const ul = el('ul', 'dllist');
  items.forEach(it => {
    const li = el('li'); li.append(el('span', '', 'سورة ' + it.surah + ' · ' + it.reciterName + ' · ' + AR(mb(it.bytes)) + ' م.ب.'));
    const b = el('button', 'btn', 'حذف'); b.type = 'button'; b.setAttribute('aria-label', 'حذف تنزيل سورة ' + it.surah + ' بصوت ' + it.reciterName);
    b.addEventListener('click', async () => { await removeSurah(it.id, it.reciter); onChange() });
    li.appendChild(b); ul.appendChild(li);
  });
  const all = el('button', 'btn danger', 'احذف كل التنزيلات'); all.type = 'button';
  all.addEventListener('click', async () => { if (confirm('حذف كل التلاوات المحمّلة؟ يمكنك تنزيلها مرة أخرى.')) { await removeAll(); onChange() } });
  box.append(ul, all);
  return box;
}
