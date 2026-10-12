// Mobil menyu + scroll-spy
export function initNav() {
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('mmenu');

  const setOpen = open => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? btn.dataset.labelClose : btn.dataset.labelOpen);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) menu.querySelector('a')?.focus();
  };

  btn.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) setOpen(false); });

  // Scroll-spy: ekranın ortasındakı bölmənin linki "on" olur
  const links = [...document.querySelectorAll('.nav-links .nl')];
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const link = byId.get(e.target.id);
      if (!link) continue;
      if (e.isIntersecting) {
        links.forEach(l => { l.classList.remove('on'); l.removeAttribute('aria-current'); });
        link.classList.add('on');
        link.setAttribute('aria-current', 'true');
      } else if (link.classList.contains('on')) {
        link.classList.remove('on');
        link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
