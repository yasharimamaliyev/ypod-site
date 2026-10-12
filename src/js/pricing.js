// Qiymət məntiqi. Rəqəmlər CLAUDE.md bölmə 3-dən götürülüb, dəyişiklik yalnız sahibkarın təsdiqi ilə.
export const HOURLY = [70, 120, 170]; // 1/2/3 kamera, 1 saat studiya çəkilişi
export const EDIT = 100;              // 1 saatlıq epizodun montajı

export const TIERS = [
  { h: 5, d: 10, m: 2, p: [315, 540, 765] },
  { h: 10, d: 20, m: 4, p: [560, 960, 1360] },
  { h: 15, d: 30, m: 8, p: [735, 1260, 1785] },
  { h: 20, d: 40, m: 12, p: [840, 1440, 2040], best: true },
];

export const studioPrice = cam => HOURLY[cam];
export const fullPrice = cam => HOURLY[cam] + EDIT;
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

// Hər [data-pricing] bölməsinin öz kamera seçimi var
export function initPricing({ camLabels, onCamChange }) {
  for (const section of document.querySelectorAll('[data-pricing]')) {
    const kind = section.dataset.pricing;
    const seg = section.querySelector('.seg-cams');
    const buttons = [...seg.querySelectorAll('.sg')];

    const render = cam => {
      buttons.forEach(b => {
        const on = +b.dataset.cam === cam;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      placeThumb(seg);

      if (kind === 'studio') {
        section.querySelectorAll('[data-price="studio"]').forEach(el => swap(el, fmt(studioPrice(cam))));
        section.querySelectorAll('[data-price="full"]').forEach(el => swap(el, fmt(fullPrice(cam))));
        section.querySelectorAll('[data-cam-label]').forEach(el => { el.textContent = camLabels[cam]; });
      } else {
        section.querySelectorAll('[data-tier]').forEach(card => {
          const tier = TIERS[+card.dataset.tier];
          card.querySelector('[data-price="old"]').textContent = fmt(corpOld(tier, cam));
          swap(card.querySelector('[data-price="now"]'), fmt(corpNow(tier, cam)));
          card.querySelector('[data-price="per"]').textContent = fmt(corpPerHour(tier, cam));
        });
      }
      onCamChange?.(section, cam + 1);
    };

    buttons.forEach(b => b.addEventListener('click', () => render(+b.dataset.cam)));
    seg.classList.add('has-thumb');
    render(0);

    // Şrift yüklənəndə və ölçü dəyişəndə düymə enləri dəyişir
    new ResizeObserver(() => placeThumb(seg)).observe(seg);
    document.fonts?.ready.then(() => placeThumb(seg));
  }
}
