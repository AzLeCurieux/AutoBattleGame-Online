import { deckLimit, type DeckCard, type PublicRunState } from '@autobattle/shared';
import { Layers, VolumeX } from 'lucide-react';
import { forwardRef, memo } from 'react';
import { CARD_COLORS, cardMeta } from '../../common/catalog';
import { useCardHover } from '../../ui/CardHover';
import { cssVars } from '../../ui/components';

/** One card: just its art. Effects are in the hover tooltip; triggers are animated by the Arena. */
const JokerTile = memo(function JokerTile({ entry, slot, silenced }: { entry: DeckCard; slot: number; silenced: boolean }) {
  const card = cardMeta(entry.cardId)!;
  const hover = useCardHover(entry.cardId, entry.modifier);
  return (
    <div
      {...hover}
      tabIndex={0}
      className={`joker ${silenced ? 'silenced' : ''} ${entry.modifier ? `mod-${entry.modifier}` : ''}`}
      data-slot={slot}
      aria-label={card.name}
      style={cssVars({ '--slot-color': CARD_COLORS[card.rarity] })}
    >
      <img src={`/img/cartes/${card.image}`} alt="" draggable={false} />
      {entry.modifier && <span className="joker-mod" />}
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
