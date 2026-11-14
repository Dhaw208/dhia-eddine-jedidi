"""Steps 4-5: align bust to portrait, blue-noise particles, shading-derived brightness, binary export."""
import numpy as np, cv2, struct
from numba import njit
from scipy import ndimage as ndi
from scipy.optimize import minimize
from PIL import Image
W = 'work/'
rng = np.random.default_rng(7)
d = np.load(W + 'bust_mesh.npz'); V0 = d['v'].astype(np.float64); F = d['f']
mf = np.load(W + 'mask_front.npy'); alpha = np.load(W + 'alpha_photo.npy')
PH, PW = alpha.shape                                     # 941 x 1672
am = alpha > 0.5

# ---------------- STEP 4a: global similarity fit (head outline IoU) ----------------
HEAD_CLAY_Y = 505                                         # chin/neck row in clay px
def warp_mask(p):
    s, tx, ty = p
    M = np.array([[s, 0, tx], [0, s, ty]], np.float32)
    return cv2.warpAffine(mf.astype(np.uint8), M, (PW, PH), flags=cv2.INTER_LINEAR) > 0
def head_iou(p):
    s, tx, ty = p
    m = warp_mask(p); cut = int(ty + s * HEAD_CLAY_Y)
    a = am[:cut]; b = m[:cut]
    return 1 - (a & b).sum() / ((a | b).sum() + 1)
# initial guess from bboxes
ys, xs = np.nonzero(mf[:HEAD_CLAY_Y]); ya, xa = np.nonzero(am[:600])
s0 = (ya.max() - ya.min()) / (ys.max() - ys.min()); s0 = 1.0 if not np.isfinite(s0) else s0
p0 = [1.0, xa.mean() - xs.mean(), ya.min() - ys.min()]
best = None
for sg in (0.9, 1.0, 1.1):
    r = minimize(head_iou, [sg, p0[1], p0[2]], method='Nelder-Mead', options=dict(xatol=0.05, fatol=1e-6, maxiter=800))
    if best is None or r.fun < best.fun: best = r
S, TX, TY = best.x
print(f'head fit: scale={S:.4f} tx={TX:.1f} ty={TY:.1f} IoU={1-best.fun:.4f}')

# ---------------- STEP 4b: transform + shoulder/neck width matching ----------------
V1 = V0.copy(); V1[:, 0] = S * V0[:, 0] + TX; V1[:, 1] = S * V0[:, 1] + TY
zc = 0.5 * (V0[:, 2].min() + V0[:, 2].max())
V1[:, 2] = -S * (V0[:, 2] - zc)                              # +z toward viewer (face forward)
# projected front silhouette extents per photo row (mesh) vs portrait alpha extents
m1 = warp_mask((S, TX, TY))
def ext(m):
    lo = np.full(PH, np.nan); hi = np.full(PH, np.nan)
    for y in range(PH):
        x = np.flatnonzero(m[y])
        if len(x): lo[y], hi[y] = x[0], x[-1]
    return lo, hi
ml, mr = ext(m1); al, ar = ext(am)
def fill(a):
    i = np.arange(PH); ok = ~np.isnan(a); return np.interp(i, i[ok], a[ok])
ml, mr, al, ar = map(fill, (ml, mr, al, ar))
sm = lambda a, s: ndi.gaussian_filter1d(a, s, mode='nearest')
al, ar = sm(al, 6), sm(ar, 6)
y_neck0 = TY + S * 515; y_neck1 = TY + S * 655               # ramp: head untouched -> shoulders fully matched
yy = np.arange(PH)
wy = np.clip((yy - y_neck0) / (y_neck1 - y_neck0), 0, 1); wy = wy * wy * (3 - 2 * wy)
tl = ml * (1 - wy) + al * wy; tr = mr * (1 - wy) + ar * wy
tl, tr = sm(tl, 4), sm(tr, 4)
def remap_x(x, y):
    yi = np.clip(y, 0, PH - 1); l = np.interp(yi, yy, ml); r = np.interp(yi, yy, mr)
    L = np.interp(yi, yy, tl); R = np.interp(yi, yy, tr)
    return L + (x - l) / np.maximum(r - l, 1e-3) * (R - L)
