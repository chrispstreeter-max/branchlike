// Procedural audio: every sound is synthesised with WebAudio, so there are no
// audio files to license. Music is a slow generative pad. Volumes come from
// Settings and apply immediately.

type Sfx = 'click' | 'deploy' | 'deployHeavy' | 'shot' | 'shotHeavy' | 'shell' | 'blast' | 'bigBlast' | 'capture' | 'lost' | 'ability' | 'error' | 'victory' | 'defeat' | 'heal' | 'unlock';

export class Audio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer = 0;
  private lastPlay: Record<string, number> = {};
  sfxVol = 0.8;
  musicVol = 0.5;
  intensity = 0; // 0 menu .. 1 battle

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC() as AudioContext;
      const master = this.ctx.createDynamicsCompressor();
      master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(master);
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.setVolumes(this.sfxVol, this.musicVol);
      this.startMusic();
    } catch { this.ctx = null; }
  }

  get ready() { return !!this.ctx; }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx; this.musicVol = music;
    if (!this.ctx) return;
    this.sfxGain!.gain.setTargetAtTime(sfx * 0.6, this.ctx.currentTime, 0.05);
    this.musicGain!.gain.setTargetAtTime(music * 0.22, this.ctx.currentTime, 0.2);
  }

  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0) {
    const c = this.ctx!, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, freq: number, q = 0.8, when = 0) {
    const c = this.ctx!, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain!);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: Sfx) {
    if (!this.ctx || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const gap: Partial<Record<Sfx, number>> = { shot: 0.05, shotHeavy: 0.08, blast: 0.06, shell: 0.1, heal: 0.25 };
    if (gap[name] && now - (this.lastPlay[name] ?? 0) < gap[name]!) return;
    this.lastPlay[name] = now;
    switch (name) {
      case 'click': this.tone(1400, 0.05, 'square', 0.05); break;
      case 'deploy': this.tone(220, 0.25, 'sawtooth', 0.08, 660); this.burst(0.2, 0.15, 2000); break;
      case 'deployHeavy': this.tone(90, 0.6, 'sawtooth', 0.14, 45); this.burst(0.5, 0.35, 900, 1, 0.3); break;
      case 'shot': this.burst(0.05, 0.05, 3500 + Math.random() * 1500); break;
      case 'shotHeavy': this.burst(0.14, 0.14, 1400); this.tone(120, 0.1, 'square', 0.05, 60); break;
      case 'shell': this.tone(900, 0.5, 'sine', 0.025, 300); break;
      case 'blast': this.burst(0.35, 0.22, 700); break;
      case 'bigBlast': this.burst(0.9, 0.45, 500, 1.2); this.tone(60, 0.7, 'sine', 0.2, 30); break;
      case 'capture': this.tone(523, 0.12, 'triangle', 0.1); this.tone(784, 0.2, 'triangle', 0.1, undefined, 0.1); break;
      case 'lost': this.tone(392, 0.15, 'triangle', 0.1); this.tone(262, 0.25, 'triangle', 0.1, undefined, 0.12); break;
      case 'ability': this.tone(300, 0.4, 'sawtooth', 0.08, 1200); this.burst(0.3, 0.1, 5000); break;
      case 'heal': this.tone(880, 0.12, 'sine', 0.025, 1320); break;
      case 'error': this.tone(160, 0.15, 'square', 0.06); break;
      case 'unlock': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.08, undefined, i * 0.08)); break;
      case 'victory': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.09, undefined, i * 0.14)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.08, undefined, i * 0.18)); break;
    }
  }

  private startMusic() {
    if (!this.ctx) return;
    // Minor-key progression, root notes in Hz. Each chord holds ~6 seconds.
    const chords = [[110, 130.8, 164.8], [98, 123.5, 146.8], [87.3, 110, 130.8], [98, 123.5, 155.6]];
    let i = 0;
    const play = () => {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, dur = 6.5;
      const chord = chords[i++ % chords.length];
      for (const f of chord) {
        for (const det of [-4, 4]) {
          const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
          fl.type = 'lowpass'; fl.frequency.value = 400 + 500 * this.intensity; fl.Q.value = 0.5;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1);
          o.connect(fl); fl.connect(g); g.connect(this.musicGain!);
          o.start(t); o.stop(t + dur + 1.1);
        }
      }
      if (this.intensity > 0.5) {
        // low pulse in battle
        for (let k = 0; k < 12; k++) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.value = chord[0] / 2;
          const tt = t + k * 0.5;
          g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.08, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.35);
          o.connect(g); g.connect(this.musicGain!); o.start(tt); o.stop(tt + 0.4);
        }
      }
      this.musicTimer = globalThis.setTimeout(play, dur * 1000) as unknown as number;
    };
    play();
  }
}
