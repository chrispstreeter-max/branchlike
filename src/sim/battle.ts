// BRANCHLIKE combat simulation.
// Pure, deterministic, fixed time step. No DOM, no rendering, no Math.random.
// The UI and the AI interact with a battle only through the exported functions.

import type { AbilityId, MissionDef, PilotDef, Team, UnitDef, WeaponDef } from '../data/types.js';
import { UNITS, ABILITIES, DAMAGE_TABLE, levelMultiplier } from '../data/units.js';
import { PILOTS } from '../data/pilots.js';
import { MAPS, WORLD_W, WORLD_H, CORE_POS, DEPLOY_LINE, FORWARD_DEPLOY_RADIUS, POINT_RADIUS } from '../data/maps.js';
import type { MapDef } from '../data/types.js';
import { createRng, type Rng } from './rng.js';

export const DT = 0.05; // 20 simulation steps per second
export const SUPPLY_MAX = 10;
export const SUPPLY_START = 5;
export const SUPPLY_REGEN = 1 / 1.4; // supply per second
export const HAND_SIZE = 4;
const CAP_RATE = 20; // capture % per second for one unit of capture power
const SCORE_INTERVAL = 4; // one point per held hardpoint every 4 seconds
const ASSAULT_POINT_SUPPLY_BONUS = 0.08;
export const SURGE_WINDOW = 60; // seconds before the time limit
export const SURGE_MULTIPLIER = 2;

export interface DeckCard { unit: string; level: number }
export interface SideConfig { deck: DeckCard[]; pilot: string | null }
export interface BattleConfig { mission: MissionDef; seed: number; player: SideConfig; enemy: SideConfig }

export interface Entity {
  id: number;
  def: UnitDef;
  team: Team;
  level: number;
  x: number; y: number;
  hp: number; maxHp: number;
  dmgMul: number;
  cd: number; healCd: number;
  targetId: number; retarget: number;
  face: number;
  lane: number;
  stun: number;
  aegis: number;
  abilityCd: number;
  ox: number; oy: number;
  spawnT: number;
  lastHit: number;
  rally: { x: number; y: number } | null; // where the player sent it; null once reached (unless it holds there)
}

export interface Side {
  supply: number;
  deck: DeckCard[];
  hand: number[]; // indices into deck
  queue: number[];
  pilot: PilotDef | null;
  pilotCd: number;
  overclock: number;
  score: number;
  stats: { deployed: number; kills: number; lost: number; supplySpent: number; abilities: number };
}

export interface PointState { id: string; x: number; y: number; cap: number; owner: Team | null }

interface Shell { x: number; y: number; t: number; dmg: number; type: WeaponDef['type']; splash: number; team: Team; hitsAir: boolean }

export type BattleEvent =
  | { type: 'shot'; team: Team; x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; weapon: WeaponDef['type']; heavy: boolean }
  | { type: 'shell'; team: Team; x1: number; y1: number; x2: number; y2: number; t: number }
  | { type: 'blast'; team: Team; x: number; y: number; r: number }
  | { type: 'death'; team: Team; x: number; y: number; size: number; kind: string }
  | { type: 'deploy'; team: Team; x: number; y: number; unit: string; heavy: boolean }
  | { type: 'capture'; team: Team | null; point: string }
  | { type: 'ability'; team: Team; ability: AbilityId; x: number; y: number; x2?: number; y2?: number; r: number }
  | { type: 'heal'; team: Team; x1: number; y1: number; x2: number; y2: number }
  | { type: 'strike'; team: Team; x: number; y: number; r: number; t: number }
  | { type: 'surge' };

export type BattleResultReason = 'score' | 'core' | 'boss' | 'survived' | 'timeout';
export interface BattleResult { winner: Team | null; reason: BattleResultReason; time: number }

export interface Battle {
  mission: MissionDef;
  map: MapDef;
  seed: number;
  t: number;
  rng: Rng;
  nextId: number;
  ents: Entity[];
  sides: [Side, Side];
  points: PointState[];
  shells: Shell[];
  events: BattleEvent[];
  result: BattleResult | null;
  bossId: number;
  surge: boolean; // final-minute supply surge has started
}

export type DeployError = 'over' | 'no_card' | 'locked' | 'hero_active' | 'supply' | 'zone' | 'blocked';
export type AbilityError = 'over' | 'no_pilot' | 'cooldown' | 'no_unit' | 'needs_target' | 'out_of_range';

// ---------------------------------------------------------------- setup

