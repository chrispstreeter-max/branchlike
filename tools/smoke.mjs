// End-to-end play-test in a headless phone-sized browser.
// Drives the real UI: title -> menu -> campaign -> briefing -> battle (deploy by
// dragging a card, use the pilot ability) -> results -> reload persistence ->
// hangar upgrade -> squad -> settings -> profile. Fails on any console error.
// Usage: npm run smoke [-- --shots=dir]
import { serve } from './serve.mjs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const shotsArg = process.argv.find(a => a.startsWith('--shots='));
const shots = shotsArg ? shotsArg.split('=')[1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const PORT = 5199;
const server = await serve(PORT);
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const step = (msg) => console.log('  ✓ ' + msg);
const fail = (msg) => { console.error('  ✗ ' + msg); process.exitCode = 1; };
const check = (cond, msg) => (cond ? step(msg) : fail(msg));
const noOverflow = async (where) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(w <= 0, `${where}: no horizontal overflow`);
};

try {
  await page.goto(`http://localhost:${PORT}/index.html?debug=1`);
  await page.waitForSelector('.title-screen');
  await shot('01-title'); await noOverflow('title');
  await page.click('.title-foot .btn');
  await page.waitForSelector('.menu-list');
  check(true, 'title -> menu');
  await shot('02-menu'); await noOverflow('menu');

  await page.click('.menu-item.primary');
  await page.waitForSelector('.mission-list');
  const locked = await page.$$eval('.mission:disabled', els => els.length);
  check(locked === 5, `campaign shows 5 locked missions (got ${locked})`);
  await shot('03-campaign');
  await page.click('.mission:not(:disabled)');
  await page.waitForSelector('text=Launch');
  await shot('04-briefing'); await noOverflow('briefing');
  await page.click('text=Launch');
  await page.waitForSelector('.battle[data-view]', { timeout: 15000 });
  check(await page.getAttribute('.battle', 'data-view') === '3d', '3D battlefield renderer is active');
  await page.waitForTimeout(600);
  check(await page.isVisible('.coach'), 'tutorial coach is shown');
  await shot('05-battle-start'); await noOverflow('battle');

  // Drag the first affordable card onto the deploy zone.
  const before = await page.evaluate(() => globalThis.__branchlike.battle.sides[0].stats.deployed);
  const card = await page.$('.hand .card:not(.poor)');
  const cb = await card.boundingBox();
  const cv0 = await (await page.$('.stage')).boundingBox();
  const hudH = await page.$eval('.hud-top', e => e.offsetHeight), trayH = await page.$eval('.tray', e => e.offsetHeight);
  // The playable field sits between the HUD and the card tray.
  const cv = { x: cv0.x, y: cv0.y + hudH, width: cv0.width, height: cv0.height - hudH - trayH };
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width * 0.3, cv.y + cv.height * 0.9, { steps: 8 });
  await page.waitForTimeout(100);
  await shot('06-drag-ghost');
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => globalThis.__branchlike.battle.sides[0].stats.deployed);
  check(after === before + 1, 'drag-and-drop deploys a unit');

  // Tap card, then tap deep in enemy territory: it drops at our line with a rally point there.
  await page.evaluate(() => { globalThis.__branchlike.battle.sides[0].supply = 10; });
  const before2 = await page.evaluate(() => globalThis.__branchlike.battle.sides[0].stats.deployed);
  await page.waitForTimeout(100);
  await page.click('.hand .card:not([data-kind=mech]):not([data-kind=hero]):not([data-kind=structure]):not([data-kind=strike])');
  await page.mouse.click(cv.x + cv.width * 0.5, cv.y + cv.height * 0.3);
  await page.waitForFunction(n => globalThis.__branchlike.battle.sides[0].stats.deployed > n, before2, { timeout: 3000 }).catch(() => {});
  const rallied = await page.evaluate(() => {
    const b = globalThis.__branchlike.battle;
    return { n: b.sides[0].stats.deployed, rally: b.ents.some(e => e.team === 0 && e.rally) };
  });
  check(rallied.n === before2 + 1 && rallied.rally, `tap on enemy ground deploys with a rally point`);

  // Tap card, then tap outside the battlefield: rejected with a message.
  await page.evaluate(() => { globalThis.__branchlike.battle.sides[0].supply = 10; });
  await page.waitForTimeout(100);
  await page.click('.hand .card:not([data-kind=mech]):not([data-kind=hero])');
  const before3 = await page.evaluate(() => globalThis.__branchlike.battle.sides[0].stats.deployed);
  await page.mouse.click(cv.x + 4, cv.y + 4);
  await page.waitForTimeout(150);
  const after3 = await page.evaluate(() => globalThis.__branchlike.battle.sides[0].stats.deployed);
  check(after3 === before3 && await page.isVisible('.stage .toast.bad'), 'tap outside the field is rejected with an error toast');
  await page.keyboard.press('Escape');

  // Let the battle run, then use the pilot ability.
  await page.evaluate(() => { const b = globalThis.__branchlike.battle; b.sides[0].pilotCd = 0; });
  await page.waitForTimeout(300);
  await page.click('.abtn');
  await page.waitForTimeout(200);
  const used = await page.evaluate(() => globalThis.__branchlike.battle.sides[0].stats.abilities);
  check(used === 1, 'pilot ability button works');
  await page.waitForTimeout(4000);
  await shot('07-battle-mid');

  // Pause menu
  await page.click('.hud-top .icon-btn');
  await page.waitForSelector('.overlay .dialog');
  await shot('08-pause');
  await page.click('text=Resume');
  check(!(await page.isVisible('.overlay')), 'pause and resume');

  // Fast-forward to a decisive end.
  await page.evaluate(() => globalThis.__branchlike.finishNow(true));
  await page.waitForSelector('.result-hero', { timeout: 40000 });
  await shot('09-results'); await noOverflow('results');
  const credits = await page.evaluate(() => globalThis.__branchlikeApp.profile.credits);
  check(credits >= 150, `first-clear credits awarded (${credits})`);

  // Reload: progress must persist and not be paid twice.
  await page.reload();
  await page.waitForSelector('.title-screen');
  const after2 = await page.evaluate(() => ({ c: globalThis.__branchlikeApp.profile.credits, cleared: globalThis.__branchlikeApp.profile.missions['m0_first_drop']?.cleared }));
  check(after2.c === credits && after2.cleared, 'progress survives reload without duplicate rewards');

  // Hangar upgrade
  await page.click('.title-foot .btn');
  await page.click('text=Hangar');
  await page.waitForSelector('.roster');
  await shot('10-hangar');
  await page.click('.roster .ucard:not(.locked) >> nth=0');
  await page.waitForSelector('.detail-art');
  await shot('11-unit-detail'); await noOverflow('unit detail');
  const upBtn = await page.$('button:has-text("Upgrade to level")');
  const c0 = await page.evaluate(() => globalThis.__branchlikeApp.profile.credits);
  if (upBtn && !(await upBtn.isDisabled())) {
    await upBtn.click();
    const c1 = await page.evaluate(() => globalThis.__branchlikeApp.profile.credits);
    check(c1 < c0, 'upgrade spends credits');
  } else fail('upgrade button available');
  await page.click('.topbar .icon-btn'); // back to hangar
  await page.click('text=Pilots');
  await shot('12-pilots');
  await page.click('.topbar .icon-btn'); // menu

  // Squad editing
  await page.click('text=Squad');
  await page.waitForSelector('.deck-slots');
  await page.click('.deck-slots .ucard >> nth=0'); // remove
  check((await page.$$('.deck-slots .slot-empty')).length === 1, 'removing a card leaves an empty slot');
  check(await page.isDisabled('text=Save squad'), 'cannot save an incomplete squad');
  await page.click('.roster .ucard:not(.locked):has-text("Hound")');
  check(!(await page.isDisabled('text=Save squad')), 'complete squad can be saved');
  await shot('13-squad');
  await page.click('text=Save squad');
  const deck = await page.evaluate(() => globalThis.__branchlikeApp.profile.deck);
  check(deck.includes('hound_apc'), 'squad change persisted to profile');

  // Settings
  await page.click('text=Settings');
  await page.waitForSelector('#set-music');
  await page.fill('#set-music', '20');
  await page.dispatchEvent('#set-music', 'input');
  await page.click('#set-ranges');
  const s = await page.evaluate(() => globalThis.__branchlikeApp.profile.settings);
  check(s.music === 0.2 && s.showRanges === false, 'settings apply and persist');
  await shot('14-settings');
  await page.click('.topbar .icon-btn');
  await page.click('text=Profile');
  await page.waitForSelector('#callsign');
  await shot('15-profile'); await noOverflow('profile');

  // Second mission battle starts with heavy cards locked
  await page.click('.topbar .icon-btn');
  await page.click('.menu-item.primary');
  await page.click('.mission:not(:disabled) >> nth=1');
  await page.click('text=Launch');
  await page.waitForSelector('.battle[data-view]', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await shot('16-battle-m1');
  const stats = await page.evaluate(() => globalThis.__branchlike.viewStats());
  check(stats && stats.calls < 250, `draw calls within mobile budget (${stats && stats.calls})`);

  // Landscape phone: the 3D view re-fits with the camera on the side and the compact tray
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1500);
  await shot('17-battle-landscape');
  const land = await page.evaluate(() => ({ tray: document.querySelector('.tray').offsetHeight, w: document.documentElement.scrollWidth - innerWidth }));
  check(land.tray <= 130 && land.w <= 0, `landscape layout is compact (tray ${land.tray}px)`);
  await page.setViewportSize({ width: 390, height: 844 });

  // 2D fallback renderer still works
  await page.goto(`http://localhost:${PORT}/index.html?debug=1&render=2d`);
  await page.click('.title-foot .btn');
  await page.click('.menu-item.primary');
  await page.click('.mission:not(:disabled) >> nth=0');
  await page.click('text=Launch');
  await page.waitForSelector('.battle[data-view]', { timeout: 15000 });
  check(await page.getAttribute('.battle', 'data-view') === '2d', '2D fallback renderer loads on request');
} catch (e) {
  fail('exception: ' + (e && e.message));
  await shot('zz-failure');
} finally {
  if (errors.length) { fail(`console errors:\n    ${errors.join('\n    ')}`); }
  else step('no console errors');
  await browser.close();
  server.close();
}
