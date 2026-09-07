import type { AnimTrigger } from '../types/cosmetic';
import type { Expression, Pt } from '../types/face';
import { prefersReducedMotion } from './canvas';
import { makeRng } from './geometry';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface AnimatorCallbacks {
  onExpression(e: Expression): void;
  /** Καλείται σε κάθε καρέ όσο κάτι κινείται (παλμός ρουζ, σπινθήρες). */
  onFrame(pulse: number, particles: Particle[]): void;
}

const MAX_PARTICLES = 40;
const SPARK_COLORS = ['#ffffff', '#ffe082', '#ff8fb1', '#b3e5fc', '#e1bee7'];

/**
 * Κρατά την «ζωή» του προσώπου: τυχαίο βλεφάρισμα, χαμόγελο/έκπληξη μετά από
 * εφαρμογή καλλυντικού, παλμός ρουζ και σπινθήρες. Το rAF τρέχει μόνο όσο χρειάζεται.
 */
export class FaceAnimator {
  private base: Expression = 'neutral';
  private override: { e: Expression; until: number } | null = null;
  private blinking = false;
  private blinkTimer: number | null = null;
  private blinkEndTimer: number | null = null;
  private overrideTimer: number | null = null;
  private raf: number | null = null;
  private lastT = 0;
  private pulseT = -1;
  private particles: Particle[] = [];
  private frozen = false;
  private rng = makeRng(Date.now() & 0xffff);
  private cb: AnimatorCallbacks;

  constructor(cb: AnimatorCallbacks) {
    this.cb = cb;
  }

  start(): void {
    this.scheduleBlink();
  }

  stop(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    if (this.blinkEndTimer) clearTimeout(this.blinkEndTimer);
    if (this.overrideTimer) clearTimeout(this.overrideTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.blinkTimer = this.blinkEndTimer = this.overrideTimer = this.raf = null;
    this.particles = [];
    this.pulseT = -1;
  }

  /** Για τις δοκιμές: παγώνει σε ουδέτερη έκφραση. */
  freeze(on: boolean): void {
    this.frozen = on;
    if (on) {
      this.stop();
      this.override = null;
      this.blinking = false;
      this.cb.onExpression('neutral');
    } else {
      this.scheduleBlink();
    }
  }

  current(): Expression {
    if (this.override) return this.override.e;
    return this.blinking ? 'blink' : this.base;
  }

  setExpression(e: Expression | null): void {
    if (e === null) {
      this.override = null;
    } else {
      this.override = { e, until: Infinity };
    }
    this.emit();
  }

  trigger(t: AnimTrigger, at?: Pt): void {
    if (this.frozen) return;
    if (at) this.sparkle(at);
    if (t === 'wow') {
      this.setOverride('wow', 1200, () => this.setOverride('smile', 800));
    } else if (t === 'smile') {
      this.setOverride('smile', 1500);
    } else if (t === 'blushPulse') {
      this.setOverride('smile', 1200);
      if (!prefersReducedMotion()) {
        this.pulseT = 0;
        this.ensureLoop();
      }
    }
  }

  sparkle(at: Pt, n = 16): void {
    if (prefersReducedMotion()) n = 4;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = this.rng() * Math.PI * 2;
      const sp = 40 + this.rng() * 90;
      this.particles.push({
        x: at[0], y: at[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0, max: 0.45 + this.rng() * 0.35, size: 2 + Math.floor(this.rng() * 3),
        color: SPARK_COLORS[Math.floor(this.rng() * SPARK_COLORS.length)],
      });
    }
    this.ensureLoop();
  }

  private setOverride(e: Expression, ms: number, then?: () => void): void {
    if (this.overrideTimer) clearTimeout(this.overrideTimer);
    this.override = { e, until: performance.now() + ms };
    this.blinking = false;
    this.emit();
    this.overrideTimer = window.setTimeout(() => {
      this.override = null;
      this.overrideTimer = null;
      this.emit();
      then?.();
    }, ms);
  }

  private emit(): void {
    this.cb.onExpression(this.current());
  }

  private scheduleBlink(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    this.blinkTimer = window.setTimeout(() => {
      this.blinkTimer = null;
      if (this.frozen) return;
      if (!this.override) {
        this.blinking = true;
        this.emit();
        this.blinkEndTimer = window.setTimeout(() => {
          this.blinking = false;
          this.blinkEndTimer = null;
          this.emit();
        }, 130);
      }
      this.scheduleBlink();
    }, 3000 + this.rng() * 3000);
  }

  private ensureLoop(): void {
    if (this.raf) return;
    this.lastT = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      let pulse = 1;
      if (this.pulseT >= 0) {
        this.pulseT += dt / 0.9;
        if (this.pulseT >= 1) this.pulseT = -1;
        else pulse = 1 + 0.6 * Math.sin(this.pulseT * Math.PI);
      }
      for (const p of this.particles) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 60 * dt;
      }
      this.particles = this.particles.filter((p) => p.life < p.max);
      this.cb.onFrame(pulse, this.particles);
      if (this.pulseT >= 0 || this.particles.length > 0) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.raf = null;
        this.cb.onFrame(1, []);
      }
    };
    this.raf = requestAnimationFrame(step);
  }
}