function makeSide(cfg: SideConfig, rng: Rng): Side {
  const order = cfg.deck.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  return {
    supply: SUPPLY_START,
    deck: cfg.deck.map(c => ({ ...c })),
    hand: order.slice(0, HAND_SIZE),
    queue: order.slice(HAND_SIZE),
    pilot: cfg.pilot ? PILOTS[cfg.pilot] ?? null : null,
    pilotCd: cfg.pilot ? 15 : 0,
    overclock: 0,
    score: 0,
    stats: { deployed: 0, kills: 0, lost: 0, supplySpent: 0, abilities: 0 },
  };
}

export function createBattle(cfg: BattleConfig): Battle {
  const map = MAPS[cfg.mission.map];
  if (!map) throw new Error(`Unknown map ${cfg.mission.map}`);
  for (const side of [cfg.player, cfg.enemy]) {
    if (side.deck.length < HAND_SIZE + 1) throw new Error('Deck needs at least 5 cards');
    for (const c of side.deck) if (!UNITS[c.unit] || !UNITS[c.unit].deployable) throw new Error(`Unknown or non-deployable unit ${c.unit}`);
  }
  const rng = createRng(cfg.seed);
  const b: Battle = {
    mission: cfg.mission, map, seed: cfg.seed, t: 0, rng, nextId: 1, ents: [],
    sides: [makeSide(cfg.player, rng), makeSide(cfg.enemy, rng)],
    points: map.points.map(p => ({ id: p.id, x: p.x, y: p.y, cap: 0, owner: null })),
    shells: [], events: [], result: null, bossId: 0, surge: false,
  };
  for (const team of [0, 1] as Team[]) spawn(b, team, UNITS.core, CORE_POS[team].x, CORE_POS[team].y, 1);
  if (cfg.mission.boss) {
    const boss = spawn(b, 1, UNITS[cfg.mission.boss], 180, 110, cfg.mission.enemyLevel);
    b.bossId = boss.id;
    boss.abilityCd = 10;
  }
  return b;
}

function nearestLane(b: Battle, x: number): number {
  let best = 0, bd = Infinity;
  b.points.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i } });
  return best;
}

function spawn(b: Battle, team: Team, def: UnitDef, x: number, y: number, level: number): Entity {
  const side = b.sides[team];
  const mul = levelMultiplier(level);
  let hpMul = mul;
  if (side.pilot?.passive.id === 'fortify' && (def.kind === 'structure' || def.kind === 'core')) hpMul *= 1 + side.pilot.passive.value;
  const e: Entity = {
    id: b.nextId++, def, team, level, x, y,
    hp: def.hp * hpMul, maxHp: def.hp * hpMul, dmgMul: mul,
    cd: b.rng.range(0, def.weapon?.cooldown ?? 1), healCd: 0,
    targetId: 0, retarget: 0,
    face: team === 0 ? -Math.PI / 2 : Math.PI / 2,
    lane: nearestLane(b, x), stun: 0, aegis: 0, abilityCd: def.ability ? ABILITIES[def.ability].cooldown * 0.5 : 0,
    ox: b.rng.range(-14, 14), oy: b.rng.range(-12, 12), spawnT: b.t, lastHit: -99, rally: null,
  };
  b.ents.push(e);
  return e;
}

// ---------------------------------------------------------------- queries

export function entityById(b: Battle, id: number): Entity | undefined {
  for (const e of b.ents) if (e.id === id) return e;
  return undefined;
}
export function coreOf(b: Battle, team: Team): Entity | undefined {
  return b.ents.find(e => e.team === team && e.def.kind === 'core');
}
export function handCards(b: Battle, team: Team): DeckCard[] {
  const s = b.sides[team];
  return s.hand.map(i => s.deck[i]);
}
export function nextCard(b: Battle, team: Team): DeckCard {
  const s = b.sides[team];
  return s.deck[s.queue[0]];
}
export function heavyUnlocked(b: Battle): boolean { return b.t >= b.mission.heavyUnlock }

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function insideObstacle(b: Battle, x: number, y: number, pad = 0): boolean {
  return b.map.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + pad);
}

/** Is (x, y) a legal drop position for this team? */
export function inDeployZone(b: Battle, team: Team, x: number, y: number): boolean {
  if (x < 10 || x > WORLD_W - 10 || y < 10 || y > WORLD_H - 10) return false;
  if (team === 0 ? y >= DEPLOY_LINE[0] : y <= DEPLOY_LINE[1]) return true;
  return b.points.some(p => p.owner === team && Math.abs(p.cap) >= 100 && Math.hypot(p.x - x, p.y - y) <= FORWARD_DEPLOY_RADIUS);
}

