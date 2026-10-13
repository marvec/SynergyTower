// Fixed logical resolution, scaled to fit the window (integer scale when possible for crisp pixels).
export const W = 480;
export const H = 270;

export function createScreen(canvas) {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  let scale = 1;
  let rect = { left: 0, top: 0 };

  function fit() {
    // The space inside the body's safe-area padding (style.css), so notches never cover the game.
    // The visual viewport shrinks when a phone's keyboard opens (the terminal): the game then fits above it.
    const vv = window.visualViewport;
    const fullH = Math.round(vv ? Math.min(vv.height, window.innerHeight) : window.innerHeight);
    document.body.style.height = fullH < window.innerHeight ? `${fullH}px` : '';
    const cs = getComputedStyle(document.body);
    const px = (k) => parseFloat(cs[k]) || 0;
    const vw = window.innerWidth - px('paddingLeft') - px('paddingRight');
    // The portrait dock (scenes/portraitDock.js) takes the space under the game.
    const dock = document.getElementById('dock');
    const dockH = dock && dock.offsetParent !== null ? dock.offsetHeight : 0;
    const vh = fullH - px('paddingTop') - px('paddingBottom') - dockH;
    const s = Math.min(vw / W, vh / H);
    scale = s >= 2 ? Math.floor(s) : s;
    canvas.style.width = `${Math.floor(W * scale)}px`;
    canvas.style.height = `${Math.floor(H * scale)}px`;
    rect = canvas.getBoundingClientRect();
  }
  window.addEventListener('resize', fit);
  // Phones report the new size a moment after turning; fit again once it has settled.
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  window.visualViewport?.addEventListener('resize', fit);
  fit();

  return {
    g,
    canvas,
    fit,
    toGame(clientX, clientY) {
      rect = canvas.getBoundingClientRect();
      return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
    },
    /** Client-space rectangle for a game-space rect (to position DOM overlays like <input>). */
    toClient(x, y, w, h) {
      rect = canvas.getBoundingClientRect();
      const k = rect.width / W;
      return { left: rect.left + x * k, top: rect.top + y * k, width: w * k, height: h * k, k };
    },
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
