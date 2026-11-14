import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out + '/fonts', { recursive: true });

await build({
  entryPoints: ['src/boot.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: out + '/app.js',
  legalComments: 'none',
  loader: { '.json': 'json', '.jpg': 'dataurl', '.png': 'dataurl' },
  logLevel: 'warning'
});

const fonts = {
  'inter-latin-wght-normal.woff2': 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  'inter-latin-ext-wght-normal.woff2': 'node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2'
};
for (const [n, p] of Object.entries(fonts)) fs.copyFileSync(p, `${out}/fonts/${n}`);
fs.copyFileSync('src/styles.css', out + '/styles.css');
fs.copyFileSync('src/index.html', out + '/index.html');
fs.copyFileSync('src/config.js', out + '/config.js');
if (fs.existsSync('public/data')) fs.cpSync('public/data', out + '/data', { recursive: true });

// Version en un seul fichier : tout est intégré (script, styles, polices).
let html = fs.readFileSync('src/index.html', 'utf8');
let css = fs.readFileSync('src/styles.css', 'utf8');
css = css.replace(/url\(\.\/fonts\/([^)]+)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(`${out}/fonts/${f}`).toString('base64')})`);
const js = fs.readFileSync(out + '/app.js', 'utf8').replace(/<\/script/g, '<\\/script');
const cfg = fs.readFileSync('src/config.js', 'utf8');
html = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`)
  .replace('<script src="app.js"></script>', () => `<script>${cfg}</script>\n<script>${js}</script>`);
fs.writeFileSync(out + '/earth-detective.html', html);
// la version dossier charge la configuration avant l'application
fs.writeFileSync(out + '/index.html', fs.readFileSync(out + '/index.html', 'utf8').replace('<script src="app.js"></script>', '<script src="config.js"></script>\n<script src="app.js"></script>'));
console.log('ok', (fs.statSync(out + '/app.js').size / 1024).toFixed(0) + ' Ko app.js,', (fs.statSync(out + '/earth-detective.html').size / 1024 / 1024).toFixed(2) + ' Mo fichier unique');
