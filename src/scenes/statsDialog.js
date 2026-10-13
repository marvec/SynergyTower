// "What do these numbers mean?": opened by clicking a HUD stat. One tab per stat (←/→ or click the tabs), each with
// the live numbers and what they are for.
import { C, rect, frame, icon, bar, formatNum, formatTime, coffeeColor } from '../engine/ui.js';
import { drawText, drawWrapped, measureText } from '../engine/font.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { buildFloor } from '../core/tasks.js';
import { MINIGAMES } from '../minigames/index.js';
import { Modal } from './overlays.js';

export const STAT_TABS = [
  { key: 'sp', icon: 'sp', label: 'Clips' },
  { key: 'coffee', icon: 'coffee', label: 'Coffee' },
  { key: 'so', icon: 'so', label: 'Options' },
  { key: 'stars', icon: 'star', label: 'KPI' },
  { key: 'level', icon: 'xp', label: 'Level' },
  { key: 'games', icon: 'pad', label: 'Games', iw: 11 },
];

const TAB_W = 50;

/** The explanation for one stat: { title, value, color, text, rows?: [[label, ok|null, detail]], bar? }. */
function statInfo(key, s, now) {
  const f = s.floor;
  const p = S.promotionStatus(s);
  const top = s.maxFloor >= E.FLOORS;
  if (key === 'sp') {
    const need = Math.max(0, p.fee - s.sp);
    return {
      title: 'Paperclips',
      value: formatNum(s.sp),
      color: C.gold,
      text: 'The office currency. Every task pays some, more for more stars and on higher floors. Spend them on the keycard fee for your next promotion, on Perks and on Training.',
      rows: top ? [] : [[`Keycard fee for floor ${p.floor + 1}`, need === 0, need === 0 ? formatNum(p.fee) + ' - covered' : `${formatNum(p.fee)} - ${formatNum(need)} to go`]],
    };
  }
  if (key === 'coffee') {
    const max = S.coffeeMax(s);
    const next = S.msToNextCoffee(s, now);
    const machine = S.cooldownLeft(s, `coffee-machine-${f}`, now);
    return {
      title: 'Coffee',
      value: `${s.coffee.value}/${max}`,
      color: coffeeColor(S.coffeeLevel(s)),
      text: `Tasks cost 1-3 coffee: quick games 1, bigger ones 2, the most complex 3. Quick ones take longer to be ready again. Coffee refills by itself over time, and the coffee machine on every floor pours ${E.COFFEE_MACHINE_AMOUNT} free cups now and then.`,
      rows: [
        !S.coffeeRegenOn(s)
          ? ['Next cup', false, 'check in at the front desk']
          : ['Next cup', next === 0 ? true : null, next === 0 ? 'mug is full' : `in ${formatTime(next)} (one every ${formatTime(E.coffeeRegenMs(s.perks))})`],
        ['Coffee machine', machine <= 0, machine <= 0 ? `ready: +${E.COFFEE_MACHINE_AMOUNT}` : `brewing, ${formatTime(machine)}`],
      ],
    };
  }
  if (key === 'so') {
    return {
      title: 'Stock Options',
      value: formatNum(s.so),
      color: C.so,
      text: 'The rare currency. You get one for every Seniority level-up and, with luck, for a perfect 3-star task. The Shop sells more (demo payments only, nothing is charged).',
      rows: [
        ['Skip a station cooldown', s.so >= E.SKIP_COOLDOWN_SO, `${E.SKIP_COOLDOWN_SO} option`],
        ['Refill all coffee', s.so >= E.REFILL_COFFEE_SO, `${E.REFILL_COFFEE_SO} options`],
      ],
    };
  }
  if (key === 'stars') {
    const stars = s.starsByFloor[f] || 0;
    const quota = E.starQuota(f);
    const rows =
      f === s.maxFloor && !top
        ? [
            ['KPI stars', p.checks.stars, `${p.stars}/${p.quota}`],
            ['Seniority level', p.checks.level, `Lv${p.level} (need Lv${p.levelReq})`],
            ['Keycard fee', p.checks.sp, `${formatNum(p.fee)} paperclips`],
            ['HR performance review', p.checks.review, p.checks.review ? 'passed' : p.ready ? 'visit the HR office' : 'once the rest is done'],
          ]
        : [];
    return {
      title: `KPI stars, floor ${f}`,
      value: `${stars}/${quota}`,
      color: stars >= quota ? C.good : C.text,
      text:
        f === s.maxFloor && !top
          ? 'Each task earns 0-3 stars on this floor. Hit the quota, then meet the rest of the promotion checklist:'
          : top
            ? 'Each task earns 0-3 stars. On the top floor the quota calls the board meeting.'
            : 'Each task earns 0-3 stars. Promotions only count on your highest floor; stars here just add up.',
      bar: stars / quota,
      rows,
    };
  }
  if (key === 'level') {
    const need = E.xpToNext(s.level);
    return {
      title: 'Seniority level',
      value: `Lv${s.level}`,
      color: C.xp,
      text: 'Experience from every task (and from Training) raises your Seniority. Each promotion needs a minimum level, and every level-up pays a Stock Option.',
      bar: s.xp / need,
      rows: [
        ['Experience', null, `${formatNum(s.xp)} / ${formatNum(need)} to Lv${s.level + 1}`],
        ...(top ? [] : [[`Needed for floor ${s.maxFloor + 1}`, s.level >= p.levelReq, `Lv${p.levelReq}`]]),
      ],
    };
  }
  // games
  const g = S.gamesPlayed(s);
  const here = [...new Set(buildFloor(f).tasks.map((t) => t.task.game))];
  const fresh = here.filter((id) => !s.played?.[id]).map((id) => MINIGAMES[id].name);
  return {
    title: 'Games played',
    value: `${g.played}/${g.total}`,
    color: g.played === g.total ? C.good : C.text,
    text:
      g.played === g.total
        ? 'You have played every kind of mini-game with this character. Certified generalist!'
        : 'How many different kinds of mini-games you have tried with this character, out of all of them.',
    bar: g.played / g.total,
    rows: fresh.length ? [['Not tried yet on this floor:', null, fresh.join(', ')]] : [['This floor', true, 'all tried']],
  };
}

