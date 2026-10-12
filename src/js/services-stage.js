// Xidmətlər filminin bütün dəyərləri scroll faizindən (p, 0–1) hesablanır.
// Bu, ypod-services-handoff v3 prototipinin (design/ServicesStage.dc.html → renderVals) birə-bir köçürməsidir:
// açar kadrlar, easing-lər və pəncərələr oradakı kimidir. Dəyişiklik lazım olsa, əvvəl prototipə bax.
// L = { ax, ay, as }: "#art" qutusunun ekrandakı yeri və miqyası (services.js → layout()).

const cl = (x, a, b) => (x < a ? a : x > b ? b : x);
const EZ = {
  l: t => t,
  i2: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  i3: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  o2: t => 1 - (1 - t) * (1 - t),
  o3: t => 1 - Math.pow(1 - t, 3),
  n2: t => t * t,
};
const L = (a, b, t) => a + (b - a) * t;
const n = x => Math.round(x * 100) / 100;
const tr = (x, y, sx, sy) => 'translate(' + n(x) + ' ' + n(y) + ')' + (sx === undefined ? '' : ' scale(' + n(sx) + ' ' + n(sy === undefined ? sx : sy) + ')');

// Addım göstəricisi: səhnə pəncərələri (BRIEF bölmə 7) və klikdə gedilən kadr: səhnənin bitdiyi an (dayanmanın başı)
export const STEP_RANGES = [[0.06, 0.2], [0.2, 0.34], [0.34, 0.48], [0.48, 0.62], [0.62, 0.818], [0.818, 1.0001]];
export const STEP_KEYS = [0.175, 0.31, 0.455, 0.613, 0.8, 0.963];

/* ---------- Zaman şkalası: dizayndakı p + dayanmalar ----------
   Dizaynda səhnələr arasında demək olar dayanma yoxdur. Burada hər səhnə tam formalaşanda "boş scroll" var:
   kadr yerində qalır, scroll davam edir. Ölçülər ekran hündürlüyünün payıdır (0.4 = 40vh). */
export const BASE_SCREENS = { desktop: 7, mobile: 6 };      // dizayndakı pin uzunluğu (700vh / 600vh)
export const HOLDS = [
  [0.04, 0.4],   // S0 "Siz danışın, qalanını biz edək"
  [0.175, 0.4],  // S1
  [0.31, 0.4],   // S2
  [0.455, 0.4],  // S3
  [0.613, 0.5],  // S4 Reels, 5/5
  [0.745, 0.4],  // S5 furqon yolda
  [0.8, 0.4],    // S5b həkim kabineti (v3-ün əsas kadrı)
  [0.963, 0.4],  // S6 "Hazırdır"
  [1, 0.4],      // Final: pin buraxılmazdan əvvəl
];
export const STRETCH = [[0.577, 0.613, 1.5]];               // Reels kartlarının düzülməsi 1.5× yavaş

// Ekran vahidində (u) düyün nöqtələri: [u, p]. Dayanmada p dəyişmir.
export function buildScale(base) {
  const cuts = [...new Set([0, 1, ...HOLDS.map(h => h[0]), ...STRETCH.flatMap(s => [s[0], s[1]])])].sort((a, b) => a - b);
  const knots = [[0, 0]];
  let u = 0;
  for (let i = 0; i < cuts.length; i++) {
    const p = cuts[i];
    if (i > 0) {
      const a = cuts[i - 1];
      const k = STRETCH.find(([s, e]) => a >= s && p <= e)?.[2] ?? 1;
      u += (p - a) * base * k;
      knots.push([u, p]);
    }
    const hold = HOLDS.find(h => h[0] === p);
    if (hold) { u += hold[1]; knots.push([u, p]); }
  }
  const total = u;
  const pAt = x => {
    if (x <= 0) return 0;
    for (let i = 1; i < knots.length; i++) {
      const [u1, p1] = knots[i];
      if (x <= u1) { const [u0, p0] = knots[i - 1]; return u1 === u0 ? p1 : p0 + (p1 - p0) * (x - u0) / (u1 - u0); }
    }
    return 1;
  };
  // p-nin ilk çatıldığı u (dayanma varsa, onun başı)
  const uAt = p => {
    for (let i = 1; i < knots.length; i++) {
      const [u1, p1] = knots[i];
      if (p <= p1) { const [u0, p0] = knots[i - 1]; return p1 === p0 ? u0 : u0 + (u1 - u0) * (p - p0) / (p1 - p0); }
    }
    return total;
  };
  return { total, pAt, uAt };
}
// Statik versiyanın kart şəkilləri (BRIEF bölmə 9)
export const STATIC_KEYS = [0.175, 0.31, 0.455, 0.613, 0.8, 0.958];

