"""Steps 1-2: asset prep, Depth Anything V2 Small (ONNX), background removal."""
import numpy as np, cv2, onnxruntime as ort
from PIL import Image
from scipy import ndimage as ndi
W = 'work/'

# --- clay images: uniform scale (no distortion) + centred crop to 1200x896 ---
def prep_clay(name):
    im = Image.open(f'src_images/{name}.png').convert('RGB')          # 1672x941
    s = 896 / im.height
    im = im.resize((round(im.width * s), 896), Image.LANCZOS)         # 1592x896
    x0 = (im.width - 1200) // 2
    im = im.crop((x0, 0, x0 + 1200, 896))
    im.save(W + f'{name}_1200.png'); return np.array(im)

front = prep_clay('clay-front'); side = prep_clay('clay-side')
photo = np.array(Image.open('src_images/photo.png').convert('RGB'))   # untouched 1672x941

# --- Depth Anything V2 Small ---
sess = ort.InferenceSession(W + 'depth.onnx')
MEAN = np.array([0.485, 0.456, 0.406], np.float32); STD = np.array([0.229, 0.224, 0.225], np.float32)
def depth(img):
    h, w = img.shape[:2]; k = 518 / max(h, w)
    nh, nw = round(h * k / 14) * 14, round(w * k / 14) * 14
    x = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None]
    d = sess.run(None, {'pixel_values': x})[0][0]
    d = cv2.resize(d, (w, h), interpolation=cv2.INTER_CUBIC)
    return (d - d.min()) / (d.max() - d.min() + 1e-9)
for n, im in [('front', front), ('side', side), ('photo', photo)]:
    d = depth(im); np.save(W + f'depth_{n}.npy', d.astype(np.float32))
    cv2.imwrite(W + f'depth_{n}.png', (d * 255).astype(np.uint8))

# --- clay silhouettes: grey < 226, largest component, fill holes ---
def silhouette(im):
    g = im.mean(2)
    m = g < 226
    m = ndi.binary_opening(m, iterations=1)           # drops faint floor shadow fringes
    lab, n = ndi.label(m)
    sizes = ndi.sum(m, lab, range(1, n + 1))
    m = lab == (1 + int(np.argmax(sizes)))
    m = ndi.binary_fill_holes(m)
    return m
mf, ms = silhouette(front), silhouette(side)
np.save(W + 'mask_front.npy', mf); np.save(W + 'mask_side.npy', ms)
cv2.imwrite(W + 'mask_front.png', mf.astype(np.uint8) * 255); cv2.imwrite(W + 'mask_side.png', ms.astype(np.uint8) * 255)

# --- portrait cutout (soft alpha, keeps flyaway hair, closes neck/collar gaps) ---
p = photo.astype(np.float32)
lum = p.max(2)
dph = cv2.GaussianBlur(np.load(W + 'depth_photo.npy'), (0, 0), 1.5)
core = (dph > 0.40) | (ndi.gaussian_filter(lum, 1.0) > 8)      # depth separates dark hair from black backdrop
core = ndi.binary_opening(core, iterations=2)
lab, n = ndi.label(core); sz = ndi.sum(core, lab, range(1, n + 1)); core = lab == (1 + int(np.argmax(sz)))
core = ndi.binary_closing(core, structure=np.ones((3, 3)), iterations=6)   # close neck/collar gaps
core = ndi.binary_fill_holes(core)
inner = ndi.binary_erosion(core, iterations=4)
soft = np.clip((ndi.gaussian_filter(lum, 0.6) - 2.5) / 16, 0, 1)           # flyaway hair on black
reach = ndi.binary_dilation(core, iterations=12)
alpha = np.where(inner, 1.0, np.where(reach, soft, 0.0))
alpha = np.maximum(alpha, ndi.gaussian_filter(inner.astype(np.float32), 1.5) * core)
alpha = np.clip(alpha, 0, 1).astype(np.float32)
np.save(W + 'alpha_photo.npy', alpha)
rgba = np.dstack([photo, (alpha * 255).astype(np.uint8)])
Image.fromarray(rgba, 'RGBA').save('dist/portrait_cutout.png', optimize=True)
# previews
bg = np.zeros_like(photo); bg[:] = (170, 20, 40)
prev = (photo * alpha[..., None] + bg * (1 - alpha[..., None])).astype(np.uint8)
cv2.imwrite(W + 'prev_cutout.png', prev[..., ::-1])
sheet = np.hstack([cv2.resize(x, (600, 448)) for x in [
    np.dstack([mf * 255] * 3).astype(np.uint8), np.dstack([ms * 255] * 3).astype(np.uint8),
    (np.dstack([np.load(W + 'depth_front.npy')] * 3) * 255).astype(np.uint8)]])
cv2.imwrite(W + 'prev_masks.png', sheet)
print('mask bbox front', np.argwhere(mf).min(0), np.argwhere(mf).max(0), 'side', np.argwhere(ms).min(0), np.argwhere(ms).max(0))
