import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  AI ENGINEER — particle bust portfolio hero
 *  World units == pixels of the original 1672x941 portrait (centre = 0,0, y up).
 * ------------------------------------------------------------------ */
const MAN = window.__MANIFEST || { bin: 858064, png: 1595525, font: 14152 };
const BASE = window.__HERO_BASE || 'assets/';       // where bust_particles.bin / portrait_cutout.png / anton-subset.woff live
const EMB = window.__EMBED || null;               // standalone build: assets embedded as base64
const $ = (s) => document.querySelector(s);
const canvas = $('#gl'), host = canvas.parentElement, loaderEl = $('#loader'), pctEl = $('#pct'), arcEl = $('#arc'), btn = $('#btn');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RAD = Math.PI / 180;

const CRIMSON = new THREE.Vector3(0.64, 0.035, 0.055);
const REVEAL_BAND_SECONDS = 1.8;                   // light band top -> bottom (fast)
const U_BAND_END = 0.7;                            // fraction of u at which the band exits the bottom
const U_SECONDS = REVEAL_BAND_SECONDS / U_BAND_END; // 5.14 s of u-time
const PRE_ROLL = 0.3;                              // head turns forward before the band starts
const REVEAL_TOTAL = PRE_ROLL + U_SECONDS;
const Y_TOP = 450, Y_BOT = -490;                   // band travel range (world y)

