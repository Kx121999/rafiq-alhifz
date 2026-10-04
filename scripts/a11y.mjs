// Accessibility regression check. Serves the built site (dist/) and runs axe-core (WCAG 2.x A/AA plus best practices)
// on every page and the important states, in the light and dark themes, then checks that nothing overflows at 320 px.
// Needs Chrome: set CHROME_PATH if it is not in a usual place. Usage: npm run build && npm run a11y
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const AXE = readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
if (!existsSync(join(ROOT, 'dist/index.html'))) { console.error('dist/ not found: run "npm run build" first'); process.exit(2) }

const CHROME = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME_PATH'); process.exit(2) }

const ymd = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
// demo children: one reader with history, a weak ayah, a plan and a log; one young child
const salma = { id: 'k1', name: 'سلمى', icon: '🌸', mode: 'reader', plan: { id: 'amma', weeks: 8, start: ymd(-7) }, game: { stars: 12 }, last: 112,
  log: { [ymd(-2)]: { a: 4, r: 1, w: 0, g: 3 }, [ymd(0)]: { a: 2, r: 1, w: 0, g: 0 } },
  S: { s: { 114: { m: '111111', d: ymd(-1), i: 2 }, 112: { m: '1111', d: ymd(-1), i: 2, w: '0100' }, 108: { m: '111', d: ymd(3), i: 2 }, 1: { m: '1111111', d: ymd(3), i: 2 } }, goal: 5, day: ymd(), n: 0, streak: 3, last: ymd() } };
const yousef = { id: 'k2', name: 'يوسف', icon: '🌙', mode: 'young', S: { s: { 114: { m: '111000', d: ymd(1), i: 1 } }, goal: 5, day: ymd(), n: 0, streak: 0, last: '' } };
const wait = ms => new Promise(r => setTimeout(r, ms));

// wait for the element to exist first: on a slow machine the page can still be loading the Quran text
const click = (text, sel = 'button, a') => async p => {
  await p.waitForFunction((t, s) => [...document.querySelectorAll(s)].some(b => b.textContent.includes(t)), { timeout: 20000 }, text, sel);
  await p.evaluate((t, s) => [...document.querySelectorAll(s)].find(b => b.textContent.includes(t)).click(), text, sel);
};
const openParent = async p => {
  await p.evaluate(() => document.getElementById('parentBtn').click()); await wait(200);
  const q = await p.$eval('#gateQ', e => e.textContent), n = q.match(/[٠-٩]+/g).map(s => +s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  await p.type('#gateA', String(n[0] * n[1])); await p.evaluate(() => document.getElementById('gateForm').requestSubmit()); await wait(300);
};
const STATES = [
  ['home', '#/'], ['dashboard', '#/dashboard'], ['mushaf', '#/mushaf'], ['search results', '#/search/' + encodeURIComponent('الرحمن')], ['search empty', '#/search'],
  ['review', '#/review'], ['plan view', '#/plan'], ['plan form', '#/plan', click('تغيير الخطة')],
  ['games menu', '#/games'], ['game: complete', '#/games', click('أكمل', '.gamecard')], ['game: order', '#/games', click('رتّب', '.gamecard')],
  ['achievements', '#/achievements'], ['certificate', '#/certificate/114'], ['report', '#/report'], ['about', '#/about'],
  ['surah (reader)', '#/surah/112'], ['surah (veil)', '#/surah/114', p => p.evaluate(() => document.getElementById('veilBtn').click())],
  ['surah (young child)', '#/surah/114', null, 'k2'], ['surah + tafsir', '#/surah/112', async p => { await p.waitForSelector('.ay .tf', { timeout: 20000 }); await p.evaluate(() => document.querySelector('.ay .tf').click()); await wait(800) }],
  ['player settings', '#/surah/112', p => p.evaluate(() => { document.getElementById('plToggle').click(); document.querySelector('#player details').open = true })],
  ['parent gate', '#/dashboard', p => p.evaluate(() => document.getElementById('parentBtn').click())], ['parent corner', '#/dashboard', openParent],
];

const server = await preview({ preview: { port: 4173, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
const BASE = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [] });

/** Opens a state in its own browser context (separate storage), so one state cannot change another. */
async function open(scheme, hash, width, height, active = 'k1') {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  await page.setBypassServiceWorker(true);
  await page.setViewport({ width, height, isMobile: true });
  // reduced motion: no animation to wait for, so axe never measures a half-faded element
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(s => { if (!localStorage.getItem('seeded')) { localStorage.setItem('hifz-kids-v1', s); localStorage.setItem('seeded', '1') } }, JSON.stringify({ active, kids: [salma, yousef] }));
  // 'load' plus a short, bounded wait for the web fonts (waiting for a silent network is slow and flaky)
  await page.goto(BASE + hash, { waitUntil: 'load', timeout: 60000 });
  await Promise.race([page.evaluate(() => document.fonts.ready), wait(8000)]); await wait(500);
  return { ctx, page };
}

const failures = [];
async function audit(scheme, state, attempt = 1, width = 430) {
  const [label, hash, act, active] = state;
  let ctx, page;
  try { ({ ctx, page } = await open(scheme, hash, width, width > 700 ? 800 : 860, active)) }
  catch (e) { if (attempt < 2) return audit(scheme, state, attempt + 1, width); failures.push({ where: scheme + ' / ' + label, id: 'audit-error', impact: 'error', help: 'could not open the page: ' + String(e).slice(0, 120), nodes: [] }); return }
  try {
    if (act) { await act(page); await wait(300) }
    await page.evaluate(AXE);
    const found = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }))
      .violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => n.target.join(' ') + '  ' + (n.any[0] || n.all[0] || n.none[0] || {}).message) })));
    // a real violation shows up every time; one that vanishes on a second look was a half-painted frame on a busy machine
    if (found.length && attempt < 2) { await ctx.close(); return audit(scheme, state, attempt + 1, width) }
    found.forEach(v => failures.push({ where: scheme + ' / ' + label + (width > 700 ? ' @' + width : ''), ...v }));
  } catch (e) { failures.push({ where: scheme + ' / ' + label, id: 'audit-error', impact: 'error', help: String(e).slice(0, 160), nodes: [] }) }
  await ctx.close();
}

