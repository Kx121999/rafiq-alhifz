// The backup card: export, import with a preview of what will happen, and a restore point kept before anything is replaced.
// Nothing here changes the children's data until the parent chooses, and an import is all or nothing.
import { AR, el } from './util.js';
import { applyImport, storageState } from './state.js';
import { downloadBackup, lastExport, parseBackup, makeRestorePoint, restorePoint, dropRestorePoint, kidSummary } from './backup.js';

const when = d => d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

/** onChange runs after the data changed (so the page can redraw). */
export function backupSection(onChange) {
  const card = el('section', 'kcard');
  const msg = el('p', 'note'); msg.setAttribute('role', 'status');
  const choice = el('div', 'importbox'); choice.hidden = true;
  const last = lastExport();
  const hint = el('p', 'note', last ? 'آخر نسخة احتياطية: ' + when(last) + '.' : 'لم تُصدَّر نسخة احتياطية بعد. صدّر نسخة بين الحين والآخر، فالتقدّم محفوظ في هذا المتصفح فقط.');
  const exp = el('button', 'btn primary', 'تصدير نسخة احتياطية'); exp.type = 'button';
  exp.addEventListener('click', () => { downloadBackup(); msg.textContent = 'بدأ تنزيل الملف. احتفظ به في مكان آمن، ويمكنك استيراده على أي جهاز.'; hint.textContent = 'آخر نسخة احتياطية: اليوم.' });
  const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
  const imp = el('button', 'btn', 'استيراد من ملف'); imp.type = 'button';
  imp.addEventListener('click', () => file.click());

  const failed = () => 'لم يتم الاستيراد لأن المتصفح رفض الحفظ (المساحة ممتلئة أو غير متاحة). لم يتغيّر شيء من بياناتك الحالية.';

  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = ''; choice.hidden = true; choice.textContent = ''; msg.textContent = '';
    if (!f) return;
    const r = parseBackup(f.size > 2e6 ? null : await f.text());
    if (r.error) { msg.textContent = r.error + ' لم يتغيّر شيء من بياناتك.'; return }
    // the preview: who is in the file and how much each child has done
    choice.appendChild(el('p', '', 'يحتوي الملف على ' + AR(r.kids.length) + (r.kids.length === 1 ? ' طفل:' : ' أطفال:') + (r.skipped ? ' (تم تجاهل ' + AR(r.skipped) + ' عنصر غير صالح)' : '')));
    const ul = el('ul', 'dllist');
    r.kids.forEach(k => { const s = kidSummary(k), li = el('li'); li.append(el('span', '', k.icon + ' ' + k.name), el('span', 'note', AR(s.ay) + ' آية · ' + AR(s.done) + ' سورة مكتملة')); ul.appendChild(li) });
    choice.appendChild(ul);
    choice.appendChild(el('p', 'note', '«إضافة»: يُضاف الأطفال كملفات جديدة بجانب ملفاتك الحالية ولا يُمسّ شيء منها (وإن تكرّر اسم يُضاف له رقم). «استبدال»: تُستبدل كل الملفات الحالية، ونحتفظ بنسخة منها تستطيع الرجوع إليها.'));
    const add = el('button', 'btn primary', 'إضافتهم كملفات جديدة'); add.type = 'button';
    add.addEventListener('click', () => {
      if (!applyImport(r.kids, 'append')) { msg.textContent = failed(); return }
      choice.hidden = true; choice.textContent = ''; msg.textContent = 'تمت الإضافة. أصبح عندك ' + AR(r.kids.length) + (r.kids.length === 1 ? ' ملف جديد.' : ' ملفات جديدة.'); onChange();
    });
    const rep = el('button', 'btn danger', 'استبدال كل البيانات الحالية'); rep.type = 'button';
    rep.addEventListener('click', () => {
      const kept = makeRestorePoint();
      const ask = kept ? 'ستُستبدل كل الملفات الحالية بمحتوى الملف. نحتفظ بنسخة منها لترجع إليها إن أردت. هل تتابع؟'
        : 'تعذّر الاحتفاظ بنسخة من بياناتك الحالية (المساحة ممتلئة)، وإن تابعتَ فلن تستطيع الرجوع إليها. صدّر نسخة احتياطية أولًا. هل تتابع رغم ذلك؟';
      if (!confirm(ask)) { if (kept) dropRestorePoint(); return }
      if (!applyImport(r.kids, 'replace')) { msg.textContent = failed(); return }
      choice.hidden = true; choice.textContent = ''; msg.textContent = 'تم الاستبدال.' + (kept ? ' إن أخطأتَ يمكنك الرجوع بزر «استرجع ما قبل الاستيراد».' : ''); onChange();
    });
    const no = el('button', 'btn', 'إلغاء'); no.type = 'button'; no.addEventListener('click', () => { choice.hidden = true; choice.textContent = '' });
    const acts = el('div', 'acts'); acts.append(add, rep, no); choice.appendChild(acts); choice.hidden = false;
  });

  const acts = el('div', 'acts'); acts.append(exp, imp, file);
  card.append(el('h2', '', 'النسخ الاحتياطي'), hint, acts, choice, msg);

  // a kept copy from before an earlier replace
  const pt = restorePoint();
  if (pt) {
    const box = el('div', 'importbox');
    box.appendChild(el('p', 'note', 'عندك نسخة محفوظة من بياناتك قبل آخر استبدال (' + when(pt.at) + '، ' + AR(pt.kids.length) + (pt.kids.length === 1 ? ' طفل' : ' أطفال') + ').'));
    const back = el('button', 'btn', 'استرجع ما قبل الاستيراد'); back.type = 'button';
    back.addEventListener('click', () => {
      if (!confirm('سيُستبدل ما عندك الآن بالنسخة المحفوظة. هل تتابع؟')) return;
      if (!applyImport(pt.kids, 'replace')) { msg.textContent = failed(); return }
      dropRestorePoint(); msg.textContent = 'تم الاسترجاع.'; onChange();
    });
    const drop = el('button', 'btn', 'احذف النسخة المحفوظة'); drop.type = 'button';
    drop.addEventListener('click', () => { dropRestorePoint(); box.remove() });
    const a = el('div', 'acts'); a.append(back, drop); box.appendChild(a); card.appendChild(box);
  }
  if (!storageState.ok) card.appendChild(el('p', 'note', '⚠️ الحفظ على هذا الجهاز لا يعمل الآن، فالتصدير هو الطريقة الوحيدة لحفظ تقدّمك.'));
  return card;
}
