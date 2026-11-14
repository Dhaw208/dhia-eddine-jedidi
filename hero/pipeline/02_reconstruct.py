"""Step 3: voxel reconstruction (front x side silhouettes) -> marching cubes -> 3-view previews."""
import numpy as np, cv2, trimesh
from scipy import ndimage as ndi
from skimage import measure
W = 'work/'
mf = np.load(W + 'mask_front.npy'); ms = np.load(W + 'mask_side.npy')
H = mf.shape[0]
VS = 2.5                                   # voxel size in clay-image px

def extents(m):
    lo = np.full(H, np.nan); hi = np.full(H, np.nan)
    for y in range(H):
        xs = np.flatnonzero(m[y])
        if len(xs): lo[y], hi[y] = xs[0], xs[-1]
    return lo, hi
xl, xr = extents(mf); zl, zr = extents(ms)          # side image x == depth axis d (face at small d)
rows = np.flatnonzero(~np.isnan(xl) & ~np.isnan(zl)); y0, y1 = rows[0], rows[-1]
print('rows', y0, y1)

def interp(a):                                       # fill nan rows
    i = np.arange(H); ok = ~np.isnan(a); return np.interp(i, i[ok], a[ok])
xl, xr, zl, zr = map(interp, (xl, xr, zl, zr))

def smooth(a, s): return ndi.gaussian_filter1d(a, s, mode='nearest')
# -- clean boundary curves (curly-hair silhouette jitter -> smooth rows) --
xl, xr, zl, zr = [smooth(a, 5.0) for a in (xl, xr, zl, zr)]

# -- ears: front width bulges at ear rows; pull the cross-section back toward the cheek line --
ear0, ear1 = 268, 392
for arr, sgn in ((xl, 1), (xr, -1)):
    base = np.interp(np.arange(H), [ear0 - 30, ear1 + 30], [arr[ear0 - 30], arr[ear1 + 30]])
    w = np.zeros(H); w[ear0:ear1] = 1; w = smooth(w, 14)
    arr[:] = arr + w * 0.97 * np.where((arr - base) * sgn < 0, (base - arr), 0)

# -- face profile: replace brow->chin front edge with a smooth curve --
brow, chin = 150, 528
yy = np.arange(H)
prof = zl.copy()
fit = smooth(np.interp(yy, [brow - 40, brow, chin, chin + 40], [zl[brow - 40], zl[brow], zl[chin], zl[chin + 40]]) * 0 + zl, 24)
w = np.clip(np.minimum(yy - (brow - 45), (chin + 25) - yy) / 45, 0, 1); w = w * w * (3 - 2 * w)
zl = prof * (1 - w) + fit * w
zl = smooth(zl, 2.0)

# -- extra smoothing at the ear rows and the neck->chest junction (kills ring ledges / flat roofs) --
def local_blend(a, r0, r1, sig, feather=25):
    w = np.zeros(H); w[r0:r1] = 1; w = smooth(w, feather / 2)
    return a * (1 - w) + smooth(a, sig) * w
xl, xr = local_blend(xl, 250, 420, 12), local_blend(xr, 250, 420, 12)
zl, zr = local_blend(zl, 470, 700, 16, 50), local_blend(zr, 470, 700, 16, 50)
xl, xr = local_blend(xl, 480, 640, 9, 40), local_blend(xr, 480, 640, 9, 40)

# -- build voxel volume --
pad = 6
X0, X1 = int(np.nanmin(xl)) - pad, int(np.nanmax(xr)) + pad
Z0, Z1 = int(zl.min()) - pad, int(zr.max()) + pad
ys = np.arange(y0 - pad, y1 + 1 + pad)
xs = np.arange(X0, X1, VS); zs = np.arange(Z0, Z1, VS); ysv = np.arange(ys[0], ys[-1], VS)
vol = np.zeros((len(xs), len(ysv), len(zs)), np.float32)
Xg = xs[:, None]; Zg = zs[None, :]
for j, y in enumerate(ysv):
    yi = int(np.clip(round(y), 0, H - 1))
    a = (xr[yi] - xl[yi]) / 2 + 0.01; cx = (xr[yi] + xl[yi]) / 2
    b = (zr[yi] - zl[yi]) / 2 + 0.01; cz = (zr[yi] + zl[yi]) / 2
    t = np.clip((yi - 420) / 220, 0, 1)             # head -> torso: rounder -> broader sections
    n = 2.0 + 0.9 * t
    e = (np.abs(Xg - cx) / a) ** n + (np.abs(Zg - cz) / b) ** n
    vol[:, j, :] = np.clip((1 - e) * 4 + 0.5, 0, 1)   # soft inside value
