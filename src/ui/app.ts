import { browserKV, loadProfile, saveProfile, type KV, type LoadStatus } from '../meta/save.js';
import type { Profile } from '../meta/progression.js';
import { Audio } from '../audio/audio.js';
import { h } from './dom.js';

export interface Screen { el: HTMLElement; destroy?(): void; back?(): void }
export type ScreenFactory = (app: App) => Screen;

export class App {
  readonly root: HTMLElement;
  readonly kv: KV & { persistent?: boolean };
  profile: Profile;
  readonly loadStatus: LoadStatus;
  readonly audio = new Audio();
  private current: Screen | null = null;
  private toastTimer = 0;

  constructor(root: HTMLElement, kv?: KV) {
    this.root = root;
    this.kv = kv ?? browserKV();
    const { profile, status } = loadProfile(this.kv);
    this.profile = profile;
    this.loadStatus = status;
    this.applySettings();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.audio.suspend(); else this.audio.resume(); });
    // Android back gesture / browser back: route to the current screen's back action.
    try {
      history.replaceState({ b: 1 }, '');
      history.pushState({ b: 2 }, '');
      window.addEventListener('popstate', () => { try { history.pushState({ b: 2 }, ''); } catch { /* sandboxed */ } this.current?.back?.(); });
    } catch { /* history is unavailable in some embedded views */ }
  }

  /** The screen on show (read-only; use go() to change it). */
  get screen(): Screen | null { return this.current; }

  get persistent(): boolean { return (this.kv as { persistent?: boolean }).persistent !== false; }

  go(factory: ScreenFactory) {
    this.current?.destroy?.();
    const next = factory(this);
    this.root.replaceChildren(next.el);
    this.current = next;
    const focusable = next.el.querySelector<HTMLElement>('[data-autofocus]');
    focusable?.focus({ preventScroll: true });
  }

  save() {
    try { saveProfile(this.kv, this.profile); } catch { this.toast('Progress could not be saved on this device', true); }
  }

  applySettings() {
    const s = this.profile.settings;
    this.audio.setVolumes(s.sfx, s.music);
    document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
  }

  toast(message: string, bad = false) {
    this.root.querySelector('.toast.global')?.remove();
    const el = h('div', { class: `toast global${bad ? ' bad' : ''}`, role: 'status' }, message);
    this.root.append(el);
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.remove(), 2400);
  }

  click() { this.audio.play('click'); }
}
