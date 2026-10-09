// BRANCHLIKE 3D battlefield renderer (Three.js r160, vendored, MIT).
// Reads battle state and events only; never mutates gameplay.
//
// Draw-call budget (high quality, busy battle): static map ≈ 8, hardpoints 9,
// units 1–5 each (geometry shared per unit type and team), particles 2,
// pooled rings/beams/decals ≈ 10. Battery-saver drops shadows, MSAA and
// halves particle counts and resolution.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Battle, BattleEvent, Entity } from '../sim/battle.js';
import type { MapDef, Team } from '../data/types.js';
import { WORLD_W as W, WORLD_H as H, CORE_POS, DEPLOY_LINE, FORWARD_DEPLOY_RADIUS, POINT_RADIUS } from '../data/maps.js';
import { UNITS, ABILITIES } from '../data/units.js';
import type { BattleView, Overlay } from './view.js';
import { buildModel, Kit, type ModelSpec } from './models3d.js';
import { LOOKS, paintGround, buildEnvironment, type MapLook } from './environment3d.js';

type T3 = any;
const TEAM_HEX = ['#f2a93b', '#9583ff'];
const TEAM_NUM = [0xf2a93b, 0x9583ff];
const ENERGY = 0x6fd3ef;

interface UnitView { root: T3; gun: T3 | null; legs: T3[]; spec: ModelSpec; x: number; y: number; yaw: number; phase: number; recoil: number; seen: boolean; structure: boolean }
interface PointView { pad: T3; ring: T3; arc: T3; beacon: T3; gem: T3; lastCap: number; lastOwner: Team | null | undefined }
interface Line2D { x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; t: number; T: number; color: string; width: number; kind: 'tracer' | 'beam' | 'heal' | 'rocket' }
interface Proj { x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; t: number; T: number; arc: number; color: [number, number, number]; trail: boolean; size: number }