const jobs = ['dark', 'light'].flatMap(scheme => STATES.map(s => [scheme, s]));
for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(([scheme, s]) => audit(scheme, s)));

// the wide layout (top navigation, columns) on a laptop and on a tablet
const WIDE = ['#/', '#/dashboard', '#/mushaf', '#/games', '#/achievements', '#/surah/112'].map(h => [h, h]);
const wideJobs = [1280, 820].flatMap(width => WIDE.map(([label, hash]) => [width, [label, hash]]));
for (let i = 0; i < wideJobs.length; i += 6) await Promise.all(wideJobs.slice(i, i + 6).map(([width, s]) => audit('light', s, 1, width)));

// WCAG 1.4.10 reflow: nothing may force sideways scrolling at 320 CSS px
const REFLOW = ['#/', '#/dashboard', '#/mushaf', '#/search/' + encodeURIComponent('الرحمن'), '#/review', '#/plan', '#/games', '#/achievements', '#/certificate/114', '#/report', '#/about', '#/surah/112'];
for (const hash of REFLOW) for (const width of [320, 768, 1180, 1280]) {
  const { ctx, page } = await open('dark', hash, width, 640);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth }));
  if (o.sw > o.iw + 1) failures.push({ where: width + 'px / ' + hash, id: 'reflow', impact: 'serious', help: 'Page scrolls sideways at ' + width + ' px', nodes: [o.sw + ' > ' + o.iw] });
  await ctx.close();
}

await browser.close();
server.httpServer.close();
const checked = jobs.length + wideJobs.length + REFLOW.length * 4;
if (!failures.length) { console.log('Accessibility check passed: ' + jobs.length + ' phone states (light and dark), ' + wideJobs.length + ' wide-screen states and ' + REFLOW.length * 4 + ' reflow checks (320 to 1280 px), no violations.'); process.exit(0) }
console.error('Accessibility check FAILED (' + failures.length + ' finding(s) in ' + checked + ' checks):\n');
for (const f of failures) console.error('- [' + f.impact + '] ' + f.id + ' in ' + f.where + ': ' + f.help + '\n    ' + f.nodes.join('\n    '));
process.exit(1);
