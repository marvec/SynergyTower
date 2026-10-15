// WebAudio chiptune tracker + synthesized SFX. No audio files, so it works offline.
import { SONGS, CHORD_QUALITIES } from '../data/music.js';

const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function noteToMidi(n) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  if (!m) return null;
  return NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
}
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

function parseChord(name) {
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  return { root: NOTE_INDEX[m[1]], intervals: CHORD_QUALITIES[m[2]] || CHORD_QUALITIES[''] };
}
const chordTone = (ch, i, baseOct) => {
  const n = ch.intervals.length;
  return 12 * (baseOct + 1) + ch.root + ch.intervals[i % n] + 12 * Math.floor(i / n);
};

/** A bar of note tokens ('C5', '-' hold, '.' rest) as events on channel `ch`, `shift` semitones up. */
function lineEvents(events, line, o, ch, vol, shift = 0) {
  const toks = (line || '').split(/\s+/).filter(Boolean);
  toks.forEach((tok, s) => {
    const midi = noteToMidi(tok);
    if (midi == null) return;
    let len = 1;
    while (toks[s + len] === '-') len++;
    events.push({ step: o + s, ch, midi: midi + shift, len, vol });
  });
}
const perBar = (v, bar) => (Array.isArray(v) ? v[bar % v.length] : v);

/** Compiles a song definition into step events. Pure; exported for tests. */
export function compileSong(song) {
  const events = [];
  const bars = song.chords.length;
  song.chords.forEach((name, bar) => {
    const ch = name === 'N' ? null : parseChord(name); // 'N': no harmony this bar
    const o = bar * 16;
    if (song.bassLine) lineEvents(events, song.bassLine[bar], o, 'bass', song.bassVol ?? 0.16);
    else if (song.bass && ch) song.bass.steps.forEach((s, i) => events.push({ step: o + s, ch: 'bass', midi: chordTone(ch, song.bass.tones[i], 2), len: song.bass.len, vol: song.bassVol ?? 0.16 }));
    if (song.arp && ch) song.arp.steps.forEach((s, i) => events.push({ step: o + s, ch: 'arp', midi: chordTone(ch, song.arp.tones[i], 4), len: 1, vol: song.arp.vol }));
    if (song.comp && ch) {
      const hit = (s, len) => ch.intervals.forEach((_, i) => events.push({ step: o + s, ch: 'comp', midi: chordTone(ch, i, 4), len, vol: song.comp.vol }));
      if (song.comp.pattern) {
        // The chord's rhythm for this bar: 'x' strikes, '-' holds, '.' rests.
        const p = perBar(song.comp.pattern, bar);
        [...p].forEach((c, s) => {
          if (c !== 'x') return;
          let len = 1;
          while (p[s + len] === '-') len++;
          hit(s, len);
        });
      } else song.comp.steps.forEach((s) => hit(s, song.comp.len));
    }
    const drums = perBar(song.drums, bar);
    if (drums)
      [...drums].forEach((d, s) => {
        if (d !== '.') events.push({ step: o + s, ch: 'drum', drum: d });
      });
    lineEvents(events, song.melody[bar], o, 'lead', song.leadVol);
    // An octave-doubled lead: the same line `leadDouble` semitones away, softer.
    if (song.leadDouble) lineEvents(events, song.melody[bar], o, 'lead', song.leadVol * 0.5, song.leadDouble);
  });
  events.sort((a, b) => a.step - b.step);
  return { events, steps: bars * 16 };
}

/** Seconds from play() to the first step of the song (the scheduler's lead); a game timed to a song adds it. */
export const SONG_LEAD = 0.05;

