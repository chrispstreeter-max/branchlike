import type { MissionDef } from './types.js';

export const CAMPAIGN_NAME = 'Chapter I · The Cinder Reach';

// Missions unlock in sequence. Rewards are data; progression code applies them.
export const MISSIONS: MissionDef[] = [
  {
    id: 'm0_first_drop', index: 0, name: 'First Drop', location: 'Relay Ridge',
    brief: 'Corsair command is dropping you onto Relay Ridge to learn the basics against a training detachment. Deploy, capture, hold.',
    objective: 'Reach 40 points by holding hardpoints.',
    mode: 'hardpoint', map: 'relay_ridge', scoreTarget: 40, timeLimit: 300, heavyUnlock: 30,
    enemyDeck: ['rifle_squad', 'rifle_squad', 'wasp_drone', 'hound_apc', 'rifle_squad', 'breaker_team', 'wasp_drone', 'bastion_turret'],
    enemyPilot: null, enemyLevel: 1, aiProfile: 'passive', aiEscalation: 0, tutorial: true, requires: null,
    firstClear: { credits: 150, xp: 80, unlockUnits: ['hound_apc', 'missile_strike'] }, repeat: { credits: 20, xp: 20 }, parTime: 180,
  },
  {
    id: 'm1_relay_ridge', index: 1, name: 'Relay Ridge', location: 'Relay Ridge',
    brief: 'Halcyon has moved a real detachment onto the ridge. Hold the relays long enough to bounce our signal out of the Reach.',
    objective: 'First to 100 points, or destroy the Halcyon spire.',
    mode: 'hardpoint', map: 'relay_ridge', scoreTarget: 100, timeLimit: 330, heavyUnlock: 60,
    enemyDeck: ['rifle_squad', 'wasp_drone', 'hound_apc', 'breaker_team', 'bastion_turret', 'rifle_squad', 'warden_frame', 'mortar_crawler'],
    enemyPilot: null, enemyLevel: 1, aiProfile: 'balanced', aiEscalation: 0.1, requires: 'm0_first_drop',
    firstClear: { credits: 220, xp: 140, unlockUnits: ['mortar_crawler', 'monolith', 'supply_depot'] }, repeat: { credits: 40, xp: 40 }, parTime: 240,
  },
  {
    id: 'm2_foundry_gate', index: 2, name: 'Foundry Gate', location: 'Foundry Gate',
    brief: 'The Directorate\'s foundry feeds every frame in the Reach. Push through the gate and level their spire.',
    objective: 'Destroy the Halcyon spire. Held hardpoints boost your supply.',
    mode: 'assault', map: 'foundry_gate', timeLimit: 360, heavyUnlock: 50,
    enemyDeck: ['rifle_squad', 'breaker_team', 'hound_apc', 'bastion_turret', 'mortar_crawler', 'warden_frame', 'wasp_drone', 'bastion_turret'],
    enemyPilot: 'dir_castellan', enemyLevel: 1, aiProfile: 'siege', aiEscalation: 0.25, requires: 'm1_relay_ridge',
    firstClear: { credits: 260, xp: 180, unlockUnits: ['mender_rig'], unlockPilots: ['ruk_okonkwo'] }, repeat: { credits: 50, xp: 50 }, parTime: 260,
  },
  {
    id: 'm3_kessel_holdout', index: 3, name: 'Holdout at Kessel', location: 'Kessel Yard',
    brief: 'Our evac trains need three minutes. Halcyon is throwing everything at the yard. Keep the spire standing.',
    objective: 'Survive 3:00 with your spire intact.',
    mode: 'defend', map: 'kessel_yard', timeLimit: 180, heavyUnlock: 40,
    enemyDeck: ['rifle_squad', 'hound_apc', 'breaker_team', 'warden_frame', 'mortar_crawler', 'wasp_drone', 'missile_strike', 'kestrel'],
    enemyPilot: 'dir_castellan', enemyLevel: 2, aiProfile: 'aggressive', aiEscalation: 0.4, requires: 'm2_foundry_gate',
    firstClear: { credits: 300, xp: 220, unlockUnits: ['vesper'], unlockPilots: ['sable_ito'] }, repeat: { credits: 60, xp: 60 }, parTime: 180,
  },
  {
    id: 'm4_iron_halberd', index: 4, name: 'The Iron Halberd', location: 'Foundry Gate',
    brief: 'Halcyon has fielded HALBERD PRIME, a prototype super-frame. Stop it before it reaches our spire.',
    objective: 'Destroy HALBERD PRIME. Protect your spire.',
    mode: 'boss', map: 'foundry_gate', timeLimit: 360, heavyUnlock: 20, boss: 'halberd_prime',
    enemyDeck: ['rifle_squad', 'breaker_team', 'mender_rig', 'hound_apc', 'wasp_drone', 'bastion_turret', 'rifle_squad', 'mender_rig'],
    enemyPilot: 'dir_castellan', enemyLevel: 2, aiProfile: 'balanced', aiEscalation: 0.55, requires: 'm3_kessel_holdout',
    firstClear: { credits: 360, xp: 260 }, repeat: { credits: 70, xp: 70 }, parTime: 240,
  },
  {
    id: 'm5_spire_approach', index: 5, name: 'Breach the Spire', location: 'Spire Approach',
    brief: 'One spire left between the Union and the Reach gate. Take the approach, then take it down.',
    objective: 'First to 100 points, or destroy the Halcyon spire.',
    mode: 'hardpoint', map: 'spire_approach', scoreTarget: 100, timeLimit: 360, heavyUnlock: 45,
    enemyDeck: ['rifle_squad', 'breaker_team', 'wasp_drone', 'hound_apc', 'missile_strike', 'warden_frame', 'monolith', 'supply_depot'],
    enemyPilot: 'dir_castellan', enemyLevel: 2, aiProfile: 'balanced', aiEscalation: 0.75, requires: 'm4_iron_halberd',
    firstClear: { credits: 500, xp: 400 }, repeat: { credits: 90, xp: 90 }, parTime: 280,
  },
];

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find(m => m.id === id);
}