V1[:, 0] = remap_x(V1[:, 0], V1[:, 1])
# thicken/thin depth with width change so sections stay proportional
kz = np.clip((np.interp(V1[:, 1], yy, tr - tl)) / np.maximum(np.interp(V1[:, 1], yy, mr - ml), 1), 0.7, 1.3)
V1[:, 2] *= (1 + (kz - 1) * np.interp(V1[:, 1], yy, wy))
# vertical shoulder-slope match: move the shoulder surface so its top edge lies on the portrait outline
ms0 = tri_mask_pre = None
def top_edge(m):
    t_ = np.full(PW, np.nan)
    for x in range(PW):
        c = np.flatnonzero(m[:, x])
        if len(c): t_[x] = c[0]
    return t_
img0 = np.zeros((PH, PW), np.uint8); cv2.fillPoly(img0, V1[F][:, :, :2].astype(np.int32), 255)
tm, ta = top_edge(img0 > 0), top_edge(am)
cols = np.arange(PW); okc = ~np.isnan(tm) & ~np.isnan(ta) & (tm > y_neck0 + 40)
dy = np.interp(cols, cols[okc], (ta - tm)[okc]); dy = ndi.gaussian_filter1d(dy, 14)
xi = np.clip(V1[:, 0], 0, PW - 1)
depth_below = np.clip(V1[:, 1] - np.interp(xi, cols, np.where(np.isnan(tm), 0, tm)), 0, None)
fall = np.exp(-depth_below / 140.0) * np.interp(V1[:, 1], [y_neck0 + 20, y_neck0 + 110], [0, 1])
V1[:, 1] += np.interp(xi, cols, dy) * fall
# verification overlay
def tri_mask(V):
    img = np.zeros((PH, PW), np.uint8)
    cv2.fillPoly(img, V[F][:, :, :2].astype(np.int32), 255)      # silhouette = union of projected faces
    return img > 0
ms_ = tri_mask(V1)
ov = np.zeros((PH, PW, 3), np.uint8)
ov[am & ~ms_] = (0, 0, 255); ov[ms_ & ~am] = (255, 120, 0); ov[am & ms_] = (90, 90, 90)
cv2.imwrite(W + 'prev_align.png', ov)
iou_all = (am & ms_).sum() / (am | ms_).sum()
print(f'full-bust silhouette IoU vs portrait: {iou_all:.4f}')

# ---------------- STEP 5: surface sampling + Poisson-disk ----------------
# vertex normals (smooth) on aligned mesh
def vnormals(V):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    vn = np.zeros_like(V);
    for k in range(3): np.add.at(vn, F[:, k], fn)
    return vn / (np.linalg.norm(vn, axis=1, keepdims=True) + 1e-12), fn
VN, FN = vnormals(V1)
# orient outward (verify with centroid test)
c = V1.mean(0)
if np.mean(np.einsum('ij,ij->i', VN, V1 - c)) < 0: VN = -VN; FN = -FN
area = 0.5 * np.linalg.norm(FN, axis=1)
fn_unit = FN / (np.linalg.norm(FN, axis=1, keepdims=True) + 1e-12)
# keep the camera-visible shell (head turns <= ~30 deg): drop back-facing triangles
keep = fn_unit[:, 2] > -0.30
print('triangles kept', keep.sum(), 'of', len(keep))
Fk = np.flatnonzero(keep); ak = area[Fk]
NC = 1_400_000
tid = Fk[rng.choice(len(Fk), NC, p=ak / ak.sum())]
u, v = rng.random(NC), rng.random(NC); flip = u + v > 1; u[flip] = 1 - u[flip]; v[flip] = 1 - v[flip]
bary = np.stack([1 - u - v, u, v], 1)
P1 = np.einsum('ij,ijk->ik', bary, V1[F[tid]]); P0 = np.einsum('ij,ijk->ik', bary, V0[F[tid]])
N1 = np.einsum('ij,ijk->ik', bary, VN[F[tid]]); N1 /= np.linalg.norm(N1, axis=1, keepdims=True) + 1e-12

