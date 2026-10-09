// The battle screen talks to a BattleView. Two implementations exist:
// the WebGL 3D renderer (default) and the original 2D canvas renderer (fallback
// for devices without WebGL, or if the 3D module fails to load).

import type { Battle, BattleEvent, Entity } from '../sim/battle.js';
import type { MapDef } from '../data/types.js';
import { Renderer, type Overlay } from './renderer.js';

export type { Overlay };

export interface BattleView {
  readonly kind: '3d' | '2d';
  /** Element that receives pointer events and is placed in the stage. */
  readonly el: HTMLElement;
  /** Size the view. `insets` are HUD areas (px) the battlefield should avoid. */
  fit(width: number, height: number, insets?: { top: number; bottom: number }): void;
  toWorld(clientX: number, clientY: number): { x: number; y: number; inside: boolean };
  overCanvas(clientX: number, clientY: number): boolean;
  pick(b: Battle, clientX: number, clientY: number): Entity | null;
  reset(map: MapDef): void;
  ingest(events: BattleEvent[], reduceMotion: boolean): void;
  draw(b: Battle, overlay: Overlay, dt: number): void;
  dispose(): void;
}

class View2D implements BattleView {
  readonly kind = '2d' as const;
  readonly el: HTMLCanvasElement;
  private r: Renderer;
  constructor() { this.el = document.createElement('canvas'); this.r = new Renderer(this.el); }
  fit(w: number, h: number) { this.r.fit(w, h); }
  toWorld(x: number, y: number) { return this.r.toWorld(x, y); }
  overCanvas(x: number, y: number) { return this.r.overCanvas(x, y); }
  pick(b: Battle, x: number, y: number) { return this.r.pick(b, x, y); }
  reset(map: MapDef) { this.r.reset(map); }
  ingest(ev: BattleEvent[], rm: boolean) { this.r.ingest(ev, rm); }
  draw(b: Battle, o: Overlay, dt: number) { this.r.draw(b, o, dt); }
  dispose() { /* nothing to free */ }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** Create the best available view. Never rejects: falls back to 2D. */
export async function createBattleView(quality: 'high' | 'low', force2d = false): Promise<BattleView> {
  if (!force2d && webglAvailable()) {
    try {
      const url = new URL('../vendor/three.module.min.js', import.meta.url).href;
      const THREE = await import(/* @vite-ignore */ url);
      const { View3D } = await import('./renderer3d.js');
      return new View3D(THREE, quality);
    } catch (e) {
      console.warn('3D renderer unavailable, using 2D fallback', e);
    }
  }
  return new View2D();
}
