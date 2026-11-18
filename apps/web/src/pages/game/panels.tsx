import {
  computeStats,
  deckLimit,
  healCost,
  ITEMS,
  PASSIVE_RULES,
  passivePower,
  runMode,
  type NodeKind,
  type BossPassive,
  PALIERS,
  RULES,
  type GameMode,
  type InventoryCase,
  type LeaderboardSnapshot,
  type ModifierId,
  type ProfileStats,
  type PublicRunState,
  type PublicUser,
  type UpgradeOffer,
} from '@autobattle/shared';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpCircle,
  Anvil,
  Dices,
  DoorOpen,
  Gem,
  HandCoins,
  HelpCircle,
  ShieldPlus,
  Swords as SwordsIcon,
  Wand2,
  BarChart3,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  Lock,
  Mountain,
  Heart,
  HeartPulse,
  Layers,
  Package,
  Play,
  Shield,
  ShoppingBag,
  Skull,
  Sparkles,
  Swords,
  Target,
  Tent,
  Trophy,
  TrendingUp,
  User,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { avatarUrl } from '../../common/avatar';
import { CARD_COLORS, CASE_ORDER, caseMeta, cardMeta, MODIFIER_META } from '../../common/catalog';
import { useCardHover } from '../../ui/CardHover';
import { Bar, cssVars, hpColor, Modal, Panel, Tabs } from '../../ui/components';

const fmt = (n: number) => n.toLocaleString('fr-FR');

// ---------------------------------------------------------------- history

export type HistoryKind = 'start' | 'level' | 'boss' | 'gold' | 'upgrade' | 'heal' | 'passive' | 'case' | 'shop' | 'death' | 'record' | 'card';
export interface HistoryEntry {
  kind: HistoryKind;
  message: string;
  time: string;
}
const HISTORY_ICON: Record<HistoryKind, [LucideIcon, string]> = {
  start: [Play, 'var(--primary)'],
  level: [TrendingUp, 'var(--muted)'],
  boss: [Crown, '#fbbf24'],
  gold: [Coins, 'var(--accent)'],
  upgrade: [ArrowUpCircle, '#a5b4fc'],
  heal: [HeartPulse, 'var(--success)'],
  passive: [Sparkles, '#c4b5fd'],
  case: [Package, 'var(--accent)'],
  shop: [ShoppingBag, '#93c5fd'],
  death: [Skull, 'var(--danger)'],
  record: [Trophy, '#fbbf24'],
  card: [Layers, '#f0abfc'],
};

export function LogLine({ entry }: { entry: HistoryEntry }) {
  const [Icon, color] = HISTORY_ICON[entry.kind];
  return (
    <div className="log-line" style={cssVars({ '--log-color': color })}>
      <Icon className="icon" />
      <span className="time">{entry.time}</span>
      <span>{entry.message}</span>
    </div>
  );
}

// ------------------------------------------------------------------ texts

export const MODE_INFO: Record<GameMode, { label: string; icon: LucideIcon; description: string }> = {
  deck: {
    label: 'Deck',
    icon: Layers,
    description: '8 actes de 10 niveaux : élite au 5, boss à effet au 10, boutique après le boss. Bats le boss de l’acte 8 pour gagner et débloquer le palier suivant.',
  },
  classic: {
    label: 'Classique',
    icon: Swords,
    description: 'Aucune carte, aucune boutique : seulement tes améliorations et les passifs de boss. Classement séparé.',
  },
};

