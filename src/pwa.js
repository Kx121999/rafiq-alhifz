// Install button, offline notice and the service worker (production builds only).
// The browser only offers one-tap installation in some cases (Chrome on Android, when it decides the site is installable),
// never on iPhone and never inside the browser built into WhatsApp, Facebook and the like. So the button is always shown
// (unless the app is already installed): one tap installs when the browser allows it, otherwise it explains how, for this phone.
import { $, el } from './util.js';

/** What to tell this phone. Pure, so it can be tested: returns {kind, title, steps}. */
export function installGuide(ua = '', env = {}) {
  const iosDevice = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && env.touch > 1);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|MicroMessenger|musical_ly|TikTok|Bytedance|Twitter|LinkedInApp|; wv\)|WhatsApp/i.test(ua);
  // a web view inside another iPhone app (WhatsApp, Telegram…) has no "Safari" in its identity, unlike Safari and Chrome
  const iosWebView = iosDevice && !/Safari\//i.test(ua);
  if (inApp || iosWebView) return { kind: 'inapp', title: 'افتح الرابط في المتصفح أولًا', steps: [
    'أنت تفتح الموقع من داخل تطبيق آخر (مثل واتساب أو فيسبوك)، وهذه النوافذ لا تدعم تثبيت التطبيقات.',
    'اضغط القائمة ⋮ أو زر المشاركة في أعلى الشاشة ثم «فتح في المتصفح» (كروم أو سفاري).',
    'بعدها اضغط «ثبّت التطبيق» مرة أخرى.'] };
  if (iosDevice) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)) return { kind: 'ios-other', title: 'على الآيفون يتم التثبيت من سفاري', steps: [
      'افتح هذا الرابط في متصفح سفاري (انسخ الرابط والصقه هناك).',
      'اضغط زر المشاركة (مربع بسهم لأعلى) في أسفل الشاشة.',
      'اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».'] };
    return { kind: 'ios', title: 'التثبيت على الآيفون', steps: [
      'اضغط زر المشاركة (مربع بسهم لأعلى) في أسفل شاشة سفاري.',
      'مرّر للأسفل واختر «إضافة إلى الشاشة الرئيسية».',
      'اضغط «إضافة». ستجد أيقونة رفيق الحفظ بين تطبيقاتك.'] };
  }
  if (/SamsungBrowser/i.test(ua)) return { kind: 'samsung', title: 'التثبيت من متصفح سامسونج', steps: [
    'اضغط قائمة المتصفح ☰ (الخطوط الثلاثة) في أسفل الشاشة.',
    'اختر «إضافة الصفحة إلى» ثم «الشاشة الرئيسية» (أو «تثبيت التطبيق»).',
    'اضغط «إضافة».'] };
  if (/Firefox/i.test(ua) && /Android/i.test(ua)) return { kind: 'firefox', title: 'التثبيت من فايرفوكس', steps: [
    'اضغط القائمة ⋮ في أعلى أو أسفل الشاشة.',
    'اختر «تثبيت» (أو «إضافة إلى الشاشة الرئيسية»).',
    'اضغط «إضافة».'] };
  if (/Android/i.test(ua)) return { kind: 'android', title: 'التثبيت على أندرويد', steps: [
    'اضغط القائمة ⋮ في أعلى متصفح كروم.',
    'اختر «تثبيت التطبيق» (أو «إضافة إلى الشاشة الرئيسية»).',
    'اضغط «تثبيت». ستجد أيقونة رفيق الحفظ بين تطبيقاتك.'] };
  return { kind: 'desktop', title: 'تثبيت التطبيق', steps: [
    'في كروم أو إيدج على الكمبيوتر: اضغط أيقونة التثبيت في شريط العنوان (بجانب النجمة).',
    'أو من القائمة ⋮ اختر «تثبيت رفيق الحفظ».',
    'على الموبايل افتح الموقع في كروم (أندرويد) أو سفاري (آيفون).'] };
}

export const isInstalled = (win = window) => (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) || win.navigator.standalone === true;

export function initPwa() {
  const btn = $('installBtn');
  let deferred = null;
  btn.hidden = isInstalled();   // already running as an installed app: nothing to install
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false });
  addEventListener('appinstalled', () => { deferred = null; btn.hidden = true });

  const dlg = $('installDlg');
  const showGuide = () => {
    const g = installGuide(navigator.userAgent, { touch: navigator.maxTouchPoints });
    $('installT').textContent = g.title;
    const ol = $('installSteps'); ol.textContent = '';
    g.steps.forEach(s => ol.appendChild(el('li', '', s)));
    dlg.showModal();
  };
  btn.addEventListener('click', async () => {
    if (!deferred) { showGuide(); return }              // the browser has not offered one-tap install: explain it
    deferred.prompt();
    try { await deferred.userChoice } catch (e) {}
    deferred = null; btn.hidden = isInstalled();
  });
  document.querySelectorAll('[data-install]').forEach(b => b.addEventListener('click', () => btn.click()));

  const note = $('netNote'), sync = () => { note.hidden = navigator.onLine };
  addEventListener('online', sync); addEventListener('offline', sync); sync();

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
    // a new release took over: offer a reload (not on the very first install)
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) $('updateBar').hidden = false });
    $('updateReload').addEventListener('click', () => location.reload());
  }
}
