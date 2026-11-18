/* Demo video popup: opens the project's LinkedIn post in an embedded player.
   The iframe is created only on click, so LinkedIn loads nothing until the visitor asks for it. */
(() => {
  const modal = document.getElementById('demo-modal');
  if (!modal) return;
  const stage = modal.querySelector('.demo-stage'), title = modal.querySelector('#demo-title'), fallback = modal.querySelector('#demo-link');
  let opener = null;

  const close = () => {
    modal.hidden = true; stage.replaceChildren(); document.documentElement.classList.remove('demo-open-lock');
    if (opener) opener.focus(); opener = null;
  };
  const open = btn => {
    opener = btn;
    const f = document.createElement('iframe');
    f.src = btn.dataset.embed; f.title = `${btn.dataset.title} demo video`; f.allowFullscreen = true; f.loading = 'eager';
    f.setAttribute('allow', 'fullscreen; autoplay; picture-in-picture'); f.referrerPolicy = 'strict-origin-when-cross-origin';
    stage.replaceChildren(f);
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
      const f = [...modal.querySelectorAll('button, a[href], iframe')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
})();
