// Render the phone app icon and splash screen into assets/ (used by @capacitor/assets).
// Run after `npm run build`: node tools/render-app-assets.mjs
import { serve } from './serve.mjs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(outDir, { recursive: true });
const server = await serve(5194);
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
page.on('pageerror', e => console.log('pageerror:', String(e)));
await page.goto('http://localhost:5194/version.json');
const files = await page.evaluate(async () => {
  document.documentElement.innerHTML = '<body style="margin:0;background:transparent"></body>';
  const { UnitPreview, loadThree } = await import('/js/render/preview3d.js');
  const T = await loadThree();
  // 1. The mech, cropped to its pixels.
  const N = 1024, c = document.createElement('canvas'); c.width = N; c.height = N; c.style.cssText = `width:${N}px;height:${N}px`;
  document.body.append(c);
  const pv = new UnitPreview(T, c, { team: 0, spin: false, angle: -0.6, floor: false, fill: 0.7 });
  pv.show('warden_frame'); pv.frame(0.12);
  const src = document.createElement('canvas'); src.width = N; src.height = N; src.getContext('2d').drawImage(c, 0, 0);
  const px = src.getContext('2d').getImageData(0, 0, N, N).data;
  let x0 = N, y0 = N, x1 = 0, y1 = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (px[(y * N + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const mw = x1 - x0 + 1, mh = y1 - y0 + 1;
  const mech = (ctx, cx, cy, size) => { const k = size / Math.max(mw, mh); ctx.drawImage(src, x0, y0, mw, mh, cx - mw * k / 2, cy - mh * k / 2, mw * k, mh * k); };
  const hex = (ctx, cx, cy, r, w, col) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } ctx.closePath(); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); };
  const bg = (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S * 0.45, S * 0.05, S / 2, S / 2, S * 0.75);
    g.addColorStop(0, '#2a2f37'); g.addColorStop(1, '#0c0f13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  };
  const make = (S, f) => { const o = document.createElement('canvas'); o.width = S; o.height = S; const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; f(x, S); return o.toDataURL('image/png'); };
  const out = {};
  out['icon-only.png'] = make(1024, (x, S) => { bg(x, S); hex(x, S / 2, S / 2, S * 0.42, S * 0.022, '#e8962a'); mech(x, S / 2, S * 0.52, S * 0.62); });
  out['icon-background.png'] = make(1024, (x, S) => { bg(x, S); hex(x, S / 2, S / 2, S * 0.36, S * 0.02, '#e8962a'); });
  out['icon-foreground.png'] = make(1024, (x, S) => { mech(x, S / 2, S * 0.52, S * 0.5); });
  const splash = (x, S) => {
    x.fillStyle = '#0c0f13'; x.fillRect(0, 0, S, S);
    hex(x, S / 2, S * 0.45, S * 0.13, S * 0.006, '#e8962a');
    mech(x, S / 2, S * 0.455, S * 0.19);
    x.fillStyle = '#e7eaed'; x.textAlign = 'center';
    x.font = `800 ${Math.round(S * 0.045)}px system-ui, sans-serif`;
    x.fillText('BRANCHLIKE', S / 2, S * 0.64);
  };
  out['splash.png'] = make(2732, splash);
  out['splash-dark.png'] = make(2732, splash);
  return out;
});
for (const [name, data] of Object.entries(files)) { writeFileSync(join(outDir, name), Buffer.from(data.split(',')[1], 'base64')); console.log('wrote assets/' + name); }
await browser.close(); server.close();
