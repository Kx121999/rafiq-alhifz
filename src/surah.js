import { $, AR, day } from './util.js';
import { Q, loadTafsir } from './data.js';
import { mem, rec } from './state.js';

/** The open surah (0 = index page) and whether recitation mode hides the ayat. */
export const view = { cur: 0, veil: false };

export function renderSurah(full) {
  const cur = view.cur, c = Q[cur - 1], tot = c.v.length, m = mem(cur), r = rec(cur);
  $('stName').textContent = 'سورة ' + c.n; $('listen').href = 'https://quran.com/' + cur;
  $('stMeta').textContent = (c.t ? 'مدنية' : 'مكية') + ' · حفظتَ ' + AR(m) + ' من ' + AR(tot) + ' آية';
  $('allBtn').textContent = m === tot ? 'إلغاء حفظ السورة' : 'حفظتُ السورة كاملة';
  $('veilBtn').setAttribute('aria-pressed', view.veil); $('veilNote').hidden = !view.veil;
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
      const ck = document.createElement('button'); ck.type = 'button'; ck.className = 'ck';
      ck.setAttribute('aria-label', 'حفظتُ الآية ' + AR(i + 1));
      const body = document.createElement('div'); body.className = 'body';
      const tf = document.createElement('button'); tf.type = 'button'; tf.className = 'tf'; tf.textContent = 'التفسير'; tf.setAttribute('aria-expanded', 'false');
      const tfx = document.createElement('div'); tfx.className = 'tfx'; tfx.hidden = true;
      body.append(tx, tf, tfx); li.append(body, ck); ol.appendChild(li);
    });
  }
  ol.querySelectorAll('.ck').forEach((ck, i) => ck.setAttribute('aria-pressed', !!r && r.m[i] === '1'));
  const rv = $('review'); rv.hidden = !m;
  if (m) {
    const due = r.d <= day();
    $('revText').textContent = due ? 'حان موعد مراجعة هذه السورة. سمّع ما حفظتَه منها ثم قيّم مراجعتك.'
      : 'المراجعة القادمة: ' + new Date(r.d + 'T12:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
  }
}

const MARK = '[التفسير]';
export async function toggleTafsir(li) {
  const b = li.querySelector('.tf'), x = li.querySelector('.tfx');
  if (!x.hidden) { x.hidden = true; b.setAttribute('aria-expanded', 'false'); b.textContent = 'التفسير'; return }
  const id = view.cur, i = +li.dataset.i; b.textContent = 'جارٍ تحميل التفسير…';
  let T;
  try { T = await loadTafsir() } catch (e) { b.textContent = 'تعذّر تحميل التفسير. اضغط للمحاولة مجددًا'; return }
  if (id !== view.cur) return;
  const t = T[id - 1][i] || '', k = t.indexOf(MARK); x.textContent = '';
  if (k >= 0) { const pre = document.createElement('span'); pre.className = 'pre'; pre.textContent = t.slice(0, k).trim(); x.append(pre, t.slice(k + MARK.length).trim()) }
  else x.textContent = t.trim();
  x.hidden = false; b.setAttribute('aria-expanded', 'true'); b.textContent = 'إخفاء التفسير';
}
