// Xidmətlər: scroll filmi (svc-anim) və statik kartlar (svc-static).
// Səhnənin bütün dəyərləri services-stage.js-dən gəlir; burada yalnız DOM-a yazılır.
// Pin CSS ilə edilir: bölmənin hündürlüyü ilk boyamadan bilinir, səhifə sıçramır. Aktiv olanda fixed (is-active),
// sonra bölmənin dibində (is-past). Sticky iOS/Safari-də scroll zamanı əsirdi.
import stageSvg from '../assets/services-stage.svg?raw';
import { computeStage, buildScale, BASE_SCREENS, HOLDS, STEP_KEYS, STATIC_KEYS } from './services-stage.js';

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

  // Həkimin əl etməsi (S5b dayanması): zamana bağlıdır, çünki dayanmada scroll, deməli p da dayanır
  const WAVE_P = STEP_KEYS[4];
  const W = { a: 0, ph: 0 };
  let waveTl = null, waveCall = null;
  function waveOn(on) {
    if (on === Boolean(waveTl || waveCall)) return;
    gsap.killTweensOf(W);
    waveCall?.kill(); waveTl?.kill(); waveCall = waveTl = null;
    if (!on) { gsap.to(W, { a: 0, duration: 0.25, onUpdate: () => render(false) }); return; }
    // dayanmanın üstündən keçəndə əl etməsin: kadr bir az yerində qalmalıdır
    waveCall = gsap.delayedCall(0.35, () => {
      waveCall = null;
      waveTl = gsap.timeline({ repeat: -1, repeatDelay: 2.2, onUpdate: () => render(false) })
        .fromTo(W, { ph: 0 }, { ph: Math.PI * 5, duration: 1.7, ease: 'none' }, 0)
        .fromTo(W, { a: 0 }, { a: 1, duration: 0.25, ease: 'power1.out' }, 0)
        .to(W, { a: 0, duration: 0.35, ease: 'power1.in' }, 1.35);
    });
  }

  let L = layout(1, 1);
  let scale = buildScale(BASE_SCREENS.desktop);
  const state = { q: 0 }; // scroll irəliləyişi 0–1; dizayndakı p dayanmalarla birlikdə ondan hesablanır

  function render(scrolling = true) {
    const p = scale.pAt(state.q * scale.total);
    const st = computeStage(p, L, info, W.a * 16 * Math.sin(W.ph));
    // Hero-dan keçid: vinyet də qaranlıqla birlikdə gəlir ki, hero-nun üstündə kənar qaralması görünməsin
    st.s.vig = Math.round(st.s.vig * Math.min(1, p / 0.026) * 100) / 100;
    applyBindings(bindings, { s: st.s, ui: L });
    set(el.vig, 'opacity', String(st.s.vig));
    if (scrolling) holdLive();
    waveOn(Math.abs(p - WAVE_P) < 1e-9);

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
    onToggle: setPin, onRefresh: setPin,
  });
  function setPin(self) {
    root.classList.toggle('is-active', self.isActive);
    root.classList.toggle('is-past', !self.isActive && self.progress > 0.5);
  }
  setPin(trig);

  /* ---------- Addım-addım scroll ----------
     Zonada təkər, toxunma və klaviatura səhifəni birbaşa sürüşdürmür: hər jest növbəti dayanacağa aparır,
     nə qədər güclü scroll edilsə də. Dayanacaqlar: səhifənin başı → hero mətni (3D hero) → film (HOLDS,
     buildScale().stops) → növbəti bölmə (Brendlər, altında Qiymətlər). Zonadan kənarda adi scroll. */
  const TOL = 3;
  const heroEl = document.querySelector('.hero');
  const after = root.nextElementSibling;
  const HERO_TEXT = 0.75; // hero3d.js timeline-ında mətn və düymələr 0.7-də tam görünür
  const SAYYAR = [STEP_KEYS[3], STEP_KEYS[4]]; // Reels → həkim kabineti: ən uzun səhnə, ayrıca yavaş
  const k = () => (trig.end - trig.start) / scale.total;
  const filmY = () => scale.stops.map(([a, b]) => [trig.start + a * k(), trig.start + b * k()]);
  const pageY = node => node.getBoundingClientRect().top + window.scrollY;
  function stopsY() {
    const S = filmY();
    // 3D hero scroll ilə açılır: onun iki kadrı da addımdır; filmin başı (= hero-nun sonu) onda ayrıca addım deyil
    if (heroEl && html.classList.contains('is-3d-ready')) {
      const h0 = Math.max(0, pageY(heroEl)), ht = h0 + HERO_TEXT * (trig.start - h0);
      S.splice(0, 1, [0, 0], [ht, ht]);
    }
    if (after) { const y = pageY(after) - (parseFloat(getComputedStyle(html).scrollPaddingTop) || 0); S.push([y, y]); }
    return S;
  }
  // Dayanmaya kənarından bir az içəri gedilir: scroll tam piksələ yuvarlananda kadr dayanmadan əvvələ düşməsin
  const inside = ([a, b], dir) => (dir > 0 ? a + Math.min(4, (b - a) / 2) : b - Math.min(4, (b - a) / 2));
  const within = (S, y) => S.some(([a, b]) => y >= a - TOL && y <= b + TOL);
  // dir istiqamətində scroll bu mövqedən zonaya aiddirmi?
  function owns(y, dir) {
    const S = stopsY(), first = S[0], last = S[S.length - 1];
    return dir > 0 ? y >= first[0] - TOL && y < last[0] - TOL : y > first[1] + TOL && y <= last[1] + TOL;
  }
  // Addımın müddəti: film səhnələri p fərqinə görə 1.2–2.4 s, Səyyar 4 s, hero və bölmədən çıxış 1.8 s
  const pOf = y => scale.pAt(Math.min(scale.total, Math.max(0, (y - trig.start) / k())));
  function duration(from, to) {
    const lo = Math.min(from, to), hi = Math.max(from, to);
    if (lo < trig.start - TOL || hi > trig.end + TOL) return 1.8;
    const a = pOf(lo), b = pOf(hi);
    if (a <= SAYYAR[0] + 1e-6 && b >= SAYYAR[1] - 1e-6) return 4;
    return Math.min(2.4, Math.max(1.2, 0.9 + 9 * (b - a)));
  }
  let busy = false, glideId = 0, restY = 0, queued = 0;
  function glide(y) {
    const id = ++glideId;
    restY = y;
    const done = () => {
      if (id !== glideId) return;
      busy = false;
      html.style.scrollBehavior = ''; html.style.overflow = '';
      // animasiya vaxtı başlanmış yeni jest itmir: indi icra olunur
      const q = queued;
      queued = 0;
      if (q && owns(window.scrollY, q)) step(q);
    };
    html.style.scrollBehavior = 'auto'; // CSS smooth scroll GSAP-ın addımları ilə toqquşur
    gsap.to(window, {
      scrollTo: { y, autoKill: false }, duration: duration(window.scrollY, y), ease: 'sine.inOut',
      overwrite: true, onComplete: done, onInterrupt: done,
    });
    busy = true;
  }
  function step(dir) {
    const S = stopsY();
    let y = window.scrollY, next;
    const i = S.findIndex(([a, b]) => y >= a - TOL && y <= b + TOL);
    if (i >= 0) {
      // Dayanmanın içində kadr dəyişmir: əvvəl onun gediş tərəfdəki kənarına keçilir ki, boş scroll vaxt yeməsin
      const edge = dir > 0 ? S[i][1] : S[i][0];
      if (Math.abs(edge - y) > 1) {
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, edge);
        y = edge;
      }
      next = i + dir;
    } else next = dir > 0 ? S.findIndex(([a]) => a > y) : S.findLastIndex(([, b]) => b < y);
    if (next < 0 || next >= S.length) return false;
    glide(inside(S[next], dir));
    return true;
  }
  const locked = () => document.body.style.overflow === 'hidden'; // mobil menyu açıqdır

  // Təkər/trackpad: bir jest — bir addım. Yeni jest: 250 ms sükut, istiqamət dəyişməsi, ya da sönən ətalətdən sonra
  // birdən sürətlənmə (trackpad-ın ətalət dalğası sönən rəqəmlərdir, yeni sürüşdürmə isə birdən böyüyür).
  // Chrome jestin ilk hadisəsi bloklanmayıbsa (məs. zonadan kənarda başlayan jest), qalanlarını bloklamağa icazə vermir:
  // onda səhifə dayanacaqda əl ilə saxlanılır (pinRest).
  const g = { t: -1e9, dir: 0, peak: 0, low: 0, used: false, outside: false };
  let touchInput = false;
  const pinRest = () => { if (Math.abs(window.scrollY - restY) > 1) { html.style.scrollBehavior = 'auto'; window.scrollTo(0, restY); html.style.scrollBehavior = ''; } };
  window.addEventListener('wheel', e => {
    touchInput = false;
    if (e.ctrlKey || locked()) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (!dy || Math.abs(e.deltaX) > Math.abs(dy)) return;
    const dir = Math.sign(dy), abs = Math.abs(dy);
    const fresh = e.timeStamp - g.t > 250 || dir !== g.dir || (abs > 20 && g.low < g.peak * 0.35 && abs > g.low * 3);
    if (fresh || abs > g.peak) g.peak = g.low = abs;
    else g.low = Math.min(g.low, abs);
    if (fresh) g.used = g.outside = false;
    g.t = e.timeStamp; g.dir = dir;
    if (busy) { e.preventDefault(); if (fresh) queued = dir; g.used = true; return; }
    if (g.used) { e.preventDefault(); if (!e.cancelable) pinRest(); return; }
    const y = window.scrollY;
    if (!owns(y, dir)) { g.outside = true; return; }
    e.preventDefault();
    // kənardan gələn jest dayanmanın içinə düşdü (məs. aşağıdan final kadrına): ilk dayanacaq elə budur
    if (g.outside && within(stopsY(), y)) { restY = y; g.used = true; return; }
    g.used = step(dir);
  }, { passive: false });

  const KEYS = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
  window.addEventListener('keydown', e => {
    let dir = KEYS[e.key];
    if (!dir || e.altKey || e.ctrlKey || e.metaKey || locked()) return;
    if (e.key === ' ' && e.shiftKey) dir = -1;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || (e.key === ' ' && e.target.closest?.('a, button, summary'))) return;
    if (busy) { e.preventDefault(); if (!e.repeat) queued = dir; return; }
    if (!owns(window.scrollY, dir)) return;
    e.preventDefault();
    step(dir);
  });

  // Toxunma: barmaq zonada sürüşdürəndə səhifə tərpənmir, 24 px-dən sonra bir addım atılır
  const tch = { y: 0, mode: 0, used: false, on: false };
  window.addEventListener('touchstart', e => {
    touchInput = true; tch.on = true; tch.used = false;
    tch.mode = e.touches.length > 1 || locked() ? -1 : 0;
    tch.y = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (tch.mode < 0 || e.touches.length > 1) return;
    const dy = tch.y - e.touches[0].clientY;
    if (!tch.mode) {
      if (!dy) return;
      tch.mode = busy || owns(window.scrollY, Math.sign(dy)) ? 1 : -1;
      if (tch.mode < 0) return;
    }
    if (e.cancelable) e.preventDefault();
    if (!tch.used && Math.abs(dy) > 24) {
      tch.used = true;
      if (busy) queued = Math.sign(dy); else step(Math.sign(dy));
    }
  }, { passive: false });
  const touchEnd = e => { if (!e.touches.length) tch.on = false; };
  window.addEventListener('touchend', touchEnd, { passive: true });
  window.addEventListener('touchcancel', touchEnd, { passive: true });

  // Zonada barmaq ekranda deyil, animasiya da getmir, amma səhifə sürüşür: bu, zonadan kənarda başlamış jestin ətalətidir.
  // Ətalət kəsilir və hərəkət istiqamətindəki dayanacağa gedilir. Nav linkləri (#anchor) də zonadan keçir: onlara toxunulmur.
  let lastY = window.scrollY, navJump = false, navTimer = 0;
  document.addEventListener('click', e => { if (e.target.closest?.('a[href^="#"]')) navJump = true; }, true);
  window.addEventListener('scroll', () => {
    const y = window.scrollY, py = lastY;
    lastY = y;
    // təkər jesti dayanacağa çatıb, amma bloklanmayan ətalət səhifəni hələ sürüşdürür
    if (!busy && g.used && !touchInput && performance.now() - g.t < 250) { pinRest(); return; }
    if (navJump) { clearTimeout(navTimer); navTimer = setTimeout(() => { navJump = false; }, 200); return; }
    if (!touchInput || busy || tch.on || locked() || Math.abs(y - py) < 1) return;
    const dir = Math.sign(y - py);
    if (!owns(y, dir)) return;
    const S = stopsY();
    let to;
    if (within(S, y)) to = y; // dayanmanın içindədir: elə burada dayanır
    else to = dir > 0 ? inside(S.find(([a]) => a > y), 1) : inside(S.findLast(([, b]) => b < y), -1);
    html.style.overflow = 'hidden'; // iOS ətaləti yalnız belə dayanır; glide bitəndə qaytarılır
    glide(to);
  }, { passive: true });

  // Addım göstəricisi: səhnənin əsas kadrına (dayanmanın başına)
  el.steps.forEach(({ b }, i) => b.addEventListener('click', () => {
    const j = HOLDS.findIndex(([p]) => p === STEP_KEYS[i]) + 1; // filmY()[0] filmin başıdır
    glide(inside(filmY()[j], 1));
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
