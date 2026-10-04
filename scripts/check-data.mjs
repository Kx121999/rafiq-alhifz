// Verifies the Quran, tafsir and adhkar data files are intact: 114 surahs, 6236 ayat, one tafsir entry per ayah, and the
// adhkar file unchanged from its source (structure, a fingerprint of every text, every Quran verse in it found in quran.json).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const load = f => JSON.parse(readFileSync(new URL('../public/' + f, import.meta.url), 'utf8'));
const Q = load('quran.json'), T = load('tafsir.json');
const errors = [];

if (Q.length !== 114) errors.push(`quran.json: ${Q.length} surahs, expected 114`);
if (T.length !== 114) errors.push(`tafsir.json: ${T.length} surahs, expected 114`);

let ayat = 0, tafsir = 0;
Q.forEach((s, i) => {
  if (typeof s.n !== 'string' || !s.n) errors.push(`surah ${i + 1}: missing name`);
  if (s.t !== 0 && s.t !== 1) errors.push(`surah ${i + 1}: bad type ${s.t}`);
  if (!Array.isArray(s.v) || !s.v.length) { errors.push(`surah ${i + 1}: no ayat`); return; }
  s.v.forEach((a, j) => { if (typeof a !== 'string' || !a.trim()) errors.push(`surah ${i + 1} ayah ${j + 1}: empty`); });
  ayat += s.v.length;
  const t = T[i] || [];
  tafsir += t.length;
  if (t.length !== s.v.length) errors.push(`surah ${i + 1}: ${s.v.length} ayat but ${t.length} tafsir entries`);
});

if (ayat !== 6236) errors.push(`total ayat ${ayat}, expected 6236`);
if (tafsir !== 6236) errors.push(`total tafsir entries ${tafsir}, expected 6236`);

/* ---------- adhkar (public/adhkar.json, from rn0x/Adhkar-json, i.e. Hisn al-Muslim) ---------- */
const A = load('adhkar.json');
const AZ_CATS = 132, AZ_ENTRIES = 267;
// SHA-256 of JSON.stringify(parsed file): independent of line endings and spacing, changes if any text or count is edited
const AZ_FINGERPRINT = 'aef15f8f12afaad3c027ce62bfb82c3ae263d5b053a9bc13cbe2a94013a425de';
if (!Array.isArray(A) || A.length !== AZ_CATS) errors.push(`adhkar.json: ${A.length} categories, expected ${AZ_CATS}`);
let azEntries = 0;
A.forEach((c, i) => {
  if (c.id !== i + 1) errors.push(`adhkar category ${i + 1}: id ${c.id}`);
  if (typeof c.category !== 'string' || !c.category.trim()) errors.push(`adhkar category ${c.id}: missing name`);
  if (!Array.isArray(c.array) || !c.array.length) { errors.push(`adhkar category ${c.id}: no entries`); return; }
  c.array.forEach((a, j) => {
    azEntries++;
    if (a.id !== j + 1) errors.push(`adhkar ${c.id}.${j + 1}: id ${a.id}`);
    if (typeof a.text !== 'string' || !/[ء-ي]/.test(a.text)) errors.push(`adhkar ${c.id}.${a.id}: no Arabic text`);
    if (!Number.isInteger(a.count) || a.count < 1 || a.count > 100) errors.push(`adhkar ${c.id}.${a.id}: bad count ${a.count}`);
  });
});
if (azEntries !== AZ_ENTRIES) errors.push(`adhkar.json: ${azEntries} entries, expected ${AZ_ENTRIES}`);
const azHash = createHash('sha256').update(JSON.stringify(A)).digest('hex');
if (azHash !== AZ_FINGERPRINT) errors.push(`adhkar.json: the content differs from the verified source (fingerprint ${azHash.slice(0, 12)}…). Nothing in it may be edited by hand.`);

// Quran verses inside the adhkar (between ﴿ ﴾) must exist in quran.json. Compared by letter skeleton, because the adhkar
// file and the mushaf spell vowel letters and hamza differently (e.g. السموات / السَّمَـٰوَٰتِ), never the words themselves.
const skeleton = t => t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/ة/g, 'ه').replace(/[ىی]/g, 'ي').replace(/[اوىيءئؤأإآٱ]/g, '')
  .replace(/[^ء-ي ]/g, ' ').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
const hay = Q.map(s => ' ' + skeleton(s.v.join(' ')) + ' ');
let verses = 0;
A.forEach(c => c.array.forEach(a => {
  for (const m of a.text.matchAll(/﴿([^﴾]*)﴾/g)) {
    verses++;
    const n = skeleton(m[1]);
    if (!n || !hay.some(h => h.includes(' ' + n + ' '))) errors.push(`adhkar ${c.id}.${a.id}: a Quran verse does not match quran.json (${m[1].slice(0, 30)}…)`);
  }
}));

if (errors.length) { console.error('Data check FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`Data check OK: 114 surahs, ${ayat} ayat, ${tafsir} tafsir entries, ${AZ_CATS} adhkar categories with ${azEntries} entries (${verses} Quran verses verified against quran.json).`);
