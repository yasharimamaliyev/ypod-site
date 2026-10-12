// Paylaşım şəkillərini çəkir: public/og/og-{az,en,ru}.jpg (1200×630) və public/apple-touch-icon.png (180×180).
// Mətnlər i18n-dən (hero.pill, hero.sub), mikrofon src/assets/mic-hero.webp-dən gəlir. Mətn və ya şəkil dəyişəndə yenidən işlət:
//   node scripts/og-render.mjs
// puppeteer-core və Google Chrome lazımdır.
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const f = p => pathToFileURL(resolve(ROOT, p)).href;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const fonts = `
@font-face { font-family: U; font-weight: 900; src: url(${f('src/assets/fonts/unbounded-900-lat.woff2')}); unicode-range: U+0000-03FF, U+2000-27FF; }
@font-face { font-family: U; font-weight: 900; src: url(${f('src/assets/fonts/unbounded-900-cyr.woff2')}); unicode-range: U+0400-045F, U+2116; }
@font-face { font-family: M; font-weight: 400 800; src: url(${f('src/assets/fonts/manrope-lat.woff2')}); unicode-range: U+0000-03FF, U+2000-27FF; }
@font-face { font-family: M; font-weight: 400 800; src: url(${f('src/assets/fonts/manrope-cyr.woff2')}); unicode-range: U+0400-045F, U+2116; }
* { margin: 0; box-sizing: border-box; }
body { background: #0b0713; }`;

const card = t => `<!doctype html><meta charset="utf-8"><style>${fonts}
.c { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #0b0713; font-family: M, system-ui, sans-serif; color: #fdf6ff; }
.glow { position: absolute; left: 930px; top: 330px; width: 820px; height: 820px; transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(closest-side, rgba(168, 85, 247, .5), rgba(124, 58, 237, .16) 55%, rgba(11, 7, 19, 0)); }
.wm { position: absolute; left: 930px; top: 50%; transform: translate(-50%, -50%); font: 900 230px/1 U; letter-spacing: -.05em; color: rgba(253, 246, 255, .035); white-space: nowrap; }
.mic { position: absolute; right: 120px; top: 22px; height: 586px; transform: rotate(9deg); }
.txt { position: absolute; left: 80px; top: 50%; transform: translateY(-50%); width: 700px; display: flex; flex-direction: column; gap: 30px; align-items: flex-start; }
.pill { display: inline-flex; align-items: center; gap: 10px; height: 44px; padding: 0 20px; border-radius: 999px; background: #fdf6ff; color: #3b0764; font: 700 20px/1 M; }
.pill i { width: 9px; height: 9px; border-radius: 50%; background: #a855f7; }
.logo { display: flex; align-items: center; gap: 18px; font: 900 110px/1 U; letter-spacing: -.03em; }
.logo i { width: 18px; height: 18px; border-radius: 50%; background: #a855f7; box-shadow: 0 0 30px 8px rgba(168, 85, 247, .8); }
.sub { font: 500 32px/1.3 M; color: rgba(253, 246, 255, .8); text-wrap: balance; }
</style>
<div class="c"><div class="glow"></div><div class="wm">Y POD</div><img class="mic" src="${f('src/assets/mic-hero.webp')}">
<div class="txt"><span class="pill"><i></i>${esc(t.hero.pill)}</span><div class="logo"><i></i>Y POD</div><p class="sub">${esc(t.hero.sub)}</p></div></div>`;

// iOS künclərini özü yuvarlaqlaşdırır: ikon tam kvadratdır (favicon.svg ilə eyni nöqtə)
const icon = `<!doctype html><meta charset="utf-8"><style>${fonts}
.c { width: 180px; height: 180px; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(closest-side, rgba(168, 85, 247, .28), #0b0713); }
.c i { width: 68px; height: 68px; border-radius: 50%; background: #a855f7; box-shadow: 0 0 28px 6px rgba(168, 85, 247, .7); }
</style><div class="c"><i></i></div>`;

const tmp = mkdtempSync(join(tmpdir(), 'ypod-og-'));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
async function shot(html, w, h, out, type) {
  const file = join(tmp, 'p.html');
  writeFileSync(file, html);
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(out), { recursive: true });
  await p.screenshot({ path: out, type, ...(type === 'jpeg' ? { quality: 88 } : {}), clip: { x: 0, y: 0, width: w, height: h } });
  console.log('→', out.replace(ROOT + '/', ''));
}
for (const code of ['az', 'en', 'ru']) {
  const t = JSON.parse(readFileSync(resolve(ROOT, 'src/i18n', `${code}.json`), 'utf8'));
  await shot(card(t), 1200, 630, resolve(ROOT, `public/og/og-${code}.jpg`), 'jpeg');
}
await shot(icon, 180, 180, resolve(ROOT, 'public/apple-touch-icon.png'), 'png');
await b.close();
