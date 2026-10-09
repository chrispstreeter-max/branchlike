// BRANCHLIKE frames: original mech designs, built from primitives and extruded
// silhouettes. Each frame is a jointed rig (hips, knees, feet, torso, arms) so the
// renderer can drive a proper walk cycle. Faces +X, stands on y = 0.
//
// Design language (see docs/MECHS.md):
//  - Union frames: amber armour over gunmetal, warm glow.
//  - Halcyon frames: violet armour over slate, cool glow.
//  - Every frame reads from its silhouette alone at phone size.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kit, part, shade, type AnimPart, type ModelSpec, type TeamPalette } from './models3d.js';

type T3 = any;
type V3 = [number, number, number];
const PI = Math.PI;
const X_AXIS: V3 = [0, 0, PI / 2]; // cylinder axis along X
const Z_AXIS: V3 = [PI / 2, 0, 0]; // cylinder axis along Z

interface LegOpts {
  pivot: V3; phase: number; L1: number; L2: number;
  rest?: { hip: number; knee: number; foot: number };
  splay?: number;
}

/** Push a hip → knee → foot chain. Each fill is authored relative to its joint. */
function leg(T: T3, parts: AnimPart[], o: LegOpts, thigh: (k: Kit) => void, shin: (k: Kit) => void, foot: (k: Kit) => void) {
  const r = o.rest ?? { hip: 0, knee: 0, foot: 0 };
  const sp = o.splay ?? 0;
  const hip = parts.push(part(T, 'hip', o.pivot, thigh, { phase: o.phase, rest: [sp, 0, r.hip] })) - 1;
  const knee = parts.push(part(T, 'knee', [0, -o.L1, 0], shin, { phase: o.phase, parent: hip, rest: [0, 0, r.knee] })) - 1;
  parts.push(part(T, 'foot', [0, -o.L2, 0], foot, { phase: o.phase, parent: knee, rest: [-sp, 0, r.foot] }));
}

export function buildMech(T: T3, id: string, P: TeamPalette): ModelSpec | null {
  switch (id) {
    case 'warden_frame': return warden(T, P);
    case 'kestrel': return kestrel(T, P);
    case 'monolith': return monolith(T, P);
    case 'vesper': return vesper(T, P);
    case 'halberd_prime': return halberd(T, P);
    default: return null;
  }
}

