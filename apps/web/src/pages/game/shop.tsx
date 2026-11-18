import { BOSSES, bossRerollPrice, computeStats, deckLimit, forgePrice, ITEMS, MAX_ITEMS, MAX_STARS, nextBossAct, PACKS, sellValue, type DeckCard, type ModifierId, type PackKind, type PerkId, type PublicRunState } from '@autobattle/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Backpack,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Coins,
  Crown,
  Cross,
  Dumbbell,
  Gem,
  Hammer,
  Heart,
  Layers,
  PackageOpen,
  PackagePlus,
  RefreshCw,
  ShoppingBag,
  Shuffle,
  Sparkles,
  Star,
  Store,
  Swords,
  Target,
  Vault,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { audio } from '../../common/audio';
import { CARD_COLORS, cardMeta, MODIFIER_META } from '../../common/catalog';
import { useCardHover } from '../../ui/CardHover';
import { CardTile, cssVars, Modal, Panel } from '../../ui/components';
import { BOSS_ICON } from './acts';
import { ITEM_META } from './route';
import { upgradeInfo } from './panels';

export const PACK_META: Record<PackKind, { name: string; text: string; icon: LucideIcon; color: string }> = {
  combat: { name: 'Booster Combat', text: 'Choisis 1 carte parmi 3', icon: Swords, color: '#60a5fa' },
  mega: { name: 'Méga booster', text: 'Choisis 2 cartes parmi 5', icon: Layers, color: '#c084fc' },
  training: { name: 'Booster Entraînement', text: 'Choisis 1 bonus de stats parmi 3', icon: Dumbbell, color: '#4ade80' },
  shiny: { name: 'Booster Éclat', text: '1 carte parmi 2, édition spéciale garantie', icon: Sparkles, color: '#f5b244' },
};

export const FORGE_TEXT = '+8 % de dégâts par passage, cumulable. Le prix monte de 4 or à chaque fois.';

export const PERK_META: Record<PerkId, { name: string; text: string; icon: LucideIcon }> = {
  bigShop: { name: 'Étal élargi', text: '+1 carte proposée dans chaque boutique', icon: Store },
  discount: { name: 'Marchandage', text: '-25 % sur les cartes et les boosters', icon: BadgePercent },
  freeReroll: { name: 'Relance offerte', text: 'La première relance de chaque boutique est gratuite', icon: RefreshCw },
  vault: { name: 'Coffre-fort', text: 'Intérêts plafonnés à 10 or au lieu de 5', icon: Vault },
  satchel: { name: 'Sacoche', text: '+1 emplacement de deck', icon: Backpack },
  flair: { name: 'Flair', text: 'Les cartes rares apparaissent plus souvent', icon: Gem },
  medic: { name: 'Infirmerie', text: 'Le soin du camp coûte 2 or de moins', icon: Cross },
  stuffedPacks: { name: 'Boosters garnis', text: '+1 choix dans chaque booster', icon: PackagePlus },
};

function Price({ value, gold }: { value: number; gold: number }) {
  return (
    <span className={`price ${gold < value ? 'too-expensive' : ''}`}>
      <Coins className="icon" />
      {value}
    </span>
  );
}

type Run = PublicRunState;
const STAT_ROWS: [keyof ReturnType<typeof computeStats>, string, string][] = [
  ['maxHp', 'PV max', ''],
  ['attack', 'Dégâts', ''],
  ['critChance', 'Chance critique', ' %'],
  ['critDamage', 'Dégâts critiques', ' %'],
  ['damageReduction', 'Réduction', ' %'],
  ['dodge', 'Esquive', ' %'],
];

