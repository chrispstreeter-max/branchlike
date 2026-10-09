// Urban battlefield environments for the 3D renderer.
// Streets are the lanes; obstacles are city buildings built inside their
// collision footprint; the city continues past the field edges. All geometry is
// procedural and merged into a handful of draw calls. Signage uses BRANCHLIKE's
// own faction and district names.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MapDef, Team } from '../data/types.js';
import { WORLD_W as W, WORLD_H as H, CORE_POS, DEPLOY_LINE, POINT_RADIUS } from '../data/maps.js';
import { Kit } from './models3d.js';

type T3 = any;
const TEAM_HEX = ['#f2a93b', '#9583ff'];

export interface MapLook {
  bg: number; fogNear: number; fogFar: number;
  asphalt: string; sidewalk: string; curb: string; marking: string; terrain: number;
  sun: number; sunI: number; sky: number; groundHemi: number; hemiI: number; exposure: number;
  accent: string; neon: number[]; building: number[]; roof: number; trim: number; windows: number; tree: number[]; snowRoofs?: boolean;
}

export const LOOKS: Record<MapDef['palette'], MapLook> = {
  dust: {
    bg: 0x9db0c2, fogNear: 1100, fogFar: 2600, asphalt: '#3d4146', sidewalk: '#9b9a95', curb: '#cdc9bf', marking: '#ebe7dc', terrain: 0x45484c,
    sun: 0xfff0d8, sunI: 3.1, sky: 0xd3e2f5, groundHemi: 0x50483e, hemiI: 1.55, exposure: 1.2,
    accent: '#f2b23b', neon: [0x46e0ff, 0xff8a3c, 0xf2b23b], building: [0x8b9098, 0xa0988b, 0x707883, 0xb4a68f, 0x7d8a8f], roof: 0x4c5159, trim: 0xd6d1c6, windows: 0xffd89a, tree: [0x5f8f4a, 0x6f9e52, 0x4f7d40],
  },
  foundry: {
    bg: 0x6b5446, fogNear: 900, fogFar: 2300, asphalt: '#36322f', sidewalk: '#7d746c', curb: '#ab9d8e', marking: '#e6d8c5', terrain: 0x3a332e,
    sun: 0xffc690, sunI: 2.8, sky: 0xc2b6ac, groundHemi: 0x3a2618, hemiI: 1.3, exposure: 1.15,
    accent: '#ff7a3c', neon: [0xff6a2a, 0xffb36b, 0x46e0ff], building: [0x6f6056, 0x806c5d, 0x5c514a, 0x8c7765, 0x6a5a50], roof: 0x3f3732, trim: 0xb09a86, windows: 0xff9a4c, tree: [0x5d6f3f, 0x6a7a46, 0x4f5f36],
  },
  ice: {
    bg: 0xb4c6d6, fogNear: 1100, fogFar: 2600, asphalt: '#4b535c', sidewalk: '#cfd8df', curb: '#f0f4f7', marking: '#ffffff', terrain: 0xc9d4dc,
    sun: 0xf3f8ff, sunI: 3.0, sky: 0xe2efff, groundHemi: 0x3a4656, hemiI: 1.6, exposure: 1.12,
    accent: '#9fd6ff', neon: [0x46e0ff, 0x9fd6ff, 0xf2b23b], building: [0x7e8a95, 0x8f9ba7, 0x6b7783, 0xa4afb9, 0x77838f], roof: 0xeef3f7, trim: 0xdfe6ec, windows: 0xc8ecff, tree: [0x3f6150, 0x4d6e5c, 0x365646], snowRoofs: true,
  },
  night: {
    bg: 0x121827, fogNear: 900, fogFar: 2300, asphalt: '#262a31', sidewalk: '#4d525c', curb: '#70757f', marking: '#c9ccd4', terrain: 0x1b1f28,
    sun: 0xa6b9ff, sunI: 1.9, sky: 0x7486b5, groundHemi: 0x1b1e28, hemiI: 1.25, exposure: 1.35,
    accent: '#ffe08a', neon: [0x46e0ff, 0xff5ccf, 0xf2b23b], building: [0x3c4350, 0x48505e, 0x343a46, 0x55606f, 0x404856], roof: 0x2b3038, trim: 0x7a8190, windows: 0xffdc8a, tree: [0x355a3f, 0x3f6a49, 0x2c4c35],
  },
};

