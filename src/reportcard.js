// The weekly report as a picture a parent can send to a teacher or the family (WhatsApp and the like) or keep.
// It is drawn on the device from the same numbers as the printed report; nothing is uploaded.
import { AR, day } from './util.js';
import { activeKid, activityLog } from './state.js';
import { kidTotals } from './medals.js';
import { weekDays, summarize, reportOffset } from './report.js';

const W = 1080, H = 1350, GREEN = '#0e6b50', GOLD = '#a97a1c', INK = '#12261f', MUTED = '#5b6f67';
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const fmt = (iso, o) => new Date(iso + 'T12:00:00').toLocaleDateString('ar-EG', o);

/** Everything printed on the picture, as plain data (so it can be tested without a canvas). */
export function reportCardData(offset = reportOffset) {
  const k = activeKid(); if (!k) return null;
  const dates = weekDays(offset), sum = summarize(activityLog(), dates), t = kidTotals();
  return {
    name: k.name, icon: k.icon,
    range: fmt(dates[0], { day: 'numeric', month: 'long' }) + ' – ' + fmt(dates[6], { day: 'numeric', month: 'long', year: 'numeric' }),
    tiles: [['آيات جديدة', AR(sum.total.a)], ['مراجعات للسور', AR(sum.total.r)], ['آيات تم تثبيتها', AR(sum.total.w)], ['أيام النشاط', AR(sum.activeDays) + ' من ٧'], ['نجوم الألعاب', AR(sum.total.g)]],
    days: sum.per.map(p => ({ label: fmt(p.d, { weekday: 'short' }), a: p.a })),
    standing: [['الآيات المحفوظة إجمالًا', AR(t.ay) + ' من ' + AR(6236)], ['السور المكتملة', AR(t.done) + ' من ' + AR(114)], ['الأيام المتتالية الآن', AR(t.streak)]],
    date: fmt(day(), { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }

/** Draws the card; resolves to a PNG blob, or null when this browser cannot draw. */
export async function drawReportCard(canvas, data = reportCardData()) {
  const c = canvas.getContext && canvas.getContext('2d'); if (!c || !data) return null;
  try { await Promise.all([document.fonts.load('500 60px "Reem Kufi"'), document.fonts.load('600 40px "IBM Plex Sans Arabic"')]) } catch (e) {}
  canvas.width = W; canvas.height = H;
  c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const DISPLAY = '500 56px "Reem Kufi", "IBM Plex Sans Arabic", sans-serif', UI = w => w + ' "IBM Plex Sans Arabic", sans-serif';
  c.fillStyle = '#fffdf6'; c.fillRect(0, 0, W, H);
  c.lineWidth = 8; c.strokeStyle = GOLD; c.strokeRect(34, 34, W - 68, H - 68); c.lineWidth = 2; c.strokeRect(52, 52, W - 104, H - 104);

  c.fillStyle = GREEN; c.font = '500 46px "Reem Kufi", sans-serif'; c.fillText('رفيق الحفظ · التقرير الأسبوعي', W / 2, 130);
  c.fillStyle = INK; c.font = '500 84px "Reem Kufi", ' + EMOJI; c.fillText(data.icon + ' ' + data.name, W / 2, 232);
  c.fillStyle = MUTED; c.font = UI('600 36px'); c.fillText(data.range, W / 2, 312);

  // tiles: 3 on the first row, 2 on the second
  const tw = 290, th = 150, gap = 24;
  data.tiles.forEach(([label, v], i) => {
    const row = i < 3 ? 0 : 1, n = row ? 2 : 3, col = row ? i - 3 : i;
    const x = W / 2 - (n * tw + (n - 1) * gap) / 2 + col * (tw + gap), y = 360 + row * (th + gap);
    c.fillStyle = '#fff'; rr(c, x, y, tw, th, 22); c.fill(); c.lineWidth = 3; c.strokeStyle = '#d5dfd9'; c.stroke();
    c.fillStyle = GREEN; c.font = '500 62px "Reem Kufi", sans-serif'; c.fillText(v, x + tw / 2, y + 62);
    c.fillStyle = MUTED; c.font = UI('600 30px'); c.fillText(label, x + tw / 2, y + 120);
  });

  // new ayat per day
  c.fillStyle = GREEN; c.font = '500 44px "Reem Kufi", sans-serif'; c.fillText('الآيات الجديدة يوميًا', W / 2, 740);
  const max = Math.max(1, ...data.days.map(d => d.a)), bw = 96, bg = 24, bh = 190, x0 = W / 2 - (7 * bw + 6 * bg) / 2, base = 990;
  data.days.forEach((d, i) => {
    const x = x0 + i * (bw + bg), h = d.a ? Math.max(14, d.a / max * bh) : 0;
    c.fillStyle = '#eef3ef'; rr(c, x, base - bh, bw, bh, 14); c.fill();
    if (h) { c.fillStyle = GREEN; rr(c, x, base - h, bw, h, 14); c.fill() }
    c.fillStyle = INK; c.font = UI('600 32px'); if (d.a) c.fillText(AR(d.a), x + bw / 2, base - bh - 22);
    c.fillStyle = MUTED; c.font = UI('600 28px'); c.fillText(d.label, x + bw / 2, base + 34);
  });

  // where they stand now
  data.standing.forEach(([label, v], i) => {
    const y = 1095 + i * 62;
    c.fillStyle = INK; c.font = UI('600 34px'); c.textAlign = 'right'; c.fillText(label, W - 130, y);
    c.fillStyle = GREEN; c.font = '500 38px "Reem Kufi", sans-serif'; c.textAlign = 'left'; c.fillText(v, 130, y);
    c.strokeStyle = '#d5dfd9'; c.lineWidth = 2; c.beginPath(); c.moveTo(130, y + 30); c.lineTo(W - 130, y + 30); c.stroke();
  });
  c.textAlign = 'center';
  c.fillStyle = MUTED; c.font = UI('600 26px');
  c.fillText('طُبع في ' + data.date, W / 2, 1268);
  c.fillText('أرقام يسجّلها الموقع على هذا الجهاز، وليست تقييمًا للحفظ نفسه', W / 2, 1304);
  return new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
}

/**
 * Shares the card (the phone's share sheet, with the picture attached) or, where that is not possible, saves it.
 * Resolves to 'shared' | 'saved' | 'cancelled' | 'unsupported'. deps lets tests replace the browser.
 */
export async function shareReport(offset = reportOffset, deps = {}) {
  const draw = deps.draw || (() => drawReportCard(document.createElement('canvas'), reportCardData(offset)));
  const nav = deps.nav || navigator, doc = deps.doc || document;
  const blob = await draw(); if (!blob) return 'unsupported';
  const file = new File([blob], 'rafiq-report-' + day() + '.png', { type: 'image/png' });
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'تقرير رفيق الحفظ' }); return 'shared' }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled' }          // anything else: fall back to saving
  }
  const a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
  doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'saved';
}
