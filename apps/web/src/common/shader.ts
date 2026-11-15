/**
 * Animated background of v1 (shader-web-background + the inline fragment shader
 * of views/index.html and views/gambling.html), re-implemented without the
 * vendored library: same canvas (fixed, 100vw x 100vh, device pixel ratio),
 * same shader, same colour easing.
 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export type Palette = [Rgb, Rgb, Rgb];

export const DEFAULT_PALETTE: Palette = [
  { r: 0.58, g: 0.07, b: 0.07 }, // rouge
  { r: 0.15, g: 0.15, b: 0.15 }, // gris foncé
  { r: 0.05, g: 0.05, b: 0.05 }, // noir
];

/** Shape of the swirl. Lerped like the colours, so a theme change morphs smoothly. */
export interface ShaderFx {
  /** Time multiplier while the background animates. */
  speed: number;
  /** How much the swirl twists with distance from the centre. */
  spin: number;
  /** Separation between the three colours. */
  contrast: number;
  /** Size of the pixel grid (1 = smooth). */
  pixel: number;
  /** 0 = greyscale, 1 = normal. */
  saturation: number;
  /** Brightness amplitude of the beat (0 = none). */
  pulse: number;
  /** Beat shape: steady wave, double heartbeat, lightning flashes, or a beat that keeps speeding up. */
  beat: 'wave' | 'heart' | 'flash' | 'rage';
  /** Beats per second. */
  rate: number;
}

export const DEFAULT_FX: ShaderFx = { speed: 1, spin: 0.3, contrast: 3, pixel: 1, saturation: 1, pulse: 0, beat: 'wave', rate: 0.5 };

const VERTEX = `attribute vec2 V;void main(){gl_Position=vec4(V,0,1);}`;

const FRAGMENT = `
precision mediump float;
#define SPIN_EASE 0.8
#define spin_time 5.

uniform vec2 iResolution;
uniform float iTime;
uniform vec3 colour_1;
uniform vec3 colour_2;
uniform vec3 colour_3;
uniform float spin_amount;
uniform float contrast;
uniform float pixel_size;
uniform float saturation;
uniform float beat;

void main( )
{
  vec2 uv = (floor(gl_FragCoord.xy*(1./pixel_size))*pixel_size - 0.5*iResolution.xy)/length(iResolution.xy) - vec2(0.12, 0.);

  float uv_len = length(uv);

  float speed = (spin_time*SPIN_EASE*0.2) + 302.2;
  float new_pixel_angle = (atan(uv.y, uv.x)) + speed - SPIN_EASE*20.*(1.*spin_amount*uv_len + (1. - 1.*spin_amount));

  vec2 mid = vec2(0.5, 0.5);
  uv = (vec2((uv_len * cos(new_pixel_angle) + mid.x), (uv_len * sin(new_pixel_angle) + mid.y)) - mid);

  uv *= 30.;
  speed = iTime*(2.);
  vec2 uv2 = vec2(uv.x+uv.y);

  for(int i=0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv  += 0.5*vec2(cos(5.1123314 + 0.353*uv2.y + speed*0.131121),sin(uv2.x - 0.113*speed));
    uv  -= 1.0*cos(uv.x + uv.y) - 1.0*sin(uv.x*0.711 - uv.y);
  }

  float contrast_mod = (0.25*contrast + 0.5*spin_amount + 1.2);
  float paint_res =min(2., max(0.,length(uv)*(0.035)*contrast_mod));
  float c1p = max(0.,1. - contrast_mod*abs(1.-paint_res));
  float c2p = max(0.,1. - contrast_mod*abs(paint_res));
  float c3p = 1. - min(1., c1p + c2p);

  vec4 col = (0.3/contrast)*vec4(colour_1, 1.0) + (1. - 0.3/contrast)*(vec4(colour_1, 1.0)*c1p + vec4(colour_2, 1.0)*c2p + vec4(colour_3*c3p, c3p));
  float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
  col.rgb = mix(vec3(luma), col.rgb, saturation) * (1. + beat);
  gl_FragColor = col;
}
`;

const TRANSITION_SPEED = 0.03;
const lerp = (a: Rgb, b: Rgb): Rgb => ({
  r: a.r + (b.r - a.r) * TRANSITION_SPEED,
  g: a.g + (b.g - a.g) * TRANSITION_SPEED,
  b: a.b + (b.b - a.b) * TRANSITION_SPEED,
});

export class ShaderBackground {
  private current: Palette = [...DEFAULT_PALETTE];
  private target: Palette = [...DEFAULT_PALETTE];
  private time = 0;
  private fx: ShaderFx = { ...DEFAULT_FX };
  private targetFx: ShaderFx = { ...DEFAULT_FX };
  private beatClock = 0;

  /** @param alwaysAnimate gambling page: true. Game page: time only advances during fights. */
  constructor(private animating: boolean) {}

  setColors(c1: Rgb, c2: Rgb, c3: Rgb) {
    this.target = [c1, c2, c3];
  }

  /** Changes the shape of the swirl (speed, twist, grain, beat…). */
  setFx(fx: Partial<ShaderFx>) {
    this.targetFx = { ...DEFAULT_FX, ...fx };
    this.beatClock = 0;
  }

  /** Back to the default colours and shape. */
  reset() {
    this.setColors(...DEFAULT_PALETTE);
    this.setFx(DEFAULT_FX);
  }

  get targetColors(): Palette {
    return this.target;
  }

  get currentColors(): Palette {
    return this.current;
  }