export function createAudio() {
  let ctx = null;
  let master, musicGain, sfxGain, noiseBuf;
  const waves = {};
  let musicOn = true;
  let sfxOn = true;
  let current = null; // { name, song, compiled, step, nextTime, idx }
  let timer = null;
  let wanted = null;

  function ensure() {
    if (ctx) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicOn ? 0.7 : 0;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxOn ? 0.8 : 0;
    sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const [name, duty] of [['pulse12', 0.125], ['pulse25', 0.25]]) {
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      waves[name] = ctx.createPeriodicWave(real, imag);
    }
    return true;
  }

  function osc(type, freq, t, dur, vol, dest, { attack = 0.005, release = 0.05, slideTo = null } = {}) {
    const o = ctx.createOscillator();
    if (waves[type]) o.setPeriodicWave(waves[type]);
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(vol, t + attack);
    gn.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release));
    gn.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(gn).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol, dest, filterType, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(gn).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function drum(d, t) {
    if (d === 'k') osc('sine', 150, t, 0.16, 0.5, musicGain, { attack: 0.002, release: 0.1, slideTo: 40 });
    else if (d === 's') noise(t, 0.12, 0.22, musicGain, 'bandpass', 1800);
    else if (d === 'h') noise(t, 0.035, 0.07, musicGain, 'highpass', 7500);
    else if (d === 'o') noise(t, 0.16, 0.06, musicGain, 'highpass', 6500);
    else if (d === 'r') osc('square', 1700, t, 0.025, 0.05, musicGain, { attack: 0.001, release: 0.02 });
  }

  function scheduleEvent(ev, t, stepDur, song) {
    if (ev.ch === 'drum') return drum(ev.drum, t);
    const f = midiToFreq(ev.midi);
    const dur = ev.len * stepDur * 0.95;
    if (ev.ch === 'bass') osc(song.bassWave || 'triangle', f, t, dur, ev.vol, musicGain, { release: 0.04 });
    else if (ev.ch === 'lead') osc(song.lead, f, t, dur, ev.vol, musicGain, { attack: 0.01, release: Math.min(0.12, dur / 2) });
    else if (ev.ch === 'arp') osc('pulse25', f, t, dur, ev.vol, musicGain, { release: 0.03 });
    else if (ev.ch === 'comp') osc('triangle', f, t, dur, ev.vol * 1.4, musicGain, { attack: 0.01, release: 0.08 });
  }

  function pump() {
    if (!current || !ctx) return;
    const { song, compiled } = current;
    const stepDur = 60 / song.bpm / 4;
    while (current.nextTime < ctx.currentTime + 0.15) {
      const swingOff = current.step % 2 === 1 ? song.swing * stepDur : 0;
      while (current.idx < compiled.events.length && compiled.events[current.idx].step === current.step) {
        scheduleEvent(compiled.events[current.idx], current.nextTime + swingOff, stepDur, song);
        current.idx++;
      }
      current.step++;
      current.nextTime += stepDur;
      if (current.step >= compiled.steps) {
        if (song.once) {
          const after = current.after;
          current = null;
          // On to `after`, unless another song was asked for in the meantime (it set `wanted` and plays already).
          if (after) setTimeout(() => !current && wanted?.name === after && api.play(after), 300);
          return;
        }
        current.step = 0;
        current.idx = 0;
      }
    }
  }

  // The business-trip car is electric: a soft motor tone, a faint inverter whine that rises with speed and a little tyre
  // noise. Continuous nodes on the SFX bus (so the sound setting mutes it), retuned by hum(level).
  let hum = null;
  function startHum() {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(sfxGain);
    const tone = (type, freq, vol) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const gn = ctx.createGain();
      gn.gain.value = vol;
      o.connect(gn).connect(out);
      o.start();
      return { o, gn };
    };
    const motor = tone('sine', 70, 0.05);
    const motor2 = tone('sine', 141, 0.012); // a slightly sharp octave beats gently against the motor
    const whine = tone('sine', 300, 0);
    const road = ctx.createBufferSource();
    road.buffer = noiseBuf;
    road.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const roadGain = ctx.createGain();
    roadGain.gain.value = 0;
    road.connect(lp).connect(roadGain).connect(out);
    road.start();
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
    return {
      out, motor, motor2, whine, roadGain,
      stop() {
        for (const n of [motor.o, motor2.o, whine.o, road]) n.stop();
        out.disconnect();
      },
    };
  }

  const compiledCache = {};
  const api = {
    /** The electric car's hum at `level` 0 (standing) .. 1 (top speed); null stops it. */
    hum(level) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (level == null) {
        if (!hum) return;
        const h = hum;
        hum = null;
        h.out.gain.setTargetAtTime(0, t, 0.08);
        setTimeout(() => h.stop(), 600);
        return;
      }
      hum ||= startHum();
      const k = Math.max(0, Math.min(1, level));
      hum.motor.o.frequency.setTargetAtTime(70 + 45 * k, t, 0.12);
      hum.motor2.o.frequency.setTargetAtTime(141 + 92 * k, t, 0.12);
      hum.whine.o.frequency.setTargetAtTime(280 + 820 * k, t, 0.12);
      hum.whine.gn.gain.setTargetAtTime(0.003 + 0.012 * k, t, 0.12);
      hum.roadGain.gain.setTargetAtTime(0.02 * k + 0.05 * k * k, t, 0.12);
    },
    /** The page/app went to the background (true) or came back: the music pauses meanwhile. iOS also leaves the
     *  context 'interrupted' after a phone call or the app switcher, which resume() fixes. */
    background(hidden) {
      if (!ctx) return;
      if (hidden) ctx.suspend?.().catch(() => {});
      else if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
    },
    unlock() {
      if (!ensure()) return;
      if (ctx.state !== 'running') ctx.resume();
      if (!timer) timer = setInterval(pump, 25);
      if (wanted && !current) api.play(wanted.name, wanted.after);
    },
    /**
     * Play a song (loops unless it's a one-shot). `after` = song to continue with after a one-shot. A looping song that is
     * already playing plays on, unless `restart`: then it starts again, `from` seconds into it (a game timed to the song
     * restarts it when play starts or resumes; second `from` of the song sounds SONG_LEAD after the call).
     */
    play(name, after = null, { restart = false, from = 0 } = {}) {
      const song = SONGS[name];
      if (!song) return;
      // `wanted`: the song to play once the music can (unlock): this one, or after a one-shot the song that follows it
      // (none given: the one asked for before), on every path below.
      if (!song.once) wanted = { name };
      else if (after) wanted = { name: after };
      if (!ctx) return;
      if (current && current.name === name && !song.once && !restart) return;
      const compiled = (compiledCache[name] ||= compileSong(song));
      const stepDur = 60 / song.bpm / 4;
      const first = Math.max(0, Math.ceil(from / stepDur - 1e-6)); // the first whole step at or after `from`
      const lead = SONG_LEAD + first * stepDur - Math.max(0, from);
      if (song.once && first >= compiled.steps) {
        current = null;
        if (after) api.play(after);
        return;
      }
      const step = first % compiled.steps;
      let idx = compiled.events.findIndex((e) => e.step >= step);
      if (idx < 0) idx = compiled.events.length;
      current = { name, song, compiled, step, idx, nextTime: ctx.currentTime + lead, after };
    },
    stop() {
      current = null;
      wanted = null;
    },
    get current() {
      return current?.name || null;
    },
    /** The song to play once the music can: the one asked for, or the one after a one-shot. */
    get wanted() {
      return wanted?.name || null;
    },
    /** Where the scheduler stands: the song, its next step and the seconds until that step sounds (null: silence). */
    get position() {
      return current && ctx ? { name: current.name, step: current.step, at: current.nextTime - ctx.currentTime } : null;
    },
    setMusic(on) {
      musicOn = on;
      if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.05);
    },
    setSfx(on) {
      sfxOn = on;
      if (sfxGain) sfxGain.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02);
    },
    sfx(name) {
      if (!ctx || !sfxOn) return;
      const t = ctx.currentTime + 0.005;
      const S = sfxGain;
      switch (name) {
        case 'blip': osc('pulse25', 880, t, 0.05, 0.12, S); break;
        case 'click': osc('square', 1300, t, 0.03, 0.08, S, { release: 0.02 }); break;
        case 'type': osc('square', 1800 + Math.random() * 400, t, 0.015, 0.04, S, { attack: 0.001, release: 0.01 }); break;
        case 'step': noise(t, 0.03, 0.05, S, 'lowpass', 900); break;
        case 'good': osc('pulse25', 660, t, 0.07, 0.14, S); osc('pulse25', 990, t + 0.07, 0.1, 0.14, S); break;
        case 'bad': osc('square', 180, t, 0.18, 0.12, S, { slideTo: 90 }); break;
        case 'coin': osc('square', 988, t, 0.06, 0.1, S); osc('square', 1319, t + 0.06, 0.16, 0.1, S); break;
        case 'door': noise(t, 0.25, 0.15, S, 'lowpass', 600); osc('triangle', 220, t, 0.2, 0.1, S, { slideTo: 110 }); break;
        case 'ding': osc('sine', 1318, t, 0.6, 0.22, S, { release: 0.5 }); osc('sine', 1046, t + 0.25, 0.9, 0.22, S, { release: 0.8 }); break;
        case 'levelup': [523, 659, 784, 1046].forEach((f, i) => osc('pulse25', f, t + i * 0.07, 0.12, 0.13, S)); break;
        case 'star': osc('pulse12', 1568, t, 0.08, 0.1, S); osc('pulse12', 2093, t + 0.06, 0.14, 0.1, S); break;
        case 'cash': [1319, 1568, 2093].forEach((f, i) => osc('square', f, t + i * 0.05, 0.08, 0.09, S)); noise(t + 0.15, 0.2, 0.08, S, 'highpass', 5000); break;
        case 'start': [392, 523, 659].forEach((f, i) => osc('square', f, t + i * 0.08, 0.1, 0.1, S)); break;
        case 'alarm': [0, 0.22, 0.44, 0.66].forEach((d, i) => osc('square', i % 2 ? 660 : 880, t + d, 0.2, 0.1, S)); break;
        case 'crash': noise(t, 0.7, 0.32, S, 'lowpass', 1400); osc('square', 140, t, 0.45, 0.12, S, { slideTo: 40 }); break;
        case 'skid': noise(t, 0.18, 0.08, S, 'highpass', 2500); break;
        case 'fail': [392, 330, 262].forEach((f, i) => osc('square', f, t + i * 0.12, 0.14, 0.1, S)); break;
        default: break;
      }
    },
  };
  return api;
}
