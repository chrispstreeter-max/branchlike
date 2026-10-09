// Tactical AI: a utility-scoring commander.
// Each "think" it scores every (card × target) pair and every ability use,
// then acts on the best option or waits. It plays by the same rules as the
// player: same supply, same deploy zones, same unit stats. Difficulty changes
// how often it thinks, how noisy its judgement is, how much it counters, how
// readily it defends and how well it uses abilities — never its stats.

import type { Difficulty, Team, MissionDef, ArmorClass, AbilityId } from '../data/types.js';
import { UNITS, ABILITIES, DAMAGE_TABLE } from '../data/units.js';
import { CORE_POS, DEPLOY_LINE, WORLD_W } from '../data/maps.js';
import { createRng, type Rng } from './rng.js';
import { DT, SUPPLY_MAX, checkDeploy, deploy, useAbility, checkAbility, heavyUnlocked, type Battle, type Entity, type PointState } from './battle.js';

export interface DifficultyKnobs {
  interval: number; // seconds between decisions
  noise: number; // random error added to every utility
  counter: number; // weight on countering the opponent's composition
  defend: number; // weight on protecting threatened points and the spire
  abilityUse: number; // chance to act on a good ability opportunity
  abilityBar: number; // multiplier on the value an ability needs before firing
  forward: boolean; // uses forward deployment on held points
  impulse: number; // how much worse a cheap play may score than the best (unaffordable) play and still be taken now
}

export const DIFFICULTY: Record<Difficulty, DifficultyKnobs> = {
  recruit: { interval: 2.2, noise: 2.4, counter: 0.2, defend: 0.35, abilityUse: 0.35, abilityBar: 1.5, forward: false, impulse: 2.5 },
  veteran: { interval: 1.3, noise: 1.0, counter: 0.8, defend: 0.9, abilityUse: 0.8, abilityBar: 1.0, forward: true, impulse: 0.9 },
  elite:   { interval: 0.7, noise: 0.35, counter: 1.3, defend: 1.3, abilityUse: 1.0, abilityBar: 0.8, forward: true, impulse: 0.5 },
};

export interface AiState {
  team: Team;
  difficulty: Difficulty;
  knobs: DifficultyKnobs;
  profile: MissionDef['aiProfile'];
  rng: Rng;
  think: number;
  log: string[]; // last decisions, for debugging and tests
  handSeen: Map<number, number>; // deck index -> time it entered the hand
  counts: { deploys: number; abilities: number; waits: number; defends: number; counters: number };
}

