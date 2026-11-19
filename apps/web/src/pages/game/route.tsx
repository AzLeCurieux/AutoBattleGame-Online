import { deckFamilies, familyText, ITEMS, MAX_ITEMS, type ItemId, type NodeKind, type PathTheme, type PublicRunState } from '@autobattle/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Backpack,
  Coins,
  Compass,
  Crown,
  Flame,
  Map as MapIcon,
  FlaskConical,
  Gem,
  HelpCircle,
  Shield,
  Skull,
  Sparkles,
  Store,
  Swords,
  Tent,
  Users,
  Wand2,
} from 'lucide-react';
import { cssVars, Panel } from '../../ui/components';

export const NODE_META: Record<NodeKind, { name: string; text: string; icon: LucideIcon; color: string }> = {
  fight: { name: 'Combat', text: 'Un ennemi de l’acte. Gagne une amélioration et de l’or.', icon: Swords, color: '#60a5fa' },
  elite: { name: 'Élite', text: 'Plus coriace, rapporte plus d’or.', icon: Skull, color: '#f87171' },
  camp: { name: 'Camp', text: 'Repos ou entraînement : soin, ou gros bonus de stats.', icon: Tent, color: '#4ade80' },
  event: { name: 'Événement', text: 'Une rencontre : un pari, un pacte ou une occasion.', icon: HelpCircle, color: '#c084fc' },
  treasure: { name: 'Trésor', text: 'De l’or ou un objet.', icon: Gem, color: '#f5b244' },
  shop: { name: 'Boutique', text: 'Une boutique en cours d’acte (sans intérêts).', icon: Store, color: '#38bdf8' },
  boss: { name: 'Boss', text: 'La fin de l’acte.', icon: Crown, color: '#fbbf24' },
  skip: { name: 'Contourner l’élite', text: 'Pas de combat : un objet et 3 or.', icon: Compass, color: '#94a3b8' },
};

export const ITEM_META: Record<ItemId, { icon: LucideIcon; color: string }> = {
  potion: { icon: FlaskConical, color: '#4ade80' },
  whetstone: { icon: Swords, color: '#fb923c' },
  shield: { icon: Shield, color: '#60a5fa' },
  luckyCoin: { icon: Coins, color: '#f5b244' },
  prism: { icon: Sparkles, color: '#c084fc' },
  compass: { icon: Compass, color: '#94a3b8' },
};

export const PATH_META: Record<PathTheme, { name: string; text: string; icon: LucideIcon; color: string }> = {
  battle: { name: 'Sentier des combats', text: 'Que des combats : plus d’améliorations et d’or.', icon: Swords, color: '#f87171' },
  calm: { name: 'Chemin calme', text: 'Souffler, se soigner, ramasser un trésor.', icon: Tent, color: '#4ade80' },
  mystery: { name: 'Chemin mystérieux', text: 'Des rencontres incertaines : paris et pactes.', icon: HelpCircle, color: '#c084fc' },
  market: { name: 'Route marchande', text: 'Une boutique en chemin, puis un trésor.', icon: Store, color: '#38bdf8' },
  challenge: { name: 'Défier l’élite', text: 'L’élite rapporte gros, si tu tiens le choc.', icon: Skull, color: '#fb7185' },
  bypass: { name: 'Contourner', text: 'Éviter l’élite et récupérer un objet au passage.', icon: Compass, color: '#94a3b8' },
};

