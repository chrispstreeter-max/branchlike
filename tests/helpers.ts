import { MISSIONS } from '../src/data/missions.js';
import type { MissionDef } from '../src/data/types.js';
import { createBattle, type Battle, type DeckCard } from '../src/sim/battle.js';

export const deckOf = (ids: string[], level = 1): DeckCard[] => ids.map(unit => ({ unit, level }));
export const STD = ['rifle_squad', 'rifle_squad', 'breaker_team', 'wasp_drone', 'bastion_turret', 'warden_frame', 'kestrel', 'breaker_team'];

/** A sandbox mission: hardpoint rules, no heavy lock, long timer. */
export function sandboxMission(over: Partial<MissionDef> = {}): MissionDef {
  return { ...MISSIONS[1], heavyUnlock: 0, timeLimit: 9999, scoreTarget: 100, ...over };
}

export function battle(over: Partial<MissionDef> = {}, seed = 1, player = STD, enemy = STD, pilots: [string | null, string | null] = [null, null]): Battle {
  return createBattle({ mission: sandboxMission(over), seed, player: { deck: deckOf(player), pilot: pilots[0] }, enemy: { deck: deckOf(enemy), pilot: pilots[1] } });
}

/** Put a specific card in hand slot 0 for a team. */
export function forceHand(b: Battle, team: 0 | 1, unit: string) {
  const side = b.sides[team];
  const idx = side.deck.findIndex(c => c.unit === unit);
  if (idx < 0) throw new Error(`deck has no ${unit}`);
  const at = side.hand.indexOf(idx);
  if (at >= 0) { [side.hand[0], side.hand[at]] = [side.hand[at], side.hand[0]]; return; }
  const q = side.queue.indexOf(idx);
  side.queue[q] = side.hand[0];
  side.hand[0] = idx;
}
