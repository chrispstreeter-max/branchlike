// Persistent player progression. Pure functions over a plain Profile object,
// so they can be unit-tested and saved as JSON.

import type { Difficulty, MissionDef } from '../data/types.js';
import { MISSIONS, missionById } from '../data/missions.js';
import { UNITS, MAX_UNIT_LEVEL, upgradeCost } from '../data/units.js';
import { PILOTS, PLAYER_PILOTS } from '../data/pilots.js';
import type { DeckCard } from '../sim/battle.js';

export const PROFILE_VERSION = 1;
export const DECK_SIZE = 8;
export const START_UNITS = ['rifle_squad', 'breaker_team', 'wasp_drone', 'bastion_turret', 'warden_frame', 'kestrel'];
export const DEFAULT_DECK = ['rifle_squad', 'rifle_squad', 'breaker_team', 'wasp_drone', 'bastion_turret', 'warden_frame', 'kestrel', 'breaker_team'];
const DIFFICULTY_REWARD: Record<Difficulty, number> = { recruit: 0.75, veteran: 1, elite: 1.5 };

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  showRanges: boolean;
  reduceMotion: boolean;
  difficulty: Difficulty;
}

export interface MissionRecord { cleared: boolean; stars: number; bestTime: number; plays: number; wins: number; bestDifficulty: Difficulty | null }

export interface Profile {
  version: number;
  callsign: string;
  createdAt: number;
  xp: number;
  level: number;
  credits: number;
  unlockedUnits: string[];
  unitLevels: Record<string, number>;
  unlockedPilots: string[];
  pilot: string;
  deck: string[];
  missions: Record<string, MissionRecord>;
  claimedFirstClear: string[];
  appliedBattles: string[];
  stats: { battles: number; wins: number; kills: number; deployed: number };
  tutorialSeen: boolean;
  settings: Settings;
}

export function defaultSettings(): Settings {
  return { music: 0.5, sfx: 0.8, showRanges: true, reduceMotion: false, difficulty: 'veteran' };
}

export function newProfile(now = Date.now()): Profile {
  return {
    version: PROFILE_VERSION, callsign: 'Commander', createdAt: now,
    xp: 0, level: 1, credits: 0,
    unlockedUnits: [...START_UNITS],
    unitLevels: Object.fromEntries(START_UNITS.map(u => [u, 1])),
    unlockedPilots: ['juno_vale'], pilot: 'juno_vale',
    deck: [...DEFAULT_DECK],
    missions: {}, claimedFirstClear: [], appliedBattles: [],
    stats: { battles: 0, wins: 0, kills: 0, deployed: 0 },
    tutorialSeen: false,
    settings: defaultSettings(),
  };
}

// ---------------------------------------------------------------- levels

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number { return 100 + 60 * (level - 1); }

export function levelProgress(p: Profile): { level: number; into: number; need: number } {
  return { level: p.level, into: p.xp - totalXpFor(p.level), need: xpToNext(p.level) };
}
function totalXpFor(level: number): number { let t = 0; for (let l = 1; l < level; l++) t += xpToNext(l); return t; }

// ---------------------------------------------------------------- campaign

export function missionRecord(p: Profile, id: string): MissionRecord {
  return p.missions[id] ?? { cleared: false, stars: 0, bestTime: 0, plays: 0, wins: 0, bestDifficulty: null };
}
export function isMissionUnlocked(p: Profile, m: MissionDef): boolean {
  return !m.requires || missionRecord(p, m.requires).cleared;
}
export function nextMission(p: Profile): MissionDef {
  return MISSIONS.find(m => isMissionUnlocked(p, m) && !missionRecord(p, m.id).cleared) ?? MISSIONS[MISSIONS.length - 1];
}
export function totalStars(p: Profile): number {
  return MISSIONS.reduce((n, m) => n + missionRecord(p, m.id).stars, 0);
}

export function computeStars(m: MissionDef, won: boolean, coreHpFrac: number, time: number): number {
  if (!won) return 0;
  let s = 1;
  if (coreHpFrac >= 0.5) s = 2;
  if (coreHpFrac >= 0.75 && time <= m.parTime) s = 3;
  return s;
}

// ---------------------------------------------------------------- squad

export type DeckError = 'size' | 'locked' | 'copies' | 'hero_copies' | 'too_many_heroes' | 'unknown';