export class StatsDialog extends Modal {
  constructor(game, key = 'sp') {
    super(game, { w: 330, h: 184, title: 'Your numbers' });
    this.tab = Math.max(0, STAT_TABS.findIndex((t) => t.key === key));
  }
  get tabsX() {
    return this.x + Math.round((this.w - TAB_W * STAT_TABS.length) / 2);
  }
  build() {
    this.buttons.clear();
    this.buttons.add({ x: this.x + this.w / 2 - 40, y: this.y + this.h - 24, w: 80, h: 18, label: 'Close', onClick: () => this.close() });
  }
  update(dt) {
    const input = this.game.input;
    const n = STAT_TABS.length;
    if (input.pressed('ArrowLeft')) this.switch((this.tab + n - 1) % n);
    if (input.pressed('ArrowRight')) this.switch((this.tab + 1) % n);
    const p = input.pointer;
    if (p.clicked && p.y >= this.y + 16 && p.y < this.y + 32 && p.x >= this.tabsX && p.x < this.tabsX + TAB_W * n) {
      input.consumeClick();
      this.switch(Math.floor((p.x - this.tabsX) / TAB_W));
    }
    super.update(dt);
  }
  switch(i) {
    if (i === this.tab) return;
    this.tab = i;
    this.game.sfx('click');
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    // Tabs.
    STAT_TABS.forEach((t, i) => {
      const tx = this.tabsX + i * TAB_W;
      const on = i === this.tab;
      rect(g, tx + 1, y + 2, TAB_W - 2, 16, on ? C.panelLight : C.panelDark);
      if (on) frame(g, tx + 1, y + 2, TAB_W - 2, 16, C.gold);
      const iw = t.iw || 10;
      const lw = measureText(t.label) + iw;
      icon(g, t.icon, tx + (TAB_W - lw) / 2, y + 6);
      drawText(g, t.label, tx + (TAB_W - lw) / 2 + iw, y + 6, { color: on ? C.gold : C.dim });
    });
    const info = statInfo(STAT_TABS[this.tab].key, s, this.game.now());
    const bx = x + 12;
    const bw = this.w - 24;
    let yy = y + 24;
    drawText(g, info.title, bx, yy + 4, { color: C.gold });
    drawText(g, info.value, x + this.w - 12, yy, { align: 'right', scale: 2, color: info.color, shadow: C.border });
    yy += 20;
    if (info.bar != null) {
      bar(g, bx, yy - 3, bw, 4, Math.min(1, info.bar), info.bar >= 1 ? C.good : C.gold);
      yy += 4;
    }
    yy += drawWrapped(g, info.text, bx, yy, bw, { color: C.text }) + 4;
    for (const [label, ok, detail] of info.rows || []) {
      if (ok === true) icon(g, 'check', bx, yy);
      else if (ok === false) drawText(g, 'x', bx + 2, yy, { color: C.bad });
      else rect(g, bx + 2, yy + 3, 3, 1, C.dim);
      drawText(g, label, bx + 10, yy, { color: C.dim });
      const color = ok === false ? C.warn : C.text;
      if (measureText(label) + measureText(detail) + 24 <= bw) {
        drawText(g, detail, x + this.w - 12, yy, { align: 'right', color });
        yy += 10;
      } else yy += 10 + drawWrapped(g, detail, bx + 10, yy + 10, bw - 10, { color });
    }
  }
}