export function checkDeploy(b: Battle, team: Team, handIndex: number, x: number, y: number): DeployError | null {
  if (b.result) return 'over';
  const side = b.sides[team];
  const deckIdx = side.hand[handIndex];
  if (deckIdx === undefined) return 'no_card';
  const card = side.deck[deckIdx];
  const def = UNITS[card.unit];
  if (def.heavy && !heavyUnlocked(b)) return 'locked';
  if (def.hero && b.ents.some(e => e.team === team && e.def.id === def.id)) return 'hero_active';
  if (def.cost > side.supply + 1e-9) return 'supply';
  if (def.kind === 'strike') return x >= 0 && x <= WORLD_W && y >= 0 && y <= WORLD_H ? null : 'zone';
  if (!inDeployZone(b, team, x, y)) return 'zone';
  if (def.kind !== 'drone' && insideObstacle(b, x, y, def.radius)) return 'blocked';
  return null;
}

/**
 * Where a card dropped at (x, y) actually lands, and where it should go.
 * Units always drop inside their own deploy zone (or beside a held hardpoint).
 * If the player aimed further forward, the drop lands at the nearest legal spot
 * and the aimed point becomes the unit's rally point. Strikes land anywhere.
 */
export function resolveDrop(b: Battle, team: Team, unit: string, x: number, y: number): { x: number; y: number; rally: { x: number; y: number } | null } {
  const def = UNITS[unit];
  const tx = Math.max(8, Math.min(WORLD_W - 8, x)), ty = Math.max(8, Math.min(WORLD_H - 8, y));
  if (def.kind === 'strike') return { x: tx, y: ty, rally: null };
  const blocked = (px: number, py: number) => def.kind !== 'drone' && insideObstacle(b, px, py, def.radius);
  if (inDeployZone(b, team, tx, ty) && !blocked(tx, ty)) return { x: tx, y: ty, rally: null };
  const cands: { x: number; y: number }[] = [];
  const lineY = team === 0 ? DEPLOY_LINE[0] + 10 : DEPLOY_LINE[1] - 10;
  cands.push({ x: Math.max(16, Math.min(WORLD_W - 16, tx)), y: team === 0 ? Math.max(ty, lineY) : Math.min(ty, lineY) });
  for (const p of b.points) {
    if (p.owner !== team || Math.abs(p.cap) < 100) continue;
    const dx = tx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy) || 1, r = Math.min(L, FORWARD_DEPLOY_RADIUS - 6);
    cands.push({ x: p.x + dx / L * r, y: p.y + dy / L * r });
  }
  cands.sort((a, c) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(c.x - tx, c.y - ty));
  for (const c of cands) {
    for (const off of [0, 22, -22, 44, -44]) {
      const px = Math.max(12, Math.min(WORLD_W - 12, c.x + off));
      if (inDeployZone(b, team, px, c.y) && !blocked(px, c.y)) {
        const far = Math.hypot(px - tx, c.y - ty) > 14;
        return { x: px, y: c.y, rally: far && !blocked(tx, ty) ? { x: tx, y: ty } : null };
      }
    }
  }
  return { x: tx, y: ty, rally: null };
}

/** Deploy a hand card aimed at (x, y): resolves the drop point and rally point. Used by the player's UI. */
export function deployTo(b: Battle, team: Team, handIndex: number, x: number, y: number): DeployError | null {
  const deckIdx = b.sides[team].hand[handIndex];
  if (deckIdx === undefined) return b.result ? 'over' : 'no_card';
  const r = resolveDrop(b, team, b.sides[team].deck[deckIdx].unit, x, y);
  return deploy(b, team, handIndex, r.x, r.y, r.rally);
}

