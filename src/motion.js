// Progressive enhancement: every section stays readable without JavaScript,
// and every effect below resolves to its end state under reduced motion.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;

  /* ---------- Text decode: glyphs settle into the real text, left to right ---------- */
  const GLYPHS = 'ABCDEFGHJKMNPQRSTUVWXYZ0123456789/<>#%+=_';
  const running = new WeakMap();
  function decode(el, {duration = 700} = {}) {
    if (reduced.matches) return;
    const final = el.dataset.text || (el.dataset.text = el.textContent);
    if (!final.trim()) return;
    cancelAnimationFrame(running.get(el));
    el.setAttribute('aria-label', final);         // screen readers always get the real text
    el.style.minHeight = el.offsetHeight + 'px';   // no layout jump while glyphs change width
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const locked = Math.floor(t * final.length);
      let out = final.slice(0, locked);
      for (let i = locked; i < final.length; i++) {
        const c = final[i];
        out += c === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (t < 1) running.set(el, requestAnimationFrame(step));
      else { el.textContent = final; el.removeAttribute('aria-label'); el.style.minHeight = ''; }
    };
    running.set(el, requestAnimationFrame(step));
  }

  /* ---------- Entrance reveals + decode on first view ---------- */
  if ('IntersectionObserver' in window && !reduced.matches) {
    root.classList.add('js-reveal');
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        e.target.querySelectorAll('[data-decode]').forEach((el, i) => setTimeout(() => decode(el, {duration: 520 + i * 260}), i * 90));
        io.unobserve(e.target);
      }
    }, {threshold: .12});
    document.querySelectorAll('.section-heading, .card, .experience, .skills article, .education, .project-hero').forEach(el => io.observe(el));
  }

  // Nav links re-decode on hover/focus.
  document.querySelectorAll('nav a').forEach(a => {
    const go = () => decode(a, {duration: 380});
    a.addEventListener('mouseenter', go);
    a.addEventListener('focus', go);
  });

  /* ---------- Scroll progress rail ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = root.scrollHeight - innerHeight;
      root.style.setProperty('--progress', max > 0 ? (scrollY / max).toFixed(4) : 0);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, {passive: true});
  onScroll();

  /* ---------- Status strip: owner's local time + rotating status ---------- */
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', {timeZone: clock.dataset.clock, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
    const tick = () => { clock.textContent = fmt.format(new Date()); };
    tick(); setInterval(tick, 1000);
  }
  const status = document.querySelector('[data-status]');
  if (status) {
    const lines = JSON.parse(status.dataset.status);
    let i = 0;
    setInterval(() => {
      i = (i + 1) % lines.length;
      status.dataset.text = lines[i];
      status.textContent = lines[i];
      decode(status, {duration: 600});
    }, 4200);
  }

  /* ---------- Cursor: a lagging ring plus an exact dot (fine pointers only) ---------- */
  if (finePointer.matches && !reduced.matches) {
    const ring = document.createElement('div'), dot = document.createElement('div');
    ring.className = 'cursor-ring'; dot.className = 'cursor-dot';
    ring.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    root.classList.add('has-cursor');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
    const loop = () => {
      rx += (x - rx) * .18; ry += (y - ry) * .18;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > .1 ? requestAnimationFrame(loop) : 0;
    };
    addEventListener('pointermove', e => {
      x = e.clientX; y = e.clientY;
      dot.style.transform = `translate(${x}px,${y}px)`;
      root.classList.add('cursor-on');
      const hot = e.target.closest('a, button, summary, canvas');
      ring.classList.toggle('is-hot', !!hot && hot.tagName !== 'CANVAS');
      ring.classList.toggle('is-canvas', !!hot && hot.tagName === 'CANVAS');
      if (!raf) raf = requestAnimationFrame(loop);
    }, {passive: true});
    document.addEventListener('pointerleave', () => root.classList.remove('cursor-on'));
    addEventListener('pointerdown', () => ring.classList.add('is-down'));
    addEventListener('pointerup', () => ring.classList.remove('is-down'));
  }

  /* ---------- Card spotlight follows the pointer ---------- */
  if (finePointer.matches) {
    document.querySelectorAll('.card, .skills article').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }
})();
