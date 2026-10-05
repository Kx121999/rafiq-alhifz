// The achievement card: a picture drawn on the child's own device (a canvas), with their name, how many ayat they have
// memorised, their medals and their friend. It can be saved or shared (for example to WhatsApp). Nothing is uploaded.
// No Quran text appears on it, only numbers and names.
import { $, AR, day, el, charSrc } from './util.js';
import { Q } from './data.js';
import { activeKid, friendOf } from './state.js';
import { kidTotals, unlockedBadges } from './kids.js';

const W = 1080, H = 1350;
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
let url = null, lastBlob = null;

/** The numbers on the card. */
export function cardStats() {
  const k = activeKid(), t = kidTotals();
  return { name: k ? k.name : '', icon: k ? k.icon : '⭐', ay: t.ay, done: t.done, streak: t.streak, games: t.games, badges: unlockedBadges() };
}

const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src });
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }

/** Draws the card on a canvas and resolves to a PNG blob (or null when the browser cannot draw). */
export async function drawCard(canvas) {
  const c = canvas.getContext && canvas.getContext('2d'); if (!c) return null;
  const s = cardStats();
  try { await Promise.all([document.fonts.load('800 80px "Baloo Bhaijaan 2"'), document.fonts.load('600 40px "IBM Plex Sans Arabic"')]) } catch (e) {}
  canvas.width = W; canvas.height = H;
  c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'middle';
  // sky
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c9e6ff'); g.addColorStop(0.5, '#fff1d6'); g.addColorStop(1, '#e8f7d6');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.8)';
  [[160, 150, 70], [250, 130, 50], [900, 230, 60], [830, 250, 40], [140, 1180, 55]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill() });
  // brand
  c.fillStyle = '#1b2e44'; c.font = '800 84px "Baloo Bhaijaan 2", sans-serif'; c.fillText('رفيق الحفظ', W / 2, 96);
  // card
  c.fillStyle = '#ead8b5'; rr(c, 70, 190 + 12, 940, 1060, 56); c.fill();
  c.fillStyle = '#fff'; rr(c, 70, 190, 940, 1060, 56); c.fill();
  c.lineWidth = 6; c.strokeStyle = '#ead8b5'; c.stroke();
  const pic = await loadImg(charSrc(friendOf()));
  if (pic) c.drawImage(pic, W / 2 - 150, 120, 300, 300);
  // name
  c.fillStyle = '#1b2e44'; c.font = '800 88px "Baloo Bhaijaan 2", ' + EMOJI; c.fillText(s.icon + ' ' + s.name, W / 2, 500);
  c.fillStyle = '#546477'; c.font = '600 38px "IBM Plex Sans Arabic", sans-serif'; c.fillText('بطاقة إنجاز', W / 2, 568);
  // big number
  c.fillStyle = '#087456'; c.font = '800 190px "Baloo Bhaijaan 2", sans-serif'; c.fillText(AR(s.ay), W / 2, 690);
  c.fillStyle = '#1b2e44'; c.font = '600 48px "IBM Plex Sans Arabic", sans-serif'; c.fillText('آية محفوظة بإذن الله', W / 2, 800);
  // three small tiles
  const tiles = [[AR(s.done), 'سورة مكتملة'], [AR(s.streak), 'يوم متتالٍ'], [AR(s.games), 'نجمة ألعاب']];
  tiles.forEach(([v, label], i) => {
    const x = 120 + i * 300, y = 860, w = 270, h = 170;
    c.fillStyle = ['#ffe08a', '#d4eaff', '#ffd9cc'][i]; rr(c, x, y, w, h, 36); c.fill();
    c.fillStyle = '#1b2e44'; c.font = '800 70px "Baloo Bhaijaan 2", sans-serif'; c.fillText(v, x + w / 2, y + 66);
    c.font = '600 32px "IBM Plex Sans Arabic", sans-serif'; c.fillText(label, x + w / 2, y + 128);
  });
  // medals
  const medals = s.badges.slice(0, 8);
  if (medals.length) {
    const size = 92, gap = 22, total = medals.length * size + (medals.length - 1) * gap, x0 = W / 2 - total / 2;
    medals.forEach((b, i) => {
      const x = x0 + i * (size + gap) + size / 2, y = 1130;
      c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(x, y, size / 2, 0, 7); c.fill();
      c.lineWidth = 5; c.strokeStyle = '#8a5a00'; c.stroke();
      c.font = '50px ' + EMOJI; c.fillStyle = '#000'; c.fillText(b.icon, x, y + 4);
    });
  } else { c.fillStyle = '#546477'; c.font = '600 38px "IBM Plex Sans Arabic", sans-serif'; c.fillText('أول وسام في الطريق ✨', W / 2, 1130) }
  // footer
  c.fillStyle = '#17402f'; c.font = '600 34px "IBM Plex Sans Arabic", sans-serif';
  c.fillText(new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 1300);
  return new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
}

/** Fills the share page: the picture and the save / share buttons. */
export async function renderShare() {
  const box = $('shareBox'); box.textContent = '';
  const k = activeKid(); if (!k || !Q.length) return;
  const note = el('p', 'note', 'جارٍ تجهيز البطاقة…'); note.setAttribute('role', 'status'); box.appendChild(note);
  const canvas = document.createElement('canvas');
  const blob = await drawCard(canvas);
  if (!$('shareBox') || !box.isConnected) return;
  if (!blob) { note.textContent = 'تعذّر رسم البطاقة في هذا المتصفح.'; return }
  lastBlob = blob; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
  const img = el('img', 'sharecard'); img.src = url; img.alt = 'بطاقة إنجاز ' + k.name + ': ' + AR(cardStats().ay) + ' آية محفوظة';
  const name = 'rafiq-' + day() + '.png', file = new File([blob], name, { type: 'image/png' });
  const acts = el('div', 'acts');
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    const sh = el('button', 'btn primary', 'شارك البطاقة'); sh.type = 'button';
    sh.addEventListener('click', () => navigator.share({ files: [file], title: 'رفيق الحفظ' }).catch(() => {}));
    acts.appendChild(sh);
  }
  const dl = el('a', 'btn' + (acts.children.length ? '' : ' primary'), 'احفظ الصورة'); dl.href = url; dl.download = name;
  acts.appendChild(dl);
  note.textContent = 'البطاقة تُرسم على جهازك ولا تُرفع إلى أي مكان.';
  box.append(img, acts, note);
}
export const lastCard = () => lastBlob;
