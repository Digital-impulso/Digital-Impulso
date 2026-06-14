// ============ Spotlight sigue el cursor ============
document.addEventListener('mousemove', e => {
  const sp = document.getElementById('spotlight');
  if (!sp) return;
  sp.style.setProperty('--mx', e.clientX + 'px');
  sp.style.setProperty('--my', e.clientY + 'px');
});

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

// ============ Typewriter en el hero ============
(function typewriter() {
  const el = document.getElementById('typewriter');
  if (!el) return;
  const words = ['Inteligencia Artificial', 'Automatización', 'Tótems de autogestión', 'Apps a medida'];
  let wordIndex = 0, charIndex = 0, deleting = false;

  function tick() {
    const current = words[wordIndex];
    if (deleting) {
      charIndex--;
    } else {
      charIndex++;
    }
    el.textContent = current.substring(0, charIndex);

    let delay = deleting ? 45 : 90;
    if (!deleting && charIndex === current.length) {
      delay = 1800;            // pausa al completar la palabra
      deleting = true;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      delay = 400;
    }
    setTimeout(tick, delay);
  }
  tick();
})();

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

// ============ Glow que sigue el mouse dentro de cada card de servicio ============
document.querySelectorAll('.svc-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    card.style.background = "radial-gradient(circle at " + x + "% " + y + "%, rgba(91,108,255,0.08), transparent 60%), #0A0A0F";
  });
  card.addEventListener('mouseleave', () => {
    card.style.background = '';
  });
});

// ============ Envío del formulario de contacto a WhatsApp ============
function enviarContacto(e) {
  e.preventDefault();
  const valor = document.getElementById('contacto-input').value.trim();
  if (!valor) {
    alert('Por favor ingresá tu WhatsApp o email');
    return;
  }
  const msg = encodeURIComponent('Hola, quiero una consultoría gratis. Mi contacto: ' + valor);
  window.open('https://wa.me/5491171668769?text=' + msg, '_blank');
}
