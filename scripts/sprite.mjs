// Builds the SVG icon sprite that is placed at the top of index.html (every icon: 24x24, stroke 1.75, round caps).
// Run: node scripts/sprite.mjs  (rewrites the block between the sprite markers in index.html).
import { readFileSync, writeFileSync } from 'node:fs';

const I = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  book: '<path d="M12 6.5c-1.8-1.3-4.3-2-8-2v13c3.7 0 6.2.7 8 2 1.8-1.3 4.3-2 8-2v-13c-3.7 0-6.2.7-8 2z"/><path d="M12 6.5v13"/>',
  repeat: '<path d="M17 3l4 4-4 4"/><path d="M3 12V10a3 3 0 0 1 3-3h15"/><path d="M7 21l-4-4 4-4"/><path d="M21 12v2a3 3 0 0 1-3 3H3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5.5a1 1 0 0 0-1 1c0 2.4 1.7 4 3.5 4"/><path d="M16 6h2.5a1 1 0 0 1 1 1c0 2.4-1.7 4-3.5 4"/><path d="M12 13v4"/><path d="M8.5 20h7"/><path d="M10 17h4v3h-4z"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 10v5M4.5 12.5h5"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="14" r=".9" fill="currentColor"/>',
  beads: '<circle cx="12" cy="4.5" r="1.9"/><circle cx="18.2" cy="8" r="1.9"/><circle cx="19" cy="14.8" r="1.9"/><circle cx="14.6" cy="19.6" r="1.9"/><circle cx="8" cy="19" r="1.9"/><circle cx="4.6" cy="13.2" r="1.9"/><circle cx="6.2" cy="7" r="1.9"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.3"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  flag: '<path d="M5 21V4"/><path d="M5 5h11l-2 3.5 2 3.5H5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>',
  sunrise: '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 5v3M4.9 9.9l2 2M19.1 9.9l-2 2"/>',
  bed: '<path d="M3 19V8"/><path d="M3 15h18v4"/><path d="M21 15v-2.5A2.5 2.5 0 0 0 18.5 10H11v5"/><circle cx="7" cy="12" r="1.7"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  forward: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  back: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  chevleft: '<path d="m14 6-6 6 6 6"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
  bookmark: '<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  flame: '<path d="M12 3c1 4-4 5-4 10a5 5 0 0 0 10 0c0-3-2-4-2-7-1.5 1-2 2-2.5 3C13 7.5 13 5 12 3z"/>',
  medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.6 3.5 12 9.5l3.4-6"/><path d="m12 12 .9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  printer: '<path d="M7 9V4h10v5"/><path d="M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="6"/>',
  volume: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lantern: '<path d="M9 3h6M12 3v2.5"/><path d="M8 7h8l1.5 9h-11z"/><path d="M7 16h10l-1 4H8z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  undo: '<path d="M3 10h11a5 5 0 0 1 0 10H8"/><path d="M7 6 3 10l4 4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.4 7.6C3.8 9.4 2 12 2 12s3.5 6 10 6a9 9 0 0 0 4-.9"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  puzzle: '<path d="M10 4h4v3a2 2 0 1 0 4 0V4h2v6h-3a2 2 0 1 0 0 4h3v6h-6v-3a2 2 0 1 0-4 0v3H4v-6h3a2 2 0 1 0 0-4H4V4z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
  wifioff: '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 3.5-2.2M19 12.5a10 10 0 0 0-5-2.6M2 9a15 15 0 0 1 4.4-2.8M22 9a15 15 0 0 0-8.4-3.9"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
};

const NS = '<svg id="iconSprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">';
const sprite = '<!-- sprite:start (generated by scripts/sprite.mjs) -->\n' + NS + '\n' +
  Object.entries(I).map(([n, p]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${p}</symbol>`).join('\n') + '\n</svg>\n<!-- sprite:end -->';

const f = new URL('../index.html', import.meta.url); let h = readFileSync(f, 'utf8');
if (h.includes('<!-- sprite:start')) h = h.replace(/<!-- sprite:start[\s\S]*?<!-- sprite:end -->/, sprite);
else h = h.replace('<body>\n', '<body>\n' + sprite + '\n');
writeFileSync(f, h);
console.log(Object.keys(I).length, 'icons written');
