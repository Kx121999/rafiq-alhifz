// End-to-end check in a real browser: walks the journeys a family really takes and checks the saved data survives a reload.
// Serves the built site (dist/) like a11y.mjs does. Usage: npm run build && npm run e2e
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const annotate = msg => { if (process.env.GITHUB_ACTIONS) console.log('::error title=e2e::' + String(msg).split(String.fromCharCode(10)).join('%0A').slice(0, 900)) };
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, e => { annotate('crash: ' + ((e && e.stack) || e)); console.error(e); process.exit(1) });

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'dist/index.html'))) { console.error('dist/ not found: run "npm run build" first'); process.exit(2) }
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME_PATH'); process.exit(2) }

const server = await preview({ preview: { port: 0, host: '127.0.0.1' } });
const BASE = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [] });
const wait = ms => new Promise(r => setTimeout(r, ms));

const ymd = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const kid = (over = {}) => ({ id: 'k1', name: 'سلمى', icon: '🌸', mode: 'reader', S: { s: {}, goal: 5, day: ymd(), n: 0, streak: 0, last: '' }, ...over });
const store = kids => JSON.stringify({ active: kids[0].id, kids });

/** A fresh browser context (own storage). seed: localStorage entries to put in before the page starts. */
async function open(hash, { seed = {}, width = 400, before } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.setViewport({ width, height: 860, isMobile: true });
  await page.evaluateOnNewDocument((s, once) => {
    if (!localStorage.getItem('e2e-seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem('e2e-seeded', '1') }
    if (once) new Function(once)();
  }, seed, before || '');
  await page.goto(BASE + hash, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.page:not([hidden])'), { timeout: 30000 });
  await wait(800);
  return { ctx, page, errors };
}
const clickText = (page, text, sel = 'button, a') => page.evaluate((t, s) => { const b = [...document.querySelectorAll(s)].find(x => !x.hidden && x.offsetParent !== null && x.textContent.includes(t)); if (!b) throw new Error('no button: ' + t); b.click() }, text, sel);
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('hifz-kids-v1')));
const gate = async page => {
  await page.evaluate(() => document.getElementById('parentBtn').click()); await wait(250);
  const q = await page.$eval('#gateQ', e => e.textContent), n = q.match(/[٠-٩]+/g).map(s => +s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  await page.type('#gateA', String(n[0] * n[1])); await page.evaluate(() => document.getElementById('gateForm').requestSubmit()); await wait(400);
};

const results = [];
async function scenario(name, fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let env;
    try { env = await fn(); results.push({ name, ok: true }); return }
    catch (e) { if (attempt === 2) { results.push({ name, ok: false, why: String(e && e.message || e).slice(0, 300) }); return } }
  }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg) };
const noErrors = errors => ok(!errors.length, 'page errors: ' + errors.join(' | '));

/* 1. a brand-new family: the welcome tour, then the home page with the install button */
await scenario('first visit: tour, then home with the install button', async () => {
  const { ctx, page, errors } = await open('#/');
  await page.waitForSelector('#tour[open]', { timeout: 15000 });
  await clickText(page, 'تخطّي', '#tourBody button'); await wait(400);
  ok(await page.evaluate(() => !document.getElementById('tour').open), 'the tour did not close');
  ok(await page.evaluate(() => { const b = document.getElementById('installBtn'); return !b.hidden && b.getBoundingClientRect().width > 0 }), 'install button not visible');
  await page.reload({ waitUntil: 'load' }); await wait(1200);
  ok(await page.evaluate(() => !document.getElementById('tour').open), 'the tour came back after a reload');
  noErrors(errors); await ctx.close();
});