export function upgradeInfo(offer: UpgradeOffer, mode: GameMode = 'deck'): { title: string; value?: string; text: string; icon: LucideIcon; color: string } {
  switch (offer.kind) {
    case 'maxHp':
      return { title: 'Vie maximale', value: `+${offer.value}`, text: 'Augmente tes PV max.', icon: Heart, color: '#f87171' };
    case 'damage':
      return { title: 'Dégâts', value: `+${offer.value}`, text: 'Augmente tes dégâts de base.', icon: Swords, color: '#fb923c' };
    case 'fullHeal':
      return { title: 'Soin complet', text: 'Restaure tous tes PV.', icon: HeartPulse, color: '#4ade80' };
    case 'gold':
      return { title: 'Or', value: `+${offer.value}`, text: 'Ajoute de l’or à ta bourse.', icon: Coins, color: '#f5b244' };
    case 'critDamage':
      return { title: 'Dégâts critiques', value: `+${offer.value} %`, text: 'Tes coups critiques frappent plus fort.', icon: Zap, color: '#facc15' };
    case 'critChance':
      return { title: 'Chance critique', value: `+${offer.value} %`, text: 'Plus de coups critiques.', icon: Target, color: '#a78bfa' };
    case 'bossPassive':
      return { ...PASSIVE_INFO[offer.passive], text: passiveText(offer.passive, mode), color: PASSIVE_INFO[offer.passive].pact ? '#f472b6' : '#fbbf24' };
    case 'heal':
      return { title: 'Se reposer', value: `+${offer.percent} %`, text: 'Rend une part de tes PV max.', icon: HeartPulse, color: '#4ade80' };
    case 'item':
      return { title: ITEMS[offer.item].name, text: ITEMS[offer.item].text, icon: Gem, color: '#c084fc' };
    case 'gamble':
      return { title: 'Pari', value: `+${offer.gold} or`, text: `Tu perds ${offer.hpPercent} % de tes PV actuels.`, icon: Dices, color: '#f5b244' };
    case 'sacrifice':
      return { title: 'Autel de la Forge', value: '+1 Forge', text: `+8 % de dégâts pour la partie, mais -${offer.hpPercent} % de PV max de base, définitivement.`, icon: Anvil, color: '#f87171' };
    case 'edition':
      return { title: 'Atelier', value: `${offer.price} or`, text: 'Une carte du deck sans édition en reçoit une au hasard.', icon: Wand2, color: '#38bdf8' };
    case 'leave':
      return { title: 'Passer son chemin', text: 'Ne rien faire.', icon: DoorOpen, color: '#94a3b8' };
  }
}

/** Title of the choice window, depending on the step being played. */
const STEP_TITLE: Partial<Record<NodeKind, { title: string; subtitle: string; icon: LucideIcon }>> = {
  camp: { title: 'Camp', subtitle: 'Repos ou entraînement : un seul choix.', icon: Tent },
  treasure: { title: 'Trésor', subtitle: 'Prends l’or ou l’objet.', icon: Gem },
  event: { title: 'Événement', subtitle: 'Une rencontre sur la route. Choisis bien.', icon: HelpCircle },
};

export const PASSIVE_INFO: Record<BossPassive, { title: string; icon: LucideIcon; gain: string; pact?: boolean }> = {
  regen: { title: 'Régénération', icon: HeartPulse, gain: 'Passif : régénération' },
  rage: { title: 'Rage', icon: Flame, gain: 'Passif : rage' },
  vitality: { title: 'Vitalité', icon: Shield, gain: 'Passif : vitalité' },
  fury: { title: 'Pacte de furie', icon: SwordsIcon, gain: 'Pacte : furie', pact: true },
  bulwark: { title: 'Pacte du rempart', icon: ShieldPlus, gain: 'Pacte : rempart', pact: true },
  greed: { title: 'Pacte d’avarice', icon: HandCoins, gain: 'Pacte : avarice', pact: true },
};

/** Deck mode: permanent percentages. Classic: the original per-victory gains. */
export function passiveText(p: BossPassive, mode: GameMode = 'deck'): string {
  if (mode === 'classic') {
    return {
      regen: 'Soigne 10 % des PV max après chaque victoire (30 % max).',
      rage: '+8 dégâts de base après chaque victoire. Cumulable, rendement décroissant.',
      vitality: '+18 PV max après chaque victoire. Cumulable, rendement décroissant.',
      fury: 'Pacte (mode Deck).',
      bulwark: 'Pacte (mode Deck).',
      greed: 'Pacte (mode Deck).',
    }[p];
  }
  const { passivePercent: pc, regenPercent, regenCap } = RULES.acts;
  return {
    regen: `Soigne ${regenPercent} % des PV max après chaque victoire (${regenCap} % max).`,
    rage: `+${pc} % de dégâts, tout de suite et pour toute la partie. Cumulable, rendement décroissant.`,
    vitality: `+${pc} % de PV max, tout de suite et pour toute la partie. Cumulable, rendement décroissant.`,
    fury: `+${PASSIVE_RULES.fury.bonus} % de dégâts, mais -${PASSIVE_RULES.fury.malus} % de PV max.`,
    bulwark: `+${PASSIVE_RULES.bulwark.bonus} % de PV max, mais -${PASSIVE_RULES.bulwark.malus} % de dégâts.`,
    greed: `+${PASSIVE_RULES.greed.bonus} or par victoire, mais -${PASSIVE_RULES.greed.malus} % de dégâts.`,
  }[p];
}

