// Fix the Spreadsheet: flag every row whose Total doesn't add up, then submit.
import { W, H, C, rect, frame, drawText, header, timerBar, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';

const LABELS = {
  default: ['Paperclips', 'Toner', 'Staplers', 'Post-its', 'Coffee', 'Pens', 'Badges', 'Plants', 'Chairs', 'Snacks'],
  support: ['Tickets', 'Calls', 'Chats', 'Emails', 'Refunds', 'Escalations', 'Callbacks', 'Surveys', 'Bugs', 'Thank-yous'],
  sales: ['Acme Inc', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Soylent', 'Wonka', 'Stark', 'Wayne'],
  marketing: ['Banners', 'Emails', 'Videos', 'Podcasts', 'Billboards', 'Posts', 'Memes', 'Webinars', 'Flyers', 'Blogs'],
  it: ['Servers', 'Laptops', 'Licenses', 'Cables', 'Monitors', 'Keyboards', 'Mice', 'Routers', 'Tickets', 'Bugs'],
  finance: ['Travel', 'Meals', 'Rent', 'Salaries', 'Software', 'Utilities', 'Taxes', 'Insurance', 'Consulting', 'Coffee'],
  legalhr: ['Hires', 'Exits', 'Trainings', 'Contracts', 'NDAs', 'Audits', 'Reviews', 'Complaints', 'Benefits', 'Parties'],
  exec: ['Region NA', 'Region EU', 'Region APAC', 'Yachts', 'Jets', 'Golf', 'Bonuses', 'Dividends', 'Offsites', 'Mergers'],
};
const ERRORS = ['#REF!', '#DIV/0!', '#VALUE!', '#N/A'];

const GRID = { x: 20, y: 22, w: 440, rowH: 14, labelW: 110, numW: 20, totalW: 70 };

export default {
  id: 'spreadsheet',
  name: 'Fix the Spreadsheet',
  help: 'Flag every wrong Total (click it, or Up/Down + Space). Enter or Submit when done.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const labels = LABELS[theme?.dept] || LABELS.default;
    const sheetsTotal = d < 0.5 ? 2 : 3;
    const total = sheetsTotal * byDiff(d, 32, 30); // 64 s (2 sheets) … 90 s (3 sheets)
    const fl = new Floaters();
    const shake = new Shake();
    let left = total;
    let sheetIdx = 0;
    let scores = [];
    let sheet = null;
    let cursor = 0;
    let reveal = 0;

    const makeSheet = () => {
      const rows = Math.round(byDiff(d, 5, 8));
      const cols = d < 0.35 ? 2 : d < 0.7 ? 3 : 4;
      const maxV = Math.round(byDiff(d, 20, 250));
      const wrongCount = Math.min(rows - 1, Math.max(1, Math.round(byDiff(d, 1.5, 3.5) + rng.float(-0.5, 0.5))));
      const names = rng.sample(labels, rows);
      const wrongRows = new Set(rng.sample([...Array(rows).keys()], wrongCount));
      const data = names.map((name, r) => {
        const vals = Array.from({ length: cols }, () => rng.int(1, maxV));
        const sum = vals.reduce((a, b) => a + b, 0);
        let shown = String(sum);
        if (wrongRows.has(r)) {
          if (d < 0.5 && rng.chance(0.3)) shown = rng.pick(ERRORS);
          else {
            const deltas = d < 0.5 ? [rng.int(3, 12), 10] : [rng.int(1, 9), 10, 100, rng.int(1, 3)];
            let delta = rng.pick(deltas) * (rng.chance(0.5) ? 1 : -1);
            if (sum + delta < 0) delta = Math.abs(delta);
            shown = String(sum + delta);
          }
        }
        return { name, vals, shown, wrong: wrongRows.has(r), flagged: false };
      });
      return { rows, cols, data, wrongCount };
    };
    sheet = makeSheet();

    const colX = () => {
      const valW = (GRID.w - GRID.numW - GRID.labelW - GRID.totalW) / sheet.cols;
      return { valW, totalX: GRID.x + GRID.w - GRID.totalW };
    };
    const rowY = (r) => GRID.y + 26 + r * GRID.rowH;
    const submitRect = { x: W - 100, y: H - 32, w: 80, h: 20 };

    const evaluate = () => {
      let hits = 0;
      let falses = 0;
      for (const row of sheet.data) {
        if (row.flagged && row.wrong) hits++;
        if (row.flagged && !row.wrong) falses++;
      }
      return Math.max(0, Math.min(1, (hits - falses) / sheet.wrongCount));
    };
    const submit = () => {
      const s = evaluate();
      scores.push(s);
      if (s >= 0.999) {
        sfx('good');
        fl.add('All fixed!', W / 2, 200, C.good);
      } else {
        sfx('bad');
        shake.hit();
        fl.add(`${Math.round(s * 100)}% correct`, W / 2, 200, s > 0.5 ? C.warn : C.bad);
      }
      reveal = 1.1;
    };
    const finalScore = () => {
      const all = [...scores];
      while (all.length < sheetsTotal) all.push(0);
      return all.reduce((a, b) => a + b, 0) / sheetsTotal;
    };
    const toggle = (r) => {
      const row = sheet.data[r];
      row.flagged = !row.flagged;
      sfx(row.flagged ? 'click' : 'blip');
      // Auto-submit when the flags exactly match the wrong rows.
      if (sheet.data.every((x) => x.flagged === x.wrong)) submit();
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        left -= dt;
        if (left <= 0) {
          if (reveal <= 0) scores.push(evaluate());
          return finish(inst, finalScore());
        }
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0) {
            sheetIdx++;
            if (sheetIdx >= sheetsTotal) return finish(inst, finalScore());
            sheet = makeSheet();
            cursor = 0;
          }
          return;
        }
        if (input.pressed('ArrowDown')) cursor = (cursor + 1) % sheet.rows;
        if (input.pressed('ArrowUp')) cursor = (cursor + sheet.rows - 1) % sheet.rows;
        if (input.pressedExact('Space')) return toggle(cursor);
        if (input.pressedExact('Enter')) return submit();
        const p = input.pointer;
        const { totalX } = colX();
        const inSubmit = p.x >= submitRect.x && p.y >= submitRect.y && p.x < submitRect.x + submitRect.w && p.y < submitRect.y + submitRect.h;
        for (let r = 0; r < sheet.rows; r++) {
          const y = rowY(r);
          if (p.x >= totalX && p.x < totalX + GRID.totalW && p.y >= y && p.y < y + GRID.rowH) {
            if (p.moved) cursor = r;
            if (p.clicked) {
              cursor = r;
              return toggle(r);
            }
          }
        }
        if (p.clicked && inSubmit) submit();
      },
      render(g) {
        g.save();
        shake.apply(g);
        rect(g, 0, 0, W, H, '#2b3040');
        header(g, theme?.title || 'Fix the Spreadsheet', `Sheet ${Math.min(sheetIdx + 1, sheetsTotal)}/${sheetsTotal}`);
        timerBar(g, left, total);
        const { valW, totalX } = colX();
        const gx = GRID.x;
        const gy = GRID.y;
        const bottom = rowY(sheet.rows) + 2;
        // Window.
        rect(g, gx - 2, gy - 2, GRID.w + 4, bottom - gy + 4, C.border);
        rect(g, gx, gy, GRID.w, bottom - gy, '#ffffff');
        rect(g, gx, gy, GRID.w, 11, '#217346');
        drawText(g, `Q-Report_v${sheetIdx + 7}_FINAL_final2.xlsx`, gx + 4, gy + 2);
        // Column headers.
        const hy = gy + 12;
        rect(g, gx, hy, GRID.w, GRID.rowH, '#e6e6e6');
        drawText(g, 'Item', gx + GRID.numW + 4, hy + 3, { color: '#444' });
        for (let c = 0; c < sheet.cols; c++) drawText(g, `Q${c + 1}`, gx + GRID.numW + GRID.labelW + c * valW + valW - 6, hy + 3, { color: '#444', align: 'right' });
        drawText(g, 'Total', totalX + GRID.totalW - 6, hy + 3, { color: '#444', align: 'right' });
        // Rows.
        sheet.data.forEach((row, r) => {
          const y = rowY(r);
          rect(g, gx, y, GRID.numW, GRID.rowH, '#e6e6e6');
          drawText(g, String(r + 1), gx + GRID.numW / 2, y + 3, { color: '#666', align: 'center' });
          drawText(g, row.name, gx + GRID.numW + 4, y + 3, { color: C.ink });
          row.vals.forEach((v, c) => drawText(g, String(v), gx + GRID.numW + GRID.labelW + c * valW + valW - 6, y + 3, { color: C.ink, align: 'right' }));
          let fill = '#f3f7ff';
          if (row.flagged) fill = '#ffc9c4';
          if (reveal > 0) {
            if (row.wrong && row.flagged) fill = '#bfe8c4';
            else if (row.wrong) fill = '#ffe08a';
            else if (row.flagged) fill = '#d0d0d0';
          }
          rect(g, totalX, y, GRID.totalW, GRID.rowH, fill);
          drawText(g, row.shown, totalX + GRID.totalW - 6, y + 3, { color: row.flagged && reveal <= 0 ? C.bad : C.ink, align: 'right' });
          if (row.flagged) drawText(g, '!', totalX + 4, y + 3, { color: C.bad });
          if (reveal > 0 && row.wrong && !row.flagged) drawText(g, 'missed', totalX + 3, y + 3, { color: '#8a5a00' });
          if (r === cursor && reveal <= 0) frame(g, totalX, y, GRID.totalW, GRID.rowH, '#217346'), frame(g, totalX + 1, y + 1, GRID.totalW - 2, GRID.rowH - 2, '#217346');
        });
        // Grid lines.
        for (let r = 0; r <= sheet.rows + 1; r++) rect(g, gx, hy + r * GRID.rowH, GRID.w, 1, '#d4d4d4');
        rect(g, gx + GRID.numW, hy, 1, bottom - hy, '#d4d4d4');
        rect(g, gx + GRID.numW + GRID.labelW, hy, 1, bottom - hy, '#d4d4d4');
        for (let c = 1; c < sheet.cols; c++) rect(g, gx + GRID.numW + GRID.labelW + c * valW, hy, 1, bottom - hy, '#d4d4d4');
        rect(g, totalX, hy, 1, bottom - hy, '#a0a0a0');
        // Footer.
        const flags = sheet.data.filter((x) => x.flagged).length;
        drawText(g, `Total = sum of the Q columns. Flagged: ${flags}`, 20, H - 26, { color: C.text, shadow: C.border });
        rect(g, submitRect.x, submitRect.y, submitRect.w, submitRect.h, C.border);
        rect(g, submitRect.x + 1, submitRect.y + 1, submitRect.w - 2, submitRect.h - 2, '#217346');
        drawText(g, 'Submit', submitRect.x + submitRect.w / 2, submitRect.y + 6, { align: 'center' });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
