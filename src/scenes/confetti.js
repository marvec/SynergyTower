// Confetti for the Christmas party (scenes/party.js): screen-space bits that burst upwards, flutter down and fade.
const COLORS = ['#e2504a', '#f2c14e', '#5fd068', '#5b8def', '#f29cd0', '#ffffff'];

export class Confetti {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.bits = [];
  }
  /** n bits from x, y (px), fanned upwards; spread 1 = a wide fan. */
  burst(x, y, n = 60, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * 2.2 * spread;
      const v = 90 + this.rng() * 140;
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 2 + this.rng() * 1.5, c: COLORS[Math.floor(this.rng() * COLORS.length)], w: this.rng() < 0.5 ? 2 : 1, spin: this.rng() * 6 });
    }
  }
  update(dt) {
    for (const b of this.bits) {
      b.vy = Math.min(b.vy + 160 * dt, 60);
      b.vx *= 1 - 1.5 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.spin += dt * 8;
    }
    this.bits = this.bits.filter((b) => b.life > 0 && b.y < 290);
  }
  render(g) {
    for (const b of this.bits) {
      g.fillStyle = b.c;
      g.fillRect(Math.round(b.x), Math.round(b.y), b.w, Math.sin(b.spin) > 0 ? 2 : 1);
    }
  }
  get count() {
    return this.bits.length;
  }
}
