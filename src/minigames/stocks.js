// Quarterly Ticker: buy low, sell high on a live price chart to hit the profit target before the bell.
import { W, H, C, rect, frame, drawText, backdrop, header, timerBar, monitor, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';

const TICKERS = ['SYNG', 'PARA', 'DGTL', 'LEVR', 'BUZZ', 'KPI', 'ROI'];
const SAMPLE_DT = 0.1;
const VISIBLE = 170;
const START_CASH = 1000;

export default {
  id: 'stocks',
  name: 'Quarterly Ticker',
  help: 'BUY (↑ / 1 / click) when low, SELL (↓ / 2 / click) when high. Reach the profit target before the bell.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const fl = new Floaters();
    const shake = new Shake();
    const ticker = theme?.dept === 'finance' ? 'SYNG' : rng.pick(TICKERS);
    const target = byDiff(d, 0.15, 0.35);
    const fee = byDiff(d, 0, 0.01);
    const total = new Countdown(byDiff(d, 45, 40));
    const A = byDiff(d, 0.12, 0.08);
    const P1 = rng.float(7, 10);
    const P2 = P1 * rng.float(0.33, 0.42);
    const ph1 = rng.float(0, Math.PI * 2);
    const ph2 = rng.float(0, Math.PI * 2);
    const sigma = byDiff(d, 0.01, 0.035);
    let noise = 0;
    let t = 0;
    let acc = 0;
    const priceAt = (tt) => 100 * (1 + A * Math.sin((2 * Math.PI * tt) / P1 + ph1) + A * 0.4 * Math.sin((2 * Math.PI * tt) / P2 + ph2) + noise);
    // Pre-roll some history so the chart starts full.
    const hist = [];
    for (let i = -VISIBLE; i <= 0; i++) hist.push(priceAt(i * SAMPLE_DT));
    let price = hist[hist.length - 1];
    let cash = START_CASH;
    let shares = 0;
    let buyPrice = 0;
    let trades = 0;
    const buttons = { buy: { x: 120, y: 218, w: 110, h: 24 }, sell: { x: 250, y: 218, w: 110, h: 24 } };

    const worth = () => cash + shares * price;
    const gain = () => worth() / START_CASH - 1;
    const score = () => clamp(gain() / target, 0, 1);

    function buy() {
      if (shares > 0 || cash <= 0) {
        sfx('click');
        fl.add('Already holding', W / 2, 150, C.dim);
        return;
      }
      shares = (cash * (1 - fee)) / price;
      cash = 0;
      buyPrice = price;
      trades++;
      sfx('coin');
      fl.add(`Bought @ ${price.toFixed(1)}`, W / 2, 150, C.xp);
    }
    function sell() {
      if (shares <= 0) {
        sfx('click');
        fl.add('Nothing to sell', W / 2, 150, C.dim);
        return;
      }
      const pct = ((price * (1 - fee)) / buyPrice - 1) * 100;
      cash = shares * price * (1 - fee);
      shares = 0;
      trades++;
      if (pct >= 0) {
        sfx('good');
        fl.add(`+${pct.toFixed(1)}%`, W / 2, 150, C.good);
      } else {
        sfx('bad');
        shake.hit();
        fl.add(`${pct.toFixed(1)}%`, W / 2, 150, C.bad);
      }
      if (gain() >= target) finish(inst, 1);
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());
        acc += dt;
        while (acc >= SAMPLE_DT) {
          acc -= SAMPLE_DT;
          t += SAMPLE_DT;
          noise += (rng.next() - 0.5) * 2 * sigma * Math.sqrt(SAMPLE_DT) * 1.7 - noise * 0.6 * SAMPLE_DT;
          price = priceAt(t);
          hist.push(price);
          if (hist.length > VISIBLE + 1) hist.shift();
        }
        if (input.pressed('ArrowUp') || input.pressedExact('1') || input.pressedExact('b')) buy();
        else if (input.pressed('ArrowDown') || input.pressedExact('2')) sell();
        const p = input.pointer;
        if (p.clicked && !inst.done) {
          const hit = (b) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
          if (hit(buttons.buy)) buy();
          else if (hit(buttons.sell)) sell();
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#1d2133', desk: '#3a3e4a' });
        header(g, theme?.title || 'Quarterly Ticker', `Target +${Math.round(target * 100)}%`);
        timerBar(g, total.left, total.total);
        const s = monitor(g, 60, 30, 360, 140, '#0c1018');
        // Grid.
        for (let y = s.y + 14; y < s.y + s.h; y += 18) rect(g, s.x, y, s.w, 1, '#18202c');
        for (let x = s.x; x < s.x + s.w; x += 30) rect(g, x, s.y + 12, 1, s.h - 12, '#18202c');
        let lo = Math.min(...hist);
        let hi = Math.max(...hist);
        if (shares > 0) (lo = Math.min(lo, buyPrice)), (hi = Math.max(hi, buyPrice));
        const pad = (hi - lo) * 0.12 + 0.5;
        lo -= pad;
        hi += pad;
        const top = s.y + 16;
        const ch = s.h - 22;
        const yOf = (v) => Math.round(top + (1 - (v - lo) / (hi - lo)) * ch);
        const step = (s.w - 30) / VISIBLE;
        if (shares > 0) {
          const by = yOf(buyPrice);
          for (let x = s.x; x < s.x + s.w - 30; x += 6) rect(g, x, by, 3, 1, C.gold);
          drawText(g, 'buy', s.x + 2, by - 9, { color: C.gold });
        }
        let prevY = yOf(hist[0]);
        for (let i = 1; i < hist.length; i++) {
          const x = Math.round(s.x + i * step);
          const y = yOf(hist[i]);
          const col = hist[i] >= hist[i - 1] ? '#5fd068' : '#e2504a';
          rect(g, x, Math.min(prevY, y), Math.max(1, Math.ceil(step)), Math.abs(y - prevY) + 1, col);
          prevY = y;
        }
        const py = yOf(price);
        rect(g, s.x + s.w - 30, py - 4, 30, 9, hist[hist.length - 1] >= hist[hist.length - 2] ? '#2f6b3a' : '#7a2b2b');
        drawText(g, price.toFixed(1), s.x + s.w - 28, py - 3, { color: '#fff' });
        rect(g, s.x, s.y, s.w, 12, C.accent);
        drawText(g, `${ticker}  ${price.toFixed(2)}`, s.x + 4, s.y + 2);
        drawText(g, `trades: ${trades}${fee ? `  fee ${(fee * 100).toFixed(1)}%` : ''}`, s.x + s.w - 4, s.y + 2, { align: 'right' });
        // Stats + progress to target.
        const gp = gain() * 100;
        drawText(g, `Cash €${Math.round(cash)}   Shares ${shares.toFixed(2)}   Worth €${Math.round(worth())}`, 60, 186, { color: C.text, shadow: C.border });
        drawText(g, `${gp >= 0 ? '+' : ''}${gp.toFixed(1)}%`, 420, 186, { align: 'right', color: gp >= 0 ? C.good : C.bad, shadow: C.border });
        rect(g, 60, 198, 360, 8, C.border);
        rect(g, 61, 199, 358 * clamp(gain() / target, 0, 1), 6, C.gold);
        frame(g, 60, 198, 360, 8, C.border);
        for (const [k, b] of Object.entries(buttons)) {
          const active = k === 'buy' ? shares <= 0 : shares > 0;
          rect(g, b.x, b.y, b.w, b.h, C.border);
          rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, active ? (k === 'buy' ? '#2f8a3a' : '#a33b30') : '#3a3d4d');
          rect(g, b.x + 1, b.y + 1, b.w - 2, 1, 'rgba(255,255,255,0.3)');
          drawText(g, k === 'buy' ? 'BUY  ↑ / 1' : 'SELL  ↓ / 2', b.x + b.w / 2, b.y + 8, { align: 'center', color: active ? '#fff' : '#7a7d8d' });
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
