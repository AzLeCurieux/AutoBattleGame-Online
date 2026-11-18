import { CARDS, RARITIES, type InventoryCard, type InventoryCase, type Rarity } from '@autobattle/shared';
import { ArrowDownWideNarrow, Coins, Dices, Layers, Lock, Package, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../common/api';
import { CASE_ORDER, caseMeta, cardMeta, LOOT_CATEGORIES } from '../../common/catalog';
import { useSoundtrack } from '../../common/MusicControl';
import { Navbar } from '../../common/Navbar';
import { useSocketEvent } from '../../common/socket';
import { Bar, CardTile, cssVars } from '../../ui/components';

type Sort = 'rarity' | 'name' | 'count' | 'recent';
const SORTS: [Sort, string][] = [
  ['rarity', 'Rareté'],
  ['recent', 'Plus récentes'],
  ['count', 'Quantité'],
  ['name', 'Nom'],
];

const rarityRank = (r: Rarity) => RARITIES.indexOf(r);

/** Collection page: every card (owned or locked), filters, sort, search and a detail panel. */
export function InventoryPage() {
  useSoundtrack('shop');
  const [owned, setOwned] = useState<Map<string, InventoryCard> | null>(null);
  const [cases, setCases] = useState<InventoryCase[]>([]);
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<Sort>('rarity');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = () =>
    void api.inventory().then(
      (inv) => {
        setOwned(new Map(inv.cards.map((c) => [c.cardId, c])));
        setCases(inv.cases);
      },
      () => setOwned(new Map()),
    );
  useEffect(load, []);
  useSocketEvent('inventory:sync', load);

  const ownedCount = owned ? CARDS.filter((c) => owned.has(c.id)).length : 0;
  const perRarity = useMemo(
    () =>
      RARITIES.map((r) => {
        const all = CARDS.filter((c) => c.rarity === r);
        return { r, total: all.length, have: all.filter((c) => owned?.has(c.id)).length };
      }),
    [owned],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = CARDS.filter((c) => (rarity === 'all' || c.rarity === rarity) && (!ownedOnly || owned?.has(c.id)))
      .map((c) => ({ card: c, meta: cardMeta(c.id)!, inv: owned?.get(c.id) }))
      .filter(({ meta }) => !q || meta.name.toLowerCase().includes(q) || meta.effect.toLowerCase().includes(q));
    const byRarity = (a: (typeof rows)[number], b: (typeof rows)[number]) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity);
    rows.sort((a, b) => {
      if (!!a.inv !== !!b.inv) return a.inv ? -1 : 1; // owned first
      if (sort === 'name') return a.meta.name.localeCompare(b.meta.name, 'fr');
      if (sort === 'count') return (b.inv?.count ?? 0) - (a.inv?.count ?? 0) || byRarity(a, b);
      if (sort === 'recent') return (b.inv?.lastObtainedAt ?? 0) - (a.inv?.lastObtainedAt ?? 0);
      return byRarity(a, b) || a.meta.name.localeCompare(b.meta.name, 'fr');
    });
    return rows;
  }, [owned, query, rarity, sort, ownedOnly]);

  const caseGroups = CASE_ORDER.map((id) => ({ meta: caseMeta(id), n: cases.filter((c) => c.caseId === id).length })).filter((g) => g.n > 0);
  const detail = selected ? cardMeta(selected) : null;
  const detailInv = selected ? owned?.get(selected) : undefined;

  return (
    <>
      <Navbar page="inventory" />
      <main className="page inventory">
        <section className="panel inv-summary">
          <div className="inv-progress">
            <div className="inv-progress-head">
              <Layers className="icon" />
              <span>Collection</span>
              <strong>
                {ownedCount}/{CARDS.length}
              </strong>
            </div>
            <Bar value={ownedCount} max={CARDS.length} color="var(--accent)" />
            <div className="rarity-progress">
              {perRarity.map(({ r, total, have }) => (
                <div key={r} title={`${LOOT_CATEGORIES[r].name} : ${have}/${total}`}>
                  <span className="dot" style={cssVars({ '--dot': LOOT_CATEGORIES[r].color })} />
                  {have}/{total}
                </div>
              ))}
            </div>
          </div>
          <div className="inv-cases">
            <div className="inv-progress-head">
              <Package className="icon" />
              <span>Caisses à ouvrir</span>
              <strong>{cases.length}</strong>
            </div>
            {caseGroups.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                Aucune caisse. Elles tombent au niveau 3 puis tous les 10 niveaux.
              </div>
            ) : (
              <div className="case-strip">
                {caseGroups.map(({ meta, n }) => (
                  <a key={meta.id} className="case-chip" href={`/gambling?case=${meta.id}`} title={`Ouvrir : ${meta.name}`}>
                    <img src={meta.image} alt="" />
                    <span>{meta.name.replace(/\s*\(.*\)/, '')}</span>
                    <strong>×{n}</strong>
                  </a>
                ))}
                <a className="btn btn-accent btn-sm" href="/gambling">
                  <Dices className="icon" /> Ouvrir
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="panel inv-toolbar">
          <div className="input-icon" style={{ flex: '1 1 320px' }}>
            <Search className="icon" />
            <input className="input" placeholder="Rechercher une carte ou un effet…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="chips">
            <button className={`chip ${rarity === 'all' ? 'active' : ''}`} onClick={() => setRarity('all')}>
              Toutes <span className="count">{CARDS.length}</span>
            </button>
            {perRarity.map(({ r, total }) => (
              <button
                key={r}
                className={`chip ${rarity === r ? 'active' : ''}`}
                style={cssVars({ '--chip-color': LOOT_CATEGORIES[r].color })}
                onClick={() => setRarity(r)}
              >
                <span className="dot" style={cssVars({ '--dot': LOOT_CATEGORIES[r].color })} />
                {LOOT_CATEGORIES[r].name.replace(' Grade', '').replace(' / Gold', '')}
                <span className="count">{total}</span>
              </button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
            Possédées seulement
          </label>
          <div className="input-icon sort">
            <ArrowDownWideNarrow className="icon" />
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className={`inv-body ${detail ? 'with-detail' : ''}`}>
          <section className="inv-grid">
            {owned === null ? (
              Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton" />)
            ) : list.length === 0 ? (
              <div className="empty" style={{ gridColumn: '1/-1' }}>
                Aucune carte ne correspond.
              </div>
            ) : (
              list.map(({ card, inv }) => (
                <CardTile
                  key={card.id}
                  cardId={card.id}
                  locked={!inv}
                  selected={selected === card.id}
                  onClick={() => setSelected(selected === card.id ? null : card.id)}
                  showEffect
                  corner={inv ? inv.count > 1 && <span className="qty">×{inv.count}</span> : <Lock className="icon" style={{ color: 'var(--muted)' }} />}
                />
              ))
            )}
          </section>

          {detail && (
            <aside className="panel inv-detail" style={cssVars({ '--rarity': LOOT_CATEGORIES[detail.rarity].color })}>
              <button className="btn btn-ghost btn-icon btn-sm close" onClick={() => setSelected(null)} aria-label="Fermer">
                <X className="icon" />
              </button>
              <div className="detail-art">
                <img src={`/img/cartes/${detail.image}`} alt={detail.name} className={detailInv ? '' : 'locked'} />
              </div>
              <div className="detail-body">
                <span className="rarity-tag">{detail.rarityName}</span>
                <h2>{detail.name}</h2>
                <p className="detail-effect">
                  <Sparkles className="icon" /> {detail.effect}
                </p>
                <div className="detail-stats">
                  <div>
                    <span className="muted">Possédée</span>
                    <strong>{detailInv ? `×${detailInv.count}` : 'Non'}</strong>
                  </div>
                  <div>
                    <span className="muted">Valeur</span>
                    <strong>
                      <Coins className="icon" style={{ color: 'var(--accent)' }} /> {detail.value.toLocaleString('fr-FR')}
                    </strong>
                  </div>
                  <div>
                    <span className="muted">Dernière obtention</span>
                    <strong>{detailInv ? new Date(detailInv.lastObtainedAt).toLocaleDateString('fr-FR') : '-'}</strong>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12 }}>
                  {detailInv
                    ? 'En mode Deck, cette carte peut apparaître dans la boutique (tous les 10 niveaux).'
                    : 'Ouvre des caisses pour la débloquer.'}
                </p>
              </div>
            </aside>
          )}
        </div>
      </main>
    </>
  );
}
