import { cardLines, deckLimit, type DeckCard, type PublicRunState } from '@autobattle/shared';
import { Layers, VolumeX } from 'lucide-react';
import { forwardRef, memo } from 'react';
import { CARD_COLORS, cardMeta } from '../../common/catalog';
import { useCardHover } from '../../ui/CardHover';
import { cssVars } from '../../ui/components';
import { FamilyChips } from './route';

/** One card: just its art. Effects are in the hover tooltip; triggers are animated by the Arena. */
const JokerTile = memo(function JokerTile({ entry, slot, silenced }: { entry: DeckCard; slot: number; silenced: boolean }) {
  const card = cardMeta(entry.cardId)!;
  const level = entry.stars ?? 1;
  const hover = useCardHover(
    entry.cardId,
    entry.modifier,
    level > 1
      ? () => (
          <div className="hover-extra">
            <strong>Niveau {level}</strong> · effets +{(level - 1) * 50} %
            <ul>
              {cardLines(entry.cardId, level).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )
      : undefined,
  );
  return (
    <div
      {...hover}
      tabIndex={0}
      className={`joker r-${card.rarity} ${silenced ? 'silenced' : ''} ${entry.modifier ? `mod-${entry.modifier} ed-${entry.modifier}` : ''}`}
      data-glare
      data-slot={slot}
      aria-label={card.name}
      style={cssVars({ '--slot-color': CARD_COLORS[card.rarity] })}
    >
      <img src={`/img/cartes/${card.image}`} alt="" draggable={false} />
      <span className="card-sheen" aria-hidden />
      {entry.modifier && <span className="joker-mod" />}
      {level > 1 && <span className="joker-level">Niv. {level}</span>}
      {silenced && (
        <span className="joker-muted" title="Désactivée par Le Muet pendant ce combat">
          <VolumeX className="icon" />
        </span>
      )}
    </div>
  );
});

/**
 * The deck, always visible under the arena. A single row that scrolls
 * sideways when it gets long; it never pushes the layout.
 */
export const JokerBar = forwardRef<HTMLDivElement, { run: PublicRunState; silenced: number }>(function JokerBar({ run, silenced }, ref) {
  const limit = deckLimit(run.deck, run.perks);
  const free = Math.max(0, limit - run.deck.length);
  return (
    <div className="joker-zone">
      <div className="joker-head">
        <Layers className="icon" /> Deck {run.deck.length}/{limit}
        <span className="muted">· survole une carte pour voir ses effets</span>
        <FamilyChips run={run} />
      </div>
      <div className="joker-bar" ref={ref}>
        {run.deck.map((entry, i) => (
          <JokerTile key={`${i}-${entry.cardId}`} entry={entry} slot={i} silenced={i === silenced} />
        ))}
        {Array.from({ length: free }, (_, i) => (
          <div key={`empty-${i}`} className="joker empty" aria-hidden />
        ))}
      </div>
    </div>
  );
});
