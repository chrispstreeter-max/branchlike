import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battle, forceHand, STD, deckOf } from './helpers.js';
import { createBattle, step, deploy, checkDeploy, runFor, coreOf, useAbility, DT, SUPPLY_MAX, SUPPLY_REGEN, entityById, canHit } from '../src/sim/battle.js';
import { MISSIONS } from '../src/data/missions.js';
import { UNITS, DAMAGE_TABLE } from '../src/data/units.js';
import { createAi, aiStep } from '../src/sim/ai.js';

test('battle starts with both spires and a hand of four', () => {
  const b = battle();
  assert.equal(b.ents.filter(e => e.def.kind === 'core').length, 2);
  assert.equal(b.sides[0].hand.length, 4);
  assert.equal(b.sides[0].hand.length + b.sides[0].queue.length, 8);
});

test('supply regenerates at the documented rate and caps at max', () => {
  const b = battle();
  const start = b.sides[0].supply;
  runFor(b, 2);
  assert.ok(Math.abs(b.sides[0].supply - (start + SUPPLY_REGEN * 2)) < 0.01);
  runFor(b, 30);
  assert.equal(b.sides[0].supply, SUPPLY_MAX);
});

test('deploying spends supply exactly once and cycles the hand', () => {
  const b = battle();
  b.sides[0].supply = 10;
  forceHand(b, 0, 'wasp_drone');
  const before = b.sides[0].hand[0];
  assert.equal(deploy(b, 0, 0, 180, 500), null);
  assert.equal(b.sides[0].supply, 10 - UNITS.wasp_drone.cost);
  assert.notEqual(b.sides[0].hand[0], before);
  assert.equal(b.sides[0].queue[b.sides[0].queue.length - 1], before);
});

test('invalid deployments are rejected cleanly without side effects', () => {
  const b = battle({ heavyUnlock: 60 });
  b.sides[0].supply = 10;
  forceHand(b, 0, 'rifle_squad');
  const n = b.ents.length;
  assert.equal(deploy(b, 0, 0, 180, 300), 'zone'); // enemy side of the line
  assert.equal(deploy(b, 0, 0, -50, 500), 'zone');
  assert.equal(deploy(b, 0, 9, 180, 500), 'no_card');
  forceHand(b, 0, 'warden_frame');
  assert.equal(deploy(b, 0, 0, 180, 500), 'locked');
  b.sides[0].supply = 1;
  forceHand(b, 0, 'rifle_squad');
  assert.equal(deploy(b, 0, 0, 180, 500), 'supply');
  assert.equal(b.ents.length, n);
  assert.equal(b.sides[0].supply, 1);
});

test('cannot deploy inside an obstacle', () => {
  const b = battle({ map: 'kessel_yard' });
  b.sides[0].supply = 10;
  forceHand(b, 0, 'rifle_squad');
  assert.equal(deploy(b, 0, 0, 180, 452), 'blocked');
  forceHand(b, 0, 'wasp_drone');
  assert.equal(checkDeploy(b, 0, 0, 180, 452), null, 'drones fly over obstacles');
});

test('hero frames are unique on the field', () => {
  const b = battle();
  b.sides[0].supply = 10;
  forceHand(b, 0, 'kestrel');
  assert.equal(deploy(b, 0, 0, 180, 500), null);
  b.sides[0].supply = 10;
  forceHand(b, 0, 'kestrel');
  assert.equal(checkDeploy(b, 0, 0, 180, 500), 'hero_active');
});

test('forward deployment is allowed only near a secured hardpoint', () => {
  const b = battle();
  b.sides[0].supply = 10;
  forceHand(b, 0, 'rifle_squad');
  const p = b.points[1];
  assert.equal(checkDeploy(b, 0, 0, p.x, p.y + 20), 'zone');
  p.cap = 100; p.owner = 0;
  assert.equal(checkDeploy(b, 0, 0, p.x, p.y + 20), null);
});

test('units only fire at targets inside weapon range', () => {
  const b = battle();
  b.sides[0].supply = 10; b.sides[1].supply = 10;
  forceHand(b, 0, 'bastion_turret'); deploy(b, 0, 0, 180, 470);
  forceHand(b, 1, 'bastion_turret'); deploy(b, 1, 0, 180, 170);
  const range = UNITS.bastion_turret.weapon!.range;
  for (let i = 0; i < 40; i++) {
    step(b);
    for (const ev of b.events) if (ev.type === 'shot') {
      const d = Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1);
      assert.ok(d <= range + 30, `shot of ${d.toFixed(0)} exceeds range`);
    }
  }
  const t = b.ents.filter(e => e.def.id === 'bastion_turret');
  assert.ok(t.every(e => e.hp > e.maxHp - 30), 'turrets 300 apart should not damage each other (only decay)');
});

