// Touch targets and overflow: on every main page at phone width, every control must be at least 44x44 px (links inside a
// sentence are exempt, as WCAG allows) and nothing may make the page scroll sideways. Usage: npm run build && node scripts/targets.mjs
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME_PATH'); process.exit(2) }
const ymd = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const salma = { id: 'k1', name: 'سلمى', icon: '🌸', mode: 'reader', plan: { id: 'amma', weeks: 8, start: ymd(-7) }, game: { stars: 120 }, last: 112, bm: ['112.2'], pin: [112],
  S: { s: { 114: { m: '111111', d: ymd(-1), i: 2 }, 112: { m: '1100', d: ymd(-1), i: 2, w: '0100' }, 1: { m: '1111111', d: ymd(3), i: 2 } }, goal: 5, day: ymd(), n: 2, streak: 3, last: ymd() } };
const store = JSON.stringify({ active: 'k1', kids: [salma, { id: 'k2', name: 'يوسف', icon: '🌙', mode: 'young', S: { s: {}, goal: 3, day: ymd(), n: 0, streak: 0, last: '' } }] });
const PAGES = ['', 'dashboard', 'mushaf', 'surah/112', 'review', 'achievements', 'medals', 'more', 'adhkar/sabah', 'games', 'search/' + encodeURIComponent('الرحمن'), 'plan', 'shop', 'challenge', 'about', 'report'];
const WIDTHS = (process.argv[2] || '360,390').split(',').map(Number);

const server = await preview({ preview: { port: 4398, strictPort: true, host: '127.0.0.1' } });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const bad = [];
try {
  for (const w of WIDTHS) {
    const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
    await p.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true });
    await p.evaluateOnNewDocument(s => { if (!localStorage.getItem('hifz-kids-v1')) { localStorage.setItem('hifz-kids-v1', s); localStorage.setItem('hifz-tour-v1', '1') } }, store);
    for (const h of PAGES) {
      await p.goto('http://127.0.0.1:4398/#/' + h, { waitUntil: 'networkidle0' });
      await p.evaluate(x => { if (location.hash !== '#/' + x) location.hash = '#/' + x }, h);
      await new Promise(r => setTimeout(r, 900));
      const found = await p.evaluate(() => {
        const out = [], sel = 'a[href], button, input:not([type=hidden]):not([type=file]), select, summary, [role=button], [tabindex="0"]';
        for (const e of document.querySelectorAll(sel)) {
          if (e.closest('[hidden]') || e.closest('dialog:not([open])') || e.closest('.skip') || e.closest('.sr')) continue;
          const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
          if (!r.width || !r.height || cs.visibility === 'hidden' || cs.position === 'absolute' && r.width <= 1) continue;
          if (e.tagName === 'A' && cs.display === 'inline' && e.closest('p, li, .note, small, h2, h3')) continue;   // a link inside a sentence
          if (e.tagName === 'INPUT' && (e.type === 'checkbox' || e.type === 'radio') && e.closest('label')) continue;   // the label around it is the target
          if (r.width < 43.5 || r.height < 43.5) out.push((e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + '"');
        }
        const over = document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : 0;
        return { out, over };
      });
      for (const o of found.out) bad.push(`${w}px #/${h}: too small ${o}`);
      if (found.over) bad.push(`${w}px #/${h}: page scrolls sideways (${found.over}px wide)`);
    }
    await ctx.close();
  }
} finally { await browser.close(); await server.close() }
if (bad.length) { console.error('Touch target check FAILED (' + bad.length + '):\n' + [...new Set(bad)].join('\n')); process.exit(1) }
console.log('Touch target check passed: every control is at least 44x44 px on ' + PAGES.length + ' pages at ' + WIDTHS.join(', ') + ' px, and nothing scrolls sideways.');
