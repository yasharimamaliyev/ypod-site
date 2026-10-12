// Claude Design kadrlarını (.dc.html) PNG-yə çevirir. Bu fayllar redaktorun runtime-ı (support.js) olmadan
// brauzerdə boş açılır: burada onun kiçik əvəzi var ({{…}}, <sc-for>, <sc-if>, <dc-import>, DCLogic.renderVals).
//   node scripts/dc-render.mjs <design-qovluğu> <çıxış-qovluğu>              → hər kadr bir PNG
//   node scripts/dc-render.mjs <design-qovluğu> <çıxış-qovluğu> --sweep d    → 0–100% addımlarla kiçik kadrlar (d və ya m)
// puppeteer-core və Google Chrome lazımdır (npm i -D puppeteer-core).
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out, flag, sweepMode = 'd'] = process.argv.slice(2);
if (!dir || !out) { console.error('İstifadə: node scripts/dc-render.mjs <design-qovluğu> <çıxış-qovluğu> [--sweep d|m]'); process.exit(1); }
mkdirSync(out, { recursive: true });

const files = Object.fromEntries(readdirSync(dir).filter(f => f.endsWith('.dc.html')).map(f => [f.replace('.dc.html', ''), readFileSync(join(dir, f), 'utf8')]));
const SIZE = { d: [1440, 900, 1], m: [390, 844, 2] };

const jobs = [];
if (flag === '--sweep') {
  const stage = Object.keys(files).find(n => /Stage$/.test(n));
  const [w, h] = SIZE[sweepMode];
  for (let i = 0; i <= 100; i++) jobs.push({ comp: stage, props: { p: String(i / 100), mode: sweepMode }, w, h, dpr: 0.2, out: `sweep-${sweepMode}-${String(i).padStart(3, '0')}.png` });
} else {
  for (const [name, text] of Object.entries(files)) {
    const imp = text.match(/<dc-import name="(\w+)" p="([\d.]+)" mode="(\w)"/);
    if (imp) { const [w, h, dpr] = SIZE[imp[3]] || SIZE.d; jobs.push({ comp: imp[1], props: { p: imp[2], mode: imp[3] }, w, h, dpr, out: name + '.png' }); }
    else if (!/Stage$/.test(name)) {
      const pw = +(text.match(/"\$preview":\{"width":(\d+)/) || [])[1] || 1440;
      jobs.push({ comp: name, props: {}, w: pw, h: 900, dpr: 1, full: true, out: name + '.png' });
    }
  }
}

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
for (const job of jobs) {
  await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: job.dpr });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#0b0713"></body></html>');
  const height = await page.evaluate(async (files, job) => {
    class DCLogic { constructor(props) { this.props = props || {}; this.state = {}; } setState(o) { Object.assign(this.state, o); } }
    const cache = {};
    const parse = name => {
      if (cache[name]) return cache[name];
      const doc = new DOMParser().parseFromString(files[name], 'text/html');
      const xdc = doc.querySelector('x-dc');
      const helmet = xdc.querySelector('helmet');
      const head = helmet ? helmet.innerHTML : '';
      helmet?.remove();
      const sc = doc.querySelector('script[data-dc-script]');
      const meta = sc ? JSON.parse(sc.dataset.props || '{}') : {};
      const Comp = sc ? Function('DCLogic', sc.textContent + '\nreturn Component;')(DCLogic) : null;
      return (cache[name] = { xdc, head, meta, Comp });
    };
    const ev = (e, scope) => { try { return Function(...Object.keys(scope), 'return (' + e + ');')(...Object.values(scope)); } catch { return undefined; } };
    const interp = (str, scope) => {
      const whole = str.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
      if (whole) return ev(whole[1], scope);
      return str.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => { const v = ev(e, scope); return v == null ? '' : String(v); });
    };
    const heads = new Set();
    const render = (name, props, parent) => {
      const c = parse(name);
      if (!heads.has(name)) { heads.add(name); document.head.insertAdjacentHTML('beforeend', c.head); }
      const defaults = Object.fromEntries(Object.entries(c.meta).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.default]));
      const scope = c.Comp ? new c.Comp({ ...defaults, ...props }).renderVals() || {} : {};
      walk(c.xdc, scope, parent);
    };
    const walk = (node, scope, parent) => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) { parent.appendChild(document.createTextNode(String(interp(ch.textContent, scope) ?? ''))); continue; }
        if (ch.nodeType !== 1 || ch.localName === 'script') continue;
        const ln = ch.localName;
        if (ln === 'sc-for') {
          const as = ch.getAttribute('as') || 'item';
          [...(interp(ch.getAttribute('list'), scope) || [])].forEach((it, i) => walk(ch, { ...scope, [as]: it, index: i }, parent));
        } else if (ln === 'sc-if') {
          if (interp(ch.getAttribute('value'), scope)) walk(ch, scope, parent);
        } else if (ln === 'dc-import') {
          const props = {};
          for (const a of ch.attributes) if (a.name !== 'name' && !a.name.startsWith('hint-')) props[a.name] = interp(a.value, scope);
          render(ch.getAttribute('name'), props, parent);
        } else {
          const el = ch.namespaceURI === 'http://www.w3.org/1999/xhtml' ? document.createElement(ln) : document.createElementNS(ch.namespaceURI, ln);
          for (const a of ch.attributes) {
            if (a.name.startsWith('hint-') || /^on/i.test(a.name)) continue;
            const v = interp(a.value, scope);
            if (v == null || v === false) continue;
            if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, a.name, String(v)); else el.setAttribute(a.name, String(v));
          }
          walk(ch, scope, el);
          parent.appendChild(el);
        }
      }
    };
    render(job.comp, job.props, document.body);
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 150));
    return document.body.scrollHeight;
  }, files, job);
  await page.screenshot({ path: join(out, job.out), ...(job.full ? { clip: { x: 0, y: 0, width: job.w, height }, captureBeyondViewport: true } : {}) });
}
await browser.close();
console.log(`${jobs.length} kadr → ${out}`);
