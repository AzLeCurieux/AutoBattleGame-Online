import type { AdminStats, MonitoringSample } from '@autobattle/shared';
import { Chart, Filler, Legend, LinearScale, LineController, LineElement, PointElement, CategoryScale, Tooltip } from 'chart.js';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { api, ApiError } from '../../common/api';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Legend, Tooltip);
Chart.defaults.color = '#8899a6';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(decimals))} ${sizes[i]}`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? `${d}j ` : ''}${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s > 0 ? `${s}s` : ''}`;
}

type Series = { label: string; color: string; fill: string; pick: (h: MonitoringSample) => number };

function LineChart({ id, history, series }: { id: string; history: MonitoringSample[]; series: Series[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  useEffect(() => {
    chart.current = new Chart(canvas.current!, {
      type: 'line',
      data: {
        labels: [],
        datasets: series.map((s) => ({ label: s.label, data: [], borderColor: s.color, backgroundColor: s.fill, fill: true, tension: 0.4 })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, x: { display: false } },
        plugins: { legend: { position: 'top' } },
      },
    });
    return () => chart.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.data.labels = history.map((h) => new Date(h.time).toLocaleTimeString());
    series.forEach((s, i) => (c.data.datasets[i]!.data = history.map(s.pick)));
    c.update('none');
  }, [history, series]);
  return <canvas id={id} ref={canvas}></canvas>;
}

const SYSTEM: Series[] = [
  { label: 'CPU (%)', color: '#e74c3c', fill: 'rgba(231, 76, 60, 0.1)', pick: (h) => h.cpu },
  { label: 'RAM (GB)', color: '#f1c40f', fill: 'rgba(241, 196, 15, 0.1)', pick: (h) => Number((h.mem / 1024 ** 3).toFixed(2)) },
];
const GAME: Series[] = [
  { label: 'Joueurs', color: '#2ecc71', fill: 'rgba(46, 204, 113, 0.1)', pick: (h) => h.users },
  { label: 'Sessions', color: '#3498db', fill: 'rgba(52, 152, 219, 0.1)', pick: (h) => h.sessions },
];
const BANDWIDTH: Series[] = [
  { label: 'Entrant (MB)', color: '#2ecc71', fill: 'rgba(46, 204, 113, 0.1)', pick: (h) => Number((h.netIn / 1024 ** 2).toFixed(2)) },
  { label: 'Sortant (MB)', color: '#e74c3c', fill: 'rgba(231, 76, 60, 0.1)', pick: (h) => Number((h.netOut / 1024 ** 2).toFixed(2)) },
];

/** views/monitoring.html + js/monitoring.js */
export function MonitoringPage() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>({ ok: true, text: 'En attente...' });
  const busy = useRef(false);

  const fetchStats = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setUpdating(true);
    try {
      setData(await api.adminStats());
      setStatus({ ok: true, text: `Mis à jour: ${new Date().toLocaleTimeString()}` });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = err.status === 401 ? '/login' : '/';
        return;
      }
      setStatus({ ok: false, text: 'Erreur de connexion' });
    } finally {
      busy.current = false;
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const id = setInterval(() => void fetchStats(), 5000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const sys = data?.system;
  const memPercent = sys ? Math.min((sys.memory.active / sys.memory.total) * 100, 100) : 0;
  const history = data?.history ?? [];
  const iconStyle = (color: string, bg: string): CSSProperties => ({ color, background: bg });

  return (
    <>
      <nav className="navbar">
        <div className="logo">
          AutoBattleGame <span style={{ fontSize: '0.6em', color: 'var(--accent)', marginLeft: 5 }}>MONITORING</span>
        </div>
        <div className="nav-links">
          <a href="/" className="nav-btn">
            <i className="fas fa-gamepad"></i> Retour au Jeu
          </a>
        </div>
      </nav>

      <div className="monitoring-container">
        <div className="header-bar">
          <div className="header-title">
            <i className="fas fa-chart-line" style={{ color: 'var(--accent)' }}></i>
            Tableau de Bord
          </div>
          <div className="header-controls">
            <div className="status-badge">
              <span id="connection-status" className={`status-dot ${status.ok ? '' : 'offline'}`}></span>
              <span id="last-update">{status.text}</span>
            </div>
            <button id="refresh-btn" className="btn-refresh" disabled={updating} onClick={() => void fetchStats()}>
              {updating ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <>
                  <i className="fas fa-sync-alt"></i> Actualiser
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="overview-content">
              <div className="overview-label">Uptime</div>
              <div className="overview-value" id="uptime">
                {sys ? formatUptime(sys.uptime) : '--:--'}
              </div>
              <div className="overview-sub">Serveur en ligne</div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon" style={iconStyle('#e74c3c', 'rgba(231, 76, 60, 0.1)')}>
              <i className="fas fa-microchip"></i>
            </div>
            <div className="overview-content">
              <div className="overview-label">CPU Load</div>
              <div className="overview-value" id="cpu-load">
                {sys ? `${sys.cpuLoad.toFixed(1)}%` : '--%'}
              </div>
              <div className="overview-sub" id="load-avg">
                Avg: {sys ? sys.loadavg.map((n) => n.toFixed(2)).join(', ') : '--'}
              </div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon" style={iconStyle('#f1c40f', 'rgba(241, 196, 15, 0.1)')}>
              <i className="fas fa-memory"></i>
            </div>
            <div className="overview-content">
              <div className="overview-label">RAM Usage</div>
              <div className="overview-value" id="memory-usage">
                {sys ? formatBytes(sys.memory.active) : '--'}
              </div>
              <div className="overview-sub" id="memory-total">
                Total: {sys ? formatBytes(sys.memory.total) : '--'}
              </div>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon" style={iconStyle('#2ecc71', 'rgba(46, 204, 113, 0.1)')}>
              <i className="fas fa-users"></i>
            </div>
            <div className="overview-content">
              <div className="overview-label">Joueurs</div>
              <div className="overview-value" id="connected-clients">
                {data?.socket.connected ?? '--'}
              </div>
              <div className="overview-sub">Socket.IO Clients</div>
            </div>
          </div>
        </div>

        <div className="main-grid">
          <div className="panel">
            <div className="panel-header">
              <i className="fas fa-server"></i> Système & Réseau
            </div>
            <div className="metrics-list">
              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-memory"></i> Détails Mémoire
                  </span>
                  <span className="metric-value" id="rss-used">
                    {sys ? formatBytes(sys.memory.rss) : '--'}
                  </span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar" id="memory-bar" style={{ width: `${memPercent}%` }}></div>
                </div>
                <div className="details-grid" style={{ marginTop: 10 }}>
                  <div className="detail-row">
                    <span>Heap Used:</span> <span id="heap-used">{sys ? formatBytes(sys.memory.heapUsed) : '--'}</span>
                  </div>
                  <div className="detail-row">
                    <span>RSS:</span> <span id="rss-used-detail">{sys ? formatBytes(sys.memory.rss) : '--'}</span>
                  </div>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-hdd"></i> Disque
                  </span>
                  <span className="metric-value" id="disk-usage">
                    {sys?.disk?.percent ?? '--%'}
                  </span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar" id="disk-bar" style={{ width: sys?.disk?.percent ?? '0%' }}></div>
                </div>
                <div className="detail-row" style={{ marginTop: 5, fontSize: '0.8em' }}>
                  <span id="disk-details">{sys?.disk ? `${sys.disk.used} / ${sys.disk.total}` : '-- / --'}</span>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-exchange-alt"></i> Bande Passante
                  </span>
                </div>
                <div className="details-grid">
                  <div className="detail-row">
                    <span>
                      <i className="fas fa-arrow-down" style={{ color: '#2ecc71' }}></i> Entrant:
                    </span>{' '}
                    <span id="bandwidth-in">{data ? formatBytes(data.network.bytesIn) : '--'}</span>
                  </div>
                  <div className="detail-row">
                    <span>
                      <i className="fas fa-arrow-up" style={{ color: '#3498db' }}></i> Sortant:
                    </span>{' '}
                    <span id="bandwidth-out">{data ? formatBytes(data.network.bytesOut) : '--'}</span>
                  </div>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-terminal"></i> Processus Node.js
                  </span>
                  <span className="metric-value" id="process-pid">
                    PID: {data?.process.pid ?? '--'}
                  </span>
                </div>
                <div className="details-grid">
                  <div className="detail-row">
                    <span>Version:</span> <span id="node-version">{sys?.nodeVersion ?? '--'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Platform:</span> <span id="os-platform">{sys?.platform ?? '--'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Arch:</span> <span id="os-arch">{sys?.arch ?? '--'}</span>
                  </div>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-door-open"></i> Ports Ouverts (<span id="open-ports-count">{sys?.ports.length ?? 0}</span>)
                  </span>
                </div>
                <div className="tags-grid" id="open-ports-list-container">
                  <span id="open-ports-list" style={{ fontFamily: 'monospace', fontSize: '0.9em', wordBreak: 'break-all' }}>
                    {sys ? sys.ports.join(', ') : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <i className="fas fa-gamepad"></i> Jeu & Applications
            </div>
            <div className="metrics-list">
              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-user-check"></i> Utilisateurs Authentifiés
                  </span>
                  <span className="metric-value" id="active-users">
                    {data?.game.activeUsers ?? '--'}
                  </span>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-dice"></i> Sessions de Jeu Actives
                  </span>
                  <span className="metric-value" id="active-sessions">
                    {data?.game.activeSessions ?? '--'}
                  </span>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-row">
                  <span className="metric-label">
                    <i className="fas fa-trophy"></i> Leaderboard
                  </span>
                  <span className="metric-value" id="leaderboard-size">
                    {data?.game.leaderboardSize ?? '--'}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <h4 style={{ marginBottom: 15, color: 'var(--text-muted)', fontSize: '0.9em', textTransform: 'uppercase' }}>
                  <i className="fas fa-plug"></i> Modules & Plugins
                </h4>
                <div className="plugins-grid" id="plugins-grid">
                  {data?.plugins.map((p) => (
                    <div key={p.name} className="plugin-card">
                      <div className="plugin-name">{p.name}</div>
                      <span className="plugin-status">
                        <i className="fas fa-check-circle"></i> {p.status}
                      </span>
                      <div className="plugin-detail">{p.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="main-grid" style={{ marginTop: 25 }}>
          <div className="panel">
            <div className="panel-header">
              <i className="fas fa-chart-area"></i> Charge Système (CPU & RAM)
            </div>
            <div style={{ height: 250 }}>
              <LineChart id="systemChart" history={history} series={SYSTEM} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <i className="fas fa-chart-line"></i> Activité Jeu
            </div>
            <div style={{ height: 250 }}>
              <LineChart id="gameChart" history={history} series={GAME} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 25 }}>
          <div className="panel">
            <div className="panel-header">
              <i className="fas fa-exchange-alt"></i> Bande Passante Historique
            </div>
            <div style={{ height: 250 }}>
              <LineChart id="bandwidthChart" history={history} series={BANDWIDTH} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