@njit(cache=True)
def _poisson(P, r, order, mn, dims):
    cell = r / np.sqrt(3.0)
    grid = -np.ones((dims[0], dims[1], dims[2]), np.int64)
    acc = np.empty(len(P), np.int64); n = 0; r2 = r * r; R = 3
    for k in range(len(order)):
        i = order[k]
        cx = int((P[i, 0] - mn[0]) / cell) + 1; cy = int((P[i, 1] - mn[1]) / cell) + 1; cz = int((P[i, 2] - mn[2]) / cell) + 1
        ok = True
        for a in range(max(cx - R, 0), min(cx + R + 1, dims[0])):
            for b in range(max(cy - R, 0), min(cy + R + 1, dims[1])):
                for c_ in range(max(cz - R, 0), min(cz + R + 1, dims[2])):
                    j = grid[a, b, c_]
                    if j >= 0:
                        dx = P[i, 0] - P[j, 0]; dy = P[i, 1] - P[j, 1]; dz = P[i, 2] - P[j, 2]
                        if dx * dx + dy * dy + dz * dz < r2: ok = False; break
                if not ok: break
            if not ok: break
        if ok:
            grid[cx, cy, cz] = i; acc[n] = i; n += 1
    return acc[:n]
def poisson(P, r, order):
    mn = P.min(axis=0); dims = ((P.max(axis=0) - mn) / (r / np.sqrt(3.0))).astype(np.int64) + 3
    return _poisson(P, r, order, mn, dims)
TARGET = 78000
order = rng.permutation(NC)
lo, hi = 1.5, 8.0
for _ in range(16):
    mid = 0.5 * (lo + hi); n = len(poisson(P1, mid, order))
    if n > TARGET: lo = mid
    else: hi = mid
r = lo; sel = poisson(P1, r, order)
if len(sel) > TARGET: sel = rng.choice(sel, TARGET, replace=False)
print(f'poisson radius={r:.3f}px  particles={len(sel)}')
P1, P0, N1 = P1[sel], P0[sel], N1[sel]; Np = len(sel)

# ---------------- brightness from clay shading ----------------
def prep_gray(name):
    g = np.array(Image.open(W + f'{name}_1200.png').convert('L')).astype(np.float32) / 255
    g0 = cv2.GaussianBlur(g, (0, 0), 1.1)
    mean = cv2.GaussianBlur(g, (0, 0), 7); dev = g0 - mean
    sd = np.sqrt(cv2.GaussianBlur(dev * dev, (0, 0), 7)) + 1e-3
    lc = np.tanh(dev * 5.5)           # local contrast (strand ridges bright, valleys dark)
    gx = cv2.Sobel(g0, cv2.CV_32F, 1, 0); gy = cv2.Sobel(g0, cv2.CV_32F, 0, 1)
    edge = cv2.GaussianBlur(np.sqrt(gx * gx + gy * gy), (0, 0), 1.0); edge = np.clip(edge / (np.percentile(edge, 99.3) + 1e-6), 0, 1)
    tex = np.clip(cv2.GaussianBlur(sd, (0, 0), 3) / 0.045, 0, 1)         # 0 = smooth skin/cloth, 1 = hair/beard
    tex = np.clip((tex - 0.30) / 0.45, 0, 1)
    fold = cv2.GaussianBlur(g, (0, 0), 2.2) - cv2.GaussianBlur(g, (0, 0), 20)   # soft cloth folds / collar shading
    return lc, edge, tex, cv2.GaussianBlur(g, (0, 0), 2.0), fold
Lf = prep_gray('clay-front'); Ls = prep_gray('clay-side')
def sample(img, x, y):
    return ndi.map_coordinates(img, [np.clip(y, 0, img.shape[0] - 1), np.clip(x, 0, img.shape[1] - 1)], order=1)
x0, y0, dd = P0[:, 0], P0[:, 1], P0[:, 2]
nf = np.clip(N1[:, 2], 0, 1) ** 1.2                           # facing viewer
ns = np.abs(N1[:, 0]) ** 1.2                                  # facing sideways
wf = nf / (nf + ns + 1e-6); ws = 1 - wf
def mixed(k): return wf * sample(Lf[k], x0, y0) + ws * sample(Ls[k], dd, y0)
lc, edge, tex, gray, fold = mixed(0), mixed(1), mixed(2), mixed(3), mixed(4)
# hair / beard: strand-level local contrast + edges; slightly brighter mean than the calm face so the hairline reads
hair_b = 0.56 + 0.40 * lc + 0.22 * edge
hair_b = hair_b * (0.88 + 0.24 * np.clip((gray - 0.3) / 0.5, 0, 1))
hair_b = 0.52 + (hair_b - 0.52) * 1.8
face_b = np.full_like(hair_b, 0.58)                             # featureless face: perfectly smooth
cloth_b = 0.58 + 7.0 * fold + 0.28 * edge * (1 - tex) + 0.10 * lc   # shirt folds + collar seam, soft
tw = np.clip((tex - 0.10) / 0.28, 0, 1)
is_cloth = (P0[:, 1] > 520) & (tex < 0.5)
bright = np.where(is_cloth, cloth_b, face_b + (hair_b - face_b) * tw)
up = np.clip(-N1[:, 1], 0, 1)
ledge = np.clip((up - 0.55) / 0.37, 0, 1)
bright *= 1 - 0.55 * ledge * (1 - tex)                        # flat upward ledges (shoulders) dimmed
bright = np.clip(bright, 0.05, 1.0)
print('brightness mean %.3f std %.3f' % (bright.mean(), bright.std()))