// [giriş a, b, çıxış c, d] — mətn blokları S1…S6
const TX = [[0.125, 0.147, 0.2, 0.214], [0.232, 0.252, 0.34, 0.354], [0.385, 0.405, 0.48, 0.494], [0.556, 0.574, 0.62, 0.634], [0.652, 0.672, 0.826, 0.838], [0.838, 0.856, 0.962, 0.972]];
// Chip-lər: [giriş a, b, çıxış c, d]; etiketlər HTML-dədir
const EDIT_STEPS = [[0.852, 0.897], [0.897, 0.935], [0.935, 0.964]];

/**
 * @param {number} p scroll faizi 0–1
 * @param {{ax:number, ay:number, as:number}} Lt "#art" yerləşməsi
 * @param {{digits:number[]}} chipInfo hər chip-in rəqəm sayı
 */
export function computeStage(p, Lt, chipInfo) {
  p = p >= 0 ? (p > 1 ? 1 : p) : 0;
  const K = ks => {
    if (p <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      const b = ks[i];
      if (p <= b[0]) { const a = ks[i - 1]; const t = (p - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * EZ[b[2] || 'i2'](t); }
    }
    return ks[ks.length - 1][1];
  };
  const R = (a, b, e) => EZ[e || 'i2'](cl((p - a) / (b - a), 0, 1));
  const FL = (a, b) => {
    if (p <= a) return 0;
    if (p >= b) return 1;
    const q = [0, 0.75, 0.1, 0.9, 0.25, 0.95, 0.55, 1];
    const t = (p - a) / (b - a) * (q.length - 1); const i = Math.floor(t);
    return q[i] + (q[i + 1] - q[i]) * Math.min(1, (t - i) * 3);
  };
  const toS = (x, y) => [n(Lt.ax + (x - 500) * Lt.as), n(Lt.ay + (y - 400) * Lt.as)];
  const s = {};

  /* virtual camera */
  const vx = K([[0, 0], [0.5, 0], [0.575, 37, 'i3'], [0.62, 37], [0.64, 0, 'i3'], [0.68, 0], [0.705, 1150, 'i3'], [0.755, 1150], [0.772, 1340], [0.778, 1340], [0.8, 1480, 'i3'], [0.818, 1480], [0.842, 1435, 'i3']]);
  const vy = K([[0, 150], [0.105, 150], [0.145, 20, 'i3'], [0.36, 20], [0.42, -10, 'i3'], [0.5, -10], [0.575, -40, 'i3'], [0.62, -40], [0.64, 0, 'i3'], [0.68, 0], [0.705, 200, 'i3'], [0.755, 200], [0.772, 170], [0.778, 170], [0.8, 162, 'i3'], [0.818, 162], [0.842, 218.1, 'i3']]);
  const vz = K([[0, 1.7], [0.105, 1.7], [0.145, 1, 'i3'], [0.21, 1], [0.26, 0.95], [0.36, 0.95], [0.42, 0.78, 'i3'], [0.5, 0.78], [0.575, 1.15, 'i3'], [0.62, 1.15], [0.64, 0.78, 'i3'], [0.68, 0.78], [0.705, 0.85, 'i3'], [0.755, 0.85], [0.772, 0.8], [0.778, 0.8], [0.8, 3.33, 'i3'], [0.818, 3.33], [0.842, 6, 'i3'], [0.856, 10, 'n2']]);
  s.art = 'translate(' + n(Lt.ax) + ' ' + n(Lt.ay) + ') scale(' + Math.round(Lt.as * 10000) / 10000 + ') translate(-500 -400)';
  s.wv = 'translate(500 400) scale(' + n(vz * 1000) / 1000 + ') translate(' + n(-vx) + ' ' + n(-vy) + ')';
  s.wo = K([[0, 1], [0.845, 1], [0.858, 0]]);
  s.flo = K([[0, 0], [0.1, 0], [0.14, 1]]);

  /* studio backdrop */
  s.bdx = n(K([[0, 0], [0.205, 0], [0.265, -1400, 'i3']]));
  s.bdo = K([[0, 0], [0.11, 0], [0.145, 1], [0.495, 1], [0.53, 0.25], [0.625, 0.25], [0.645, 0.7], [0.68, 0.7], [0.7, 0]]);
  s.bal = K([[0, 0], [0.13, 0], [0.15, 1], [0.23, 1], [0.26, 0]]);
  s.bbl = K([[0, 0], [0.25, 0], [0.27, 1], [0.495, 1], [0.53, 0.4], [0.625, 0.4], [0.645, 0.6], [0.68, 0.6], [0.7, 0]]);
  s.pool = K([[0, 0], [0.12, 0], [0.15, 1], [0.495, 1], [0.53, 0.3], [0.625, 0.3], [0.645, 0.6], [0.68, 0]]);

  /* lights */
  const tlx = K([[0, 0], [0.66, 0], [0.675, -330]]);
  const tly = K([[0, -560], [0.4, -560], [0.43, -340, 'o3'], [0.66, -340], [0.675, 200, 'n2']]);
  const tlf = K([[0, 1], [0.65, 1], [0.665, 0.35]]);
  s.tlt = tr(tlx, tly, tlf);
  s.tlo = K([[0, 0], [0.4, 0], [0.415, 1], [0.672, 1], [0.678, 0]]);
  s.tll = n(FL(0.43, 0.455) * K([[0, 1], [0.645, 1], [0.65, 0]]));
  const sOff = K([[0, 1], [0.495, 1], [0.53, 0.55], [0.625, 0.55], [0.645, 0.45], [0.65, 0]]);
  const sLx = K([[0, -330], [0.205, -330], [0.25, -440, 'i3'], [0.35, -440], [0.4, -560, 'i3'], [0.66, -560], [0.675, -330]]);
  const sRx = K([[0, 330], [0.205, 330], [0.25, 440, 'i3'], [0.35, 440], [0.4, 560, 'i3'], [0.66, 560], [0.675, 330]]);
  const sY = K([[0, -110], [0.66, -110], [0.675, 170, 'n2']]);
  const sF = K([[0, 1], [0.65, 1], [0.665, 0.32]]);
  s.sLt = tr(sLx, sY, sF); s.sRt = tr(sRx, sY, -sF, sF);
  s.sLo = K([[0, 0], [0.1, 0], [0.106, 1], [0.672, 1], [0.678, 0]]);
  s.sRo = K([[0, 0], [0.11, 0], [0.116, 1], [0.672, 1], [0.678, 0]]);
  s.sLl = n(FL(0.108, 0.125) * sOff); s.sRl = n(FL(0.118, 0.135) * sOff);
  s.cLt = tr(sLx + 6, sY); s.cLo = n(s.sLl * 0.95);
  s.cRt = tr(sRx - 6, sY, -1, 1); s.cRo = n(s.sRl * 0.95);
  s.cTt = tr(tlx, tly); s.cTo = s.tll;

  /* chairs, desk, mics */
  const c1x = K([[0, 0], [0.205, 0], [0.25, -140, 'i3'], [0.35, -140], [0.4, -260, 'i3'], [0.495, -260], [0.53, -300], [0.625, -300], [0.645, -260], [0.66, -260], [0.675, -330]]);
  const c2x = K([[0, 700], [0.215, 700], [0.26, 140, 'o3'], [0.35, 140], [0.4, 260, 'i3'], [0.495, 260], [0.53, 300], [0.625, 300], [0.645, 260], [0.66, 260], [0.675, 330]]);
  const c3y = K([[0, 95], [0.37, 95], [0.405, 0, 'o3']]);
  const m3y = K([[0, 30], [0.37, 30], [0.405, 0, 'o3']]);
  const cPy = K([[0, 0], [0.66, 0], [0.675, 230, 'n2']]);
  const cF = K([[0, 1], [0.65, 1], [0.665, 0.4]]);
  const mF = K([[0, 1], [0.65, 1], [0.665, 0.6]]);
  const dim12 = K([[0, 1], [0.495, 1], [0.52, 0], [0.625, 0], [0.645, 0.5]]);
  s.c1t = tr(c1x, 40 + cPy, 1, cF); s.c2t = tr(c2x, 40 + cPy, 1, cF); s.c3t = tr(0, 40 + c3y + cPy, 1, cF);
  s.c1o = K([[0, 0], [0.112, 0], [0.13, 1], [0.495, 1], [0.53, 0], [0.625, 0], [0.645, 1], [0.672, 1], [0.678, 0]]);
  s.c2o = K([[0, 0], [0.215, 0], [0.232, 1], [0.495, 1], [0.53, 0], [0.625, 0], [0.645, 1], [0.672, 1], [0.678, 0]]);
  s.c3o = K([[0, 0], [0.37, 0], [0.385, 1], [0.672, 1], [0.678, 0]]);
  s.c1l = n(R(0.12, 0.145) * dim12); s.c2l = n(R(0.222, 0.25) * dim12); s.c3l = n(R(0.385, 0.41) * K([[0, 1], [0.62, 1], [0.645, 0.5]]));
  s.m1t = tr(c1x, 32 + cPy, mF); s.m2t = tr(c2x, 32 + cPy, mF); s.m3t = tr(0, 32 + m3y + cPy, mF);
  s.m1o = K([[0, 0], [0.098, 0], [0.112, 1], [0.495, 1], [0.53, 0], [0.625, 0], [0.645, 1], [0.672, 1], [0.678, 0]]);
  s.m2o = s.c2o; s.m3o = s.c3o;
  const tbw = K([[0, 300], [0.215, 300], [0.26, 560, 'i3'], [0.36, 560], [0.405, 800, 'i3']]);
  const tbF = K([[0, 1], [0.65, 1], [0.665, 0.3]]);
  const tbS = K([[0, 1], [0.655, 1], [0.672, 0.26]]);
  const tbY = K([[0, 0], [0.665, 0], [0.677, 190, 'n2']]);
  s.tbt = 'translate(0 ' + n(tbY + 85) + ') scale(' + n(tbS) + ' ' + n(tbF) + ') translate(0 -85)';
  s.tbx = n(-tbw / 2); s.tbw = n(tbw); s.tbgx = n(-tbw / 2 + 10); s.tbgw = n(tbw - 20);
  s.tbo = K([[0, 0], [0.11, 0], [0.13, 1], [0.495, 1], [0.53, 0.45], [0.625, 0.45], [0.645, 1], [0.672, 1], [0.678, 0]]);
  s.tbl = n(R(0.12, 0.145) * K([[0, 1], [0.495, 1], [0.52, 0.3], [0.625, 0.3], [0.645, 0.5]]));
  s.tbl2 = n(s.tbl * 0.5);

  /* cameras */
  const kLg = K([[0, 1], [0.645, 1], [0.66, 0.12]]);
  const kPy = K([[0, 150], [0.66, 150], [0.675, 290, 'n2']]);
  const kPs = K([[0, 1], [0.66, 1], [0.675, 0.38]]);
  const kOut = K([[0, 1], [0.495, 1], [0.53, 0.82], [0.625, 0.82], [0.645, 1]]);
  const k1x = K([[0, 0], [0.205, 0], [0.25, -200, 'i3'], [0.35, -200], [0.4, -330, 'i3'], [0.495, -330], [0.53, -470, 'i3'], [0.625, -470], [0.645, -330, 'i3'], [0.66, -330], [0.675, 0]]);
  const k1y = p < 0.2 ? K([[0, 105], [0.05, 105], [0.105, 150, 'o3']]) : kPy;
  const k1s = p < 0.2 ? K([[0, 0.2], [0.05, 0.2], [0.105, 1, 'o3']]) : kOut * kPs;
  s.k1t = tr(k1x, k1y, k1s);
  s.k1o = K([[0, 0], [0.05, 0], [0.075, 1], [0.495, 1], [0.53, 0.05], [0.625, 0.05], [0.645, 1], [0.671, 1], [0.677, 0]]);
  s.k1l = n(R(0.12, 0.15) * K([[0, 1], [0.495, 1], [0.52, 0], [0.625, 0], [0.645, 0.55]]));
  s.k1g = n(K([[0, 0], [0.05, 0], [0.08, 1], [0.125, 1], [0.15, 0.25], [0.495, 0.25], [0.52, 0]]));
  s.k1lg = n(kLg);
  const k2x = K([[0, 900], [0.21, 900], [0.26, 200, 'o3'], [0.35, 200], [0.4, 330, 'i3'], [0.495, 330], [0.53, 470, 'i3'], [0.625, 470], [0.645, 330, 'i3'], [0.66, 330], [0.675, 0]]);
  s.k2t = tr(k2x, kPy, kOut * kPs);
  s.k2o = K([[0, 0], [0.21, 0], [0.232, 1], [0.495, 1], [0.53, 0.05], [0.625, 0.05], [0.645, 1], [0.671, 1], [0.677, 0]]);
  s.k2l = n(R(0.215, 0.25) * K([[0, 1], [0.495, 1], [0.52, 0], [0.625, 0], [0.645, 0.55]]));
  s.k2lg = s.k1lg;
  const k3y = p < 0.5 ? K([[0, 95], [0.36, 95], [0.4, 150, 'o3']]) : kPy;
  const k3s = p < 0.5 ? K([[0, 0.3], [0.36, 0.3], [0.4, 1, 'o3']]) : kPs;
  s.k3t = tr(0, k3y, k3s);
  s.k3o = K([[0, 0], [0.36, 0], [0.38, 1], [0.545, 1], [0.57, 0], [0.62, 0], [0.635, 1], [0.671, 1], [0.677, 0]]);
  s.k3l = n(R(0.37, 0.4) * K([[0, 1], [0.52, 1], [0.54, 0.6], [0.62, 0.6], [0.645, 0.55]]));
  s.k3g = n(K([[0, 0], [0.36, 0], [0.38, 0.8], [0.42, 0.2], [0.52, 0]]));
  s.k3lg = s.k1lg;
  const k3r = K([[0, 0], [0.51, 0], [0.535, -90, 'i3'], [0.62, -90], [0.635, 0, 'i3']]);
  s.k3r = n(k3r);
  s.k3lc = 'rotate(' + n(-k3r) + ') scale(' + n(1 + 0.75 * Math.abs(k3r) / 90) + ')';

  /* 9:16 frame + reels cards (art units) */
  const fk = K([[0, 0], [0.53, 0], [0.575, 1, 'i3'], [0.62, 1], [0.64, 0, 'i3']]);
  const hx = L(-1500, 300, fk), hy = L(-1500, 118, fk), hw = L(4000, 315, fk), hh = L(4000, 560, fk);
  s.frd = 'M-3000 -3000H4000V4000H-3000Z M' + n(hx) + ' ' + n(hy) + 'H' + n(hx + hw) + 'V' + n(hy + hh) + 'H' + n(hx) + 'Z';
  s.fro = fk > 0.0005 ? 0.97 : 0;
  s.frn = K([[0, 0], [0.565, 0], [0.578, 1], [0.62, 1], [0.632, 0]]);
  let rcN = 0;
  const dis = R(0.62, 0.632);
  for (let i = 0; i < 5; i++) {
    const a = 0.577 + i * 0.0068; const e = R(a, a + 0.009, 'o3');
    if (e >= 0.5) rcN++;
    const x = L(L(600, 681, e), 457, dis), y = L(L(398, 163 + i * 117.5, e), 398, dis), sc = L(0.5, 1, e) * (1 - 0.5 * dis);
    s['r' + (i + 1) + 't'] = tr(x, y, sc);
    s['r' + (i + 1) + 'o'] = n(e * (1 - dis));
  }
  const rcp = toS(681, 90);
  const reels = { x: rcp[0], y: rcp[1], n: Math.max(1, rcN), o: n(K([[0, 0], [0.577, 0], [0.582, 1], [0.62, 1], [0.63, 0]])) };

  /* cases */
  const cy0 = K([[0, 40], [0.635, 40], [0.652, 0, 'o3']]);
  s.lid = n(K([[0, 1], [0.672, 1], [0.68, 0.12]]));
  s.cBt = tr(K([[0, -330], [0.68, -330], [0.7, 430, 'i3'], [0.706, 430], [0.711, 1080]]), 340 + cy0);
  s.cAt = tr(K([[0, 0], [0.68, 0], [0.7, 650, 'i3'], [0.703, 650], [0.708, 1080]]), 340 + cy0);
  s.cCt = tr(K([[0, 330], [0.68, 330], [0.7, 870, 'i3'], [0.705, 1080]]), 340 + cy0);
  s.cBo = K([[0, 0], [0.637, 0], [0.65, 1], [0.708, 1], [0.712, 0]]);
  s.cAo = K([[0, 0], [0.637, 0], [0.65, 1], [0.705, 1], [0.709, 0]]);
  s.cCo = K([[0, 0], [0.637, 0], [0.65, 1], [0.702, 1], [0.706, 0]]);

  /* van + street */
  const D = K([[0, 0], [0.72, 0], [0.765, 3600, 'i2']]);
  s.rdo = K([[0, 0], [0.698, 0], [0.722, 1], [0.782, 1], [0.795, 0]]);
  s.cfx = n(400 - (D * 0.12) % 1200); s.cmx = n(400 - (D * 0.4) % 1200); s.cnx = n(400 - D % 1200); s.rdx = n(400 - (D * 1.15) % 120);
  s.bx = n(1520 + (3600 - D)); s.blo = 1;
  s.win = n(FL(0.766, 0.774)); s.rec = K([[0, 0], [0.815, 0], [0.818, 1]]);
  const bob = Math.sin(D / 37) * 1.6 * R(0.72, 0.73) * (1 - R(0.76, 0.765));
  s.vant = tr(1150, 340 + bob);
  s.vano = K([[0, 0], [0.68, 0], [0.698, 1], [0.782, 1], [0.795, 0]]);

  /* v3: S5b — pəncərədən içəri, müştərinin otağına (klinika) */
  s.cil = s.win;
  s.gls = n(s.win * K([[0, 1], [0.782, 1], [0.79, 0]]));
  s.fac = n(K([[0, 1], [0.784, 1], [0.796, 0]]));
  const ik = K([[0, 0], [0.782, 0], [0.797, 1, 'n2']]);
  s.ix = n(L(-160, -3000, ik)); s.iy = n(L(-230, -3000, ik)); s.iw = n(L(240, 6000, ik)); s.ih = n(L(200, 6000, ik));
  // həkimin tərpənişi scroll-a bağlıdır: dayanmada o da dayanır
  const env = R(0.795, 0.803) * (1 - R(0.815, 0.82));
  s.dhr = n(2.4 * Math.sin((p - 0.8) * 900) * env);
  s.dct = 'translate(' + n(1.6 * Math.sin((p - 0.8) * 650) * env) + ' 46)';
  s.vanl = K([[0, 0], [0.712, 0], [0.72, 1]]);
  s.beam = n(FL(0.714, 0.724));
  s.door = n(K([[0, 1], [0.711, 1], [0.717, 0.06]]));
  s.whl = n(D / (2 * Math.PI * 38) * 360);

  /* editor */
  const lcdAX = 500 + (1435 - vx) * vz, lcdAY = 400 + (218.1 - vy) * vz, s0 = 40.8 * vz / 700;
  const eg = R(0.832, 0.852, 'i3');
  let esc = L(s0, 1, eg), etx = L(lcdAX - 350 * s0, 150, eg), ety = L(lcdAY - 280 * s0, 120, eg);
  if (p >= 0.852) { const fs = 1 - 0.06 * R(0.962, 0.975); esc = fs; etx = 150 + 350 * (1 - fs); ety = 120 + 280 * (1 - fs); }
  s.edt = tr(etx, ety, esc);
  s.edo = K([[0, 0], [0.832, 0], [0.838, 1], [0.962, 1], [0.975, 0.12]]);
  s.edu = K([[0, 0], [0.84, 0], [0.852, 1]]);
  const W = [110, 34, 96, 40, 120, 30, 104, 30, 50], CAM = [1, 0, 2, 0, 3, 0, 1, 0, 2];
  const u = K([[0, 0], [0.855, 0], [0.895, 614, 'l']]);
  let acc = 0, x = 74, ph = 74, act = 1;
  const xs = [];
  for (let j = 0; j < 9; j++) {
    const st = acc, w = W[j];
    const k = j % 2 ? 1 - cl((u - st) / w, 0, 1) : 1;
    xs.push(x);
    if (u >= st && u <= st + w) { ph = x + (u - st) * k; if (CAM[j]) act = CAM[j]; }
    if (u > st + w && CAM[j]) act = CAM[j];
    s['q' + j + 'x'] = n(x); s['q' + j + 'k'] = n(Math.max(k, 0.0001));
    x += w * k; acc += w;
  }
  if (u >= 614) ph = x;
  const sw = R(0.9, 0.932), swx = 74 + sw * 480;
  for (let j = 0; j < 9; j += 2) {
    const c = p < 0.9 ? 0 : cl((swx - xs[j]) / W[j], 0, 1);
    s['q' + j + 'c'] = n(c); s['q' + j + 'n'] = n(1 - c);
  }
  s.swx = n(swx); s.swo = K([[0, 0], [0.898, 0], [0.9, 1], [0.932, 1], [0.936, 0]]);
  s.phx = n(ph); s.pho = K([[0, 0], [0.852, 0], [0.856, 1], [0.897, 1], [0.902, 0]]);
  s.ev1 = act === 1 ? 1 : 0; s.ev2 = act === 2 ? 1 : 0; s.ev3 = act === 3 ? 1 : 0;
  const ex = R(0.937, 0.96);
  s.exw = n(272 * ex); s.exo = K([[0, 0], [0.933, 0], [0.938, 1], [0.962, 1], [0.97, 0]]);
  const hz = R(0.96, 0.964, 'o3');
  const exP = toS(etx + 350 * esc, ety + 236 * esc), esP = toS(etx + 350 * esc, ety + 337 * esc);
  const edit = {
    x: esP[0], y: esP[1], o: n(s.edu * K([[0, 1], [0.962, 1], [0.97, 0]])),
    steps: EDIT_STEPS.map(([a, b]) => (p >= b ? 'done' : p >= a ? 'on' : '')),
    exX: exP[0], exY: exP[1], exPct: Math.round(ex * 100), exO: n(s.exo * (1 - hz)),
    readyO: n(hz * K([[0, 1], [0.962, 1], [0.97, 0]])), readyS: n(0.8 + 0.2 * hz),
  };

  /* texts */
  const vis = (a, b, c, d) => { const i = R(a, b, 'o3'), o = R(c, d); return { o: n(i * (1 - o)), y: n((1 - i) * 36 - o * 36), b: n((1 - i) * 8 + o * 8) }; };
  const intro = vis(0.022, 0.034, 0.046, 0.06);
  const tx = TX.map(w => vis(...w));

  // Chip mətnlə birlikdə gedir (dizaynda növbəti chip gələnə qədər qalırdı): eyni pəncərə, eyni hərəkət.
  // Gəliş dizayndakı kimidir: fon pəncərənin 60%-ində tam görünür, rəqəmlər aşağıdan fırlanıb çıxır.
  const chips = TX.map(([a, b, c, d], i) => {
    const ci = R(a, a + (b - a) * 0.6), co = R(c, d), ri = a + (b - a) * 0.5;
    const nd = chipInfo?.digits[i] ?? 0;
    const dg = [];
    for (let j = 0; j < nd; j++) {
      const ei = R(a + j * 0.0012, ri + j * 0.0012, 'o3');
      dg.push({ y: n(1 - ei), o: n(ei) }); // y: rəqəm hündürlüyünün payı
    }
    return { o: n(ci * (1 - co)), y: n(-36 * co), dg };
  });

  /* v2: S5 note, window shade during zoom, text/indicator shades (desktop) */
  const note = { o: chips[4].o, y: n((1 - R(0.652, 0.672, 'o3')) * 10 + chips[4].y) };
  s.wdk = n(K([[0, 0], [0.82, 0], [0.84, 0.85]]));
  const shadeCopy = n(K([[0, 0], [0.1, 0], [0.125, 1], [0.962, 1], [0.972, 0]]));
  const shadeSteps = n(K([[0, 0], [0.04, 0], [0.062, 1], [0.832, 1], [0.852, 0.45]]));

  /* final */
  const fo = R(0.968, 0.985, 'o3');
  const fin = { o: n(fo), y: n((1 - fo) * 40), b: n((1 - fo) * 8) };
  s.vig = n(K([[0, 0.6], [0.1, 0.6], [0.145, 1], [0.832, 1], [0.85, 0.35]]));

  /* step indicator */
  let ai = -1;
  STEP_RANGES.forEach(([a, b], i) => { if (p >= a && p < b) ai = i; });
  const local = ai >= 0 ? cl((p - STEP_RANGES[ai][0]) / (STEP_RANGES[ai][1] - STEP_RANGES[ai][0]), 0, 1) : 0;
  const ind = { o: n(K([[0, 0], [0.04, 0], [0.062, 1]])), active: ai, local, fill: ai >= 0 ? Math.min(320, n(ai * 64 + local * 64)) : 0 };

  /* hero → bölmə keçidi (BRIEF bölmə 10): hero mətni 0–1.2%, halqa 0.8–1.8%, qaranlıq 1.2–2.6% */
  const hero = { text: n(1 - R(0, 0.012)), y: n(-30 * R(0, 0.012)), ring: n(1 - FL(0.008, 0.018)), dark: n(R(0.012, 0.026)) };

  return { s, intro, tx, chips, note, reels, edit, fin, ind, shadeCopy, shadeSteps, hero };
}
