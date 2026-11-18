/* Neural-brain background: a 3D wireframe brain of nodes + synapses with firing pulses.
   Pure Canvas 2D, no dependencies. Reacts to cursor and scroll; static when reduced motion is on. */
(() => {
  const cv = document.querySelector('.brain-bg');
  const ctx = cv && cv.getContext('2d');
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 700;

  // deterministic RNG so the brain looks the same on every load
  let seed = 11;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2831853 * rnd());

  // ---- build the brain: two cerebral hemispheres, cerebellum, brainstem ----
  const N = small ? 700 : 1500;
  const P = []; // [x, y, z]
  const add = (x, y, z) => P.push([x, y, z]);
  while (P.length < N * 0.8) {
    const s = rnd() < 0.5 ? -1 : 1;
    let dx = gauss(), dy = gauss(), dz = gauss();
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const surf = rnd() < 0.88 ? 1 : Math.cbrt(rnd()) * 0.86;           // mostly on the cortex surface
    const gyri = 1 + 0.075 * Math.sin(5 * dx + 3 * dy) * Math.sin(6 * dz + 2 * dy) + 0.05 * Math.sin(9 * dy + 7 * dz + s);
    let x = dx * 0.5 * surf * gyri, y = dy * 0.6 * surf * gyri, z = dz * 1.0 * surf * gyri;
    if (y < -0.18) y = -0.18 + (y + 0.18) * 0.5;                        // flatter underside
    if (y < -0.1 && y > -0.34 && z > -0.1 && z < 0.55) x += s * 0.07;  // temporal lobe bulge
    x += s * 0.29;
    if (x * s < 0.05) continue;                                         // longitudinal fissure
    add(x, y + 0.08, z);
  }
  const cbN = Math.round(N * 0.14);
  for (let i = 0; i < cbN; i++) {                                        // cerebellum, finely ridged
    let dx = gauss(), dy = gauss(), dz = gauss(); const l = Math.hypot(dx, dy, dz) || 1;
    const r = 0.95 + 0.06 * Math.sin(dy * 22);
    add(dx / l * 0.4 * r, -0.5 + dy / l * 0.2 * r, -0.74 + dz / l * 0.27 * r);
  }
  for (let i = 0; i < 26; i++) { const u = i / 25; add(Math.sin(u * 5) * 0.02, -0.36 - u * 0.62, -0.28 - u * 0.2); } // brainstem

  const n = P.length;
  // ---- synapses: connect each node to its nearest neighbours ----
  const adj = Array.from({ length: n }, () => []);
  const E = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    const d = [];
    for (let j = 0; j < n; j++) if (j !== i) {
      const dd = (P[i][0] - P[j][0]) ** 2 + (P[i][1] - P[j][1]) ** 2 + (P[i][2] - P[j][2]) ** 2;
      d.push([dd, j]);
    }
    d.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 4; k++) {
      const [dd, j] = d[k]; if (dd > 0.016) continue;
      const key = i < j ? i * n + j : j * n + i;
      if (seen.has(key)) continue; seen.add(key);
      E.push([i, j]); adj[i].push(E.length - 1); adj[j].push(E.length - 1);
    }
  }

  // ---- pulses (action potentials) travelling along synapses ----
  const glow = new Float32Array(n);
  const pulses = [];
  const spawn = () => { const e = (rnd() * E.length) | 0; pulses.push({ e, t: 0, dir: rnd() < 0.5 ? 1 : -1, v: 0.9 + rnd() * 1.1 }); };
  for (let i = 0; i < (small ? 14 : 30); i++) { spawn(); pulses[i].t = rnd(); }

  // ---- view state ----
  let W = 0, H = 0, dpr = 1, mx = 0, my = 0, tx = 0, ty = 0, t0 = performance.now(), last = t0;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) frame(performance.now());
  };
  addEventListener('resize', resize);
  if (!reduce) addEventListener('pointermove', e => { tx = e.clientX / W - 0.5; ty = e.clientY / H - 0.5; }, { passive: true });

  const px = new Float32Array(n), py = new Float32Array(n), pd = new Float32Array(n);
  const RED = '217,42,57';

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = reduce ? 3 : (now - t0) / 1000;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    const sy = scrollY;
    const fade = 1 - 0.68 * Math.min(1, sy / (H * 0.9));
    cv.style.opacity = fade.toFixed(3);

    const a = 1.25 + 0.5 * Math.sin(t * 0.16) + mx * 0.55 + sy * 0.0006;   // yaw: rocks around the side profile
    const b = -0.12 + my * 0.22 + 0.05 * Math.sin(t * 0.23);                // pitch
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const S = Math.min(W * (small ? 0.62 : 0.27), H * 0.5);
    const cx = W * (small ? 0.5 : 0.36) + mx * -24, cy = H * 0.5 + (sy * -0.05) + 10 * Math.sin(t * 0.5);
    const F = 3.4;                                                          // perspective distance

    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const x1 = p[0] * ca + p[2] * sa, z1 = -p[0] * sa + p[2] * ca;
      const y2 = p[1] * cb - z1 * sb, z2 = p[1] * sb + z1 * cb;
      const k = F / (F - z2);
      px[i] = cx + x1 * S * k; py[i] = cy - y2 * S * k; pd[i] = Math.max(0, Math.min(1, 0.5 + z2 * 0.5));
      if (glow[i] > 0) glow[i] = Math.max(0, glow[i] - dt * 1.4);
    }

    // synapses in three depth buckets (far -> near) to keep state changes low
    ctx.lineWidth = 1;
    for (let bkt = 0; bkt < 3; bkt++) {
      ctx.strokeStyle = `rgba(${RED},${[0.07, 0.15, 0.27][bkt]})`;
      ctx.beginPath();
      for (let i = 0; i < E.length; i++) {
        const [u, v] = E[i], d = (pd[u] + pd[v]) * 0.5;
        if ((d < 0.38 ? 0 : d < 0.62 ? 1 : 2) !== bkt) continue;
        ctx.moveTo(px[u], py[u]); ctx.lineTo(px[v], py[v]);
      }
      ctx.stroke();
    }

    // nodes
    for (let bkt = 0; bkt < 3; bkt++) {
      ctx.fillStyle = `rgba(${bkt === 2 ? '243,236,236' : RED},${[0.22, 0.45, 0.7][bkt]})`;
      const r = [0.9, 1.3, 1.8][bkt];
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if ((pd[i] < 0.38 ? 0 : pd[i] < 0.62 ? 1 : 2) !== bkt) continue;
        ctx.moveTo(px[i] + r, py[i]); ctx.arc(px[i], py[i], r, 0, 6.2832);
      }
      ctx.fill();
    }

    // firing pulses + glowing nodes
    for (const p of pulses) {
      if (!reduce) p.t += dt * p.v * 1.4;
      const [u0, v0] = E[p.e], from = p.dir > 0 ? u0 : v0, to = p.dir > 0 ? v0 : u0;
      if (p.t >= 1) {                                                       // arrived: fire the node, hop onward
        glow[to] = 1; p.t = 0;
        const opts = adj[to]; p.e = opts[(rnd() * opts.length) | 0];
        p.dir = E[p.e][0] === to ? 1 : -1;
        if (rnd() < 0.08) { p.e = (rnd() * E.length) | 0; p.dir = rnd() < 0.5 ? 1 : -1; }
        continue;
      }
      const x = px[from] + (px[to] - px[from]) * p.t, y = py[from] + (py[to] - py[from]) * p.t;
      const d = 0.4 + 0.6 * ((pd[from] + pd[to]) * 0.5);
      ctx.fillStyle = `rgba(${RED},${0.16 * d})`; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.fill();
      ctx.fillStyle = `rgba(255,214,218,${0.9 * d})`; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 6.2832); ctx.fill();
    }
    for (let i = 0; i < n; i++) if (glow[i] > 0.04) {
      const g = glow[i];
      ctx.fillStyle = `rgba(${RED},${0.3 * g})`; ctx.beginPath(); ctx.arc(px[i], py[i], 4 + 8 * g, 0, 6.2832); ctx.fill();
      ctx.fillStyle = `rgba(255,214,218,${0.85 * g})`; ctx.beginPath(); ctx.arc(px[i], py[i], 2.1, 0, 6.2832); ctx.fill();
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  if (!reduce) requestAnimationFrame(frame);
  else addEventListener('scroll', () => frame(performance.now()), { passive: true });
})();


