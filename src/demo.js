/* Demo video popup.
   - Plays the project's demo video natively when one is bundled (data-video), else LinkedIn's embedded post.
   - If the native video fails to load, it falls back to the LinkedIn embed.
   - On a project page, the button marked data-auto opens by itself once per browser session (muted, as browsers require). */
(() => {
  const modal = document.getElementById('demo-modal');
  if (!modal) return;
  const stage = modal.querySelector('.demo-stage'), title = modal.querySelector('#demo-title'), fallback = modal.querySelector('#demo-link');
  let opener = null;

  const embed = btn => {
    const f = document.createElement('iframe');
    f.src = btn.dataset.embed; f.title = `${btn.dataset.title} demo video`; f.allowFullscreen = true;
    f.setAttribute('allow', 'fullscreen; autoplay; picture-in-picture'); f.referrerPolicy = 'strict-origin-when-cross-origin';
    stage.replaceChildren(f);
  };
  const play = (btn, muted) => {
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.autoplay = true; v.muted = muted; v.preload = 'auto';
    if (btn.dataset.poster) v.poster = btn.dataset.poster;
    v.setAttribute('aria-label', `${btn.dataset.title} demo video`);
    v.src = btn.dataset.video;
    v.addEventListener('error', () => embed(btn), { once: true });
    stage.replaceChildren(v);
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });   // blocked with sound? retry muted
  };

  const close = () => {
    modal.hidden = true; stage.replaceChildren(); document.documentElement.classList.remove('demo-open-lock');
    if (opener) opener.focus(); opener = null;
  };
  const open = (btn, auto = false) => {
    opener = btn;
    btn.dataset.video ? play(btn, auto) : embed(btn);
    title.textContent = `${btn.dataset.title} — live demo`; fallback.href = btn.dataset.href;
    modal.hidden = false; document.documentElement.classList.add('demo-open-lock');
    modal.querySelector('.demo-close').focus();
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('.demo-open');
    if (b) { e.preventDefault(); open(b); return; }
    if (!modal.hidden && e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {                                  // keep focus inside the popup
      const f = [...modal.querySelectorAll('button, a[href], iframe, video')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Auto-open when a visitor lands on the project page (once per session so it never nags).
  const auto = document.querySelector('.demo-open[data-auto]');
  if (auto) {
    let seen = false; const key = `demo-seen:${location.pathname}`;
    try { seen = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch (_) {}
    if (!seen && !matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(() => open(auto, true), 700);
  }
})();
