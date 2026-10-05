import { defineConfig } from 'vite';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

/** After the build, lists every output file in sw.js and versions the cache by their content. */
function precacheManifest() {
  let outDir = 'dist';
  return {
    name: 'precache-manifest',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p] });
      const files = walk(outDir).map(p => relative(outDir, p).split('\\').join('/')).filter(f => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha1');
      files.forEach(f => { hash.update(f); hash.update(readFileSync(join(outDir, f))) });
      const sw = readFileSync(join(outDir, 'sw.js'), 'utf8')
        .replace("'__VERSION__'", "'" + hash.digest('hex').slice(0, 10) + "'")
        .replace('const PRECACHE = __PRECACHE__;', 'const PRECACHE = ' + JSON.stringify(['./', ...files.map(f => './' + f)]) + ';');
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

// Relative base so the built site works from any subfolder (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  // which commit this build is made from, shown on the device check page so a problem report can name the exact version
  define: { __BUILD__: JSON.stringify((process.env.GITHUB_SHA || 'dev').slice(0, 7)) },
  plugins: [precacheManifest()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.js'], setupFiles: ['tests/setup.js'] },
});