export function deploy(b: Battle, team: Team, handIndex: number, x: number, y: number, rally: { x: number; y: number } | null = null): DeployError | null {
  const err = checkDeploy(b, team, handIndex, x, y);
  if (err) return err;
  const side = b.sides[team];
  const deckIdx = side.hand[handIndex];
  const card = side.deck[deckIdx];
  const def = UNITS[card.unit];
  side.supply -= def.cost;
  side.stats.supplySpent += def.cost;
  side.stats.deployed++;
  side.queue.push(deckIdx);
  side.hand[handIndex] = side.queue.shift()!;
  if (def.strike) {
    const st = def.strike, mul = levelMultiplier(card.level);
    for (let i = 0; i < st.count; i++) b.shells.push({ x, y, t: st.delay + i * 0.15, dmg: st.damage * mul, type: st.type, splash: st.radius, team, hitsAir: false });
    b.events.push({ type: 'strike', team, x, y, r: st.radius, t: st.delay });
    return null;
  }
  const n = def.squad ?? 1;
  for (let i = 0; i < n; i++) {
    const ox = n === 1 ? 0 : (i - (n - 1) / 2) * 11;
    const oy = n === 1 ? 0 : (i % 2 ? 8 : 0) * (team === 0 ? 1 : -1);
    let px = Math.max(10, Math.min(WORLD_W - 10, x + ox)), py = y + oy;
    if (def.kind !== 'drone' && insideObstacle(b, px, py, def.radius)) { px = x; py = y; }
    const e = spawn(b, team, def, px, py, card.level);
    if (rally && def.speed > 0) e.rally = { x: Math.max(8, Math.min(WORLD_W - 8, rally.x + ox)), y: rally.y + oy };
  }
  b.events.push({ type: 'deploy', team, x, y, unit: def.id, heavy: !!def.heavy || def.kind === 'structure' });
  return null;
}

// ---------------------------------------------------------------- abilities

export function abilityTargetRange(b: Battle, source: Entity | null, ability: AbilityId): number {
  if (ability === 'salvo') return 230;
  return Infinity;
}

export function checkAbility(b: Battle, team: Team, sourceId: number | 'pilot', x?: number, y?: number): AbilityError | null {
  if (b.result) return 'over';
  let ab: AbilityId, cd: number, src: Entity | null = null;
  if (sourceId === 'pilot') {
    const p = b.sides[team].pilot;
    if (!p) return 'no_pilot';
    ab = p.ability; cd = b.sides[team].pilotCd;
  } else {
    const e = entityById(b, sourceId);
    if (!e || e.team !== team || !e.def.ability) return 'no_unit';
    src = e; ab = e.def.ability; cd = e.abilityCd;
  }
  if (cd > 0) return 'cooldown';
  const def = ABILITIES[ab];
  if (def.targeted) {
    if (x === undefined || y === undefined) return 'needs_target';
    if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) return 'out_of_range';
    if (src && dist(src, { x, y }) > abilityTargetRange(b, src, ab)) return 'out_of_range';
  }
  return null;
}

export function useAbility(b: Battle, team: Team, sourceId: number | 'pilot', x?: number, y?: number): AbilityError | null {
  const err = checkAbility(b, team, sourceId, x, y);
  if (err) return err;
  const side = b.sides[team];
  let ab: AbilityId, src: Entity | null = null, mul = 1;
  if (sourceId === 'pilot') { ab = side.pilot!.ability; side.pilotCd = ABILITIES[ab].cooldown; }
  else { src = entityById(b, sourceId)!; ab = src.def.ability!; src.abilityCd = ABILITIES[ab].cooldown; mul = src.dmgMul; }
  side.stats.abilities++;
  const def = ABILITIES[ab];
  const r = def.radius ?? 0;
  const tx = x ?? src?.x ?? 0, ty = y ?? src?.y ?? 0;
  switch (ab) {
    case 'salvo':
      for (let i = 0; i < 6; i++) {
        const a = b.rng.range(0, Math.PI * 2), d = b.rng.range(0, r * 0.8);
        b.shells.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, t: 0.25 + i * 0.09, dmg: 60 * mul, type: 'explosive', splash: 22, team, hitsAir: false });
      }
      b.events.push({ type: 'ability', team, ability: ab, x: src!.x, y: src!.y, x2: tx, y2: ty, r });
      break;
    case 'aegis':
      for (const e of b.ents) if (e.team === team && dist(e, src!) <= r) e.aegis = 6;
      b.events.push({ type: 'ability', team, ability: ab, x: src!.x, y: src!.y, r });
      break;
    case 'railLance': {
      const dx = tx - src!.x, dy = ty - src!.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, len = 280;
      for (const e of b.ents) {
        if (e.team === team) continue;
        const px = e.x - src!.x, py = e.y - src!.y, along = px * ux + py * uy;
        if (along < 0 || along > len) continue;
        const off = Math.abs(px * uy - py * ux);
        if (off <= r + e.def.radius) hurt(b, e, 260 * mul, 'energy', team);
      }
      b.events.push({ type: 'ability', team, ability: ab, x: src!.x, y: src!.y, x2: src!.x + ux * len, y2: src!.y + uy * len, r });
      break;
    }
    case 'overclock':
      side.overclock = 7;
      b.events.push({ type: 'ability', team, ability: ab, x: CORE_POS[team].x, y: CORE_POS[team].y, r: 0 });
      break;
    case 'barrage':
      for (let i = 0; i < 5; i++) {
        const a = b.rng.range(0, Math.PI * 2), d = b.rng.range(0, r * 0.85);
        b.shells.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, t: 1.1 + i * 0.22, dmg: 70, type: 'explosive', splash: 26, team, hitsAir: false });
      }
      b.events.push({ type: 'ability', team, ability: ab, x: tx, y: ty, r });
      break;
    case 'emp':
      for (const e of b.ents) if (e.team !== team && e.def.kind !== 'core' && dist(e, { x: tx, y: ty }) <= r) e.stun = Math.max(e.stun, e.def.kind === 'boss' ? 1.5 : 3.5);
      b.events.push({ type: 'ability', team, ability: ab, x: tx, y: ty, r });
      break;
    case 'quake':
      for (const e of b.ents) if (e.team !== team && e.def.kind !== 'core' && e.def.armor !== 'air' && dist(e, src!) <= r) { hurt(b, e, 55 * mul, 'explosive', team); e.stun = Math.max(e.stun, 1.2); }
      b.events.push({ type: 'ability', team, ability: ab, x: src!.x, y: src!.y, r });
      break;
  }
  return null;
}

