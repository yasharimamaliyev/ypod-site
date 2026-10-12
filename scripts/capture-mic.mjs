// 3D mikrofonun ilk kadrını şəffaf fonla çəkir: src/assets/mic-hero.webp (3D yüklənənə qədər görünən şəkil).
// Model və ya işıq dəyişəndə yenidən işlət:
//   npm run build && npm run preview -- --port 4180
//   node scripts/capture-mic.mjs http://localhost:4180/ src/assets/mic-hero.webp
// puppeteer-core və Google Chrome lazımdır (npm i -D puppeteer-core).
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const [url, out, pinH = '1000', dpr = '2'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__freeze = true;
  window.requestAnimationFrame = cb => raf(() => cb(window.__freeze ? 0 : performance.now()));
});
await p.setViewport({ width: 1440, height: 1200, deviceScaleFactor: +dpr });
await p.goto(url, { waitUntil: 'load' });
const navH = await p.evaluate(() => document.querySelector('.hero-pin').getBoundingClientRect().top);
await p.setViewport({ width: 1440, height: Math.round(+pinH + navH), deviceScaleFactor: +dpr });
await p.mouse.move(300, 300);
await p.waitForFunction(() => document.documentElement.classList.contains('is-3d-ready'), { timeout: 20000 });
await new Promise(r => setTimeout(r, 1500));
const info = await p.evaluate(() => {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  const s = document.createElement('style');
  s.textContent = `*{background:transparent!important;visibility:hidden!important;box-shadow:none!important} .hero-canvas{visibility:visible!important;transition:none!important} .hero-glow{display:none!important}`;
  document.head.append(s);
  const r = document.querySelector('.hero-canvas').getBoundingClientRect();
  return { w: r.width, h: r.height };
});
await new Promise(r => setTimeout(r, 300));
const el = await p.$('.hero-canvas');
const pngA = await el.screenshot({ omitBackground: true, encoding: 'base64' });   // alfa
await p.evaluate(() => { document.documentElement.style.setProperty('background', '#000', 'important'); });
await new Promise(r => setTimeout(r, 200));
const pngC = await el.screenshot({ encoding: 'base64' });                          // qara fonda = premultiplied rəng
const res = await p.evaluate(async (a64, c64) => {
  const load = async b => { const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
  const A = await load(a64), C = await load(c64);
  const W = A.width, H = A.height, out = new ImageData(W, H), d = out.data;
  let x0 = W, x1 = 0;
  for (let i = 0; i < W * H; i++) {
    const r = C.data[i*4], g = C.data[i*4+1], b = C.data[i*4+2];
    // əlavə işıqda rəng alfadan böyük ola bilir: alfanı rəngə qədər qaldır (fon cüzi tündləşir, ağarma olmur)
    const a = Math.max(A.data[i*4+3], r, g, b);
    if (a > 2) { const x = i % W; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (!a) continue;
    d[i*4] = Math.min(255, Math.round(r * 255 / a)); d[i*4+1] = Math.min(255, Math.round(g * 255 / a)); d[i*4+2] = Math.min(255, Math.round(b * 255 / a)); d[i*4+3] = a;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
  const half = Math.max(W / 2 - x0, x1 - W / 2) + 4;
  const o = document.createElement('canvas'); o.width = Math.round(half * 2); o.height = H;
  o.getContext('2d').drawImage(c, W / 2 - half, 0, half * 2, H, 0, 0, o.width, o.height);
  return { webp: o.toDataURL('image/webp', 0.85).split(',')[1], w: o.width, h: H };
}, pngA, pngC);
writeFileSync(out, Buffer.from(res.webp, 'base64'));
console.log({ navH, ...info, w: res.w, h: res.h,  });
await b.close();
