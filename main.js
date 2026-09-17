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

// ============ Enlaces con ancla (/totems#via-cargo): reajusta cuando terminan de cargar las imágenes ============
window.addEventListener('load', () => {
  if (!location.hash) return;
  const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!el) return;
  // Instantáneo: el scroll suave se corta cuando las imágenes de arriba terminan de cargar
  const jump = () => el.scrollIntoView({ behavior: 'instant' });
  jump();
  setTimeout(jump, 400);
});

// ============ Tarjetas de proyectos: capturas que se alternan solas ============
(function rotatingMedia() {
  const boxes = document.querySelectorAll('.proy-rotate');
  if (!boxes.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  boxes.forEach((box, n) => {
    const imgs = box.querySelectorAll('img');
    if (imgs.length < 2) return;
    let i = 0;
    // Desfasadas entre sí para que no cambien todas a la vez
    setTimeout(() => setInterval(() => {
      if (document.hidden) return;
      imgs[i].classList.remove('is-active');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('is-active');
    }, 4000), n * 700);
  });
})();

// ============ Carrusel de reels (/totems/videos): puntos indicadores en mobile ============
(function reelsCarousel() {
  const track = document.querySelector('.tv-list');
  const dotsWrap = document.querySelector('.tv-dots');
  if (!track || !dotsWrap) return;
  const cards = Array.from(track.querySelectorAll('.tv-card'));
  if (cards.length < 2) return;

  const dots = cards.map((card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tv-dot';
    b.setAttribute('aria-label', 'Ver video ' + (i + 1) + ' de ' + cards.length);
    b.addEventListener('click', () => {
      const left = card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
      track.scrollTo({ left, behavior: 'smooth' });
    });
    dotsWrap.appendChild(b);
    return b;
  });

  const setActive = (i) => dots.forEach((d, j) => d.classList.toggle('active', j === i));
  setActive(0);

  let raf = null;
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let best = 0, bestDist = Infinity;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActive(best);
      raf = null;
    });
  }, { passive: true });
})();

// ============ Casos de éxito: carrusel spotlight (flechas + puntos) ============
(function casesSpotlight() {
  const track = document.querySelector('.spotlight-track');
  const dotsWrap = document.querySelector('.spotlight-dots');
  if (!track || !dotsWrap) return;
  const cards = Array.from(track.querySelectorAll('.spotlight-card'));
  const arrows = document.querySelectorAll('.spotlight-arrow');
  if (!cards.length) return;

  const dots = cards.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spotlight-dot';
    b.setAttribute('aria-label', 'Ver caso ' + (i + 1) + ' de ' + cards.length);
    b.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(b);
    return b;
  });

  const setActive = (i) => dots.forEach((d, j) => d.classList.toggle('active', j === i));
  let current = 0;
  setActive(0);

  function updateArrows() {
    const maxScroll = track.scrollWidth - track.clientWidth;
    arrows.forEach(btn => {
      const dir = parseInt(btn.dataset.dir, 10);
      const disabled = dir < 0 ? track.scrollLeft <= 2 : track.scrollLeft >= maxScroll - 2;
      btn.classList.toggle('is-disabled', disabled);
    });
  }
  updateArrows();

  function goTo(i) {
    current = Math.max(0, Math.min(cards.length - 1, i));
    const left = cards[current].offsetLeft - track.offsetLeft;
    track.scrollTo({ left, behavior: 'smooth' });
  }

  arrows.forEach(btn => {
    btn.addEventListener('click', () => goTo(current + parseInt(btn.dataset.dir, 10)));
  });

  let raf = null;
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let best = 0, bestDist = Infinity;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      current = best;
      setActive(best);
      updateArrows();
      raf = null;
    });
  }, { passive: true });
})();
