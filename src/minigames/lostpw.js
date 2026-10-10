// Lost Password, desk part: log back in with your pet's name, which you spotted on one of the floor's whiteboards.
// The floor part (whiteboards appear, search against the clock) lives in src/scenes/floorQuest.js.
import { W, C, rect, frame, drawText, backdrop, header, timerBar, monitor, choiceBox, pickChoice, Floaters, Shake, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { PETS, PET_NAMES, SPECIES_NAME } from '../data/mg-lostpw.js';

const BOXES = [0, 1, 2, 3, 4, 5].map((k) => ({ x: 96 + (k % 2) * 148, y: 106 + Math.floor(k / 2) * 26, w: 140, h: 22 }));
const ATTEMPT_SCORE = [1, 0.55, 0.3];

/** The lost password and the pets on the decoy boards; also used when the game runs without a floor (tests). */
export function lostPassword(rng, decoyCount = 0) {
  const names = rng.shuffle([...PET_NAMES]);
  const species = rng.shuffle(Object.keys(PETS));
  return {
    pet: { species: species[0], name: names[0] },
    decoys: Array.from({ length: decoyCount }, (_, i) => ({ species: rng.chance(0.5) ? species[0] : species[1 + (i % 5)], name: names[1 + i] })),
    seen: false,
    speed: 0.5,
  };
}

export default {
  id: 'lostpw',
  name: 'Lost Password',
  quest: 'lostpw',
  deskHelp: 'Log back in: pick your pet\'s name from the autofill list (1-6, arrows + Enter, or click). Three attempts.',
  help: 'You are locked out! Your password is your pet\'s name and a photo of your pet is on a whiteboard somewhere on this floor. Find it, then log back in.',
  create({ difficulty: d, rng, theme, sfx = () => {}, quest }) {
    const q = quest || lostPassword(rng, Math.round(byDiff(d, 0, 3)));
    const user = q.user || 'newhire';
    const fl = new Floaters();
    const shake = new Shake();
    const total = new Countdown(byDiff(d, 30, 20));
    const opts = new Set([q.pet.name, ...q.decoys.map((p) => p.name)]);
    for (const nm of rng.shuffle([...PET_NAMES])) if (opts.size < 6) opts.add(nm);
    const options = rng.shuffle([...opts]);
    const wrong = new Set();
    let attempt = 0;
    let welcome = 0;
    const st = { focus: 0 };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ options, answer: q.pet.name }), // tests
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (welcome > 0) {
          welcome -= dt;
          if (welcome <= 0) finish(inst, ATTEMPT_SCORE[attempt] * (0.75 + 0.25 * (q.speed ?? 0.5)));
          return;
        }
        if (total.update(dt)) return finish(inst, 0);
        const pick = pickChoice(input, BOXES, st);
        if (pick < 0 || wrong.has(pick)) return;
        if (options[pick] === q.pet.name) {
          sfx('good');
          welcome = 1;
          fl.add('Welcome back!', W / 2, 96, C.good);
          return;
        }
        wrong.add(pick);
        attempt++;
        sfx('bad');
        shake.hit();
        if (attempt >= ATTEMPT_SCORE.length) {
          fl.add('Account locked. Call IT.', W / 2, 96, C.bad);
          return finish(inst, 0);
        }
        fl.add(`Incorrect password (${ATTEMPT_SCORE.length - attempt} left)`, W / 2, 96, C.bad);
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#22283a', desk: '#5a4632' });
        header(g, theme?.title || 'Lost Password', `Attempts left: ${ATTEMPT_SCORE.length - attempt}`);
        timerBar(g, total.left, total.total);
        const s = monitor(g, 70, 30, 340, 170, '#1d3b6a');
        rect(g, s.x, s.y, s.w, s.h, welcome > 0 ? '#2f6b3a' : '#1d3b6a');
        // Login box.
        rect(g, s.x + 20, s.y + 10, s.w - 40, 46, 'rgba(0,0,0,0.25)');
        rect(g, s.x + 30, s.y + 16, 24, 24, '#c8cdd8');
        rect(g, s.x + 36, s.y + 20, 12, 10, '#7a7f90');
        rect(g, s.x + 33, s.y + 32, 18, 8, '#7a7f90');
        drawText(g, `user: ${user}`, s.x + 62, s.y + 16, { color: '#fff' });
        drawText(g, welcome > 0 ? 'Logging in...' : `Hint: my ${SPECIES_NAME[q.pet.species]}'s name`, s.x + 62, s.y + 28, { color: '#c8d8f0' });
        drawText(g, q.seen ? 'You remember the photo...' : 'If only you could remember...', s.x + 62, s.y + 40, { color: q.seen ? C.gold : '#8a9ab8' });
        drawText(g, 'Autofill suggestions:', s.x + 26, s.y + 64, { color: '#c8d8f0' });
        options.forEach((o, k) => {
          const b = BOXES[k];
          let state = st.focus === k ? 'focus' : 'idle';
          if (wrong.has(k)) state = 'wrong';
          if (welcome > 0 && o === q.pet.name) state = 'right';
          choiceBox(g, b.x, b.y, b.w, b.h, String(k + 1), '*'.repeat(Math.min(8, o.length)) + '  ' + o, state);
        });
        frame(g, s.x, s.y, s.w, s.h, C.border);
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