/* 2. memorise ayat, reload, they are still memorised and counted */
await scenario('memorise two ayat, reload, progress is kept', async () => {
  const { ctx, page, errors } = await open('#/surah/112', { seed: { 'hifz-tour-v1': '1' } });
  await page.waitForSelector('#ayat .ck', { timeout: 20000 });
  await page.evaluate(() => { const b = document.querySelectorAll('#ayat .ck'); b[0].click(); b[1].click() });
  await wait(500);
  let d = await saved(page), r = d.kids[0].S.s[112];
  ok(r && r.m.startsWith('11'), 'ayat not saved: ' + JSON.stringify(r));
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#ayat .ck', { timeout: 20000 }); await wait(600);
  ok(await page.evaluate(() => [...document.querySelectorAll('#ayat .ck')].slice(0, 2).every(b => b.getAttribute('aria-pressed') === 'true')), 'ayat not marked after reload');
  await page.goto(BASE + '#/dashboard'); await wait(900);
  ok((await page.$eval('#sAyat', e => e.textContent)).trim() === '٢', 'dashboard does not show 2 ayat');
  noErrors(errors); await ctx.close();
});

/* 3. adhkar: count, finish one, reload */
await scenario('adhkar: a counted dhikr is kept after a reload', async () => {
  const { ctx, page, errors } = await open('#/adhkar/sabah', { seed: { 'hifz-tour-v1': '1' } });
  await page.waitForSelector('.azcard', { timeout: 30000 });
  await page.evaluate(() => { const b = document.querySelectorAll('.azbtn'); b[0].click(); b[1].click(); b[1].click() });
  await wait(400);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.azcard', { timeout: 30000 }); await wait(500);
  const t = await page.evaluate(() => [...document.querySelectorAll('.azbtn')].slice(0, 2).map(b => b.textContent.trim()));
  ok(t[0].includes('تمّ') && t[1].startsWith('٢'), 'counters not restored: ' + t.join(' | '));
  noErrors(errors); await ctx.close();
});

/* 4. games with something memorised, and the shop with stars */
await scenario('games start, and a shop purchase changes the friend', async () => {
  const k = kid({ game: { stars: 60 }, S: { s: { 112: { m: '1111', d: ymd(2), i: 1 }, 114: { m: '111111', d: ymd(2), i: 1 } }, goal: 5, day: ymd(), n: 0, streak: 0, last: '' } });
  const { ctx, page, errors } = await open('#/games', { seed: { 'hifz-tour-v1': '1', 'hifz-kids-v1': store([k]) } });
  await page.waitForSelector('.gamecard:not([disabled])', { timeout: 20000 });
  await clickText(page, 'من أي سورة', '.gamecard'); await wait(400);
  ok(await page.evaluate(() => document.querySelectorAll('#gameBox .opt').length === 4), 'the question has no four options');
  await page.evaluate(() => document.querySelector('#gameBox .opt').click()); await wait(300);
  ok(await page.evaluate(() => [...document.querySelectorAll('#gameBox button')].some(b => b.textContent.includes('التالي'))), 'no next button after answering');
  await page.goto(BASE + '#/shop'); await page.waitForSelector('.shopitem', { timeout: 20000 });
  await clickText(page, 'اشترِ بـ', '.shopitem button'); await wait(500);   // the first friend, 50 stars
  const after = await saved(page);
  ok(after.kids[0].shop && after.kids[0].shop.own.includes('qamar') && after.kids[0].friend === 'qamar', 'purchase not saved or friend not switched');
  ok(after.kids[0].game.spent === 50 && after.kids[0].game.stars === 60, 'stars not spent correctly: ' + JSON.stringify(after.kids[0].game));
  ok(await page.evaluate(() => (document.querySelector('#cBtn img') || {}).src.includes('qamar')), 'the companion did not change to the new friend');
  noErrors(errors); await ctx.close();
});

