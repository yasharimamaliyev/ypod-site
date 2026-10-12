// Hero: 3D mikrofon + scroll animasiyası (BRIEF.md bölmə 6).
// main.js bu faylı yalnız güclü cihazda, ilk ekran göstəriləndən sonra dinamik yükləyir.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildMic, buildFloorGlow, buildEnvScene, disposeTree } from './mic-model.js';
import { CONFIG } from './config.js';

gsap.registerPlugin(ScrollTrigger);

const MODEL_H = 3.4;                 // modelin hündürlüyü (dünya vahidi, SVG 680px)
const lerp = (a, b, t) => a + (b - a) * t;
// 0% → 50% → 100% cədvəlindəki üç nöqtə arasında
const tri = (p, a, b, c) => (p < 0.5 ? lerp(a, b, p / 0.5) : lerp(b, c, (p - 0.5) / 0.5));
const DEG = Math.PI / 180;

async function loadModel() {
  if (!CONFIG.micModelUrl) return buildMic();
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]);
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const root = document.querySelector('meta[name="ypod-root"]')?.content || './';
  const gltf = await loader.loadAsync(root + CONFIG.micModelUrl);
  draco.dispose();
  // GLB-ni prosedur modelin ölçüsünə və mərkəzinə gətir
  const obj = gltf.scene;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  obj.scale.setScalar(MODEL_H / size.y);
  box.setFromObject(obj);
  obj.position.sub(box.getCenter(new THREE.Vector3()));
  const wrap = new THREE.Group();
  wrap.add(obj);
  return wrap;
}

export async function initHero3D() {
  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const canvas = hero.querySelector('.hero-canvas');
  const glow = hero.querySelector('.hero-glow');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = buildEnvScene();
  scene.environment = pmrem.fromScene(env, 0.03).texture;
  disposeTree(env);
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-3, 3, 6);
  const rimL = new THREE.DirectionalLight(0xa855f7, 4);
  rimL.position.set(-5, 2, -4);
  const rimR = new THREE.DirectionalLight(0xd946ef, 3);
  rimR.position.set(5, 1, -3);
  scene.add(key, rimL, rimR);

  try { await document.fonts.load('900 40px Unbounded'); } catch { /* yazı ehtiyat şriftlə çəkilir */ }

  // rig: yer və ölçü · roll: əyilmə (z) · spin: fırlanma (y)
  const rig = new THREE.Group();
  const roll = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(await loadModel());
  roll.add(spin);
  rig.add(roll, buildFloorGlow());
  scene.add(rig);

  let visH = 1, visW = 1, mobile = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    mobile = w < 1024;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 0%-də mikrofon desktopda pin hündürlüyünün ~82%-ni, mobildə ~68%-ni tutur (Hero-D0 / Hero-M0)
    visH = MODEL_H / (mobile ? 0.68 : 0.82);
    visW = visH * camera.aspect;
    // Dar ekranda en də sığsın
    const minW = 2.2;
    if (visW < minW) { visW = minW; visH = visW / camera.aspect; }
    camera.position.set(0, 0, visH / 2 / Math.tan((camera.fov / 2) * DEG));
    camera.updateProjectionMatrix();
  }

  const state = { p: 0 };
  const projected = new THREE.Vector3();

  function render(t) {
    const p = state.p;
    rig.scale.setScalar(tri(p, 1, mobile ? 0.78 : 0.8, mobile ? 0.55 : 0.62));
    rig.position.set(
      mobile ? 0 : tri(p, 0, 0.14, 0.24) * visW,
      (mobile ? tri(p, 0, 0.14, 0.26) * visH : 0) + Math.sin(t * 1.1) * 0.03,
      0,
    );
    spin.rotation.y = p * Math.PI * 4;                       // 0° → 360° → 720°
    roll.rotation.z = -tri(p, 0, -7, mobile ? 8 : 9) * DEG;  // CSS rotate(9deg) = Three z −9°
    renderer.render(scene, camera);

    projected.copy(rig.position).project(camera);
    glow.style.setProperty('--gx', ((projected.x + 1) / 2 * 100).toFixed(2) + '%');
    glow.style.setProperty('--gy', ((1 - projected.y) / 2 * 100).toFixed(2) + '%');
  }

  // --- Hazırdır: 3D rejiminə keç ---
  root.classList.add('is-3d');
  resize();
  render(0);

  const pill = hero.querySelector('.hero-pill');
  const h1 = hero.querySelector('.hero-h1');
  const mark = hero.querySelector('.hero-h1 .mk');
  const sub = hero.querySelector('.hero-sub');
  const ctas = hero.querySelector('.hero-ctas');
  const wm = hero.querySelector('.hero-wm');

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
  });
  tl.to(state, { p: 1, ease: 'none', duration: 1 }, 0)
    .fromTo(wm, { '--wma': 0.05, '--wms': 1 }, { '--wma': 0.035, '--wms': 1.08, ease: 'none', duration: 1 }, 0)
    .fromTo(pill, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.15 }, 0.15)
    .fromTo(h1, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.25)
    .fromTo(mark, { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', ease: 'power2.inOut', duration: 0.12 }, 0.42)
    .fromTo(sub, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.4)
    .fromTo(ctas, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.5);

  root.classList.add('is-3d-ready');
  ScrollTrigger.refresh();

  // Render loop yalnız hero görünəndə işləyir
  // Üzmə sıfır fazadan başlayır ki, statik şəkildən keçid sıçramasın
  let raf = 0;
  const t0 = performance.now();
  const loop = now => { raf = requestAnimationFrame(loop); render((now - t0) / 1000); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(loop);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(hero);

  new ResizeObserver(() => resize()).observe(canvas);

  return { gsap, ScrollTrigger };
}
