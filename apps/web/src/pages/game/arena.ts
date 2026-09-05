import type { CombatEvent, FightResult, Proc } from '@autobattle/shared';
import { audio } from '../../common/audio';
import { procLabel } from '../../common/procs';

/**
 * Replays a server-resolved fight. Everything is driven by the Web Animations
 * API on transform/opacity (composited, no layout work). Every "state"
 * animation (enter, death, revive) cancels the previous one on the same node,
 * so leftover fill-mode styles can never fight each other — that was the cause
 * of the flickering in v1 (display/visibility/opacity toggled from several timers).
 */

export interface ArenaElements {
  arena: HTMLElement;
  fx: HTMLElement;
  player: HTMLElement;
  enemy: HTMLElement;
  playerFill: HTMLElement;
  playerText: HTMLElement;
  enemyFill: HTMLElement;
  enemyText: HTMLElement;
  /** Deck bar: cards are found by `data-slot` and animated when they trigger. */
  jokers?: () => HTMLElement | null;
}

export interface PlaybackHandlers {
  onVictory: () => void;
  onDefeat: () => void;
}

interface Turn {
  primary: CombatEvent;
  extras: CombatEvent[];
}

const SECONDARY = new Set<CombatEvent['type']>(['execute', 'lifesteal', 'reflect', 'revive', 'boss', 'clutch']);
const LUNGE_MS = 420;
const TURN_MS = 680;
const IMPACT_AT = 0.45;

function groupTurns(events: CombatEvent[]): Turn[] {
  const turns: Turn[] = [];
  for (const e of events) {
    const last = turns[turns.length - 1];
    if (SECONDARY.has(e.type) && last) last.extras.push(e);
    else turns.push({ primary: e, extras: [] });
  }
  return turns;
}

function hpColor(ratio: number) {
  return ratio > 0.6 ? 'var(--hp)' : ratio > 0.3 ? 'var(--hp-mid)' : 'var(--hp-low)';
}

export class Arena {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private turns: Turn[] = [];
  private index = 0;
  private handlers: PlaybackHandlers | null = null;
  private playerMax = 1;
  private enemyMax = 1;
  private running = false;
  speed = 1;

  constructor(private readonly el: ArenaElements) {}

  destroy() {
    this.clearTimers();
  }

  get isFighting() {
    return this.running;
  }

  get isPaused() {
    return !this.running && this.handlers !== null;
  }

