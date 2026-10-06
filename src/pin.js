// A local PIN for the parents' area. It only keeps a child who is playing from wandering into the settings: it lives on this
// device, it is not in the backup file, and nothing is sent anywhere. It is not an account and it is not cloud security,
// and the site says so. The PIN is stored as a salted SHA-256 hash, never as the digits.
const KEY = 'hifz-pin-v1';
export const PIN_RE = /^\d{4,6}$/;
export const MAX_TRIES = 5, LOCK_MS = 30000;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function digest(salt, pin) {
  const text = salt + ':' + pin;
  if (globalThis.crypto && crypto.subtle) return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);   // very old browsers only: a weak fallback is still better than the digits
  return 'f' + (h >>> 0).toString(16);
}
const read = () => { try { const o = JSON.parse(localStorage.getItem(KEY)); return o && typeof o.s === 'string' && typeof o.h === 'string' ? o : null } catch (e) { return null } };
export const hasPin = () => !!read();

/** Sets (or changes) the PIN. Returns false when the digits are not 4 to 6 or the browser refuses to store it. */
export async function setPin(pin) {
  if (!PIN_RE.test(pin)) return false;
  const s = hex(crypto.getRandomValues(new Uint8Array(8)));
  try { localStorage.setItem(KEY, JSON.stringify({ s, h: await digest(s, pin) })); return true } catch (e) { return false }
}
export function clearPin() { try { localStorage.removeItem(KEY) } catch (e) {} }

let fails = 0, lockedUntil = 0;
/** Remaining lock time in seconds after too many wrong tries (0 when open). */
export const lockLeft = () => Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
/** True when the PIN is right. Five wrong tries in a row lock the check for half a minute. */
export async function checkPin(pin) {
  const o = read(); if (!o) return true;
  if (lockLeft()) return false;
  if ((await digest(o.s, String(pin))) === o.h) { fails = 0; return true }
  if (++fails >= MAX_TRIES) { fails = 0; lockedUntil = Date.now() + LOCK_MS }
  return false;
}

/* The parents' area stays open for a while after the gate, in this tab only. */
const OPEN = 'hifz-parent-open', OPEN_MS = 15 * 60 * 1000;
export function unlockParents() { try { sessionStorage.setItem(OPEN, String(Date.now() + OPEN_MS)) } catch (e) {} }
export function lockParents() { try { sessionStorage.removeItem(OPEN) } catch (e) {} }
export function parentsOpen() { try { return Number(sessionStorage.getItem(OPEN)) > Date.now() } catch (e) { return false } }
