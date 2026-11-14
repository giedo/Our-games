// Packs the whole game into ONE html file (dist/krabbel-kart.html) that works
// by double-clicking it, without a web server.  Usage:
//   npm install && npm run build:single
// Add --embed to produce a body-only variant for embedding in page hosts that
// wrap the content in their own <html> skeleton (dist/krabbel-kart-embed.html).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const embed = process.argv.includes('--embed');
const read = (p) => readFileSync(join(root, p), 'utf8');
const b64 = (p) => readFileSync(join(root, p)).toString('base64');

const js = await build({
  entryPoints: [join(root, 'js/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  alias: { three: join(root, 'vendor/three.module.min.js') },
  define: embed ? { KK_NO_DOWNLOAD: 'true' } : {},
  legalComments: 'none',
  logLevel: 'warning',
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

let css = read('css/style.css');
css = css.replace(/url\("\.\.\/fonts\/fredoka-latin\.woff2"\)/, `url("data:font/woff2;base64,${b64('fonts/fredoka-latin.woff2')}")`);

const page = read('index.html');
const body = page.slice(page.indexOf('<body>') + 6, page.indexOf('<script type="module"')).trim();
const notice = '<!-- Krabbel Kart single-file build. Includes three.js (MIT) and the Fredoka font (SIL OFL 1.1). -->';

let html;
if (embed) {
  html = `<title>Krabbel Kart</title>
<meta name="claude:viewport-fit-sides" content="cover">
${notice}
<style>
${css}
</style>
${body}
<script>
${code}
</script>
`;
} else {
  html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Krabbel Kart</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="icon" type="image/png" href="data:image/png;base64,${b64('icons/icon-192.png')}">
${notice}
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${code}
</script>
</body>
</html>
`;
}
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', embed ? 'krabbel-kart-embed.html' : 'krabbel-kart.html');
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
