import type { ModifierId } from '@autobattle/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FAMILIES, familyOf, familyText } from '@autobattle/shared';
import { cardMeta, LOOT_CATEGORIES, MODIFIER_META } from '../common/catalog';

interface HoverData {
  cardId: string;
  modifier: ModifierId | null;
  extra?: () => ReactNode;
  rect: DOMRect;
  /** Hovered element: the tooltip closes as soon as the pointer is no longer on it. */
  el?: Element;
}

const HoverContext = createContext<{ show: (d: HoverData) => void; hide: () => void } | null>(null);

const WIDTH = 290;

/**
 * One shared tooltip for every card on the page. Only this provider re-renders
 * on hover (its children are passed through untouched), so hovering stays
 * cheap even with dozens of cards on screen.
 */
export function CardHoverProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HoverData | null>(null);
  const api = useMemo(() => ({ show: setData, hide: () => setData(null) }), []);
  const card = data ? cardMeta(data.cardId) : undefined;

  // mouseleave never fires when the hovered card is removed, moved or covered
  // (sold, reordered, modal closed…): check the real pointer position instead.
  useEffect(() => {
    if (!data) return;
    const hide = () => setData(null);
    const onMove = (e: PointerEvent) => {
      const el = data.el;
      if (!el || !el.isConnected || !(e.target instanceof Node) || !el.contains(e.target)) hide();
    };
    const onVisibility = () => document.hidden && hide();
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', hide);
    // The card can also vanish under a still pointer.
    const watch = setInterval(() => data.el && !data.el.isConnected && hide(), 250);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', hide);
      clearInterval(watch);
    };
  }, [data]);

  let tooltip: ReactNode = null;
  if (data && card) {
    const { rect } = data;
    const right = rect.right + 12 + WIDTH <= window.innerWidth;
    const left = right ? rect.right + 12 : Math.max(8, rect.left - 12 - WIDTH);
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 330));
    const color = LOOT_CATEGORIES[card.rarity].color;
    const mod = data.modifier ? MODIFIER_META[data.modifier] : null;
    tooltip = createPortal(
      <div className="card-hover" style={{ left, top, width: WIDTH, ['--rarity' as string]: color }}>
        <div className="card-hover-head">
          <img src={`/img/cartes/${card.image}`} alt="" />
          <div>
            <strong>{card.name}</strong>
            <span className="rarity">{card.rarityName}</span>
          </div>
        </div>
        <ul>
          {card.effects.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          {mod && (
            <li className="mod">
              Édition {mod.name} : {mod.description}
            </li>
          )}
          {(() => {
            const fam = familyOf(data.cardId);
            if (!fam) return null;
            const f = FAMILIES[fam];
            return (
              <li className="fam">
                {f.name} : 2 cartes {familyText(f, 1)}, 3 cartes {familyText(f, 2)}, 4 cartes {familyText(f, 3)}
              </li>
            );
          })()}
        </ul>
        {data.extra?.()}
      </div>,
      document.body,
    );
  }

  return (
    <HoverContext.Provider value={api}>
      {children}
      {tooltip}
    </HoverContext.Provider>
  );
}

/** Spread the result on any element that represents a card. No-op without a provider. */
export function useCardHover(cardId: string, modifier: ModifierId | null = null, extra?: () => ReactNode) {
  const ctx = useContext(HoverContext);
  const onMouseEnter = useCallback(
    (e: { currentTarget: Element }) => ctx?.show({ cardId, modifier, extra, rect: e.currentTarget.getBoundingClientRect(), el: e.currentTarget }),
    [ctx, cardId, modifier, extra],
  );
  const onMouseLeave = useCallback(() => ctx?.hide(), [ctx]);
  return ctx ? { onMouseEnter, onMouseLeave, onFocus: onMouseEnter, onBlur: onMouseLeave } : {};
}