/** GPU particle pool rendered as point sprites. */
class Particles {
  readonly points: T3;
  private n = 0;
  private cap: number;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private life: Float32Array; private max: Float32Array; private s0: Float32Array; private s1: Float32Array;
  private grav: Float32Array; private drag: Float32Array; private a0: Float32Array;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private geo: T3;
  readonly mat: T3;
  constructor(T: T3, cap: number, additive: boolean) {
    this.cap = cap;
    const f = () => new Float32Array(cap);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.max = f(); this.s0 = f(); this.s1 = f(); this.grav = f(); this.drag = f(); this.a0 = f();
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = f(); this.alpha = f();
    this.geo = new T.BufferGeometry();
    const attr = (a: Float32Array, n: number) => { const b = new T.BufferAttribute(a, n); b.setUsage(T.DynamicDrawUsage); return b; };
    this.geo.setAttribute('position', attr(this.pos, 3));
    this.geo.setAttribute('pcolor', attr(this.col, 3));
    this.geo.setAttribute('psize', attr(this.size, 1));
    this.geo.setAttribute('palpha', attr(this.alpha, 1));
    this.geo.boundingSphere = new T.Sphere(new T.Vector3(180, 0, 320), 2000);
    this.mat = new T.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; vC = pcolor; vA = palpha; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.05, r) * vA; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    });
    this.points = new T.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, r: number, g: number, b: number, a = 1, grav = 0, drag = 0) {
    let i = this.n < this.cap ? this.n++ : -1;
    if (i < 0) { // reuse the oldest-ish slot
      let best = 0, bl = Infinity;
      for (let k = 0; k < this.cap; k += 7) if (this.life[k] < bl) { bl = this.life[k]; best = k; }
      i = best;
    }
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = a;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  update(dt: number) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      const k = 1 - this.drag[i] * dt;
      this.vx[i] *= k; this.vz[i] *= k; this.vy[i] = this.vy[i] * k - this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.5) { this.py[i] = 0.5; this.vy[i] *= -0.3; }
      if (w !== i) { // compact alive particles to the front
        for (const a of [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.life, this.max, this.s0, this.s1, this.grav, this.drag, this.a0]) a[w] = a[i];
        this.col[w * 3] = this.col[i * 3]; this.col[w * 3 + 1] = this.col[i * 3 + 1]; this.col[w * 3 + 2] = this.col[i * 3 + 2];
      }
      const t = 1 - this.life[w] / this.max[w];
      this.pos[w * 3] = this.px[w]; this.pos[w * 3 + 1] = this.py[w]; this.pos[w * 3 + 2] = this.pz[w];
      this.size[w] = this.s0[w] + (this.s1[w] - this.s0[w]) * t;
      this.alpha[w] = this.a0[w] * (1 - t) * Math.min(1, t * 8 + 0.3);
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, this.n);
    for (const name of ['position', 'pcolor', 'psize', 'palpha']) this.geo.attributes[name].needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class View3D implements BattleView {
  readonly kind = '3d' as const;
  readonly el: HTMLDivElement;
  private T: T3;
  private quality: 'high' | 'low';
  private gl: T3;
  private scene: T3;
  private camera: T3;
  private sun: T3;
  private hemi: T3;
  private overlay: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private cssW = 1; private cssH = 1; private dpr = 1;
  private target: T3;
  private camBase: T3;
  private ground: T3;
  private raycaster: T3;
  private plane: T3;
  private mats: Record<string, T3> = {};
  private models = new Map<string, ModelSpec>();
  private units = new Map<number, UnitView>();
  private points: PointView[] = [];
  private staticGroup: T3;
  private glow!: Particles;
  private smoke!: Particles;
  private lines: Line2D[] = [];
  private projs: Proj[] = [];
  private rings: { mesh: T3; t: number; T: number; r0: number; r1: number; a: number }[] = [];
  private beams: { mesh: T3; t: number; T: number }[] = [];
  private decals: T3[] = [];
  private decalIdx = 0;
  private lights: { light: T3; t: number }[] = [];
  private shake = 0;
  private time = 0;
  private look: MapLook = LOOKS.dust;
  private nearGroup: T3 = null;
  private landscape = false;
  private ghost: { id: string; group: T3 } | null = null;
  private ui: Record<string, T3> = {};
  private v: T3;
  private frameEma = 1 / 60;
  private slowFor = 0;
  private dprCap = 2;
  private lastFit: [number, number, { top: number; bottom: number }] = [1, 1, { top: 0, bottom: 0 }];

  constructor(T: T3, quality: 'high' | 'low') {
    this.T = T; this.quality = quality;
    this.el = document.createElement('div');
    this.el.className = 'view3d';
    Object.assign(this.el.style, { position: 'absolute', inset: '0', touchAction: 'none' });
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
    this.overlay = document.createElement('canvas');
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none' });
    this.el.append(canvas, this.overlay);
    this.octx = this.overlay.getContext('2d')!;
    const high = quality === 'high';
    this.gl = new T.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance', alpha: false });
    this.gl.toneMapping = T.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.3;
    this.gl.shadowMap.enabled = high;
    this.gl.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(30, 1, 10, 5000);
    this.target = new T.Vector3(W / 2, 0, 318);
    this.camBase = new T.Vector3();
    this.hemi = new T.HemisphereLight(0xffffff, 0x333333, 1);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffffff, 2.5);
    this.sun.position.set(W / 2 - 230, 430, 318 + 170);
    this.sun.target.position.copy(this.target);
    this.scene.add(this.sun, this.sun.target);
    if (high) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera;
      c.left = -300; c.right = 300; c.top = 420; c.bottom = -420; c.near = 50; c.far = 1400;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.6;
    }
    this.raycaster = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    this.v = new T.Vector3();
    this.mats.hull = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.35 });
    this.mats.glow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.mats.static = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.12 });
    this.mats.ghostOk = new T.MeshBasicMaterial({ color: 0xf2a93b, transparent: true, opacity: 0.45, depthWrite: false });
    this.mats.ghostBad = new T.MeshBasicMaterial({ color: 0xff6158, transparent: true, opacity: 0.45, depthWrite: false });
    this.staticGroup = new T.Group();
    this.scene.add(this.staticGroup);
    this.ground = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ roughness: 0.92, metalness: 0.05 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(W / 2, 0, H / 2);
    this.ground.receiveShadow = high;
    this.scene.add(this.ground);
    this.glow = new Particles(T, high ? 900 : 450, true);
    this.smoke = new Particles(T, high ? 500 : 220, false);
    this.scene.add(this.glow.points, this.smoke.points);
    this.buildPools();
    this.buildUi();
  }

  // ------------------------------------------------------------------ setup

  private ringGeo(inner = 0.9, outer = 1, seg = 48) { const g = new this.T.RingGeometry(inner, outer, seg); g.rotateX(-Math.PI / 2); return g; }

  private buildPools() {
    const T = this.T;
    const ring = this.ringGeo(0.86, 1);
    for (let i = 0; i < 24; i++) {
      const m = new T.Mesh(ring, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
      m.visible = false; m.renderOrder = 4; this.scene.add(m);
      this.rings.push({ mesh: m, t: 0, T: 1, r0: 1, r1: 1, a: 1 });
    }
    const beam = new T.CylinderGeometry(1, 1, 1, 10, 1, true); beam.translate(0, 0.5, 0);
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(beam, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false }));
      m.visible = false; m.renderOrder = 4; this.scene.add(m);
      this.beams.push({ mesh: m, t: 0, T: 1 });
    }
    // Scorch decal texture
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(10,8,6,0.85)'); grad.addColorStop(0.6, 'rgba(15,12,10,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(c);
    const dg = new T.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const m = new T.Mesh(dg, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.visible = false; m.renderOrder = 1; this.scene.add(m); this.decals.push(m);
    }
    if (this.quality === 'high') for (let i = 0; i < 2; i++) { const l = new T.PointLight(0xffb36b, 0, 140, 1.6); this.scene.add(l); this.lights.push({ light: l, t: 0 }); }
  }

  private buildUi() {
    const T = this.T;
    const mk = (geo: T3, color: number, opacity: number, order = 5) => {
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }));
      m.visible = false; m.renderOrder = order; this.scene.add(m); return m;
    };
    this.ui.range = mk(this.ringGeo(0.975, 1, 72), 0xffffff, 0.7);
    this.ui.rangeFill = mk(new T.CircleGeometry(1, 48).rotateX(-Math.PI / 2), 0xffffff, 0.06);
    this.ui.minRange = mk(this.ringGeo(0.96, 1, 48), 0xff6158, 0.6);
    this.ui.select = mk(this.ringGeo(0.78, 1, 32), 0xffffff, 0.9);
    this.ui.reticle = mk(this.ringGeo(0.92, 1, 48), 0xf2a93b, 0.95);
    this.ui.reticleFill = mk(new T.CircleGeometry(1, 40).rotateX(-Math.PI / 2), 0xf2a93b, 0.12);
    this.ui.lance = mk(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ENERGY, 0.35);
    this.ui.zone = mk(new T.PlaneGeometry(W, H - DEPLOY_LINE[0]).rotateX(-Math.PI / 2), 0xf2a93b, 0.1, 1);
    this.ui.zone.position.set(W / 2, 0.4, (H + DEPLOY_LINE[0]) / 2);
    this.ui.fwd = [0, 1, 2].map(() => { const m = mk(new T.CircleGeometry(FORWARD_DEPLOY_RADIUS, 40).rotateX(-Math.PI / 2), 0xf2a93b, 0.14, 1); return m; });
    for (const k of Object.keys(this.ui)) if (this.ui[k].position && k !== 'zone') this.ui[k].position.y = 0.6;
  }

  reset(map: MapDef) {
    const T = this.T;
    this.look = LOOKS[map.palette];
    const L = this.look;
    for (const v of this.units.values()) this.scene.remove(v.root);
    this.units.clear();
    for (const p of this.points) for (const m of [p.pad, p.ring, p.arc, p.beacon, p.gem]) this.scene.remove(m);
    this.points = [];
    this.lines = []; this.projs = [];
    this.glow.clear(); this.smoke.clear();
    for (const d of this.decals) d.visible = false;
    this.staticGroup.clear();
    this.scene.background = new T.Color(L.bg);
    this.scene.fog = new T.Fog(L.bg, L.fogNear, L.fogFar);
    this.hemi.color.setHex(L.sky); this.hemi.groundColor.setHex(L.groundHemi); this.hemi.intensity = L.hemiI;
    this.sun.color.setHex(L.sun); this.sun.intensity = L.sunI;
    this.gl.toneMappingExposure = L.exposure;
    // Ground texture: streets, sidewalks, plazas, markings
    const tex = new T.CanvasTexture(paintGround(map, L, this.quality === 'high' ? 3 : 2));
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.gl.capabilities.getMaxAnisotropy());
    const gm = this.ground.material;
    gm.map?.dispose(); gm.map = tex; gm.needsUpdate = true;
    // Buildings, trees, signage and street furniture
    const env = buildEnvironment(T, map, L, { static: this.mats.static, glow: this.mats.glow }, this.quality === 'high');
    this.staticGroup.add(env.group, env.nearGroup);
    this.nearGroup = env.nearGroup;
    this.nearGroup.visible = !this.landscape;
    this.buildPoints(map);
  }

  private buildPoints(map: MapDef) {
    const T = this.T;
    for (const p of map.points) {
      const padKit = new Kit(T);
      padKit.cyl(POINT_RADIUS + 4, POINT_RADIUS + 6, 1.6, 0, 0.8, 0, 0x3a4048, 6, [0, Math.PI / 6, 0]);
      padKit.cyl(POINT_RADIUS + 2, POINT_RADIUS + 2, 0.4, 0, 1.75, 0, 0x2a2f36, 6, [0, Math.PI / 6, 0]);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; padKit.box(4, 9, 4, Math.cos(a) * (POINT_RADIUS + 2), 4.5, Math.sin(a) * (POINT_RADIUS + 2), 0x3a4048); }
      padKit.cyl(2.2, 3, 30, 0, 15, 0, 0x30353d, 6);
      const b = padKit.build();
      const pad = new T.Mesh(b.hull, this.mats.static); pad.position.set(p.x, 0, p.y); pad.castShadow = this.quality === 'high'; pad.receiveShadow = this.quality === 'high';
      const ringGeo = new T.RingGeometry((POINT_RADIUS - 1.8) / POINT_RADIUS, 1, 6); ringGeo.rotateZ(Math.PI / 6); ringGeo.rotateX(-Math.PI / 2);
      const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0x8b95a1, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
      ring.scale.setScalar(POINT_RADIUS + 3); ring.position.set(p.x, 2, p.y);
      const arc = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
      arc.position.set(p.x, 1.9, p.y);
      const beaconGeo = new T.CylinderGeometry(2.2, 5, 120, 10, 1, true); beaconGeo.translate(0, 60, 0);
      const beacon = new T.Mesh(beaconGeo, new T.MeshBasicMaterial({ color: 0x8b95a1, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false }));
      beacon.position.set(p.x, 30, p.y);
      const gem = new T.Mesh(new T.CylinderGeometry(5.5, 5.5, 3, 6), new T.MeshStandardMaterial({ color: 0x8b95a1, emissive: 0x8b95a1, emissiveIntensity: 0.6, flatShading: true, roughness: 0.3 }));
      gem.position.set(p.x, 38, p.y);
      this.scene.add(pad, ring, arc, beacon, gem);
      this.points.push({ pad, ring, arc, beacon, gem, lastCap: NaN, lastOwner: undefined });
    }
  }

  // ------------------------------------------------------------------ sizing and input

  fit(width: number, height: number, insets = { top: 0, bottom: 0 }) {
    const T = this.T;
    this.lastFit = [width, height, insets];
    this.cssW = Math.max(1, Math.floor(width)); this.cssH = Math.max(1, Math.floor(height));
    this.dpr = Math.min(this.quality === 'high' ? this.dprCap : 1.25, globalThis.devicePixelRatio || 1);
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(this.cssW, this.cssH, false);
    this.overlay.width = Math.round(this.cssW * this.dpr); this.overlay.height = Math.round(this.cssH * this.dpr);
    this.octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const cam = this.camera;
    cam.aspect = this.cssW / this.cssH;
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    // Portrait: camera behind the player's spire looking up the field.
    // Landscape: camera on the field's east side, so the player is on the left and Halcyon on the right.
    this.landscape = this.cssW > this.cssH * 1.05;
    if (this.nearGroup) this.nearGroup.visible = !this.landscape;
    // Keep the sun on the camera's side so building faces toward the player are lit.
    this.sun.position.copy(this.target).add(this.landscape ? new T.Vector3(210, 430, 160) : new T.Vector3(-230, 430, 170));
    const el = (this.landscape ? 54 : 50) * Math.PI / 180;
    const dir = this.landscape ? new T.Vector3(Math.cos(el), Math.sin(el), 0) : new T.Vector3(0, Math.sin(el), Math.cos(el));
    const V = (a: number[][]) => a.map(([x, y, z]) => new T.Vector3(x, y, z));
    // Fitting points. The near edge may crop slightly so units stay large.
    const wide = this.landscape
      ? V([[0, 0, 4], [0, 0, H - 4], [W - 40, 0, 4], [W - 40, 0, H - 4]])
      : V([[0, 0, 0], [W, 0, 0], [0, 0, H - 110], [W, 0, H - 110]]);
    const tall = this.landscape
      ? V([[W - 50, 0, H / 2], [14, 0, H / 2], [W / 2, 66, CORE_POS[1].y]])
      : V([[W / 2, 0, H], [W / 2, 66, CORE_POS[1].y - 30], [W / 2, 0, 0]]);
    const regionH = Math.max(0.2, (this.cssH - insets.top - insets.bottom) / this.cssH * 2);
    const measure = (dist: number) => {
      cam.position.copy(this.target).addScaledVector(dir, dist);
      cam.lookAt(this.target); cam.updateMatrixWorld(true);
      let minX = 9, maxX = -9, minY = 9, maxY = -9;
      for (const p of wide) { this.v.copy(p).project(cam); minX = Math.min(minX, this.v.x); maxX = Math.max(maxX, this.v.x); }
      for (const p of tall) { this.v.copy(p).project(cam); minY = Math.min(minY, this.v.y); maxY = Math.max(maxY, this.v.y); }
      return { minX, maxX, minY, maxY };
    };
    let lo = 200, hi = 6000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2, m = measure(mid);
      const ok = m.maxX <= 0.985 && m.minX >= -0.985 && (m.maxY - m.minY) <= regionH * 0.97;
      if (ok) hi = mid; else lo = mid;
    }
    const m = measure(hi);
    this.camBase.copy(cam.position);
    const fieldCenter = (m.maxY + m.minY) / 2;
    const regionCenter = 1 - 2 * (insets.top + (this.cssH - insets.top - insets.bottom) / 2) / this.cssH;
    const shiftPx = (fieldCenter - regionCenter) * this.cssH / 2;
    cam.setViewOffset(this.cssW, this.cssH, 0, -shiftPx, this.cssW, this.cssH);
    cam.updateProjectionMatrix();
    const scale = this.cssH * this.dpr / (2 * Math.tan(cam.fov * Math.PI / 360));
    this.glow.mat.uniforms.uScale.value = scale;
    this.smoke.mat.uniforms.uScale.value = scale;
  }

  private ndc(clientX: number, clientY: number) {
    const r = this.el.getBoundingClientRect();
    return new this.T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  toWorld(clientX: number, clientY: number) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = new this.T.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return { x: -1, y: -1, inside: false };
    return { x: hit.x, y: hit.z, inside: hit.x >= 0 && hit.x <= W && hit.z >= 0 && hit.z <= H };
  }

  overCanvas(clientX: number, clientY: number) {
    const r = this.el.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false;
    // Ignore the HUD bands: only count points that land on the field.
    return this.toWorld(clientX, clientY).inside;
  }

  private screen(x: number, h: number, y: number) {
    this.v.set(x, h, y).project(this.camera);
    return { sx: (this.v.x + 1) / 2 * this.cssW, sy: (1 - this.v.y) / 2 * this.cssH, z: this.v.z };
  }

  pick(b: Battle, clientX: number, clientY: number): Entity | null {
    const r = this.el.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    let best: Entity | null = null, bd = 30;
    for (const e of b.ents) {
      const v = this.units.get(e.id);
      const p = this.screen(v?.x ?? e.x, (v?.spec.height ?? 10) * 0.5 + (v?.spec.hover ?? 0), v?.y ?? e.y);
      const d = Math.hypot(p.sx - px, p.sy - py) - Math.min(14, e.def.radius * 0.6);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------------ units

  private model(id: string, team: Team): ModelSpec {
    const key = `${id}:${team}`;
    let m = this.models.get(key);
    if (!m) {
      m = buildModel(this.T, id, team);
      // Units are drawn larger than their collision size so they read on a phone screen.
      const kind = UNITS[id]?.kind;
      const s = kind === 'infantry' ? 1.6 : kind === 'drone' ? 1.5 : kind === 'vehicle' ? 1.3 : kind === 'structure' ? 1.25 : kind === 'mech' || kind === 'hero' ? 1.18 : kind === 'boss' ? 1.1 : 1;
      if (s !== 1) {
        for (const g of [m.hull, m.glow, ...m.parts.flatMap(p => [p.hull, p.glow])]) g?.scale(s, s, s);
        for (const p of m.parts) p.pivot = [p.pivot[0] * s, p.pivot[1] * s, p.pivot[2] * s];
        m.muzzle = [m.muzzle[0] * s, m.muzzle[1] * s, m.muzzle[2] * s];
        m.height *= s;
      }
      this.models.set(key, m);
    }
    return m;
  }

  private makeView(e: Entity): UnitView {
    const T = this.T;
    const spec = this.model(e.def.id, e.team);
    const root = new T.Group();
    const shadows = this.quality === 'high';
    const add = (parent: T3, geo: T3, mat: T3) => { if (!geo) return; const m = new T.Mesh(geo, mat); m.castShadow = shadows && mat === this.mats.hull; parent.add(m); };
    add(root, spec.hull, this.mats.hull);
    add(root, spec.glow, this.mats.glow);
    let gun: T3 | null = null; const legs: T3[] = [];
    for (const p of spec.parts) {
      // Part geometry is authored relative to its pivot, so the group sits at the pivot.
      const g = new T.Group(); g.position.set(...p.pivot);
      add(g, p.hull, this.mats.hull); add(g, p.glow, this.mats.glow);
      root.add(g);
      if (p.role === 'gun') gun = g; else if (p.role === 'legL' || p.role === 'legR') { g.userData.sign = p.role === 'legL' ? 1 : -1; legs.push(g); }
    }
    const structure = e.def.speed === 0;
    const yaw = -e.face;
    if (!structure) root.rotation.y = yaw;
    root.position.set(e.x, spec.hover, e.y);
    this.scene.add(root);
    return { root, gun, legs, spec, x: e.x, y: e.y, yaw, phase: Math.random() * 6, recoil: 0, seen: true, structure };
  }

  private syncUnits(b: Battle, dt: number) {
    for (const v of this.units.values()) v.seen = false;
    const k = 1 - Math.exp(-dt * 18);
    for (const e of b.ents) {
      let v = this.units.get(e.id);
      if (!v) { v = this.makeView(e); this.units.set(e.id, v); }
      v.seen = true;
      const ox = v.x, oy = v.y;
      v.x += (e.x - v.x) * k; v.y += (e.y - v.y) * k;
      const moved = Math.hypot(v.x - ox, v.y - oy);
      const age = b.t - e.spawnT;
      const drop = age < 0.4 && e.def.kind !== 'core' && e.def.kind !== 'boss' ? Math.pow(1 - age / 0.4, 2) * 160 : 0;
      const bob = v.spec.hover ? Math.sin(this.time * 5 + e.id) * 1.2 : 0;
      v.root.position.set(v.x, v.spec.hover + drop + bob, v.y);
      const yaw = -e.face;
      if (v.structure) {
        if (v.gun) { let d = yaw - v.gun.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); v.gun.rotation.y += d * Math.min(1, dt * 8); }
      } else {
        let d = yaw - v.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        v.root.rotation.y += d * Math.min(1, dt * 9);
        if (v.spec.hover) v.root.rotation.z = Math.max(-0.25, Math.min(0.25, -moved * 0.4));
      }
      if (e.stun <= 0 && moved > 0.01) v.phase += moved * 0.35;
      const stride = v.spec.walker ? Math.min(1, moved * 3) : 0;
      for (const leg of v.legs) leg.rotation.z = Math.sin(v.phase) * 0.45 * stride * leg.userData.sign;
      if (!v.spec.walker && !v.spec.hover && e.def.kind === 'infantry') v.root.position.y += Math.abs(Math.sin(v.phase * 1.3)) * Math.min(1, moved * 4) * 1.2;
      if (v.gun) { v.recoil = Math.max(0, v.recoil - dt * 6); const p0 = v.gun.userData.px ??= v.gun.position.x; v.gun.position.x = p0 - v.recoil * 2.5; }
      // Damage smoke from heavily damaged frames, vehicles and spires
      if (e.hp / e.maxHp < 0.4 && (e.def.kind === 'mech' || e.def.kind === 'hero' || e.def.kind === 'core' || e.def.kind === 'boss' || e.def.kind === 'vehicle') && Math.random() < dt * 6) {
        this.smoke.emit(v.x + (Math.random() - 0.5) * 6, v.spec.height * 0.85, v.y + (Math.random() - 0.5) * 6, 2, 14, -3, 2.2, 6, 22, 0.12, 0.11, 0.1, 0.6, -2, 0.4);
      }
    }
    for (const [id, v] of this.units) if (!v.seen) { this.scene.remove(v.root); this.units.delete(id); }
  }

  private muzzleOf(v: UnitView | undefined, x: number, y: number, hFallback: number) {
    if (!v) return { x, y, h: hFallback };
    const [mx, my, mz] = v.spec.muzzle;
    const yaw = v.structure ? (v.gun?.rotation.y ?? 0) : v.root.rotation.y;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return { x: v.x + mx * c + mz * s, y: v.y - mx * s + mz * c, h: my + v.spec.hover };
  }

  private viewNear(x: number, y: number, team: Team, b: Battle): UnitView | undefined {
    let best: UnitView | undefined, bd = 4;
    for (const e of b.ents) { if (e.team !== team) continue; const d = Math.abs(e.x - x) + Math.abs(e.y - y); if (d < bd) { bd = d; best = this.units.get(e.id); } }
    return best;
  }

  // ------------------------------------------------------------------ effects

  private ring(x: number, y: number, r0: number, r1: number, T: number, color: number, a = 1, h = 1) {
    const slot = this.rings.find(r => r.t <= 0) ?? this.rings[0];
    slot.t = T; slot.T = T; slot.r0 = r0; slot.r1 = r1; slot.a = a;
    slot.mesh.material.color.setHex(color);
    slot.mesh.position.set(x, h, y);
    slot.mesh.visible = true;
  }
  private beam(x: number, y: number, radius: number, height: number, T: number, color: number) {
    const slot = this.beams.find(r => r.t <= 0) ?? this.beams[0];
    slot.t = T; slot.T = T;
    slot.mesh.material.color.setHex(color);
    slot.mesh.scale.set(radius, height, radius);
    slot.mesh.position.set(x, 0, y);
    slot.mesh.visible = true;
  }
  private decal(x: number, y: number, r: number) {
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.position.set(x, 0.3 + (this.decalIdx % 7) * 0.02, y); d.scale.set(r * 2, 1, r * 2); d.rotation.y = Math.random() * 6; d.material.opacity = 0.8; d.visible = true;
  }
  private flash(x: number, y: number, h: number, power: number) {
    if (!this.lights.length) return;
    const l = this.lights.find(q => q.t <= 0) ?? this.lights[0];
    l.t = 0.25; l.light.position.set(x, h + 10, y); l.light.intensity = power;
  }
  private explosion(x: number, y: number, r: number, big: boolean, team: Team, reduceMotion: boolean) {
    const n = Math.round((big ? 34 : 14) * (this.quality === 'high' ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (big ? 60 : 35) * (0.3 + Math.random());
      const hot = Math.random();
      this.glow.emit(x, 3 + Math.random() * 4, y, Math.cos(a) * sp, 20 + Math.random() * (big ? 70 : 40), Math.sin(a) * sp, 0.35 + Math.random() * 0.35, big ? 10 : 6, 1, 1, 0.55 + hot * 0.35, 0.2 + hot * 0.25, 1, 60, 1.5);
    }
    this.glow.emit(x, 6, y, 0, 6, 0, 0.18, r * 1.4, r * 2.4, 1, 0.85, 0.6, 1);
    for (let i = 0; i < (big ? 10 : 4); i++) this.smoke.emit(x + (Math.random() - 0.5) * r, 4, y + (Math.random() - 0.5) * r, (Math.random() - 0.5) * 10, 10 + Math.random() * 14, (Math.random() - 0.5) * 10, 1.4 + Math.random(), r * 0.6, r * 1.8, 0.1, 0.09, 0.08, 0.7, -3, 0.6);
    if (big) for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28; this.smoke.emit(x, 6, y, Math.cos(a) * 50, 60 + Math.random() * 50, Math.sin(a) * 50, 1, 3, 2, 0.15, 0.15, 0.16, 1, 140, 0.5); }
    this.ring(x, y, r * 0.3, r * (big ? 2.6 : 1.8), big ? 0.55 : 0.35, big ? 0xffd9a0 : TEAM_NUM[team], 0.9);
    this.decal(x, y, r * (big ? 1.4 : 0.9));
    this.flash(x, y, 6, big ? 5 : 2.5);
    if (!reduceMotion) this.shake = Math.max(this.shake, big ? 6 : 1.6);
  }

  ingest(events: BattleEvent[], reduceMotion: boolean) {
    const b = this.lastBattle; if (!b) return;
    for (const ev of events) {
      switch (ev.type) {
        case 'shot': {
          const v = this.viewNear(ev.x1, ev.y1, ev.team, b);
          if (v) v.recoil = 1;
          const m = this.muzzleOf(v, ev.x1, ev.y1, ev.h1);
          const col = ev.weapon === 'energy' ? '#7fe3ff' : ev.heavy ? '#fff1d6' : ev.team === 0 ? '#ffd28a' : '#cfc4ff';
          if (ev.weapon === 'antiarmor') this.projs.push({ x1: m.x, y1: m.y, h1: m.h, x2: ev.x2, y2: ev.y2, h2: ev.h2, t: 0.24, T: 0.24, arc: 6, color: [1, 0.6, 0.25], trail: true, size: 4 });
          else this.lines.push({ x1: m.x, y1: m.y, h1: m.h, x2: ev.x2, y2: ev.y2, h2: ev.h2, t: 0.09, T: 0.09, color: col, width: ev.heavy ? 3 : ev.weapon === 'energy' ? 2.4 : 1.4, kind: 'tracer' });
          this.glow.emit(m.x, m.h, m.y, 0, 0, 0, 0.06, ev.heavy ? 9 : 5, 2, 1, 0.85, 0.5, 1);
          for (let i = 0; i < (ev.heavy ? 4 : 2); i++) this.glow.emit(ev.x2, ev.h2, ev.y2, (Math.random() - 0.5) * 50, 20 + Math.random() * 30, (Math.random() - 0.5) * 50, 0.2, 2.5, 0.5, 1, 0.8, 0.45, 1, 120);
          break;
        }
        case 'shell': {
          const v = this.viewNear(ev.x1, ev.y1, ev.team, b);
          if (v) v.recoil = 1;
          const m = this.muzzleOf(v, ev.x1, ev.y1, 14);
          this.projs.push({ x1: m.x, y1: m.y, h1: m.h, x2: ev.x2, y2: ev.y2, h2: 1, t: ev.t, T: ev.t, arc: 110, color: [1, 0.85, 0.55], trail: true, size: 5 });
          this.ring(ev.x2, ev.y2, 18, 22, ev.t, ev.team === 0 ? 0xf2a93b : 0xff6158, 0.5, 0.8);
          for (let i = 0; i < 5; i++) this.smoke.emit(m.x, m.h, m.y, (Math.random() - 0.5) * 12, 12, (Math.random() - 0.5) * 12, 0.9, 4, 12, 0.3, 0.29, 0.28, 0.6, 0, 1);
          break;
        }
        case 'blast': this.explosion(ev.x, ev.y, ev.r, false, ev.team, reduceMotion); break;
        case 'death': {
          const big = ev.size >= 12;
          this.explosion(ev.x, ev.y, Math.max(10, ev.size * 1.6), big, ev.team, reduceMotion);
          if (ev.kind === 'core' || ev.kind === 'boss') { for (let i = 0; i < 4; i++) setTimeout(() => this.explosion(ev.x + (Math.random() - 0.5) * 30, ev.y + (Math.random() - 0.5) * 30, 26, true, ev.team, reduceMotion), 150 * i); if (!reduceMotion) this.shake = 12; }
          break;
        }
        case 'deploy': {
          this.beam(ev.x, ev.y, ev.heavy ? 9 : 5, 220, ev.heavy ? 0.7 : 0.45, TEAM_NUM[ev.team]);
          this.ring(ev.x, ev.y, 4, ev.heavy ? 40 : 24, ev.heavy ? 0.7 : 0.45, TEAM_NUM[ev.team], 0.9);
          if (ev.heavy) { for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28; this.smoke.emit(ev.x, 2, ev.y, Math.cos(a) * 40, 6, Math.sin(a) * 40, 1.1, 6, 18, 0.35, 0.32, 0.28, 0.55, 0, 2); } if (!reduceMotion) this.shake = Math.max(this.shake, 3.5); }
          break;
        }
        case 'capture': {
          const p = b.points.find(q => q.id === ev.point);
          if (p && ev.team !== null) { this.ring(p.x, p.y, POINT_RADIUS, POINT_RADIUS + 34, 0.9, TEAM_NUM[ev.team], 1, 2); this.beam(p.x, p.y, 6, 200, 0.8, TEAM_NUM[ev.team]); }
          break;
        }
        case 'heal': this.lines.push({ x1: ev.x1, y1: ev.y1, h1: 16, x2: ev.x2, y2: ev.y2, h2: 10, t: 0.4, T: 0.4, color: '#6fd3ef', width: 2, kind: 'heal' }); break;
        case 'ability': this.abilityFx(ev, reduceMotion); break;
      }
    }
  }

  private abilityFx(ev: Extract<BattleEvent, { type: 'ability' }>, reduceMotion: boolean) {
    switch (ev.ability) {
      case 'salvo':
        for (let i = 0; i < 6; i++) this.projs.push({ x1: ev.x, y1: ev.y, h1: 36, x2: ev.x2! + (Math.random() - 0.5) * ev.r, y2: ev.y2! + (Math.random() - 0.5) * ev.r, h2: 1, t: 0.25 + i * 0.09, T: 0.25 + i * 0.09, arc: 60, color: [1, 0.6, 0.25], trail: true, size: 5 });
        this.ring(ev.x2!, ev.y2!, ev.r, ev.r, 0.8, 0xffb36b, 0.8);
        break;
      case 'aegis': this.ring(ev.x, ev.y, ev.r * 0.2, ev.r, 0.6, ENERGY, 1); this.beam(ev.x, ev.y, ev.r, 50, 1.2, ENERGY); break;
      case 'railLance':
        this.lines.push({ x1: ev.x, y1: ev.y, h1: 40, x2: ev.x2!, y2: ev.y2!, h2: 20, t: 0.55, T: 0.55, color: '#9eeaff', width: 9, kind: 'beam' });
        if (!reduceMotion) this.shake = Math.max(this.shake, 5);
        break;
      case 'overclock': for (const v of this.units.values()) if (this.lastBattle?.ents.find(e => this.units.get(e.id) === v)?.team === ev.team && !v.structure) this.ring(v.x, v.y, 6, 16, 0.6, 0xffe08a, 0.9); break;
      case 'barrage': this.ring(ev.x, ev.y, ev.r, ev.r, 2.2, ev.team === 0 ? 0xf2a93b : 0xff6158, 0.8); for (let i = 0; i < 5; i++) this.projs.push({ x1: ev.x - 260, y1: ev.y + 300, h1: 400, x2: ev.x + (Math.random() - 0.5) * ev.r, y2: ev.y + (Math.random() - 0.5) * ev.r, h2: 1, t: 1.1 + i * 0.22, T: 1.1 + i * 0.22, arc: 0, color: [1, 0.7, 0.4], trail: true, size: 6 }); break;
      case 'emp': this.ring(ev.x, ev.y, 4, ev.r, 0.7, ENERGY, 1); this.ring(ev.x, ev.y, ev.r * 0.5, ev.r * 1.2, 0.9, 0xffffff, 0.5); for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = Math.random() * ev.r; this.glow.emit(ev.x + Math.cos(a) * d, 4 + Math.random() * 14, ev.y + Math.sin(a) * d, 0, 10, 0, 0.6, 3, 1, 0.45, 0.85, 1, 1); } break;
      case 'quake': this.ring(ev.x, ev.y, 10, ev.r * 1.2, 0.6, 0xff6158, 1); for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; this.smoke.emit(ev.x + Math.cos(a) * 20, 2, ev.y + Math.sin(a) * 20, Math.cos(a) * 70, 10, Math.sin(a) * 70, 0.9, 8, 20, 0.35, 0.3, 0.26, 0.6, 0, 2); } if (!reduceMotion) this.shake = Math.max(this.shake, 7); break;
    }
  }

  private lastBattle: Battle | null = null;

  // ------------------------------------------------------------------ frame

  draw(b: Battle, o: Overlay, dt: number) {
    this.lastBattle = b;
    this.time += dt;
    // Dynamic resolution: if frames stay slow for 3 s, render at a lower pixel ratio.
    if (dt > 0) {
      this.frameEma += (dt - this.frameEma) * 0.05;
      this.slowFor = this.frameEma > 1 / 28 ? this.slowFor + dt : 0;
      if (this.slowFor > 3 && this.dprCap > 1) { this.dprCap = Math.max(1, this.dprCap - 0.5); this.slowFor = 0; this.fit(...this.lastFit); }
    }
    this.syncUnits(b, dt);
    this.syncPoints(b);
    // Projectiles
    for (const p of this.projs) {
      p.t -= dt;
      const t = Math.min(1, 1 - p.t / p.T);
      const x = p.x1 + (p.x2 - p.x1) * t, y = p.y1 + (p.y2 - p.y1) * t, h = p.h1 + (p.h2 - p.h1) * t + Math.sin(t * Math.PI) * p.arc;
      this.glow.emit(x, h, y, 0, 0, 0, 0.05, p.size, p.size, p.color[0], p.color[1], p.color[2], 1);
      if (p.trail && Math.random() < 0.8) this.smoke.emit(x, h, y, 0, 2, 0, 0.5, 2, 6, 0.4, 0.38, 0.36, 0.45, 0, 1);
    }
    this.projs = this.projs.filter(p => p.t > 0);
    this.glow.update(dt); this.smoke.update(dt);
    for (const r of this.rings) if (r.t > 0) {
      r.t -= dt; const k = 1 - r.t / r.T;
      r.mesh.scale.setScalar(Math.max(0.01, r.r0 + (r.r1 - r.r0) * k));
      r.mesh.material.opacity = r.a * (1 - k);
      if (r.t <= 0) r.mesh.visible = false;
    }
    for (const bm of this.beams) if (bm.t > 0) { bm.t -= dt; bm.mesh.material.opacity = 0.5 * (bm.t / bm.T); if (bm.t <= 0) bm.mesh.visible = false; }
    for (const d of this.decals) if (d.visible) d.material.opacity = Math.max(0.25, d.material.opacity - dt * 0.02);
    for (const l of this.lights) if (l.t > 0) { l.t -= dt; l.light.intensity *= Math.pow(0.002, dt); if (l.t <= 0) l.light.intensity = 0; }
    this.updateUi(b, o);
    // Camera shake
    this.shake = Math.max(0, this.shake - dt * 16);
    this.camera.position.copy(this.camBase);
    if (this.shake > 0 && !o.reduceMotion) this.camera.position.add(new this.T.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0));
    this.gl.render(this.scene, this.camera);
    this.drawOverlay(b, o, dt);
  }

  private syncPoints(b: Battle) {
    const T = this.T;
    b.points.forEach((p, i) => {
      const v = this.points[i]; if (!v) return;
      const col = p.owner !== null ? TEAM_NUM[p.owner] : 0x8b95a1;
      if (v.lastOwner !== p.owner) {
        v.ring.material.color.setHex(col); v.beacon.material.color.setHex(col);
        v.beacon.material.opacity = p.owner !== null ? 0.22 : 0.08;
        v.gem.material.color.setHex(col); v.gem.material.emissive.setHex(col);
        v.lastOwner = p.owner;
      }
      v.gem.rotation.y = this.time * 1.2; v.gem.position.y = 38 + Math.sin(this.time * 2 + i) * 2;
      const capR = Math.round(p.cap);
      if (capR !== v.lastCap) {
        v.lastCap = capR;
        v.arc.geometry.dispose();
        const frac = Math.abs(p.cap) / 100;
        v.arc.geometry = frac > 0.005 ? new T.RingGeometry(POINT_RADIUS + 1.5, POINT_RADIUS + 5, 64, 1, Math.PI / 2, -Math.PI * 2 * frac).rotateX(-Math.PI / 2) : new T.BufferGeometry();
        v.arc.material.color.setHex(p.cap > 0 ? TEAM_NUM[0] : TEAM_NUM[1]);
      }
    });
  }

  private updateUi(b: Battle, o: Overlay) {
    const ui = this.ui;
    for (const k of ['range', 'rangeFill', 'minRange', 'select', 'reticle', 'reticleFill', 'lance']) ui[k].visible = false;
    ui.zone.visible = o.showZones;
    b.points.forEach((p, i) => { const m = ui.fwd[i]; if (!m) return; m.visible = o.showZones && p.owner === 0 && p.cap >= 100; m.position.set(p.x, 0.5, p.y); });
    const showRange = (x: number, y: number, r: number, color: number) => {
      ui.range.visible = ui.rangeFill.visible = true;
      ui.range.position.set(x, 0.7, y); ui.range.scale.setScalar(r); ui.range.material.color.setHex(color);
      ui.rangeFill.position.set(x, 0.65, y); ui.rangeFill.scale.setScalar(r); ui.rangeFill.material.color.setHex(color);
    };
    if (o.selectedId) {
      const e = b.ents.find(x => x.id === o.selectedId); const v = e && this.units.get(e.id);
      if (e && v) {
        ui.select.visible = true; ui.select.position.set(v.x, 0.8, v.y); ui.select.scale.setScalar(e.def.radius + 6);
        if (e.def.weapon) showRange(v.x, v.y, e.def.weapon.range + e.def.radius, TEAM_NUM[e.team]);
        else if (e.def.heal) showRange(v.x, v.y, e.def.heal.range, ENERGY);
        if (e.def.weapon?.minRange) { ui.minRange.visible = true; ui.minRange.position.set(v.x, 0.75, v.y); ui.minRange.scale.setScalar(e.def.weapon.minRange); }
      }
    }
    // Ghost
    if (o.ghost) {
      const g = o.ghost;
      if (!this.ghost || this.ghost.id !== g.unit) {
        if (this.ghost) this.scene.remove(this.ghost.group);
        const spec = this.model(g.unit, 0);
        const group = new this.T.Group();
        for (const geo of [spec.hull, spec.glow]) if (geo) group.add(new this.T.Mesh(geo, this.mats.ghostOk));
        for (const p of spec.parts) {
          const pg = new this.T.Group(); pg.position.set(...p.pivot);
          for (const geo of [p.hull, p.glow]) if (geo) pg.add(new this.T.Mesh(geo, this.mats.ghostOk));
          group.add(pg);
        }
        this.scene.add(group);
        this.ghost = { id: g.unit, group };
      }
      const mat = g.valid ? this.mats.ghostOk : this.mats.ghostBad;
      this.ghost.group.traverse((m: T3) => { if (m.isMesh) m.material = mat; });
      this.ghost.group.visible = true;
      this.ghost.group.position.set(g.x, this.model(g.unit, 0).hover, g.y);
      this.ghost.group.rotation.y = Math.PI / 2;
      const d = UNITS[g.unit];
      if (o.showRanges && (d.weapon || d.heal)) showRange(g.x, g.y, d.weapon?.range ?? d.heal!.range, g.valid ? (d.heal && !d.weapon ? ENERGY : TEAM_NUM[0]) : 0xff6158);
    } else if (this.ghost) this.ghost.group.visible = false;
    // Ability targeting
    if (o.targeting) {
      const t = o.targeting;
      const def = ABILITIES[t.ability as keyof typeof ABILITIES];
      if (t.ability === 'railLance' && t.fromX !== undefined) {
        const dx = t.x - t.fromX, dy = t.y - t.fromY!, L = Math.hypot(dx, dy) || 1;
        ui.lance.visible = true; ui.lance.scale.set(280, 1, 24);
        ui.lance.position.set(t.fromX + dx / L * 140, 0.9, t.fromY! + dy / L * 140);
        ui.lance.rotation.y = -Math.atan2(dy, dx);
      } else {
        const r = def?.radius ?? 40, col = t.ability === 'emp' ? ENERGY : 0xf2a93b;
        ui.reticle.visible = ui.reticleFill.visible = true;
        ui.reticle.position.set(t.x, 0.9, t.y); ui.reticle.scale.setScalar(r); ui.reticle.material.color.setHex(col);
        ui.reticleFill.position.set(t.x, 0.85, t.y); ui.reticleFill.scale.setScalar(r); ui.reticleFill.material.color.setHex(col);
        if (t.fromX !== undefined && t.ability === 'salvo') showRange(t.fromX, t.fromY!, 230, 0xffffff);
      }
    }
  }

  private drawOverlay(b: Battle, o: Overlay, dt: number) {
    const g = this.octx;
    g.clearRect(0, 0, this.cssW, this.cssH);
    // Tracers and beams
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (const l of this.lines) {
      l.t -= dt;
      const a = this.screen(l.x1, l.h1, l.y1), c = this.screen(l.x2, l.h2, l.y2);
      const k = Math.max(0, l.t / l.T);
      g.globalAlpha = k;
      if (l.kind === 'beam') { g.strokeStyle = l.color; g.lineWidth = l.width * k + 2; g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(c.sx, c.sy); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); }
      else if (l.kind === 'heal') { g.setLineDash([3, 4]); g.strokeStyle = l.color; g.lineWidth = l.width; g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(c.sx, c.sy); g.stroke(); g.setLineDash([]); }
      else { const grad = g.createLinearGradient(a.sx, a.sy, c.sx, c.sy); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, l.color); g.strokeStyle = grad; g.lineWidth = l.width; g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(c.sx, c.sy); g.stroke(); }
    }
    g.restore();
    this.lines = this.lines.filter(l => l.t > 0);
    // Health bars, pips, status
    for (const e of b.ents) {
      const v = this.units.get(e.id); if (!v) continue;
      const d = e.def;
      // Infantry bars appear only when damaged; everything else always shows a bar with its level.
      if (d.kind === 'infantry' && e.hp >= e.maxHp - 0.5 && e.aegis <= 0 && e.stun <= 0) continue;
      const p = this.screen(v.x, v.root.position.y + v.spec.height + 5, v.y);
      if (p.z > 1) continue;
      const big = d.kind === 'core' || d.kind === 'boss';
      const w = big ? 56 : d.hero ? 40 : d.kind === 'mech' ? 32 : d.kind === 'infantry' ? 12 : 24;
      const hgt = big || d.hero ? 5 : d.kind === 'infantry' ? 2.5 : 4;
      const frac = Math.max(0, e.hp / e.maxHp);
      const col = TEAM_HEX[e.team];
      const x0 = p.sx - w / 2 + (d.kind === 'infantry' ? 0 : 6);
      g.fillStyle = 'rgba(8,10,13,0.88)'; g.fillRect(x0 - 1, p.sy - 1, w + 2, hgt + 2);
      g.fillStyle = frac < 0.3 ? '#ff6158' : col; g.fillRect(x0, p.sy, w * frac, hgt);
      // Segment ticks: one per ~250 health, so big units read as big
      const segs = Math.max(2, Math.min(14, Math.round(e.maxHp / 250)));
      if (d.kind !== 'infantry') { g.fillStyle = 'rgba(8,10,13,0.9)'; for (let i = 1; i < segs; i++) g.fillRect(x0 + w * i / segs - 0.5, p.sy, 1, hgt); }
      // Level badge (hexagon) for everything except infantry
      if (d.kind !== 'infantry') {
        const r = big || d.hero ? 7.5 : 6, cx = x0 - r - 1, cy = p.sy + hgt / 2;
        g.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; i ? g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r) : g.moveTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); } g.closePath();
        g.fillStyle = 'rgba(8,10,13,0.92)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.4; g.stroke();
        g.fillStyle = col; g.font = `700 ${r + 2}px Bahnschrift, "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(d.kind === 'core' ? '◆' : String(e.level), cx, cy + 0.5);
      }
      if (d.hero || d.kind === 'boss') {
        g.font = '700 10px Bahnschrift, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillStyle = 'rgba(8,10,13,0.7)'; const tw = g.measureText(d.name).width; g.fillRect(x0 + w / 2 - tw / 2 - 3, p.sy - 13, tw + 6, 11);
        g.fillStyle = col; g.fillText(d.name, x0 + w / 2, p.sy - 2.5);
      }
      if (e.stun > 0) { g.strokeStyle = '#6fd3ef'; g.lineWidth = 1.4; g.beginPath(); for (let i = 0; i < 5; i++) g.lineTo(p.sx - 8 + i * 4, p.sy - 6 + (i % 2 ? -3 : 3)); g.stroke(); }
      if (e.aegis > 0) { const c = this.screen(v.x, v.spec.height * 0.5, v.y); g.strokeStyle = 'rgba(111,211,239,0.8)'; g.fillStyle = 'rgba(111,211,239,0.12)'; g.lineWidth = 1.2; g.beginPath(); g.arc(c.sx, c.sy, Math.max(12, d.radius * 1.6), 0, Math.PI * 2); g.fill(); g.stroke(); }
    }
    // Hardpoint markers: hexagon badges with capture progress
    for (const p of b.points) {
      const s = this.screen(p.x, 50, p.y);
      const c = p.owner !== null ? TEAM_HEX[p.owner] : '#c4ccd4';
      const hexPath = (r: number) => { g.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; i ? g.lineTo(s.sx + Math.cos(an) * r, s.sy + Math.sin(an) * r) : g.moveTo(s.sx + Math.cos(an) * r, s.sy + Math.sin(an) * r); } g.closePath(); };
      hexPath(15); g.fillStyle = 'rgba(8,10,13,0.82)'; g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      if (Math.abs(p.cap) > 0.5 && Math.abs(p.cap) < 100) { g.strokeStyle = p.cap > 0 ? TEAM_HEX[0] : TEAM_HEX[1]; g.lineWidth = 3; g.beginPath(); g.arc(s.sx, s.sy, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.abs(p.cap) / 100); g.stroke(); }
      g.fillStyle = c; g.font = '700 15px Bahnschrift, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.id, s.sx, s.sy + 0.5);
    }
    // Selected unit target line
    if (o.selectedId) {
      const e = b.ents.find(x => x.id === o.selectedId);
      const t = e?.targetId ? b.ents.find(x => x.id === e.targetId) : undefined;
      const ve = e && this.units.get(e.id), vt = t && this.units.get(t.id);
      if (ve && vt) { const a = this.screen(ve.x, ve.spec.height * 0.6, ve.y), c = this.screen(vt.x, vt.spec.height * 0.5, vt.y); g.setLineDash([4, 4]); g.strokeStyle = 'rgba(231,234,237,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(c.sx, c.sy); g.stroke(); g.setLineDash([]); g.strokeStyle = '#ff6158'; g.beginPath(); g.arc(c.sx, c.sy, 8, 0, Math.PI * 2); g.stroke(); }
    }
    // Ghost label
    if (o.ghost) {
      const s = this.screen(o.ghost.x, this.model(o.ghost.unit, 0).height + 12, o.ghost.y);
      g.font = '700 11px Bahnschrift, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const text = o.ghost.valid ? UNITS[o.ghost.unit].name.toUpperCase() : "CAN'T DEPLOY HERE";
      const tw = g.measureText(text).width;
      g.fillStyle = 'rgba(8,10,13,0.8)'; g.fillRect(s.sx - tw / 2 - 5, s.sy - 15, tw + 10, 15);
      g.fillStyle = o.ghost.valid ? TEAM_HEX[0] : '#ff6158'; g.fillText(text, s.sx, s.sy - 2);
    }
  }

  /** Renderer statistics for performance checks (draw calls, triangles, geometries). */
  stats() { const i = this.gl.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; }

  dispose() {
    for (const m of this.models.values()) for (const geo of [m.hull, m.glow, ...m.parts.flatMap(p => [p.hull, p.glow])]) geo?.dispose();
    this.models.clear();
    this.scene.traverse((o: T3) => { if (o.isMesh) { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m.map?.dispose(); m.dispose(); } } });
    this.glow.dispose(); this.smoke.dispose();
    this.gl.dispose();
    (this.gl as any).forceContextLoss?.();
  }
}