// ------------------------------------------------------------ left column

function StatRow({ icon: Icon, label, value, bonus }: { icon: LucideIcon; label: string; value: ReactNode; bonus?: string }) {
  return (
    <div className="stat-row">
      <Icon className="icon" />
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {bonus && <span className="bonus">{bonus}</span>}
      </span>
    </div>
  );
}

export function CharacterPanel({ run }: { run: PublicRunState | null }) {
  if (!run) return <Panel title="Personnage" icon={User}><div className="empty">Chargement…</div></Panel>;
  const s = computeStats(run);
  const plus = (v: number, suffix = '') => (v > 0 ? `+${fmt(Math.round(v * 10) / 10)}${suffix}` : undefined);
  return (
    <Panel title="Personnage" icon={User}>
      <div className="stat-list">
        <div style={{ display: 'grid', gap: 6, marginBottom: 4 }}>
          <div className="stat-row">
            <Heart className="icon" style={{ color: hpColor(run.hp, s.maxHp) }} />
            <span className="label">Vie</span>
            <span className="value">
              {fmt(run.hp)} / {fmt(s.maxHp)}
            </span>
          </div>
          <Bar value={run.hp} max={s.maxHp} color={hpColor(run.hp, s.maxHp)} />
        </div>
        <StatRow icon={Swords} label="Dégâts" value={fmt(s.attack)} bonus={plus(s.attack - run.base.damage)} />
        <StatRow icon={Target} label="Chance critique" value={`${Math.round(s.critChance * 10) / 10} %`} bonus={plus(s.critChance - run.base.critChance, ' %')} />
        <StatRow icon={Zap} label="Dégâts critiques" value={`${s.critDamage} %`} bonus={plus(s.critDamage - run.base.critDamage, ' %')} />
        {s.damageReduction > 0 && <StatRow icon={Shield} label="Réduction" value={`${s.damageReduction} %`} />}
        {s.dodge > 0 && <StatRow icon={Wind} label="Esquive" value={`${s.dodge} %`} />}
        <StatRow icon={Coins} label="Or" value={<span style={{ color: 'var(--accent)' }}>{fmt(run.gold)}</span>} />
      </div>
    </Panel>
  );
}

