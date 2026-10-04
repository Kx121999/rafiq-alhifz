// Verifies the Quran and tafsir data files are intact: 114 surahs, 6236 ayat, and one tafsir entry per ayah.
import { readFileSync } from 'node:fs';

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

if (errors.length) { console.error('Data check FAILED:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`Data check OK: 114 surahs, ${ayat} ayat, ${tafsir} tafsir entries.`);
