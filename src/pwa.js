// Install button, offline notice and the service worker (production builds only).
import { $ } from './util.js';

export function initPwa() {
  const btn = $('installBtn');
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false });
  addEventListener('appinstalled', () => { deferred = null; btn.hidden = true });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice } catch (e) {}
    deferred = null; btn.hidden = true;
  });

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
