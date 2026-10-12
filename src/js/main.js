import { CONFIG } from './config.js';
import { initPricing } from './pricing.js';
import { initNav } from './nav.js';
import { initInstagram } from './instagram.js';

const root = document.documentElement;
window.__ypod = true;
const t = JSON.parse(document.getElementById('ypod-i18n').textContent);
const reducedMotion = root.classList.contains('rm');

/* ---------- WhatsApp linkləri ---------- */
const waHref = text => `https://wa.me/${CONFIG.waNumber}?text=${encodeURIComponent(text)}`;

function setWa(a, { n = 1, place = 'studio' } = {}) {
  const tpl = t.wa[a.dataset.wa] || t.wa.general;
  a.href = waHref(tpl.replace('{N}', n).replace('{P}', t.wa_place[place]));
  a.target = '_blank';
  a.rel = 'noopener';
}
document.querySelectorAll('[data-wa]').forEach(a => setWa(a));

/* ---------- Qiymətlər (kamera və yer seçimi WhatsApp mətninə də düşür) ---------- */
initPricing({
  camLabels: [t.cams.c0, t.cams.c1, t.cams.c2],
  onChange: (section, choice) => section.querySelectorAll('[data-wa]').forEach(a => setWa(a, choice)),
});

/* ---------- Nav, Instagram ---------- */
initNav();
initInstagram(t);

/* ---------- Xəritə və ünvan linkləri ---------- */
const { lat, lng } = CONFIG.coords;
document.querySelectorAll('[data-maps]').forEach(a => {
  a.href = CONFIG.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
});
document.querySelectorAll('[data-waze]').forEach(a => { a.href = CONFIG.wazeUrl; });

// Google xəritəsi yalnız ekrana yaxınlaşanda yüklənir (API açarı lazım deyil)
const map = document.querySelector('.map');
if (map) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const f = document.createElement('iframe');
    f.title = map.dataset.mapTitle;
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = `https://www.google.com/maps?q=${lat},${lng}&z=16&hl=${t.lang}&output=embed`;
    map.append(f);
  }, { rootMargin: '300px 0px' });
  io.observe(map);
}

/* ---------- Bölmələrin görünməsi ---------- */
const revealIO = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    el.classList.add('in');
    revealIO.unobserve(el);
    // Animasiya bitəndən sonra kartın hover transition-u öz yerinə qayıdır
    if (el.classList.contains('card')) setTimeout(() => el.classList.add('rv-done'), 1200);
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
document.querySelectorAll('.rv').forEach(el => revealIO.observe(el));

/* ---------- GSAP: brend zolağı + 3D hero (ilk ekrandan sonra yüklənir) ---------- */
function marquee(gsap, ScrollTrigger) {
  const track = document.querySelector('.mq-t');
  if (!track) return;
  track.classList.add('is-gsap');
  const tween = gsap.to(track, {
    xPercent: -50, ease: 'none', repeat: -1,
    duration: () => (innerWidth >= 1024 ? 36 : 18),
  });
  let settle;
  ScrollTrigger.create({
    onUpdate(self) {
      const scale = Math.min(6, 1 + Math.abs(self.getVelocity()) / 300);
      gsap.to(tween, { timeScale: scale, duration: 0.15, overwrite: true });
      clearTimeout(settle);
      settle = setTimeout(() => gsap.to(tween, { timeScale: 1, duration: 0.6, overwrite: true }), 120);
    },
  });

  // Əl ilə sürüşdürmə: siçanla dartmaq, barmaqla sağa-sola. Şaquli barmaq hərəkəti səhifənin scroll-udur (touch-action: pan-y).
  // Buraxanda zolaq sürətlə bir az da gedir, sonra öz axınına qayıdır.
  const box = track.parentElement;
  const wrap = gsap.utils.wrap(0, 1);
  const loopW = () => track.scrollWidth / 2; // zolaq iki dəfə təkrarlanır: xPercent -50 = bir dövr
  const fling = { d: 0 };
  let drag = null;
  const seek = dx => tween.progress(wrap(drag.p0 - dx / loopW()));
  box.addEventListener('pointerdown', e => {
    if (e.button) return;
    if (gsap.isTweening(fling)) { gsap.killTweensOf(fling); tween.resume(); }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, p0: tween.progress(), on: false, vx: 0, lx: e.clientX, lt: e.timeStamp };
  });
  box.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }
      drag.on = true;
      box.setPointerCapture(e.pointerId);
      box.classList.add('is-drag');
      tween.pause();
    }
    const dt = e.timeStamp - drag.lt;
    if (dt > 0) drag.vx = 0.7 * ((e.clientX - drag.lx) / dt) + 0.3 * drag.vx;
    drag.lx = e.clientX; drag.lt = e.timeStamp;
    seek(dx);
  });
  const release = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    box.classList.remove('is-drag');
    const base = d.lx - d.x, v = e.timeStamp - d.lt > 80 ? 0 : d.vx; // px/ms
    fling.d = 0;
    gsap.to(fling, {
      d: v * 320, duration: 0.9, ease: 'power3.out',
      onUpdate: () => tween.progress(wrap(d.p0 - (base + fling.d) / loopW())),
      onComplete: () => tween.resume(),
    });
  };
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', release);
  box.addEventListener('dragstart', e => e.preventDefault());
}

/* ---------- Xidmətlər: statik versiya (reduced-motion, zəif telefon) kart şəkillərini yaxınlaşanda çəkir ---------- */
const svc = document.querySelector('.svc');
if (svc && root.classList.contains('svc-static')) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    import('./services.js').then(m => m.initServicesStatic(svc));
  }, { rootMargin: '600px 0px' });
  io.observe(svc);
}

async function initServicesFilm(libs) {
  if (!svc || !root.classList.contains('svc-anim')) return;
  try {
    const [{ initServices }, { ScrollToPlugin }] = await Promise.all([import('./services.js'), import('gsap/ScrollToPlugin')]);
    libs.gsap.registerPlugin(ScrollToPlugin);
    initServices(svc, { ...libs, hero: libs.hero || null });
  } catch (err) {
    console.warn('Xidmətlər animasiyası yüklənmədi, statik versiya göstərilir:', err);
    root.classList.replace('svc-anim', 'svc-static');
    import('./services.js').then(m => m.initServicesStatic(svc)).catch(() => {});
  }
}

async function enhance() {
  if (reducedMotion) return;
  let libs = null;

  const hero = document.getElementById('hero');
  // İstifadəçi artıq hero-dan aşağı düşübsə, hündürlük dəyişib səhifəni sürüşdürməsin
  const heroStillOnScreen = hero.getBoundingClientRect().bottom > 0;
  if (root.classList.contains('can-3d') && heroStillOnScreen) {
    try {
      const { initHero3D } = await import('./hero3d.js');
      libs = await initHero3D();
    } catch (err) {
      console.warn('3D yüklənmədi, statik hero qalır:', err);
      root.classList.remove('can-3d', 'is-3d');
    }
  }

  if (!libs) {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);
    libs = { gsap, ScrollTrigger };
  }
  marquee(libs.gsap, libs.ScrollTrigger);
  await initServicesFilm(libs);
}

// 3D ağır işdir: ilk toxunuş/scroll/siçan hərəkətinə qədər gözləyir. Statik şəkil ilk 3D kadrla eyni pozadadır.
const START_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
function startOnce() {
  START_EVENTS.forEach(ev => removeEventListener(ev, startOnce, { capture: true }));
  enhance();
}
START_EVENTS.forEach(ev => addEventListener(ev, startOnce, { capture: true, passive: true, once: true }));