// ------------------------------------------------------------------ WARDEN
// The Union's line frame. Chunky, honest, a rotary cannon on the right arm, a
// rocket pod on the left shoulder and a forearm shield.
function warden(T: T3, P: TeamPalette): ModelSpec {
  const k = new Kit(T), parts: AnimPart[] = [];
  const S = P.secondary, D = P.dark, A = P.primary, L = P.light;
  const hipY = 20;
  k.box(7, 3.6, 13, 0, 20.5, 0, D);
  k.both(s => k.cyl(2.6, 2.6, 2, 0, 20, 7.4 * s, S, 8, Z_AXIS));
  k.box(3.2, 4, 3, 2.2, 18.4, 0, D); // codpiece
  for (const [z, ph] of [[5.6, 0], [-5.6, PI]] as [number, number][]) {
    leg(T, parts, { pivot: [0, hipY, z], phase: ph, L1: 9, L2: 8.6 },
      t => {
        t.box(4.4, 9.4, 4.2, 0, -4.6, 0, S);
        t.profile([[0, 0], [1.6, -0.8], [1.6, -6.5], [0, -7.6]], 4.8, 2.1, -0.6, 0, A);
        t.cyl(0.55, 0.55, 7, -2.6, -4.5, 0, L, 6);
      },
      sh => {
        sh.profile([[-1, 1.8], [2, 1.8], [3.6, 0], [2.4, -2.6], [-1, -2.2]], 5.2, 0, 0, 0, A);
        sh.box(4, 8.6, 3.8, -0.2, -4.6, 0, S);
        sh.profile([[0, 0], [1.4, -0.6], [1.8, -6.8], [0, -7.6]], 4.4, 1.8, -1, 0, A);
        sh.box(0.3, 0.8, 4.5, 3.5, -5, 0, D).box(0.3, 0.8, 4.5, 3.6, -6.4, 0, D);
        sh.box(2.2, 5, 3.4, -2.6, -4, 0, D);
      },
      f => {
        f.cyl(1.6, 1.6, 4.4, 0, 0, 0, D, 8, Z_AXIS);
        f.profile([[-3.5, -2.4], [6.5, -2.4], [6.5, -1.4], [4.5, 0], [-2.5, 0.2], [-3.5, -1]], 6, 0, 0, 0, D);
        f.box(2.2, 1.6, 6.4, 5.6, -1.6, 0, S);
      });
  }
  const torso = parts.push(part(T, 'torso', [0, 21.5, 0], t => {
    t.box(6, 3.5, 8, -0.5, 1.5, 0, D);
    t.profile([[-6, 3], [5, 3], [8, 6], [8, 11.5], [5, 14.5], [-5.5, 14.5], [-7.5, 11], [-7, 5]], 14, 0, 0, 0, S);
    t.profile([[5, 3.6], [6, 3.6], [8.6, 6], [8.6, 11.6], [6, 14], [5, 14]], 9.5, 0, 0, 0, A);
    t.box(0.5, 1.2, 6.5, 8.7, 10, 0, P.glow, [0, 0, 0], true);
    for (let i = 0; i < 3; i++) t.box(0.4, 0.4, 3.6, 8.75, 6.6 + i * 0.9, 0, D);
    t.both(s => t.box(10, 1.4, 0.4, -0.5, 9, 7.1 * s, A));
    t.box(5, 9, 10, -9, 9, 0, D);
    for (let i = 0; i < 3; i++) t.box(0.4, 1, 8, -11.6, 6.5 + i * 2.2, 0, P.glow, [0, 0, 0], true);
    t.box(5.6, 1, 10.6, -9, 13.9, 0, S);
    t.cyl(0.25, 0.25, 8, -8, 18, -3.5, D, 4);
    t.box(0.6, 0.6, 0.6, -8, 22.2, -3.5, P.danger, [0, 0, 0], true);
    t.box(4.4, 3.2, 5, 3, 16, 0, D);
    t.box(0.5, 0.9, 3.8, 5.3, 16.3, 0, P.energy, [0, 0, 0], true);
    t.both(s => t.profile([[-4.5, 10], [4, 10], [5.5, 12.5], [3, 16], [-4.5, 16], [-5.5, 13]], 5.5, 0, 0, 9.8 * s, A));
    // Rocket pod, left shoulder
    t.box(6, 4, 5, -0.5, 18, -9.8, S);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) t.box(0.4, 1, 1, 2.6, 17.2 + r * 1.6, -11.4 + c * 1.6, D);
  })) - 1;
  parts.push(part(T, 'arm', [0.5, 12, -10.5], a => {
    a.sphere(2.2, 0, 0, 0, S);
    a.box(3.2, 6, 3.2, 0, -3.6, 0, D);
    a.box(4, 6, 4, 0.5, -8.5, 0, S);
    a.box(3, 2.6, 3, 0.6, -12.3, 0, D);
    a.profile([[-2, 0], [3, 0], [3.6, -5], [-1.6, -6]], 1.2, 0, -5.5, -2.5, A);
  }, { parent: torso, phase: PI }));
  parts.push(part(T, 'gun', [0.5, 12, 10.5], g => {
    g.sphere(2.2, 0, 0, 0, S);
    g.box(3.2, 5, 3.2, 0, -3, 0, D);
    g.box(11, 5.4, 5.4, 4, -7, 0, S);
    g.box(10, 1.2, 5.6, 4, -3.9, 0, A);
    g.box(0.4, 1.6, 5.7, 7.5, -7, 0, D).box(0.4, 1.6, 5.7, 5.5, -7, 0, D);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; g.cyl(0.75, 0.75, 10, 14, -7 + Math.cos(a) * 1.3, Math.sin(a) * 1.3, D, 6, X_AXIS); }
    g.cyl(2.3, 2.3, 1.2, 9.8, -7, 0, D, 8, X_AXIS);
    g.cyl(2.2, 2.2, 1, 18.6, -7, 0, S, 8, X_AXIS);
    g.cyl(2, 2, 3, 1, -9.6, 0, D, 8, Z_AXIS);
  }, { parent: torso }));
  const b = k.build();
  return { hull: b.hull, glow: b.glow, parts, height: 40, hover: 0, muzzle: [19.6, 26.5, 10.5], walker: true, kneeDir: 1, strideLen: 9, hipY, heavyStep: false };
}

