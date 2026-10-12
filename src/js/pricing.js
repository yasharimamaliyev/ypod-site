// Qiymət məntiqi. Rəqəmlər CLAUDE.md bölmə 3-dən götürülüb, dəyişiklik yalnız sahibkarın təsdiqi ilə.
export const HOURLY = [70, 120, 170];         // 1/2/3 kamera, 1 saat studiya çəkilişi
export const ONSITE_HOURLY = [140, 240, 340]; // səyyar studiya ("Sizin məkanda"), yol haqqı daxil
export const EDIT = 100;                      // 1 saatlıq epizodun montajı (hər iki yerdə eyni)
export const REELS = { studio: 150, onsite: 250 };
export const PLACES = ['studio', 'onsite'];

export const TIERS = [
  { h: 5, d: 10, m: 2, p: [315, 540, 765] },
  { h: 10, d: 20, m: 4, p: [560, 960, 1360] },
  { h: 15, d: 30, m: 8, p: [735, 1260, 1785] },
  { h: 20, d: 40, m: 12, p: [840, 1440, 2040], best: true },
];

export const studioPrice = (cam, place = 'studio') => (place === 'onsite' ? ONSITE_HOURLY : HOURLY)[cam];
export const fullPrice = (cam, place = 'studio') => studioPrice(cam, place) + EDIT;
export const reelsPrice = (place = 'studio') => REELS[place];
export const corpOld = (tier, cam) => HOURLY[cam] * tier.h;
export const corpNow = (tier, cam) => tier.p[cam];
export const corpPerHour = (tier, cam) => Math.round(tier.p[cam] / tier.h);

// Minlik ayırıcı: bölünməyən boşluq → "1 360"
export const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function swap(el, value) {
  if (el.textContent === value) return;
  el.textContent = value;
  el.classList.remove('swap');
  void el.offsetWidth;
  el.classList.add('swap');
}

function placeThumb(seg) {
  const thumb = seg.querySelector('.seg-thumb');
  const on = seg.querySelector('.sg.on');
  if (!thumb || !on) return;
  thumb.style.width = on.offsetWidth + 'px';
  thumb.style.transform = `translateX(${on.offsetLeft}px)`;
}

function press(buttons, isOn) {
  buttons.forEach(b => {
    const on = isOn(b);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

// Hər [data-pricing] bölməsinin öz kamera seçimi var. Qiymətlər bölməsində həm də yer seçimi var
// ("Studiyada | Sizin məkanda"); korporativ paketlər yalnız studiya üçündür.
export function initPricing({ camLabels, onChange }) {
  for (const section of document.querySelectorAll('[data-pricing]')) {
    const kind = section.dataset.pricing;
    const seg = section.querySelector('.seg-cams');
    const buttons = [...seg.querySelectorAll('.sg')];
    const placeSeg = section.querySelector('.seg-place');
    const placeButtons = placeSeg ? [...placeSeg.querySelectorAll('.sg')] : [];
    const placeTitles = [...section.querySelectorAll('[data-place-title]')];
    let cam = 0, place = 'studio';

    const render = () => {
      press(buttons, b => +b.dataset.cam === cam);
      placeThumb(seg);

      if (kind === 'studio') {
        if (placeSeg) {
          press(placeButtons, b => b.dataset.place === place);
          placeThumb(placeSeg);
          placeTitles.forEach(el => { el.textContent = el.dataset[place]; });
        }
        section.querySelectorAll('[data-price="studio"]').forEach(el => swap(el, fmt(studioPrice(cam, place))));
        section.querySelectorAll('[data-price="full"]').forEach(el => swap(el, fmt(fullPrice(cam, place))));
        section.querySelectorAll('[data-price="reels"]').forEach(el => swap(el, fmt(reelsPrice(place))));
        section.querySelectorAll('[data-cam-label]').forEach(el => { el.textContent = camLabels[cam]; });
      } else {
        section.querySelectorAll('[data-tier]').forEach(card => {
          const tier = TIERS[+card.dataset.tier];
          card.querySelector('[data-price="old"]').textContent = fmt(corpOld(tier, cam));
          swap(card.querySelector('[data-price="now"]'), fmt(corpNow(tier, cam)));
          card.querySelector('[data-price="per"]').textContent = fmt(corpPerHour(tier, cam));
        });
      }
      onChange?.(section, { n: cam + 1, place });
    };

    buttons.forEach(b => b.addEventListener('click', () => { cam = +b.dataset.cam; render(); }));
    placeButtons.forEach(b => b.addEventListener('click', () => { place = b.dataset.place; render(); }));
    for (const s of [seg, placeSeg]) {
      if (!s) continue;
      s.classList.add('has-thumb');
      // Şrift yüklənəndə və ölçü dəyişəndə düymə enləri dəyişir
      new ResizeObserver(() => placeThumb(s)).observe(s);
      document.fonts?.ready.then(() => placeThumb(s));
    }
    render();
  }
}
