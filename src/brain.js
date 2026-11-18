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

  // ---- robot arm: reaches in from the right and touches the frontal lobe with a single finger ----
  const FILL = '#1a0d11', EDGE = '#d92a39';
  const cerebN = n - cbN - 26;                       // cerebrum nodes come first in P
  let tgt = 0, best = -9;                            // contact point: the frontal pole, mid-height
  for (let i = 0; i < cerebN; i++) { const sc = P[i][2] - Math.abs(P[i][1] - 0.1) * 1.4; if (sc > best) { best = sc; tgt = i; } }
  let lastCycle = -1, tapT = -9;
  const stroke = (ax, ay, bx, by, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
  const cap = (ax, ay, bx, by, r) => { ctx.lineCap = 'round'; stroke(ax, ay, bx, by, 2 * r + 2, EDGE); stroke(ax, ay, bx, by, 2 * r, FILL); };
  const dot = (x, y, r, fill, edge) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = fill; ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.stroke(); } };
  const joint = (x, y, r, t) => {
    dot(x, y, r, FILL, EDGE); dot(x, y, r * 0.5, '#2a1218', 'rgba(217,42,57,.6)');
    dot(x, y, r * 0.2, `rgba(255,214,218,${0.65 + 0.35 * Math.sin(t * 3 + x)})`);   // blinking LED
  };

  function zap(k) {                                  // a tap fires the neurons under the fingertip
    const near = [];
    for (let i = 0; i < n; i++) if (Math.hypot(px[i] - px[tgt], py[i] - py[tgt]) < 95 * k) { near.push(i); glow[i] = 1; }
    for (let q = 0; q < Math.min(8, near.length, pulses.length); q++) {
      const i = near[(rnd() * near.length) | 0]; if (!adj[i].length) continue;
      const e = adj[i][(rnd() * adj[i].length) | 0];
      Object.assign(pulses[q], { e, t: 0, dir: E[e][0] === i ? 1 : -1, v: 1.6 + rnd() });
    }
  }

  function drawRobot(t, S, cx, cy, alpha) {
    if (alpha < 0.02) return;
    const k = S / 390;
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round';
    const th = Math.atan2(-0.1, -1) + 0.035 * Math.sin(t * 0.7);          // the finger points left, slightly up
    const ux = Math.cos(th), uy = Math.sin(th), nx = uy, ny = -ux;       // u = along finger, n = towards palm side (down)
    const cyc = reduce ? 0 : t / 2.6, ph = cyc - Math.floor(cyc);
    const press = reduce ? 0 : Math.pow(0.5 - 0.5 * Math.cos(ph * 6.2832), 1.6);   // 0 = touching, 1 = lifted
    if (!reduce && Math.floor(cyc) !== lastCycle) { lastCycle = Math.floor(cyc); tapT = t; zap(k); }
    const rt = 0.02 * S, off = rt + (1 + 24 * press) * k;
    const Fx = px[tgt] - ux * off, Fy = py[tgt] - uy * off;               // fingertip

    // index finger, built backwards from the tip so it always lands on the brain
    const L = [0.1 * S, 0.09 * S, 0.08 * S], R = [0.028 * S, 0.025 * S, 0.022 * S], bend = [0, 0.06, 0.14];
    const pts = [[Fx, Fy]];
    for (let i = 2; i >= 0; i--) { const a = th + bend[i], q = pts[pts.length - 1]; pts.push([q[0] - Math.cos(a) * L[i], q[1] - Math.sin(a) * L[i]]); }
    pts.reverse();                                                         // knuckle -> tip
    const Qx = pts[0][0] + nx * 0.055 * S, Qy = pts[0][1] + ny * 0.055 * S;   // palm front
    const Lp = 0.2 * S, wx = Qx - ux * Lp, wy = Qy - uy * Lp;             // wrist

    // two-bone arm from a shoulder far off-screen to the right
    const sx = cx + 2.7 * S, sy0 = cy + 0.25 * S + 8 * k * Math.sin(t * 0.6);
    const A1 = 0.85 * S, A2 = 0.8 * S;
    let dx = wx - sx, dy = wy - sy0, d = Math.min(Math.hypot(dx, dy), A1 + A2 - 1); d = Math.max(d, Math.abs(A1 - A2) + 1);
    const al = (A1 * A1 - A2 * A2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A1 * A1 - al * al)), m = Math.hypot(dx, dy) || 1;
    const bx = sx + dx / m * al, by = sy0 + dy / m * al;
    let ex = bx - dy / m * h, ey = by + dx / m * h;
    if (ey < by) { ex = bx + dy / m * h; ey = by - dx / m * h; }          // elbow hangs below the line

    // upper arm, forearm (with panel seams), elbow
    cap(sx, sy0, ex, ey, 0.075 * S); cap(ex, ey, wx, wy, 0.062 * S);
    const fl = Math.hypot(wx - ex, wy - ey) || 1, fx = (wx - ex) / fl, fy = (wy - ey) / fl;
    for (const s of [0.28, 0.5, 0.72]) {
      const mx0 = ex + (wx - ex) * s, my0 = ey + (wy - ey) * s, r = 0.062 * S;
      stroke(mx0 - fy * r, my0 + fx * r, mx0 + fy * r, my0 - fx * r, 1.2, 'rgba(217,42,57,.55)');
    }
    stroke(ex - fy * 0.03 * S, ey + fx * 0.03 * S, wx - fy * 0.03 * S, wy + fx * 0.03 * S, Math.max(1, 0.012 * S), 'rgba(255,230,232,.2)');
    joint(ex, ey, 0.09 * S, t);

    // hand: palm, thumb, three curled fingers, extended index finger
    cap(wx, wy, Qx, Qy, 0.085 * S);
    cap(wx + ux * 0.06 * S - nx * 0.07 * S, wy + uy * 0.06 * S - ny * 0.07 * S, wx + ux * 0.15 * S - nx * 0.13 * S, wy + uy * 0.15 * S - ny * 0.13 * S, 0.03 * S);
    for (const o of [0.005, 0.05, 0.088]) {
      const kx = Qx + nx * o * S, ky = Qy + ny * o * S;
      cap(kx, ky, kx + ux * 0.04 * S + nx * 0.02 * S, ky + uy * 0.04 * S + ny * 0.02 * S, 0.03 * S);
    }
    for (let i = 0; i < 3; i++) cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], R[i]);
    for (let i = 0; i < 3; i++) dot(pts[i][0], pts[i][1], R[i] * 0.55, '#2a1218', 'rgba(217,42,57,.7)');
    dot(Fx, Fy, rt * 0.55, 'rgba(255,214,218,.9)');                       // glowing fingertip sensor
    joint(wx, wy, 0.07 * S, t);

    // contact spark + shock ring on every tap
    const age = t - tapT;
    const g = ctx.createRadialGradient(px[tgt], py[tgt], 0, px[tgt], py[tgt], 26 * k);
    g.addColorStop(0, `rgba(255,214,218,${0.75 * (1 - press)})`); g.addColorStop(1, 'rgba(217,42,57,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px[tgt], py[tgt], 26 * k, 0, 6.2832); ctx.fill();
    if (age >= 0 && age < 1) {
      ctx.strokeStyle = `rgba(${RED},${0.7 * (1 - age)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px[tgt], py[tgt], 10 + age * 190 * k, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = reduce ? 3 : (now - t0) / 1000;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    const sy = scrollY;
    const fade = 0.62 * (1 - 0.6 * Math.min(1, sy / (H * 0.9)));
    const robotFade = 0.95 * (1 - Math.min(1, sy / (H * 0.55)));          // the arm leaves as you scroll past the hero

    const a = 1.25 + 0.5 * Math.sin(t * 0.16) + mx * 0.55 + sy * 0.0006;   // yaw: rocks around the side profile
    const b = -0.12 + my * 0.22 + 0.05 * Math.sin(t * 0.23);                // pitch
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const S = Math.min(W * (small ? 0.34 : 0.27), H * 0.5);
    const cx = W * (small ? 0.36 : 0.5) + mx * -24, cy = H * 0.5 + (sy * -0.05) + 10 * Math.sin(t * 0.5);
    const F = 3.4;                                                          // perspective distance

    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = fade;                                                 // brain opacity (was a CSS opacity on the canvas)
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
    ctx.globalAlpha = 1;
    drawRobot(t, S, cx, cy, robotFade);
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  if (!reduce) requestAnimationFrame(frame);
  else addEventListener('scroll', () => frame(performance.now()), { passive: true });
})();



