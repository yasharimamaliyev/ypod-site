import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScale, BASE_SCREENS, HOLDS, STEP_KEYS } from '../src/js/services-stage.js';

const css = readFileSync(new URL('../src/styles/sections.css', import.meta.url), 'utf8');
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

test('bölmənin CSS hündürlüyü = ekran + buildScale().total', () => {
  const heights = [...css.matchAll(/\.svc-anim \.svc \{ height: [\d.]+vh; height: ([\d.]+)svh/g)].map(m => +m[1]);
  // CSS-də əvvəl mobil, sonra desktop (media query) gəlir
  const expected = [BASE_SCREENS.mobile, BASE_SCREENS.desktop].map(b => Math.round((1 + buildScale(b).total) * 1000) / 10);
  assert.deepEqual(heights, expected);
});

test('dayanmada p dəyişmir, ondan sonra davam edir', () => {
  for (const base of Object.values(BASE_SCREENS)) {
    const s = buildScale(base);
    for (const [p, h] of HOLDS) {
      const u = s.uAt(p);
      close(s.pAt(u), p, 'dayanmanın başı');
      close(s.pAt(Math.min(s.total, u + h)), p, 'dayanmanın sonu');
    }
    let prev = -1;
    for (let u = 0; u <= s.total; u += 0.01) {
      const p = s.pAt(u);
      assert.ok(p >= prev - 1e-12, 'p azalmamalıdır');
      prev = p;
    }
    close(s.pAt(s.total), 1, 'son');
  }
});

test('S0 dayanması CSS-dəki nav linki (scroll-margin) ilə üst-üstə düşür', () => {
  const margins = [...css.matchAll(/scroll-margin-top: calc\(-1 \* var\(--nav-h\) - ([\d.]+)svh\)/g)].map(m => +m[1]);
  const expected = [BASE_SCREENS.mobile, BASE_SCREENS.desktop].map(b => Math.round(buildScale(b).uAt(0.04) * 1000) / 10);
  assert.deepEqual(margins, expected);
});

test('addım düymələri dayanmaların başına aparır', () => {
  const s = buildScale(BASE_SCREENS.desktop);
  for (const k of STEP_KEYS) assert.ok(HOLDS.some(([p]) => p === k), `${k} üçün dayanma yoxdur`);
  close(s.pAt(s.uAt(0.613) + 0.25), 0.613, 'Reels dayanmasının ortası');
});
