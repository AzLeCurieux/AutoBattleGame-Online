import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { ModifierId } from '@autobattle/shared';
import { cardMeta, LOOT_CATEGORIES } from '../common/catalog';
import { useCardHover } from './CardHover';

export const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

// ------------------------------------------------------------------ panel

export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title !== undefined && (
        <div className="panel-head">
          {Icon && <Icon className="icon" />}
          <span>{title}</span>
          <span className="spacer" />
          {actions}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

// -------------------------------------------------------------------- bar

export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="bar">
      <span style={{ transform: `scaleX(${ratio})`, ...(color ? cssVars({ '--bar-color': color }) : {}) }} />
    </div>
  );
}

export function hpColor(hp: number, max: number) {
  const r = max > 0 ? hp / max : 0;
  return r > 0.6 ? 'var(--hp)' : r > 0.3 ? 'var(--hp-mid)' : 'var(--hp-low)';
}

// ------------------------------------------------------------------- tabs

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={`tab ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ modal

/**
 * Stays mounted while its exit animation plays, then unmounts. No class
 * juggling on a long-lived node (the v1 source of flicker).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  wide,
  size,
  children,
  footer,
}: {
  open: boolean;
  onClose?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  wide?: boolean;
  size?: 'xl';
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 140);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      data-state={closing ? 'closing' : 'open'}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`modal ${wide ? 'wide' : ''} ${size ?? ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {Icon && <Icon className="icon" style={{ color: 'var(--accent)', width: 22, height: 22 }} />}
          <h2>{title}</h2>
          {onClose && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fermer">
              <X className="icon" />
            </button>
          )}
        </div>
        {subtitle && <p className="modal-sub">{subtitle}</p>}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ----------------------------------------------------------------- toasts

export interface ToastInput {
  title: string;
  text?: string;
  icon?: LucideIcon;
  image?: string;
  color?: string;
  duration?: number;
}
interface Toast extends ToastInput {
  id: number;
  leaving: boolean;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-4), { ...t, id, leaving: false }]);
    setTimeout(() => setToasts((list) => list.map((x) => (x.id === id ? { ...x, leaving: true } : x))), t.duration ?? 3500);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), (t.duration ?? 3500) + 220);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {toasts.map(({ id, leaving, title, text, icon: Icon, image, color }) => (
            <div key={id} className="toast" data-leaving={leaving || undefined} style={color ? cssVars({ '--toast-color': color }) : undefined}>
              {image ? <img src={image} alt="" /> : Icon ? <Icon className="icon" /> : null}
              <div>
                <div className="toast-title">{title}</div>
                {text && <div className="toast-text">{text}</div>}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// -------------------------------------------------------------- card tile

export function CardTile({
  cardId,
  locked,
  selected,
  onClick,
  showEffect,
  cornerLeft,
  corner,
  footer,
  className = '',
  modifier = null,
  hoverExtra,
}: {
  /** Shown in the hover tooltip. */
  modifier?: ModifierId | null;
  /** Extra tooltip content (stat preview…), computed only when hovered. */
  hoverExtra?: () => ReactNode;
  cardId: string;
  locked?: boolean;
  selected?: boolean;
  onClick?: () => void;
  showEffect?: boolean;
  cornerLeft?: ReactNode;
  corner?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const card = cardMeta(cardId);
  const hover = useCardHover(cardId, modifier, hoverExtra);
  if (!card) return null;
  const color = LOOT_CATEGORIES[card.rarity].color;
  return (
    <div
      {...hover}
      className={`card-tile ${onClick ? 'interactive' : ''} ${locked ? 'locked' : ''} ${selected ? 'selected' : ''} ${className}`}
      style={cssVars({ '--rarity': color })}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <div className="art">
        <img src={`/img/cartes/${card.image}`} alt={card.name} loading="lazy" draggable={false} />
      </div>
      {cornerLeft && <div className="corner-left">{cornerLeft}</div>}
      {corner && <div className="corner">{corner}</div>}
      <div className="meta">
        <div className="name">{card.name}</div>
        <div className="rarity">{card.rarityName}</div>
        {showEffect && card.effects.map((line, i) => (
          <div key={i} className="effect">
            {line}
          </div>
        ))}
        {footer}
      </div>
    </div>
  );
}
