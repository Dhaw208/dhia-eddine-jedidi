// Progressive enhancement: every section remains visible without JavaScript.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.animate([
        {opacity: 0, transform: 'translateY(26px)'},
        {opacity: 1, transform: 'translateY(0)'}
      ], {duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)'});
      observer.unobserve(entry.target);
    }
  }, {threshold: .08});
  document.querySelectorAll('.section-heading, .card, .experience, .skills article, .education').forEach(el => observer.observe(el));
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      observer.disconnect();
      document.getAnimations().forEach(animation => animation.cancel());
    }
  });
}
