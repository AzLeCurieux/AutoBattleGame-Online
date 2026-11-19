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
  /** Card level, raised at the camp (1 to 3, missing = 1). Each level adds 50 % to its effects. */
  stars?: number;
}

/** Steps of an act's route. Three times per act the player picks a path of 2-3 steps. */
export const NODE_KINDS = ['fight', 'elite', 'camp', 'event', 'treasure', 'shop', 'boss', 'skip'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface RouteNode {
  kind: NodeKind;
  /** Item granted by this node (skipping the elite), shown before choosing. */
  item?: ItemId;
}

/** Themed paths offered at each junction of the act. */
export const PATH_THEMES = ['battle', 'calm', 'mystery', 'market', 'challenge', 'bypass'] as const;
export type PathTheme = (typeof PATH_THEMES)[number];

export interface RoutePath {
  theme: PathTheme;
  steps: RouteNode[];
}

/** One-use items: bought in the shop, found in treasures, or earned by skipping the elite. */
export const ITEM_IDS = ['potion', 'whetstone', 'shield', 'luckyCoin', 'prism', 'compass'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** Effects waiting for the next fight (items). */
export interface Buffs {
  /** % extra damage. */
  damage?: number;
  /** % less damage taken. */
  shield?: number;
  /** Gold multiplier on the next kill. */
  gold?: number;
}

export type UpgradeOffer =
  | { kind: 'maxHp'; value: number }
  | { kind: 'damage'; value: number }
  | { kind: 'fullHeal' }
  | { kind: 'gold'; value: number }
  | { kind: 'critDamage'; value: number }
  | { kind: 'critChance'; value: number }
  | { kind: 'bossPassive'; passive: BossPassive }
  /** Camp: heal a share of max HP. */
  | { kind: 'heal'; percent: number }
  /** Treasure / event: receive an item. */
  | { kind: 'item'; item: ItemId }
  /** Event "Pari": lose a share of current HP, win gold. */
  | { kind: 'gamble'; hpPercent: number; gold: number }
  /** Event "Autel": lose a share of base max HP for good, gain one Forge level. */
  | { kind: 'sacrifice'; hpPercent: number }
  /** Event "Atelier": pay gold, a random card of the deck gets an edition. */
  | { kind: 'edition'; price: number }
  /** Event: walk away. */
  | { kind: 'leave' }
  /** Camp: raise a deck card to the next level (`index` in the deck). */
  | { kind: 'cardLevel'; index: number; cardId: string; level: number };

/**
 * Boss passives. The first three are plain bonuses; the others are pacts: a
 * stronger bonus with a drawback.
 */
export const BOSS_PASSIVES = ['regen', 'rage', 'vitality', 'fury', 'bulwark', 'greed'] as const;
export type BossPassive = (typeof BOSS_PASSIVES)[number];

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
  /** One item for sale (missing on shops saved before items existed). */
  item?: { item: ItemId; price: number; sold: boolean } | null;
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
  /** Deck mode: paths offered at a junction (null between junctions). */
  route?: RoutePath[] | null;
  /** Steps left on the chosen path; they start on their own. */
  plan?: RouteNode[];
  /** Item attached to the step being played (treasure, skipped elite). */
  nodeItem?: ItemId | null;
  /** Deck mode: the step being played (fight, elite, camp…), null between steps. */
  node?: NodeKind | null;
  /** Steps taken in the current act, in order (for the act track). */
  path?: NodeKind[];
  /** One-use items held (at most MAX_ITEMS). */
  items?: ItemId[];
  /** Item effects waiting for the next fight. */
  buffs?: Buffs;
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
