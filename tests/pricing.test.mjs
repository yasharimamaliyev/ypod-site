import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, studioPrice, fullPrice, reelsPrice, EDIT, corpOld, corpNow, corpPerHour, fmt } from '../src/js/pricing.js';

test('kart qiymətləri (6): studiya və tam xidmət', () => {
  assert.deepEqual([0, 1, 2].map(studioPrice), [70, 120, 170]);
  assert.deepEqual([0, 1, 2].map(c => fullPrice(c)), [170, 220, 270]);
  assert.deepEqual([0, 1, 2].map(c => studioPrice(c, 'studio')), [70, 120, 170]);
});

test('Sizin məkanda (səyyar studiya): çəkiliş və tam xidmət', () => {
  assert.deepEqual([0, 1, 2].map(c => studioPrice(c, 'onsite')), [140, 240, 340]);
  assert.deepEqual([0, 1, 2].map(c => fullPrice(c, 'onsite')), [240, 340, 440]);
});

test('Reels Paketi və montaj yerə görə', () => {
  assert.equal(reelsPrice('studio'), 150);
  assert.equal(reelsPrice('onsite'), 250);
  assert.equal(reelsPrice(), 150);
  assert.equal(EDIT, 100); // montaj hər iki yerdə eynidir
});

test('korporativ qiymətlər (12) cədvəllə üst-üstə düşür', () => {
  const expected = [
    [315, 540, 765],
    [560, 960, 1360],
    [735, 1260, 1785],
    [840, 1440, 2040],
  ];
  TIERS.forEach((t, i) => assert.deepEqual([0, 1, 2].map(c => corpNow(t, c)), expected[i]));
});

test('korporativ qiymət = köhnə qiymət − endirim', () => {
  for (const t of TIERS) {
    for (const c of [0, 1, 2]) {
      assert.equal(corpNow(t, c), corpOld(t, c) * (100 - t.d) / 100, `${t.h} saat, ${c + 1} kamera`);
    }
  }
});

test('köhnə qiymət və saat qiyməti', () => {
  assert.equal(corpOld(TIERS[0], 0), 350);
  assert.equal(corpPerHour(TIERS[0], 0), 63);
  assert.equal(corpOld(TIERS[3], 2), 3400);
  assert.equal(corpPerHour(TIERS[3], 2), 102);
});

test('minlik ayırıcı bölünməyən boşluqdur', () => {
  assert.equal(fmt(1360), '1 360');
  assert.equal(fmt(840), '840');
  assert.equal(fmt(12345), '12 345');
});