// ---------------------------------------------------------------- combat helpers

export function canHit(w: WeaponDef | undefined, target: Entity): boolean {
  if (!w) return false;
  if (target.def.armor === 'air' && !w.hitsAir) return false;
  return DAMAGE_TABLE[w.type][target.def.armor] > 0;
}

function hurt(b: Battle, e: Entity, amount: number, type: WeaponDef['type'], from: Team) {
  if (e.hp <= 0) return;
  let m = DAMAGE_TABLE[type][e.def.armor];
  if (e.aegis > 0) m *= 0.4;
  e.hp -= amount * m;
  e.lastHit = b.t;
  if (e.hp <= 0) b.sides[from].stats.kills++;
}

function splashAt(b: Battle, x: number, y: number, s: Shell) {
  for (const e of b.ents) {
    if (e.team === s.team) continue;
    if (e.def.armor === 'air' && !s.hitsAir) continue;
    const d = Math.hypot(e.x - x, e.y - y) - e.def.radius * 0.5;
    if (d <= s.splash) hurt(b, e, s.dmg * (1 - 0.5 * Math.max(0, d) / s.splash), s.type, s.team);
  }
  b.events.push({ type: 'blast', team: s.team, x, y, r: s.splash });
}

function pickTarget(b: Battle, e: Entity): Entity | null {
  const w = e.def.weapon!;
  const acquire = e.def.speed > 0 ? w.range + 60 : w.range;
  let best: Entity | null = null, bestScore = Infinity;
  for (const o of b.ents) {
    if (o.team === e.team || o.hp <= 0 || !canHit(w, o)) continue;
    const d = dist(e, o) - o.def.radius;
    if (d > acquire) continue;
    if (w.minRange && d < w.minRange) continue;
    const eff = DAMAGE_TABLE[w.type][o.def.armor];
    // Prefer close targets that this weapon is effective against. Cores are a last resort.
    let score = d / (0.3 + eff);
    if (o.def.kind === 'core') score *= 1.6;
    if (o.id === e.targetId) score *= 0.8; // stickiness
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}

function securedBy(p: PointState, team: Team) {
  return p.owner === team && (team === 0 ? p.cap >= 100 : p.cap <= -100);
}

function goalFor(b: Battle, e: Entity): { x: number; y: number } {
  const team = e.team, enemyCore = CORE_POS[team === 0 ? 1 : 0];
  const push = { x: enemyCore.x + e.ox, y: enemyCore.y + (team === 0 ? 70 : -70) };
  const k = e.def.kind;
  if (k === 'boss') return { x: CORE_POS[0].x, y: CORE_POS[0].y - 150 };
  if (e.rally) {
    if (dist(e, e.rally) > 10) return e.rally;
    if (e.def.holdAtRally) return e.rally;
    e.rally = null;
  }
  const aggressive = team === 1 && (b.mission.aiProfile === 'aggressive' || b.mission.mode === 'defend');
  if (e.def.role === 'support') {
    let best: Entity | null = null, bs = Infinity;
    for (const o of b.ents) {
      if (o.team !== team || o === e || o.def.speed === 0 || o.def.role === 'support') continue;
      const s = dist(e, o) * (0.4 + o.hp / o.maxHp) / (o.def.kind === 'mech' || o.def.kind === 'hero' ? 2 : 1);
      if (s < bs) { bs = s; best = o; }
    }
    if (best) return { x: best.x + e.ox * 0.6, y: best.y + (team === 0 ? 26 : -26) };
  }
  if (aggressive && e.def.capture === 0) return push;
  const pts = b.points;
  if (e.def.capture > 0) {
    const home = pts[e.lane];
    if (!securedBy(home, team)) return { x: home.x + e.ox, y: home.y + e.oy };
    let best: PointState | null = null, bd = Infinity;
    for (const p of pts) if (!securedBy(p, team)) { const d = dist(e, p); if (d < bd) { bd = d; best = p; } }
    if (best) return { x: best.x + e.ox, y: best.y + e.oy };
    return push;
  }
  // Frames march down their lane on the enemy spire, fighting whatever they meet.
  if (k === 'mech' || k === 'hero') {
    const lanePt = pts[e.lane];
    const behind = team === 0 ? e.y > lanePt.y + 12 : e.y < lanePt.y - 12;
    return behind ? { x: lanePt.x + e.ox * 0.5, y: lanePt.y } : push;
  }
  // Combat units escort: own lane first if it is not secured, then the nearest unsecured point.
  const home = pts[e.lane];
  if (!securedBy(home, team)) return { x: home.x + e.ox, y: home.y + (team === 0 ? 30 : -30) };
  let best: PointState | null = null, bd = Infinity;
  for (const p of pts) if (!securedBy(p, team)) { const d = dist(e, p); if (d < bd) { bd = d; best = p; } }
  if (best) return { x: best.x + e.ox, y: best.y + (team === 0 ? 30 : -30) };
  return push;
}

function moveToward(b: Battle, e: Entity, tx: number, ty: number, dt: number) {
  let dx = tx - e.x, dy = ty - e.y;
  const L = Math.hypot(dx, dy);
  if (L < 2) return;
  dx /= L; dy /= L;
  if (e.def.kind !== 'drone') {
    // Steer around obstacles ahead.
    for (const o of b.map.obstacles) {
      const ox = o.x - e.x, oy = o.y - e.y, od = Math.hypot(ox, oy);
      const clear = o.r + e.def.radius + 16;
      if (od > clear + 30 || od > L + o.r) continue;
      const ahead = (ox * dx + oy * dy) / (od || 1);
      if (ahead <= 0.2) continue;
      // Steer along the obstacle's tangent, on whichever side the goal already leans.
      const cross = ox * dy - oy * dx;
      const side = cross >= 0 ? -1 : 1; // picks the tangent with a positive component along d
      const tx2 = (oy / od) * side, ty2 = (-ox / od) * side; // tangent pointing away from the obstacle centre line
      const w = (1 - Math.min(1, (od - o.r) / (clear + 30))) * 1.4;
      dx += tx2 * w; dy += ty2 * w;
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    }
  }
  const s = Math.min(L, e.def.speed * dt);
  e.x += dx * s; e.y += dy * s;
  e.face = Math.atan2(dy, dx);
}

function resolveCollisions(b: Battle) {
  const ents = b.ents;
  for (const e of ents) {
    if (e.def.speed === 0 || e.def.kind === 'drone') continue;
    for (const o of b.map.obstacles) {
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = o.r + e.def.radius;
      if (d < min) { e.x = o.x + dx / d * min; e.y = o.y + dy / d * min; }
    }
  }
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i];
    for (let j = i + 1; j < ents.length; j++) {
      const c = ents[j];
      if ((a.def.kind === 'drone') !== (c.def.kind === 'drone')) continue; // air and ground don't collide
      const min = a.def.radius + c.def.radius + 1;
      const dx = c.x - a.x, dy = c.y - a.y;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const L = Math.hypot(dx, dy) || 0.01;
      if (L >= min) continue;
      const push = (min - L) / 2, nx = dx / L, ny = dy / L;
      const am = a.def.speed > 0, cm = c.def.speed > 0;
      if (am) { a.x -= nx * push * (cm ? 1 : 2); a.y -= ny * push * (cm ? 1 : 2); }
      if (cm) { c.x += nx * push * (am ? 1 : 2); c.y += ny * push * (am ? 1 : 2); }
    }
  }
  for (const e of ents) { e.x = Math.max(6, Math.min(WORLD_W - 6, e.x)); e.y = Math.max(6, Math.min(WORLD_H - 6, e.y)); }
}

