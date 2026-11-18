import { CARDS, CASE_BY_ID, isCaseId, RARITIES, rarityOdds, type CaseId, type CaseOpening, type InventoryCase, type Rarity } from '@autobattle/shared';
import { Dices, Package, Palette as PaletteIcon, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSoundtrack } from '../../common/MusicControl';
import { playReveal } from './reveal';
import { api, ApiError } from '../../common/api';
import { audio } from '../../common/audio';
import { CASE_ORDER, caseMeta, cardMeta, LOOT_CATEGORIES } from '../../common/catalog';
import { Navbar } from '../../common/Navbar';
import { DEFAULT_PALETTE, hexToRgb, rgbToHex, type Palette, type Rgb, type ShaderBackground } from '../../common/shader';
import { useSocketEvent } from '../../common/socket';
import { Bar, CardTile, cssVars, Modal, Tabs, useToast } from '../../ui/components';

const TOTAL = 120;
const WINNER = 104;
const SPIN_MS = 6500;
/** Several cases: every reel spins at once and they stop one after the other. */
const MULTI_SPIN_MS = 5200;
const STOP_STAGGER_MS = 160;
const QUANTITIES = [['1', '×1'], ['3', '×3'], ['5', '×5'], ['10', '×10']] as const;
type Qty = (typeof QUANTITIES)[number][0];

function randomCardOf(rarity: Rarity) {
  const pool = CARDS.filter((c) => c.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)]!.id;
}

function weightedCard(caseId: CaseId) {
  const odds = rarityOdds(CASE_BY_ID.get(caseId)!);
  let roll = Math.random();
  for (const r of RARITIES) {
    roll -= odds[r];
    if (roll <= 0) return randomCardOf(r);
  }
  return randomCardOf('consumer');
}

const tierOf = (cardId: string) => RARITIES.indexOf(cardMeta(cardId)!.rarity);

function reelCard(cardId: string): HTMLElement {
  const meta = cardMeta(cardId)!;
  const color = LOOT_CATEGORIES[meta.rarity].color;
  const node = document.createElement('div');
  node.className = 'reel-card';
  node.style.setProperty('--tier', String(tierOf(cardId)));
  node.style.setProperty('--rarity', color);
  const img = document.createElement('img');
  img.src = `/img/cartes/${meta.image}`;
  img.alt = '';
  img.draggable = false;
  const name = document.createElement('div');
  name.className = 'reel-name';
  name.textContent = meta.name;
  node.append(img, name);
  return node;
}

/** One reel row: viewport, strip of cards and the centre marker. */
function reelRow(): { row: HTMLElement; reel: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'reel-viewport';
  const reel = document.createElement('div');
  reel.className = 'reel';
  const marker = document.createElement('div');
  marker.className = 'reel-marker';
  row.append(reel, marker);
  return { row, reel };
}

/** Rows get smaller the more cases are opened at once, so all of them stay on screen. */
const stackSize = (rows: number) => (rows <= 1 ? 'rows-1' : rows <= 3 ? 'rows-m' : rows <= 5 ? 'rows-s' : 'rows-xs');

function translateX(el: HTMLElement) {
  const m = getComputedStyle(el).transform;
  if (!m || m === 'none') return 0;
  return new DOMMatrixReadOnly(m).m41;
}

const hexToPalette = (hex: string): Palette => {
  const base = hexToRgb(hex)!;
  const scale = (c: Rgb, f: number): Rgb => ({ r: Math.min(1, c.r * f), g: Math.min(1, c.g * f), b: Math.min(1, c.b * f) });
  return [scale(base, 1.4), base, scale(base, 0.25)];
};

/** GamblingPage.getCaseBackgroundColors of v1. */
function casePalette(caseId: string): Palette {
  const level = caseMeta(caseId).levelRange[0];
  const hex =
    level <= 39 ? '#b0c3d9' : level <= 49 ? '#5e98d9' : level <= 59 ? '#4b69ff' : level <= 69 ? '#74388a' : level <= 79 ? '#8a3883' : level <= 89 ? '#e506bc' : level <= 99 ? '#eb4b4b' : '#e4ae39';
  const base = hexToRgb(hex)!;
  const scale = (c: Rgb, f: number): Rgb => ({ r: Math.min(1, c.r * f), g: Math.min(1, c.g * f), b: Math.min(1, c.b * f) });
  return [scale(base, 1.3), base, scale(base, 0.3)];
}

