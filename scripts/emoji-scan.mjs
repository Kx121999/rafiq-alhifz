// Lists emoji left in the page code and markup (the child's own avatar choices and the picture that can be shared are expected).
// Usage: node scripts/emoji-scan.mjs
import { readdirSync, readFileSync } from 'node:fs';
const files = [...readdirSync(new URL('../src/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => 'src/' + f), 'index.html'];
const re = /\p{Extended_Pictographic}/u;
let total = 0;
for (const f of files) {
  readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
    if (re.test(line)) { total++; console.log(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 130)) }
  });
}
console.log(total + ' lines with emoji');