  private later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private clearTimers() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }

  // ---------------------------------------------------------------- health

  setPlayerHealth(hp: number, max: number) {
    this.playerMax = Math.max(1, max, hp);
    this.paint(this.el.playerFill, this.el.playerText, hp, this.playerMax);
  }

  setEnemyHealth(hp: number, max: number) {
    this.enemyMax = Math.max(1, max);
    this.paint(this.el.enemyFill, this.el.enemyText, hp, this.enemyMax);
  }

  private paint(fill: HTMLElement, text: HTMLElement, hp: number, max: number) {
    const ratio = Math.max(0, Math.min(1, hp / max));
    fill.style.transform = `scaleX(${ratio})`;
    fill.style.setProperty('--bar-color', hpColor(ratio));
    text.textContent = `${Math.max(0, hp).toLocaleString('fr-FR')} / ${max.toLocaleString('fr-FR')}`;
  }

  // ---------------------------------------------------------------- states

  /** Replace any running state animation on `node` by `frames`, keeping the end state. */
  private setState(node: HTMLElement, frames: Keyframe[], duration: number) {
    node.getAnimations().forEach((a) => a.cancel());
    node.animate(frames, { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
  }

  enemyEnter() {
    this.setState(
      this.el.enemy,
      [
        { opacity: 0, transform: 'translateY(-10px) scale(0.85)' },
        { opacity: 1, transform: 'none' },
      ],
      320,
    );
  }

  /** "Next enemy" placeholder. Fades in when it follows a death animation. */
  enemyIdle(fade = false) {
    this.setState(this.el.enemy, [{ opacity: fade ? 0 : 0.35, transform: 'none' }, { opacity: 0.35, transform: 'none' }], fade ? 300 : 1);
  }

  enemyDie() {
    this.setState(
      this.el.enemy,
      [
        { opacity: 1, transform: 'none', filter: 'brightness(1)' },
        { opacity: 0.9, transform: 'scale(1.08)', filter: 'brightness(2)', offset: 0.25 },
        { opacity: 0, transform: 'translateY(16px) scale(0.7)', filter: 'brightness(1)' },
      ],
      520,
    );
    this.later(() => this.enemyIdle(true), 900);
  }

  playerDie() {
    this.setState(this.el.player, [{ opacity: 1, filter: 'grayscale(0)' }, { opacity: 0.45, filter: 'grayscale(1)' }], 600);
  }

  playerReset() {
    this.setState(this.el.player, [{ opacity: 1, filter: 'grayscale(0)', transform: 'none' }], 1);
  }

  // -------------------------------------------------------------- playback

  play(fight: FightResult, playerMax: number, handlers: PlaybackHandlers) {
    this.clearTimers();
    this.turns = groupTurns(fight.events);
    this.index = 0;
    this.handlers = handlers;
    this.setPlayerHealth(fight.startHp, playerMax);
    this.setEnemyHealth(fight.enemy.maxHp, fight.enemy.maxHp);
    this.running = true;
    this.later(() => this.step(), 380 / this.speed);
  }

  pause() {
    this.running = false;
    this.clearTimers();
  }

  resume() {
    if (!this.handlers || this.running) return;
    this.running = true;
    this.later(() => this.step(), 150);
  }

  abort() {
    this.pause();
    this.handlers = null;
    this.turns = [];
  }

  /** Jump to the end of the current fight (the result is already known). */
  skip() {
    if (!this.handlers) return;
    this.clearTimers();
    const last = this.turns.at(-1);
    if (last) {
      const final = [last.primary, ...last.extras].at(-1)!;
      this.setPlayerHealth(final.playerHp, this.playerMax);
      this.setEnemyHealth(Math.max(0, final.enemyHp), this.enemyMax);
    }
    this.index = this.turns.length;
    this.finish();
  }

  private step() {
    if (!this.running) return;
    const turn = this.turns[this.index];
    if (!turn) return this.finish();

    const byPlayer = turn.primary.type === 'hit' ? turn.primary.by === 'player' : false;
    const attacker = byPlayer ? this.el.player : this.el.enemy;
    const target = byPlayer ? this.el.enemy : this.el.player;
    const lunge = LUNGE_MS / this.speed;

    const a = attacker.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const gap = t.left + t.width / 2 - (a.left + a.width / 2);
    const dx = gap - Math.sign(gap) * a.width * 1.05;
    attacker.querySelector<HTMLElement>('.token')!.animate(
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(${dx}px) scale(1.06)`, offset: IMPACT_AT },
        { transform: 'translateX(0)' },
      ],
      { duration: lunge, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
    );

    this.later(() => {
      this.index++;
      for (const e of [turn.primary, ...turn.extras]) this.apply(e);
      const last = [turn.primary, ...turn.extras].at(-1)!;
      if (last.enemyHp <= 0 || last.playerHp <= 0 || this.index >= this.turns.length) {
        this.later(() => this.finish(), lunge * (1 - IMPACT_AT));
        return;
      }
      this.later(() => this.step(), TURN_MS / this.speed - lunge * IMPACT_AT);
    }, lunge * IMPACT_AT);
  }

  /** Makes each triggered card jump and shows what it did, right on the card. */
  showProcs(procs: readonly Proc[] | undefined) {
    const bar = this.el.jokers?.();
    if (!bar || !procs?.length) return;
    const quick = this.speed > 2;
    for (const [i, p] of procs.entries()) {
      const tile = bar.querySelector<HTMLElement>(`[data-slot="${p.card}"]`);
      if (!tile) continue;
      tile.animate(
        [
          { transform: 'translateY(0) rotate(0)', boxShadow: '0 0 0 0 transparent' },
          { transform: 'translateY(-6px) rotate(-2deg) scale(1.04)', boxShadow: '0 0 0 2px var(--slot-color), 0 8px 24px color-mix(in srgb, var(--slot-color) 45%, transparent)', offset: 0.35 },
          { transform: 'translateY(0) rotate(0)', boxShadow: '0 0 0 0 transparent' },
        ],
        { duration: quick ? 320 : 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
      const label = document.createElement('div');
      label.className = 'proc-label';
      label.textContent = procLabel(p);
      label.style.animationDelay = `${i * 60}ms`;
      if (quick) label.style.animationDuration = '600ms';
      label.addEventListener('animationend', () => label.remove(), { once: true });
      tile.appendChild(label);
    }
  }

  private apply(e: CombatEvent) {
    this.showProcs(e.procs);
    const { player, enemy } = this.el;
    switch (e.type) {
      case 'hit': {
        const target = e.by === 'player' ? enemy : player;
        this.impact(target);
        this.float(target, e.crit ? `${e.damage.toLocaleString('fr-FR')}` : e.damage.toLocaleString('fr-FR'), e.crit ? 'crit' : e.by === 'player' ? 'dmg' : 'dmg-taken');
        audio.play(e.by === 'player' && e.crit ? 'crit' : 'hit');
        break;
      }
      case 'dodge':
        player.querySelector<HTMLElement>('.token')!.animate(
          [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-28px)', opacity: 0.4, offset: 0.4 }, { transform: 'none', opacity: 1 }],
          { duration: 360 / this.speed, easing: 'ease-out' },
        );
        this.float(player, 'Esquive', 'info');
        break;
      case 'execute':
        this.impact(enemy, true);
        this.float(enemy, 'Exécution', 'execute');
        break;
      case 'lifesteal':
        this.float(player, `+${e.amount.toLocaleString('fr-FR')}`, 'heal');
        break;
      case 'reflect':
        this.float(enemy, `-${e.damage.toLocaleString('fr-FR')}`, 'reflect');
        break;
      case 'boss':
        if (e.effect === 'thorns') this.float(player, `-${e.amount.toLocaleString('fr-FR')}`, 'dmg-taken');
        else if (e.effect === 'vampire') this.float(enemy, `+${e.amount.toLocaleString('fr-FR')}`, 'heal');
        else if (e.effect === 'thief') this.float(player, `-${e.amount} or`, 'reflect');
        break;
      case 'revive':
        this.playerReset();
        player.querySelector<HTMLElement>('.token')!.animate(
          [{ transform: 'scale(0.8)', filter: 'brightness(2.5)' }, { transform: 'scale(1)', filter: 'brightness(1)' }],
          { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
        this.float(player, 'Résurrection', 'revive');
        break;
      case 'clutch':
        player.querySelector<HTMLElement>('.token')!.animate(
          [{ transform: 'scale(0.9)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }],
          { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
        this.float(player, 'Sursis', 'revive');
        break;
    }
    this.setPlayerHealth(e.playerHp, this.playerMax);
    this.setEnemyHealth(Math.max(0, e.enemyHp), this.enemyMax);
  }

  private impact(target: HTMLElement, heavy = false) {
    const token = target.querySelector<HTMLElement>('.token')!;
    const d = heavy ? 10 : 6;
    token.animate(
      [
        { transform: 'translateX(0)', filter: 'brightness(1)' },
        { transform: `translateX(-${d}px)`, filter: 'brightness(1.9)', offset: 0.25 },
        { transform: `translateX(${d}px)`, offset: 0.6 },
        { transform: 'translateX(0)', filter: 'brightness(1)' },
      ],
      { duration: heavy ? 360 : 240, easing: 'ease-out' },
    );
    target
      .querySelector<HTMLElement>('.hp .bar')
      ?.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.6)' }, { transform: 'scaleY(1)' }], { duration: 220 });
  }

  /** Floating label above a fighter; removed when its CSS animation ends. */
  private float(target: HTMLElement, text: string, kind: string) {
    const arena = this.el.arena.getBoundingClientRect();
    const r = target.querySelector<HTMLElement>('.token')!.getBoundingClientRect();
    const node = document.createElement('div');
    node.className = `float float-${kind}`;
    node.textContent = text;
    node.style.left = `${r.left - arena.left + r.width / 2 + (Math.random() - 0.5) * 30}px`;
    node.style.top = `${r.top - arena.top - 34}px`;
    node.addEventListener('animationend', () => node.remove(), { once: true });
    this.el.fx.appendChild(node);
  }

  private finish() {
    const handlers = this.handlers;
    const last = this.turns.at(-1);
    this.running = false;
    this.handlers = null;
    this.clearTimers();
    if (!handlers || !last) return;
    const final = [last.primary, ...last.extras].at(-1)!;
    if (final.playerHp > 0 && final.enemyHp <= 0) handlers.onVictory();
    else handlers.onDefeat();
  }
}
