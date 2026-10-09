// Headless AI-vs-AI runs for balance checks: `npm run sim`.
// Both sides are driven by the same AI; we flip which side gets which deck.
import { MISSIONS } from '../src/data/missions.js';
import { createBattle, step, type DeckCard } from '../src/sim/battle.js';
import { createAi, aiStep } from '../src/sim/ai.js';
import type { Difficulty } from '../src/data/types.js';

const deckIds = ['rifle_squad', 'rifle_squad', 'breaker_team', 'wasp_drone', 'bastion_turret', 'warden_frame', 'kestrel', 'breaker_team'];

function run(missionIdx: number, seed: number, pd: Difficulty, ed: Difficulty) {
  const mission = MISSIONS[missionIdx];
  const b = createBattle({ mission, seed, player: { deck: deckIds.map(unit => ({ unit, level: 1 + Math.floor(missionIdx / 2) })) as DeckCard[], pilot: 'juno_vale' }, enemy: { deck: mission.enemyDeck.map(unit => ({ unit, level: mission.enemyLevel })), pilot: mission.enemyPilot } });
  const p = createAi(b, 0, pd), e = createAi(b, 1, ed);
  while (!b.result) { aiStep(p, b); aiStep(e, b); step(b); }
  return { r: b.result, score: b.sides.map(s => Math.floor(s.score)), p: p.counts, e: e.counts };
}

for (const mi of [1, 2, 3, 4, 5]) {
  for (const [pd, ed] of [['veteran', 'recruit'], ['veteran', 'veteran'], ['elite', 'veteran'], ['veteran', 'elite']] as [Difficulty, Difficulty][]) {
    let wins = 0, t = 0; const n = 20; const reasons: Record<string, number> = {};
    for (let s = 1; s <= n; s++) { const o = run(mi, s * 7919, pd, ed); if (o.r!.winner === 0) wins++; t += o.r!.time; reasons[o.r!.reason] = (reasons[o.r!.reason] ?? 0) + 1; }
    console.log(`${MISSIONS[mi].id.padEnd(20)} player AI ${pd.padEnd(7)} vs ${ed.padEnd(7)}  player wins ${wins}/${n}  avg ${(t / n).toFixed(0)}s  ${JSON.stringify(reasons)}`);
  }
}