test('anti-armour cannot hit drones; kinetic can', () => {
  const b = battle();
  b.sides[0].supply = 10;
  forceHand(b, 0, 'wasp_drone'); deploy(b, 0, 0, 180, 500);
  const drone = b.ents.find(e => e.def.id === 'wasp_drone')!;
  assert.equal(canHit(UNITS.breaker_team.weapon, drone), false);
  assert.equal(canHit(UNITS.rifle_squad.weapon, drone), true);
  assert.equal(canHit(UNITS.mortar_crawler.weapon, drone), false);
});

test('counter table: breakers deal far more to armour than rifles do', () => {
  const rifleVsArmor = UNITS.rifle_squad.weapon!.damage * DAMAGE_TABLE.kinetic.armored / UNITS.rifle_squad.weapon!.cooldown;
  const breakerVsArmor = UNITS.breaker_team.weapon!.damage * DAMAGE_TABLE.antiarmor.armored / UNITS.breaker_team.weapon!.cooldown;
  assert.ok(breakerVsArmor > rifleVsArmor * 5);
  // Per supply spent, rifles are the better answer to infantry.
  const perCost = (id: 'rifle_squad' | 'breaker_team', type: 'kinetic' | 'antiarmor') => UNITS[id].weapon!.damage * DAMAGE_TABLE[type].light / UNITS[id].weapon!.cooldown * (UNITS[id].squad ?? 1) / UNITS[id].cost;
  assert.ok(perCost('rifle_squad', 'kinetic') > perCost('breaker_team', 'antiarmor') * 1.5);
});

test('a heavy frame does not automatically beat cheaper anti-armour', () => {
  // 1 Warden (6 supply) vs 2 Breaker Teams (6 supply) placed in contact range.
  let breakerWins = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const b = battle({}, seed);
    b.sides[0].supply = 10; b.sides[1].supply = 10;
    forceHand(b, 0, 'warden_frame'); deploy(b, 0, 0, 180, 450);
    forceHand(b, 1, 'breaker_team'); deploy(b, 1, 0, 160, 190);
    b.sides[1].supply = 10; forceHand(b, 1, 'breaker_team'); deploy(b, 1, 0, 200, 190);
    for (const e of b.ents) if (e.def.kind === 'core') e.hp = 1e9;
    const alive = (id: string) => b.ents.some(e => e.def.id === id);
    for (let i = 0; i < 1200 && alive('warden_frame') && alive('breaker_team'); i++) step(b);
    const w = alive('warden_frame'), br = alive('breaker_team');
    if (br && !w) breakerWins++;
  }
  assert.ok(breakerWins >= 6, `breakers won ${breakerWins}/10`);
});

test('hardpoints change ownership only when uncontested, and neutralise before flipping', () => {
  const b = battle();
  const p = b.points[1];
  b.sides[0].supply = 10;
  forceHand(b, 0, 'wasp_drone'); deploy(b, 0, 0, p.x, 460);
  const drone = b.ents.find(e => e.def.id === 'wasp_drone')!;
  // teleport onto the point and hold it there
  for (let i = 0; i < 200 && p.owner !== 0; i++) { drone.x = p.x; drone.y = p.y; step(b); }
  assert.equal(p.owner, 0);
  assert.equal(p.cap, 100);
  // enemy contests: no progress while both present
  b.sides[1].supply = 10; forceHand(b, 1, 'wasp_drone'); deploy(b, 1, 0, p.x, 190);
  const foe = b.ents.find(e => e.def.id === 'wasp_drone' && e.team === 1)!;
  for (let i = 0; i < 10; i++) { drone.x = p.x; drone.y = p.y; drone.hp = drone.maxHp; foe.x = p.x + 4; foe.y = p.y; foe.hp = foe.maxHp; step(b); }
  assert.equal(p.cap, 100);
  // remove ours: enemy neutralises (owner cleared at 0) then captures
  drone.hp = 0; step(b);
  let sawNeutral = false;
  for (let i = 0; i < 400 && p.owner !== 1; i++) { foe.x = p.x; foe.y = p.y; foe.hp = foe.maxHp; step(b); if (p.owner === null) sawNeutral = true; }
  assert.ok(sawNeutral);
  assert.equal(p.owner, 1);
});

test('score accrues from held points and ends a hardpoint battle at the target', () => {
  const b = battle({ scoreTarget: 10 });
  for (const p of b.points) { p.cap = 100; p.owner = 0; }
  runFor(b, 30);
  assert.ok(b.result);
  assert.equal(b.result!.winner, 0);
  assert.equal(b.result!.reason, 'score');
  assert.ok(Math.abs(b.result!.time - 10 * 4 / 3) < 0.2);
});

test('destroying a spire ends the battle for its owner', () => {
  const b = battle();
  coreOf(b, 1)!.hp = 1;
  b.sides[0].supply = 10; forceHand(b, 0, 'wasp_drone'); deploy(b, 0, 0, 180, 450);
  b.ents.find(e => e.def.id === 'wasp_drone')!.y = 80;
  runFor(b, 5);
  assert.deepEqual(b.result && [b.result.winner, b.result.reason], [0, 'core']);
});

