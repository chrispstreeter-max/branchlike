import type { UnitDef, AbilityDef, AbilityId, ArmorClass, WeaponType } from './types.js';

// Damage multipliers: weapon type × target armour. This table is the core of
// the counter system: rifles shred infantry but bounce off armour, breaker
// rockets crack frames but cannot track drones, shells punish clumps.
export const DAMAGE_TABLE: Record<WeaponType, Record<ArmorClass, number>> = {
  kinetic:   { light: 1.0, air: 0.75, armored: 0.45, structure: 0.5 },
  antiarmor: { light: 0.4, air: 0, armored: 1.8, structure: 1.3 },
  explosive: { light: 1.3, air: 0, armored: 0.8, structure: 1.1 },
  energy:    { light: 1.0, air: 1.0, armored: 1.0, structure: 0.9 },
};

export const UNITS: Record<string, UnitDef> = {
  rifle_squad: {
    id: 'rifle_squad', name: 'Rifle Squad', role: 'capture', roleLabel: 'Infantry · Capture',
    desc: 'Three Union riflemen. Cheap, quick to cap, strong against infantry and drones. Weak against armour.',
    kind: 'infantry', cost: 2, hp: 62, armor: 'light', speed: 30, radius: 5, height: 9, squad: 3, capture: 1,
    weapon: { type: 'kinetic', damage: 6, range: 72, cooldown: 0.6, hitsAir: true }, deployable: true,
  },
  breaker_team: {
    id: 'breaker_team', name: 'Breaker Team', role: 'antiarmor', roleLabel: 'Infantry · Anti-armour',
    desc: 'Two-person rocket team. Cracks vehicles and frames. Cannot hit drones and struggles against riflemen.',
    kind: 'infantry', cost: 3, hp: 110, armor: 'light', speed: 26, radius: 5, height: 9, squad: 2, capture: 1,
    weapon: { type: 'antiarmor', damage: 40, range: 100, cooldown: 1.6, hitsAir: false }, deployable: true,
  },
  wasp_drone: {
    id: 'wasp_drone', name: 'Wasp Drone', role: 'scout', roleLabel: 'Drone · Scout',
    desc: 'Fast recon drone. Caps twice as fast as infantry and ignores rockets and shells. Fragile.',
    kind: 'drone', cost: 2, hp: 130, armor: 'air', speed: 72, radius: 6, height: 22, capture: 2,
    weapon: { type: 'kinetic', damage: 8, range: 60, cooldown: 0.4, hitsAir: true }, deployable: true,
  },
  hound_apc: {
    id: 'hound_apc', name: 'Hound', role: 'assault', roleLabel: 'Vehicle · Assault',
    desc: 'Armoured fast-attack car with a chain gun. Hunts infantry and drones. Vulnerable to breakers.',
    kind: 'vehicle', cost: 4, hp: 520, armor: 'armored', speed: 44, radius: 10, height: 10, capture: 0,
    weapon: { type: 'kinetic', damage: 12, range: 82, cooldown: 0.35, hitsAir: true }, deployable: true,
  },
  mortar_crawler: {
    id: 'mortar_crawler', name: 'Mortar Crawler', role: 'artillery', roleLabel: 'Vehicle · Artillery',
    desc: 'Tracked mortar. Lobs shells over cover from long range. Has a blind spot up close.',
    kind: 'vehicle', cost: 4, hp: 260, armor: 'armored', speed: 18, radius: 10, height: 11, capture: 0,
    weapon: { type: 'explosive', damage: 34, range: 178, minRange: 52, splash: 22, cooldown: 3.0, hitsAir: false, shellTime: 0.8 },
    deployable: true,
  },
  mender_rig: {
    id: 'mender_rig', name: 'Mender Rig', role: 'support', roleLabel: 'Vehicle · Support',
    desc: 'Repair walker. Restores nearby units and frames. Unarmed.',
    kind: 'vehicle', cost: 3, hp: 280, armor: 'armored', speed: 30, radius: 8, height: 12, capture: 0,
    heal: { amount: 24, range: 72, cooldown: 1 }, deployable: true,
  },
  bastion_turret: {
    id: 'bastion_turret', name: 'Bastion Turret', role: 'defense', roleLabel: 'Structure · Defence',
    desc: 'Drop-in autoturret. Locks down a hardpoint for about a minute, then burns out.',
    kind: 'structure', cost: 4, hp: 620, armor: 'structure', speed: 0, radius: 9, height: 12, capture: 0, decay: 7,
    weapon: { type: 'kinetic', damage: 14, range: 126, cooldown: 0.35, hitsAir: true }, deployable: true,
  },
  warden_frame: {
    id: 'warden_frame', name: 'Warden Frame', role: 'assault', roleLabel: 'Mech · Line frame',
    desc: 'Standard Union line mech. Tough, steady autocannon. Breaker teams and anti-armour frames take it apart.',
    kind: 'mech', cost: 6, hp: 1400, armor: 'armored', speed: 16, radius: 15, height: 30, capture: 0, heavy: true,
    weapon: { type: 'kinetic', damage: 34, range: 96, cooldown: 0.9, hitsAir: true }, deployable: true,
  },
  // ---- hero frames ----
  kestrel: {
    id: 'kestrel', name: 'KESTREL-9', role: 'hero', roleLabel: 'Hero frame · Skirmisher',
    desc: 'Fast duelling frame with an arc carbine. Ability: Rocket Salvo saturates a target area.',
    kind: 'hero', cost: 7, hp: 1600, armor: 'armored', speed: 34, radius: 14, height: 30, capture: 0,
    hero: true, heavy: true, ability: 'salvo',
    weapon: { type: 'energy', damage: 24, range: 112, cooldown: 0.55, hitsAir: true }, deployable: true,
  },
  monolith: {
    id: 'monolith', name: 'MONOLITH', role: 'hero', roleLabel: 'Hero frame · Juggernaut',
    desc: 'Siege-plate juggernaut with a breach cannon. Ability: Aegis Dome cuts damage to nearby allies by 60%.',
    kind: 'hero', cost: 8, hp: 2800, armor: 'armored', speed: 14, radius: 18, height: 34, capture: 0,
    hero: true, heavy: true, ability: 'aegis',
    weapon: { type: 'antiarmor', damage: 70, range: 92, cooldown: 1.4, hitsAir: false }, deployable: true,
  },
  vesper: {
    id: 'vesper', name: 'VESPER', role: 'hero', roleLabel: 'Hero frame · Marksman',
    desc: 'Long-limbed rail frame with the longest reach of any frame. Ability: Rail Lance pierces every enemy in a line.',
    kind: 'hero', cost: 7, hp: 1200, armor: 'armored', speed: 24, radius: 13, height: 36, capture: 0,
    hero: true, heavy: true, ability: 'railLance',
    weapon: { type: 'antiarmor', damage: 110, range: 128, cooldown: 2.4, hitsAir: false }, deployable: true,
  },
  // ---- non-deployable ----
  core: {
    id: 'core', name: 'Command Spire', role: 'core', roleLabel: 'Base',
    desc: 'Forward command spire with a heavy defence cannon. Lose it and you lose the battle.',
    kind: 'core', cost: 0, hp: 7000, armor: 'structure', speed: 0, radius: 22, height: 30, capture: 0,
    weapon: { type: 'kinetic', damage: 32, range: 136, cooldown: 0.8, hitsAir: true }, deployable: false,
  },
  halberd_prime: {
    id: 'halberd_prime', name: 'HALBERD PRIME', role: 'boss', roleLabel: 'Directorate super-frame',
    desc: 'Halcyon prototype siege frame. Twin mortars, reactive plating and a ground-quake stomp.',
    kind: 'boss', cost: 0, hp: 6000, armor: 'armored', speed: 6, radius: 26, height: 44, capture: 0, ability: 'quake',
    weapon: { type: 'explosive', damage: 38, range: 142, splash: 28, cooldown: 2.2, hitsAir: false, shellTime: 0.6 },
    deployable: false,
  },
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  salvo: { id: 'salvo', name: 'Rocket Salvo', desc: 'Six rockets hit the target area for heavy explosive damage.', cooldown: 20, targeted: true, radius: 42 },
  aegis: { id: 'aegis', name: 'Aegis Dome', desc: 'Allies near Monolith take 60% less damage for 6 seconds.', cooldown: 25, targeted: false, radius: 76 },
  railLance: { id: 'railLance', name: 'Rail Lance', desc: 'Fires a piercing beam toward the target point, hitting every enemy in the line.', cooldown: 18, targeted: true, radius: 12 },
  overclock: { id: 'overclock', name: 'Overclock', desc: 'Your units fire 35% faster for 7 seconds.', cooldown: 45, targeted: false },
  barrage: { id: 'barrage', name: 'Barrage', desc: 'Calls five artillery shells onto the target area.', cooldown: 40, targeted: true, radius: 52 },
  emp: { id: 'emp', name: 'EMP Lance', desc: 'Stuns all enemies in the area for 3.5 seconds.', cooldown: 50, targeted: true, radius: 60 },
  quake: { id: 'quake', name: 'Ground Quake', desc: 'Stomp that damages and stuns everything nearby.', cooldown: 14, targeted: false, radius: 70 },
};

/** Level scaling for upgrades: +8% health and damage per level above 1. */
export function levelMultiplier(level: number): number {
  return 1 + 0.08 * (Math.max(1, Math.min(5, level)) - 1);
}

export const MAX_UNIT_LEVEL = 5;
export function upgradeCost(currentLevel: number): number {
  return 120 * currentLevel;
}