const SIGNS = ['CORSAIR', 'REACH TRANSIT', 'HALCYON', 'CINDER 24', 'RELAY', 'FREIGHT', 'DEPOT 7', 'UNION HALL', 'GATEWORKS', 'NIGHT MARKET', 'FOUNDRY', 'LINE 3'];

export interface Environment { group: T3; nearGroup: T3; ground: HTMLCanvasElement }

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// ------------------------------------------------------------------ ground

export function paintGround(map: MapDef, L: MapLook, scale: number): HTMLCanvasElement {
  const k = scale;
  const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
  const g = c.getContext('2d')!;
  g.scale(k, k);
  const rnd = rng(map.id.length * 7919);
  g.fillStyle = L.asphalt; g.fillRect(0, 0, W, H);
  // Asphalt grain and patches
  for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 0.5 + rnd(), 0.5 + rnd()); }
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.06})`; g.fillRect(rnd() * W, rnd() * H, 14 + rnd() * 30, 8 + rnd() * 20); }
  const slab = (path: Path2D) => {
    g.fillStyle = L.curb; g.fill(path);
    g.save(); g.clip(path);
    g.fillStyle = L.sidewalk; g.fill(path);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.4;
    for (let x = 0; x < W; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.restore();
    g.strokeStyle = L.curb; g.lineWidth = 1.6; g.stroke(path);
  };
  // Edge sidewalks
  for (const x of [0, W - 9]) { const p = new Path2D(); p.rect(x, 0, 9, H); slab(p); }
  // Road guide lines: spire to each hardpoint
  for (const team of [0, 1] as Team[]) for (const p of map.points) {
    const cp = CORE_POS[team];
    const mx = (cp.x + p.x) / 2, my = (cp.y + p.y) / 2 + (team === 0 ? 40 : -40);
    const path = new Path2D(); path.moveTo(cp.x, cp.y); path.quadraticCurveTo(p.x * 0.6 + mx * 0.4, my, p.x, p.y);
    g.setLineDash([7, 7]); g.strokeStyle = L.marking; g.globalAlpha = 0.55; g.lineWidth = 1.1; g.stroke(path);
    g.setLineDash([]); g.globalAlpha = 1;
  }
  // Lane edge lines along each lane's x
  g.strokeStyle = L.marking; g.globalAlpha = 0.35; g.lineWidth = 0.8;
  for (const x of [22, W - 22]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.globalAlpha = 1;
  // Crosswalks between lanes
  const zebra = (x: number, y: number, w: number, horizontal: boolean) => {
    g.fillStyle = L.marking; g.globalAlpha = 0.8;
    for (let i = 0; i < 7; i++) horizontal ? g.fillRect(x - w / 2, y - 9 + i * 3, w, 1.6) : g.fillRect(x - 9 + i * 3, y - w / 2, 1.6, w);
    g.globalAlpha = 1;
  };
  zebra((map.points[0].x + map.points[1].x) / 2, (map.points[0].y + map.points[1].y) / 2, 16, false);
  zebra((map.points[1].x + map.points[2].x) / 2, (map.points[1].y + map.points[2].y) / 2, 16, false);
  // Building plots: sidewalk squares under each obstacle building
  for (const o of map.obstacles) { const s = o.r * 1.55; const p = new Path2D(); p.roundRect ? p.roundRect(o.x - s / 2, o.y - s / 2, s, s, 3) : p.rect(o.x - s / 2, o.y - s / 2, s, s); slab(p); }
  // Spire plazas
  for (const team of [0, 1] as Team[]) {
    const { x, y } = CORE_POS[team];
    const p = new Path2D(); p.arc(x, y, 50, 0, Math.PI * 2); slab(p);
    g.strokeStyle = TEAM_HEX[team]; g.globalAlpha = 0.85; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    // parking bays beside the plaza
    g.strokeStyle = L.marking; g.globalAlpha = 0.5; g.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) for (const side of [-1, 1]) { const bx = x + side * (70 + i * 9), by = y + (team === 0 ? -8 : 8); g.beginPath(); g.moveTo(bx, by - 8); g.lineTo(bx, by + 8); g.stroke(); }
    g.globalAlpha = 1;
  }
  // Hardpoint plazas: hexagons
  const hex = (x: number, y: number, r: number) => { const p = new Path2D(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? p.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : p.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } p.closePath(); return p; };
  for (const p of map.points) {
    slab(hex(p.x, p.y, POINT_RADIUS + 9));
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.stroke(hex(p.x, p.y, POINT_RADIUS * 0.62));
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.font = '700 15px Bahnschrift, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.id, p.x, p.y + 1);
  }
  // Deploy lines as hazard bands
  const hazard = (y: number, color: string) => {
    g.save(); g.beginPath(); g.rect(0, y - 2.5, W, 5); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, y - 2.5, W, 5);
    g.fillStyle = color; for (let x = -10; x < W + 10; x += 10) { g.beginPath(); g.moveTo(x, y + 2.5); g.lineTo(x + 5, y + 2.5); g.lineTo(x + 10, y - 2.5); g.lineTo(x + 5, y - 2.5); g.fill(); }
    g.restore();
  };
  hazard(DEPLOY_LINE[0], TEAM_HEX[0]); hazard(DEPLOY_LINE[1], TEAM_HEX[1]);
  // Manholes, drains, tyre marks
  for (let i = 0; i < 14; i++) { const x = 30 + rnd() * (W - 60), y = rnd() * H; g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.4; g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) { const x = rnd() * W, y = rnd() * H, a = rnd() * 3; g.beginPath(); g.arc(x, y, 18 + rnd() * 20, a, a + 0.8); g.stroke(); }
  return c;
}

// ------------------------------------------------------------------ signs

function signAtlas(T: T3, L: MapLook): { tex: T3; cell: (i: number) => [number, number, number, number] } {
  const cols = 2, rows = 6, cw = 256, ch = 64;
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
  const g = c.getContext('2d')!;
  SIGNS.forEach((text, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const col = '#' + L.neon[i % L.neon.length].toString(16).padStart(6, '0');
    g.fillStyle = '#101317'; g.fillRect(x, y, cw, ch);
    g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, cw - 8, ch - 8);
    g.font = '700 30px Bahnschrift, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = 10; g.fillStyle = '#ffffff'; g.fillText(text, x + cw / 2, y + ch / 2 + 1);
    g.shadowBlur = 0; g.fillStyle = col; g.globalAlpha = 0.5; g.fillText(text, x + cw / 2, y + ch / 2 + 1); g.globalAlpha = 1;
  });
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return { tex, cell: i => { const ci = i % SIGNS.length; return [(ci % cols) / cols, 1 - (Math.floor(ci / cols) + 1) / rows, 1 / cols, 1 / rows]; } };
}

/** Merge textured sign planes into one geometry (position, normal, uv). */
function mergeSigns(T: T3, planes: { g: T3 }[]): T3 | null {
  if (!planes.length) return null;
  const geos = planes.map(p => p.g.toNonIndexed());
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.setAttribute('uv', new T.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// ------------------------------------------------------------------ building kit

interface Ctx { T: T3; kit: Kit; L: MapLook; rnd: () => number; signs: { g: T3 }[]; cell: (i: number) => [number, number, number, number]; signIdx: number }

function sign(ctx: Ctx, x: number, y: number, z: number, w: number, h: number, yaw: number) {
  const g = new ctx.T.PlaneGeometry(w, h);
  const [u, v, du, dv] = ctx.cell(ctx.signIdx++);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i) * du, v + uv.getY(i) * dv);
  g.rotateY(yaw); g.translate(x, y, z);
  ctx.signs.push({ g });
}

function tree(ctx: Ctx, x: number, z: number, s = 1) {
  const { kit, L, rnd } = ctx;
  kit.cyl(0.7 * s, 0.9 * s, 5 * s, x, 2.5 * s, z, 0x5a4535, 5);
  const c = L.tree[Math.floor(rnd() * L.tree.length)];
  kit.sphere(4.2 * s, x, 7.5 * s, z, c);
  kit.sphere(3.2 * s, x + 1.5 * s, 10 * s, z - 1 * s, L.tree[(L.tree.indexOf(c) + 1) % L.tree.length]);
}

/** A city building: body, cornice, roof, rooftop plant, window bands, accent strips, storefront and sign. */
function building(ctx: Ctx, cx: number, cz: number, w: number, d: number, h: number, faceYaw: number | null, opts: { tall?: boolean } = {}) {
  const { kit, L, rnd } = ctx;
  const body = L.building[Math.floor(rnd() * L.building.length)];
  const neon = L.neon[Math.floor(rnd() * L.neon.length)];
  kit.box(w, h, d, cx, h / 2, cz, body);
  // Darker base course
  kit.box(w + 0.6, 4, d + 0.6, cx, 2, cz, 0x2c3036);
  // Window bands (recess) with lit glass
  const floors = Math.max(1, Math.floor((h - 6) / 7));
  for (let f = 0; f < floors; f++) {
    const y = 8 + f * 7;
    const lit = rnd() > 0.3;
    for (const [dx, dz, ww, dd] of [[0, d / 2 + 0.15, w * 0.84, 0.3], [0, -d / 2 - 0.15, w * 0.84, 0.3], [w / 2 + 0.15, 0, 0.3, d * 0.84], [-w / 2 - 0.15, 0, 0.3, d * 0.84]] as number[][]) {
      kit.box(ww, 2.6, dd, cx + dx, y, cz + dz, 0x1d2228);
      if (lit && rnd() > 0.35) kit.box(ww * 0.92, 1.6, dd + 0.1, cx + dx, y, cz + dz, L.windows, [0, 0, 0], true);
    }
  }
  // Cornice and roof
  kit.box(w + 1.2, 1.4, d + 1.2, cx, h + 0.7, cz, L.trim);
  kit.box(w - 1.5, 0.6, d - 1.5, cx, h + 1.5, cz, L.roof);
  // Rooftop plant
  const units = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < units; i++) kit.box(3 + rnd() * 3, 2 + rnd() * 2, 3 + rnd() * 3, cx + (rnd() - 0.5) * (w - 8), h + 2.6, cz + (rnd() - 0.5) * (d - 8), rnd() > 0.5 ? 0x9aa0a6 : 0x6a7077);
  if (rnd() > 0.55) { kit.cyl(2.2, 2.2, 4, cx - w * 0.25, h + 5, cz + d * 0.2, 0x7a6a5a, 8); kit.cyl(0.25, 0.25, 3, cx - w * 0.25, h + 2.5, cz + d * 0.2, 0x3a3a3a, 4); }
  if (opts.tall || rnd() > 0.7) kit.cyl(0.3, 0.3, 10, cx + w * 0.3, h + 6, cz - d * 0.3, 0x30343a, 4);
  // Neon accent strips up two corners
  for (const [sx, sz] of [[1, 1], [-1, -1]]) kit.box(0.5, h * 0.8, 0.5, cx + sx * (w / 2 + 0.25), h * 0.45, cz + sz * (d / 2 + 0.25), neon, [0, 0, 0], true);
  // Storefront and sign on the face toward the street
  if (faceYaw !== null) {
    const fx = Math.sin(faceYaw), fz = Math.cos(faceYaw);
    const along = Math.abs(fz) > 0.5 ? w : d;
    kit.box(Math.abs(fz) > 0.5 ? along * 0.7 : 0.4, 2.8, Math.abs(fz) > 0.5 ? 0.4 : along * 0.7, cx + fx * (w / 2 + 0.2), 2.6, cz + fz * (d / 2 + 0.2), neon, [0, 0, 0], true);
    if (h > 14) sign(ctx, cx + fx * (w / 2 + 0.6), Math.min(h - 3, 14), cz + fz * (d / 2 + 0.6), Math.min(along * 0.8, 20), Math.min(along * 0.8, 20) / 4, faceYaw);
  }
}

// ------------------------------------------------------------------ assembly

export function buildEnvironment(T: T3, map: MapDef, L: MapLook, mats: { static: T3; glow: T3 }, shadows: boolean): Environment {
  const group = new T.Group(), nearGroup = new T.Group();
  const atlas = signAtlas(T, L);
  const mk = (kit: Kit, signs: { g: T3 }[], parent: T3) => {
    const b = kit.build();
    if (b.hull) { const m = new T.Mesh(b.hull, mats.static); m.castShadow = shadows; m.receiveShadow = shadows; parent.add(m); }
    if (b.glow) parent.add(new T.Mesh(b.glow, mats.glow));
    const sg = mergeSigns(T, signs);
    if (sg) parent.add(new T.Mesh(sg, new T.MeshBasicMaterial({ map: atlas.tex, toneMapped: false })));
  };
  const farCtx: Ctx = { T, kit: new Kit(T), L, rnd: rng(map.id.length * 104729), signs: [], cell: atlas.cell, signIdx: 0 };
  const nearCtx: Ctx = { ...farCtx, kit: new Kit(T), signs: [], rnd: rng(map.id.length * 7727), signIdx: 5 };

  // Outer terrain and kerbs around the field
  const terrain = new T.Mesh(new T.PlaneGeometry(3400, 3400), new T.MeshStandardMaterial({ color: L.terrain, roughness: 1 }));
  terrain.rotation.x = -Math.PI / 2; terrain.position.set(W / 2, -0.6, H / 2); terrain.receiveShadow = shadows;
  group.add(terrain);

  // In-field buildings, one per obstacle, inside its collision circle
  for (const o of map.obstacles) {
    const k = farCtx;
    const s = o.r * 1.32;
    const h = (map.palette === 'foundry' ? 18 : 20) + k.rnd() * 16 + o.r * 0.35;
    const face = 0; // storefront faces south, toward the player's side
    if (map.palette === 'foundry' && k.rnd() > 0.4) {
      k.kit.cyl(s * 0.42, s * 0.5, h + 14, o.x, (h + 14) / 2, o.y, 0x6a5a4e, 10);
      k.kit.cyl(s * 0.44, s * 0.44, 2.4, o.x, h + 14, o.y, 0x3a302a, 10);
      k.kit.cyl(s * 0.33, s * 0.33, 0.8, o.x, h + 15.4, o.y, 0xff6a2a, 10, [0, 0, 0], true);
      k.kit.box(s, 6, s * 0.5, o.x, 3, o.y + s * 0.3, 0x5a4e46);
    } else {
      building(k, o.x, o.y, s, s, h, face);
    }
    // Planters with trees at two corners of the plot
    tree(k, o.x - s * 0.62, o.y + s * 0.62, 0.8);
    if (k.rnd() > 0.4) tree(k, o.x + s * 0.62, o.y + s * 0.62, 0.7);
    if (L.snowRoofs) k.kit.box(s - 1.5, 0.8, s - 1.5, o.x, h + 2.1, o.y, 0xf4f8fb);
  }

  // Street furniture along the edge sidewalks
  for (let z = 30; z < H; z += 52) {
    for (const x of [4.5, W - 4.5]) {
      const ctx = x > W / 2 ? nearCtx : farCtx;
      ctx.kit.cyl(0.45, 0.6, 18, x, 9, z, 0x30343a, 5);
      ctx.kit.box(4, 0.8, 1.2, x + (x < W / 2 ? 2 : -2), 18, z, 0x30343a);
      ctx.kit.box(2.4, 0.5, 1, x + (x < W / 2 ? 3 : -3), 17.6, z, L.windows, [0, 0, 0], true);
      if ((z / 52) % 2 < 1) tree(ctx, x, z + 26, 0.75);
    }
  }
  // Barriers at the deploy edges
  for (const [team, zLine] of [[0, DEPLOY_LINE[0] + 18], [1, DEPLOY_LINE[1] - 18]] as [Team, number][]) {
    for (const x of [14, W - 14]) {
      const ctx = x > W / 2 ? nearCtx : farCtx;
      ctx.kit.box(9, 7, 9, x, 3.5, zLine, 0x5a6068).box(7, 5, 7, x + (x < W / 2 ? 8 : -8), 2.5, zLine + 4, team === 0 ? 0x8a6a36 : 0x5c547e);
    }
  }

  // City blocks beyond the field: far side (x < 0), near side (x > W) and behind the enemy spire
  const blocks = (ctx: Ctx, side: -1 | 1) => {
    for (let z = -140; z < H + 60;) {
      const d = 44 + ctx.rnd() * 40, w = 46 + ctx.rnd() * 36;
      const street = 26;
      const cx = side < 0 ? -street - w / 2 : W + street + w / 2;
      const h = 26 + ctx.rnd() * (side < 0 ? 70 : 40);
      building(ctx, cx, z + d / 2, w, d, h, side < 0 ? Math.PI / 2 : -Math.PI / 2, { tall: true });
      if (ctx.rnd() > 0.3) building(ctx, cx + side * (w / 2 + 34), z + d / 2, 50 + ctx.rnd() * 30, d, h * (1.1 + ctx.rnd() * 0.6), null, { tall: true });
      tree(ctx, side < 0 ? -10 : W + 10, z + d + 6, 0.9);
      z += d + 14;
    }
  };
  blocks(farCtx, -1);
  blocks(nearCtx, 1);
  for (let x = -220; x < W + 220;) { const w = 46 + farCtx.rnd() * 50; building(farCtx, x + w / 2, -60 - farCtx.rnd() * 30, w, 46, 40 + farCtx.rnd() * 90, 0, { tall: true }); x += w + 16; }

  // Landmarks per district
  const lk = farCtx.kit;
  if (map.palette === 'foundry') for (const [x, z] of [[-110, 120], [-150, 430], [W / 2 - 120, -150], [W / 2 + 140, -170]]) { lk.cyl(14, 18, 140, x, 70, z, 0x5a4a40, 10); lk.cyl(14.5, 14.5, 4, x, 138, z, 0xff6a2a, 10, [0, 0, 0], true); }
  if (map.palette === 'ice') for (const [x, z] of [[-110, 220], [W / 2 + 160, -150]]) { lk.cyl(26, 26, 40, x, 20, z, 0x9aa8b6, 12); lk.sphere(26, x, 40, z, 0xdde6ee); }
  if (map.palette === 'night') for (const [x, z] of [[-24, 30], [-24, H - 130], [W / 2 - 90, -40], [W / 2 + 90, -40]]) { lk.cyl(1.4, 2, 60, x, 30, z, 0x30343a, 6); lk.box(9, 3, 5, x, 61, z, 0x30343a); lk.box(8, 1, 4, x, 59.4, z, 0xfff2c4, [0, 0, 0], true); }
  // Relay masts (Relay Ridge)
  if (map.id === 'relay_ridge') for (const [x, z] of [[-70, 160], [-90, 480], [W / 2, -120]]) { lk.cyl(1.4, 3, 90, x, 45, z, 0x8a9096, 6); lk.box(10, 2, 10, x, 80, z, 0x6a7077); lk.sphere(1.6, x, 92, z, 0xff4a3d, true); }

  mk(farCtx.kit, farCtx.signs, group);
  mk(nearCtx.kit, nearCtx.signs, nearGroup);
  return { group, nearGroup, ground: document.createElement('canvas') };
}
