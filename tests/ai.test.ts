import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckOf, STD, forceHand } from './helpers.js';
import { createBattle, step, deploy } from '../src/sim/battle.js';
import { createAi, aiStep, DIFFICULTY, type AiState } from '../src/sim/ai.js';
import { MISSIONS } from '../src/data/missions.js';
import type { Difficulty } from '../src/data/types.js';

function mirror(d0: Difficulty, d1: Difficulty, seeds: number) {
  let w0 = 0;
  const counts: AiState['counts'][] = [];
  for (let s = 1; s <= seeds; s++) {
    const b = createBattle({ mission: MISSIONS[1], seed: s * 101, player: { deck: deckOf(STD), pilot: null }, enemy: { deck: deckOf(STD), pilot: null } });
    const a = createAi(b, 0, d0), e = createAi(b, 1, d1);
    while (!b.result) { aiStep(a, b); aiStep(e, b); step(b); }
    if (b.result.winner === 0) w0++;
    counts.push(e.counts);
  }
  return { w0, counts };
}

test('difficulty knobs differ in behaviour, not in stats', () => {
  const r = DIFFICULTY.recruit, v = DIFFICULTY.veteran, e = DIFFICULTY.elite;
  assert.ok(r.interval > v.interval && v.interval > e.interval);
  assert.ok(r.noise > v.noise && v.noise > e.noise);
  assert.ok(r.counter < v.counter && v.counter < e.counter);
  assert.ok(r.impulse > v.impulse && v.impulse > e.impulse);
});

test('elite beats recruit clearly in a mirror match, from either side', () => {
  const a = mirror('elite', 'recruit', 12);
  const b = mirror('recruit', 'elite', 12);
  assert.ok(a.w0 >= 8, `elite as team 0 won ${a.w0}/12`);
  assert.ok(b.w0 <= 4, `recruit as team 0 won ${b.w0}/12`);
});

test('AI thinks more often at higher difficulty', () => {
  const run = (d: Difficulty) => {
    const m = MISSIONS[3];
    const b = createBattle({ mission: m, seed: 5, player: { deck: deckOf(STD), pilot: 'juno_vale' }, enemy: { deck: deckOf(m.enemyDeck), pilot: m.enemyPilot } });
    const p = createAi(b, 0, 'veteran'), ai = createAi(b, 1, d);
    for (let i = 0; i < 20 * 120 && !b.result; i++) { aiStep(p, b); aiStep(ai, b); step(b); }
    return ai.counts;
  };
  const r = run('recruit'), e = run('elite');
  assert.ok(e.deploys + e.waits + e.abilities > r.deploys + r.waits + r.abilities);
});

test('AI deploys to defend its spire when it is threatened', () => {
  const b = createBattle({ mission: { ...MISSIONS[1], heavyUnlock: 0 }, seed: 3, player: { deck: deckOf(STD), pilot: null }, enemy: { deck: deckOf(STD), pilot: null } });
  for (let k = 0; k < 3; k++) {
    b.sides[0].supply = 10;
    forceHand(b, 0, 'rifle_squad');
    deploy(b, 0, 0, 180, 500);
  }
  for (const e of b.ents) if (e.team === 0 && e.def.id === 'rifle_squad') { e.y = 150; e.hp = 1e6; e.maxHp = 1e6; }
  const ai = createAi(b, 1, 'elite');
  b.sides[1].supply = 10;
  for (let i = 0; i < 60; i++) { aiStep(ai, b); step(b); }
  assert.ok(ai.counts.defends > 0, ai.log.join('\n'));
});

test('AI counters an armour-heavy opponent with anti-armour', () => {
  let anti = 0, total = 0;
  const armour = ['warden_frame', 'warden_frame', 'hound_apc', 'hound_apc', 'mortar_crawler', 'mortar_crawler', 'mender_rig', 'mender_rig'];
  const mixed = ['rifle_squad', 'rifle_squad', 'breaker_team', 'breaker_team', 'hound_apc', 'wasp_drone', 'wasp_drone', 'bastion_turret'];
  for (let s = 1; s <= 6; s++) {
    const b = createBattle({ mission: { ...MISSIONS[1], heavyUnlock: 0 }, seed: s, player: { deck: deckOf(armour), pilot: null }, enemy: { deck: deckOf(mixed), pilot: null } });
    const p = createAi(b, 0, 'veteran'), ai = createAi(b, 1, 'elite');
    for (let i = 0; i < 20 * 150 && !b.result; i++) { aiStep(p, b); aiStep(ai, b); step(b); }
    for (const l of ai.log) if (l.includes(' deploy ')) { total++; if (l.includes('breaker_team')) anti++; }
  }
  // Breakers are 25% of the deck; against armour the AI should pick them more than that.
  assert.ok(anti / total > 0.3, `breakers were ${(100 * anti / total).toFixed(0)}% of deploys`);
});

test('AI never cheats: it cannot deploy without supply', () => {
  const b = createBattle({ mission: MISSIONS[1], seed: 9, player: { deck: deckOf(STD), pilot: null }, enemy: { deck: deckOf(STD), pilot: null } });
  const ai = createAi(b, 1, 'elite');
  for (let i = 0; i < 20 * 200 && !b.result; i++) {
    aiStep(ai, b);
    assert.ok(b.sides[1].supply >= -1e-9, 'supply went negative');
    step(b);
  }
});
