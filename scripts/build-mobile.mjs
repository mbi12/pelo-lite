import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

const apiOrigin = process.env.ITUTOR_API_ORIGIN || 'https://i-tutor-alpha.vercel.app';
const parsed = new URL(apiOrigin);
if (parsed.protocol !== 'https:' || parsed.origin !== apiOrigin || parsed.username || parsed.password) {
  throw new Error('ITUTOR_API_ORIGIN must be a bare HTTPS origin (no path, trailing slash, or credentials).');
}
execFileSync(process.execPath, ['scripts/prepare-vendor.mjs'], { stdio: 'inherit' });
await rm('mobile-www', { recursive: true, force: true });
await mkdir('mobile-www', { recursive: true });
await cp('public', 'mobile-www', { recursive: true });
// Android assets are shipped in the APK; service-worker caching is web-only.
await rm('mobile-www/sw.js', { force: true });
await rm('mobile-www/manifest.webmanifest', { force: true });
const html = (await readFile('public/index.html', 'utf8'))
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\/js\/app\.js\?v=\d+/, '/js/app.js')
  .replace(/\/css\/styles\.css\?v=\d+/, '/css/styles.css');
await writeFile('mobile-www/index.html', html);
await build({
  entryPoints: ['public/js/app.js'], outfile: 'mobile-www/js/app.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'chrome110',
  external: ['/vendor/*'],
  define: { __ITUTOR_API_ORIGIN__: JSON.stringify(apiOrigin) },
  sourcemap: false, minify: true
});
console.log(`Android assets ready. API: ${apiOrigin}. No server credentials are bundled.`);