  enableAnimation() {
    this.animating = true;
  }

  disableAnimation() {
    this.animating = false;
  }

  start() {
    const canvas = document.createElement('canvas');
    canvas.id = 'shader-web-background';
    Object.assign(canvas.style, { width: '100vw', height: '100vh', position: 'fixed', top: '0', left: '0', zIndex: '-9999' });
    document.body.prepend(canvas);

    const gl = canvas.getContext('webgl', { antialias: false });
    if (!gl) {
      console.warn('Not sufficient WebGL support');
      return;
    }
    const program = link(gl);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
    const v = gl.getAttribLocation(program, 'V');
    gl.enableVertexAttribArray(v);
    gl.vertexAttribPointer(v, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u('iResolution');
    const uTime = u('iTime');
    const uColours = [u('colour_1'), u('colour_2'), u('colour_3')];
    const uSpin = u('spin_amount');
    const uContrast = u('contrast');
    const uPixel = u('pixel_size');
    const uSat = u('saturation');
    const uBeat = u('beat');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let cssW = 0;
    let cssH = 0;
    const frame = () => {
      if (canvas.clientWidth !== cssW || canvas.clientHeight !== cssH) {
        const ratio = window.devicePixelRatio || 1;
        cssW = canvas.clientWidth;
        cssH = canvas.clientHeight;
        canvas.width = Math.floor(cssW * ratio);
        canvas.height = Math.floor(cssH * ratio);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      this.fx = lerpFx(this.fx, this.targetFx);
      if (this.animating) {
        this.time += (1 / 120) * this.fx.speed;
        this.beatClock += (1 / 60) * this.fx.rate;
      } else {
        // Idle: the beat keeps going, slower, so an announced boss still feels alive.
        this.beatClock += (1 / 60) * this.fx.rate * 0.6;
      }
      this.current = [lerp(this.current[0], this.target[0]), lerp(this.current[1], this.target[1]), lerp(this.current[2], this.target[2])];
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, this.time);
      this.current.forEach((c, i) => gl.uniform3f(uColours[i]!, c.r, c.g, c.b));
      gl.uniform1f(uSpin, this.fx.spin);
      gl.uniform1f(uContrast, this.fx.contrast);
      gl.uniform1f(uPixel, Math.max(1, Math.round(this.fx.pixel * (window.devicePixelRatio || 1))));
      gl.uniform1f(uSat, this.fx.saturation);
      gl.uniform1f(uBeat, reduceMotion ? 0 : this.fx.pulse * beatWave(this.fx.beat, this.beatClock, this.animating));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

const FX_KEYS = ['speed', 'spin', 'contrast', 'pixel', 'saturation', 'pulse', 'rate'] as const;
function lerpFx(a: ShaderFx, b: ShaderFx): ShaderFx {
  const out: ShaderFx = { ...a, beat: b.beat };
  for (const k of FX_KEYS) out[k] = a[k] + (b[k] - a[k]) * TRANSITION_SPEED;
  return out;
}

/** Brightness offset of the beat at a given phase (in beats), roughly -1..1. */
function beatWave(shape: ShaderFx['beat'], t: number, fighting: boolean): number {
  const f = t - Math.floor(t);
  switch (shape) {
    case 'heart': {
      // Two quick thumps, then a pause.
      const thump = (x: number) => Math.exp(-((x / 0.05) ** 2));
      return thump(f - 0.08) + 0.6 * thump(f - 0.3);
    }
    case 'flash': {
      // Short lightning strike once per beat, with a dimmer afterglow.
      return f < 0.04 ? 1 : f < 0.1 ? 0.35 : f > 0.12 && f < 0.14 ? 0.6 : -0.1;
    }
    case 'rage': {
      // Faster and harder the longer the fight lasts.
      const ramp = fighting ? Math.min(1, t / 40) : 0;
      return Math.sin(t * Math.PI * 2 * (1 + ramp * 1.5)) * (0.5 + ramp * 0.5);
    }
    default:
      return Math.sin(t * Math.PI * 2);
  }
}

function link(gl: WebGLRenderingContext): WebGLProgram {
  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(String(gl.getShaderInfoLog(shader)));
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  return program;
}

/** getLevelBackgroundColors() of views/index.html. */
export function levelPalette(level: number): Palette {
  let base: Rgb;
  if (level < 40) base = { r: 0.69, g: 0.76, b: 0.85 };
  else if (level < 50) base = { r: 0.37, g: 0.6, b: 0.85 };
  else if (level < 60) base = { r: 0.29, g: 0.41, b: 1.0 };
  else if (level < 70) base = { r: 0.45, g: 0.22, b: 0.54 };
  else if (level < 80) base = { r: 0.54, g: 0.22, b: 0.51 };
  else if (level < 90) base = { r: 0.9, g: 0.02, b: 0.74 };
  else if (level < 100) base = { r: 0.92, g: 0.29, b: 0.29 };
  else base = { r: 0.89, g: 0.68, b: 0.22 };
  const shift = (c: Rgb, d: number): Rgb => ({
    r: Math.max(0, Math.min(1, c.r + d)),
    g: Math.max(0, Math.min(1, c.g + d)),
    b: Math.max(0, Math.min(1, c.b + d)),
  });
  return [shift(base, 0.2), base, shift(base, -0.3)];
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1]!, 16) / 255, g: parseInt(m[2]!, 16) / 255, b: parseInt(m[3]!, 16) / 255 } : null;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
