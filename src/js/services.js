// Xidmətlər: scroll filmi (svc-anim) və statik kartlar (svc-static).
// Səhnənin bütün dəyərləri services-stage.js-dən gəlir; burada yalnız DOM-a yazılır.
// Pin CSS sticky ilə edilir (hero kimi): bölmənin hündürlüyü ilk boyamadan bilinir, səhifə sıçramır.
import stageSvg from '../assets/services-stage.svg?raw';
import { computeStage, buildScale, BASE_SCREENS, STEP_KEYS, STATIC_KEYS } from './services-stage.js';

const DESKTOP = 1024;

/* ---------- SVG: data-t-* şablonları ---------- */
function createStage() {
  const tpl = document.createElement('template');
  tpl.innerHTML = stageSvg;
  const svg = tpl.content.querySelector('svg');
  const bindings = [];
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const a of [...el.attributes]) {
      if (!a.name.startsWith('data-t-')) continue;
      // "translate({{s.bdx}} 60)" → ['translate(', 's', 'bdx', ' 60)']
      bindings.push({ el, attr: a.name.slice(7), parts: a.value.split(/\{\{(s|ui)\.(\w+)\}\}/), last: null });
      el.removeAttribute(a.name);
    }
  }
  return { svg, bindings };
}

function applyBindings(bindings, scope) {
  for (const b of bindings) {
    let v = b.parts[0];
    for (let i = 1; i < b.parts.length; i += 3) v += scope[b.parts[i]][b.parts[i + 1]] + b.parts[i + 2];
    if (v === b.last) continue;
    b.last = v;
    b.el.setAttribute(b.attr, v);
  }
}

// "#art" qutusunun yeri (BRIEF bölmə 2.3). Mobildə hündürlük də nəzərə alınır ki, üfüqi telefonda səhnə şişməsin:
// 390×844 və 430×932-də hər iki hədd eynidir, yəni portret kadrlar dizayndakı kimidir.
function layout(W, H) {
  if (W >= DESKTOP) return { desk: true, W, H, as: Math.min(0.625 * W, H) / 1000, ax: 0.667 * W, ay: 0.522 * H };
  return { desk: false, W, H, as: Math.min(W / 722, H / 1563), ax: W / 2, ay: 64 + 0.28 * H };
}

function chipInfo(root) {
  return { digits: [...root.querySelectorAll('.svc-num')].map(n => n.textContent.trim().length) };
}

