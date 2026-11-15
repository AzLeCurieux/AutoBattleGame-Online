import type { BossId } from '@autobattle/shared';
import type { Palette, Rgb, ShaderFx } from '../../common/shader';

/**
 * Background of each boss: colours plus the shape of the swirl, so the arena
 * already tells which rule is about to bend before reading the banner.
 */
export interface BossTheme {
  palette: Palette;
  fx: Partial<ShaderFx>;
}

const rgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
});
const pal = (a: string, b: string, c: string): Palette => [rgb(a), rgb(b), rgb(c)];

export const BOSS_THEME: Record<BossId, BossTheme> = {
  // Heavy, slow, earthy: a mountain that barely moves.
  colossus: { palette: pal('#a0703c', '#4a3524', '#120c08'), fx: { speed: 0.45, spin: 0.12, contrast: 2.4, pulse: 0.08, beat: 'wave', rate: 0.25 } },
  // Gold coins on dark green, grainy like an old treasure map.
  thief: { palette: pal('#e2b23a', '#1f4a2e', '#07110a'), fx: { speed: 1.1, spin: 0.45, contrast: 3.4, pixel: 3, pulse: 0.06, beat: 'wave', rate: 0.8 } },
  // Electric blue, very fast, with lightning flashes.
  swift: { palette: pal('#7fe3ff', '#1d4fd8', '#040a1f'), fx: { speed: 2.6, spin: 0.55, contrast: 3.6, pulse: 0.35, beat: 'flash', rate: 0.7 } },
  // Blood and fire, a beat that speeds up as the fight drags on.
  berserk: { palette: pal('#ff5a1f', '#8a0c0c', '#1a0303'), fx: { speed: 1.6, spin: 0.5, contrast: 3.8, pulse: 0.22, beat: 'rage', rate: 1.1 } },
  // Cold steel plates: blocky, high contrast, mechanical.
  armored: { palette: pal('#9fb3c8', '#3c4a5a', '#0b0f14'), fx: { speed: 0.7, spin: 0.2, contrast: 5, pixel: 6, pulse: 0.05, beat: 'wave', rate: 0.4 } },
  // Pale ice, almost still: nothing moves him.
  stoic: { palette: pal('#b9cfe8', '#4f6788', '#0e1420'), fx: { speed: 0.25, spin: 0.04, contrast: 2, saturation: 0.7, pulse: 0.04, beat: 'wave', rate: 0.15 } },
  // Washed-out violet, close to silence.
  silencer: { palette: pal('#8b7fa8', '#2c2638', '#08070b'), fx: { speed: 0.5, spin: 0.25, contrast: 2.6, saturation: 0.25, pulse: 0.05, beat: 'wave', rate: 0.2 } },
  // Deep crimson that throbs like a heartbeat.
  vampire: { palette: pal('#c0123c', '#3d0618', '#0a0105'), fx: { speed: 0.9, spin: 0.35, contrast: 3.2, pulse: 0.3, beat: 'heart', rate: 0.9 } },
  // Toxic green brambles, tightly twisted.
  thorns: { palette: pal('#7ad62a', '#1f4d14', '#050d03'), fx: { speed: 1.3, spin: 0.75, contrast: 4.2, pixel: 2, pulse: 0.1, beat: 'wave', rate: 0.6 } },
};
