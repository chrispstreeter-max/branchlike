// Render a design sheet of the frames (both factions) to a PNG.
// Usage: node tools/mechsheet.mjs out.png [--still]
import { serve } from './serve.mjs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const out = process.argv[2] ?? 'mechs.png';
const units = (process.argv.find(a => a.startsWith('--units=')) ?? '--units=warden_frame,kestrel,monolith,vesper,halberd_prime').slice(8).split(',');
const t = Number((process.argv.find(a => a.startsWith('--t=')) ?? '--t=0.35').slice(4));
const angles = (process.argv.find(a => a.startsWith('--angles=')) ?? '--angles=-0.55').slice(9).split(',').map(Number);
const teams = (process.argv.find(a => a.startsWith('--teams=')) ?? '--teams=0,1').slice(8).split(',').map(Number);
const PORT = 5198;
const server = await serve(PORT);
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 300 * units.length, height: 320 * angles.length * teams.length }, deviceScaleFactor: 1 });
page.on('console', m => console.log('page:', m.text()));
page.on('pageerror', e => console.log('pageerror:', String(e)));
await page.goto(`http://localhost:${PORT}/version.json`);
await page.evaluate(async ({ units, t, angles, teams }) => {
  document.documentElement.innerHTML = '<body style="margin:0;background:#15181c;display:grid;grid-template-columns:repeat(' + units.length + ',300px);font:600 14px system-ui;color:#cfd5dc"></body>';
  const { UnitPreview, loadThree } = await import('/js/render/preview3d.js');
  const T = await loadThree();
  for (const team of teams) for (const angle of angles) for (const id of units) {
    const cell = document.createElement('div'); cell.style.cssText = 'position:relative;height:320px';
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; c.style.cssText = 'width:300px;height:300px;display:block';
    const label = document.createElement('div'); label.textContent = id + (team ? ' · Halcyon' : ' · Union'); label.style.cssText = 'position:absolute;bottom:4px;left:10px';
    cell.append(c, label); document.body.append(cell);
    const p = new UnitPreview(T, c, { team, spin: false, angle, background: 0x1d2228 });
    p.show(id); p.frame(t);
  }
}, { units, t, angles, teams });
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close(); server.close();
console.log('wrote', out);
