// Mockup harness (not game code): install(suffix, MOCKS) defines window['__mockShot' + suffix](name, t), which draws
// mockup `name` at time t on a 480x270 canvas and returns it 2x as a PNG data URL; window['__mockList' + suffix]().
import { setStyle } from './kit.js';

/** Wrap a mockup so it draws in the in-between style. */
export const mid = (f) => (g, t) => {
  setStyle('mid');
  try {
    f(g, t);
  } finally {
    setStyle('fine');
  }
};

export function install(suffix, MOCKS) {
  window['__mockList' + suffix] = () => Object.keys(MOCKS);
  window['__mockShot' + suffix] = (name, t = 1.3) => {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 270;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    MOCKS[name](g, t);
    const o = document.createElement('canvas');
    o.width = 960;
    o.height = 540;
    const og = o.getContext('2d');
    og.imageSmoothingEnabled = false;
    og.drawImage(c, 0, 0, 960, 540);
    return o.toDataURL('image/png');
  };
}