// ---------------------------------------------------------------- step

export function supplyRate(b: Battle, team: Team): number {
  const side = b.sides[team];
  let r = SUPPLY_REGEN;
  if (side.pilot?.passive.id === 'supply') r *= 1 + side.pilot.passive.value;
  if (b.mission.mode !== 'hardpoint') r *= 1 + ASSAULT_POINT_SUPPLY_BONUS * b.points.filter(p => p.owner === team).length;
  for (const e of b.ents) if (e.team === team && e.def.supplyBoost) r *= 1 + e.def.supplyBoost;
  if (b.surge) r *= SURGE_MULTIPLIER;
  return r;
}

export function step(b: Battle): void {
  b.events.length = 0;
  if (b.result) return;
  const dt = DT;
  b.t += dt;

  // Final minute: supply production doubles (not in defend missions, where the clock is the objective).
  if (!b.surge && b.mission.mode !== 'defend' && b.mission.timeLimit - b.t <= SURGE_WINDOW) { b.surge = true; b.events.push({ type: 'surge' }); }

  for (const team of [0, 1] as Team[]) {
    const s = b.sides[team];
    s.supply = Math.min(SUPPLY_MAX, s.supply + supplyRate(b, team) * dt);
    s.pilotCd = Math.max(0, s.pilotCd - dt);
    s.overclock = Math.max(0, s.overclock - dt);
  }

  // Units
  for (const e of b.ents) {
    if (e.hp <= 0) continue;
    const d = e.def;
    e.aegis = Math.max(0, e.aegis - dt);
    e.abilityCd = Math.max(0, e.abilityCd - dt);
    if (d.decay) e.hp -= d.decay * dt;
    if (e.stun > 0) { e.stun -= dt; continue; }
    const rateMul = b.sides[e.team].overclock > 0 ? 1.35 : 1;
    e.cd -= dt * rateMul;

    // Boss stomp is automatic.
    if (d.kind === 'boss' && e.abilityCd <= 0 && b.ents.some(o => o.team !== e.team && o.def.kind !== 'core' && dist(o, e) < 70)) {
      useAbility(b, e.team, e.id);
    }

    if (d.heal) {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        let best: Entity | null = null, bf = 1;
        for (const o of b.ents) {
          if (o.team !== e.team || o === e || o.def.kind === 'core' || o.def.kind === 'boss' || o.hp >= o.maxHp) continue;
          if (dist(o, e) > d.heal.range) continue;
          const f = o.hp / o.maxHp;
          if (f < bf) { bf = f; best = o; }
        }
        if (best) {
          best.hp = Math.min(best.maxHp, best.hp + d.heal.amount * e.dmgMul * (best.def.kind === 'mech' || best.def.kind === 'hero' ? 1.5 : 1));
          e.healCd = d.heal.cooldown;
          b.events.push({ type: 'heal', team: e.team, x1: e.x, y1: e.y, x2: best.x, y2: best.y });
        }
      }
    }

    let target: Entity | null = null;
    if (d.weapon) {
      e.retarget -= dt;
      const cur = e.targetId ? entityById(b, e.targetId) : undefined;
      if (!cur || cur.hp <= 0 || e.retarget <= 0) {
        target = pickTarget(b, e);
        e.targetId = target ? target.id : 0;
        e.retarget = 0.5;
      } else {
        const range = d.speed > 0 ? d.weapon.range + 60 : d.weapon.range;
        target = dist(cur, e) - cur.def.radius <= range ? cur : pickTarget(b, e);
        e.targetId = target ? target.id : 0;
      }
    }

    const w = d.weapon;
    if (target && w) {
      const td = dist(e, target) - target.def.radius;
      if (td <= w.range && (!w.minRange || td >= w.minRange)) {
        e.face = Math.atan2(target.y - e.y, target.x - e.x);
        if (e.cd <= 0) {
          e.cd = w.cooldown;
          const dmg = w.damage * e.dmgMul;
          if (w.shellTime) {
            const tx = target.x + b.rng.range(-4, 4), ty = target.y + b.rng.range(-4, 4);
            b.shells.push({ x: tx, y: ty, t: w.shellTime, dmg, type: w.type, splash: w.splash ?? 16, team: e.team, hitsAir: w.hitsAir });
            b.events.push({ type: 'shell', team: e.team, x1: e.x, y1: e.y, x2: tx, y2: ty, t: w.shellTime });
          } else {
            if (w.splash) splashAt(b, target.x, target.y, { x: 0, y: 0, t: 0, dmg, type: w.type, splash: w.splash, team: e.team, hitsAir: w.hitsAir });
            else hurt(b, target, dmg, w.type, e.team);
            b.events.push({ type: 'shot', team: e.team, x1: e.x, y1: e.y, h1: d.height * 0.7, x2: target.x, y2: target.y, h2: target.def.height * 0.6, weapon: w.type, heavy: d.kind === 'mech' || d.kind === 'hero' || d.kind === 'core' || d.kind === 'boss' });
          }
        }
        continue; // holding position while firing
      }
      if (d.speed > 0) {
        if (w.minRange && td < w.minRange) { moveToward(b, e, e.x - (target.x - e.x), e.y - (target.y - e.y), dt); continue; }
        if (target.def.kind !== 'core' || dist(e, goalFor(b, e)) < 40) { moveToward(b, e, target.x, target.y, dt); continue; }
      }
    }
    if (d.speed > 0) { const g = goalFor(b, e); moveToward(b, e, g.x, g.y, dt); }
  }

  // Shells
  for (const s of b.shells) { s.t -= dt; if (s.t <= 0) splashAt(b, s.x, s.y, s); }
  b.shells = b.shells.filter(s => s.t > 0);

  resolveCollisions(b);

  // Deaths
  for (const e of b.ents) if (e.hp <= 0) {
    b.sides[e.team].stats.lost++;
    b.events.push({ type: 'death', team: e.team, x: e.x, y: e.y, size: e.def.radius, kind: e.def.kind });
  }
  const coreDown = b.ents.find(e => e.hp <= 0 && e.def.kind === 'core');
  const bossDown = b.bossId && b.ents.some(e => e.id === b.bossId && e.hp <= 0);
  b.ents = b.ents.filter(e => e.hp > 0);
  if (coreDown) { b.result = { winner: coreDown.team === 0 ? 1 : 0, reason: 'core', time: b.t }; return; }
  if (bossDown) { b.result = { winner: 0, reason: 'boss', time: b.t }; return; }

  // Hardpoints
  for (const p of b.points) {
    let a = 0, c = 0;
    for (const e of b.ents) {
      if (!e.def.capture || e.stun > 0) continue;
      if (Math.abs(e.x - p.x) > POINT_RADIUS || Math.abs(e.y - p.y) > POINT_RADIUS) continue;
      if (dist(e, p) > POINT_RADIUS) continue;
      if (e.team === 0) a += e.def.capture; else c += e.def.capture;
    }
    const capMul = (team: Team, power: number) => {
      const pl = b.sides[team].pilot;
      return CAP_RATE * (1 + 0.2 * (Math.min(power, 6) - 1)) * (pl?.passive.id === 'capture' ? 1 + pl.passive.value : 1);
    };
    const before = p.owner;
    if (a > 0 && c === 0) p.cap = Math.min(100, p.cap + capMul(0, a) * dt);
    else if (c > 0 && a === 0) p.cap = Math.max(-100, p.cap - capMul(1, c) * dt);
    if (p.cap >= 100) p.owner = 0;
    else if (p.cap <= -100) p.owner = 1;
    if (p.owner === 0 && p.cap <= 0) p.owner = null;
    if (p.owner === 1 && p.cap >= 0) p.owner = null;
    if (p.owner !== before) b.events.push({ type: 'capture', team: p.owner, point: p.id });
    if (b.mission.mode === 'hardpoint' && p.owner !== null) b.sides[p.owner].score += dt / SCORE_INTERVAL;
  }

  // Victory conditions
  const m = b.mission;
  if (m.mode === 'hardpoint' && m.scoreTarget) {
    const [s0, s1] = [b.sides[0].score, b.sides[1].score];
    if (s0 >= m.scoreTarget || s1 >= m.scoreTarget) { b.result = { winner: s0 >= s1 ? 0 : 1, reason: 'score', time: b.t }; return; }
  }
  if (b.t >= m.timeLimit) {
    if (m.mode === 'defend') b.result = { winner: 0, reason: 'survived', time: b.t };
    else if (m.mode === 'hardpoint') {
      const [s0, s1] = [b.sides[0].score, b.sides[1].score];
      b.result = { winner: s0 > s1 ? 0 : s1 > s0 ? 1 : null, reason: 'timeout', time: b.t };
    } else if (m.mode === 'assault') {
      const f = (t: Team) => { const c = coreOf(b, t)!; return c.hp / c.maxHp; };
      b.result = { winner: f(1) < f(0) ? 0 : 1, reason: 'timeout', time: b.t };
    } else b.result = { winner: 1, reason: 'timeout', time: b.t };
  }
}

/** Run the battle forward until it ends or `maxSeconds` pass. Used by tests and tools. */
export function runFor(b: Battle, seconds: number, each?: (b: Battle) => void) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps && !b.result; i++) { each?.(b); step(b); }
}
