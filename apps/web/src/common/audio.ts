/** AudioManager.js from v1: small synthesized WebAudio sounds. Ctrl+M toggles. */
type SoundName = 'hit' | 'crit' | 'heal' | 'levelUp' | 'button';

const SOUNDS: Record<SoundName, { from: number; to: number; ramp: 'exp' | 'lin'; gain: number; duration: number }> = {
  hit: { from: 200, to: 100, ramp: 'exp', gain: 0.3, duration: 0.1 },
  crit: { from: 400, to: 800, ramp: 'exp', gain: 0.5, duration: 0.2 },
  heal: { from: 300, to: 500, ramp: 'lin', gain: 0.4, duration: 0.3 },
  levelUp: { from: 200, to: 600, ramp: 'lin', gain: 0.6, duration: 0.5 },
  button: { from: 800, to: 400, ramp: 'exp', gain: 0.2, duration: 0.05 },
};

class AudioManager {
  enabled = true;
  volume = 0.5;
  private ctx: AudioContext | null = null;

  play(name: SoundName) {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    const s = SOUNDS[name];
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(s.from, t);
    if (s.ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(s.to, t + s.duration);
    else osc.frequency.linearRampToValueAtTime(s.to, t + s.duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(this.volume * s.gain, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + s.duration);
    osc.start(t);
    osc.stop(t + s.duration);
  }

  // ------------------------------------------------------------ case opening

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private noiseBuffer: AudioBuffer | null = null;
  private noise(ctx: AudioContext) {
    if (!this.noiseBuffer) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = b;
    }
    return this.noiseBuffer;
  }

  /** One enveloped oscillator note. */
  private note(ctx: AudioContext, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'triangle', slideTo?: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(this.volume * gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Filtered noise: whooshes, shimmer, impacts. */
  private burst(ctx: AudioContext, at: number, dur: number, gain: number, from: number, to: number, kind: BiquadFilterType = 'bandpass') {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = kind;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(this.volume * gain, at + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  /** Card passing under the marker. */
  tick(pitch = 1) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.note(ctx, 1900 * pitch, t, 0.03, 0.09, 'square');
    this.burst(ctx, t, 0.03, 0.05, 5000, 3000, 'highpass');
  }

  /** Reels start spinning. */
  spinStart() {
    const ctx = this.context();
    if (!ctx) return;
    this.burst(ctx, ctx.currentTime, 0.45, 0.25, 300, 2400);
  }

  /** A reel stops on its card: a short cue that already hints at the rarity. */
  reelStop(tier: number) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = [392, 440, 494, 523, 587, 659, 784][tier] ?? 392;
    this.note(ctx, base, t, 0.18 + tier * 0.04, 0.25 + tier * 0.03, tier >= 4 ? 'sawtooth' : 'triangle');
    if (tier >= 3) this.note(ctx, base * 1.5, t + 0.05, 0.25, 0.18);
    if (tier >= 5) this.note(ctx, 70, t, 0.4, 0.5, 'sine', 40);
  }

  /**
   * Reveal sting, bigger with each rarity tier (0 = Consumer … 6 = Gold):
   * from a single chime to booms, a sustained chord, rising arpeggios and bells.
   */
  reveal(tier: number) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    // C major pentatonic, from C5 upwards.
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02];
    const steps = [1, 2, 3, 4, 6, 8, 12][tier] ?? 1;
    const gap = tier >= 5 ? 0.055 : 0.075;
    for (let i = 0; i < steps; i++) this.note(ctx, scale[i]!, t + i * gap, 0.35 + tier * 0.05, 0.22 + tier * 0.02, i % 2 ? 'sine' : 'triangle');
    if (tier >= 3) {
      // Shimmer on top.
      this.burst(ctx, t, 0.9 + tier * 0.2, 0.05 + tier * 0.02, 6000, 12000, 'highpass');
    }
    if (tier >= 4) {
      // Low impact.
      this.note(ctx, 110, t, 0.6, 0.6, 'sine', 38);
      this.burst(ctx, t, 0.35, 0.35, 900, 120, 'lowpass');
    }
    if (tier >= 5) {
      // Sustained chord under the arpeggio.
      for (const f of [261.63, 329.63, 392, 493.88]) this.note(ctx, f, t + 0.05, 1.6 + (tier - 5) * 1.2, 0.07, 'sawtooth');
      this.note(ctx, 55, t + 0.02, 1.2, 0.5, 'sine', 30);
    }
    if (tier >= 6) {
      // Timpani roll, second wave of bells, sparkles raining down for two seconds.
      for (let i = 0; i < 4; i++) this.note(ctx, 90 - i * 8, t + 0.25 + i * 0.12, 0.5, 0.35, 'sine', 35);
      for (let i = 0; i < 8; i++) this.note(ctx, scale[12 - i]!, t + 0.8 + i * 0.07, 0.6, 0.14, 'sine');
      for (let i = 0; i < 18; i++) this.note(ctx, 2000 + Math.random() * 3000, t + 1 + Math.random() * 2, 0.25, 0.06, 'sine');
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

export const audio = new AudioManager();
