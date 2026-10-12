// Rode PodMic tərzində mikrofon, Three.js primitivləri ilə.
// Forma referansı: design-handoff/design/Hero-D0.dc.html-dəki SVG (viewBox 400×680).
import * as THREE from 'three';

const U = 1 / 200;                 // SVG px → dünya vahidi
const X = x => (x - 200) * U;
const Y = y => (375 - y) * U;      // modelin mərkəzi SVG-də y≈375

const GRILLE_R = 80 * U;           // tor: x120–280
const BODY_R = 76 * U;             // gövdə: x124–276
const RING_R = 86 * U;             // neon halqa: x114–286
const CORNER = 14 * U;             // gövdənin künc radiusu (rx 14)

function canvasTex(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// Romb şəbəkəli metal tor (SVG-dəki 45° pattern)
function meshTexture(repeat) {
  return canvasTex(256, 256, (x, w) => {
    x.fillStyle = '#4a4455';
    x.fillRect(0, 0, w, w);
    x.strokeStyle = '#07050b';
    x.lineWidth = 7;
    const step = w / 8;
    for (let i = -8; i <= 16; i++) {
      x.beginPath(); x.moveTo(i * step, 0); x.lineTo(i * step + w, w); x.stroke();
      x.beginPath(); x.moveTo(i * step, w); x.lineTo(i * step + w, 0); x.stroke();
    }
  }, { repeat });
}

// Gövdə: rəng + "Y POD" yazısı. Yazı metal deyil (metalnessMap), bir az işıq saçır (emissiveMap).
function bodyTextures(height) {
  const W = matchMedia('(max-width: 767px)').matches ? 1024 : 2048; // telefonda yarı ölçü
  const H = Math.round(W * height / (2 * Math.PI * BODY_R));
  const pxPerUnit = W / (2 * Math.PI * BODY_R);
  const textY = ((446 - 294) / 272) * H;          // SVG-də yazı y=446
  const fontPx = Math.round(17 * U * pxPerUnit);
  const spacing = 2 * U * pxPerUnit;

  const drawText = (x, color) => {
    x.font = `900 ${fontPx}px Unbounded, "Arial Black", sans-serif`;
    x.textBaseline = 'middle';
    x.fillStyle = color;
    const chars = [...'Y POD'];
    const widths = chars.map(ch => x.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = W / 2 - total / 2;
    chars.forEach((ch, i) => { x.fillText(ch, cx, textY); cx += widths[i] + spacing; });
  };

  const map = canvasTex(W, H, (x) => {
    x.fillStyle = '#2a2533';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {                // nazik fırçalanmış metal xətləri
      x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      x.fillRect(Math.random() * W, 0, 1 + Math.random() * 2, H);
    }
    drawText(x, 'rgba(253,246,255,.85)');
  });
  const metalness = canvasTex(W, H, (x) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    drawText(x, '#000000');
  }, { srgb: false });
  const emissive = canvasTex(W, H, (x) => {
    x.fillStyle = '#000000'; x.fillRect(0, 0, W, H);
    drawText(x, '#ffffff');
  });
  return { map, metalness, emissive };
}

export function buildMic() {
  const g = new THREE.Group();
  const add = (geo, mat, fn) => { const m = new THREE.Mesh(geo, mat); fn?.(m); g.add(m); return m; };

  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2635, metalness: 0.9, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x110e16, metalness: 0.6, roughness: 0.5 });
  const yokeMat = new THREE.MeshStandardMaterial({ color: 0x1d1925, metalness: 0.85, roughness: 0.38 });
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x3a3444, metalness: 0.85, roughness: 0.4 });

  // --- Tor: silindr + günbəz ---
  const grilleTop = Y(150), grilleBottom = Y(262);
  const sideTex = meshTexture([10, 2.2]);
  const domeTex = meshTexture([10, 2.5]);
  const grilleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sideTex, bumpMap: sideTex, bumpScale: 1.2, metalness: 0.9, roughness: 0.38 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: domeTex, bumpMap: domeTex, bumpScale: 1.2, metalness: 0.9, roughness: 0.38 });
  add(new THREE.CylinderGeometry(GRILLE_R, GRILLE_R, grilleTop - grilleBottom, 96, 1, true), grilleMat,
    m => { m.position.y = (grilleTop + grilleBottom) / 2; });
  add(new THREE.SphereGeometry(GRILLE_R, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2), domeMat,
    m => { m.position.y = grilleTop; });

  // --- Neon halqa + parıltı (bloom əvəzinə additive halo: mobildə ucuzdur) ---
  const ringY = Y(268);
  add(new THREE.CylinderGeometry(RING_R, RING_R, 20 * U, 96), new THREE.MeshStandardMaterial({
    color: 0x3b0764, emissive: 0xa855f7, emissiveIntensity: 2.5, metalness: 0.2, roughness: 0.3,
  }), m => { m.position.y = ringY; });
  const halo = (radius, tube, color, opacity) => add(
    new THREE.TorusGeometry(radius, tube, 24, 128),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    m => { m.rotation.x = Math.PI / 2; m.position.y = ringY; m.renderOrder = 2; },
  );
  halo(RING_R + 0.004, 0.03, 0xd946ef, 0.45);
  halo(RING_R + 0.012, 0.07, 0xc026d3, 0.12);

  // --- Gövdə ---
  const bodyTop = Y(280) - CORNER, bodyBottom = Y(580) + CORNER;
  const bodyH = bodyTop - bodyBottom;
  const tex = bodyTextures(bodyH);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: tex.map, metalnessMap: tex.metalness, metalness: 0.9, roughness: 0.35,
    emissive: 0xfdf6ff, emissiveMap: tex.emissive, emissiveIntensity: 0.35,
  });
  // thetaStart = π: yazı (u=0.5) kameraya (+z) baxır
  add(new THREE.CylinderGeometry(BODY_R, BODY_R, bodyH, 96, 1, true, Math.PI), bodyMat,
    m => { m.position.y = (bodyTop + bodyBottom) / 2; });
  for (const y of [bodyTop, bodyBottom]) {
    add(new THREE.TorusGeometry(BODY_R - CORNER, CORNER, 16, 96), metal, m => { m.rotation.x = Math.PI / 2; m.position.y = y; });
  }
  add(new THREE.CircleGeometry(BODY_R - CORNER, 64), metal, m => { m.rotation.x = -Math.PI / 2; m.position.y = Y(280); });

  // Alt qapaq
  add(new THREE.CylinderGeometry(66 * U, 66 * U, 26 * U, 64), dark, m => { m.position.y = Y(585); });

  // --- U-bərkidici ---
  const v = (x, y) => new THREE.Vector3(X(x), Y(y), 0);
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(v(84, 420), v(84, 560)));
  path.add(new THREE.QuadraticBezierCurve3(v(84, 560), v(84, 630), v(154, 630)));
  path.add(new THREE.LineCurve3(v(154, 630), v(246, 630)));
  path.add(new THREE.QuadraticBezierCurve3(v(246, 630), v(316, 630), v(316, 560)));
  path.add(new THREE.LineCurve3(v(316, 560), v(316, 420)));
  add(new THREE.TubeGeometry(path, 240, 11 * U, 16, false), yokeMat);

  // Düymələr (knob) və gövdəyə bağlantı
  const knobY = Y(420);
  for (const s of [-1, 1]) {
    const kx = s * X(316);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 20), dark, m => { m.rotation.z = Math.PI / 2; m.position.set(s * (BODY_R + 0.07), knobY, 0); });
    add(new THREE.CylinderGeometry(27 * U, 27 * U, 0.1, 48), knobMat, m => { m.rotation.z = Math.PI / 2; m.position.set(kx, knobY, 0); });
    add(new THREE.TorusGeometry(18 * U, 0.006, 8, 48), new THREE.MeshStandardMaterial({ color: 0x8a8296, metalness: 0.6, roughness: 0.5 }),
      m => { m.rotation.y = Math.PI / 2; m.position.set(kx + s * 0.051, knobY, 0); });
    add(new THREE.CircleGeometry(8 * U, 24), dark, m => { m.rotation.y = s * Math.PI / 2; m.position.set(kx + s * 0.052, knobY, 0); });
  }

  // Dayaq
  add(new THREE.CylinderGeometry(12 * U, 12 * U, 0.42, 24), metal, m => { m.position.y = Y(630) - 0.21; });

  return g;
}