# ---------------- export binary ----------------
CX, CY = PW / 2, PH / 2
pos = np.stack([P1[:, 0] - CX, -(P1[:, 1] - CY), P1[:, 2]], 1)            # centred, y up, z toward viewer
step = 0.05
posq = np.round(pos / step).astype(np.int16)
nrm = np.stack([N1[:, 0], -N1[:, 1], N1[:, 2]], 1)
nq = np.round(np.clip(nrm, -1, 1) * 127).astype(np.int8)
rnd = rng.integers(0, 256, Np).astype(np.uint8)
bq = np.round(bright * 255).astype(np.uint8)
pivot = np.array([TX + S * 600 - CX, -(TY + S * 470 - CY), 0.0])                # head turns about the neck
pivot[0] = 0.5 * (tl[int(TY + S * 480)] + tr[int(TY + S * 480)]) - CX
band = (np.abs(V0[:, 1] - 470) < 12)                       # neck rows: head turns about the neck axis in depth
pivot[2] = float(np.mean([-S * (V0[band, 2].min() - zc), -S * (V0[band, 2].max() - zc)]))
print('pivot', pivot)
hdr = struct.pack('<4sIfffffffff', b'PRT1', Np, step, PW, PH, pivot[0], pivot[1], pivot[2], S, float(y_neck0), float(y_neck1))
hdr = hdr.ljust(64, b'\0')
with open('dist/bust_particles.bin', 'wb') as f:
    f.write(hdr); f.write(posq.T.copy().tobytes()); f.write(nq.T.copy().tobytes()); f.write(rnd.tobytes()); f.write(bq.tobytes())
import os; print('bin bytes', os.path.getsize('dist/bust_particles.bin'))
np.savez(W + 'particles_dbg.npz', pos=pos, nrm=nrm, b=bright, pivot=pivot)

# ---------------- previews ----------------
def render_pts(yaw, w=836, h=470, sc=0.5):
    t = np.radians(yaw); c_, s_ = np.cos(t), np.sin(t)
    p = pos - pivot * np.array([1, 1, 1]); x = p[:, 0] * c_ + p[:, 2] * s_; z = -p[:, 0] * s_ + p[:, 2] * c_
    nz = nrm[:, 2] * c_ - nrm[:, 0] * s_
    img = np.zeros((h, w), np.float32)
    xi = (x * sc + w / 2 + pivot[0] * sc).astype(int); yi = (-(p[:, 1] + pivot[1]) * sc + h / 2).astype(int)
    ok = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h) & (nz > -0.1)
    np.add.at(img, (yi[ok], xi[ok]), (bright[ok] * 0.9)); img = cv2.GaussianBlur(img, (0, 0), 1.1) * 3.2
    out = np.zeros((h, w, 3), np.float32); out[..., 2] = np.clip(img * 0.64 * 4, 0, 1); out[..., 1] = np.clip(img * 0.05, 0, 1); out[..., 0] = np.clip(img * 0.07, 0, 1)
    return (out * 255).astype(np.uint8)
cv2.imwrite(W + 'prev_particles_front.png', cv2.resize(render_pts(0, 1672, 941, 1.0), (836, 470)))
cv2.imwrite(W + 'prev_particles_close.png', render_pts(0, 836, 700, 1.0)[:, :])
cv2.imwrite(W + 'prev_particles_30.png', cv2.resize(render_pts(30, 1672, 941, 1.0), (836, 470)))
cv2.imwrite(W + 'prev_particles_side.png', cv2.resize(render_pts(90, 1672, 941, 1.0), (836, 470)))