export function PassivesPanel({ run }: { run: PublicRunState | null }) {
  const counts = new Map<BossPassive, number>();
  for (const p of run?.bossPassives ?? []) counts.set(p, (counts.get(p) ?? 0) + 1);
  const mode = run?.mode ?? 'deck';
  const power = passivePower(run?.bossPassives ?? [], mode);
  const now: Record<BossPassive, string> = {
    rage: mode === 'classic' ? `+${power.damage} dégâts par victoire` : `+${power.damagePercent} % de dégâts`,
    vitality: mode === 'classic' ? `+${power.maxHp} PV max par victoire` : `+${power.hpPercent} % de PV max`,
    regen: `+${power.healPercent} % PV par victoire`,
    fury: `${power.damagePercent >= 0 ? '+' : ''}${power.damagePercent} % dégâts · ${power.hpPercent >= 0 ? '+' : ''}${power.hpPercent} % PV`,
    bulwark: `${power.hpPercent >= 0 ? '+' : ''}${power.hpPercent} % PV · ${power.damagePercent >= 0 ? '+' : ''}${power.damagePercent} % dégâts`,
    greed: `+${power.goldPerKill} or par victoire`,
  };
  return (
    <Panel title="Passifs de boss" icon={Crown}>
      {counts.size === 0 ? (
        <div className="empty">Bats un boss pour obtenir un passif.</div>
      ) : (
        <div className="passive-list">
          {[...counts].map(([p, n]) => {
            const { icon: Icon, title } = PASSIVE_INFO[p];
            return (
              <div key={p} className="passive" title="Les exemplaires se cumulent avec un rendement décroissant.">
                <Icon className="icon" />
                <span>
                  {title} {n > 1 && `×${n}`}
                  <small className="muted" style={{ display: 'block', fontSize: 11 }}>{now[p]}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function MiniSlot({ cardId, modifier }: { cardId: string; modifier: ModifierId | null }) {
  const card = cardMeta(cardId)!;
  const hover = useCardHover(cardId, modifier);
  return (
    <div {...hover} className="mini-slot" style={cssVars({ '--slot-color': CARD_COLORS[card.rarity] })}>
      <img src={`/img/cartes/${card.image}`} alt={card.name} />
      {modifier && <span className="mod" />}
    </div>
  );
}

export function DeckPanel({ run }: { run: PublicRunState | null }) {
  if (run && runMode(run) === 'classic') {
    return (
      <Panel title="Deck" icon={Layers}>
        <div className="empty">Mode classique : aucune carte.</div>
      </Panel>
    );
  }
  const deck = run?.deck ?? [];
  const limit = deckLimit(deck, run?.perks ?? []);
  return (
    <Panel title={`Deck ${deck.length}/${limit}`} icon={Layers}>
      <div className="mini-deck">
        {Array.from({ length: Math.max(limit, deck.length) }, (_, i) => {
          const entry = deck[i];
          const card = entry ? cardMeta(entry.cardId) : null;
          if (!entry || !card) return <div key={i} className="mini-slot" />;
          return <MiniSlot key={i} cardId={entry.cardId} modifier={entry.modifier} />;
        })}
      </div>
      {deck.length === 0 ? (
        <div className="empty">Achète des cartes et des boosters à la boutique, après chaque boss.</div>
      ) : (
        <ul className="effect-list">
          {deck.map((entry, i) => {
            const card = cardMeta(entry.cardId)!;
            return (
              <li key={i}>
                <span className="dot" style={cssVars({ '--dot': CARD_COLORS[card.rarity] })} />
                <span>
                  <strong style={{ color: 'var(--text)' }}>{card.name}</strong> — {card.effect}
                  {entry.modifier && ` (${MODIFIER_META[entry.modifier].name} : ${MODIFIER_META[entry.modifier].description})`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ----------------------------------------------------------- right column

export function LeaderboardPanel({ snapshot, userId, mode }: { snapshot: LeaderboardSnapshot | null; userId: number; mode: GameMode }) {
  const [tab, setTab] = useState<GameMode>(mode);
  const rows = snapshot?.top[tab] ?? [];
  return (
    <Panel
      title="Classement"
      icon={Trophy}
      actions={<Tabs value={tab} onChange={setTab} options={[['deck', 'Deck'], ['classic', 'Classique']] as const} />}
    >
      {rows.length === 0 ? (
        <div className="empty">Aucun joueur classé.</div>
      ) : (
        <div className="rank-list">
          {rows.map((p, i) => (
            <div
              key={p.userId}
              className={`rank-row ${p.userId === userId ? 'me' : ''}`}
              title={`${p.gamesPlayed} partie(s) jouée(s)${p.wins ? ` · ${p.wins} victoire(s)` : ''}`}
            >
              <span className="pos">{i + 1}</span>
              <img src={avatarUrl(p.avatar, p.username)} alt="" />
              <span className="name-cell">
                <span className="name">{p.username}</span>
                {(p.wins ?? 0) > 0 && (
                  <span className="wins" title={`${p.wins} partie(s) gagnée(s)${p.palierWon ? ` · palier ${p.palierWon} gagné` : ''}`}>
                    <Crown className="icon" />
                    {p.wins > 1 && p.wins}
                  </span>
                )}
                {(p.palierWon ?? 0) > 1 && (
                  <span className="palier-chip" title={`Palier ${p.palierWon} gagné`}>
                    P{p.palierWon}
                  </span>
                )}
              </span>
              <span className="lvl">Niv. {p.bestLevel + 1}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function OnlinePanel({ snapshot, userId }: { snapshot: LeaderboardSnapshot | null; userId: number }) {
  const online = snapshot?.online ?? [];
  return (
    <Panel title={`En ligne · ${online.length}`} icon={Users}>
      {online.length === 0 ? (
        <div className="empty">Personne en ligne.</div>
      ) : (
        <div className="rank-list">
          {online.map((p) => {
            const Icon = MODE_INFO[p.mode].icon;
            return (
              <div key={p.userId} className={`rank-row ${p.userId === userId ? 'me' : ''}`} style={{ gridTemplateColumns: '26px 1fr auto' }}>
                <img src={avatarUrl(p.avatar, p.username)} alt="" />
                <span className="name">{p.username}</span>
                <span className="lvl" title={`Mode ${MODE_INFO[p.mode].label}`}>
                  <Icon className="icon" />
                  Niv. {p.currentLevel + 1}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function CasesPanel({ cases }: { cases: InventoryCase[] }) {
  const groups = CASE_ORDER.map((id) => ({ meta: caseMeta(id), n: cases.filter((c) => c.caseId === id).length })).filter((g) => g.n > 0);
  return (
    <Panel
      title={`Caisses · ${cases.length}`}
      icon={Package}
      actions={
        cases.length > 0 ? (
          <a className="btn btn-sm" href="/gambling">
            Ouvrir
          </a>
        ) : undefined
      }
    >
      {groups.length === 0 ? (
        <div className="empty">Les caisses tombent au niveau 3 puis tous les 10 niveaux.</div>
      ) : (
        <div className="case-list">
          {groups.map(({ meta, n }) => (
            <div key={meta.id} className="case-row">
              <img src={meta.image} alt="" />
              <span>{meta.name}</span>
              <span className="n">×{n}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ----------------------------------------------------------------- modals

export function UpgradeModal({
  open,
  offer,
  mode = 'deck',
  node = null,
  gold = 0,
  busy,
  onChoose,
}: {
  open: boolean;
  offer: UpgradeOffer[] | null;
  mode?: GameMode;
  /** Step being played (camp, treasure, event): sets the title. */
  node?: NodeKind | null;
  gold?: number;
  busy: boolean;
  onChoose: (index: number) => void;
}) {
  const boss = offer?.[0]?.kind === 'bossPassive';
  const step = node ? STEP_TITLE[node] : undefined;
  return (
    <Modal
      open={open}
      icon={boss ? Crown : (step?.icon ?? ArrowUpCircle)}
      title={boss ? 'Boss vaincu : choisis un passif' : (step?.title ?? 'Choisis une amélioration')}
      subtitle={boss ? 'Les passifs restent actifs toute la partie. Les pactes sont plus forts, avec un défaut.' : step?.subtitle}
    >
      <div className="choice-grid">
        {(offer ?? []).map((o, i) => {
          const info = upgradeInfo(o, mode);
          return (
            <button key={i} className="choice" disabled={busy || (o.kind === 'edition' && gold < o.price)} style={cssVars({ '--choice-color': info.color })} onClick={() => onChoose(i)}>
              <span className="choice-icon">
                <info.icon className="icon" />
              </span>
              <h3>{info.title}</h3>
              {info.value && <span className="big">{info.value}</span>}
              <p>{info.text}</p>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function CampModal({
  open,
  run,
  busy,
  onClose,
  onHeal,
}: {
  open: boolean;
  run: PublicRunState | null;
  busy: boolean;
  onClose: () => void;
  onHeal: () => void;
}) {
  if (!run) return null;
  const s = computeStats(run);
  const dead = run.phase === 'dead';
  const full = run.hp >= s.maxHp;
  const cost = healCost(run);
  const canHeal = !dead && !full && run.gold >= cost && run.phase === 'ready';
  const reason = dead ? 'Partie terminée' : full ? 'PV déjà au maximum' : run.gold < cost ? `Il faut ${cost} or` : run.phase !== 'ready' ? 'Termine ton choix en cours' : '';
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={HeartPulse}
      title="Soins"
      subtitle="Paie de l’or pour récupérer tous tes PV entre deux étapes."
      footer={
        <>
          {reason && <span className="muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>{reason}</span>}
          <button className="btn btn-accent" disabled={!canHeal || busy} onClick={onHeal}>
            <HeartPulse className="icon" /> Soin complet · {cost} or
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <div className="stat-row" style={{ marginBottom: 6 }}>
          <Heart className="icon" style={{ color: hpColor(run.hp, s.maxHp) }} />
          <span className="label">Vie</span>
          <span className="value">
            {fmt(run.hp)} / {fmt(s.maxHp)}
          </span>
        </div>
        <Bar value={run.hp} max={s.maxHp} color={hpColor(run.hp, s.maxHp)} />
      </div>
      <div className="stats-grid">
        <StatCard icon={Swords} label="Dégâts" value={fmt(s.attack)} />
        <StatCard icon={Target} label="Chance critique" value={`${Math.round(s.critChance * 10) / 10} %`} />
        <StatCard icon={Zap} label="Dégâts critiques" value={`${s.critDamage} %`} />
        <StatCard icon={Coins} label="Or" value={fmt(run.gold)} />
        <StatCard icon={Skull} label="Ennemis vaincus" value={fmt(run.stats.kills)} />
        <StatCard icon={Crown} label="Boss vaincus" value={fmt(run.stats.bossKills)} />
      </div>
    </Modal>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="stat-card">
      <Icon className="icon" />
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
      </div>
    </div>
  );
}

export function NewRunModal({
  open,
  run,
  busy,
  palierUnlocked,
  onClose,
  onStart,
}: {
  open: boolean;
  run: PublicRunState | null;
  busy: boolean;
  palierUnlocked: number;
  onClose?: () => void;
  onStart: (mode: GameMode, palier?: number) => void;
}) {
  const inProgress = !!run && run.phase !== 'dead' && run.level > 0;
  // Defaults to the highest unlocked tier: that is where the challenge is.
  const [picked, setPalier] = useState<number | null>(null);
  const chosen = Math.min(picked ?? palierUnlocked, palierUnlocked);
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Gamepad2}
      title="Nouvelle partie"
      subtitle={inProgress ? `La partie en cours (niveau ${run.level + 1}) sera abandonnée.` : 'Choisis ton mode de jeu.'}
    >
      <div className="palier-picker">
        <div className="palier-head">
          <Mountain className="icon" /> Palier de difficulté (mode Deck)
          <span className="muted">· gagne une partie pour débloquer le suivant</span>
        </div>
        <div className="palier-steps" role="radiogroup" aria-label="Palier">
          {PALIERS.map((p) => {
            const locked = p.level > palierUnlocked;
            return (
              <button
                key={p.level}
                role="radio"
                aria-checked={chosen === p.level}
                className={`palier-step ${chosen === p.level ? 'active' : ''} ${p.level <= chosen ? 'on' : ''}`}
                disabled={locked || busy}
                onClick={() => setPalier(p.level)}
                title={locked ? `Verrouillé : gagne une partie au palier ${p.level - 1}` : p.text}
              >
                {locked ? <Lock className="icon" /> : p.level}
              </button>
            );
          })}
        </div>
        <ul className="palier-rules">
          {PALIERS.filter((p) => p.level <= chosen).map((p) => (
            <li key={p.level}>
              <strong>{p.name}</strong> {p.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="choice-grid">
        {(['deck', 'classic'] as const).map((mode) => {
          const info = MODE_INFO[mode];
          const current = run ? runMode(run) === mode : false;
          return (
            <button
              key={mode}
              className="choice"
              disabled={busy}
              style={cssVars({ '--choice-color': mode === 'deck' ? '#5b6cff' : '#f5b244' })}
              onClick={() => onStart(mode, mode === 'deck' ? chosen : undefined)}
            >
              <span className="choice-icon">
                <info.icon className="icon" />
              </span>
              <h3>
                {info.label}
                {mode === 'deck' && <span className="badge badge-palier" style={{ marginLeft: 6 }}>Palier {chosen}</span>}
                {current && (
                  <span className="badge" style={{ marginLeft: 6 }}>
                    Mode actuel
                  </span>
                )}
              </h3>
              <p>{info.description}</p>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** Ash flakes of the death screen: fixed positions so re-renders don't reshuffle them. */
const ASH = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 0.53) % 6,
  duration: 7 + ((i * 1.7) % 5),
  size: 2 + (i % 4),
}));

/**
 * Death screen: the run is over, and it has to read that way at a glance.
 * The world goes grey, a flatline crosses the screen, ash falls slowly;
 * the cause of death and the run's numbers sit under a large title.
 */
export function DefeatModal({
  open,
  run,
  best,
  killer,
  onNewRun,
  onClose,
}: {
  open: boolean;
  run: PublicRunState | null;
  best: number;
  /** Who dealt the last blow ("L'Enragé", "une élite"…). */
  killer: string;
  onNewRun: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onNewRun();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onNewRun]);
  if (!run || !open) return null;
  const level = run.level + 1;
  // The best score is already updated when the screen opens: a tie means this run set it.
  const record = run.level > 0 && run.level >= best;
  return createPortal(
    <div className="death-screen" role="dialog" aria-modal="true" aria-labelledby="death-title">
      <div className="death-veil" />
      <div className="death-ash" aria-hidden>
        {ASH.map((a, i) => (
          <span key={i} style={cssVars({ '--x': `${a.left}%`, '--d': `${a.delay}s`, '--t': `${a.duration}s`, '--s': `${a.size}px` })} />
        ))}
      </div>
      <svg className="death-ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 H380 L400 60 L415 20 L432 104 L448 38 L462 60 H520 L534 44 L548 76 L560 60 H1200" />
      </svg>
      <div className="death-card">
        <div className="death-skull">
          <Skull className="icon" />
        </div>
        <h1 id="death-title">Tu es mort</h1>
        <p className="death-cause">
          Vaincu par <strong>{killer}</strong> au niveau <strong>{level}</strong>
        </p>
        {record && (
          <span className="badge badge-accent death-record">
            <Trophy className="icon" /> Nouveau record
          </span>
        )}
        <div className="stats-grid death-stats">
          <StatCard icon={TrendingUp} label="Niveau atteint" value={level} />
          <StatCard icon={Trophy} label="Record personnel" value={Math.max(best, run.level) + 1} />
          <StatCard icon={Skull} label="Ennemis vaincus" value={fmt(run.stats.kills)} />
          <StatCard icon={Swords} label="Dégâts infligés" value={fmt(run.stats.damageDealt)} />
        </div>
        <div className="death-actions">
          <button className="btn" onClick={onClose}>
            Revoir l'arène
          </button>
          <button className="btn btn-primary btn-lg" onClick={onNewRun} autoFocus>
            <Play className="icon" /> Nouvelle partie
          </button>
        </div>
        <p className="death-mode muted">Mode {MODE_INFO[runMode(run)].label}</p>
      </div>
    </div>,
    document.body,
  );
}

export function HistoryModal({
  open,
  history,
  onClose,
  onClear,
}: {
  open: boolean;
  history: HistoryEntry[];
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={BarChart3}
      title="Historique"
      footer={
        <button className="btn" onClick={onClear} disabled={history.length === 0}>
          Effacer
        </button>
      }
    >
      {history.length === 0 ? (
        <div className="empty">Aucun événement pour l’instant.</div>
      ) : (
        <div className="history-list">
          {[...history].reverse().map((e, i) => (
            <LogLine key={history.length - i} entry={e} />
          ))}
        </div>
      )}
    </Modal>
  );
}

export function ProfileModal({
  open,
  user,
  stats,
  onClose,
  onSaveAvatar,
}: {
  open: boolean;
  user: PublicUser;
  stats: ProfileStats | null;
  onClose: () => void;
  onSaveAvatar: (avatar: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(user.avatar.startsWith('https://') ? user.avatar : '');
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const date = (t: number | null | undefined) => (t ? new Date(t).toLocaleDateString('fr-FR') : '-');

  const save = async (value: string) => {
    try {
      await onSaveAvatar(value);
      setState('saved');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  };
  const valid = (() => {
    try {
      return new URL(url.trim()).protocol === 'https:';
    } catch {
      return false;
    }
  })();

  return (
    <Modal open={open} onClose={onClose} icon={User} title="Profil">
      <div className="profile-head">
        <img src={avatarUrl(user.avatar, user.username)} alt="" />
        <div>
          <h3>{user.username}</h3>
          <div className="muted">
            Membre depuis le {date(stats?.createdAt)} · Dernière connexion le {date(stats?.lastLoginAt)}
          </div>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard icon={Layers} label="Record mode Deck" value={(stats?.bestLevel ?? 0) + 1} />
        <StatCard icon={Swords} label="Record mode Classique" value={(stats?.bestLevelClassic ?? 0) + 1} />
        <StatCard icon={Trophy} label="Victoires (acte 8)" value={fmt(stats?.wins ?? 0)} />
        <StatCard icon={Gamepad2} label="Parties jouées" value={fmt(stats?.gamesPlayed ?? 0)} />
        <StatCard icon={Coins} label="Or total gagné" value={fmt(stats?.totalGold ?? 0)} />
        <StatCard icon={Package} label="Caisses trouvées" value={fmt(stats?.casesFound ?? 0)} />
      </div>
      <div className="section-title">Photo de profil</div>
      <div className="form-row">
        <input className="input" type="url" placeholder="https://exemple.com/avatar.png" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={!valid} onClick={() => void save(url.trim())}>
            {state === 'saved' ? 'Enregistré' : 'Enregistrer'}
          </button>
          <button className="btn btn-sm" onClick={() => void save('default').then(() => setUrl(''))}>
            Utiliser l’initiale
          </button>
          {state === 'error' && <span style={{ color: 'var(--danger)', alignSelf: 'center' }}>URL refusée</span>}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Lien https vers une image. Laisse vide pour garder l’initiale.
        </div>
      </div>
    </Modal>
  );
}
