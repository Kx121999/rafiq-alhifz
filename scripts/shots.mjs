// Screenshots of the built site for review: every main page at five widths, for a new visitor and for a child with history.
// Usage: npm run build && node scripts/shots.mjs [outDir] [page,page,...] [width,width,...]   (needs Chrome, see a11y.mjs)
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || 'docs/screens';
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const WIDTHS = (process.argv[4] || '360,390,768,1024,1440').split(',').map(Number);
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME_PATH'); process.exit(2) }
mkdirSync(OUT, { recursive: true });

const ymd = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const salma = { id: 'k1', name: 'سلمى', icon: '🌸', mode: 'reader', plan: { id: 'amma', weeks: 8, start: ymd(-7) }, game: { stars: 120, spent: 40 }, last: 112,
  log: { [ymd(-2)]: { a: 4, r: 1, w: 0, g: 3 }, [ymd(0)]: { a: 2, r: 1, w: 0, g: 0 } },
  S: { s: { 114: { m: '111111', d: ymd(-1), i: 2 }, 112: { m: '1100', d: ymd(-1), i: 2, w: '0100' }, 108: { m: '111', d: ymd(3), i: 2 }, 1: { m: '1111111', d: ymd(3), i: 2 } }, goal: 5, day: ymd(), n: 2, streak: 3, last: ymd() } };
const store = { active: 'k1', kids: [salma, { id: 'k2', name: 'يوسف', icon: '🌙', mode: 'young', S: { s: {}, goal: 3, day: ymd(), n: 0, streak: 0, last: '' } }] };

const PAGES = [['landing', '#/'], ['dashboard', '#/dashboard'], ['mushaf', '#/mushaf'], ['surah', '#/surah/112'], ['review', '#/review'], ['achievements', '#/achievements'],
  ['more', '#/more'], ['adhkar', '#/adhkar/sabah'], ['games', '#/games'], ['search', '#/search'], ['plan', '#/plan'], ['about', '#/about']];

const server = await preview({ preview: { port: 4399, strictPort: true, host: '127.0.0.1' } });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
try {
  for (const who of ['new', 'used']) {
    for (const w of WIDTHS) {
      const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
      await p.setViewport({ width: w, height: w < 600 ? 800 : 900, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
      if (who === 'used') await p.evaluateOnNewDocument(s => { if (!localStorage.getItem('hifz-kids-v1')) { localStorage.setItem('hifz-kids-v1', s); localStorage.setItem('hifz-tour-v1', '1') } }, JSON.stringify(store));
      else await p.evaluateOnNewDocument(() => { try { sessionStorage.setItem('x', '1') } catch (e) {} });
      for (const [name, hash] of PAGES) {
        if (ONLY.length && !ONLY.includes(name)) continue;
        if (who === 'new' && !['landing', 'dashboard', 'mushaf'].includes(name)) continue;
        await p.goto('http://127.0.0.1:4399/' + hash, { waitUntil: 'networkidle0' });
        await p.evaluate(h => { if (location.hash !== h) location.hash = h }, hash);
        await new Promise(r => setTimeout(r, 900));
        await p.screenshot({ path: join(OUT, `${who}-${name}-${w}.png`), fullPage: name === 'landing' });
      }
      await ctx.close();
    }
  }
} finally { await browser.close(); await server.close() }
console.log('screenshots in', OUT);