export function validateDeck(p: Profile, deck: string[]): DeckError | null {
  if (deck.length !== DECK_SIZE) return 'size';
  const counts: Record<string, number> = {};
  let heroes = 0;
  for (const id of deck) {
    const def = UNITS[id];
    if (!def || !def.deployable) return 'unknown';
    if (!p.unlockedUnits.includes(id)) return 'locked';
    counts[id] = (counts[id] ?? 0) + 1;
    if (def.hero) { heroes++; if (counts[id] > 1) return 'hero_copies'; }
    else if (counts[id] > 2) return 'copies';
  }
  if (heroes > 2) return 'too_many_heroes';
  return null;
}

export function setDeck(p: Profile, deck: string[]): DeckError | null {
  const err = validateDeck(p, deck);
  if (!err) p.deck = [...deck];
  return err;
}

export function setPilot(p: Profile, pilot: string): boolean {
  if (!p.unlockedPilots.includes(pilot)) return false;
  p.pilot = pilot;
  return true;
}

export function deckCards(p: Profile): DeckCard[] {
  return p.deck.map(unit => ({ unit, level: p.unitLevels[unit] ?? 1 }));
}
export function enemyDeckFor(m: MissionDef): DeckCard[] {
  return m.enemyDeck.map(unit => ({ unit, level: m.enemyLevel }));
}

// ---------------------------------------------------------------- upgrades

export type UpgradeError = 'locked' | 'max' | 'credits';
export function upgradeInfo(p: Profile, unit: string): { level: number; cost: number; error: UpgradeError | null } {
  const level = p.unitLevels[unit] ?? 1;
  const cost = upgradeCost(level);
  let error: UpgradeError | null = null;
  if (!p.unlockedUnits.includes(unit)) error = 'locked';
  else if (level >= MAX_UNIT_LEVEL) error = 'max';
  else if (p.credits < cost) error = 'credits';
  return { level, cost, error };
}
export function upgradeUnit(p: Profile, unit: string): UpgradeError | null {
  const info = upgradeInfo(p, unit);
  if (info.error) return info.error;
  p.credits -= info.cost;
  p.unitLevels[unit] = info.level + 1;
  return null;
}

// ---------------------------------------------------------------- rewards

export interface BattleOutcome {
  battleId: string;
  missionId: string;
  won: boolean;
  time: number;
  coreHpFrac: number;
  difficulty: Difficulty;
  kills: number;
  deployed: number;
}

export interface RewardReport {
  duplicate: boolean;
  credits: number;
  xp: number;
  firstClear: boolean;
  stars: number;
  newBest: boolean;
  unlockedUnits: string[];
  unlockedPilots: string[];
  levelUps: number[];
}

/**
 * Apply a finished battle to the profile exactly once. A battle id that has
 * already been applied is ignored, so reloading or re-showing the results
 * screen can never pay out twice. First-clear rewards are paid once per mission.
 */
export function applyBattleResult(p: Profile, o: BattleOutcome): RewardReport {
  const report: RewardReport = { duplicate: false, credits: 0, xp: 0, firstClear: false, stars: 0, newBest: false, unlockedUnits: [], unlockedPilots: [], levelUps: [] };
  const m = missionById(o.missionId);
  if (!m) throw new Error(`Unknown mission ${o.missionId}`);
  if (p.appliedBattles.includes(o.battleId)) { report.duplicate = true; return report; }
  p.appliedBattles.push(o.battleId);
  if (p.appliedBattles.length > 100) p.appliedBattles.splice(0, p.appliedBattles.length - 100);

  const rec = { ...missionRecord(p, m.id) };
  rec.plays++;
  p.stats.battles++;
  p.stats.kills += o.kills;
  p.stats.deployed += o.deployed;

  if (o.won) {
    rec.wins++;
    p.stats.wins++;
    const stars = computeStars(m, true, o.coreHpFrac, o.time);
    report.stars = stars;
    if (stars > rec.stars) { rec.stars = stars; report.newBest = true; }
    if (!rec.bestTime || o.time < rec.bestTime) rec.bestTime = Math.round(o.time);
    const rank: Difficulty[] = ['recruit', 'veteran', 'elite'];
    if (!rec.bestDifficulty || rank.indexOf(o.difficulty) > rank.indexOf(rec.bestDifficulty)) rec.bestDifficulty = o.difficulty;
    rec.cleared = true;
    if (!p.claimedFirstClear.includes(m.id)) {
      p.claimedFirstClear.push(m.id);
      report.firstClear = true;
      report.credits = m.firstClear.credits;
      report.xp = m.firstClear.xp;
      for (const u of m.firstClear.unlockUnits ?? []) if (!p.unlockedUnits.includes(u)) { p.unlockedUnits.push(u); p.unitLevels[u] = p.unitLevels[u] ?? 1; report.unlockedUnits.push(u); }
      for (const pl of m.firstClear.unlockPilots ?? []) if (!p.unlockedPilots.includes(pl) && PILOTS[pl]) { p.unlockedPilots.push(pl); report.unlockedPilots.push(pl); }
    } else {
      const mul = DIFFICULTY_REWARD[o.difficulty];
      report.credits = Math.round(m.repeat.credits * mul);
      report.xp = Math.round(m.repeat.xp * mul);
    }
  } else {
    report.xp = 10;
  }
  p.missions[m.id] = rec;
  p.credits += report.credits;
  p.xp += report.xp;
  while (p.xp >= totalXpFor(p.level + 1)) {
    p.level++;
    p.credits += 50;
    report.credits += 50;
    report.levelUps.push(p.level);
  }
  return report;
}