/* ============================ LOADER ============================== */
// Progress = real bytes received / real total bytes. Standalone build decodes embedded
// base64 in chunks and reports real decoded bytes; the hosted build streams via fetch().
async function streamFetch(url, done) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  const reader = res.body.getReader(); const parts = []; let n = 0;
  for (;;) { const { done: d, value } = await reader.read(); if (d) break; parts.push(value); n += value.length; done(value.length); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function decodeEmbedded(b64, done) {
  const CH = 3 * 32768 * 4 / 3 | 0;                // 96 KiB of base64 per slice (multiple of 4)
  const total = Math.floor(b64.length / 4) * 3 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  const out = new Uint8Array(total); let o = 0;
  for (let i = 0; i < b64.length; i += CH) {
    const bin = atob(b64.slice(i, i + CH));
    for (let k = 0; k < bin.length; k++) out[o + k] = bin.charCodeAt(k);
    o += bin.length; done(bin.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}
let shownPct = 0;
function setProgress(f) {
  const p = Math.min(100, Math.floor(f * 100));
  if (p <= shownPct && p !== 0) return; shownPct = Math.max(shownPct, p);
  pctEl.textContent = shownPct + '%';
  arcEl.style.strokeDashoffset = String(100 - shownPct);
}
async function loadAssets() {
  const total = MAN.bin + MAN.png + MAN.font; let got = 0;
  const tick = (n) => { got += n; setProgress(got / total); };
  const get = (key, url) => EMB ? decodeEmbedded(EMB[key], tick) : streamFetch(url, tick);
  const [bin, png, font] = await Promise.all([
    get('bin', BASE + 'bust_particles.bin'), get('png', BASE + 'portrait_cutout.png'), get('font', BASE + 'anton-subset.woff')]);
  setProgress(1);
  return { bin, png, font };
}

/* ========================= PARTICLE DATA ========================== */
function parseBust(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (String.fromCharCode(...u8.subarray(0, 4)) !== 'PRT1') throw new Error('bad particle file');
  const N = dv.getUint32(4, true);
  const h = { N, step: dv.getFloat32(8, true), pw: dv.getFloat32(12, true), ph: dv.getFloat32(16, true),
    pivot: [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)],
    neck0: dv.getFloat32(36, true), neck1: dv.getFloat32(40, true) };
  let o = 64; const base = u8.byteOffset;
  const px = new Int16Array(u8.buffer.slice(base + o, base + o + 2 * N)); o += 2 * N;
  const py = new Int16Array(u8.buffer.slice(base + o, base + o + 2 * N)); o += 2 * N;
  const pz = new Int16Array(u8.buffer.slice(base + o, base + o + 2 * N)); o += 2 * N;
  const nx = u8.subarray(o, o + N); o += N; const ny = u8.subarray(o, o + N); o += N; const nz = u8.subarray(o, o + N); o += N;
  const rnd = u8.subarray(o, o + N); o += N; const br = u8.subarray(o, o + N);
  const pos = new Int16Array(N * 3), nrm = new Int8Array(N * 4), ab = new Uint8Array(N * 2);
  for (let i = 0; i < N; i++) {
    pos[3 * i] = px[i]; pos[3 * i + 1] = py[i]; pos[3 * i + 2] = pz[i];
    nrm[4 * i] = (nx[i] << 24) >> 24; nrm[4 * i + 1] = (ny[i] << 24) >> 24; nrm[4 * i + 2] = (nz[i] << 24) >> 24;
    ab[2 * i] = rnd[i]; ab[2 * i + 1] = br[i];
  }
  return { h, pos, nrm, ab };
}

/* ============================ SHADERS ============================= */
const HASH = /* glsl */`
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float rnd(uint id, uint salt){ return float(pcg(id*2654435761u ^ (salt*374761393u+1013904223u)))*(1.0/4294967295.0); }
`;

const PARTICLE_VS = /* glsl */`
precision highp float;
uniform float uBase, uK, uGam;
uniform float uStep, uTime, uIntro, uRingR, uPx, uSize, uYaw, uPitch, uFollow, uCursorAmp, uCursorR;
uniform float uBandY, uBandAmp, uU, uYTop, uYBot, uDust;
uniform vec3 uPivot, uCursor;
uniform float uCamY;
uniform vec2 uNeckY, uPhotoSize;
uniform sampler2D uPhoto;
attribute vec4 nrm;       // int8 normalised
attribute vec2 ab;        // uint8 normalised: x = random, y = brightness
varying vec3 vColor; varying float vAlpha, vCover;
${HASH}
vec3 rot(vec3 p, float yaw, float pitch, vec3 pv){
  p -= pv;
  float cy=cos(yaw), sy=sin(yaw); p = vec3(cy*p.x+sy*p.z, p.y, -sy*p.x+cy*p.z);
  float cp=cos(pitch), sp=sin(pitch); p = vec3(p.x, cp*p.y-sp*p.z, sp*p.y+cp*p.z);
  return p+pv;
}
vec3 rotN(vec3 n, float yaw, float pitch){ return rot(n, yaw, pitch, vec3(0.0)); }
void main(){
  uint id = uint(gl_VertexID);
  float r1=rnd(id,1u), r2=rnd(id,2u), r3=rnd(id,3u), r4=rnd(id,4u), r5=rnd(id,5u), r6=rnd(id,6u);
  vec3 P = position * uStep;
  vec3 N = normalize(nrm.xyz + 1e-5);
  float bright = ab.y;

  // --- head / shoulder rotation weights (shoulders follow slightly) ---
  float wHead = smoothstep(uNeckY.y, uNeckY.x, P.y);
  float w = mix(uFollow, 1.0, wHead);
  float yaw = uYaw*w, pitch = uPitch*mix(uFollow*0.6, 1.0, wHead);
  vec3 R = rot(P, yaw, pitch, uPivot);
  vec3 Nr = normalize(rotN(N, yaw, pitch));

  // --- intro: leave the loading ring, fly into place ---
  float ang = r1*6.2831853;
  vec3 ringP = vec3(cos(ang), sin(ang), 0.0) * (uRingR + (r2-0.5)*uRingR*0.06) + vec3(0.0, uCamY, 0.0);
  float delay = r3*0.40 + (1.0-clamp((P.y+280.0)/720.0,0.0,1.0))*0.14;
  float e = clamp((uIntro-delay)/0.46, 0.0, 1.0); e = e*e*e*(e*(e*6.0-15.0)+10.0);
  vec3 swirl = (vec3(r4,r5,r6)-0.5) * vec3(640.0,640.0,0.0) * sin(3.14159*e);
  vec3 pos = mix(ringP, R, e) + swirl;

  // --- reveal: band sweep flattens particles onto the portrait ---
  float hitT = clamp((uYTop-P.y)/(uYTop-uYBot), 0.0, 1.0);
  float local = clamp((uU - hitT*${U_BAND_END.toFixed(2)})/${(1 - U_BAND_END).toFixed(2)}, 0.0, 1.0);
  float f1 = smoothstep(0.0, 0.6, local), f2 = smoothstep(0.45, 1.0, local);
  pos.xy += (vec2(r4,r5)-0.5) * 14.0 * sin(3.14159*local);
  Nr = normalize(mix(Nr, vec3(0.0,0.0,1.0), f1));

  // --- lighting: uniform base, subtle key + rim, cursor light, sweep band ---
  float facing = clamp(Nr.z, -1.0, 1.0);
  float key = max(dot(Nr, normalize(vec3(-0.55, 0.60, 0.65))), 0.0);
  float rim = pow(clamp(1.0-facing, 0.0, 1.0), 2.6) * smoothstep(-0.1, 0.8, dot(Nr, normalize(vec3(0.85, 0.25, -0.2)))*0.5+0.5);
  float I = (uBase + uK*pow(bright, uGam)) * (0.80 + 0.30*key) + 0.22*rim;
  I *= mix(0.22, 1.0, smoothstep(0.0, 0.75, facing));      // compensate projected density at grazing angles / ledges
  vec2 dc = pos.xy - uCursor.xy;
  float cur = uCursorAmp * exp(-dot(dc,dc)/(2.0*uCursorR*uCursorR)) * (0.40 + 0.60*max(facing,0.0));
  float bd = uBandAmp * exp(-pow((pos.y-uBandY)/42.0, 2.0));
  I += 2.1*cur + 1.15*bd;
  I *= mix(0.42, 1.0, e);                                 // dim while still on the ring

  float sz = (4.8 + 3.6*pow(r6, 1.7)) * uSize;
  sz *= 1.0 + 0.55*cur + 0.35*bd;
  gl_PointSize = max(sz*uPx, 1.3);

  vec3 col = CRIMSON_BASE * I;
  vec2 puv = vec2((P.x + uPhotoSize.x*0.5)/uPhotoSize.x, 1.0-(P.y+uPhotoSize.y*0.5)/uPhotoSize.y);
  vec3 pc = textureLod(uPhoto, puv, 0.0).rgb;
  col = mix(col, pc*1.05, smoothstep(0.0, 0.5, local));
  vColor = col;
  float ringFade = mix(0.007, 1.0, smoothstep(0.0, 0.5, e));   // 78k particles stacked on the ring would blow out: keep it dark crimson
  vAlpha = (1.0 - f2) * ringFade;
  vCover = smoothstep(0.75, 1.0, e);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`.replace('CRIMSON_BASE', `vec3(${CRIMSON.x},${CRIMSON.y},${CRIMSON.z})`);

const PARTICLE_FS = /* glsl */`
precision highp float;
varying vec3 vColor; varying float vAlpha, vCover;
uniform float uGain;
void main(){
  vec2 q = gl_PointCoord*2.0-1.0; float d2 = dot(q,q);
  if(d2>1.0) discard;
  float a = exp(-d2*3.2) * smoothstep(1.0, 0.7, d2);
  gl_FragColor = vec4(vColor*uGain*a*vAlpha, a*vAlpha*vCover);   // premultiplied colour; alpha channel accumulates settled-particle coverage
}`;

const DUST_VS = /* glsl */`
precision highp float;
uniform float uTime, uPx, uDust, uCamY; uniform vec2 uView;
varying float vA;
${HASH}
void main(){
  uint id = uint(gl_VertexID);
  float a=rnd(id,11u), b=rnd(id,12u), c=rnd(id,13u), d=rnd(id,14u);
  float t = uTime*(0.012+0.02*c);
  vec2 p = vec2(fract(a + t*(d-0.5)*2.0 + 0.03*sin(uTime*0.2+b*20.0)), fract(b + t*0.8 + 0.02*sin(uTime*0.17+a*17.0)));
  vec2 w = (p-0.5)*uView*1.04 + vec2(0.0, uCamY);
  gl_PointSize = max((1.6+3.2*c*c)*uPx, 1.0);
  vA = uDust*(0.03+0.08*d)*(0.6+0.4*sin(uTime*(0.4+c)+a*40.0));
  gl_Position = projectionMatrix*viewMatrix*vec4(w,-5.0,1.0);
}`;
const DUST_FS = /* glsl */`
precision highp float; varying float vA;
void main(){ vec2 q=gl_PointCoord*2.0-1.0; float d2=dot(q,q); if(d2>1.0) discard; gl_FragColor=vec4(vec3(0.62,0.34,0.36)*exp(-d2*2.4), vA); }`;

const COMP_VS = /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
const COMP_FS = /* glsl */`
precision highp float;
uniform sampler2D tP, tText, tPhoto;
uniform vec2 uView, uRes, uPhotoSize, uTextY;
uniform float uCamY;
uniform float uTime, uU, uBandY, uBandAmp, uYTop, uYBot, uCell, uGrain, uBanner;
varying vec2 vUv;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec2 wp = (vUv-0.5)*uView + vec2(0.0, uCamY);
  float hitT = clamp((uYTop-wp.y)/(uYTop-uYBot),0.0,1.0);
  float local = clamp((uU-hitT*${U_BAND_END.toFixed(2)})/${(1 - U_BAND_END).toFixed(2)},0.0,1.0);

  // background: near-black with a faint crimson bloom behind the head
  float vg = length((vUv-vec2(0.5,0.58))*vec2(1.0,0.85));
  vec3 bg = vec3(0.012,0.006,0.008) + vec3(0.050,0.010,0.018)*(1.0-smoothstep(0.0,0.75,vg));

  // particles (HDR additive target) + blurred coverage used to darken the banner behind the bust
  vec3 pr = texture2D(tP, vUv).rgb;
  float cover = smoothstep(0.05, 0.32, textureLod(tP, vUv, 3.0).a);

  // banner: grey gradient -> crimson -> near-black, synced with the reveal sweep
  float m = texture2D(tText, vUv).r;
  float tv = clamp((vUv.y-uTextY.x)/(uTextY.y-uTextY.x),0.0,1.0);
  vec3 grey = vec3(0.60,0.595,0.60)*mix(0.04, 1.0, pow(tv,1.35));
  vec3 crim = vec3(0.64,0.035,0.055)*mix(0.55,1.35,tv);
  vec3 txt = mix(grey, crim, smoothstep(0.0,0.5,local));
  txt *= 1.0-0.995*smoothstep(0.5,1.0,local);
  txt *= 1.0-0.985*cover*(1.0-smoothstep(0.0,0.4,local));
  vec3 col = bg + txt*m*0.92*uBanner;

  col += pr;
  float bd = exp(-pow((wp.y-uBandY)/46.0,2.0));
  col += uBandAmp*bd*vec3(0.34,0.09,0.10)*(0.18+1.5*cover);
  col = 1.0-exp(-col*1.25);

  // portrait revealed through a grid of tiny circles that grow until they merge
  vec2 puv = vec2((wp.x+uPhotoSize.x*0.5)/uPhotoSize.x, 1.0-(wp.y+uPhotoSize.y*0.5)/uPhotoSize.y);
  float inside = step(0.0,puv.x)*step(puv.x,1.0)*step(0.0,puv.y)*step(puv.y,1.0);
  vec4 pc = texture2D(tPhoto, clamp(puv,0.0,1.0));
  vec2 g = wp/uCell; float dd = length(fract(g)-0.5);
  float rad = 0.80*smoothstep(0.02,0.95,local);
  float aa = max(fwidth(g.x),1e-3)*0.75;
  float cc = rad<0.004 ? 0.0 : 1.0-smoothstep(rad-aa, rad+aa, dd);
  col = mix(col, pc.rgb, pc.a*inside*cc);

  col += (h21(vUv*uRes + fract(uTime*7.13)*91.7)-0.5)*uGrain;
  gl_FragColor = vec4(col,1.0);
}`;

/* ============================== APP =============================== */
(async function main() {
  let assets;
  try { assets = await loadAssets(); } catch (e) { pctEl.textContent = '!'; console.error(e); return; }

  // font + portrait + particles
  const face = new FontFace('Anton', assets.font.buffer.slice(assets.font.byteOffset, assets.font.byteOffset + assets.font.byteLength));
  await face.load(); document.fonts.add(face);
  const bmp = await createImageBitmap(new Blob([assets.png], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const bust = parseBust(assets.bust || assets.bin);
  const H = bust.h;

  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000); cam.position.z = 2000;

  const photoTex = new THREE.Texture(bmp);
  photoTex.flipY = false; photoTex.premultiplyAlpha = false; photoTex.generateMipmaps = true;
  photoTex.minFilter = THREE.LinearMipmapLinearFilter; photoTex.magFilter = THREE.LinearFilter;
  photoTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); photoTex.needsUpdate = true;

  // --- particles
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(bust.pos, 3));
  geo.setAttribute('nrm', new THREE.BufferAttribute(bust.nrm, 4, true));
  geo.setAttribute('ab', new THREE.BufferAttribute(bust.ab, 2, true));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4000);
  const C_CAMY = { value: 0 };                       // world-y of the screen centre (0 on wide screens)
  const U = {
    uCamY: C_CAMY,
    uStep: { value: H.step }, uTime: { value: 0 }, uIntro: { value: 0 }, uRingR: { value: 60 }, uPx: { value: 1 }, uSize: { value: 1 },
    uYaw: { value: 0 }, uPitch: { value: 0 }, uFollow: { value: 0.12 }, uCursorAmp: { value: 0 }, uCursorR: { value: 90 },
    uBandY: { value: Y_TOP }, uBandAmp: { value: 0 }, uU: { value: 0 }, uYTop: { value: Y_TOP }, uYBot: { value: Y_BOT }, uDust: { value: 1 },
    uPivot: { value: new THREE.Vector3(...H.pivot) }, uCursor: { value: new THREE.Vector3(0, 0, 120) },
    uNeckY: { value: new THREE.Vector2(H.ph / 2 - H.neck0, H.ph / 2 - H.neck1) },
    uPhotoSize: { value: new THREE.Vector2(H.pw, H.ph) }, uPhoto: { value: photoTex }, uGain: { value: 0.8 }, uBase: { value: 0.08 }, uK: { value: 2.0 }, uGam: { value: 1.6 },
  };
  const pMat = new THREE.ShaderMaterial({ vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, uniforms: U,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
  const points = new THREE.Points(geo, pMat); points.frustumCulled = false;

  const DUST_N = 520;
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3));
  dGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4000);
  const dMat = new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, uniforms: { uTime: U.uTime, uPx: U.uPx, uDust: U.uDust, uCamY: C_CAMY, uView: { value: new THREE.Vector2(1, 1) } },
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dGeo, dMat); dust.frustumCulled = false;
  const sceneP = new THREE.Scene(); sceneP.add(dust); sceneP.add(points);

  // --- composite
  const textCanvas = document.createElement('canvas'); const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.minFilter = THREE.LinearFilter; textTex.generateMipmaps = false; textTex.premultiplyAlpha = false;
  let rt = null;
  const C = {
    tP: { value: null }, tText: { value: textTex }, tPhoto: { value: photoTex }, uView: { value: new THREE.Vector2(1, 1) }, uRes: { value: new THREE.Vector2(1, 1) },
    uPhotoSize: { value: new THREE.Vector2(H.pw, H.ph) }, uTextY: { value: new THREE.Vector2(0.4, 0.8) }, uTime: U.uTime, uU: U.uU,
    uBandY: U.uBandY, uBandAmp: U.uBandAmp, uYTop: U.uYTop, uYBot: U.uYBot, uCell: { value: 6.5 }, uGrain: { value: 0.045 }, uBanner: { value: 0 }, uCamY: C_CAMY,
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: COMP_VS, fragmentShader: COMP_FS, uniforms: C, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  const sceneC = new THREE.Scene(); sceneC.add(quad); const camC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // --- layout
  let cssW = 1, cssH = 1, visW = 1, visH = 1, dpr = 1, camY = 0;
  function drawBanner() {
    const w = textCanvas.width, hh = textCanvas.height, ctx = textCanvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, hh);
    const label = 'AI ENGINEER'; ctx.font = '100px Anton'; ctx.textBaseline = 'alphabetic';
    const m0 = ctx.measureText(label); const fs = 100 * w / m0.width;
    ctx.font = fs + 'px Anton'; const m = ctx.measureText(label);
    const capH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const centre = hh * (0.5 - (109 - camY) / visH);          // banner centre sits at world y = +109, behind the head
    const base = centre + capH / 2 - m.actualBoundingBoxDescent;
    ctx.fillStyle = '#fff'; ctx.fillText(label, (w - m.width) / 2, base);
    const top = (hh - (centre - capH / 2)) / hh, bot = (hh - (centre + capH / 2)) / hh;   // uv (y up)
    C.uTextY.value.set(bot - 0.06, top); textTex.needsUpdate = true;
  }
  function layout() {
    const hb = host.getBoundingClientRect(); cssW = Math.max(1, Math.round(hb.width)); cssH = Math.max(1, Math.round(hb.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.4e6 / (cssW * cssH)));
    renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false);
    const aspect = cssW / cssH;
    visH = H.ph / 1.12; visW = visH * aspect;                  // portrait 12% larger than fit-to-height
    if (visW < 800) { visW = 800; visH = visW / aspect; }      // narrow / mobile: keep head + shoulders in frame
    camY = visH > H.ph + 1 ? visH / 2 - H.ph / 2 : 0;           // tall screens: portrait base sits on the bottom edge
    C_CAMY.value = camY;
    cam.left = -visW / 2; cam.right = visW / 2; cam.top = camY + visH / 2; cam.bottom = camY - visH / 2; cam.updateProjectionMatrix();
    const bw = renderer.domElement.width, bh = renderer.domElement.height;
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    C.tP.value = rt.texture;
    const pxPerUnit = bh / visH; U.uPx.value = pxPerUnit; U.uSize.value = 1;
    U.uRingR.value = (Math.min(cssW, cssH) < 520 ? 40 : 52) * (cssH / visH) ;
    U.uCursorR.value = 80;
    C.uView.value.set(visW, visH); C.uRes.value.set(bw, bh); dMat.uniforms.uView.value.set(visW, visH);
    C.uCell.value = clamp(visH / 140, 5, 9);
    textCanvas.width = Math.min(Math.round(cssW * dpr), 4096); textCanvas.height = Math.min(Math.round(cssH * dpr), 4096);
    drawBanner();
    loaderEl.style.setProperty('--ring', (Math.min(cssW, cssH) < 520 ? 40 : 52) + 'px');
  }
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe(host); else window.addEventListener('resize', layout);
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(host);

  /* -------------------------- interaction -------------------------- */
  const S = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, tYaw: 0, tPitch: 0, interacted: false, mix: 0, px: 0, py: 0, inside: false,
    cur: new THREE.Vector2(0, 0), curT: new THREE.Vector2(0, 0), curAmp: 0, P: 0, Pt: 0, ready: false, manual: false };
  function point(e) {
    const r = host.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) { S.inside = false; return; }       // pointer left the hero: head eases back
    S.px = clamp(fx * 2 - 1, -1, 1); S.py = clamp(1 - fy * 2, -1, 1); S.inside = true; S.interacted = true;
    S.curT.set((fx - 0.5) * visW, camY + (0.5 - fy) * visH);
  }
  window.addEventListener('pointermove', point, { passive: true });
  window.addEventListener('pointerdown', point, { passive: true });
  document.addEventListener('mouseleave', () => { S.inside = false; });
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') S.inside = false; }, { passive: true });
  window.addEventListener('pointercancel', () => { S.inside = false; }, { passive: true });
  window.addEventListener('blur', () => { S.inside = false; });

  const spring = (x, v, t, k, dt) => { const c = 2 * Math.sqrt(k); const a = k * (t - x) - c * v; v += a * dt; x += v * dt; return [x, v]; };

  /* ---------------------------- reveal ----------------------------- */
  btn.addEventListener('click', () => {
    if (!S.ready || btn.dataset.busy === '1') return;
    S.Pt = S.Pt > 0.5 ? 0 : 1; btn.dataset.busy = '1'; btn.classList.add('busy');
  });
  function setLabel(t) { btn.textContent = t; }

  /* ----------------------------- loop ------------------------------ */
  let t0 = performance.now(), last = t0, time = 0, introT = -1, started = false;
  function startIntro() { started = true; introT = 0; loaderEl.classList.add('done'); }
  const INTRO_SECONDS = 3.2, SWEEP_START = 2.8, SWEEP_SECONDS = 1.5, AUTO_REVEAL_AT = 4.5;   // reveal starts by itself once the intro sweep has passed
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now; time += dt; U.uTime.value = time;

    if (started && !S.manual) {
      introT += dt;
      U.uIntro.value = clamp(introT / INTRO_SECONDS, 0, 1);
      if (introT > SWEEP_START && introT < SWEEP_START + SWEEP_SECONDS + 0.4) {
        const q = (introT - SWEEP_START) / SWEEP_SECONDS;
        U.uBandY.value = lerp(Y_TOP, Y_BOT, clamp(q, 0, 1)); U.uBandAmp.value = Math.sin(clamp(q, 0, 1) * Math.PI) ** 0.6;
      }
      if (introT >= INTRO_SECONDS - 0.2 && !S.ready) { S.ready = true; btn.classList.add('show'); }
      if (introT >= AUTO_REVEAL_AT && !S.auto && S.ready) { S.auto = true; if (S.Pt === 0) { S.Pt = 1; btn.dataset.busy = '1'; btn.classList.add('busy'); } }
    }
    // reveal progress P (0..1) -> u
    if (!S.manual) {
      const dir = Math.sign(S.Pt - S.P);
      if (dir !== 0) {
        S.P = clamp(S.P + dir * dt / REVEAL_TOTAL, 0, 1);
        if ((dir > 0 && S.P >= S.Pt) || (dir < 0 && S.P <= S.Pt)) {
          S.P = S.Pt; btn.dataset.busy = '0'; btn.classList.remove('busy'); setLabel(S.P > 0.5 ? 'Back to dots' : 'Reveal');
        }
      }
    }
    const u = clamp((S.P * REVEAL_TOTAL - PRE_ROLL) / U_SECONDS, 0, 1);
    if (S.P > 0 || S.manual) {
      U.uU.value = u;
      const bandOn = smooth(0.0, 0.03, u) * (1 - smooth(0.68, 0.74, u));
      U.uBandY.value = lerp(Y_TOP, Y_BOT, clamp(u / U_BAND_END, 0, 1)); U.uBandAmp.value = bandOn;
    } else U.uU.value = 0;
    U.uDust.value = 1 - smooth(0.0, 0.6, u);
    C.uBanner.value = smooth(0.02, 0.4, U.uIntro.value);

    // head targets
    const locked = S.P > 0.001 || !started;
    const idleAmp = reduce ? 0.25 : 1;
    const idleYaw = (7.5 * Math.sin(time * 0.55) + 2.4 * Math.sin(time * 1.13 + 1.0)) * idleAmp * RAD;
    const idlePitch = (2.6 * Math.sin(time * 0.41 + 0.6) + 0.8 * Math.sin(time * 0.97)) * idleAmp * RAD;
    S.mix += ((S.interacted && !locked ? 1 : 0) - S.mix) * (1 - Math.exp(-dt * 1.8));
    const ptYaw = S.inside ? S.px * 30 * RAD : 0, ptPitch = S.inside ? -S.py * 14 * RAD : 0;
    if (locked && S.P > 0.001) { S.tYaw = 0; S.tPitch = 0; }
    else { S.tYaw = lerp(idleYaw, ptYaw, S.mix); S.tPitch = lerp(idlePitch, ptPitch, S.mix); }
    if (S.P >= 0.999) { S.yaw = S.pitch = S.vyaw = S.vpitch = 0; }        // portrait completely still
    else {
      [S.yaw, S.vyaw] = spring(S.yaw, S.vyaw, S.tYaw, S.P > 0.001 ? 40 : 28, dt);
      [S.pitch, S.vpitch] = spring(S.pitch, S.vpitch, S.tPitch, S.P > 0.001 ? 40 : 28, dt);
    }
    U.uYaw.value = S.yaw; U.uPitch.value = S.pitch;
    // cursor light
    const lightOn = S.interacted && S.inside && S.P < 0.001 && started && introT > 2.0;
    S.curAmp += ((lightOn ? 1 : 0) - S.curAmp) * (1 - Math.exp(-dt * 5));
    S.cur.lerp(S.curT, 1 - Math.exp(-dt * 12));
    U.uCursor.value.set(S.cur.x, S.cur.y, 120); U.uCursorAmp.value = S.curAmp;

    if (started && visible) {
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sceneP, cam);
      renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.render(sceneC, camC);
    } else { renderer.setRenderTarget(null); renderer.clear(); }
    requestAnimationFrame(frame);
  }
  // pipeline compile warm-up, then start
  renderer.compile(sceneP, cam);
  requestAnimationFrame((n) => { last = n; frame(n); });
  await new Promise((r) => setTimeout(r, 380));                // let the 100% register visually
  startIntro();
  window.__hero = { S, U, C, startIntro, layout, setIntro: (v) => { S.manual = true; started = true; U.uIntro.value = v; loaderEl.classList.add('done'); S.ready = true; btn.classList.add('show'); },
    manualU: (P) => { S.manual = true; S.P = P; } };
})();