// Mikrofonun altındakı bənövşəyi parıltı
export function buildFloorGlow() {
  const tex = canvasTex(256, 256, (x, w) => {
    const grd = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(168,85,247,0.9)');
    grd.addColorStop(0.5, 'rgba(168,85,247,0.25)');
    grd.addColorStop(1, 'rgba(168,85,247,0)');
    x.fillStyle = grd; x.fillRect(0, 0, w, w);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.32),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  m.position.y = Y(680) - 0.18;
  return m;
}

// Əks olunmalar üçün qaranlıq studiya mühiti (HDR əvəzi)
export function buildEnvScene() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x030105);
  const panel = (w, h, color, intensity, pos) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(1.6, 10, 0xfdf6ff, 2.2, [-3.2, 0, 5.5]);   // soldan şaquli ağ zolaq (SVG-dəki parlaq xətt)
  panel(5, 3, 0xffffff, 0.6, [0, 7, 4]);           // yuxarıda zəif softbox
  panel(2, 9, 0xa855f7, 5, [-7, 0, -2]);           // sol bənövşəyi neon
  panel(2, 9, 0xd946ef, 4, [7, 1, -2]);            // sağ magenta neon
  panel(9, 1.4, 0x7c3aed, 3, [0, -5, -4]);         // aşağıda arxa zolaq
  return env;
}

export function disposeTree(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of ['map', 'bumpMap', 'metalnessMap', 'emissiveMap']) m[k]?.dispose();
      m.dispose();
    }
  });
}