/** Path choice at a junction of the act (steps 2, 5 and 8): each path plays its steps on its own. */
export function RouteChoice({ run, busy, onChoose }: { run: PublicRunState; busy: boolean; onChoose: (index: number) => void }) {
  const route = run.route;
  if (!route) return null;
  return (
    <div className="route-choice" role="group" aria-label="Choisis ton chemin">
      <div className="route-title">
        <MapIcon className="icon" /> Choisis ton chemin
      </div>
      <div className="route-options">
        {route.map((path, i) => {
          const meta = PATH_META[path.theme];
          return (
            <button key={i} className={`route-node path-${path.theme}`} disabled={busy} style={cssVars({ '--node': meta.color, '--i': i })} onClick={() => onChoose(i)}>
              <span className="route-icon">
                <meta.icon className="icon" />
              </span>
              <strong>{meta.name}</strong>
              <small>{meta.text}</small>
              <span className="route-steps">
                {path.steps.map((step, k) => {
                  const m = NODE_META[step.kind];
                  const item = step.item ? ITEMS[step.item] : null;
                  return (
                    <span key={k} className={`route-step node-${step.kind}`} style={cssVars({ '--step': m.color })} title={`${m.name}${item ? ` · ${item.name}` : ''}`}>
                      <m.icon className="icon" />
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Short arrival scene when a path reaches a step that is not a fight: the
 * camp fire catches, the chest bursts open, the event card flips, the shop
 * opens. Plays in the arena before the step's window.
 */
export function NodeArrival({ kind }: { kind: NodeKind | null }) {
  if (!kind || kind === 'fight' || kind === 'elite' || kind === 'boss') return null;
  const meta = NODE_META[kind];
  const Icon = kind === 'camp' ? Flame : meta.icon;
  return (
    <div className={`node-arrival arrive-${kind}`} style={cssVars({ '--node': meta.color })} aria-hidden>
      <div className="arrive-glow" />
      {kind === 'camp' && (
        <div className="arrive-embers">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={cssVars({ '--e': i })} />
          ))}
        </div>
      )}
      {kind === 'treasure' && <div className="arrive-rays" />}
      <div className="arrive-token">
        <Icon className="icon" />
      </div>
      <div className="arrive-name">{meta.name}</div>
    </div>
  );
}

/** Items held, usable between fights (and in the shop). */
export function ItemsPanel({ run, busy, onUse }: { run: PublicRunState | null; busy: boolean; onUse: (index: number) => void }) {
  const items = run?.items ?? [];
  const buffs = run?.buffs ?? {};
  const usable = run?.phase === 'ready' || run?.phase === 'shop';
  const active = [buffs.damage && `+${buffs.damage} % dégâts`, buffs.shield && `-${buffs.shield} % dégâts reçus`, buffs.gold && buffs.gold > 1 && `or ×${buffs.gold}`].filter(Boolean);
  if ((run?.mode ?? 'deck') !== 'deck') return null;
  return (
    <Panel title={`Objets ${items.length}/${MAX_ITEMS}`} icon={Backpack}>
      {items.length === 0 && active.length === 0 ? (
        <div className="empty">Trésors, événements, boutique ou élite contournée en donnent.</div>
      ) : (
        <div className="item-list">
          {items.map((id, i) => {
            const meta = ITEM_META[id];
            return (
              <button key={i} className="item-slot" disabled={busy || !usable} title={ITEMS[id].text} style={cssVars({ '--item': meta.color })} onClick={() => onUse(i)}>
                <meta.icon className="icon" />
                <span>
                  {ITEMS[id].name}
                  <small>{ITEMS[id].text}</small>
                </span>
              </button>
            );
          })}
          {active.length > 0 && (
            <div className="item-buffs">
              <Wand2 className="icon" /> Prochain combat : {active.join(' · ')}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Team bonuses of the deck (2, 3, 4 cards of the same friend). */
export function FamilyChips({ run }: { run: PublicRunState }) {
  const families = deckFamilies(run.deck.map((d) => d.cardId)).filter((f) => f.count >= 1);
  if (families.length === 0) return null;
  return (
    <div className="family-chips">
      {families.map((f) => (
        <span
          key={f.family.id}
          className={`family-chip ${f.tier > 0 ? 'on' : ''}`}
          title={`${f.family.name} : 2 cartes ${familyText(f.family, 1)}, 3 cartes ${familyText(f.family, 2)}, 4 cartes ${familyText(f.family, 3)}`}
        >
          <Users className="icon" /> {f.family.name.replace('Clan ', '')} {f.count}/4
          {f.tier > 0 && <em>{familyText(f.family, f.tier)}</em>}
        </span>
      ))}
    </div>
  );
}