const PRESETS: [string, Palette][] = [
  ['Par défaut', DEFAULT_PALETTE],
  ['Bleu', [{ r: 0.1, g: 0.3, b: 0.7 }, { r: 0.05, g: 0.15, b: 0.35 }, { r: 0.02, g: 0.05, b: 0.15 }]],
  ['Violet', [{ r: 0.5, g: 0.1, b: 0.7 }, { r: 0.25, g: 0.05, b: 0.35 }, { r: 0.1, g: 0.02, b: 0.15 }]],
  ['Vert', [{ r: 0.1, g: 0.6, b: 0.2 }, { r: 0.05, g: 0.3, b: 0.1 }, { r: 0.02, g: 0.12, b: 0.04 }]],
  ['Or', [{ r: 0.9, g: 0.7, b: 0.1 }, { r: 0.6, g: 0.4, b: 0.05 }, { r: 0.2, g: 0.15, b: 0.02 }]],
];

function initialCase(): CaseId | null {
  const id = new URLSearchParams(window.location.search).get('case');
  return id && isCaseId(id) ? id : null;
}

export function GamblingPage({ shader }: { shader: ShaderBackground }) {
  const toast = useToast();
  const [inventory, setInventory] = useState<InventoryCase[] | null>(null);
  const [selected, setSelected] = useState<CaseId | null>(initialCase);
  const [qty, setQty] = useState<Qty>('1');
  const [animations, setAnimations] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState<CaseOpening[] | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [pickers, setPickers] = useState<string[]>(['#951313', '#262626', '#0d0d0d']);
  const stackRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [revealing, setRevealing] = useState(false);
  // Case opening is booster time; a Covert or Gold reveal brings in the big theme.
  useSoundtrack(revealing ? 'celestial' : 'arcana');

  const load = useCallback(async () => {
    try {
      const inv = await api.inventory();
      setInventory(inv.cases);
      return inv.cases;
    } catch {
      setInventory([]);
      return [];
    }
  }, []);

  /** Builds `count` empty reel rows and returns their strips. */
  const buildRows = useCallback((count: number) => {
    const stack = stackRef.current!;
    stack.className = `reel-stack ${stackSize(count)}`;
    const rows = Array.from({ length: count }, reelRow);
    stack.replaceChildren(...rows.map((r) => r.row));
    return rows.map((r) => r.reel);
  }, []);

  const idleReel = useCallback(
    (caseId: CaseId | null) => {
      const [reel] = buildRows(1);
      reel!.replaceChildren(...Array.from({ length: 12 }, () => reelCard(caseId ? weightedCard(caseId) : randomCardOf(RARITIES[Math.floor(Math.random() * 4)]!))));
      const card = reel!.firstElementChild as HTMLElement;
      reel!.style.transform = `translateX(${-(card.offsetWidth + parseFloat(getComputedStyle(reel!).columnGap || '10')) * 2}px)`;
    },
    [buildRows],
  );

  useEffect(() => {
    void load().then((cases) => {
      // Auto-select the first case type the player owns.
      setSelected((s) => (s && cases.some((c) => c.caseId === s) ? s : (CASE_ORDER.find((id) => cases.some((c) => c.caseId === id)) as CaseId | undefined) ?? null));
    });
  }, [load]);

  useEffect(() => {
    if (!spinning) idleReel(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the selection changes
  }, [selected, idleReel]);

  useSocketEvent('inventory:sync', () => {
    if (!spinning) void load();
  });

  const countOf = (id: string | null) => (inventory ?? []).filter((c) => c.caseId === id).length;
  const available = countOf(selected);
  const n = Number(qty);

  const finish = (openings: CaseOpening[], caseId: CaseId) => {
    setResults(openings);
    setSpinning(false);
    shader.reset();
    void load().then((cases) => {
      const left = cases.filter((c) => c.caseId === caseId).length;
      if (left < n) setQty('1');
      if (left === 0) setSelected((CASE_ORDER.find((id) => cases.some((c) => c.caseId === id)) as CaseId | undefined) ?? null);
    });
  };

  const open = async () => {
    if (!selected || spinning || available < n) return;
    const caseId = selected;
    setSpinning(true);
    let openings: CaseOpening[];
    try {
      openings = await api.openMany(caseId, n);
    } catch (err) {
      toast({ title: 'Ouverture impossible', text: err instanceof ApiError ? err.message : 'Erreur de connexion', icon: X, color: 'var(--danger)' });
      setSpinning(false);
      return;
    }
    if (!animations) return finish(openings, caseId);

    shader.setColors(...casePalette(caseId));
    const reels = buildRows(openings.length);
    const base = openings.length > 1 ? MULTI_SPIN_MS : SPIN_MS;
    audio.spinStart();

    const spins = reels.map((reel, i) => {
      const winner = openings[i]!.cardId;
      reel.replaceChildren(...Array.from({ length: TOTAL }, (_, k) => reelCard(k === WINNER ? winner : weightedCard(caseId))));
      const card = reel.firstElementChild as HTMLElement;
      const step = card.offsetWidth + parseFloat(getComputedStyle(reel).columnGap || '10');
      const viewport = reel.parentElement!.getBoundingClientRect().width;
      const spread = card.offsetWidth - 24;
      const jitter = Math.floor(Math.random() * spread) - spread / 2;
      const target = -(step * WINNER + card.offsetWidth / 2 - viewport / 2 + jitter);
      const anim = reel.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${target}px)` }], {
        duration: base + i * STOP_STAGGER_MS,
        easing: 'cubic-bezier(0.12, 0.8, 0.2, 1)',
        fill: 'forwards',
      });
      return { reel, anim, step, viewport, winner };
    });

    // Tick each time a card crosses the marker of the first reel (CS-style).
    const first = spins[0]!;
    let lastIndex = -1;
    let lastTick = 0;
    let ticking = true;
    const tickLoop = (now: number) => {
      if (!ticking) return;
      const idx = Math.floor((-translateX(first.reel) + first.viewport / 2) / first.step);
      if (idx !== lastIndex && now - lastTick > 28) {
        lastIndex = idx;
        lastTick = now;
        audio.tick(0.92 + Math.random() * 0.16);
      }
      requestAnimationFrame(tickLoop);
    };
    requestAnimationFrame(tickLoop);
    first.anim.finished.then(() => (ticking = false), () => (ticking = false));

    // Each reel lights up its card when it stops.
    await Promise.all(
      spins.map(({ reel, anim, winner }) =>
        anim.finished.then(() => {
          const tier = tierOf(winner);
          reel.children[WINNER]?.classList.add('won');
          reel.parentElement!.classList.add('stopped', `tier-${tier}`);
          audio.reelStop(tier);
        }),
      ),
    ).catch(() => undefined);
    ticking = false;

    // The best card gets the full-screen reveal (always for a single case).
    const best = openings.reduce((a, b) => (tierOf(b.cardId) > tierOf(a.cardId) ? b : a));
    const tier = tierOf(best.cardId);
    if (openings.length === 1 || tier >= 3) {
      await new Promise((r) => setTimeout(r, 350));
      const meta = cardMeta(best.cardId)!;
      const color = LOOT_CATEGORIES[meta.rarity].color;
      if (tier >= 4) {
        shader.setColors(...hexToPalette(color));
        shader.setFx(
          tier >= 6
            ? { speed: 3.2, spin: 0.7, contrast: 4, pulse: 0.35, beat: 'heart', rate: 1.4 }
            : tier >= 5
              ? { speed: 2.6, spin: 0.6, contrast: 3.8, pulse: 0.28, beat: 'flash', rate: 0.9 }
              : { speed: 2, spin: 0.5, pulse: 0.15, beat: 'wave', rate: 0.8 },
        );
      }
      if (tier >= 5) setRevealing(true);
      audio.reveal(tier);
      await playReveal({ tier, color, image: `/img/cartes/${meta.image}`, shake: mainRef.current });
      setRevealing(false);
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }
    finish(openings, caseId);
  };

  const applyPicker = (i: number, hex: string) => {
    const rgb = hexToRgb(hex);
    setPickers((p) => p.map((v, j) => (j === i ? hex : v)));
    if (!rgb) return;
    const t = [...shader.targetColors] as Palette;
    t[i] = rgb;
    shader.setColors(...t);
  };

  const odds = selected ? rarityOdds(CASE_BY_ID.get(selected)!) : null;
  const meta = selected ? caseMeta(selected) : null;
  const groups = CASE_ORDER.map((id) => ({ meta: caseMeta(id), n: countOf(id) }));
  const newCount = results?.filter((r) => r.isNew).length ?? 0;

  return (
    <>
      <Navbar page="gambling" />
      <main className="page gambling" ref={mainRef}>
        <aside className="panel case-picker">
          <div className="panel-head">
            <Package className="icon" />
            <span>Tes caisses</span>
            <span className="spacer" />
            <span>{inventory?.length ?? 0}</span>
          </div>
          <div className="case-options">
            {groups.map(({ meta: m, n: count }) => (
              <button
                key={m.id}
                className={`case-option ${selected === m.id ? 'active' : ''}`}
                disabled={count === 0 || spinning}
                onClick={() => setSelected(m.id)}
                style={cssVars({ '--case': m.color })}
              >
                <img src={m.image} alt="" />
                <span className="case-name">
                  {m.name.replace(/\s*\(.*\)/, '')}
                  <small>Niv. {m.levelRange[0] === 100 ? '100+' : `${m.levelRange[0]}–${m.levelRange[1]}`}</small>
                </span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="gambling-main">
          <div className="panel reel-panel">
            <div className="reel-stack rows-1" ref={stackRef} />
          </div>

          <div className="panel case-hero">
            {meta && odds ? (
              <>
                <div className="hero-art" style={cssVars({ '--case': meta.color })}>
                  <img src={meta.imageLarge} alt={meta.name} />
                </div>
                <div className="hero-info">
                  <h1>{meta.name.replace(/\s*\(.*\)/, '')}</h1>
                  <p className="muted">
                    {available} disponible{available > 1 ? 's' : ''} · tombe aux niveaux{' '}
                    {meta.levelRange[0] === 100 ? '100 et plus' : `${meta.levelRange[0]} à ${meta.levelRange[1]}`}
                  </p>
                  <div className="odds">
                    {RARITIES.map((r) => (
                      <div key={r} className="odd-row">
                        <span className="dot" style={cssVars({ '--dot': LOOT_CATEGORIES[r].color })} />
                        <span className="odd-name">{LOOT_CATEGORIES[r].name}</span>
                        <Bar value={odds[r]} max={Math.max(...Object.values(odds))} color={LOOT_CATEGORIES[r].color} />
                        <span className="odd-pct">{(odds[r] * 100).toFixed(odds[r] < 0.01 ? 2 : 1)} %</span>
                      </div>
                    ))}
                  </div>
                  <div className="open-row">
                    <Tabs value={qty} onChange={(v) => !spinning && Number(v) <= available && setQty(v)} options={QUANTITIES} />
                    <label className="switch">
                      <input type="checkbox" checked={animations} onChange={(e) => setAnimations(e.target.checked)} />
                      Animation
                    </label>
                    <button className="btn btn-accent btn-lg" disabled={spinning || available < n} onClick={() => void open()}>
                      <Dices className="icon" />
                      {spinning ? 'Ouverture…' : `Ouvrir ${n > 1 ? `${n} caisses` : 'la caisse'}`}
                    </button>
                  </div>
                  {available < n && <p className="muted" style={{ fontSize: 12 }}>Pas assez de caisses pour ×{n}.</p>}
                </div>
              </>
            ) : (
              <div className="empty" style={{ padding: 40 }}>
                {inventory === null ? 'Chargement…' : 'Aucune caisse à ouvrir. Elles tombent au niveau 3 puis tous les 10 niveaux.'}
              </div>
            )}
          </div>
        </section>
      </main>

      <button className="fab" title="Couleurs du fond" onClick={() => {
        setPickers(shader.currentColors.map(rgbToHex));
        setColorsOpen((o) => !o);
      }}>
        <PaletteIcon className="icon" />
      </button>
      {colorsOpen && (
        <div className="panel color-popover">
          <div className="panel-head">
            <PaletteIcon className="icon" /> Couleurs du fond
            <span className="spacer" />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setColorsOpen(false)} aria-label="Fermer">
              <X className="icon" />
            </button>
          </div>
          <div className="panel-body color-body">
            {['Principale', 'Secondaire', 'Fond'].map((label, i) => (
              <label key={label} className="color-row">
                <span>{label}</span>
                <input type="color" value={pickers[i]} onChange={(e) => applyPicker(i, e.target.value)} />
              </label>
            ))}
            <div className="chips">
              {PRESETS.map(([label, p]) => (
                <button
                  key={label}
                  className="chip"
                  onClick={() => {
                    shader.setColors(...p);
                    setPickers(p.map(rgbToHex));
                  }}
                >
                  <span className="dot" style={cssVars({ '--dot': rgbToHex(p[0]) })} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={results !== null}
        onClose={() => setResults(null)}
        wide={(results?.length ?? 0) > 1}
        icon={Sparkles}
        title={(results?.length ?? 0) > 1 ? `${results!.length} cartes obtenues` : 'Carte obtenue'}
        subtitle={newCount > 0 ? `${newCount} nouvelle${newCount > 1 ? 's' : ''} carte${newCount > 1 ? 's' : ''} dans ta collection` : 'Doublon ajouté à ta collection'}
        footer={
          <>
            <a className="btn" href="/inventory" style={{ marginRight: 'auto' }}>
              Voir la collection
            </a>
            <button className="btn btn-primary" onClick={() => setResults(null)}>
              Continuer
            </button>
          </>
        }
      >
        <div className={`reveal-grid ${(results?.length ?? 0) === 1 ? 'single' : ''}`}>
          {results?.map((r, i) => (
            <div key={`${r.caseRowId}`} className={`reveal-item tier-${tierOf(r.cardId)}`} style={cssVars({ '--i': i, '--rarity': LOOT_CATEGORIES[cardMeta(r.cardId)!.rarity].color })}>
              <CardTile cardId={r.cardId} showEffect cornerLeft={r.isNew ? <span className="badge badge-accent">Nouvelle</span> : undefined} />
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