/** "What changes if my deck becomes `deck`": shown in card tooltips. */
function statPreview(run: Run, deck: DeckCard[], title: string, note?: string) {
  const now = computeStats(run);
  const next = computeStats({ ...run, deck });
  const rows = STAT_ROWS.filter(([k]) => now[k] !== next[k]);
  return (
    <div className="hover-extra">
      <span className="title">{title}</span>
      {rows.length === 0 && <span className="muted">Aucun changement direct sur tes stats (effet de situation).</span>}
      {rows.map(([k, label, unit]) => (
        <div key={k} className="row">
          <span>{label}</span>
          <span className={next[k] > now[k] ? 'up' : 'down'}>
            {Math.round(now[k] * 10) / 10}
            {unit} → {Math.round(next[k] * 10) / 10}
            {unit}
          </span>
        </div>
      ))}
      {note && <span className="muted">{note}</span>}
    </div>
  );
}

/** Deck after taking a card: a copy already in the deck is fused (one more star). */
const withCard = (run: Run, cardId: string, modifier: ModifierId | null) =>
  run.deck.some((d) => d.cardId === cardId)
    ? run.deck.map((d) => (d.cardId === cardId ? { ...d, stars: Math.min(MAX_STARS, (d.stars ?? 1) + 1) } : d))
    : [...run.deck, { cardId, modifier, price: 0 }];

/** Stars the card would reach by fusion, or 0 if it is not in the deck. */
const fusionStars = (run: Run, cardId: string) => {
  const owned = run.deck.find((d) => d.cardId === cardId);
  return owned ? (owned.stars ?? 1) + 1 : 0;
};

function FusionBadge({ stars }: { stars: number }) {
  return (
    <span className="badge fusion-badge" title={stars > MAX_STARS ? 'Déjà au maximum' : `Fusion : la carte du deck passe à ${stars} étoiles (+${(stars - 1) * 50} % sur ses effets)`}>
      {stars > MAX_STARS ? 'Max' : 'Fusion'}
      {Array.from({ length: Math.min(stars, MAX_STARS) }, (_, i) => (
        <Star key={i} className="icon" />
      ))}
    </span>
  );
}

/** Live summary at the top of the shop: gold, stats, last thing that happened. */
function StatusStrip({ run, lastAction }: { run: Run; lastAction?: string }) {
  const s = computeStats(run);
  return (
    <div className="shop-status">
      <span className="shop-gold">
        <Coins className="icon" /> {run.gold} or
      </span>
      <span className="stat-chip">
        <Heart className="icon" /> {run.hp.toLocaleString('fr-FR')} / {s.maxHp.toLocaleString('fr-FR')}
      </span>
      <span className="stat-chip">
        <Swords className="icon" /> {s.attack.toLocaleString('fr-FR')}
      </span>
      <span className="stat-chip">
        <Target className="icon" /> {Math.round(s.critChance * 10) / 10} %
      </span>
      <span className="stat-chip">
        <Zap className="icon" /> {s.critDamage} %
      </span>
      {lastAction && <span className="last-action">{lastAction}</span>}
    </div>
  );
}

/**
 * The player's deck, always visible in the shop and while a booster is open.
 * Click a card to select it (sell / move), or drag it onto another to reorder.
 */
