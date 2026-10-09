// Battlefield renderer: a tilted 2.5D camera drawn on canvas.
// Reads the battle state, never writes it. Visual effects are spawned from
// simulation events, so rendering stays decoupled from gameplay.

import type { Battle, BattleEvent, Entity } from '../sim/battle.js';
import { WORLD_W as W, WORLD_H as H, DEPLOY_LINE, FORWARD_DEPLOY_RADIUS, POINT_RADIUS, CORE_POS } from '../data/maps.js';
import { UNITS, ABILITIES } from '../data/units.js';
import type { MapDef, Team } from '../data/types.js';

const TEAM = ['#f2a93b', '#9583ff'];
const FG = '#e7eaed', BG = '#0c0f13', SUPPLY = '#6fd3ef', BAD = '#ff6158';

interface Palette { ground: string; grid: string; road: string; rock: string; rockTop: string; edge: string; accent: string }
const PALETTES: Record<MapDef['palette'], Palette> = {
  dust:    { ground: '#29251f', grid: '#37312a', road: '#332d25', rock: '#463e34', rockTop: '#5b5244', edge: '#1a1713', accent: '#c9a46a' },
  foundry: { ground: '#282220', grid: '#382d29', road: '#312824', rock: '#40342f', rockTop: '#57463e', edge: '#191412', accent: '#ff7a3c' },
  ice:     { ground: '#1e262e', grid: '#2a3540', road: '#25303a', rock: '#3a4855', rockTop: '#55687a', edge: '#12181d', accent: '#9fd6ff' },
  night:   { ground: '#16181e', grid: '#232730', road: '#1d2129', rock: '#2d333d', rockTop: '#404857', edge: '#0c0d11', accent: '#ffe08a' },
};

// Camera
const TOP = 36, VS = 0.74, SQ = 0.55;
export const VIEW_W = W, VIEW_H = Math.round(TOP + H * VS + 26);
const sc = (y: number) => 0.76 + 0.24 * y / H;
export const project = (x: number, y: number): [number, number] => [W / 2 + (x - W / 2) * sc(y), TOP + y * VS];
export const unproject = (sx: number, sy: number): [number, number] => { const y = (sy - TOP) / VS; return [W / 2 + (sx - W / 2) / sc(y), y]; };

interface Fx { kind: string; t: number; T: number; team: Team; x: number; y: number; x2?: number; y2?: number; r?: number; h1?: number; h2?: number; weapon?: string; big?: boolean }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; T: number; c: string; s: number }
interface Decal { x: number; y: number; r: number; a: number }

export interface Overlay {
  ghost?: { unit: string; x: number; y: number; valid: boolean } | null;
  targeting?: { ability: string; x: number; y: number; fromX?: number; fromY?: number } | null;
  selectedId?: number;
  showRanges: boolean;
  reduceMotion: boolean;
  showZones: boolean;
}