# silhouette containment (fits inside BOTH silhouettes)
fx = ndi.map_coordinates(mf.astype(np.float32), np.meshgrid(ysv, xs, indexing='ij')[::1], order=1, mode='constant').T  # (x,y)
sz = ndi.map_coordinates(ms.astype(np.float32), np.meshgrid(ysv, zs, indexing='ij'), order=1, mode='constant').T       # (z,y)
vol *= fx[:, :, None] * sz.T[None, :, :]
vol = ndi.gaussian_filter(vol, (1.8, 2.8, 1.8))
vol = np.pad(vol, 1)
verts, faces, normals, _ = measure.marching_cubes(vol, 0.5)
verts = (verts - 1) * VS + np.array([xs[0], ysv[0], zs[0]])        # back to clay px: (x, y, d)
mesh = trimesh.Trimesh(verts, faces, process=True)
parts = mesh.split(only_watertight=False); mesh = max(parts, key=lambda m: len(m.faces))
mesh.remove_unreferenced_vertices(); mesh.merge_vertices()
orig = np.asarray(mesh.vertices).copy()
trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=12)
disp = np.linalg.norm(np.asarray(mesh.vertices) - orig, axis=1)
bad = disp > 4.0
print('reverted vertices', int(bad.sum()))
vv = np.asarray(mesh.vertices).copy(); vv[bad] = orig[bad]; mesh.vertices = vv
mesh.fix_normals()
print('mesh', len(mesh.vertices), len(mesh.faces), 'watertight', mesh.is_watertight)
mesh.export(W + 'bust.ply')
np.savez(W + 'bust_mesh.npz', v=np.asarray(mesh.vertices, np.float32), f=np.asarray(mesh.faces, np.int32))

# -- software preview renders (painter's algorithm, lambert) --
def render(mesh, yaw_deg, size=(540, 420), scale=0.46):
    v = np.asarray(mesh.vertices) - np.array([600, 0, 0.5 * (zl.min() + zr.max())])
    t = np.radians(yaw_deg)       # rotate about vertical axis through the head
    c, s = np.cos(t), np.sin(t)
    xr_ = v[:, 0] * c + v[:, 2] * s; zr_ = -v[:, 0] * s + v[:, 2] * c     # depth (bigger = farther)
    f = mesh.faces; tri = np.stack([xr_, v[:, 1], zr_], 1)[f]
    vn = np.asarray(mesh.vertex_normals); rx = vn[:, 0] * c + vn[:, 2] * s; rz = -vn[:, 0] * s + vn[:, 2] * c
    vr = np.stack([rx, vn[:, 1], rz], 1); nrm = vr[f].mean(1); nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    nrm[nrm[:, 2] > 0] *= -1                       # normals face camera (camera at -depth)
    light = np.array([-0.35, -0.55, -0.75]); light /= np.linalg.norm(light)
    sh = np.clip(nrm @ light, 0, 1) * 0.75 + 0.25
    order = np.argsort(-tri[:, :, 2].mean(1))      # far -> near
    img = np.full((size[1], size[0], 3), 245, np.uint8)
    pts = np.stack([tri[:, :, 0] * scale + size[0] / 2, tri[:, :, 1] * scale + 8], 2)
    for k in order:
        col = int(60 + 190 * sh[k])
        cv2.fillConvexPoly(img, pts[k].astype(np.int32), (col, col, col), lineType=cv2.LINE_AA)
    return img
sheet = np.hstack([render(mesh, 0), render(mesh, 30), render(mesh, 90)])
cv2.imwrite(W + 'prev_recon.png', sheet)
