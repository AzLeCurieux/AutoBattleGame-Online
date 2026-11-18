import { Music } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { music, TRACK_LABEL, type Track } from '../../common/music';

const subscribe = (fn: () => void) => music.subscribe(fn);
const snapshot = () => `${music.enabled}|${music.volume}|${music.track}`;

/** Compact soundtrack control for the navbar: on/off and volume. */
export function MusicControl() {
  useSyncExternalStore(subscribe, snapshot);
  const label = `Musique · ${TRACK_LABEL[music.track]}`;
  return (
    <div className={`music-ctl ${music.enabled ? '' : 'off'}`} title={label}>
      <button
        className="btn btn-sm btn-ghost btn-icon"
        aria-label={music.enabled ? 'Couper la musique' : 'Lancer la musique'}
        aria-pressed={music.enabled}
        onClick={() => music.setEnabled(!music.enabled)}
      >
        <Music className="icon" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={music.volume}
        aria-label="Volume de la musique"
        onChange={(e) => music.setVolume(Number(e.target.value))}
      />
    </div>
  );
}

/** Starts the soundtrack on the first gesture and follows the situation. */
export function useSoundtrack(track: Track, muted: boolean) {
  useEffect(() => {
    const kick = () => music.start();
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);
  useEffect(() => music.setMuted(muted), [muted]);
  useEffect(() => music.setTrack(track), [track]);
}