/* ---------- Statik versiya ---------- */
// 6 kartın hər biri səhnənin surətidir: id-lər təkrarlanmasın, yoxsa url(#intClip) birinci kartın kəsiyini götürür
function uniqueIds(svg, sfx) {
  for (const el of svg.querySelectorAll('[id]')) el.id += sfx;
  for (const el of svg.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      if (a.name === 'href' || a.name === 'xlink:href') a.value = a.value.replace(/^#([\w-]+)$/, `#$1${sfx}`);
      else if (a.value.includes('url(#')) a.value = a.value.replace(/url\(#([\w-]+)\)/g, `url(#$1${sfx})`);
    }
  }
}

export function initServicesStatic(root) {
  const info = chipInfo(root);
  root.querySelectorAll('.svc-scene').forEach((scene, i) => {
    const fig = scene.querySelector('.svc-fig');
    if (!fig || fig.firstChild) return;
    const { svg, bindings } = createStage();
    uniqueIds(svg, '-s' + i);
    svg.setAttribute('viewBox', '0 0 800 500');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const st = computeStage(STATIC_KEYS[i], { ax: 400, ay: 250, as: 0.62 }, info);
    applyBindings(bindings, { s: st.s, ui: { W: 800, H: 500 } });
    fig.append(svg);
    svg.pauseAnimations?.(); // canlı detallar statik versiyada olmur
  });
}

/* ---------- Scroll filmi ---------- */
export function initServices(root, { gsap, ScrollTrigger, hero }) {
  const pin = root.querySelector('.svc-pin');
  const html = document.documentElement;
  const { svg, bindings: all } = createStage();
  root.querySelector('.svc-art').append(svg);
  // Vinyet SVG-də deyil, ayrıca CSS qatındadır (.svc-vig): Safari-də hər kadr SVG ilə birlikdə yenidən çəkilmir
  const vigRect = svg.querySelector('[fill="url(#gVig)"]');
  vigRect.remove();
  const bindings = all.filter(b => b.el !== vigRect);

  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const info = chipInfo(root);

  // Odometr: hər rəqəm ayrıca sütunda
  $$('.svc-num').forEach(num => {
    num.innerHTML = [...num.textContent.trim()].map(d => `<span>${d}</span>`).join('');
  });

  const el = {
    bg: $('.svc-bg'), vig: $('.svc-vig'), intro: $('.svc-intro'),
    shadeCopy: $('.svc-shade--copy'), shadeSteps: $('.svc-shade--steps'),
    txt: $$('.svc-scene .svc-txt'),
    chips: $$('.svc-chip').map(c => ({ c, d: [...c.querySelectorAll('.svc-num > span')] })),
    note: $('.svc-note'), reels: $('.svc-reels'),
    esteps: $('.svc-esteps'), estep: $$('.svc-estep'), exp: $('.svc-export'), ready: $('.svc-ready'),
    fin: $('.svc-final'), finLinks: $$('.svc-final a'),
    nav: $('.svc-steps'), navFill: $('.svc-steps-line > span'),
    steps: $$('.svc-step').map(b => ({ b, bar: b.querySelector('.svc-step-bar > span') })),
    heroGrid: document.querySelector('.hero-grid'),
  };
  const expTpl = el.exp.dataset.tpl;

  // Eyni dəyəri təkrar yazmamaq üçün kiçik keş
  const cache = new WeakMap();
  const set = (node, prop, v) => {
    let c = cache.get(node);
    if (!c) cache.set(node, (c = {}));
    if (c[prop] === v) return;
    c[prop] = v;
    if (prop === 'text') node.textContent = v;
    else if (prop === 'class') node.className = v;
    else node.style[prop] = v;
  };
  const fade = (node, o, y = 0, b = 0) => {
    set(node, 'opacity', String(o));
    set(node, 'transform', y ? `translate3d(0,${y}px,0)` : 'none');
    set(node, 'filter', b > 0.05 ? `blur(${b}px)` : 'none');
  };
  const at = (node, x, y, extra = '') => set(node, 'transform', `translate3d(${x}px,${y}px,0) translate(-50%,-50%)${extra}`);

  // Canlı detallar (softbox/üst işıq nəbzi, REC, toz) yalnız bölmə görünəndə və film yerində duranda işləyir.
  // Safari-də hər SMIL kadrı bütün SVG-ni yenidən çəkdirir: scroll zamanı dayanır, kadr sakitləşəndən 0.3 s sonra davam edir.
  let visible = false, playing = true, liveTimer = 0;
  const live = on => {
    if (on === playing) return;
    playing = on;
    on ? svg.unpauseAnimations?.() : svg.pauseAnimations?.();
  };
  function holdLive() {
    live(false);
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => live(visible), 300);
  }

  let L = layout(1, 1);
  let scale = buildScale(BASE_SCREENS.desktop);
  const state = { q: 0 }; // scroll irəliləyişi 0–1; dizayndakı p dayanmalarla birlikdə ondan hesablanır

  function render() {
    const p = scale.pAt(state.q * scale.total);
    const st = computeStage(p, L, info);
    // Hero-dan keçid: vinyet də qaranlıqla birlikdə gəlir ki, hero-nun üstündə kənar qaralması görünməsin
    st.s.vig = Math.round(st.s.vig * Math.min(1, p / 0.026) * 100) / 100;
    applyBindings(bindings, { s: st.s, ui: L });
    set(el.vig, 'opacity', String(st.s.vig));
    holdLive();

    set(el.bg, 'opacity', String(st.hero.dark));
    // Hero ilə üst-üstə düşmə yalnız 3D rejimdədir (hero pin-i bu bölmənin altında qalır)
    if (el.heroGrid && html.classList.contains('is-3d-ready')) {
      set(el.heroGrid, 'opacity', String(st.hero.text));
      set(el.heroGrid, 'transform', st.hero.y ? `translate3d(0,${st.hero.y}px,0)` : 'none');
      hero?.setRingIntensity(st.hero.ring);
      // Ekran tam qaralandan sonra 3D hero çəkilmir (Safari-də S0–S1 titrəməsinin səbəbi idi)
      hero?.setCovered(st.hero.dark >= 1);
    }

    fade(el.intro, st.intro.o, st.intro.y, st.intro.b);
    st.tx.forEach((t, i) => fade(el.txt[i], t.o, t.y, t.b));
    st.chips.forEach((ch, i) => {
      const c = el.chips[i];
      set(c.c, 'opacity', String(ch.o));
      set(c.c, 'transform', ch.y ? `translate3d(0,${ch.y}px,0)` : 'none');
      ch.dg.forEach((d, j) => {
        if (!c.d[j]) return;
        set(c.d[j], 'transform', d.y ? `translate3d(0,${(d.y * 1.14).toFixed(3)}em,0)` : 'none');
        set(c.d[j], 'opacity', String(d.o));
      });
    });
    set(el.note, 'opacity', String(st.note.o));
    set(el.note, 'transform', st.note.y ? `translate3d(0,${st.note.y}px,0)` : 'none');

    set(el.reels, 'opacity', String(st.reels.o));
    if (st.reels.o > 0) { at(el.reels, st.reels.x, st.reels.y); set(el.reels, 'text', st.reels.n + '/5'); }

    const ed = st.edit;
    set(el.esteps, 'opacity', String(ed.o));
    if (ed.o > 0) {
      at(el.esteps, ed.x, ed.y);
      ed.steps.forEach((s, i) => set(el.estep[i], 'class', 'svc-estep' + (s ? ' is-' + s : '')));
    }
    set(el.exp, 'opacity', String(ed.exO));
    if (ed.exO > 0) { at(el.exp, ed.exX, ed.exY); set(el.exp, 'text', expTpl.replace('{N}', ed.exPct)); }
    set(el.ready, 'opacity', String(ed.readyO));
    if (ed.readyO > 0) at(el.ready, ed.exX, ed.exY, ` scale(${ed.readyS})`);

    fade(el.fin, st.fin.o, st.fin.y, st.fin.b);
    const finOn = st.fin.o > 0.5;
    set(el.fin, 'pointerEvents', finOn ? 'auto' : 'none');
    if (finOn !== el.fin._on) {
      el.fin._on = finOn;
      el.finLinks.forEach(a => (finOn ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
    }

    set(el.shadeCopy, 'opacity', String(st.shadeCopy));
    set(el.shadeSteps, 'opacity', String(st.shadeSteps));

    const ind = st.ind;
    set(el.nav, 'opacity', String(ind.o));
    set(el.nav, 'visibility', ind.o > 0 ? 'visible' : 'hidden');
    set(el.navFill, 'transform', `scaleY(${(ind.fill / 320).toFixed(4)})`);
    el.steps.forEach(({ b, bar }, i) => {
      const on = i === ind.active, done = ind.active > i;
      set(b, 'class', 'svc-step' + (on ? ' is-on' : done ? ' is-done' : ''));
      if (on !== b._on) { b._on = on; on ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'); }
      set(bar, 'transform', `scaleX(${done ? 1 : on ? Math.max(0.06, ind.local).toFixed(4) : 0})`);
    });
  }

  function resize() {
    const W = pin.clientWidth, H = pin.clientHeight;
    if (!W || !H) return;
    L = layout(W, H);
    scale = buildScale(L.desk ? BASE_SCREENS.desktop : BASE_SCREENS.mobile);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    render();
  }

  ScrollTrigger.config({ ignoreMobileResize: true });
  const tl = gsap.timeline({ paused: true }).to(state, { q: 1, duration: 1, ease: 'none', onUpdate: render });
  const trig = ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom',
    scrub: 0.6, animation: tl, invalidateOnRefresh: true,
    onToggle: self => root.classList.toggle('is-active', self.isActive),
  });

  // Addım göstəricisi: səhnənin əsas kadrına scroll
  el.steps.forEach(({ b }, i) => b.addEventListener('click', () => {
    const y = trig.start + scale.uAt(STEP_KEYS[i]) / scale.total * (trig.end - trig.start);
    html.style.scrollBehavior = 'auto'; // CSS smooth scroll GSAP-ın addımları ilə toqquşur
    gsap.to(window, {
      scrollTo: y, duration: 0.9, ease: 'power2.inOut', overwrite: true,
      onComplete: () => { html.style.scrollBehavior = ''; },
      onInterrupt: () => { html.style.scrollBehavior = ''; },
    });
  }));

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) { clearTimeout(liveTimer); live(false); } else holdLive();
  }).observe(root);

  new ResizeObserver(resize).observe(pin);
  resize();
  html.classList.add('svc-on');
  ScrollTrigger.refresh();
}
