// Shared content types. All game content is data; the engine reads these
// definitions and never hard-codes individual units, pilots or missions.

export type Team = 0 | 1; // 0 = player (Corsair Union), 1 = enemy (Halcyon Directorate)
export type ArmorClass = 'light' | 'armored' | 'structure' | 'air';
export type WeaponType = 'kinetic' | 'antiarmor' | 'explosive' | 'energy';
export type UnitKind = 'infantry' | 'drone' | 'vehicle' | 'mech' | 'hero' | 'structure' | 'boss' | 'core' | 'strike';
export type Role = 'capture' | 'assault' | 'antiarmor' | 'artillery' | 'support' | 'defense' | 'scout' | 'hero' | 'boss' | 'core' | 'strike' | 'economy';

export interface WeaponDef {
  type: WeaponType;
  damage: number;
  range: number;
  minRange?: number;
  cooldown: number; // seconds between shots
  splash?: number; // radius of area damage
  hitsAir: boolean;
  shellTime?: number; // >0 = delayed shell (artillery)
}

export interface HealDef { amount: number; range: number; cooldown: number }

export type AbilityId = 'salvo' | 'aegis' | 'railLance' | 'overclock' | 'barrage' | 'emp' | 'quake';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  desc: string;
  cooldown: number;
  targeted: boolean; // needs a battlefield point
  radius?: number;
}

export interface UnitDef {
  id: string;
  name: string;
  role: Role;
  roleLabel: string;
  desc: string;
  kind: UnitKind;
  cost: number;
  hp: number;
  armor: ArmorClass;
  speed: number;
  radius: number;
  height: number;
  squad?: number; // number of bodies deployed per card
  capture: number; // capture power, 0 = cannot capture
  weapon?: WeaponDef;
  heal?: HealDef;
  decay?: number; // hp lost per second (temporary structures)
  ability?: AbilityId;
  hero?: boolean; // unique on the field, delayed clearance
  heavy?: boolean; // needs frame clearance (unlock time)
  deployable: boolean; // false for cores and bosses
  holdAtRally?: boolean; // stays at its rally point instead of resuming normal behaviour
  strike?: { damage: number; radius: number; delay: number; type: WeaponType; count: number }; // one-shot card, lands anywhere
  supplyBoost?: number; // structures that raise supply regeneration while alive
}

export interface PilotDef {
  id: string;
  name: string;
  callsign: string;
  bio: string;
  passive: { id: 'supply' | 'fortify' | 'capture'; label: string; value: number };
  ability: AbilityId;
}

export interface PointDef { id: string; x: number; y: number }
export interface ObstacleDef { x: number; y: number; r: number }

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  points: PointDef[];
  obstacles: ObstacleDef[];
  palette: 'dust' | 'foundry' | 'ice' | 'night';
}

export type MissionMode = 'hardpoint' | 'assault' | 'defend' | 'boss';

export interface MissionReward {
  credits: number;
  xp: number;
  unlockUnits?: string[];
  unlockPilots?: string[];
}

export interface MissionDef {
  id: string;
  index: number;
  name: string;
  location: string;
  brief: string;
  objective: string;
  mode: MissionMode;
  map: string;
  scoreTarget?: number; // hardpoint mode
  timeLimit: number; // seconds; for defend = survive time
  heavyUnlock: number; // seconds before heavy units / heroes are cleared
  enemyDeck: string[];
  enemyPilot: string | null;
  enemyLevel: number; // upgrade level of enemy units
  aiProfile: 'passive' | 'balanced' | 'aggressive' | 'siege';
  aiEscalation: number; // 0..1 added to AI decision quality across the campaign
  boss?: string;
  tutorial?: boolean;
  requires: string | null; // mission id that must be cleared first
  firstClear: MissionReward;
  repeat: MissionReward;
  parTime: number; // seconds for the third star
}

export type Difficulty = 'recruit' | 'veteran' | 'elite';
