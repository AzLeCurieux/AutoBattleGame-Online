import { MusicControl } from './MusicControl';
import { Dices, Package } from 'lucide-react';
import type { ReactNode } from 'react';

/** js/ui/Navbar.js — same markup and classes; the emoji glyphs are now icons. */
export function Navbar({ page, userInfo }: { page: 'home' | 'gambling' | 'inventory' | 'other'; userInfo?: ReactNode }) {
  const go = (href: string) => () => (window.location.href = href);
  return (
    <header id="topbar" className="topbar">
      <div className="topbar-left">
        <div className="brand" onClick={go('/')} style={{ cursor: 'pointer' }}>
          JeuDéKaré
        </div>
      </div>
      <div className="topbar-center">
        <div className={`topbar-icon-btn ${page === 'gambling' ? 'active' : ''}`} id="gambling-btn-wrapper">
          <button id="gambling-btn" className="icon-btn" title="Ouvrir les caisses" onClick={go('/gambling')}>
            <Dices className="icon" />
          </button>
          <span className="icon-btn-label">Gambling</span>
        </div>
        <div className={`topbar-icon-btn ${page === 'inventory' ? 'active' : ''}`} id="inventory-btn-wrapper">
          <button id="inventory-btn" className="icon-btn" title="Voir mon inventaire" onClick={go('/inventory')}>
            <Package className="icon" />
          </button>
          <span className="icon-btn-label">Inventaire</span>
        </div>
      </div>
      <div className="topbar-right">
        <MusicControl />
        {userInfo ? <div id="user-info">{userInfo}</div> : null}
      </div>
    </header>
  );
}
