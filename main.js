// ============ Spotlight sigue el cursor (sólo mouse, con rAF) ============
if (window.matchMedia('(pointer: fine)').matches) {
  const sp = document.getElementById('spotlight');
  if (sp) {
    let ticking = false, mx = 0, my = 0;
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sp.style.setProperty('--mx', mx + 'px');
        sp.style.setProperty('--my', my + 'px');
        ticking = false;
      });
    }, { passive: true });
  }
}

// ============ Navbar se oscurece al hacer scroll ============
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  if (window.scrollY > 10) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

// ============ Fade-in al hacer scroll (IntersectionObserver) ============
(function fadeInOnScroll() {
  const items = document.querySelectorAll('.fade-in');
  if (!('IntersectionObserver' in window)) {
    items.forEach(i => i.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(i => observer.observe(i));
})();

// ============ Contadores animados al entrar en viewport ============
(function animatedCounters() {
  const nums = document.querySelectorAll('.stat-num');
  if (!nums.length) return;

  function animate(el) {
    const target = parseFloat(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = 1600;
    let startTime = null;

    function step(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  nums.forEach(n => observer.observe(n));
})();

// ============ Menú móvil (hamburguesa) ============
(function navToggle() {
  const nav = document.getElementById('navbar');
  const btn = nav && nav.querySelector('.nav-toggle');
  if (!nav || !btn) return;
  const close = () => { nav.classList.remove('nav-open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle('nav-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('.nav-menu a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('click', (e) => { if (nav.classList.contains('nav-open') && !nav.contains(e.target)) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();


// ============ Videos de tótems: cargar y reproducir al entrar en viewport ============
(function lazyVideos() {
  const vids = document.querySelectorAll('video.lazy-video');
  if (!vids.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const load = (v) => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    const src = v.getAttribute('data-src');
    if (src) v.src = src;
    // Sólo reproduce en loop si el usuario no pidió reducir movimiento
    if (!reduce) { v.autoplay = true; v.play().catch(() => {}); }
  };

  if (!('IntersectionObserver' in window)) { vids.forEach(load); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) { load(e.target); obs.unobserve(e.target); }
    });
  }, { rootMargin: '200px 0px' });
  vids.forEach(v => io.observe(v));
})();

// ============ Acordeón de casos: hover en desktop, click en mobile ============
(function casesAccordion() {
  const acc = document.querySelector('.cases-accordion');
  if (!acc) return;
  const cards = Array.from(acc.querySelectorAll('.case-card'));
  if (!cards.length) return;
  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
  const activate = (card) => { cards.forEach(c => c.classList.remove('active')); card.classList.add('active'); };
  activate(cards[0]);
  cards.forEach(card => {
    // Desktop: se abre al pasar el mouse. En mobile es una grilla de 2 columnas
    // con todas las cards visibles, así que el click navega directo.
    card.addEventListener('mouseenter', () => { if (!isMobile()) activate(card); });
  });
})();