// ------------------------------------------------------------------ KESTREL-9
// Hero skirmisher. Reverse-jointed bird legs, a hunched canopy body, swept
// vanes with jump thrusters, twin autocannons.
function kestrel(T: T3, P: TeamPalette): ModelSpec {
  const k = new Kit(T), parts: AnimPart[] = [];
  const S = P.secondary, D = P.dark, A = P.primary;
  const hipY = 18.7;
  k.box(6, 3, 8, -1, 19.3, 0, D);
  for (const [z, ph] of [[4.6, 0], [-4.6, PI]] as [number, number][]) {
    leg(T, parts, { pivot: [-1, hipY, z], phase: ph, L1: 10, L2: 11, rest: { hip: 0.6, knee: -1.3, foot: 0.7 } },
      t => {
        t.cyl(2, 2, 4, 0, 0, 0, S, 8, Z_AXIS);
        t.box(3.8, 10, 3.4, 0, -5, 0, S);
        t.profile([[0, 0.5], [1.5, -0.5], [1.3, -8], [0, -9]], 3.8, 1.9, 0, 0, A);
      },
      sh => {
        sh.cyl(1.6, 1.6, 3.4, 0, 0, 0, D, 8, Z_AXIS);
        sh.box(2.8, 11, 2.6, 0, -5.5, 0, D);
        sh.profile([[0, 1], [-3.2, -0.6], [0, -2.4]], 2, -1.2, 0, 0, A);
        sh.cyl(0.35, 0.35, 9, 1.6, -5.5, 0, P.light, 4);
      },
      f => {
        f.box(2.2, 2, 3.4, 0, -1, 0, S);
        for (const z2 of [-1.3, 0, 1.3]) f.profile([[0, 0], [5, -1.4], [5, -2], [0, -2]], 1.1, 0, 0, z2, D);
        f.profile([[0, 0], [-3, -2], [0, -2]], 1.2, 0, 0, 0, D);
      });
  }
  const torso = parts.push(part(T, 'torso', [-1, 20.5, 0], t => {
    t.profile([[-7, 0], [4, 0], [9.5, 3.5], [10.5, 6.5], [6, 9.5], [-6, 10.5], [-9, 6]], 10, 0, 0, 0, S);
    t.profile([[-6, 7], [5, 8], [9.5, 5.5], [10.6, 6.6], [6.2, 10], [-6, 11]], 8.6, 0, 0, 0, A);
    t.profile([[5, 7.6], [9.8, 5.3], [10.5, 6.5], [6.4, 9.3]], 5, 0, 0, 0, P.energy, [0, 0, 0], true);
    t.box(2, 1.4, 3, 9.8, 3.2, 0, D);
    t.box(0.4, 0.6, 2, 10.9, 3.2, 0, P.danger, [0, 0, 0], true);
    t.both(s => {
      // Swept vanes: drawn in plan view (y = outward span), laid flat, tipped up.
      t.profile([[3, 0], [-4, 0], [-13, 10], [-9.5, 11], [-0.5, 3.5]], 0.8, -2, 9.5, 4.6 * s, A, [s * (Math.PI / 2 - 0.45), 0, 0]);
      t.profile([[-6, 6.5], [-11.5, 9.8], [-10.4, 10.3], [-5, 7.2]], 1, -2, 9.5, 4.6 * s, P.glow, [s * (Math.PI / 2 - 0.45), 0, 0], true);
      t.profile([[1, 0], [-5, 0], [-10, 5], [-7.5, 5.5], [-1, 2]], 0.6, -3, 6, 4.4 * s, S, [s * (Math.PI / 2 + 0.35), 0, 0]);
      t.cyl(1.6, 2, 5, -8, 5.5, 3.4 * s, D, 8, X_AXIS);
      t.cyl(1.4, 1.4, 0.4, -10.6, 5.5, 3.4 * s, P.glow, 8, X_AXIS, true);
    });
  })) - 1;
  parts.push(part(T, 'arm', [1, 6, -6], a => {
    a.sphere(1.8, 0, 0, 0, S);
    a.box(2.4, 4.4, 2.4, 0, -2.4, 0, D);
    a.profile([[-1, 0], [5, -1], [6, -2.4], [-1, -2.6]], 1.4, 0, -4.4, 0, A);
  }, { parent: torso, phase: PI }));
  parts.push(part(T, 'gun', [1, 6, 6.2], g => {
    g.sphere(1.8, 0, 0, 0, S);
    g.box(2.4, 4, 2.4, 0, -2.2, 0, D);
    g.box(8, 2.6, 2.8, 4, -4.4, 0, S);
    g.box(8, 0.8, 0.8, 11.5, -4.4, 0.7, D).box(8, 0.8, 0.8, 11.5, -4.4, -0.7, D);
    g.box(6, 0.4, 2.9, 4, -3, 0, P.energy, [0, 0, 0], true);
  }, { parent: torso }));
  const b = k.build();
  return { hull: b.hull, glow: b.glow, parts, height: 38, hover: 0, muzzle: [15.5, 22.1, 6.2], walker: true, kneeDir: -1, strideLen: 9, hipY, heavyStep: false };
}

