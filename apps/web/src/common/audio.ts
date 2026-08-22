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

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

export const audio = new AudioManager();
