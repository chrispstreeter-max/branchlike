// Small standalone 3D viewer for one unit: used by the hangar turntable and by the
// design-sheet tool. Loads Three.js on demand, shares the battlefield models and
// walk cycle, and cleans up after itself.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildModel, assemble, type ModelSpec, type AnimPart } from './models3d.js';

type T3 = any;
let threeP: Promise<T3> | null = null;
export function loadThree(): Promise<T3> {
  threeP ??= import(/* @vite-ignore */ new URL('../vendor/three.module.min.js', import.meta.url).href);
  return threeP;
}

export interface PreviewOpts { team?: 0 | 1; walk?: boolean; spin?: boolean; angle?: number; background?: number | null; floor?: boolean; fill?: number }

export class UnitPreview {
  private renderer: T3; private scene: T3; private camera: T3; private root: T3 | null = null;
  private rig: { g: T3; part: AnimPart }[] = [];
  private spec: ModelSpec | null = null;
  private raf = 0; private t0 = performance.now(); private floor: T3;
  constructor(private T: T3, private canvas: HTMLCanvasElement, private opts: PreviewOpts = {}) {
    const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: opts.background === null || opts.background === undefined });
    r.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    if (opts.background != null) r.setClearColor(opts.background, 1); else r.setClearColor(0, 0);
    this.renderer = r;
    this.scene = new T.Scene();
    this.scene.add(new T.HemisphereLight(0xdfe8f5, 0x3a3128, 1.4));
    const sun = new T.DirectionalLight(0xfff1dc, 2.4); sun.position.set(60, 120, 80); this.scene.add(sun);
    const rim = new T.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(-80, 60, -60); this.scene.add(rim);
    const floor = new T.Mesh(new T.CircleGeometry(40, 48), new T.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9, transparent: true, opacity: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    const ring = new T.Mesh(new T.RingGeometry(38, 40, 6), new T.MeshBasicMaterial({ color: 0xe8962a, transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    this.floor = new T.Group(); this.floor.add(floor, ring);
    if (opts.floor !== false) this.scene.add(this.floor);
    this.camera = new T.PerspectiveCamera(30, 1, 1, 2000);
  }

  show(id: string) {
    const T = this.T;
    if (this.root) this.scene.remove(this.root);
    const spec = buildModel(T, id, this.opts.team ?? 0);
    const hull = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.35 });
    const glow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const a = assemble(T, spec, (geo, g) => new T.Mesh(geo, g ? glow : hull));
    this.root = a.root; this.spec = spec;
    this.rig = a.nodes.filter(n => ['hip', 'knee', 'foot', 'arm', 'torso'].includes(n.part.role));
    this.root.position.y = spec.hover;
    this.scene.add(this.root);
    // Frame the model: fit its bounding box.
    const box = new T.Box3().setFromObject(this.root);
    const size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
    const r = Math.max(size.x, size.y, size.z) * (this.opts.fill ?? 0.62) + 4;
    this.floor.scale.setScalar(Math.max(0.4, Math.max(size.x, size.z) / 50));
    const dist = r / Math.tan((this.camera.fov / 2) * Math.PI / 180);
    this.camera.position.set(c.x + dist * 0.55, c.y + dist * 0.32, c.z + dist * 0.78);
    this.camera.lookAt(c.x, c.y * 0.92, c.z);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** Render one frame at time t (seconds). */
  frame(t: number) {
    if (!this.root || !this.spec) return;
    const walk = this.opts.walk ?? true, kd = this.spec.kneeDir ?? 1;
    const ph = t * 3.2, g = walk ? 1 : 0;
    for (const n of this.rig) {
      const p = n.part, q = ph + (p.phase ?? 0), rest = p.rest ?? [0, 0, 0];
      const hipD = Math.sin(q) * 0.42 * g, kneeD = -kd * Math.max(0, Math.cos(q)) * 0.8 * g;
      if (p.role === 'hip') n.g.rotation.z = rest[2] + hipD;
      else if (p.role === 'knee') n.g.rotation.z = rest[2] + kneeD;
      else if (p.role === 'foot') n.g.rotation.z = rest[2] - hipD - kneeD;
      else if (p.role === 'arm') n.g.rotation.z = rest[2] - Math.sin(q) * 0.3 * g;
      else if (p.role === 'torso') { n.g.rotation.x = Math.sin(ph) * 0.04 * g; n.g.rotation.y = Math.sin(ph) * 0.06 * g; }
    }
    this.root.position.y = this.spec.hover - (this.spec.hipY ? Math.abs(Math.sin(ph)) * this.spec.hipY * 0.07 * g : 0);
    this.root.rotation.y = (this.opts.angle ?? -0.5) + ((this.opts.spin ?? true) ? t * 0.5 : 0);
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    const loop = () => { this.frame((performance.now() - this.t0) / 1000); this.raf = requestAnimationFrame(loop); };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o: T3) => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: T3) => m.dispose()); });
    this.renderer.dispose();
  }
}