function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1, 7), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function shade(hex: string, f: number) { const n = parseInt(hex.slice(1, 7), 16); return `rgb(${Math.min(255, (n >> 16 & 255) * f) | 0},${Math.min(255, (n >> 8 & 255) * f) | 0},${Math.min(255, (n & 255) * f) | 0})`; }

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private fx: Fx[] = [];
  private parts: Particle[] = [];
  private decals: Decal[] = [];
  private shake = 0;
  private time = 0;
  private rocks = new Map<string, [number, number][]>();
  private pal: Palette = PALETTES.dust;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  fit(availW: number, availH: number) {
    this.scale = Math.max(0.3, Math.min(availW / VIEW_W, availH / VIEW_H));
    const dpr = Math.min(2.5, globalThis.devicePixelRatio || 1);
    this.canvas.style.width = `${Math.floor(VIEW_W * this.scale)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * this.scale)}px`;
    this.canvas.width = Math.round(VIEW_W * this.scale * dpr);
    this.canvas.height = Math.round(VIEW_H * this.scale * dpr);
    this.ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
  }

  /** Convert a pointer position to world coordinates. */
  toWorld(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const r = this.canvas.getBoundingClientRect();
    const sx = (clientX - r.left) / r.width * VIEW_W, sy = (clientY - r.top) / r.height * VIEW_H;
    const [x, y] = unproject(sx, sy);
    return { x, y, inside: x >= 0 && x <= W && y >= 0 && y <= H && sx >= 0 && sx <= VIEW_W && sy >= 0 && sy <= VIEW_H };
  }

  /** Is the client point inside the canvas element at all? */
  overCanvas(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  /** Find the unit under a pointer (generous hit area for touch). */
  pick(b: Battle, clientX: number, clientY: number): Entity | null {
    const r = this.canvas.getBoundingClientRect();
    const sx = (clientX - r.left) / r.width * VIEW_W, sy = (clientY - r.top) / r.height * VIEW_H;
    let best: Entity | null = null, bd = 22;
    for (const e of b.ents) {
      const [ex, ey] = project(e.x, e.y);
      const hgt = e.def.height * sc(e.y) * 0.5 + (e.def.kind === 'drone' ? 16 : 0);
      const d = Math.hypot(ex - sx, ey - hgt - sy) - e.def.radius * 0.6;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  reset(map: MapDef) {
    this.fx = []; this.parts = []; this.decals = []; this.shake = 0;
    this.pal = PALETTES[map.palette];
    this.rocks.clear();
    for (const o of map.obstacles) {
      const pts: [number, number][] = [];
      let s = (o.x * 73856093) ^ (o.y * 19349663);
      const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const n = 9;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = o.r * (0.85 + rnd() * 0.3); pts.push([o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr]); }
      this.rocks.set(`${o.x},${o.y}`, pts);
    }
  }

  ingest(events: BattleEvent[], reduceMotion: boolean) {
    for (const ev of events) {
      switch (ev.type) {
        case 'shot': {
          const T = ev.weapon === 'antiarmor' ? 0.22 : 0.09;
          this.fx.push({ kind: 'shot', t: T, T, team: ev.team, x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, h1: ev.h1, h2: ev.h2, weapon: ev.weapon, big: ev.heavy });
          if (ev.weapon === 'antiarmor') this.fx.push({ kind: 'spark', t: 0.2, T: 0.2, team: ev.team, x: ev.x2, y: ev.y2, r: 6, h1: ev.h2 });
          break;
        }
        case 'shell': this.fx.push({ kind: 'shell', t: ev.t, T: ev.t, team: ev.team, x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2 }); break;
        case 'blast':
          this.fx.push({ kind: 'blast', t: 0.45, T: 0.45, team: ev.team, x: ev.x, y: ev.y, r: ev.r });
          this.burst(ev.x, ev.y, 6, '#ffb36b', 50);
          this.decal(ev.x, ev.y, ev.r * 0.7);
          if (!reduceMotion) this.shake = Math.max(this.shake, 1.5);
          break;
        case 'death': {
          const big = ev.size >= 12;
          this.fx.push({ kind: 'blast', t: big ? 0.8 : 0.4, T: big ? 0.8 : 0.4, team: ev.team, x: ev.x, y: ev.y, r: ev.size * (big ? 3 : 2.2), big });
          this.burst(ev.x, ev.y, big ? 22 : 7, big ? '#ffcf7a' : shade(TEAM[ev.team], 1), big ? 110 : 60);
          if (big) { this.decal(ev.x, ev.y, ev.size * 1.6); if (!reduceMotion) this.shake = Math.max(this.shake, ev.kind === 'core' || ev.kind === 'boss' ? 9 : 4); }
          break;
        }
        case 'deploy':
          this.fx.push({ kind: 'deploy', t: ev.heavy ? 0.7 : 0.45, T: ev.heavy ? 0.7 : 0.45, team: ev.team, x: ev.x, y: ev.y, big: ev.heavy });
          if (ev.heavy && !reduceMotion) this.shake = Math.max(this.shake, 3);
          if (ev.heavy) this.burst(ev.x, ev.y, 10, '#c8b9a0', 70);
          break;
        case 'capture':
          if (ev.team !== null) { const p = ev as { point: string }; this.fx.push({ kind: 'capture', t: 0.9, T: 0.9, team: ev.team, x: 0, y: 0, weapon: p.point }); }
          break;
        case 'ability':
          this.fx.push({ kind: 'ab-' + ev.ability, t: ev.ability === 'railLance' ? 0.5 : ev.ability === 'barrage' ? 2.2 : 0.9, T: ev.ability === 'railLance' ? 0.5 : ev.ability === 'barrage' ? 2.2 : 0.9, team: ev.team, x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, r: ev.r });
          if (!reduceMotion && (ev.ability === 'quake' || ev.ability === 'railLance')) this.shake = Math.max(this.shake, 5);
          break;
        case 'heal': this.fx.push({ kind: 'heal', t: 0.35, T: 0.35, team: ev.team, x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2 }); break;
      }
    }
    if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);
  }

  private burst(x: number, y: number, n: number, c: string, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, z: 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 40 + Math.random() * 90, t: 0.8, T: 0.8, c, s: 1 + Math.random() * 2 });
    }
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
  }
  private decal(x: number, y: number, r: number) {
    this.decals.push({ x, y, r, a: 0.5 });
    if (this.decals.length > 60) this.decals.shift();
  }

  // ------------------------------------------------------------------ drawing

  draw(b: Battle, o: Overlay, dt: number) {
    const ctx = this.ctx;
    this.time += dt;
    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter(f => f.t > 0);
    for (const p of this.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 260 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } }
    this.parts = this.parts.filter(p => p.t > 0);
    this.shake = Math.max(0, this.shake - dt * 18);

    ctx.save();
    ctx.fillStyle = BG; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
    if (this.shake > 0 && !o.reduceMotion) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawGround(b, o);
    for (const d of this.decals) this.gEll(d.x, d.y, d.r, `rgba(0,0,0,${d.a})`);
    for (const p of b.points) this.drawPointBase(b, p);

    if (o.selectedId) {
      const e = b.ents.find(x => x.id === o.selectedId);
      if (e) {
        this.gEll(e.x, e.y, e.def.radius + 6, null, FG, 1.5);
        if (e.def.weapon) this.gEll(e.x, e.y, e.def.weapon.range + e.def.radius, hexA(TEAM[e.team], 0.06), hexA(TEAM[e.team], 0.6), 1, true);
        if (e.def.weapon?.minRange) this.gEll(e.x, e.y, e.def.weapon.minRange, null, hexA(BAD, 0.6), 1, true);
        if (e.def.heal) this.gEll(e.x, e.y, e.def.heal.range, hexA(SUPPLY, 0.06), hexA(SUPPLY, 0.6), 1, true);
        const t = e.targetId ? b.ents.find(x => x.id === e.targetId) : undefined;
        if (t) { const [ax, ay] = project(e.x, e.y), [bx, by] = project(t.x, t.y); ctx.setLineDash([3, 4]); ctx.strokeStyle = hexA(FG, 0.5); ctx.lineWidth = 1; this.line(ax, ay, bx, by); ctx.setLineDash([]); }
      }
    }
    for (const s of b.shells) this.drawReticle(s.x, s.y, s.splash, TEAM[s.team], 0.5);

    // Depth-sorted scene objects
    const items: { y: number; f: () => void }[] = [];
    for (const e of b.ents) items.push({ y: e.y + (e.def.kind === 'drone' ? 0.1 : 0), f: () => this.drawUnit(b, e, o) });
    for (const ob of b.map.obstacles) items.push({ y: ob.y, f: () => this.drawRock(ob.x, ob.y, ob.r) });
    for (const p of b.points) items.push({ y: p.y + 0.5, f: () => this.drawPointFlag(p) });
    items.sort((a, c) => a.y - c.y).forEach(i => i.f());

    this.drawFx(b);
    for (const p of this.parts) { const [sx, sy] = project(p.x, p.y); ctx.fillStyle = hexA(p.c.startsWith('#') ? p.c : '#ffcf7a', Math.min(1, p.t / p.T * 1.5)); ctx.fillRect(sx - p.s / 2, sy - p.z * sc(p.y) - p.s / 2, p.s, p.s); }

    if (o.ghost) this.drawGhost(o.ghost, o.showRanges);
    if (o.targeting) this.drawTargeting(o.targeting);
    ctx.restore();
  }

  private gEll(x: number, y: number, r: number, fill: string | null, stroke?: string, lw = 1, dashed = false, a0 = 0, a1 = Math.PI * 2) {
    const ctx = this.ctx, [sx, sy] = project(x, y), s = sc(y);
    ctx.beginPath(); ctx.ellipse(sx, sy, r * s, r * s * SQ * 1.35 * VS, 0, a0, a1);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dashed) ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]); }
  }
  private line(x1: number, y1: number, x2: number, y2: number) { const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  private poly(pts: [number, number][], fill: string | null, stroke?: string, lw = 1) {
    const c = this.ctx; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }

  private drawGround(b: Battle, o: Overlay) {
    const ctx = this.ctx, p = this.pal;
    const bl = project(0, H), br = project(W, H), tl = project(0, 0), tr = project(W, 0);
    this.poly([bl, br, [br[0], br[1] + 14], [bl[0], bl[1] + 14]], p.edge);
    this.poly([tl, tr, br, bl], p.ground);
    // Roads: spire to each hardpoint
    ctx.lineCap = 'round';
    for (const team of [0, 1] as Team[]) {
      const c = CORE_POS[team];
      for (const pt of b.points) {
        ctx.strokeStyle = p.road; ctx.globalAlpha = 0.7;
        ctx.lineWidth = 18 * sc((c.y + pt.y) / 2);
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const t = i / 16, mx = (c.x + pt.x) / 2, my = (c.y + pt.y) / 2 + (team === 0 ? 40 : -40);
          const x = (1 - t) * (1 - t) * c.x + 2 * (1 - t) * t * (pt.x * 0.6 + mx * 0.4) + t * t * pt.x;
          const y = (1 - t) * (1 - t) * c.y + 2 * (1 - t) * t * my + t * t * pt.y;
          const [sx, sy] = project(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    ctx.lineCap = 'butt';
    ctx.strokeStyle = p.grid; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { const a = project(x, 0), c = project(x, H); this.line(a[0], a[1], c[0], c[1]); }
    for (let y = 0; y <= H; y += 40) { const a = project(0, y), c = project(W, y); this.line(a[0], a[1], c[0], c[1]); }
    // Deploy lines
    const z0 = DEPLOY_LINE[0], z1 = DEPLOY_LINE[1];
    this.poly([project(0, z0), project(W, z0), br, bl], hexA(TEAM[0], o.showZones ? 0.12 : 0.04));
    this.poly([tl, tr, project(W, z1), project(0, z1)], hexA(TEAM[1], 0.04));
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = hexA(TEAM[0], o.showZones ? 0.9 : 0.35); let a = project(0, z0), c = project(W, z0); this.line(a[0], a[1], c[0], c[1]);
    ctx.strokeStyle = hexA(TEAM[1], 0.35); a = project(0, z1); c = project(W, z1); this.line(a[0], a[1], c[0], c[1]);
    ctx.setLineDash([]);
    if (o.showZones) for (const pt of b.points) if (pt.owner === 0 && pt.cap >= 100) this.gEll(pt.x, pt.y, FORWARD_DEPLOY_RADIUS, hexA(TEAM[0], 0.1), hexA(TEAM[0], 0.8), 1.5, true);
    // Map accent: ember vents, ice cracks, floodlights
    if (b.map.palette === 'foundry') for (const [x, y] of [[40, 120], [320, 520], [300, 140], [60, 500]]) this.gEll(x, y, 10 + Math.sin(this.time * 2 + x) * 2, hexA(p.accent, 0.25));
    if (b.map.palette === 'night') for (const [x, y] of [[30, 30], [330, 30]]) { const [sx, sy] = project(x, y); const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 140); g.addColorStop(0, hexA(p.accent, 0.12)); g.addColorStop(1, hexA(p.accent, 0)); ctx.fillStyle = g; ctx.fillRect(sx - 140, sy - 140, 280, 280); }
  }

  private drawPointBase(_b: Battle, p: Battle['points'][number]) {
    const own = p.owner;
    this.gEll(p.x, p.y, POINT_RADIUS, own !== null ? hexA(TEAM[own], 0.14) : 'rgba(255,255,255,0.03)', own !== null ? hexA(TEAM[own], 0.6) : '#3a4450', 2);
    this.gEll(p.x, p.y, POINT_RADIUS * 0.6, null, 'rgba(255,255,255,0.08)', 1);
    if (Math.abs(p.cap) > 0.5) {
      const t: Team = p.cap > 0 ? 0 : 1;
      this.gEll(p.x, p.y, POINT_RADIUS + 3, null, TEAM[t], 3.5, false, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(p.cap) / 100);
    }
  }
  private drawPointFlag(p: Battle['points'][number]) {
    const ctx = this.ctx, [sx, sy] = project(p.x, p.y), s = sc(p.y);
    const c = p.owner !== null ? TEAM[p.owner] : '#8b95a1';
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; this.line(sx, sy, sx, sy - 34 * s);
    const fy = sy - 34 * s;
    this.poly([[sx, fy - 11], [sx + 11, fy], [sx, fy + 11], [sx - 11, fy]], BG, c, 1.5);
    ctx.fillStyle = c; ctx.font = `700 13px Bahnschrift, 'Arial Narrow', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.id, sx, fy + 1);
  }
  private drawRock(x: number, y: number, r: number) {
    const pts = this.rocks.get(`${x},${y}`); if (!pts) return;
    const p = this.pal, s = sc(y), hgt = (12 + r * 0.6) * s;
    const base = pts.map(([px, py]) => project(px, py));
    const top = base.map(([px, py]) => [px, py - hgt] as [number, number]);
    this.ctx.fillStyle = 'rgba(0,0,0,.35)'; this.ctx.beginPath(); const [cx, cy] = project(x + 6, y + 4); this.ctx.ellipse(cx, cy, r * s * 1.05, r * s * 0.5, 0, 0, Math.PI * 2); this.ctx.fill();
    // side faces (only those facing the camera)
    for (let i = 0; i < base.length; i++) {
      const j = (i + 1) % base.length;
      if ((base[i][0] - base[j][0]) > 0) continue;
      this.poly([base[i], base[j], top[j], top[i]], shade(p.rock.slice(0, 7), 0.75 + 0.25 * ((i % 3) / 2)));
    }
    this.poly(top, p.rockTop, shade(p.rockTop, 0.8), 1);
  }

  private drawUnit(b: Battle, e: Entity, o: Overlay) {
    const ctx = this.ctx, d = e.def;
    const [sx, sy0] = project(e.x, e.y), s = sc(e.y);
    // Units are drawn larger than their collision radius so they read on a phone.
    const vis = d.kind === 'core' ? 1.1 : d.kind === 'boss' ? 1.2 : d.kind === 'infantry' ? 1.6 : 1.4;
    const r = d.radius * s * vis, h = d.height * s * vis;
    const age = b.t - e.spawnT;
    const drop = age < 0.35 && d.kind !== 'core' && d.kind !== 'boss' ? (1 - age / 0.35) * 60 : 0;
    const sy = sy0 - drop;
    const c = e.hp > 0 && b.t - e.lastHit < 0.07 ? FG : TEAM[e.team];
    const fx = Math.cos(e.face), fy = Math.sin(e.face) * SQ;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(sx, sy0, r * 1.15, r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    if (e.aegis > 0) { ctx.fillStyle = hexA(SUPPLY, 0.16); ctx.strokeStyle = hexA(SUPPLY, 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy - h * 0.5, r * 1.6, h * 0.9 + r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (b.sides[e.team].overclock > 0 && d.weapon) { ctx.strokeStyle = hexA('#ffe08a', 0.5 + 0.3 * Math.sin(this.time * 12)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(sx, sy0, r * 1.4, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineCap = 'round';
    const box = (x: number, base: number, w: number, hh: number, dep: number, front: string, top: string) => {
      ctx.fillStyle = front; ctx.fillRect(x - w / 2, base - hh, w, hh);
      this.poly([[x - w / 2, base - hh], [x + w / 2, base - hh], [x + w / 2 - dep * 0.3, base - hh - dep], [x - w / 2 + dep * 0.3, base - hh - dep]], top);
    };
    const gun = (x0: number, y0: number, len: number, w: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = w; this.line(x0, y0, x0 + fx * len, y0 + fy * len); };
    switch (d.kind) {
      case 'infantry': {
        const bw = r * (d.id === 'breaker_team' ? 1.3 : 1.05);
        ctx.fillStyle = shade(c, 0.6); this.rr(sx - bw / 2, sy - h, bw, h, bw * 0.35);
        ctx.fillStyle = c; this.rr(sx - bw / 2, sy - h, bw, h * 0.55, bw * 0.35);
        ctx.fillStyle = FG; ctx.beginPath(); ctx.arc(sx, sy - h - r * 0.25, r * 0.42, 0, Math.PI * 2); ctx.fill();
        if (d.id === 'breaker_team') { ctx.fillStyle = shade(c, 0.4); ctx.save(); ctx.translate(sx, sy - h * 0.8); ctx.rotate(Math.atan2(fy, fx)); ctx.fillRect(-r * 0.6, -r * 0.3, r * 2, r * 0.6); ctx.restore(); }
        else gun(sx, sy - h * 0.55, r * 1.4, 1.3 * s, shade(FG, 0.8));
        break;
      }
      case 'drone': {
        const hy = sy - h - Math.sin(this.time * 6 + e.id) * 2;
        ctx.save(); ctx.translate(sx, hy); ctx.rotate(Math.atan2(fy, fx));
        this.poly([[r * 1.4, 0], [-r * 0.8, r], [-r * 0.4, 0], [-r * 0.8, -r]], c);
        ctx.restore();
        ctx.strokeStyle = hexA(FG, 0.45); ctx.lineWidth = 1;
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx + k * r * 1.2, hy - 2, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
        break;
      }
      case 'vehicle': {
        if (d.id === 'hound_apc') {
          box(sx, sy, r * 2.2, h * 0.7, r * 0.8, shade(c, 0.55), c);
          ctx.fillStyle = shade(c, 0.75); ctx.fillRect(sx - r * 0.45, sy - h * 0.7 - r * 0.8 - h * 0.35, r * 0.9, h * 0.35);
          gun(sx, sy - h * 0.9 - r * 0.5, r * 1.6, 2.2 * s, FG);
          ctx.fillStyle = '#111'; for (const k of [-0.7, 0, 0.7]) { ctx.beginPath(); ctx.arc(sx + k * r, sy - 1, r * 0.28, 0, Math.PI * 2); ctx.fill(); }
        } else if (d.id === 'mortar_crawler') {
          ctx.fillStyle = '#15181c'; this.rr(sx - r * 1.1, sy - h * 0.3, r * 2.2, h * 0.3, 3);
          box(sx, sy - h * 0.25, r * 2, h * 0.5, r * 0.8, shade(c, 0.55), c);
          ctx.save(); ctx.translate(sx, sy - h * 0.8 - r * 0.4); ctx.rotate(-0.7 + (fx < 0 ? -0.3 : 0.3));
          ctx.fillStyle = shade(c, 0.7); ctx.fillRect(-r * 0.25, -r * 1.6, r * 0.5, r * 1.6); ctx.restore();
        } else {
          ctx.strokeStyle = shade(c, 0.35); ctx.lineWidth = 2.5 * s;
          for (const k of [-0.8, -0.3, 0.3, 0.8]) this.line(sx + k * r, sy, sx + k * r * 0.8, sy - h * 0.5);
          box(sx, sy - h * 0.45, r * 2, h * 0.5, r * 0.7, shade(c, 0.55), c);
          ctx.fillStyle = SUPPLY; ctx.fillRect(sx - r * 0.12, sy - h * 0.85, r * 0.24, h * 0.35); ctx.fillRect(sx - r * 0.35, sy - h * 0.72, r * 0.7, h * 0.1);
        }
        break;
      }
      case 'structure': {
        ctx.fillStyle = shade(c, 0.35); ctx.beginPath(); ctx.ellipse(sx, sy - 2 * s, r, r * SQ, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(c, 0.6); ctx.fillRect(sx - r * 0.35, sy - h, r * 0.7, h);
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx, sy - h, r * 0.6, 0, Math.PI * 2); ctx.fill();
        gun(sx, sy - h, r * 1.5, 2.5 * s, shade(c, 0.45));
        break;
      }
      case 'mech': case 'hero': case 'boss': {
        const legW = r * 0.42, legH = h * 0.45;
        ctx.fillStyle = shade(c, 0.38);
        const step = Math.sin(this.time * 6 + e.id) * (d.speed ? 1.5 : 0) * s;
        ctx.fillRect(sx - r * 0.78, sy - legH + step, legW, legH - step); ctx.fillRect(sx + r * 0.78 - legW, sy - legH - step, legW, legH + step);
        const tw = d.id === 'kestrel' ? r * 1.7 : d.id === 'vesper' ? r * 1.3 : r * 2;
        const th = d.id === 'vesper' ? h * 0.75 : h * 0.6;
        box(sx, sy - h * 0.4, tw, th, r * 0.6, shade(c, 0.7), c);
        const top = sy - h * 0.4 - th;
        if (d.id === 'monolith') { ctx.fillStyle = shade(c, 0.85); ctx.fillRect(sx - tw / 2 - r * 0.45, top + 2, r * 0.45, th * 0.9); ctx.fillRect(sx + tw / 2, top + 2, r * 0.45, th * 0.9); }
        if (d.id === 'kestrel') { ctx.fillStyle = c; this.poly([[sx - tw / 2, top + th * 0.3], [sx - tw / 2 - r * 0.9, top - r * 0.4], [sx - tw / 2, top + th * 0.6]], c); this.poly([[sx + tw / 2, top + th * 0.3], [sx + tw / 2 + r * 0.9, top - r * 0.4], [sx + tw / 2, top + th * 0.6]], c); }
        if (d.kind === 'boss') { ctx.fillStyle = shade(c, 0.6); ctx.fillRect(sx - tw * 0.4, top - r * 0.9, r * 0.5, r * 0.9); ctx.fillRect(sx + tw * 0.4 - r * 0.5, top - r * 0.9, r * 0.5, r * 0.9); }
        ctx.fillStyle = BG; ctx.fillRect(sx - tw * 0.22, top + th * 0.2, tw * 0.44, th * 0.18);
        ctx.fillStyle = d.kind === 'boss' ? BAD : hexA(FG, 0.9); ctx.fillRect(sx - tw * 0.14, top + th * 0.23, tw * 0.28, th * 0.08);
        const gl = (d.id === 'vesper' ? 2.4 : d.id === 'kestrel' ? 1.3 : d.kind === 'boss' ? 1.2 : 1.5) * r;
        gun(sx + fx * r * 0.3, top + th * 0.45, gl, (d.id === 'monolith' || d.kind === 'boss' ? 5 : 3.2) * s, d.id === 'kestrel' || d.id === 'vesper' ? SUPPLY : shade(c, 0.45));
        break;
      }
      case 'core': {
        ctx.fillStyle = shade(c, 0.25); ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.7, r * 1.7 * SQ, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA(c, 0.6); ctx.lineWidth = 1.5; ctx.stroke();
        box(sx, sy, r * 1.3, h, r * 0.6, shade(c, 0.5), shade(c, 0.85));
        this.poly([[sx - r * 0.5, sy - h - r * 0.4], [sx, sy - h - r * 1.6], [sx + r * 0.5, sy - h - r * 0.4]], c);
        ctx.fillStyle = hexA(FG, 0.6 + 0.4 * Math.sin(this.time * 3)); ctx.fillRect(sx - 2, sy - h * 0.7, 4, 4);
        gun(sx, sy - h * 0.55, r * 1.2, 4 * s, shade(c, 0.4));
        break;
      }
    }
    ctx.lineCap = 'butt';
    if (e.stun > 0) { ctx.strokeStyle = SUPPLY; ctx.lineWidth = 1.2; const t = this.time * 20; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = t + i; ctx.lineTo(sx + Math.cos(a) * r, sy - h - 6 + Math.sin(a * 1.7) * 3); } ctx.stroke(); }
    // Health bar
    const showBar = d.kind === 'core' || d.kind === 'boss' || d.hero || (e.hp < e.maxHp && (d.kind !== 'infantry' || e.hp < e.maxHp * 0.99));
    if (showBar && drop === 0) {
      const w = d.kind === 'core' ? 46 : d.kind === 'boss' ? 56 : Math.max(14, r * 2.2);
      const y0 = sy - h - (d.kind === 'drone' ? h * 0.2 + 8 : d.kind === 'core' ? r * 1.8 : r * 0.9) - 6;
      ctx.fillStyle = BG; ctx.fillRect(sx - w / 2 - 1, y0 - 1, w + 2, d.kind === 'core' || d.kind === 'boss' ? 6 : 4);
      ctx.fillStyle = TEAM[e.team]; ctx.fillRect(sx - w / 2, y0, w * Math.max(0, e.hp / e.maxHp), d.kind === 'core' || d.kind === 'boss' ? 4 : 2);
      if (e.level > 1 && d.kind !== 'core') { ctx.fillStyle = hexA(FG, 0.7); for (let i = 0; i < e.level - 1; i++) ctx.fillRect(sx - w / 2 + i * 3, y0 - 3, 2, 2); }
    }
    void o;
  }

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx; c.beginPath();
    if ((c as any).roundRect) (c as any).roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    c.fill();
  }

  private drawReticle(x: number, y: number, r: number, color: string, a: number) {
    this.gEll(x, y, r, hexA(color, a * 0.15), hexA(color, a), 1, true);
  }

  private drawFx(b: Battle) {
    const ctx = this.ctx;
    for (const f of this.fx) {
      const k = f.t / f.T;
      switch (f.kind) {
        case 'shot': {
          const [ax, ay] = project(f.x, f.y), [bx, by] = project(f.x2!, f.y2!);
          const a = [ax, ay - (f.h1 ?? 6) * sc(f.y)], z = [bx, by - (f.h2 ?? 6) * sc(f.y2!)];
          if (f.weapon === 'antiarmor') {
            const p = 1 - k; const px = a[0] + (z[0] - a[0]) * p, py = a[1] + (z[1] - a[1]) * p;
            ctx.strokeStyle = hexA('#ffb36b', 0.6); ctx.lineWidth = 1.5; this.line(a[0] + (z[0] - a[0]) * Math.max(0, p - 0.25), a[1] + (z[1] - a[1]) * Math.max(0, p - 0.25), px, py);
            ctx.fillStyle = '#fff1d6'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
          } else {
            const col = f.weapon === 'energy' ? SUPPLY : f.big ? '#fff1d6' : TEAM[f.team];
            ctx.strokeStyle = hexA(col.startsWith('#') ? col : '#ffffff', k); ctx.lineWidth = f.big ? 2.4 : 1.1; this.line(a[0], a[1], z[0], z[1]);
            if (k > 0.6) { ctx.fillStyle = hexA('#fff1d6', k); ctx.beginPath(); ctx.arc(a[0], a[1], f.big ? 3 : 1.6, 0, Math.PI * 2); ctx.fill(); }
          }
          break;
        }
        case 'spark': { const [sx, sy] = project(f.x, f.y); if (k < 0.5) { ctx.fillStyle = hexA('#ffcf7a', k * 2); ctx.beginPath(); ctx.arc(sx, sy - (f.h1 ?? 6), 5 * (1 - k), 0, Math.PI * 2); ctx.fill(); } break; }
        case 'shell': {
          const p = 1 - k, x = f.x + (f.x2! - f.x) * p, y = f.y + (f.y2! - f.y) * p, z = Math.sin(p * Math.PI) * 70;
          const [sx, sy] = project(x, y);
          ctx.fillStyle = '#fff1d6'; ctx.beginPath(); ctx.arc(sx, sy - z * sc(y), 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = hexA('#ffffff', 0.15); ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'blast': {
          const r = f.r! * (1.2 - k * 0.6);
          this.gEll(f.x, f.y, r, hexA('#ffcf7a', k * 0.35), hexA(f.big ? '#ffffff' : TEAM[f.team], k), 2);
          if (k > 0.7) { const [sx, sy] = project(f.x, f.y); ctx.fillStyle = hexA('#fff1d6', (k - 0.7) * 3); ctx.beginPath(); ctx.arc(sx, sy - 6, f.r! * 0.5, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'deploy': {
          const [sx, sy] = project(f.x, f.y);
          this.gEll(f.x, f.y, (f.big ? 16 : 9) + 28 * k, null, hexA(TEAM[f.team], k), 1.5);
          ctx.strokeStyle = hexA(TEAM[f.team], k * 0.8); ctx.lineWidth = f.big ? 5 : 2.5; this.line(sx, sy - (f.big ? 220 : 110) * k, sx, sy);
          break;
        }
        case 'capture': {
          const p = b.points.find(q => q.id === f.weapon); if (!p) break;
          this.gEll(p.x, p.y, POINT_RADIUS + 30 * (1 - k), null, hexA(TEAM[f.team], k), 3);
          break;
        }
        case 'heal': { const [ax, ay] = project(f.x, f.y), [bx, by] = project(f.x2!, f.y2!); ctx.strokeStyle = hexA(SUPPLY, k * 0.9); ctx.lineWidth = 2; ctx.setLineDash([2, 3]); this.line(ax, ay - 10, bx, by - 8); ctx.setLineDash([]); break; }
        case 'ab-salvo': { const [ax, ay] = project(f.x, f.y), [bx, by] = project(f.x2!, f.y2!); ctx.strokeStyle = hexA('#ffb36b', k * 0.5); ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) this.line(ax, ay - 20, bx + i * 6, by - 40 * k); this.drawReticle(f.x2!, f.y2!, f.r!, '#ffb36b', k); break; }
        case 'ab-aegis': this.gEll(f.x, f.y, f.r! * (1 - k * 0.3), hexA(SUPPLY, 0.12 * k), hexA(SUPPLY, k), 2); break;
        case 'ab-railLance': { const [ax, ay] = project(f.x, f.y), [bx, by] = project(f.x2!, f.y2!); ctx.strokeStyle = hexA(SUPPLY, k); ctx.lineWidth = 8 * k + 1; this.line(ax, ay - 24, bx, by - 24); ctx.strokeStyle = hexA('#ffffff', k); ctx.lineWidth = 2; this.line(ax, ay - 24, bx, by - 24); break; }
        case 'ab-overclock': { for (const e of b.ents) if (e.team === f.team && e.def.weapon && e.def.kind !== 'core') this.gEll(e.x, e.y, e.def.radius + 10 * (1 - k), null, hexA('#ffe08a', k), 1.5); break; }
        case 'ab-barrage': this.drawReticle(f.x, f.y, f.r!, TEAM[f.team], Math.min(1, k * 2)); break;
        case 'ab-emp': this.gEll(f.x, f.y, f.r! * (1.1 - k * 0.6), hexA(SUPPLY, 0.18 * k), hexA(SUPPLY, k), 2.5); break;
        case 'ab-quake': this.gEll(f.x, f.y, f.r! * (1.2 - k), null, hexA(BAD, k), 4); break;
      }
    }
  }

  private drawGhost(g: NonNullable<Overlay['ghost']>, showRanges: boolean) {
    const d = UNITS[g.unit];
    const col = g.valid ? TEAM[0] : BAD;
    if (showRanges && d.weapon) this.gEll(g.x, g.y, d.weapon.range, hexA(col, 0.06), hexA(col, 0.7), 1, true);
    if (showRanges && d.heal) this.gEll(g.x, g.y, d.heal.range, hexA(SUPPLY, 0.06), hexA(SUPPLY, 0.7), 1, true);
    this.gEll(g.x, g.y, Math.max(8, d.radius + 4), hexA(col, 0.25), col, 2);
    const [sx, sy] = project(g.x, g.y);
    this.ctx.strokeStyle = hexA(col, 0.6); this.ctx.lineWidth = 2; this.line(sx, sy, sx, sy - 40);
    this.ctx.fillStyle = col; this.ctx.font = `700 11px Bahnschrift, 'Arial Narrow', sans-serif`; this.ctx.textAlign = 'center';
    this.ctx.fillText(g.valid ? d.name.toUpperCase() : 'CAN\'T DEPLOY HERE', sx, sy - 46);
  }

  private drawTargeting(t: NonNullable<Overlay['targeting']>) {
    const def = ABILITIES[t.ability as keyof typeof ABILITIES];
    if (t.ability === 'railLance' && t.fromX !== undefined) {
      const dx = t.x - t.fromX, dy = t.y - t.fromY!, L = Math.hypot(dx, dy) || 1;
      const [ax, ay] = project(t.fromX, t.fromY!), [bx, by] = project(t.fromX + dx / L * 280, t.fromY! + dy / L * 280);
      this.ctx.strokeStyle = hexA(SUPPLY, 0.7); this.ctx.lineWidth = 3; this.ctx.setLineDash([6, 4]); this.line(ax, ay, bx, by); this.ctx.setLineDash([]);
      return;
    }
    this.drawReticle(t.x, t.y, def?.radius ?? 40, def?.id === 'emp' || def?.id === 'aegis' ? SUPPLY : TEAM[0], 1);
    if (t.fromX !== undefined && def?.id === 'salvo') this.gEll(t.fromX, t.fromY!, 230, null, hexA(FG, 0.25), 1, true);
  }
}
