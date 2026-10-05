// Removes the CSS rules of the old page shell (sky, top bar, old nav, banners, tiles, old hero and footer) from src/styles.css.
// A small brace-aware parser: it understands nested @media blocks and drops only the selectors that match.
import { readFileSync, writeFileSync } from 'node:fs';

// extra class names to remove, from the command line: node scripts/prune-css.mjs stitle,journey
const EXTRA = (process.argv[2] || '').split(',').filter(Boolean).map(p => new RegExp('^\\.' + p + '\\b'));
const OLD = [...EXTRA,
  /^\.wrap\b/, /^\.top\b/, /^\.brand\b/, /^\.logo\b/, /^\.topacts\b/, /^\.iconbtn\b/, /^\.nav\b/, /^\.sky\b/, /^\.cloud\b/, /^\.twinkle\b/,
  /^\.hero\b/, /^\.mascot\b/, /^\.feats\b/, /^\.summary\b/, /^\.greet\b/, /^\.mood\b/, /^\.bubble\b/, /^\.tiles\b/, /^\.tile\b/, /^\.banner\b/, /^\.b-(sun|sky|coral|violet|rose|mint)\b/,
  /^\.sitefoot\b/, /^\.sf-brand\b/, /^\.sf-main\b/, /^\.sf-links\b/, /^\.sf-src\b/, /^\.sf-cast\b/, /^\.foot\b/, /^footer\.foot\b/, /^\.todayhead\b/, /^\.cast\b/, /^\.kidbar\b/,
  /^\.companion\b/, /^\.cbubble\b/, /^\.cchar\b/, /^\.stchar\b/, /^\.rambanner\b/, /^\.sf-credit\b/,
];
const old = sel => OLD.some(re => re.test(sel.trim()));
const KEYFRAMES = /^@keyframes\s+(drift|twinkle|bob|cfade)\b/;

const src = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

/** Splits css into top-level items: {head, body, kind: 'rule'|'at'|'text'} */
function items(css) {
  const out = []; let i = 0;
  while (i < css.length) {
    // comments and whitespace between rules
    const m = /^(\s|\/\*[\s\S]*?\*\/)+/.exec(css.slice(i));
    if (m) { out.push({ kind: 'text', raw: m[0] }); i += m[0].length; continue }
    let j = i, depth = 0, inStr = '';
    while (j < css.length) {
      const c = css[j];
      if (inStr) { if (c === '\\') j++; else if (c === inStr) inStr = ''; }
      else if (c === '"' || c === "'") inStr = c;
      else if (c === '(') { // url(...) may contain braces-free data URIs with quotes; skip to the matching paren
        let d = 1; j++; while (j < css.length && d) { if (css[j] === '(') d++; else if (css[j] === ')') d--; else if (css[j] === '"' || css[j] === "'") { const q = css[j]; j++; while (j < css.length && css[j] !== q) { if (css[j] === '\\') j++; j++ } } j++ } j--; }
      else if (c === '{') { depth++; if (depth === 1) { var open = j } }
      else if (c === '}') { depth--; if (depth === 0) { j++; break } }
      else if (c === ';' && depth === 0) { j++; break }
      j++;
    }
    const raw = css.slice(i, j);
    const b = raw.indexOf('{');
    if (b < 0) { out.push({ kind: 'text', raw }); i = j; continue }
    out.push({ kind: raw.trim().startsWith('@') ? 'at' : 'rule', head: raw.slice(0, b), body: raw.slice(b + 1, raw.lastIndexOf('}')), raw });
    i = j;
  }
  return out;
}

function filter(css, nested = false) {
  return items(css).map(it => {
    if (it.kind === 'text') return it.raw;
    if (it.kind === 'rule') {
      const sels = it.head.split(',').map(s => s.trim()).filter(Boolean), keep = sels.filter(s => !old(s));
      if (!keep.length) return '';
      return keep.length === sels.length ? it.raw : keep.join(',') + '{' + it.body + '}';
    }
    if (KEYFRAMES.test(it.head.trim())) return '';
    if (/^@media|^@supports/.test(it.head.trim())) {
      const inner = filter(it.body, true);
      return inner.replace(/\/\*[\s\S]*?\*\//g, '').trim() ? it.head + '{' + inner + '}' : '';
    }
    return it.raw;
  }).join('');
}

const out = filter(src).replace(/\n{3,}/g, '\n\n');
writeFileSync(new URL('../src/styles.css', import.meta.url), out);
console.log('before', src.split('\n').length, 'lines, after', out.split('\n').length);
