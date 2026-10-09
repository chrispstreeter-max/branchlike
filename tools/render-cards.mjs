// Render card portraits of the frames from their 3D models into public/img/units/.
// Run after `npm run build`: node tools/render-cards.mjs
import { serve } from './serve.mjs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
export const RENDERED = ['warden_frame', 'kestrel', 'monolith', 'vesper', 'halberd_prime'];
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img', 'units');
mkdirSync(outDir, { recursive: true });
const PORT = 5195;
const server = await serve(PORT);
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror:', String(e)));
await page.goto(`http://localhost:${PORT}/version.json`);
for (const id of RENDERED) {
  const data = await page.evaluate(async (id) => {
    document.documentElement.innerHTML = '<body style="margin:0;background:transparent"></body>';
    const { UnitPreview, loadThree } = await import('/js/render/preview3d.js');
    const T = await loadThree();
    const N = 512;
    const c = document.createElement('canvas'); c.width = N; c.height = N; c.style.cssText = `width:${N}px;height:${N}px`;
    document.body.append(c);
    const p = new UnitPreview(T, c, { team: 0, spin: false, angle: -0.6, floor: false, fill: 0.72 });
    p.show(id); p.frame(0.12);
    // Crop to the model's pixels and fit it into a padded 256px square.
    const src = document.createElement('canvas'); src.width = c.width; src.height = c.height;
    const sx = src.getContext('2d'); sx.drawImage(c, 0, 0);
    const px = sx.getImageData(0, 0, src.width, src.height).data;
    let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (px[(y * src.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, S = 256, pad = 10, k = Math.min((S - pad * 2) / w, (S - pad * 2) / h);
    const out = document.createElement('canvas'); out.width = S; out.height = S;
    const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high';
    ox.drawImage(src, x0, y0, w, h, (S - w * k) / 2, S - pad - h * k, w * k, h * k);
    return out.toDataURL('image/png');
  }, id);
  writeFileSync(join(outDir, `${id}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('rendered', id);
}
await browser.close(); server.close();
