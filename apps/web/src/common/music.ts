/**
 * Soundtrack. Every track is a variant of the same 205 s piece (same tempo and
 * length), so switching keeps the playback position and crossfades: the music
 * changes mood with the situation without restarting. Files live in
 * public/sounds (not versioned, see README). Plain <audio> elements stream the
 * files instead of decoding ~70 MB of PCM per track.
 */
export const TRACKS = ['main', 'shop', 'boss', 'celestial', 'arcana'] as const;
export type Track = (typeof TRACKS)[number];

export const TRACK_LABEL: Record<Track, string> = {
  main: 'Combat',
  shop: 'Boutique',
  boss: 'Boss',
  celestial: 'Boss final',
  arcana: 'Booster',
};

const FADE_MS = 1400;
const STEP_MS = 50;
const PREF_ON = 'autobattle.music';
const PREF_VOLUME = 'autobattle.musicVolume';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: not remembered */
  }
}

class MusicPlayer {
  enabled = read(PREF_ON) !== 'off';
  volume = clamp(Number(read(PREF_VOLUME) ?? 0.35));
  private muted = false;
  private started = false;
  private current: Track = 'main';
  private wanted: Track = 'main';
  private els = new Map<Track, HTMLAudioElement>();
  private fades = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>();
  private listeners = new Set<() => void>();

  get track(): Track {
    return this.wanted;
  }

  private get level() {
    return this.enabled && !this.muted ? this.volume : 0;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private el(track: Track) {
    let el = this.els.get(track);
    if (!el) {
      el = new Audio(`/sounds/${track}.m4a`);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      this.els.set(track, el);
    }
    return el;
  }

  private fade(el: HTMLAudioElement, target: number, done?: () => void) {
    clearInterval(this.fades.get(el));
    const from = el.volume;
    const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
    let i = 0;
    const id = setInterval(() => {
      i++;
      el.volume = clamp(from + ((target - from) * i) / steps);
      if (i >= steps) {
        clearInterval(id);
        this.fades.delete(el);
        done?.();
      }
    }, STEP_MS);
    this.fades.set(el, id);
  }

  /** Must run inside a user gesture (browsers block audio before one). */
  start() {
    if (this.started || this.level === 0) return;
    this.started = true;
    this.current = this.wanted;
    const el = this.el(this.current);
    // Changing page: pick the piece up where the previous page left it.
    const resume = readResume();
    if (resume !== null) el.currentTime = resume;
    el.play().then(
      () => this.fade(el, this.level),
      () => {
        this.started = false;
      },
    );
  }

  setTrack(track: Track) {
    if (track === this.wanted) return;
    this.wanted = track;
    this.emit();
    if (!this.started || this.level === 0 || track === this.current) return;
    const from = this.el(this.current);
    const to = this.el(track);
    to.currentTime = from.currentTime;
    to.volume = 0;
    this.current = track;
    void to.play().then(() => this.fade(to, this.level), () => {});
    this.fade(from, 0, () => {
      if (from !== this.el(this.current)) from.pause();
    });
  }

  private apply() {
    const el = this.el(this.current);
    if (this.level === 0) {
      this.fade(el, 0, () => el.pause());
    } else if (!this.started) {
      this.start();
    } else {
      if (this.wanted !== this.current) {
        this.el(this.current).pause();
        this.current = this.wanted;
      }
      const now = this.el(this.current);
      void now.play().then(() => this.fade(now, this.level), () => {});
    }
    this.emit();
  }

  /** Playback position, or null when nothing plays. */
  position(): number | null {
    const el = this.els.get(this.current);
    return el && this.started && !el.paused ? el.currentTime : null;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    write(PREF_ON, on ? 'on' : 'off');
    this.apply();
  }

  setVolume(v: number) {
    this.volume = clamp(v);
    write(PREF_VOLUME, String(this.volume));
    const el = this.els.get(this.current);
    if (el && this.started && !el.paused) {
      clearInterval(this.fades.get(el));
      el.volume = this.level;
    } else if (this.level > 0) {
      this.apply();
    }
    this.emit();
  }

  setMuted(muted: boolean) {
    if (muted === this.muted) return;
    this.muted = muted;
    if (this.started || !muted) this.apply();
  }
}

const PREF_POSITION = 'autobattle.musicPosition';

function readResume(): number | null {
  try {
    const raw = sessionStorage.getItem(PREF_POSITION);
    if (!raw) return null;
    const { t, at } = JSON.parse(raw) as { t: number; at: number };
    const elapsed = (Date.now() - at) / 1000;
    return elapsed < 30 ? (t + elapsed) % TRACK_SECONDS : null;
  } catch {
    return null;
  }
}

/** All variants last exactly this long (205.24 s). */
const TRACK_SECONDS = 205.2;

function clamp(v: number) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.35;
}

export const music = new MusicPlayer();

window.addEventListener('pagehide', () => {
  const t = music.position();
  if (t === null) return;
  try {
    sessionStorage.setItem(PREF_POSITION, JSON.stringify({ t, at: Date.now() }));
  } catch {
    /* not remembered */
  }
});