test('defend mode is won by surviving and lost when the spire falls', () => {
  const m = MISSIONS.find(m => m.mode === 'defend')!;
  const b1 = createBattle({ mission: { ...m, timeLimit: 3 }, seed: 1, player: { deck: deckOf(STD), pilot: null }, enemy: { deck: deckOf(STD), pilot: null } });
  runFor(b1, 5);
  assert.deepEqual([b1.result?.winner, b1.result?.reason], [0, 'survived']);
  const b2 = createBattle({ mission: m, seed: 1, player: { deck: deckOf(STD), pilot: null }, enemy: { deck: deckOf(STD), pilot: null } });
  coreOf(b2, 0)!.hp = 0.01;
  b2.sides[1].supply = 10; forceHand(b2, 1, 'wasp_drone'); deploy(b2, 1, 0, 180, 150);
  b2.ents.find(e => e.def.id === 'wasp_drone')!.y = 560;
  runFor(b2, 5);
  assert.deepEqual([b2.result?.winner, b2.result?.reason], [1, 'core']);
});

test('boss mission is won by destroying the boss', () => {
  const m = MISSIONS.find(m => m.mode === 'boss')!;
  const b = createBattle({ mission: m, seed: 1, player: { deck: deckOf(STD), pilot: null }, enemy: { deck: deckOf(STD), pilot: null } });
  const boss = entityById(b, b.bossId)!;
  assert.equal(boss.def.kind, 'boss');
  boss.hp = 0;
  step(b);
  assert.deepEqual([b.result?.winner, b.result?.reason], [0, 'boss']);
});

test('timeouts resolve: hardpoint draw is not a player win', () => {
  const b = battle({ timeLimit: 1 });
  runFor(b, 3);
  assert.equal(b.result?.reason, 'timeout');
  assert.equal(b.result?.winner, null);
});

test('pilot ability: cooldown is enforced and EMP stuns enemies in radius only', () => {
  const b = battle({}, 1, STD, STD, ['sable_ito', null]);
  b.sides[1].supply = 10; forceHand(b, 1, 'rifle_squad'); deploy(b, 1, 0, 180, 190);
  assert.equal(useAbility(b, 0, 'pilot', 180, 190), 'cooldown'); // starts on cooldown
  b.sides[0].pilotCd = 0;
  assert.equal(useAbility(b, 0, 'pilot'), 'needs_target');
  assert.equal(useAbility(b, 0, 'pilot', 180, 190), null);
  const foes = b.ents.filter(e => e.team === 1 && e.def.id === 'rifle_squad');
  assert.ok(foes.every(e => e.stun > 3));
  assert.ok(coreOf(b, 1)!.stun === 0, 'spires are immune to EMP');
  assert.equal(useAbility(b, 0, 'pilot', 180, 190), 'cooldown');
});

test('hero ability requires the hero on the field and respects range', () => {
  const b = battle();
  b.sides[0].supply = 10; forceHand(b, 0, 'kestrel'); deploy(b, 0, 0, 180, 500);
  const k = b.ents.find(e => e.def.id === 'kestrel')!;
  k.abilityCd = 0;
  assert.equal(useAbility(b, 0, k.id, 180, 50), 'out_of_range');
  assert.equal(useAbility(b, 1, k.id, 180, 400), 'no_unit');
  assert.equal(useAbility(b, 0, k.id, 180, 400), null);
  assert.ok(k.abilityCd > 0);
});

test('simulation is deterministic for the same seed and inputs', () => {
  const run = (seed: number) => {
    const m = MISSIONS[1];
    const b = createBattle({ mission: m, seed, player: { deck: deckOf(STD), pilot: 'juno_vale' }, enemy: { deck: deckOf(m.enemyDeck), pilot: null } });
    const a = createAi(b, 0, 'veteran'), e = createAi(b, 1, 'veteran');
    while (!b.result) { aiStep(a, b); aiStep(e, b); step(b); }
    return JSON.stringify([b.result, b.sides.map(s => s.stats), b.ents.length]);
  };
  assert.equal(run(42), run(42));
  assert.notEqual(run(42), run(43));
});

test('full AI-vs-AI battles always finish on every mission', () => {
  for (const m of MISSIONS) {
    const b = createBattle({ mission: m, seed: 7, player: { deck: deckOf(STD), pilot: 'juno_vale' }, enemy: { deck: deckOf(m.enemyDeck, m.enemyLevel), pilot: m.enemyPilot } });
    const a = createAi(b, 0, 'veteran'), e = createAi(b, 1, 'veteran');
    let steps = 0;
    while (!b.result && steps < (m.timeLimit + 5) / DT) { aiStep(a, b); aiStep(e, b); step(b); steps++; }
    assert.ok(b.result, `${m.id} did not finish`);
    assert.ok(b.sides[0].stats.deployed > 3 && b.sides[1].stats.deployed > 3, `${m.id}: both sides should deploy`);
  }
});