// ------------------------------------------------------------------ MONOLITH
// Hero juggernaut. A walking bunker: stubby legs, a slab chest with the Aegis
// projector, pauldrons topped with field emitters, a siege cannon and a shield fist.
function monolith(T: T3, P: TeamPalette): ModelSpec {
  const k = new Kit(T), parts: AnimPart[] = [];
  const S = P.secondary, D = P.dark, A = P.primary;
  const hipY = 16;
  k.box(10, 4, 18, 0, 16.5, 0, D);
  for (const [z, ph] of [[8, 0], [-8, PI]] as [number, number][]) {
    leg(T, parts, { pivot: [0, hipY, z], phase: ph, L1: 6.5, L2: 6.5 },
      t => {
        t.cyl(3.4, 3.4, 7, 0, 0, 0, S, 8, Z_AXIS);
        t.box(7, 7.4, 6.6, 0, -3.4, 0, S);
        t.profile([[0, 1], [2, 0], [2, -6], [0, -7]], 7.2, 3.4, 0, 0, A);
      },
      sh => {
        sh.profile([[-2, 2.5], [2.5, 2.5], [4.4, 0], [3, -3], [-2, -2.5]], 7.6, 0, 0, 0, A);
        sh.box(7.4, 6.5, 7.2, 0, -3.4, 0, S);
        sh.box(0.4, 3, 4, -3.9, -3.4, 0, P.glow, [0, 0, 0], true);
      },
      f => {
        f.cyl(2.4, 2.4, 6, 0, 0, 0, D, 8, Z_AXIS);
        f.profile([[-6, -3], [8, -3], [8, -1.5], [5.5, 0.5], [-5, 0.5], [-6, -1.5]], 10, 0, 0, 0, D);
        f.box(2.5, 2, 4, 7, -1.8, 2.6, S).box(2.5, 2, 4, 7, -1.8, -2.6, S);
      });
  }
  const torso = parts.push(part(T, 'torso', [0, 17.5, 0], t => {
    t.profile([[-9, 0], [8, 0], [11, 4], [11, 15], [7.5, 19], [-8, 19], [-11, 15], [-11, 4]], 22, 0, 0, 0, S);
    t.profile([[9, 1.5], [10.6, 1.5], [12.2, 4.5], [12.2, 14.5], [10.6, 17.5], [9, 17.5]], 16, 0, 0, 0, A);
    t.cyl(4, 4, 0.6, 12.3, 9.5, 0, D, 6, X_AXIS);
    t.cyl(3.1, 3.1, 0.8, 12.6, 9.5, 0, P.energy, 6, X_AXIS, true);
    t.box(0.5, 1.2, 12, 12.3, 15.4, 0, P.glow, [0, 0, 0], true);
    t.box(16, 1.4, 20, -1, 19.6, 0, A);
    t.box(0.6, 8, 14, -11.3, 9.5, 0, A);
    for (let i = 0; i < 4; i++) t.box(0.4, 0.6, 10, -11.7, 6.6 + i * 2, 0, D);
    t.box(0.4, 0.6, 6, -11.7, 14.6, 0, P.glow, [0, 0, 0], true);
    t.both(s => {
      t.cyl(1.6, 1.8, 6, -10.5, 21, 5 * s, D, 8);
      t.cyl(1.2, 1.2, 0.4, -10.5, 24.1, 5 * s, P.glow, 8, [0, 0, 0], true);
      t.profile([[-7, 14], [7, 14], [8.5, 17], [6, 22], [-6, 22], [-8, 18]], 7, 0, 0, 14.5 * s, A);
      t.box(13, 0.6, 7.4, 0, 18, 14.5 * s, D);
      t.sphere(1.8, 0, 22.6, 14.5 * s, P.energy, true);
      t.torus(2.6, 0.35, 0, 22.3, 14.5 * s, D, false);
    });
  })) - 1;
  parts.push(part(T, 'arm', [1, 14, -14.5], a => {
    a.sphere(3, 0, 0, 0, S);
    a.box(5, 6, 5, 0, -4, 0, D);
    a.box(6, 7, 6, 0.5, -10, 0, S);
    a.box(5, 4.5, 5.5, 1, -15, 0, D);
    a.profile([[-4, 0], [5, 0], [6, -10], [-3, -11]], 1.4, 0, -6, -3.6, A);
  }, { parent: torso, phase: PI }));
  parts.push(part(T, 'gun', [1, 14, 14.5], g => {
    g.sphere(3, 0, 0, 0, S);
    g.box(5, 6, 5, 0, -4, 0, D);
    g.box(10, 6.5, 6.5, 4, -9, 0, S);
    g.box(14, 4, 4, 14, -9, 0, D);
    g.box(3, 5.6, 5.6, 21.5, -9, 0, A);
    g.box(0.5, 4.2, 5.8, 20.4, -9, 0, D);
    g.box(9, 0.5, 1.4, 13, -6.8, 0, P.energy, [0, 0, 0], true);
  }, { parent: torso }));
  const b = k.build();
  return { hull: b.hull, glow: b.glow, parts, height: 46, hover: 0, muzzle: [24, 22.5, 14.5], walker: true, kneeDir: 1, strideLen: 7, hipY, heavyStep: true };
}

