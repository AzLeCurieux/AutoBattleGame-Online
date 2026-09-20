import type { AdminStats, MonitoringSample } from '@autobattle/shared';
import { statfsSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';

const SAMPLE_EVERY_MS = 5000;
const MAX_SAMPLES = 60;

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(decimals))} ${sizes[i]}`;
}

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

export interface MonitoringSources {
  socketConnections: () => number;
  onlineUsers: () => number;
  activeRuns: () => number;
  registeredUsers: () => number;
}

/**
 * Data for the v1 monitoring dashboard, computed with Node built-ins
 * (v1 pulled in systeminformation + express-status-monitor for this).
 * Network = HTTP bytes handled by this app, counted in app.ts.
 */
export class Monitoring {
  bytesIn = 0;
  bytesOut = 0;
  private cpuLoad = 0;
  private lastCpu = cpuTimes();
  private readonly history: MonitoringSample[] = [];
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly sources: MonitoringSources,
    private readonly databasePath: string,
    private readonly port: number,
  ) {
    this.timer = setInterval(() => this.sample(), SAMPLE_EVERY_MS);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
  }

  private sample() {
    const now = cpuTimes();
    const total = now.total - this.lastCpu.total;
    this.cpuLoad = total > 0 ? (1 - (now.idle - this.lastCpu.idle) / total) * 100 : 0;
    this.lastCpu = now;
    this.history.push({
      time: Date.now(),
      cpu: Math.round(this.cpuLoad * 10) / 10,
      mem: os.totalmem() - os.freemem(),
      users: this.sources.socketConnections(),
      sessions: this.sources.activeRuns(),
      netIn: this.bytesIn,
      netOut: this.bytesOut,
    });
    if (this.history.length > MAX_SAMPLES) this.history.shift();
  }

  private disk(): AdminStats['system']['disk'] {
    try {
      const fs = statfsSync(dirname(resolve(this.databasePath)));
      const total = fs.blocks * fs.bsize;
      const used = (fs.blocks - fs.bfree) * fs.bsize;
      return { percent: `${((used / total) * 100).toFixed(1)}%`, used: formatBytes(used), total: formatBytes(total) };
    } catch {
      return null;
    }
  }

  stats(): AdminStats {
    const mem = process.memoryUsage();
    return {
      system: {
        uptime: Math.round(process.uptime()),
        cpuLoad: this.cpuLoad,
        loadavg: os.loadavg(),
        memory: { active: os.totalmem() - os.freemem(), total: os.totalmem(), heapUsed: mem.heapUsed, rss: mem.rss },
        disk: this.disk(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        ports: [this.port],
      },
      process: { pid: process.pid },
      socket: { connected: this.sources.socketConnections() },
      game: {
        activeUsers: this.sources.onlineUsers(),
        activeSessions: this.sources.activeRuns(),
        leaderboardSize: this.sources.registeredUsers(),
      },
      network: { bytesIn: this.bytesIn, bytesOut: this.bytesOut },
      plugins: [
        { name: 'Fastify', status: 'Actif', details: 'API HTTP, helmet, rate-limit' },
        { name: 'Socket.IO', status: 'Actif', details: 'Classement et synchronisation temps réel' },
        { name: 'SQLite', status: 'Actif', details: 'node:sqlite (WAL)' },
      ],
      history: [...this.history],
    };
  }
}
