// Original BRANCHLIKE unit models, built procedurally from primitives.
// Every model faces +X, stands on y = 0, and is authored at its in-game size.
// Parts are merged into one vertex-coloured geometry per moving piece, so a unit
// costs 1–5 draw calls. Commissioned art can replace these one unit at a time
// by returning a loaded glTF scene from the same `buildModel` entry point.

/* eslint-disable @typescript-eslint/no-explicit-any */
type T3 = any;

export interface TeamPalette { primary: number; secondary: number; dark: number; light: number; glow: number; energy: number; danger: number }
export const PALETTES: [TeamPalette, TeamPalette] = [
  { primary: 0xe8962a, secondary: 0x3b424b, dark: 0x1c2025, light: 0xc9ced4, glow: 0xffcf6b, energy: 0x6fd3ef, danger: 0xff4a3d },
  { primary: 0x8a78f0, secondary: 0x393750, dark: 0x1b1a27, light: 0xd8d6e8, glow: 0xd2c6ff, energy: 0x6fd3ef, danger: 0xff4a3d },
];

export type PartRole = 'legL' | 'legR' | 'gun' | 'rotor';
/** Part geometry is authored relative to its pivot. */
export interface AnimPart { role: PartRole; pivot: [number, number, number]; hull: T3 | null; glow: T3 | null }
export interface ModelSpec { hull: T3 | null; glow: T3 | null; parts: AnimPart[]; height: number; hover: number; muzzle: [number, number, number]; walker: boolean }

/** Collects primitive parts and merges them into one coloured geometry. */
export class Kit {
  private hullParts: { g: T3; c: number }[] = [];
  private glowParts: { g: T3; c: number }[] = [];
  constructor(private T: T3) {}

  private place(g: T3, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const T = this.T;
    const m = new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    return g;
  }
  private add(g: T3, c: number, glow: boolean) { (glow ? this.glowParts : this.hullParts).push({ g, c }); return this; }
  /** Add an already-positioned geometry. */
  geometry(g: T3, c: number, glow = false) { return this.add(g, c, glow); }

  box(w: number, h: number, d: number, x: number, y: number, z: number, c: number, rot: [number, number, number] = [0, 0, 0], glow = false) {
    return this.add(this.place(new this.T.BoxGeometry(w, h, d), x, y, z, ...rot), c, glow);
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, c: number, seg = 8, rot: [number, number, number] = [0, 0, 0], glow = false) {
    return this.add(this.place(new this.T.CylinderGeometry(rt, rb, h, seg), x, y, z, ...rot), c, glow);
  }
  sphere(r: number, x: number, y: number, z: number, c: number, glow = false) {
    return this.add(this.place(new this.T.IcosahedronGeometry(r, 1), x, y, z), c, glow);
  }
  octa(r: number, sy: number, x: number, y: number, z: number, c: number) {
    const g = new this.T.OctahedronGeometry(r, 0); g.scale(1, sy, 1);
    return this.add(this.place(g, x, y, z), c, false);
  }
  torus(r: number, tube: number, x: number, y: number, z: number, c: number, glow = true) {
    return this.add(this.place(new this.T.TorusGeometry(r, tube, 4, 12), x, y, z, Math.PI / 2, 0, 0), c, glow);
  }
  /** A slanted plate: box rotated about Z (pitch) by `a` radians. */
  plate(w: number, h: number, d: number, x: number, y: number, z: number, c: number, a: number) {
    return this.box(w, h, d, x, y, z, c, [0, 0, a]);
  }

  build(): { hull: T3 | null; glow: T3 | null } {
    return { hull: merge(this.T, this.hullParts), glow: merge(this.T, this.glowParts) };
  }
}

