/**
 * Full-screen reveal of the best card pulled. No text: only light, motion and
 * particles, scaled by rarity tier (0 = Consumer … 6 = Gold) so a rare drop
 * feels like an event. Click anywhere to skip.
 */

/** How long each tier holds the screen (ms). */
const DURATION = [900, 1100, 1500, 1900, 2500, 3200, 4300];
/** Particles in the initial burst. */
const BURST = [0, 12, 28, 60, 110, 180, 280];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
  shape: 'dot' | 'shard' | 'star';
}

export interface RevealOptions {
  tier: number;
  color: string;
  image: string;
  /** Element shaken on heavy drops (the page content). */
  shake?: HTMLElement | null;
}

export function playReveal({ tier, color, image, shake }: RevealOptions): Promise<void> {
  return new Promise((resolve) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const root = document.createElement('div');
    root.className = `reveal-fx tier-${tier}`;
    root.style.setProperty('--rarity', color);

    const add = (cls: string, parent: HTMLElement = root) => {
      const el = document.createElement('div');
      el.className = cls;
      parent.appendChild(el);
      return el;
    };
    add('fx-backdrop');
    if (tier >= 2) add('fx-rays');
    if (tier >= 5) add('fx-rays fx-rays-2');
    add('fx-glow');
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-particles';
    root.appendChild(canvas);
    const rings = tier >= 6 ? 3 : tier >= 5 ? 2 : tier >= 3 ? 1 : 0;
    for (let i = 0; i < rings; i++) add('fx-ring').style.animationDelay = `${0.12 + i * 0.22}s`;
    const card = add('fx-card');
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    card.appendChild(img);
    if (tier >= 4) add('fx-shine', card);
    add('fx-flash');
    document.body.appendChild(root);

    if (shake && tier >= 4 && !reduce) {
      const d = tier >= 6 ? 14 : tier >= 5 ? 10 : 6;
      const frames = Array.from({ length: 10 }, (_, i) => {
        const k = 1 - i / 10;
        return { transform: `translate(${(Math.random() - 0.5) * 2 * d * k}px, ${(Math.random() - 0.5) * 2 * d * k}px)` };
      });
      shake.animate([...frames, { transform: 'none' }], { duration: 420 + tier * 40, delay: 120, easing: 'ease-out' });
    }

    // ------------------------------------------------------------ particles
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    resize();
    const cx = () => innerWidth / 2;
    const cy = () => innerHeight / 2;
    const palette = tier >= 6 ? ['#ffe08a', '#f5b244', '#fff6d6', '#e4ae39', '#ffffff'] : [color, '#ffffff', color];
    const parts: Particle[] = [];
    const spawn = (n: number, speed: number, from?: { x: number; y: number }) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.9);
        parts.push({
          x: from?.x ?? cx(),
          y: from?.y ?? cy(),
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - speed * 0.25,
          life: 0,
          max: 50 + Math.random() * 70 + tier * 10,
          size: 2 + Math.random() * (2 + tier),
          color: palette[Math.floor(Math.random() * palette.length)]!,
          spin: (Math.random() - 0.5) * 0.3,
          angle: Math.random() * Math.PI,
          shape: tier >= 5 && Math.random() < 0.35 ? 'star' : tier >= 3 && Math.random() < 0.5 ? 'shard' : 'dot',
        });
      }
    };
    const star = (c: CanvasRenderingContext2D, r: number) => {
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const rr = i % 2 ? r * 0.4 : r;
        const a = (i * Math.PI) / 4;
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
    };

    const duration = reduce ? Math.min(900, DURATION[tier]!) : DURATION[tier]!;
    const start = performance.now();
    let raf = 0;
    let burstDone = false;
    const frame = (now: number) => {
      const t = now - start;
      if (!burstDone && t > 160) {
        burstDone = true;
        if (!reduce) spawn(BURST[tier]!, 6 + tier * 1.6);
      }
      // Gold keeps raining confetti; Covert gets a second burst.
      if (!reduce && tier >= 6 && t < duration - 900 && Math.random() < 0.9) {
        for (let i = 0; i < 3; i++)
          parts.push({
            x: Math.random() * innerWidth,
            y: -10,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 2 + Math.random() * 3,
            life: 0,
            max: 160,
            size: 3 + Math.random() * 4,
            color: palette[Math.floor(Math.random() * palette.length)]!,
            spin: (Math.random() - 0.5) * 0.4,
            angle: Math.random() * Math.PI,
            shape: Math.random() < 0.5 ? 'shard' : 'star',
          });
      }
      if (!reduce && tier === 5 && t > 700 && t < 720) spawn(80, 9);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]!;
          p.life++;
          p.vy += 0.12;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.x += p.vx;
          p.y += p.vy;
          p.angle += p.spin;
          if (p.life > p.max || p.y > innerHeight + 20) {
            parts.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          if (p.shape === 'star') star(ctx, p.size * 1.4);
          else if (p.shape === 'shard') ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
          else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
      if (t < duration || parts.length > 0) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      root.classList.add('closing');
      setTimeout(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        root.remove();
        resolve();
      }, 260);
    };
    window.addEventListener('resize', resize);
    root.addEventListener('pointerdown', close);
    setTimeout(close, duration);
  });
}