// ------------------------------------------------------------------ VESPER
// Hero marksman. Tall and narrow on stilt legs, a single-lens sensor head,
// stabiliser fins and a rail rifle longer than the frame is tall.
function vesper(T: T3, P: TeamPalette): ModelSpec {
  const k = new Kit(T), parts: AnimPart[] = [];
  const S = P.secondary, D = P.dark, A = P.primary;
  const hipY = 30;
  k.box(5, 3, 9, 0, 30.5, 0, D);
  for (const [z, ph] of [[3.8, 0], [-3.8, PI]] as [number, number][]) {
    leg(T, parts, { pivot: [0, hipY, z], phase: ph, L1: 14, L2: 13 },
      t => {
        t.cyl(1.8, 1.8, 3, 0, 0, 0, S, 8, Z_AXIS);
        t.box(3.4, 14, 3.2, 0, -7, 0, S);
        t.profile([[0, 0], [1.4, -1], [1.4, -11], [0, -13]], 3.6, 1.7, 0, 0, A);
      },
      sh => {
        sh.profile([[-1, 1.2], [1.6, 1.2], [3.4, -0.4], [1.4, -2.4], [-1, -1.6]], 3.2, 0, 0, 0, A);
        sh.box(3, 13, 2.8, 0, -6.5, 0, S);
        sh.profile([[0, -1], [1.2, -2], [1, -10], [0, -11]], 3, 1.5, 0, 0, A);
        sh.cyl(0.4, 0.4, 11, -1.8, -6, 0, P.light, 4);
        sh.box(0.3, 2, 2.6, 1.3, -8, 0, P.glow, [0, 0, 0], true);
      },
      f => {
        f.cyl(1.3, 1.3, 3, 0, 0, 0, D, 8, Z_AXIS);
        f.profile([[-3, -3], [6, -3], [6.5, -2], [3, 0], [-2, 0.2], [-3, -1.5]], 3.6, 0, 0, 0, D);
        f.box(1.8, 1, 1, 7, -2.5, 1.1, S).box(1.8, 1, 1, 7, -2.5, -1.1, S);
      });
  }
  const torso = parts.push(part(T, 'torso', [0, 31.5, 0], t => {
    t.profile([[-4, 0], [3, 0], [5, 4], [4.5, 10], [-3, 11.5], [-5.5, 6]], 8, 0, 0, 0, S);
    t.profile([[2.8, 1], [3.4, 1], [5.6, 4], [5.1, 9.8], [3, 10.4]], 6, 0, 0, 0, A);
    t.both(s => t.box(7, 0.8, 0.3, -0.5, 6, 4.1 * s, A));
    t.box(2, 2, 2.4, 0, 12, 0, D);
    t.profile([[-2.5, 0], [3, 0], [4.5, 1.5], [3.5, 4], [-2, 4], [-3, 2]], 3.6, 0, 12.5, 0, S);
    t.cyl(1.7, 1.7, 0.5, 4.3, 14.2, 0, D, 10, X_AXIS);
    t.cyl(1.25, 1.25, 0.6, 4.6, 14.2, 0, P.energy, 10, X_AXIS, true);
    t.both(s => {
      t.cyl(0.2, 0.2, 5, -1.5, 18.5, 1.4 * s, D, 4);
      t.profile([[0, 0], [-9, -6], [-10, -5], [-1, 1.5]], 0.5, -4, 9, 3 * s, A, [0, 0.3 * s, 0]);
    });
    t.box(3, 6, 5, -5.5, 6, 0, D);
    t.box(0.4, 4.5, 3, -7.1, 6, 0, P.energy, [0, 0, 0], true);
  })) - 1;
  parts.push(part(T, 'arm', [1, 8.5, -5], a => {
    a.sphere(1.6, 0, 0, 0, S);
    a.box(2, 4.5, 2, 0, -2.3, 0, D);
    a.box(5, 1.8, 1.8, 2.5, -4.6, 1.5, S);
    a.box(1.4, 1.4, 1.4, 5.3, -4.6, 2.5, D);
  }, { parent: torso, phase: PI }));
  parts.push(part(T, 'gun', [1, 8.5, 5], g => {
    g.sphere(1.6, 0, 0, 0, S);
    g.box(2, 4.5, 2, 0, -2.3, 0, D);
    g.box(10, 2.4, 2, 2, -3.6, -1, S);
    g.box(26, 1.4, 1.4, 18, -3.4, -1, D);
    g.box(22, 0.4, 1.8, 17, -2.6, -1, P.energy, [0, 0, 0], true);
    for (let i = 0; i < 4; i++) g.cyl(1.2, 1.2, 0.6, 9 + i * 5, -3.4, -1, A, 8, X_AXIS);
    g.box(2, 2, 2, 31.5, -3.4, -1, A);
    g.box(4, 1.2, 1.2, 4, -1.8, -1, D);
    g.profile([[-7, -5], [-3, -5], [-3, -2.8], [-6.5, -3]], 1.6, 0, 0, -1, D);
  }, { parent: torso }));
  const b = k.build();
  return { hull: b.hull, glow: b.glow, parts, height: 52, hover: 0, muzzle: [33.5, 36.6, 4], walker: true, kneeDir: 1, strideLen: 13, hipY, heavyStep: false };
}