// ---------------------------------------------------------------- integrity

/** Repair a loaded profile so it can never put the game into an invalid state. */
export function sanitizeProfile(raw: unknown): Profile {
  const base = newProfile(0);
  if (!raw || typeof raw !== 'object') return newProfile();
  const r = raw as Partial<Profile>;
  const num = (v: unknown, d: number, min = 0, max = 1e9) => (typeof v === 'number' && isFinite(v) ? Math.max(min, Math.min(max, v)) : d);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const p: Profile = {
    ...base,
    version: PROFILE_VERSION,
    callsign: typeof r.callsign === 'string' && r.callsign.trim() ? r.callsign.trim().slice(0, 18) : 'Commander',
    createdAt: num(r.createdAt, Date.now(), 0, 8.64e15),
    xp: num(r.xp, 0), credits: num(r.credits, 0), level: 1,
    unlockedUnits: Array.from(new Set([...START_UNITS, ...strs(r.unlockedUnits).filter(u => UNITS[u]?.deployable)])),
    unlockedPilots: Array.from(new Set(['juno_vale', ...strs(r.unlockedPilots).filter(id => PLAYER_PILOTS.includes(id))])),
    claimedFirstClear: strs(r.claimedFirstClear).filter(id => missionById(id)),
    appliedBattles: strs(r.appliedBattles).slice(-100),
    tutorialSeen: !!r.tutorialSeen,
    stats: { battles: num(r.stats?.battles, 0), wins: num(r.stats?.wins, 0), kills: num(r.stats?.kills, 0), deployed: num(r.stats?.deployed, 0) },
    settings: {
      music: num(r.settings?.music, 0.5, 0, 1), sfx: num(r.settings?.sfx, 0.8, 0, 1),
      showRanges: r.settings?.showRanges !== false, reduceMotion: !!r.settings?.reduceMotion,
      difficulty: (['recruit', 'veteran', 'elite'] as const).includes(r.settings?.difficulty as Difficulty) ? r.settings!.difficulty : 'veteran',
    },
    unitLevels: {}, missions: {}, deck: [], pilot: 'juno_vale',
  };
  while (p.xp >= totalXpFor(p.level + 1)) p.level++;
  for (const u of p.unlockedUnits) p.unitLevels[u] = Math.round(num(r.unitLevels?.[u], 1, 1, MAX_UNIT_LEVEL));
  for (const m of MISSIONS) {
    const mr = r.missions?.[m.id];
    if (mr) p.missions[m.id] = { cleared: !!mr.cleared, stars: Math.round(num(mr.stars, 0, 0, 3)), bestTime: num(mr.bestTime, 0), plays: num(mr.plays, 0), wins: num(mr.wins, 0), bestDifficulty: mr.bestDifficulty ?? null };
  }
  p.pilot = typeof r.pilot === 'string' && p.unlockedPilots.includes(r.pilot) ? r.pilot : 'juno_vale';
  const deck = strs(r.deck);
  p.deck = validateDeck(p, deck) ? [...DEFAULT_DECK] : deck;
  return p;
}
