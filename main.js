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
  };

  if (!('IntersectionObserver' in window)) { vids.forEach(load); return; }

  // Carga al acercarse y reproduce sólo lo que está a la vista: con una galería
  // de muchos videos, esto acota cuántos descargan y decodifican a la vez.
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) {
        load(v);
        if (!reduce) v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px', threshold: 0.2 });

  vids.forEach(v => io.observe(v));
})();

// ============ Índice lateral (/totems): marca la sección que se está leyendo ============
(function sideIndex() {
  const nav = document.querySelector('.side-index');
  if (!nav) return;

  const items = Array.from(nav.querySelectorAll('a[href^="#"]'))
    .map(a => ({ a, el: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
    .filter(it => it.el);
  if (!items.length) return;

  let current = null;
  const setActive = (el) => {
    if (el === current) return;
    current = el;
    items.forEach(it => it.a.classList.toggle('is-active', it.el === el));
  };

  // Activa la última sección cuyo arranque ya pasó el primer tercio de la pantalla
  const update = () => {
    const line = window.innerHeight * 0.3;
    let best = items[0];
    for (const it of items) {
      if (it.el.getBoundingClientRect().top <= line) best = it;
    }
    setActive(best.el);
  };

  let raf = null;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { update(); raf = null; });
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
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

// ============ Servicios: lista a la izquierda controla el panel de imagen a la derecha ============
(function servicesSplit() {
  const list = document.querySelector('.svc-list');
  const panel = document.querySelector('.svc-panel');
  if (!list || !panel) return;
  const items = Array.from(list.querySelectorAll('.svc-list-item'));
  const panels = Array.from(panel.querySelectorAll('.svc-panel-item'));

  function setActive(key) {
    items.forEach(it => {
      const active = it.dataset.svc === key;
      it.classList.toggle('is-active', active);
      it.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(p => p.classList.toggle('is-active', p.dataset.svc === key));
  }

  items.forEach(it => {
    const key = it.dataset.svc;
    it.addEventListener('mouseenter', () => setActive(key));
    it.addEventListener('focus', () => setActive(key));
    it.addEventListener('click', () => setActive(key));
  });
})();

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
