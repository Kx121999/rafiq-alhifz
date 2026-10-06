// Gentle reminders for the morning and evening adhkar, bedtime adhkar and the daily review.
// Honest limits: there is no server, so a reminder can only appear while the site (or the installed app) is open, even in
// the background, on this device. It is not a guaranteed alarm. The notification only says what is due and never quotes any text.
// Settings belong to the device (hifz-remind-v1), not to a child; a reminder is skipped if that child already did the thing.
import { day } from './util.js';

const KEY = 'hifz-remind-v1';
const WINDOW_MIN = 180;      // a reminder is still shown up to three hours after its time (for example if the app was opened late)
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const SLOTS = [
  { id: 'sabah', label: 'أذكار الصباح', def: '06:30', url: '#/adhkar/sabah', body: () => 'حان وقت أذكار الصباح' },
  { id: 'masaa', label: 'أذكار المساء', def: '17:00', url: '#/adhkar/masaa', body: () => 'حان وقت أذكار المساء' },
  { id: 'nawm', label: 'أذكار النوم', def: '21:30', url: '#/adhkar/nawm', body: () => 'حان وقت أذكار النوم' },
  { id: 'review', label: 'مراجعة اليوم', def: '18:00', url: '#/review', body: () => 'عندك مراجعة اليوم' },
];

const fresh = () => ({ on: false, slots: Object.fromEntries(SLOTS.map(s => [s.id, { on: true, t: s.def }])), fired: {} });

/** Reads the settings, repairing anything that is not valid. */
export function loadRemind() {
  const cfg = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      cfg.on = raw.on === true;
      for (const s of SLOTS) {
        const r = raw.slots && raw.slots[s.id];
        if (r && typeof r === 'object') cfg.slots[s.id] = { on: r.on !== false, t: TIME.test(r.t) ? r.t : s.def };
      }
      if (raw.fired && typeof raw.fired === 'object') {
        for (const [d, ids] of Object.entries(raw.fired)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Array.isArray(ids)) cfg.fired[d] = ids.filter(i => SLOTS.some(s => s.id === i));
      }
    }
  } catch (e) {}
  return cfg;
}
export function saveRemind(cfg) {
  const keep = { [day()]: cfg.fired[day()] || [], [day(-1)]: cfg.fired[day(-1)] || [] };   // only the last two days are ever needed
  try { localStorage.setItem(KEY, JSON.stringify({ on: cfg.on, slots: cfg.slots, fired: keep })) } catch (e) {}
}

/**
 * Which reminders are due right now. ctx: { reviewDue: number, adhkarDone(slotId): boolean }.
 * A slot is due from its time until 3 hours later, once per day, and not when the work is already done.
 */
export function dueReminders(cfg, now, ctx) {
  if (!cfg.on) return [];
  const today = (cfg.fired || {})[dayOf(now)] || [], mins = now.getHours() * 60 + now.getMinutes(), out = [];
  for (const s of SLOTS) {
    const c = cfg.slots[s.id]; if (!c || !c.on || today.includes(s.id)) continue;
    const [h, m] = c.t.split(':').map(Number), at = h * 60 + m;
    if (mins < at || mins > at + WINDOW_MIN) continue;
    if (s.id === 'review' ? ctx.reviewDue <= 0 : ctx.adhkarDone(s.id)) continue;
    out.push(s.id);
  }
  return out;
}
const dayOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export const supported = () => typeof Notification !== 'undefined';
export const permission = () => supported() ? Notification.permission : 'denied';
/** Asks the browser for permission (must come from a tap). Resolves to 'granted' | 'denied' | 'default'. */
export const askPermission = () => supported() ? Notification.requestPermission().catch(() => 'denied') : Promise.resolve('denied');

/** Shows one notification, through the service worker when there is one (needed for installed apps on phones). */
export async function notify(title, body, tag, url) {
  if (permission() !== 'granted') return false;
  const opts = { body, tag, lang: 'ar', dir: 'rtl', icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { url } };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true }
    new Notification(title, opts); return true;
  } catch (e) { return false }
}

let context = () => ({ reviewDue: 0, adhkarDone: () => false });
/** main.js tells this module how to look up what is due for the active child. */
export const setReminderContext = fn => { context = fn };

export function tick(now = new Date()) {
  const cfg = loadRemind();
  const due = dueReminders(cfg, now, context());
  if (!due.length) return [];
  const ctx = context(), d = dayOf(now);
  cfg.fired[d] = [...(cfg.fired[d] || []), ...due];
  saveRemind(cfg);
  due.forEach(id => { const s = SLOTS.find(x => x.id === id); notify('رفيق الحفظ', s.body(), 'hifz-' + id, s.url) });
  return due;
}

export function initReminders() {
  setInterval(() => tick(), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() });
  tick();
}
