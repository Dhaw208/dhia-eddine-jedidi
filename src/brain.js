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

  // ---- robot arm: built like the brain (nodes joined by synapses, with pulses), reaching in from the right ----
  // One-time topology: arm+palm is a 4-wide mesh of stations, the index finger a 3-wide mesh, plus thumb and curled-finger stubs.
  const ARM_K = 4, ARM_M = [9, 8, 4], ARM_S = ARM_M[0] + ARM_M[1] + ARM_M[2] + 1;     // stations along shoulder -> elbow -> wrist -> palm
  const FIN_K = 3, FIN_S = 7;
  const aIdx = (j, c) => j * ARM_K + c;
  const fBase = ARM_S * ARM_K, fIdx = (j, c) => fBase + j * FIN_K + c;
  const thumbB = fBase + FIN_S * FIN_K, curlB = thumbB + 3, AN = curlB + 3;
  const AE = [];                                     // [a, b, outline?]
  const lnk = (a, b, o = 0) => AE.push([a, b, o]);
  const mesh = (M, K, idx) => {
    for (let j = 0; j < M; j++) for (let c = 0; c < K; c++) {
      if (j + 1 < M) lnk(idx(j, c), idx(j + 1, c), c === 0 || c === K - 1 ? 1 : 0);
      if (c + 1 < K) lnk(idx(j, c), idx(j, c + 1));
      if (j + 1 < M && c + 1 < K) (j + c) % 2 ? lnk(idx(j, c), idx(j + 1, c + 1)) : lnk(idx(j, c + 1), idx(j + 1, c));
    }
  };
  mesh(ARM_S, ARM_K, aIdx); mesh(FIN_S, FIN_K, fIdx);
  const pj = ARM_S - 1;                              // palm-front station: the finger, thumb and curled fingers grow out of it
  lnk(fIdx(0, 0), aIdx(pj, 0), 1); lnk(fIdx(0, 1), aIdx(pj, 1)); lnk(fIdx(0, 2), aIdx(pj, 2)); lnk(fIdx(0, 1), aIdx(pj, 0)); lnk(fIdx(0, 2), aIdx(pj, 1));
  lnk(thumbB, aIdx(pj - 3, 0), 1); lnk(thumbB, aIdx(pj - 2, 0)); lnk(thumbB, aIdx(pj - 2, 1)); lnk(thumbB, thumbB + 1, 1); lnk(thumbB + 1, thumbB + 2, 1); lnk(thumbB + 1, aIdx(pj - 2, 0));
  for (let k = 0; k < 3; k++) { lnk(aIdx(pj, k + 1), curlB + k, 1); lnk(aIdx(pj - 1, k + 1), curlB + k); }
  const aAdj = Array.from({ length: AN }, () => []);
  for (const [a, b] of AE) { aAdj[a].push(b); aAdj[b].push(a); }
  const TIP = fIdx(FIN_S - 1, 1);                    // fingertip node
  const aDist = new Int16Array(AN).fill(-1); aDist[TIP] = 0;                          // hops to the fingertip, so pulses can flow towards it
  for (let q = [TIP], h = 0; h < q.length; h++) for (const b of aAdj[q[h]]) if (aDist[b] < 0) { aDist[b] = aDist[q[h]] + 1; q.push(b); }
  const startNodes = []; for (let j = 0; j < 5; j++) for (let c = 0; c < ARM_K; c++) startNodes.push(aIdx(j, c));   // pulses are born at the shoulder end
  const jit = new Float32Array(AN * 2); for (let i = 0; i < jit.length; i++) jit[i] = (rnd() - 0.5) * 0.018;   // a little organic irregularity
  const AX = new Float32Array(AN), AY = new Float32Array(AN), aGlow = new Float32Array(AN);
  const aPulses = [];
  const nextHop = a => { const o = aAdj[a].filter(b => aDist[b] < aDist[a]); return o.length ? o[(rnd() * o.length) | 0] : a; };
  for (let i = 0; i < (small ? 5 : 9); i++) { const a = startNodes[(rnd() * startNodes.length) | 0]; aPulses.push({ a: nextHop(a), b: nextHop(nextHop(a)), t: rnd(), v: 5 + rnd() * 2.5 }); }
  const WS = [-1, -0.33, 0.33, 1], WF = [-1, 0, 1];

  const cerebN = n - cbN - 26;                       // cerebrum nodes come first in P
  let tgt = 0, best = -9;                            // contact point on the brain: the frontal pole, mid-height
  for (let i = 0; i < cerebN; i++) { const sc = P[i][2] - Math.abs(P[i][1] - 0.1) * 1.4; if (sc > best) { best = sc; tgt = i; } }
  let lastCycle = -1, tapT = -9, bridgeT = -9, tipGlow = 0;
  const dot = (x, y, r, fill, edge, lw = 1.4) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = lw; ctx.stroke(); } };

  function zap(k) {                                  // a tap fires the neurons under the fingertip
    const near = [];
    for (let i = 0; i < n; i++) if (Math.hypot(px[i] - px[tgt], py[i] - py[tgt]) < 95 * k) { near.push(i); glow[i] = 1; }
    for (let q = 0; q < Math.min(8, near.length, pulses.length); q++) {
      const i = near[(rnd() * near.length) | 0]; if (!adj[i].length) continue;
      const e = adj[i][(rnd() * adj[i].length) | 0];
      Object.assign(pulses[q], { e, t: 0, dir: E[e][0] === i ? 1 : -1, v: 1.6 + rnd() });
    }
  }

  // places a mesh's stations: centres C (array of [x,y]), radii R, widths W -> writes node positions through put()
  const lay = (C, R, W, put) => {
    for (let i = 0; i < C.length; i++) {
      const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)];
      const tx_ = b[0] - a[0], ty_ = b[1] - a[1], m = Math.hypot(tx_, ty_) || 1, ux_ = tx_ / m, uy_ = ty_ / m;
      for (let c = 0; c < W.length; c++) put(i, c, C[i][0] - uy_ * W[c] * R[i], C[i][1] + ux_ * W[c] * R[i], ux_, uy_);
    }
  };

  function drawRobot(t, dt, S, cx, cy, alpha) {
    if (alpha < 0.02) return;
    const k = S / 390, SR = S * 0.012;
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const th = Math.atan2(-0.1, -1) + 0.035 * Math.sin(t * 0.7);          // the finger points left, slightly up
    const ux = Math.cos(th), uy = Math.sin(th), nx = uy, ny = -ux;       // u = along the finger, n = towards the palm (down)
    const cyc = reduce ? 0 : t / 2.6, ph = cyc - Math.floor(cyc);
    const press = reduce ? 0 : Math.pow(0.5 - 0.5 * Math.cos(ph * 6.2832), 1.6);   // 0 = touching, 1 = lifted
    if (!reduce && Math.floor(cyc) !== lastCycle) { lastCycle = Math.floor(cyc); tapT = t; zap(k); }
    const rt = 0.02 * S, off = rt * 0.4 + (1 + 24 * press) * k;
    const Fx = px[tgt] - ux * off, Fy = py[tgt] - uy * off;               // fingertip

    // index finger polyline, built backwards from the tip so it always lands on the brain
    const L = [0.1 * S, 0.09 * S, 0.08 * S], bend = [0, 0.06, 0.14];
    const pts = [[Fx, Fy]];
    for (let i = 2; i >= 0; i--) { const a = th + bend[i], q = pts[pts.length - 1]; pts.push([q[0] - Math.cos(a) * L[i], q[1] - Math.sin(a) * L[i]]); }
    pts.reverse();                                                         // knuckle -> tip
    const Qx = pts[0][0] + nx * 0.055 * S, Qy = pts[0][1] + ny * 0.055 * S;   // palm front
    const Lp = 0.2 * S, wx = Qx - ux * Lp, wy = Qy - uy * Lp;             // wrist

    // two-bone arm from a shoulder far off-screen to the right
    const sx = cx + 2.7 * S, sy0 = cy + 0.25 * S + 8 * k * Math.sin(t * 0.6);
    const A1 = 0.85 * S, A2 = 0.8 * S;
    let dx = wx - sx, dy = wy - sy0, m = Math.hypot(dx, dy) || 1, d = Math.max(Math.min(m, A1 + A2 - 1), Math.abs(A1 - A2) + 1);
    const al = (A1 * A1 - A2 * A2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A1 * A1 - al * al));
    const bx = sx + dx / m * al, by = sy0 + dy / m * al;
    let ex = bx - dy / m * h, ey = by + dx / m * h;
    if (ey < by) { ex = bx + dy / m * h; ey = by - dx / m * h; }          // elbow hangs below the line

    // ---- node positions ----
    const lerp = (a, b, f) => a + (b - a) * f;
    const C = [], R = [], bones = [[sx, sy0, ex, ey], [ex, ey, wx, wy], [wx, wy, Qx, Qy]];
    const rad = [[0.070, 0.078], [0.088, 0.056], [0.072, 0.088]];        // radius range per bone (in S); the elbow station bulges
    bones.forEach((b, bi) => { for (let j = 0; j < ARM_M[bi]; j++) { const f = j / ARM_M[bi]; C.push([lerp(b[0], b[2], f), lerp(b[1], b[3], f)]); R.push(S * (bi === 1 && j > 0 ? lerp(0.066, rad[1][1], f) : lerp(rad[bi][0], rad[bi][1], bi === 1 ? 0 : f))); } });
    C.push([Qx, Qy]); R.push(0.088 * S);
    lay(C, R, WS, (i, c, x, y) => { const id = aIdx(i, c); AX[id] = x + jit[id * 2] * S; AY[id] = y + jit[id * 2 + 1] * S; });

    const FC = [], FR = [];
    for (let s = 0; s < FIN_S; s++) {
      const seg = (s / (FIN_S - 1)) * 3, i = Math.min(2, Math.floor(seg)), f = seg - i;
      FC.push([lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]); FR.push(S * lerp(0.03, 0.019, s / (FIN_S - 1)));
    }
    lay(FC, FR, WF, (i, c, x, y) => { const id = fIdx(i, c), tip = i === FIN_S - 1 && c === 1; AX[id] = x + (tip ? 0 : jit[id * 2] * S); AY[id] = y + (tip ? 0 : jit[id * 2 + 1] * S); });
    const tb = [wx + ux * 0.06 * S - nx * 0.07 * S, wy + uy * 0.06 * S - ny * 0.07 * S], tt = [wx + ux * 0.15 * S - nx * 0.13 * S, wy + uy * 0.15 * S - ny * 0.13 * S];
    [[tb[0], tb[1]], [(tb[0] + tt[0]) / 2, (tb[1] + tt[1]) / 2], [tt[0], tt[1]]].forEach((p, i) => { AX[thumbB + i] = p[0]; AY[thumbB + i] = p[1]; });
    for (let c = 0; c < 3; c++) { const a = aIdx(pj, c + 1); AX[curlB + c] = AX[a] + ux * 0.05 * S + nx * 0.03 * S; AY[curlB + c] = AY[a] + uy * 0.05 * S + ny * 0.03 * S; }

    // ---- synapses: soft inner mesh, brighter outline ----
    for (let i = 0; i < AN; i++) if (aGlow[i] > 0) aGlow[i] = Math.max(0, aGlow[i] - dt * 1.6);
    for (const [o, col, lw] of [[0, `rgba(${RED},.4)`, 1], [1, `rgba(${RED},.85)`, 1.7]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (const e of AE) if (e[2] === o) { ctx.moveTo(AX[e[0]], AY[e[0]]); ctx.lineTo(AX[e[1]], AY[e[1]]); }
      ctx.stroke();
    }
    // ---- nodes ----
    ctx.fillStyle = 'rgba(243,236,236,.85)'; ctx.beginPath();
    for (let i = 0; i < AN; i++) { ctx.moveTo(AX[i] + 1.9, AY[i]); ctx.arc(AX[i], AY[i], 1.9, 0, 6.2832); }
    ctx.fill();
    // mechanical joints: ring + blinking LED at the elbow, wrist and finger knuckles
    const ring = (x, y, r) => { dot(x, y, r, null, `rgba(${RED},.9)`, 1.4); dot(x, y, r * 0.55, null, `rgba(${RED},.45)`, 1); dot(x, y, Math.max(2, r * 0.2), `rgba(255,214,218,${0.65 + 0.35 * Math.sin(t * 3 + x)})`); };
    ring(ex, ey, 0.092 * S); ring(wx, wy, 0.07 * S); ring(pts[1][0], pts[1][1], 0.03 * S); ring(pts[2][0], pts[2][1], 0.027 * S);

    // ---- pulses flowing along the arm towards the fingertip ----
    let arrived = false;
    for (const p of aPulses) {
      if (!reduce) p.t += dt * p.v;
      while (p.t >= 1) {
        p.t -= 1; aGlow[p.b] = 1; p.a = p.b;
        if (p.a === TIP) { arrived = true; tipGlow = 1; const s0 = startNodes[(rnd() * startNodes.length) | 0]; p.a = s0; p.b = nextHop(s0); }
        else p.b = nextHop(p.a);
        if (p.a === p.b) { const s0 = startNodes[(rnd() * startNodes.length) | 0]; p.a = s0; p.b = nextHop(s0); }
      }
      const x = AX[p.a] + (AX[p.b] - AX[p.a]) * p.t, y = AY[p.a] + (AY[p.b] - AY[p.a]) * p.t;
      dot(x, y, 7, `rgba(${RED},.2)`); dot(x, y, 2, 'rgba(255,214,218,.95)');
    }
    for (let i = 0; i < AN; i++) if (aGlow[i] > 0.04) { const g = aGlow[i]; dot(AX[i], AY[i], 3 + 6 * g, `rgba(${RED},${0.3 * g})`); dot(AX[i], AY[i], 2.2, `rgba(255,214,218,${0.85 * g})`); }
    if (arrived && bridgeT < 0) bridgeT = t;                              // energy leaves the fingertip and crosses into the brain

    // ---- the fingertip joins the brain's network: synapses to the nearest brain neurons ----
    tipGlow = Math.max(0, tipGlow - dt * 1.4);
    const near = [];
    for (let i = 0; i < n; i++) { const dd = Math.hypot(px[i] - Fx, py[i] - Fy); if (dd < 70 * k) near.push([dd, i]); }
    near.sort((a, b) => a[0] - b[0]);
    const link = 0.45 + 0.4 * (1 - press) + 0.4 * tipGlow;
    ctx.strokeStyle = `rgba(255,214,218,${Math.min(0.95, link)})`; ctx.lineWidth = 1.2; ctx.beginPath();
    for (const [, i] of near.slice(0, 4)) { ctx.moveTo(Fx, Fy); ctx.lineTo(px[i], py[i]); }
    ctx.stroke();
    dot(Fx, Fy, 3 + 4 * tipGlow, `rgba(${RED},${0.35 + 0.4 * tipGlow})`); dot(Fx, Fy, 2.4, 'rgba(255,230,232,.95)');
    if (bridgeT >= 0) {
      const f = (t - bridgeT) / 0.3;
      if (f >= 1) { bridgeT = -9; glow[tgt] = 1; const e = adj[tgt][(rnd() * adj[tgt].length) | 0]; if (e !== undefined) Object.assign(pulses[0], { e, t: 0, dir: E[e][0] === tgt ? 1 : -1, v: 2 }); }
      else { const x = Fx + (px[tgt] - Fx) * f, y = Fy + (py[tgt] - Fy) * f; dot(x, y, 8, `rgba(${RED},.25)`); dot(x, y, 2.2, 'rgba(255,230,232,1)'); }
    }

    // ---- contact spark + shock ring on every tap ----
    const age = t - tapT;
    const g = ctx.createRadialGradient(px[tgt], py[tgt], 0, px[tgt], py[tgt], 26 * k);
    g.addColorStop(0, `rgba(255,214,218,${0.7 * (1 - press)})`); g.addColorStop(1, 'rgba(217,42,57,0)');
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
    drawRobot(t, reduce ? 0 : dt, S, cx, cy, robotFade);
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  if (!reduce) requestAnimationFrame(frame);
  else addEventListener('scroll', () => frame(performance.now()), { passive: true });
})();



