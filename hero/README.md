# WebGL particle hero

Source for the home-page hero (`assets/hero/hero.js` is the committed, minified bundle, so the site build stays dependency-free).

- `src/main.js` — Three.js app + shaders. Rebuild the bundle: `npm i --no-save three@0.160.0 && npx esbuild hero/src/main.js --bundle --minify --format=iife --target=es2020 --legal-comments=none --outfile=assets/hero/hero.js`
- `pipeline/` — Python scripts that produced `assets/hero/bust_particles.bin` and `portrait_cutout.png` from the front/side clay renders and the portrait (depth, masks, voxel reconstruction, alignment, Poisson-disk particles). They expect a `work/` folder and `src_images/` next to them.
- The hero fetches `/assets/hero/*` with real byte-progress; the page only shows it when WebGL2 exists (`html.hero-gl`), otherwise the static portrait hero is shown.