/** Merge geometries into one non-indexed geometry with a per-vertex colour. */
export function merge(T: T3, parts: { g: T3; c: number }[]): T3 | null {
  if (!parts.length) return null;
  const geos = parts.map(p => (p.g.index ? p.g.toNonIndexed() : p.g));
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  const color = new T.Color();
  geos.forEach((g: T3, i: number) => {
    const p = g.attributes.position.array, q = g.attributes.normal.array;
    pos.set(p, o * 3); nor.set(q, o * 3);
    color.setHex(parts[i].c);
    for (let k = 0; k < g.attributes.position.count; k++) { col[(o + k) * 3] = color.r; col[(o + k) * 3 + 1] = color.g; col[(o + k) * 3 + 2] = color.b; }
    o += g.attributes.position.count;
    g.dispose();
  });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.setAttribute('color', new T.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

function part(T: T3, role: PartRole, pivot: [number, number, number], fill: (k: Kit) => void): AnimPart {
  const k = new Kit(T); fill(k); const b = k.build();
  return { role, pivot, hull: b.hull, glow: b.glow };
}

// ---------------------------------------------------------------- unit models

export function buildModel(T: T3, id: string, team: 0 | 1): ModelSpec {
  const P = PALETTES[team];
  const k = new Kit(T);
  const parts: AnimPart[] = [];
  let height = 14, hover = 0, muzzle: [number, number, number] = [6, 9, 0], walker = false;

  const trooper = (zOff: number, breaker: boolean) => {
    const s = breaker ? 1.12 : 1;
    k.box(2 * s, 6, 1.5 * s, 0, 3, zOff - 1.1 * s, P.dark).box(2 * s, 6, 1.5 * s, 0, 3, zOff + 1.1 * s, P.dark);
    k.box(3.2 * s, 5, 4 * s, 0, 8.5, zOff, P.primary);
    k.box(2 * s, 3.4, 3.2 * s, -2.2 * s, 8.6, zOff, P.secondary);
    k.sphere(1.6 * s, 0.2, 12.3, zOff, P.secondary);
    k.box(0.7, 0.8, 2.2 * s, 1.5 * s, 12.3, zOff, P.energy, [0, 0, 0], false);
    if (breaker) {
      k.cyl(1, 1, 9, 0.6, 11.8, zOff + 2.3, P.secondary, 6, [0, 0, Math.PI / 2]);
      k.box(1.2, 1.2, 1.2, 5.2, 11.8, zOff + 2.3, P.glow);
    } else {
      k.box(6, 0.9, 0.9, 3, 9, zOff + 1.9, P.dark);
    }
  };

  switch (id) {
    case 'rifle_squad': trooper(0, false); height = 14; muzzle = [6, 9, 1.9]; break;
    case 'breaker_team': trooper(0, true); height = 15; muzzle = [5.5, 11.8, 2.3]; break;

    case 'wasp_drone':
      hover = 20; height = 6;
      k.octa(5.2, 0.45, 0, 0, 0, P.primary);
      k.sphere(2.2, 1.4, 1.2, 0, P.secondary);
      for (const [x, z] of [[4, 4], [4, -4], [-4, 4], [-4, -4]]) k.box(5.5, 0.7, 0.9, x * 0.55, 0.4, z * 0.55, P.dark, [0, Math.atan2(z, x), 0]);
      for (const [x, z] of [[4, 4], [4, -4], [-4, 4], [-4, -4]]) k.torus(2.6, 0.3, x, 0.9, z, P.light);
      k.box(1, 0.8, 1.6, 4.4, 0, 0, P.energy, [0, 0, 0], true);
      k.box(4, 0.6, 0.6, 3.5, -1.3, 0, P.dark);
      muzzle = [6, -1.3, 0];
      break;

    case 'hound_apc':
      height = 14;
      k.box(18, 5, 11, 0, 5, 0, P.secondary);
      k.box(13, 3.6, 9.5, -1.5, 9.2, 0, P.primary);
      k.plate(6, 3.5, 10.5, 8.2, 7.5, 0, P.primary, -0.55);
      k.box(1, 1, 2, 10.6, 5.6, 3.6, P.glow, [0, 0, 0], true).box(1, 1, 2, 10.6, 5.6, -3.6, P.glow, [0, 0, 0], true);
      for (const x of [-6, 0, 6]) for (const z of [-5.8, 5.8]) k.cyl(2.7, 2.7, 2, x, 2.7, z, P.dark, 8, [Math.PI / 2, 0, 0]);
      parts.push(part(T, 'gun', [-1, 11, 0], g => {
        g.box(6, 3, 6, 0, 1.5, 0, P.light);
        g.box(10, 1, 1, 6, 1.8, 1.2, P.dark).box(10, 1, 1, 6, 1.8, -1.2, P.dark);
      }));
      muzzle = [10, 12.8, 0];
      break;

    case 'mortar_crawler':
      height = 18;
      k.box(21, 4.5, 4, 0, 2.25, -6, P.dark).box(21, 4.5, 4, 0, 2.25, 6, P.dark);
      for (const x of [-8, -3, 2, 7]) for (const z of [-6, 6]) k.cyl(1.6, 1.6, 4.2, x, 2.3, z, P.secondary, 6, [Math.PI / 2, 0, 0]);
      k.box(16, 5, 9, 0, 7, 0, P.secondary);
      k.box(12, 1.5, 8, -1, 10.2, 0, P.primary);
      parts.push(part(T, 'gun', [-3, 11, 0], g => {
        g.cyl(3, 3.4, 2, 0, 0, 0, P.dark, 8);
        g.cyl(1.7, 2, 15, 3.5, 6, 0, P.primary, 8, [0, 0, -0.55]);
        g.cyl(2.1, 2.1, 1.4, 7.4, 12, 0, P.dark, 8, [0, 0, -0.55]);
      }));
      muzzle = [5, 24, 0];
      break;

    case 'mender_rig':
      height = 20; walker = true;
      k.box(13, 7, 10, 0, 14, 0, P.secondary);
      k.box(11, 2, 8.5, -0.5, 18.5, 0, P.primary);
      k.box(4, 1, 1.4, 0, 19.8, 0, P.energy, [0, 0, 0], true).box(1.4, 1, 4, 0, 19.8, 0, P.energy, [0, 0, 0], true);
      k.box(0.6, 3, 3, 6.8, 14, 0, P.energy, [0, 0, 0], true);
      k.box(9, 1.2, 1.2, 3, 21, 3, P.dark, [0, 0, 0.5]);
      for (const [role, zs] of [['legL', [-1, 1]], ['legR', [1, -1]]] as [PartRole, number[]][]) {
        parts.push(part(T, role, [0, 12, 0], g => {
          g.box(2, 12, 2, 4.5 * zs[0], -6, 4.5, P.dark, [0.25, 0, 0]);
          g.box(2, 12, 2, -4.5 * zs[0], -6, -4.5, P.dark, [-0.25, 0, 0]);
        }));
      }
      muzzle = [7, 14, 0];
      break;

    case 'bastion_turret':
      height = 18;
      k.cyl(7.5, 8.5, 3, 0, 1.5, 0, P.dark, 6);
      k.cyl(7, 7, 0.6, 0, 3.2, 0, P.primary, 6);
      k.cyl(2.4, 3, 9, 0, 7.5, 0, P.secondary, 8);
      parts.push(part(T, 'gun', [0, 13, 0], g => {
        g.box(7, 4, 6.5, 0, 0, 0, P.primary);
        g.box(10, 1.3, 1.3, 7, 0.5, 1.4, P.dark).box(10, 1.3, 1.3, 7, 0.5, -1.4, P.dark);
        g.box(0.6, 1.2, 2.5, 3.6, 1.2, 0, P.energy, [0, 0, 0], true);
      }));
      muzzle = [12, 13.5, 0];
      break;

    case 'warden_frame':
      height = 42; walker = true;
      k.box(8, 4, 12, 0, 20, 0, P.dark);
      k.box(14, 12, 16, -0.5, 29, 0, P.secondary);
      k.box(4.5, 9, 14, 6.4, 29, 0, P.primary);
      k.box(1, 2.4, 8, 8.8, 31.5, 0, P.glow, [0, 0, 0], true);
      k.box(8, 5, 6, -0.5, 35.5, 10.5, P.primary).box(8, 5, 6, -0.5, 35.5, -10.5, P.primary);
      k.box(6, 15, 2.2, 2, 25, -12, P.primary);
      k.box(0.6, 7, 0.6, -6, 39, 5, P.dark);
      for (const [role, z] of [['legL', -5], ['legR', 5]] as [PartRole, number][]) {
        parts.push(part(T, role, [0, 20, z], g => {
          g.box(5, 11, 4.4, 0, -5, 0, P.secondary);
          g.box(4.4, 10, 4, 1.2, -14, 0, P.dark);
          g.box(8.5, 2, 6.5, 1.8, -19, 0, P.dark);
        }));
      }
      parts.push(part(T, 'gun', [1, 28, 11.5], g => {
        g.box(5, 5, 5, 0, 0, 0, P.secondary);
        g.box(17, 3.4, 3.4, 9, -0.5, 0, P.dark);
        g.box(3, 4.4, 4.4, 15, -0.5, 0, P.secondary);
      }));
      muzzle = [19, 27.5, 11.5];
      break;

    case 'kestrel':
      height = 44; walker = true;
      k.box(11, 9, 12, -1, 29, 0, P.secondary);
      k.plate(8, 7, 11, 5.5, 30, 0, P.primary, -0.45);
      k.box(1, 1.6, 7, 9.4, 31, 0, P.energy, [0, 0, 0], true);
      for (const z of [-1, 1]) {
        k.box(13, 0.9, 6, -7, 34, 7 * z, P.primary, [0.35 * z, 0.5 * z, 0.35]);
        k.box(8, 0.5, 1, -10, 35.5, 9.5 * z, P.glow, [0.35 * z, 0.5 * z, 0.35], true);
      }
      k.box(6, 4, 8, -1, 23, 0, P.dark);
      for (const [role, z] of [['legL', -4.5], ['legR', 4.5]] as [PartRole, number][]) {
        parts.push(part(T, role, [-1, 22, z], g => {
          g.box(3.6, 11, 3.2, -2.2, -4.5, 0, P.secondary, [0, 0, 0.5]);
          g.box(3.2, 12, 3, -1.5, -13.5, 0, P.dark, [0, 0, -0.45]);
          g.box(7.5, 1.6, 5, 1.5, -20.5, 0, P.dark);
        }));
      }
      parts.push(part(T, 'gun', [2, 27, 8.5], g => {
        g.box(14, 2.6, 2.6, 6, 0, 0, P.dark);
        g.box(7, 1, 3.2, 6, 1.6, 0, P.energy, [0, 0, 0], true);
        g.box(4, 4, 4, -1, 0, 0, P.secondary);
      }));
      muzzle = [15, 27, 8.5];
      break;

    case 'monolith':
      height = 50; walker = true;
      k.box(12, 6, 18, 0, 19, 0, P.dark);
      k.box(18, 16, 22, -1, 32, 0, P.secondary);
      k.box(4, 13, 18, 9, 31, 0, P.primary);
      k.box(1, 2.4, 10, 11.2, 35, 0, P.glow, [0, 0, 0], true);
      k.box(11, 19, 5, 1, 32, 15, P.primary).box(11, 19, 5, 1, 32, -15, P.primary);
      k.box(9, 3, 5.4, 1, 42.5, 15, P.secondary).box(9, 3, 5.4, 1, 42.5, -15, P.secondary);
      for (const [role, z] of [['legL', -6.5], ['legR', 6.5]] as [PartRole, number][]) {
        parts.push(part(T, role, [0, 18, z], g => {
          g.box(7, 9, 6.5, 0, -4, 0, P.secondary);
          g.box(6.5, 8, 6, 1, -11.5, 0, P.dark);
          g.box(11, 2.5, 9, 1.5, -16.5, 0, P.dark);
        }));
      }
      parts.push(part(T, 'gun', [7, 25, 0], g => {
        g.box(6, 9, 9, 0, 0, 0, P.secondary);
        g.box(18, 6, 6, 10, 0, 0, P.dark);
        g.box(3, 7.5, 7.5, 19, 0, 0, P.primary);
      }));
      muzzle = [27, 25, 0];
      break;

    case 'vesper':
      height = 56; walker = true;
      k.box(9, 8, 9, -0.5, 39, 0, P.secondary);
      k.box(4, 3, 6, 0.5, 45, 0, P.primary);
      k.box(1, 1.2, 4, 2.8, 45.4, 0, P.energy, [0, 0, 0], true);
      k.box(5, 3, 7, -0.5, 34, 0, P.dark);
      k.box(0.5, 9, 0.5, -3.5, 49, -2, P.dark);
      for (const [role, z] of [['legL', -3.5], ['legR', 3.5]] as [PartRole, number][]) {
        parts.push(part(T, role, [0, 33, z], g => {
          g.box(3, 16, 2.8, 0, -7.5, 0, P.secondary);
          g.box(2.6, 16, 2.6, 0.8, -22, 0, P.dark);
          g.box(6.5, 1.5, 4.5, 1.4, -31, 0, P.dark);
        }));
      }
      parts.push(part(T, 'gun', [1, 40, 6], g => {
        g.box(4, 4, 3.6, 0, 0, 0, P.secondary);
        g.box(32, 1.8, 1.8, 15, 0, 0, P.dark);
        g.box(27, 0.6, 2.4, 14, 1.2, 0, P.energy, [0, 0, 0], true);
        g.box(2.5, 2.8, 2.8, 31, 0, 0, P.primary);
      }));
      muzzle = [33, 40, 6];
      break;

    case 'halberd_prime':
      height = 66; walker = true;
      k.box(30, 18, 28, 0, 38, 0, P.secondary);
      k.box(6, 14, 24, 15, 37, 0, P.primary);
      k.box(1, 3.4, 16, 18.2, 40, 0, P.danger, [0, 0, 0], true);
      k.box(26, 3, 30, -1, 48.5, 0, P.primary);
      for (const z of [-1, 1]) {
        k.box(12, 10, 9, -3, 55, 11 * z, P.dark);
        for (const dz of [-2, 2]) k.cyl(1.8, 1.8, 4, 3.6, 59, 11 * z + dz, P.secondary, 6);
      }
      for (const [role, zs] of [['legL', [-1, 1]], ['legR', [1, -1]]] as [PartRole, number[]][]) {
        parts.push(part(T, role, [0, 30, 0], g => {
          for (const [x, zz] of [[9, 12 * zs[0]], [-9, 12 * zs[1]]]) {
            g.box(7, 14, 7, x, -6, zz, P.secondary);
            g.box(6, 14, 6, x + 1.5, -19, zz, P.dark);
            g.box(11, 3, 10, x + 2, -28.5, zz, P.dark);
          }
        }));
      }
      parts.push(part(T, 'gun', [12, 32, 0], g => {
        g.box(8, 8, 10, 0, 0, 0, P.dark);
        g.box(16, 4, 4, 10, 0, 3, P.dark).box(16, 4, 4, 10, 0, -3, P.dark);
      }));
      muzzle = [30, 32, 0];
      break;

    case 'supply_depot':
      height = 16;
      k.box(16, 3, 14, 0, 1.5, 0, P.dark);
      for (const [x, z] of [[-4, -3], [4, -3], [-4, 4], [4, 4]]) k.box(6.5, 6, 6, x, 6, z, x < 0 ? P.secondary : P.primary);
      k.box(6, 5, 6, 0, 11.5, 0.5, P.secondary);
      k.box(1, 4, 1, 0, 16, 0.5, P.energy, [0, 0, 0], true);
      k.cyl(0.25, 0.25, 8, 6.5, 7, -5.5, P.dark, 4);
      k.box(1, 1, 1, 6.5, 11.5, -5.5, P.glow, [0, 0, 0], true);
      muzzle = [0, 10, 0];
      break;

    case 'core':
      height = 64;
      k.cyl(30, 34, 6, 0, 3, 0, P.dark, 8);
      k.cyl(26, 28, 2, 0, 7, 0, P.primary, 8);
      k.cyl(11, 17, 40, 0, 27, 0, P.secondary, 8);
      k.cyl(11.5, 11.5, 2.5, 0, 33, 0, P.primary, 8);
      k.cyl(12.5, 12.5, 2.5, 0, 22, 0, P.primary, 8);
      k.cyl(1.5, 1.5, 3, 0, 63, 0, P.glow, 6, [0, 0, 0], true);
      k.box(1, 26, 1, 10, 30, 10, P.glow, [0, 0, 0], true).box(1, 26, 1, -10, 30, -10, P.glow, [0, 0, 0], true);
      parts.push(part(T, 'gun', [0, 50, 0], g => {
        g.cyl(8, 9, 6, 0, 0, 0, P.primary, 8);
        g.box(16, 3, 3, 9, 1, 2.5, P.dark).box(16, 3, 3, 9, 1, -2.5, P.dark);
        g.box(0.6, 2, 6, 7.5, 2.6, 0, P.glow, [0, 0, 0], true);
        g.cyl(0.4, 0.4, 10, -3, 7, 0, P.dark, 4);
      }));
      muzzle = [18, 51, 0];
      break;

    default:
      k.box(8, 8, 8, 0, 4, 0, P.primary);
  }
  const b = k.build();
  return { hull: b.hull, glow: b.glow, parts, height, hover, muzzle, walker };
}