export function DeckBar({ run, busy, onSell, onMove }: { run: Run; busy: boolean; onSell: (index: number) => void; onMove: (from: number, to: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const deck = run.deck;
  const limit = deckLimit(deck, run.perks);
  const sel = selected !== null && selected < deck.length ? selected : null;

  return (
    <div className="deck-bar">
      <div className="deck-bar-head">
        <span className="section-title">
          Ton deck · {deck.length}/{limit}
        </span>
        {sel !== null ? (
          <span className="deck-actions">
            <button className="btn btn-sm btn-icon" disabled={busy || sel === 0} onClick={() => (onMove(sel, sel - 1), setSelected(sel - 1))} title="Déplacer à gauche">
              <ChevronLeft className="icon" />
            </button>
            <button className="btn btn-sm btn-icon" disabled={busy || sel === deck.length - 1} onClick={() => (onMove(sel, sel + 1), setSelected(sel + 1))} title="Déplacer à droite">
              <ChevronRight className="icon" />
            </button>
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => (onSell(sel), setSelected(null))}>
              <Coins className="icon" /> Vendre · {sellValue(deck[sel]!)} or
            </button>
          </span>
        ) : (
          <span className="muted deck-hint">Clique une carte pour la vendre ou la déplacer, ou fais-la glisser.</span>
        )}
      </div>
      <div className="deck-slots">
        {Array.from({ length: Math.max(limit, deck.length) }, (_, i) => {
          const entry = deck[i];
          if (!entry) return <div key={`empty-${i}`} className="deck-slot empty" />;
          return (
            <DeckSlot
              key={entry.cardId}
              run={run}
              index={i}
              selected={sel === i}
              dropTarget={dragging !== null && dragging !== i}
              onSelect={() => setSelected(sel === i ? null : i)}
              onDragStart={() => setDragging(i)}
              onDragEnd={() => setDragging(null)}
              onDrop={() => {
                if (dragging !== null && dragging !== i) onMove(dragging, i);
                setDragging(null);
                setSelected(null);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function DeckSlot({
  run,
  index,
  selected,
  dropTarget,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  run: Run;
  index: number;
  selected: boolean;
  dropTarget: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const entry = run.deck[index]!;
  const card = cardMeta(entry.cardId)!;
  const hover = useCardHover(entry.cardId, entry.modifier, () =>
    statPreview(run, run.deck.filter((_, i) => i !== index), 'Si tu la vends', `Revente : ${sellValue(entry)} or`),
  );
  return (
    <button
      {...hover}
      className={`deck-slot r-${card.rarity} ${entry.modifier ? `ed-${entry.modifier}` : ''} ${selected ? 'selected' : ''} ${dropTarget ? 'drop' : ''}`}
      data-glare
      style={cssVars({ '--rarity': CARD_COLORS[card.rarity] })}
      draggable
      onClick={onSelect}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <img src={`/img/cartes/${card.image}`} alt="" draggable={false} />
      <span className="card-sheen" aria-hidden />
      <span className="deck-slot-name">{card.name}</span>
      {entry.modifier && <span className={`modifier ${entry.modifier}`}>{MODIFIER_META[entry.modifier].name}</span>}
    </button>
  );
}

/** Always-available services: the Forge and swapping the announced boss (once per act). */
function ServicesBlock({ run, busy, onForge, onBossReroll }: { run: Run; busy: boolean; onForge: () => void; onBossReroll: () => void }) {
  const gold = run.gold;
  const forge = forgePrice(run);
  const swap = bossRerollPrice(run);
  const act = nextBossAct(run);
  const swapped = run.bossRerollAct === act;
  const boss = run.nextBoss ? BOSSES[run.nextBoss] : null;
  const BossIcon = run.nextBoss ? BOSS_ICON[run.nextBoss] : Crown;
  return (
    <section className="shop-block services-block">
      <header>
        <h3>Services</h3>
      </header>
      <div className="services">
        <button className="service" disabled={busy || gold < forge} onClick={onForge} title={FORGE_TEXT}>
          <span className="perk-icon">
            <Hammer className="icon" />
          </span>
          <span className="service-body">
            <span className="perk-name">Forge</span>
            <span className="pack-text">+8 % de dégâts · déjà {run.forge ?? 0} fois</span>
          </span>
          <Price value={forge} gold={gold} />
        </button>
        {boss && (
          <div className="service boss-service">
            <span className="perk-icon">
              <BossIcon className="icon" />
            </span>
            <span className="service-body">
              <span className="perk-name">
                Boss de l’acte {act} : {boss.name}
              </span>
              <span className="pack-text">{boss.text}</span>
            </span>
            <button className="btn btn-sm" disabled={busy || swapped || gold < swap} onClick={onBossReroll} title="Tire un autre boss pour cet acte (une fois par acte)">
              <Shuffle className="icon" /> {swapped ? 'Déjà changé' : `Changer · ${swap} or`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function ShopView({
  open,
  run,
  busy,
  lastAction,
  onBuy,
  onSell,
  onMove,
  onReroll,
  onBuyPack,
  onBuyPerk,
  onBuyItem,
  onForge,
  onBossReroll,
  onLeave,
}: {
  open: boolean;
  run: Run | null;
  busy: boolean;
  lastAction?: string;
  onBuy: (index: number) => void;
  onSell: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onReroll: () => void;
  onBuyPack: (index: number) => void;
  onBuyPerk: () => void;
  onBuyItem: () => void;
  onForge: () => void;
  onBossReroll: () => void;
  onLeave: () => void;
}) {
  const shop = run?.shop;
  const gold = run?.gold ?? 0;
  const deck = run?.deck ?? [];
  const deckFull = deck.length >= deckLimit(deck, run?.perks ?? []);

  return (
    <Modal
      open={open}
      size="xl"
      icon={ShoppingBag}
      title="Boutique"
      subtitle={
        shop && shop.interest > 0
          ? `Intérêts de l’acte : +${shop.interest} or (1 or par tranche de 5, plafond ${run?.perks.includes('vault') ? 10 : 5}).`
          : 'Les intérêts tombent à la boutique de boss : 1 or par tranche de 5 or en poche.'
      }
      footer={
        <button className="btn btn-primary btn-lg" onClick={onLeave} disabled={busy}>
          Continuer la partie
        </button>
      }
    >
      {run && shop && (
        <>
          <StatusStrip run={run} lastAction={lastAction} />
          <div className="shop-layout">
            <section className="shop-block">
              <header>
                <h3>Cartes</h3>
                <button className="btn btn-sm" disabled={busy || gold < shop.rerollCost} onClick={onReroll} title="Remplace les cartes proposées">
                  <RefreshCw className="icon" /> Relancer · {shop.rerollCost === 0 ? 'gratuit' : `${shop.rerollCost} or`}
                </button>
              </header>
              <div className="shop-cards">
                {shop.cards.map((item, index) =>
                  item.sold ? (
                    <div key={index} className="sold-slot">
                      Achetée
                    </div>
                  ) : (
                    (() => {
                      const stars = fusionStars(run, item.cardId);
                      const blocked = gold < item.price || (stars === 0 && deckFull) || stars > MAX_STARS;
                      return (
                        <CardTile
                          key={index}
                          cardId={item.cardId}
                          modifier={item.modifier}
                          hoverExtra={() =>
                            statPreview(run, withCard(run, item.cardId, item.modifier), stars ? 'Après la fusion' : 'Avec cette carte', stars === 0 && deckFull ? 'Deck complet : vends une carte d’abord.' : undefined)
                          }
                          showEffect
                          onClick={busy || blocked ? undefined : () => onBuy(index)}
                          className={blocked ? 'unaffordable' : stars ? 'fusion' : ''}
                          cornerLeft={
                            stars ? <FusionBadge stars={stars} /> : item.modifier ? <span className={`modifier ${item.modifier}`}>{MODIFIER_META[item.modifier].name}</span> : undefined
                          }
                          corner={<Price value={item.price} gold={gold} />}
                        />
                      );
                    })()
                  ),
                )}
              </div>
              {deckFull && <p className="shop-warning">Deck complet : vends une carte ci-dessous pour en acheter une autre.</p>}
            </section>

            {shop.item && (
              <section className="shop-block">
                <header>
                  <h3>Objet</h3>
                </header>
                {(() => {
                  const offer = shop.item;
                  const meta = ITEM_META[offer.item];
                  const full = (run.items ?? []).length >= MAX_ITEMS;
                  return (
                    <button
                      className={`pack shop-item ${offer.sold ? 'sold' : ''}`}
                      style={cssVars({ '--pack': meta.color })}
                      disabled={offer.sold || busy || gold < offer.price || full}
                      onClick={onBuyItem}
                      title={full ? `${MAX_ITEMS} objets maximum` : undefined}
                    >
                      <span className="pack-art">
                        <meta.icon className="icon" />
                      </span>
                      <span className="pack-name">{ITEMS[offer.item].name}</span>
                      <span className="pack-text">{ITEMS[offer.item].text}</span>
                      {offer.sold ? <span className="badge">Acheté</span> : <Price value={offer.price} gold={gold} />}
                    </button>
                  );
                })()}
              </section>
            )}

            <section className="shop-block">
              <header>
                <h3>Boosters</h3>
              </header>
              <div className="shop-packs">
                {shop.packs.map((pack, index) => {
                  const meta = PACK_META[pack.kind];
                  return (
                    <button
                      key={index}
                      className={`pack ${pack.sold ? 'sold' : ''}`}
                      style={cssVars({ '--pack': meta.color })}
                      disabled={pack.sold || busy || gold < pack.price}
                      onClick={() => onBuyPack(index)}
                    >
                      <span className="pack-art">
                        <meta.icon className="icon" />
                      </span>
                      <span className="pack-name">{meta.name}</span>
                      <span className="pack-text">{meta.text}</span>
                      {pack.sold ? <span className="badge">Ouvert</span> : <Price value={pack.price} gold={gold} />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="shop-block">
              <header>
                <h3>Amélioration</h3>
              </header>
              {shop.perk ? (
                (() => {
                  const offer = shop.perk;
                  const meta = PERK_META[offer.perk];
                  return (
                    <button className={`perk ${offer.sold ? 'sold' : ''}`} disabled={offer.sold || busy || gold < offer.price} onClick={onBuyPerk}>
                      <span className="perk-icon">
                        <meta.icon className="icon" />
                      </span>
                      <span className="perk-name">{meta.name}</span>
                      <span className="pack-text">{meta.text}</span>
                      {offer.sold ? <span className="badge badge-accent">Acquise</span> : <Price value={offer.price} gold={gold} />}
                      <span className="perk-note">Permanente pour cette partie</span>
                    </button>
                  );
                })()
              ) : (
                <div className="empty">Toutes les améliorations sont acquises.</div>
              )}
            </section>

            <ServicesBlock run={run} busy={busy} onForge={onForge} onBossReroll={onBossReroll} />
          </div>
          <DeckBar run={run} busy={busy} onSell={onSell} onMove={onMove} />
        </>
      )}
    </Modal>
  );
}

export function PackView({
  open,
  run,
  busy,
  onPick,
  onSkip,
  onSell,
  onMove,
}: {
  open: boolean;
  run: Run | null;
  busy: boolean;
  onPick: (index: number) => void;
  onSkip: () => void;
  onSell: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const pack = run?.pack;
  // A new booster plays its opening once: shake, tear, burst, then the cards are dealt.
  const packKey = pack ? `${pack.kind}:${pack.options.map((o) => (o.type === 'card' ? o.cardId : o.offer.kind)).join(',')}` : '';
  const [openedKey, setOpenedKey] = useState('');
  const opening = open && !!pack && openedKey !== packKey;
  useEffect(() => {
    if (!opening) return;
    audio.packOpen();
    const id = setTimeout(() => setOpenedKey(packKey), 1150);
    return () => clearTimeout(id);
  }, [opening, packKey]);
  if (!run || !pack) return null;
  const meta = PACK_META[pack.kind];
  const deck = run.deck;
  const deckFull = deck.length >= deckLimit(deck, run.perks);
  const total = PACKS[pack.kind].picks;
  const hasCards = pack.options.some((o) => o.type === 'card');
  return (
    <Modal
      open={open}
      size="xl"
      icon={PackageOpen}
      title={meta.name}
      subtitle={`${pack.taken.length > 0 ? `Encore ${pack.picksLeft}` : `Choisis ${total}`} ${hasCards ? `carte${pack.picksLeft > 1 ? 's' : ''}` : `bonus`} parmi ${pack.options.length}.${hasCards ? ' Les cartes vont directement dans ton deck.' : ''}`}
      footer={
        <button className="btn" disabled={busy} onClick={onSkip}>
          {pack.taken.length > 0 ? 'Terminer' : 'Passer sans rien prendre'}
        </button>
      }
    >
      <StatusStrip run={run} />
      {opening ? (
        <div className="pack-opening" style={cssVars({ '--pack': meta.color })} aria-hidden>
          <div className="pack-burst" />
          <div className="pack-sealed">
            <div className="pack-flap" />
            <div className="pack-face">
              <meta.icon className="icon" />
            </div>
          </div>
        </div>
      ) : (
        <div className="pack-options dealt">
        {pack.options.map((option, index) => {
          const taken = pack.taken.includes(index);
          if (option.type === 'stat') {
            const info = upgradeInfo(option.offer);
            return (
              <button key={index} className="choice" disabled={busy || taken} style={cssVars({ '--choice-color': info.color, '--i': index })} onClick={() => onPick(index)}>
                <span className="choice-icon">
                  <info.icon className="icon" />
                </span>
                <h3>{info.title}</h3>
                {info.value && <span className="big">{info.value}</span>}
                <p>{info.text}</p>
              </button>
            );
          }
          const stars = fusionStars(run, option.cardId);
          const duplicate = stars > MAX_STARS;
          const blocked = (stars === 0 && deckFull) || duplicate;
          return (
            <div key={index} className="deal-slot" style={cssVars({ '--i': index })}>
            <CardTile
              cardId={option.cardId}
              modifier={option.modifier}
              hoverExtra={() => statPreview(run, withCard(run, option.cardId, option.modifier), stars ? 'Après la fusion' : 'Avec cette carte')}
              showEffect
              className={taken ? 'picked' : blocked ? 'unaffordable' : ''}
              onClick={busy || taken || blocked ? undefined : () => onPick(index)}
              cornerLeft={stars ? <FusionBadge stars={stars} /> : option.modifier ? <span className={`modifier ${option.modifier}`}>{MODIFIER_META[option.modifier].name}</span> : undefined}
              corner={taken ? <span className="badge badge-accent">Prise</span> : undefined}
              footer={
                blocked && !taken ? (
                  <div className="effect" style={{ color: 'var(--danger)' }}>
                    {duplicate ? 'Déjà au maximum (3 étoiles)' : 'Deck complet'}
                  </div>
                ) : undefined
              }
            />
            </div>
          );
        })}
        </div>
      )}
      {hasCards && deckFull && <p className="shop-warning">Deck complet : vends une carte ci-dessous pour faire de la place.</p>}
      {hasCards && <DeckBar run={run} busy={busy} onSell={onSell} onMove={onMove} />}
    </Modal>
  );
}

export function PerksPanel({ run }: { run: PublicRunState | null }) {
  const perks = run?.perks ?? [];
  if (!run || run.mode === 'classic') return null;
  return (
    <Panel title="Améliorations" icon={Store}>
      {perks.length === 0 && !(run.forge ?? 0) ? (
        <div className="empty">Une amélioration permanente est proposée à chaque boutique.</div>
      ) : (
        <div className="passive-list">
          {(run.forge ?? 0) > 0 && (
            <div className="passive" title={FORGE_TEXT}>
              <Hammer className="icon" />
              <span>Forge</span>
              <span className="count">+{(run.forge ?? 0) * 8} %</span>
            </div>
          )}
          {perks.map((p) => {
            const meta = PERK_META[p];
            return (
              <div key={p} className="passive" title={meta.text}>
                <meta.icon className="icon" />
                <span>{meta.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
