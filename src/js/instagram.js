// "Son çəkilişlər": postlar serverless funksiyadan gəlir (worker/instagram.js). Token brauzerə düşmür.
import { CONFIG } from './config.js';

const PROFILE = 'https://www.instagram.com/ypod.az/';
const REEL_ICON = '<svg class="ig-reel" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fdf6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 8.5h18M8 3l3 5.5M14 3l3 5.5"/></svg>';
const OVERLAY = '<span class="ov" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></span>';

function tile({ href, img, reel, aria, label }) {
  const a = document.createElement('a');
  a.className = 'ig';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', aria);
  if (img) {
    const im = document.createElement('img');
    im.src = img;
    im.alt = '';
    im.loading = 'lazy';
    im.decoding = 'async';
    a.append(im);
  } else {
    const s = document.createElement('span');
    s.textContent = label;
    a.append(s);
  }
  a.insertAdjacentHTML('beforeend', (reel ? REEL_ICON : '') + OVERLAY);
  return a;
}

export function initInstagram(t) {
  const section = document.getElementById('instagram');
  const grid = section.querySelector('.ig-grid');
  const { endpoint, demo, limit } = CONFIG.instagram;
  if (!endpoint && !demo) return;           // mənbə yoxdur → bölmə gizli qalır

  section.hidden = false;

  if (!endpoint) {
    // Dizayndakı placeholder kafellər
    grid.append(...Array.from({ length: limit }, (_, i) => tile({
      href: PROFILE, reel: [1, 4, 6].includes(i), aria: `${t.ig.post_aria} ${i + 1}`, label: `[IG POST ${i + 1}]`,
    })));
    grid.removeAttribute('aria-busy');
    return;
  }

  grid.append(...Array.from({ length: limit }, () => {
    const s = document.createElement('div');
    s.className = 'ig ig-skel';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }));

  // Bölmə ekrana yaxınlaşanda yüklə
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    try {
      const res = await fetch(endpoint, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      const { data } = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error('boş');
      grid.replaceChildren(...data.slice(0, limit).map((p, i) => tile({
        href: p.permalink || PROFILE,
        img: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
        reel: p.media_type === 'VIDEO',
        aria: `${t.ig.post_aria} ${i + 1}`,
      })));
      grid.removeAttribute('aria-busy');
    } catch (err) {
      console.warn('Instagram yüklənmədi:', err);
      section.hidden = true;
    }
  }, { rootMargin: '400px 0px' });
  io.observe(section);
}