/* 5. a backup file leaves the site and comes back (export, then import as a new child) */
await scenario('backup export and import round trip', async () => {
  const k = kid({ S: { s: { 112: { m: '1111', d: ymd(2), i: 1 } }, goal: 5, day: ymd(), n: 4, streak: 1, last: ymd() } });
  const { ctx, page, errors } = await open('#/dashboard', { seed: { 'hifz-tour-v1': '1', 'hifz-kids-v1': store([k]) },
    before: 'const o = URL.createObjectURL; URL.createObjectURL = b => { window.__blob = b; return o.call(URL, b) }' });
  await gate(page);
  await clickText(page, 'تصدير نسخة احتياطية', '#parentBody button'); await wait(500);
  const text = await page.evaluate(async () => window.__blob ? await window.__blob.text() : '');
  const j = JSON.parse(text); ok(j.app === 'rafiq-alhifz' && j.kids.length === 1 && j.kids[0].S.s[112].m === '1111', 'the exported file is not a valid backup');
  const input = await page.$('#parentBody input[type=file]');
  const file = join(process.env.TMPDIR || process.env.TEMP || '/tmp', 'rafiq-e2e-backup.json');
  (await import('node:fs')).writeFileSync(file, text);
  await input.uploadFile(file); await wait(900);
  await clickText(page, 'إضافتهم', '#parentBody button'); await wait(700);
  const after = await saved(page);
  ok(after.kids.length === 2 && after.kids[1].S.s[112].m === '1111', 'the imported child is missing: ' + after.kids.length + ' kids');
  noErrors(errors); await ctx.close();
});

/* 6. progress saved by the first version of the site (a single child, the old key) is picked up */
await scenario('old saved progress is migrated', async () => {
  const legacy = JSON.stringify({ s: { 112: { m: '1111', d: ymd(2), i: 1 }, 1: { m: '1111111', d: ymd(3), i: 2 } }, goal: 5, day: ymd(), n: 0, streak: 2, last: ymd() });
  const { ctx, page, errors } = await open('#/dashboard', { seed: { 'hifz-tour-v1': '1', 'hifz-progress-v1': legacy } });
  await wait(600);
  ok((await page.$eval('#sAyat', e => e.textContent)).trim() === '١١', 'the old progress (11 ayat) was not found');
  const d = await saved(page); ok(d.kids.length === 1 && d.kids[0].S.s[1], 'no profile was created from the old data');
  noErrors(errors); await ctx.close();
});

/* 7. a browser that cannot save (private mode, full storage): the site must still open and work */
await scenario('works when storage is unavailable', async () => {
  const { ctx, page, errors } = await open('#/mushaf', { before: 'Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError") }' });
  await page.waitForSelector('#list .row', { timeout: 20000 });
  await page.goto(BASE + '#/surah/112'); await page.waitForSelector('#ayat .ck', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('#ayat .ck').click()); await wait(400);
  ok(await page.evaluate(() => document.querySelector('#ayat .ck').getAttribute('aria-pressed') === 'true'), 'marking an ayah does nothing without storage');
  noErrors(errors); await ctx.close();
});

/* 8. the main pages open without any error, with a child who has some progress */
await scenario('every page opens without errors', async () => {
  const k = kid({ S: { s: { 112: { m: '1100', d: ymd(-1), i: 1 } }, goal: 5, day: ymd(), n: 2, streak: 1, last: ymd() } });
  const { ctx, page, errors } = await open('#/', { seed: { 'hifz-tour-v1': '1', 'hifz-kids-v1': store([k]) } });
  for (const h of ['dashboard', 'mushaf', 'surah/112', 'review', 'plan', 'games', 'achievements', 'adhkar/sabah', 'adhkar/all', 'shop', 'challenge', 'share', 'family', 'ramadan', 'report', 'about', 'check', 'search/' + encodeURIComponent('الرحمن')]) {
    await page.goto(BASE + '#/' + h); await wait(700);
    ok(await page.evaluate(() => !!document.querySelector('.page:not([hidden])')), 'no page shown for #/' + h);
  }
  noErrors(errors); await ctx.close();
});

await browser.close(); server.httpServer.close();
let bad = 0;
for (const r of results) { console.log((r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : '\n    ' + r.why)); if (!r.ok) { bad++; annotate(r.name + ': ' + r.why) } }
console.log(bad ? '\nEnd-to-end check FAILED (' + bad + ' of ' + results.length + ')' : '\nEnd-to-end check passed: ' + results.length + ' journeys.');
process.exit(bad ? 1 : 0);
