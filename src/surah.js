import { $, AR, day, icon } from './util.js';
import { Q, loadTafsir } from './data.js';
import { mem, rec, isWeak, weakList, isBookmarked, pinned } from './state.js';

/** The open surah (0 = index page), the study mode (read / listen / memorise / recite) and whether recitation hides the ayat. */
export const view = { cur: 0, veil: false, mode: 'read' };

const NOTES = {
  read: '',
  listen: 'اضغط «استمع» تحت أي آية، أو شغّل السورة من الشريط في الأسفل. يمكنك تكرار الآية أو مقطع كامل ووضع وقفة للتسميع.',
  memorise: 'علّم الآية بالدائرة حين تحفظها. التعليم بيدك أنت، وهو تقييم ذاتي.',
  recite: 'الآيات مخفية إلا كلمتها الأولى. اقرأ من حفظك ثم اضغط الآية لتتحقق.',
};

/** Switches the study mode: what is visible on the page follows from it (the CSS reads data-mode). */
export function setMode(mode) {
  view.mode = NOTES[mode] != null ? mode : 'read'; view.veil = view.mode === 'recite';
  const page = $('page-surah'); page.dataset.mode = view.mode;
  document.querySelectorAll('#modes .mode').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === view.mode));
  $('modeNote').textContent = NOTES[view.mode]; $('memTools').hidden = view.mode !== 'memorise';
  $('ayat').querySelectorAll('.shown').forEach(x => x.classList.remove('shown'));
  $('ayat').classList.toggle('veil', view.veil);
}

const btn = (cls, ic, label, text) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = cls;
  if (ic) b.appendChild(icon(ic));
  if (text) { const t = document.createElement('span'); t.textContent = text; b.appendChild(t) }
  if (label) b.setAttribute('aria-label', label);
  return b;
};

export function renderSurah(full) {
  const cur = view.cur, c = Q[cur - 1], tot = c.v.length, m = mem(cur), r = rec(cur);
  $('stName').textContent = 'سورة ' + c.n; $('listen').href = 'https://quran.com/' + cur;
  const weak = weakList().filter(a => a.id === cur).length;
  $('stMeta').textContent = (c.t ? 'مدنية' : 'مكية') + ' · ' + AR(tot) + ' آية · ' + (m ? 'حفظتَ ' + AR(m) : 'لم تبدأ حفظها بعد') + (weak ? ' · ' + AR(weak) + ' تحتاج تثبيتًا' : '');
  const pct = (tot ? m / tot * 100 : 0).toFixed(1) + '%', road = $('jtrack');
  $('jfill').style.width = pct;
  road.setAttribute('aria-valuemax', tot); road.setAttribute('aria-valuenow', m); road.setAttribute('aria-valuetext', AR(m) + ' من ' + AR(tot) + ' آية');
  road.classList.toggle('done', tot > 0 && m === tot);
  $('allBtn').textContent = m === tot ? 'إلغاء حفظ السورة' : 'حفظتُ السورة كاملة';
  const pin = $('pinBtn'), on = pinned().includes(cur);
  pin.setAttribute('aria-pressed', on); pin.querySelector('span').textContent = on ? 'السورة مثبّتة' : 'تثبيت السورة';
  const b = $('basmala'); b.hidden = (cur === 1 || cur === 9); b.textContent = Q[0].v[0];
  const ol = $('ayat'); ol.classList.toggle('veil', view.veil);
  if (full) {
    ol.textContent = '';
    c.v.forEach((t, i) => {
      const sp = t.indexOf(' '), first = sp > 0 ? t.slice(0, sp) : '', rest = sp > 0 ? t.slice(sp) : t;
      const li = document.createElement('li'); li.className = 'ay'; li.dataset.i = i;
      const tx = document.createElement('div'); tx.className = 'tx'; tx.tabIndex = 0;
      const r1 = document.createElement('span'); r1.className = 'rest'; r1.textContent = rest;
      const e = document.createElement('span'); e.className = 'end'; e.textContent = AR(i + 1);
      tx.append(first, r1, e);
      const ck = btn('ck', '', 'حفظتُ الآية ' + AR(i + 1));
      const body = document.createElement('div'); body.className = 'body';
      const tf = btn('tf', 'bulb', '', 'التفسير'); tf.setAttribute('aria-expanded', 'false');
      const tfx = document.createElement('div'); tfx.className = 'tfx'; tfx.hidden = true;
      const pl = btn('pl', 'play', 'استمع من الآية ' + AR(i + 1), 'استمع');
      const bm = btn('bm', 'bookmark', '', '');
      const wk = btn('wk', 'flag', '', ''); wk.hidden = true;
      const row = document.createElement('div'); row.className = 'arow'; row.append(pl, bm, wk, tf);
      body.append(tx, row, tfx); li.append(body, ck); ol.appendChild(li);
    });
  }
  ol.querySelectorAll('.ck').forEach((ck, i) => ck.setAttribute('aria-pressed', !!r && r.m[i] === '1'));
  ol.querySelectorAll('.bm').forEach((bm, i) => {
    const on2 = isBookmarked(cur, i);
    bm.setAttribute('aria-pressed', on2); bm.setAttribute('aria-label', (on2 ? 'إزالة العلامة من الآية ' : 'ضع علامة عند الآية ') + AR(i + 1));
  });
  ol.querySelectorAll('.wk').forEach((wk, i) => {
    const memorised = !!r && r.m[i] === '1', weakNow = isWeak(cur, i);
    wk.hidden = !memorised; wk.setAttribute('aria-pressed', weakNow);
    wk.replaceChildren(icon('flag'), Object.assign(document.createElement('span'), { textContent: weakNow ? 'ضعيفة' : 'علّمها ضعيفة' }));
    wk.setAttribute('aria-label', (weakNow ? 'إلغاء تعليم الآية ' : 'علّم الآية ') + AR(i + 1) + (weakNow ? ' كضعيفة' : ' كضعيفة تحتاج تثبيتًا'));
  });
  const rv = $('review'); rv.hidden = !m;
  if (m) {
    const due = r.d <= day();
    $('revText').textContent = due ? 'حان موعد مراجعة هذه السورة. سمّع ما حفظتَه منها ثم قيّم مراجعتك.'
      : 'المراجعة القادمة: ' + new Date(r.d + 'T12:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
  }
}

const MARK = '[التفسير]';
export async function toggleTafsir(li) {
  const b = li.querySelector('.tf'), x = li.querySelector('.tfx'), label = b.querySelector('span');
  if (!x.hidden) { x.hidden = true; b.setAttribute('aria-expanded', 'false'); label.textContent = 'التفسير'; return }
  const id = view.cur, i = +li.dataset.i; label.textContent = 'جارٍ تحميل التفسير…';
  let T;
  try { T = await loadTafsir() } catch (e) { label.textContent = 'تعذّر تحميل التفسير. اضغط للمحاولة مجددًا'; return }
  if (id !== view.cur) return;
  const t = T[id - 1][i] || '', k = t.indexOf(MARK); x.textContent = '';
  if (k >= 0) { const pre = document.createElement('span'); pre.className = 'pre'; pre.textContent = t.slice(0, k).trim(); x.append(pre, t.slice(k + MARK.length).trim()) }
  else x.textContent = t.trim();
  x.hidden = false; b.setAttribute('aria-expanded', 'true'); label.textContent = 'إخفاء التفسير';
}
