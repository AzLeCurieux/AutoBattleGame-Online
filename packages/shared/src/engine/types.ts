import type { BossId } from '../bosses.js';
import type { CaseId } from '../cases.js';
import type { CardEffectKind } from '../effects.js';
import type { EnemyKind } from '../rules.js';

export const MODIFIER_IDS = ['foil', 'holographic', 'polychrome', 'negative'] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

export interface DeckCard {
  cardId: string;
  modifier: ModifierId | null;
  /** Price paid, used to compute the sell-back value. */
  price: number;
}

export type UpgradeOffer =
  | { kind: 'maxHp'; value: number }
  | { kind: 'damage'; value: number }
  | { kind: 'fullHeal' }
  | { kind: 'gold'; value: number }
  | { kind: 'critDamage'; value: number }
  | { kind: 'critChance'; value: number }
  | { kind: 'bossPassive'; passive: BossPassive };

export type BossPassive = 'regen' | 'rage' | 'vitality';

export interface ShopItem {
  cardId: string;
  modifier: ModifierId | null;
  price: number;
  sold: boolean;
}

/** Booster packs sold in the shop. Opening one lets the player pick among random options. */
export const PACK_KINDS = ['combat', 'mega', 'training', 'shiny'] as const;
export type PackKind = (typeof PACK_KINDS)[number];

/** Permanent run upgrades bought in the shop (one offered per visit). */
export const PERK_IDS = ['bigShop', 'discount', 'freeReroll', 'vault', 'satchel', 'flair', 'medic', 'stuffedPacks'] as const;
export type PerkId = (typeof PERK_IDS)[number];

export interface PackOffer {
  kind: PackKind;
  price: number;
  sold: boolean;
}

export interface PerkOffer {
  perk: PerkId;
  price: number;
  sold: boolean;
}

export interface ShopState {
  cards: ShopItem[];
  packs: PackOffer[];
  perk: PerkOffer | null;
  /** Price of the next card reroll. Grows by 1 per reroll, reset every shop. */
  rerollCost: number;
  /** Gold earned as interest when this shop opened (shown in the UI). */
  interest: number;
}

export type PackOption = { type: 'card'; cardId: string; modifier: ModifierId | null } | { type: 'stat'; offer: UpgradeOffer };

export interface OpenPack {
  kind: PackKind;
  options: PackOption[];
  /** Options already taken (indexes), for packs that allow several picks. */
  taken: number[];
  picksLeft: number;
}

export type RunPhase = 'ready' | 'upgrade' | 'shop' | 'pack' | 'dead';

/** 'deck': cards bought in the in-run shop. 'classic': no cards, no shop — upgrades only. */
export const GAME_MODES = ['deck', 'classic'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export interface RunState {
  version: 1;
  /** Missing on runs saved before modes existed: treat as 'deck'. */
  mode: GameMode;
  phase: RunPhase;
  /** Number of enemies defeated. The next enemy is stage `level + 1`. */
  level: number;
  gold: number;
  /** Base stats from upgrades only — cards are applied on top by computeStats(). */
  base: { maxHp: number; damage: number; critChance: number; critDamage: number };
  hp: number;
  deck: DeckCard[];
  bossPassives: BossPassive[];
  critUpgrades: number;
  casesFound: number;
  reviveUsed: boolean;
  offer: UpgradeOffer[] | null;
  shop: ShopState | null;
  /** Booster being opened (phase 'pack'). */
  pack: OpenPack | null;
  perks: PerkId[];
  /** Times the Forge was bought (+8 % damage each). */
  forge: number;
  /** Difficulty tier (deck mode), 1 = base rules. */
  palier?: number;
  /** Deck mode: boss waiting at the end of the current act. */
  nextBoss: BossId | null;
  /** The run beat the last act; it continues in endless mode. */
  won: boolean;
  /** Act in which the boss was last swapped (once per act). */
  bossRerollAct: number;
  stats: { kills: number; bossKills: number; damageDealt: number; goldEarned: number };
  startedAt: number;
  /** PRNG state. Never sent to clients. */
  rng: number;
}

export type PublicRunState = Omit<RunState, 'rng'>;

export interface EnemyInfo {
  stage: number;
  act: number;
  kind: EnemyKind;
  bossId: BossId | null;
  isBoss: boolean;
  maxHp: number;
  damage: number;
}

/** A deck card that triggered: its slot in the deck, which effect, and how much it did. */
export interface Proc {
  card: number;
  kind: CardEffectKind;
  amount?: number;
}

export type CombatEvent = (
  | {
      type: 'hit';
      by: 'player' | 'enemy';
      damage: number;
      crit: boolean;
      playerHp: number;
      enemyHp: number;
    }
  | { type: 'dodge'; playerHp: number; enemyHp: number }
  | { type: 'execute'; damage: number; playerHp: number; enemyHp: number }
  | { type: 'lifesteal'; amount: number; playerHp: number; enemyHp: number }
  | { type: 'reflect'; damage: number; playerHp: number; enemyHp: number }
  | { type: 'revive'; playerHp: number; enemyHp: number }
  /** "Sursis": a lethal boss hit left the player at 1 HP. */
  | { type: 'clutch'; playerHp: number; enemyHp: number }
  /** Boss rule kicking in (thorns damage, vampire heal, gold stolen…). */
  | { type: 'boss'; effect: BossId; amount: number; playerHp: number; enemyHp: number }
) & {
  /** Cards that triggered on this event. */
  procs?: Proc[];
  /** Player hit: second strike granted by a double-strike card. */
  extra?: boolean;
};

export interface CaseDrop {
  caseId: CaseId;
}

export interface KillReward {
  gold: number;
  healed: number;
  cases: CaseDrop[];
  /** Set when the kill was an act boss. */
  actCleared: number | null;
  /** True the first time the last act is beaten. */
  victory: boolean;
  /** Cards that triggered on the kill (heal, gold…). */
  procs?: Proc[];
}

export interface FightResult {
  enemy: EnemyInfo;
  startHp: number;
  /** HP restored right before a boss fight. */
  restHp: number;
  events: CombatEvent[];
  outcome: 'victory' | 'defeat';
  reward: KillReward | null;
}