export function createAi(b: Battle, team: Team, difficulty: Difficulty): AiState {
  const base = DIFFICULTY[difficulty];
  const esc = b.mission.aiEscalation;
  const knobs: DifficultyKnobs = {
    ...base,
    interval: base.interval * (1 - 0.25 * esc),
    noise: base.noise * (1 - 0.4 * esc),
    counter: base.counter + 0.5 * esc,
    defend: base.defend + 0.3 * esc,
  };
  if (b.mission.aiProfile === 'passive') { knobs.interval *= 1.8; knobs.abilityUse = 0; knobs.forward = false; }
  return {
    team, difficulty, knobs, profile: b.mission.aiProfile,
    rng: createRng((b.seed ^ 0x9e3779b9) >>> 0), think: knobs.interval,
    log: [], handSeen: new Map(), counts: { deploys: 0, abilities: 0, waits: 0, defends: 0, counters: 0 },
  };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Combat value of an entity, used to weigh threats and compositions. */
function power(e: Entity): number {
  if (e.def.kind === 'core') return 0;
  if (e.def.kind === 'boss') return 24 * (0.35 + 0.65 * e.hp / e.maxHp);
  const per = e.def.cost / (e.def.squad ?? 1) || 3;
  return per * (0.35 + 0.65 * e.hp / e.maxHp);
}

interface Situation {
  enemyComp: Record<ArmorClass, number>;
  enemyTotal: number;
  myArmored: number;
  mySupport: number;
  pointThreat: number[]; // opponent power near each point
  pointMine: number[]; // my power near each point
  coreThreat: number; // opponent power near my spire
  coreThreatX: number;
}

export function assess(b: Battle, me: Team): Situation {
  const s: Situation = { enemyComp: { light: 0, armored: 0, air: 0, structure: 0 }, enemyTotal: 0, myArmored: 0, mySupport: 0, pointThreat: b.points.map(() => 0), pointMine: b.points.map(() => 0), coreThreat: 0, coreThreatX: CORE_POS[me].x };
  const core = CORE_POS[me];
  let cx = 0;
  for (const e of b.ents) {
    const p = power(e);
    if (!p) continue;
    b.points.forEach((pt, i) => { if (dist(e, pt) < 85) { if (e.team === me) s.pointMine[i] += p; else s.pointThreat[i] += p; } });
    if (e.team === me) { if (e.def.armor === 'armored' && e.def.kind !== 'boss' && e.def.speed > 0) s.myArmored += p; if (e.def.role === 'support') s.mySupport++; continue; }
    s.enemyComp[e.def.armor] += p;
    s.enemyTotal += p;
    if (dist(e, core) < 190) { s.coreThreat += p; cx += e.x * p; }
  }
  if (s.coreThreat > 0) s.coreThreatX = cx / s.coreThreat;
  return s;
}

/** How well a unit's weapon fits what the opponent is fielding: ~0 (poor) to ~1.8 (hard counter). */
function counterFit(unitId: string, comp: Record<ArmorClass, number>, total: number): number {
  const def = UNITS[unitId];
  if (!def.weapon || total <= 0) return 0.6;
  let s = 0;
  for (const k of Object.keys(comp) as ArmorClass[]) {
    let m = DAMAGE_TABLE[def.weapon.type][k];
    if (k === 'air' && !def.weapon.hitsAir) m = 0;
    s += comp[k] / total * m;
  }
  return s;
}

const owner = (p: PointState) => p.owner;

export interface Option { score: number; hand: number; x: number; y: number; why: string; affordable: boolean; cost: number }

function zoneY(me: Team, depth: number) {
  // depth 0 = right at the deploy line, 1 = deep near the spire
  return me === 1 ? DEPLOY_LINE[1] - 8 - depth * 120 : DEPLOY_LINE[0] + 8 + depth * 120;
}

function candidateTargets(b: Battle, ai: AiState, s: Situation) {
  const me = ai.team, them: Team = me === 0 ? 1 : 0;
  const out: { kind: 'point' | 'core'; i: number; x: number; y: number; value: Record<string, number> }[] = [];
  b.points.forEach((p, i) => {
    const mine = owner(p) === me, theirs = owner(p) === them;
    const contested = s.pointThreat[i] > 0 && s.pointMine[i] > 0;
    const capValue = mine ? (s.pointThreat[i] > 0 ? 1.4 : 0.2) : theirs ? 2.2 : 1.8;
    const fightValue = s.pointThreat[i] > 0 ? 1 + Math.min(2.5, s.pointThreat[i] / 6) * ai.knobs.defend + (contested ? 0.5 : 0) : (theirs ? 0.9 : 0.3);
    // Prefer weak lanes for capturers; under-defended own points for defence.
    const balance = (s.pointThreat[i] - s.pointMine[i]) / 10;
    const fwd = ai.knobs.forward && mine && Math.abs(p.cap) >= 100;
    out.push({ kind: 'point', i, x: p.x, y: fwd ? p.y + (me === 1 ? -28 : 28) : zoneY(me, 0.15), value: { cap: capValue + balance * 0.3, fight: fightValue + balance * 0.5 } });
  });
  const core = CORE_POS[me];
  out.push({ kind: 'core', i: -1, x: s.coreThreatX, y: core.y + (me === 1 ? 70 : -70), value: { cap: 0, fight: s.coreThreat > 0 ? 1.2 + s.coreThreat / 5 * ai.knobs.defend : -1 } });
  return out;
}

export function deployOptions(b: Battle, ai: AiState, s: Situation): Option[] {
  const me = ai.team, side = b.sides[me];
  const opts: Option[] = [];
  const targets = candidateTargets(b, ai, s);
  const profile = ai.profile;
  side.hand.forEach((deckIdx, h) => {
    const card = side.deck[deckIdx];
    const def = UNITS[card.unit];
    if (def.heavy && !heavyUnlocked(b)) return;
    if (def.hero && b.ents.some(e => e.team === me && e.def.id === def.id)) return;
    if (profile === 'passive' && def.heavy) return;
    const affordable = def.cost <= side.supply;
    const age = b.t - (ai.handSeen.get(deckIdx) ?? b.t);
    const fit = counterFit(card.unit, s.enemyComp, s.enemyTotal);
    for (const t of targets) {
      let u = 0, why = '';
      switch (def.role) {
        case 'capture': case 'scout':
          u = t.value.cap * (def.role === 'scout' ? 1.15 : 1) + 0.3 * t.value.fight; why = 'capture'; break;
        case 'antiarmor':
          u = 0.6 * t.value.cap + t.value.fight * (0.5 + fit); why = 'counter-armour'; break;
        case 'assault': case 'hero':
          u = t.value.fight * (0.6 + fit) + 0.4 * t.value.cap + (def.hero ? 1.2 : def.kind === 'mech' ? 0.6 : 0); why = 'assault'; break;
        case 'artillery':
          u = t.value.fight * (0.5 + fit) + (s.enemyComp.light > 6 ? 0.8 : 0); why = 'artillery'; break;
        case 'support':
          u = s.myArmored > 8 && s.mySupport < 2 ? 1.2 + Math.min(1.5, s.myArmored / 20) - s.mySupport * 0.8 : -1; why = 'support'; break;
        case 'defense':
          u = (t.kind === 'core' ? t.value.fight * 1.2 : (owner(b.points[t.i]) === me ? 1.1 + t.value.fight * 0.7 : t.value.fight * 0.5)) * (0.6 + fit * 0.4); why = 'fortify'; break;
        default: u = 0;
      }
      u += (fit - 0.6) * ai.knobs.counter;
      if (profile === 'aggressive' && def.capture === 0) u += 0.8;
      if (profile === 'siege' && (def.role === 'defense' || def.role === 'artillery')) u += 0.6;
      if (b.mission.mode !== 'hardpoint' && def.role === 'capture') u -= 0.3;
      u += def.cost * 0.06; // bigger cards have bigger impact; saving decides when to wait for them
      u += Math.min(1.2, age * 0.04); // rotate cards that have sat in hand
      u += ai.rng.range(-1, 1) * ai.knobs.noise;
      let x = t.x + ai.rng.range(-22, 22), y = t.y;
      if (def.role === 'artillery') y = zoneY(me, 0.6);
      if (def.role === 'support') y = zoneY(me, 0.2);
      if (def.role === 'defense' && t.kind === 'point' && owner(b.points[t.i]) === me && ai.knobs.forward) { x = b.points[t.i].x + ai.rng.range(-14, 14); y = b.points[t.i].y + (me === 1 ? -20 : 20); }
      x = Math.max(16, Math.min(WORLD_W - 16, x));
      if (t.kind === 'core' && u > 0) why = 'defend spire';
      opts.push({ score: u, hand: h, x, y, why, affordable, cost: def.cost });
    }
  });
  return opts;
}

function clusterValue(b: Battle, team: Team, x: number, y: number, r: number, armoredBias = 0): number {
  let v = 0;
  for (const e of b.ents) {
    if (e.team === team || e.def.kind === 'core') continue;
    if (dist(e, { x, y }) <= r) v += power(e) * (e.def.armor === 'armored' ? 1 + armoredBias : 1) * (e.def.armor === 'air' ? 0.4 : 1);
  }
  return v;
}

function tryAbilities(b: Battle, ai: AiState): boolean {
  const me = ai.team, k = ai.knobs;
  if (k.abilityUse <= 0) return false;
  const sources: { id: number | 'pilot'; ab: AbilityId; src?: Entity }[] = [];
  const side = b.sides[me];
  if (side.pilot && side.pilotCd <= 0) sources.push({ id: 'pilot', ab: side.pilot.ability });
  for (const e of b.ents) if (e.team === me && e.def.ability && e.def.kind !== 'boss' && e.abilityCd <= 0) sources.push({ id: e.id, ab: e.def.ability, src: e });
  for (const s of sources) {
    const def = ABILITIES[s.ab];
    let best = 0, bx = 0, by = 0;
    const enemies = b.ents.filter(e => e.team !== me && e.def.kind !== 'core');
    if (s.ab === 'salvo' || s.ab === 'barrage' || s.ab === 'emp') {
      for (const e of enemies) {
        if (s.src && dist(s.src, e) > 230) continue;
        const v = clusterValue(b, me, e.x, e.y, def.radius ?? 40, s.ab === 'emp' ? 0.5 : 0);
        if (v > best) { best = v; bx = e.x; by = e.y; }
      }
    } else if (s.ab === 'railLance' && s.src) {
      for (const e of enemies) {
        if (dist(s.src, e) > 280) continue;
        const dx = e.x - s.src.x, dy = e.y - s.src.y, L = Math.hypot(dx, dy) || 1;
        let v = 0;
        for (const o of enemies) {
          const px = o.x - s.src.x, py = o.y - s.src.y, along = (px * dx + py * dy) / L;
          if (along < 0 || along > 280) continue;
          if (Math.abs(px * dy - py * dx) / L <= 12 + o.def.radius) v += power(o) * (o.def.armor === 'armored' ? 1.5 : 1);
        }
        if (v > best) { best = v; bx = e.x; by = e.y; }
      }
    } else if (s.ab === 'aegis' && s.src) {
      for (const e of b.ents) if (e.team === me && dist(e, s.src) <= (def.radius ?? 70) && b.t - e.lastHit < 1) best += power(e);
    } else if (s.ab === 'overclock') {
      for (const e of b.ents) if (e.team === me && e.targetId) best += power(e);
      best *= 0.5;
    }
    const bar = (s.ab === 'overclock' ? 8 : s.ab === 'aegis' ? 7 : s.ab === 'railLance' ? 5 : 5.5) * k.abilityBar;
    if (best >= bar && ai.rng.next() < k.abilityUse) {
      const err = useAbility(b, me, s.id, def.targeted ? bx : undefined, def.targeted ? by : undefined);
      if (!err) { ai.counts.abilities++; ai.log.push(`${b.t.toFixed(1)} ability ${s.ab} value ${best.toFixed(1)}`); return true; }
    }
  }
  return false;
}

/** Call once per simulation step, before step(). */
export function aiStep(ai: AiState, b: Battle): void {
  if (b.result) return;
  ai.think -= DT;
  if (ai.think > 0) return;
  ai.think = ai.knobs.interval * (0.8 + ai.rng.next() * 0.4);
  const me = ai.team, side = b.sides[me];
  for (const i of side.hand) if (!ai.handSeen.has(i)) ai.handSeen.set(i, b.t);
  if (tryAbilities(b, ai)) return;

  if (ai.profile === 'passive' && side.supply < 7) return;
  const s = assess(b, me);
  const opts = deployOptions(b, ai, s);

  // Economy: aim for the best card in hand. If it is not affordable yet, only play
  // something cheaper when it is nearly as good, the spire is threatened, or supply is capped.
  opts.sort((a, c) => c.score - a.score);
  const threshold = 0.6;
  const best = opts[0];
  const capped = side.supply >= SUPPLY_MAX - 0.05;
  const urgent = s.coreThreat > 4;
  let pool = opts.filter(o => o.affordable && o.score >= threshold);
  if (best && !best.affordable && !capped && !urgent) {
    pool = pool.filter(o => o.score >= best.score - ai.knobs.impulse);
    if (!pool.length) { ai.counts.waits++; ai.log.push(`${b.t.toFixed(1)} save for ${side.deck[side.hand[best.hand]].unit}`); if (ai.log.length > 60) ai.log.shift(); return; }
  }
  if (capped && !pool.length) pool = opts.filter(o => o.affordable);
  for (const o of pool.slice(0, 4)) {
    let err = checkDeploy(b, me, o.hand, o.x, o.y);
    let { x, y } = o;
    if (err === 'zone' || err === 'blocked') { x = o.x; y = zoneY(me, 0.1); err = checkDeploy(b, me, o.hand, x, y); }
    if (err === 'blocked') { x = Math.max(20, Math.min(WORLD_W - 20, x + 40)); err = checkDeploy(b, me, o.hand, x, y); }
    if (err) continue;
    const deckIdx = side.hand[o.hand];
    const unit = side.deck[deckIdx].unit;
    deploy(b, me, o.hand, x, y);
    ai.handSeen.delete(deckIdx);
    ai.counts.deploys++;
    if (o.why === 'defend spire') ai.counts.defends++;
    if (o.why === 'counter-armour' || counterFit(unit, s.enemyComp, s.enemyTotal) > 1.1) ai.counts.counters++;
    ai.log.push(`${b.t.toFixed(1)} deploy ${unit} (${o.why}) u=${o.score.toFixed(2)}`);
    if (ai.log.length > 60) ai.log.shift();
    return;
  }
  ai.counts.waits++;
}
