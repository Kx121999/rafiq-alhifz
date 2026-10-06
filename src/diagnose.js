// "Check this device": finds out, on the device itself, what the site can and cannot do there (install, offline, saved
// progress, notifications, sharing, sound) and says what to do about each. Nothing is sent anywhere; the result can be copied.
import { $, AR, el } from './util.js';
import { Q } from './data.js';
import { loadAdhkar } from './data.js';
import { ayahUrl } from './player.js';

const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const MARK = { ok: 'سليم', warn: 'تنبيه', bad: 'مشكلة' };       // words, for the copied report
const GLYPH = { ok: '✓', warn: '!', bad: '✕' };               // plain marks on the screen (the colour is never the only sign)

/** Runs every check. env can be replaced in tests; each check is wrapped so one failing never stops the others. */
export async function runChecks(env = {}) {
  const nav = env.nav || navigator, win = env.win || window, doc = env.doc || document, store = env.store || localStorage;
  const out = [], add = (id, label, status, detail) => out.push({ id, label, status, detail });
  const safe = async (id, label, fn) => { try { await fn() } catch (e) { add(id, label, 'bad', 'تعذّر الفحص: ' + String(e && e.message || e).slice(0, 80)) } };

  add('build', 'نسخة الموقع', 'ok', 'رقم النسخة: ' + BUILD);

  await safe('secure', 'اتصال آمن (HTTPS)', async () => {
    const ok = win.isSecureContext !== false;
    add('secure', 'اتصال آمن (HTTPS)', ok ? 'ok' : 'bad', ok ? 'مطلوب للتثبيت والإشعارات، وهو متوفر.' : 'الصفحة ليست على اتصال آمن، فلن تعمل التثبيت ولا الإشعارات.');
  });

  await safe('install', 'تثبيت التطبيق', async () => {
    const standalone = (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
    const ios = /iphone|ipad|ipod/i.test(nav.userAgent || '');
    add('install', 'تثبيت التطبيق', standalone ? 'ok' : 'warn',
      standalone ? 'يعمل الآن كتطبيق مثبّت.' : ios ? 'يعمل داخل المتصفح. للتثبيت: زر المشاركة في سفاري ثم «إضافة إلى الشاشة الرئيسية».' : 'يعمل داخل المتصفح. للتثبيت: زر «ثبّت التطبيق» في الصفحة الرئيسية أو من قائمة المتصفح.');
  });

  await safe('offline', 'العمل بدون إنترنت', async () => {
    if (!('serviceWorker' in nav)) return add('offline', 'العمل بدون إنترنت', 'bad', 'هذا المتصفح لا يدعم العمل بدون إنترنت.');
    const reg = await nav.serviceWorker.getRegistration();
    if (!reg) return add('offline', 'العمل بدون إنترنت', 'warn', 'لم يُجهَّز بعد. أعد فتح الصفحة مرة واحدة وهي متصلة بالإنترنت ثم أعد الفحص.');
    add('offline', 'العمل بدون إنترنت', nav.serviceWorker.controller ? 'ok' : 'warn', nav.serviceWorker.controller ? 'جاهز: المصحف والأذكار وتقدّمك تعمل بدون إنترنت.' : 'مسجَّل لكنه لم يتسلّم الصفحة بعد. أعد فتح الصفحة ثم أعد الفحص.');
  });

  await safe('storage', 'حفظ التقدّم على الجهاز', async () => {
    const k = 'hifz-check-' + Date.now();
    try { store.setItem(k, '1'); const ok = store.getItem(k) === '1'; store.removeItem(k); if (!ok) throw new Error() }
    catch (e) { return add('storage', 'حفظ التقدّم على الجهاز', 'bad', 'لا يمكن الحفظ في هذا المتصفح (ربما التصفح الخاص). لن يبقى التقدّم.') }
    let note = 'يعمل.';
    if (nav.storage && nav.storage.persisted) {
      const p = await nav.storage.persisted();
      note += p ? ' والمتصفح لن يمسح بياناتك تلقائيًا.' : ' لكن المتصفح قد يمسح البيانات إن امتلأت المساحة، فصدّر نسخة احتياطية من ركن الأهل من وقت لآخر.';
      if (nav.storage.estimate) { const e = await nav.storage.estimate(); if (e && e.usage != null) note += ' المساحة المستخدمة: ' + (e.usage / 1048576).toFixed(1) + ' م.ب.' }
    }
    add('storage', 'حفظ التقدّم على الجهاز', 'ok', note);
  });

  await safe('data', 'المصحف والأذكار', async () => {
    const a = await loadAdhkar();
    const ok = Q.length === 114 && a.length === 132;
    add('data', 'المصحف والأذكار', ok ? 'ok' : 'bad', ok ? 'تم تحميل ' + AR(Q.length) + ' سورة و' + AR(a.length) + ' قسمًا من الأذكار.' : 'البيانات غير مكتملة (' + Q.length + ' سورة): أعد فتح الصفحة.');
  });

  await safe('fonts', 'الخطوط', async () => {
    const ok = doc.fonts && doc.fonts.check('600 20px "IBM Plex Sans Arabic"') && doc.fonts.check('800 40px "Baloo Bhaijaan 2"');
    add('fonts', 'الخطوط', ok ? 'ok' : 'warn', ok ? 'محمّلة.' : 'لم تُحمَّل كلها (يحتاج أول فتح إنترنت). يعمل الموقع بخط بديل.');
  });

  await safe('notify', 'الإشعارات (التذكيرات)', async () => {
    if (typeof win.Notification === 'undefined') return add('notify', 'الإشعارات (التذكيرات)', 'warn', 'غير مدعومة هنا. على الآيفون تحتاج تثبيت التطبيق وiOS 16.4 أو أحدث.');
    const p = win.Notification.permission;
    add('notify', 'الإشعارات (التذكيرات)', p === 'granted' ? 'ok' : 'warn', p === 'granted' ? 'مسموح بها.' : p === 'denied' ? 'محجوبة. فعّلها من إعدادات المتصفح للموقع.' : 'مدعومة، ولم تُفعَّل بعد: فعّلها من ركن الأهل.');
  });

  await safe('share', 'مشاركة بطاقة الإنجاز', async () => {
    let can = false;
    try { can = !!(nav.canShare && nav.canShare({ files: [new win.File([new win.Blob(['x'])], 'a.png', { type: 'image/png' })] })) } catch (e) {}
    add('share', 'مشاركة بطاقة الإنجاز', can ? 'ok' : 'warn', can ? 'زر المشاركة يعمل (واتساب وغيره).' : 'لا تدعم المشاركة المباشرة هنا، لكن يمكنك «حفظ الصورة» ثم إرسالها.');
  });

  await safe('sound', 'الأصوات القصيرة', async () => {
    const ok = !!(win.AudioContext || win.webkitAudioContext);
    add('sound', 'الأصوات القصيرة', ok ? 'ok' : 'warn', ok ? 'مدعومة (تُفعَّل من ركن الأهل).' : 'غير مدعومة في هذا المتصفح.');
  });

  await safe('canvas', 'رسم البطاقة', async () => {
    const c = doc.createElement('canvas'), ok = !!(c.getContext && c.getContext('2d'));
    add('canvas', 'رسم البطاقة', ok ? 'ok' : 'warn', ok ? 'يعمل.' : 'غير مدعوم: لن تظهر بطاقة الإنجاز.');
  });

  add('online', 'الاتصال الآن', nav.onLine === false ? 'warn' : 'ok', nav.onLine === false ? 'غير متصل: التلاوات تحتاج إنترنت.' : 'متصل.');
  add('screen', 'الشاشة', 'ok', AR(win.innerWidth || 0) + ' × ' + AR(win.innerHeight || 0) + ' بكسل، الكثافة ' + AR(win.devicePixelRatio || 1) + '، اللغة ' + (nav.language || '؟'));
  return out;
}

export function reportText(rows, ua = '') {
  return ['فحص جهاز: رفيق الحفظ', ...rows.map(r => MARK[r.status] + ' · ' + r.label + ': ' + r.detail), ua ? 'المتصفح: ' + ua : ''].filter(Boolean).join('\n');
}

/** Plays the first ayah of Al-Fatiha for a moment and says whether sound came out. */
export function testAudio(Audio_ = Audio, timeout = 8000) {
  return new Promise(res => {
    const a = new Audio_(ayahUrl(1, 1)); let done = false;
    const finish = (ok, why) => { if (done) return; done = true; try { a.pause() } catch (e) {} clearTimeout(t); res({ ok, why }) };
    const t = setTimeout(() => finish(false, 'لم يبدأ الصوت خلال ' + AR(timeout / 1000) + ' ثوانٍ: تحقق من الإنترنت.'), timeout);
    a.addEventListener('playing', () => setTimeout(() => finish(true, 'بدأ الصوت بنجاح.'), 1500));
    a.addEventListener('error', () => finish(false, 'تعذّر تحميل التلاوة: تحقق من الإنترنت.'));
    const p = a.play(); if (p && p.catch) p.catch(e => finish(false, e && e.name === 'NotAllowedError' ? 'المتصفح منع تشغيل الصوت. اضغط الزر مرة أخرى.' : 'تعذّر تشغيل الصوت.'));
  });
}

export function initCheck() {
  const run = $('chkRun'); if (!run) return;
  const rowsBox = $('chkRows'), msg = $('chkMsg'), copy = $('chkCopy');
  let last = [];
  const paint = rows => {
    rowsBox.textContent = '';
    rows.forEach(r => {
      const li = el('li', 'chkrow ' + r.status), m = el('span', 'chkmark', GLYPH[r.status]); m.setAttribute('aria-hidden', 'true');
      const t = el('div'); t.append(el('b', '', r.label), el('span', '', r.detail));
      li.append(m, el('span', 'sr', r.status === 'ok' ? 'سليم: ' : r.status === 'warn' ? 'تنبيه: ' : 'مشكلة: '), t); rowsBox.appendChild(li);
    });
  };
  run.addEventListener('click', async () => {
    run.disabled = true; msg.textContent = 'جارٍ الفحص…';
    last = await runChecks(); paint(last); run.disabled = false; copy.hidden = false;
    const bad = last.filter(r => r.status === 'bad').length, warn = last.filter(r => r.status === 'warn').length;
    msg.textContent = bad ? 'وُجدت ' + AR(bad) + ' مشكلة. اقرأ التفاصيل أعلاه.' : warn ? 'لا مشاكل، وهناك ' + AR(warn) + ' تنبيه للتحسين.' : 'كل شيء سليم';
  });
  $('chkAudio').addEventListener('click', async () => {
    msg.textContent = 'جارٍ اختبار الصوت…';
    const r = await testAudio(); msg.textContent = (r.ok ? 'سليم: ' : 'مشكلة: ') + r.why;
    last = last.filter(x => x.id !== 'audio'); last.push({ id: 'audio', label: 'تشغيل التلاوة', status: r.ok ? 'ok' : 'bad', detail: r.why }); paint(last); copy.hidden = false;
  });
  copy.addEventListener('click', async () => {
    const text = reportText(last, navigator.userAgent);
    try { await navigator.clipboard.writeText(text); msg.textContent = 'تم نسخ التقرير.' }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); msg.textContent = 'تم نسخ التقرير.' } catch (e2) { msg.textContent = 'تعذّر النسخ تلقائيًا، التقط صورة للشاشة.' } ta.remove() }
  });
}
