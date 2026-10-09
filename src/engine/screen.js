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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    scale = s >= 2 ? Math.floor(s) : s;
    canvas.style.width = `${Math.floor(W * scale)}px`;
    canvas.style.height = `${Math.floor(H * scale)}px`;
    rect = canvas.getBoundingClientRect();
  }
  window.addEventListener('resize', fit);
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