// ------------------------------------------------------------------ HALBERD PRIME
// Halcyon's siege walker (boss). Four splayed legs in a trot, an armoured hull with
// missile silos, a command tower and a twin-barrelled spinal cannon.
function halberd(T: T3, P: TeamPalette): ModelSpec {
  const parts: AnimPart[] = [];
  const S = P.secondary, D = P.dark, A = P.primary, L = P.light;
  const hipY = 30;
  const legs: [number, number, number][] = [[11, 12.5, 0], [-11, -12.5, 0], [11, -12.5, PI], [-11, 12.5, PI]];
  for (const [x, z, ph] of legs) {
    const sp = z > 0 ? 0.22 : -0.22;
    leg(T, parts, { pivot: [x, hipY, z], phase: ph, L1: 14, L2: 13.5, splay: sp },
      t => {
        t.cyl(3.6, 3.6, 7, 0, 0, 0, S, 8, Z_AXIS);
        t.box(6.5, 14, 6.5, 0, -7, 0, S);
        t.profile([[0, 1], [2.4, 0], [2.4, -11], [0, -13]], 7, 3.2, 0, 0, A);
        t.cyl(0.9, 0.9, 10, -3.8, -7, 0, L, 6);
      },
      sh => {
        sh.profile([[-3, 2.6], [3, 2.6], [5, 0], [3, -3.4], [-3, -3]], 7.6, 0, 0, 0, A);
        sh.box(6, 13.5, 6, 0, -6.8, 0, D);
        sh.box(6.4, 1.2, 6.4, 0, -10.5, 0, shade(A, 0.7));
      },
      f => {
        f.cyl(2.4, 2.4, 6, 0, 0, 0, D, 8, Z_AXIS);
        f.profile([[-6, -3], [7, -3], [7, -1.5], [4.5, 0.5], [-4.5, 0.5], [-6, -1.5]], 9, 0, 0, 0, D);
        f.box(3, 1.4, 2, 7.5, -2.4, 2.6, S).box(3, 1.4, 2, 7.5, -2.4, -2.6, S);
      });
  }
  const torso = parts.push(part(T, 'torso', [0, 30, 0], t => {
    t.profile([[-17, 0], [14, 0], [19, 5], [19, 14], [13, 20], [-14, 20], [-19, 14], [-19, 4]], 28, 0, 0, 0, S);
    t.box(26, 1.6, 24, -2, 20.8, 0, A);
    t.profile([[17.5, 1], [19.5, 1], [21, 5], [21, 13.5], [18, 17], [16.5, 17]], 20, 0, 0, 0, A);
    t.box(0.5, 2.4, 16, 21.3, 9, 0, P.danger, [0, 0, 0], true);
    for (let i = 0; i < 6; i++) t.box(0.4, 1.2, 1.6, 21.2, 3.6, -7 + i * 2.8, i % 2 ? D : L);
    t.box(8, 6, 7, -10, 23.5, 0, S);
    t.box(0.5, 1.2, 5, -5.9, 24.5, 0, P.danger, [0, 0, 0], true);
    t.cyl(0.3, 0.3, 9, -12, 30, 2.4, D, 4);
    t.box(0.6, 10, 18, -19.3, 9, 0, A);
    for (let i = 0; i < 3; i++) t.box(0.4, 0.8, 12, -19.7, 6 + i * 2.6, 0, P.glow, [0, 0, 0], true);
    t.both(s => {
      t.box(24, 1.4, 0.4, -1, 12, 14.1 * s, A);
      t.box(10, 0.6, 0.4, 2, 9.6, 14.1 * s, P.glow, [0, 0, 0], true);
      t.box(12, 8, 9, -4, 24, 10 * s, D);
      for (let c = 0; c < 3; c++) for (const dz of [-2.2, 2.2]) {
        t.cyl(1.6, 1.6, 1, -8 + c * 4, 28.5, 10 * s + dz, S, 8);
        t.cyl(1.1, 1.1, 0.3, -8 + c * 4, 29.1, 10 * s + dz, P.danger, 8, [0, 0, 0], true);
      }
      t.box(6, 3.5, 4, 8, 9, 14.6 * s, D);
      t.box(8, 1.2, 1.2, 14, 9, 14.6 * s, D);
      t.cyl(1.8, 2, 8, -17, 22, 6 * s, D, 8);
      t.cyl(1.4, 1.4, 0.4, -17, 26.1, 6 * s, P.glow, 8, [0, 0, 0], true);
    });
  })) - 1;
  parts.push(part(T, 'gun', [16, 12, 0], g => {
    g.box(6, 8, 10, 0, 0, 0, D);
    g.both(s => {
      g.box(22, 3.6, 3.6, 13, 0, 3 * s, D);
      g.box(3.4, 5, 5, 24.5, 0, 3 * s, A);
    });
    g.box(14, 0.4, 1.2, 12, 1.9, 3, P.danger, [0, 0, 0], true).box(14, 0.4, 1.2, 12, 1.9, -3, P.danger, [0, 0, 0], true);
  }, { parent: torso }));
  return { hull: null, glow: null, parts, height: 60, hover: 0, muzzle: [42, 42, 0], walker: true, kneeDir: 1, strideLen: 12, hipY, heavyStep: true };
}
