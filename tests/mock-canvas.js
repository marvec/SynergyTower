// Headless stand-ins for canvas/document so rendering code can run under `bun test`.
export function mockContext(canvas) {
  const noop = () => {};
  const target = {
    canvas,
    measureText: (s) => ({ width: String(s).length * 5 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    // Like a real canvas: drawing a missing image is a TypeError (a null or undefined source, e.g. an index past a sprite list).
    drawImage: (img) => {
      if (img == null) throw new TypeError("Failed to execute 'drawImage' on 'CanvasRenderingContext2D': the image is " + img);
    },
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => ((t[k] = v), true),
  });
}

export function mockCanvas(w = 480, h = 270) {
  const c = { width: w, height: h, style: {} };
  const ctx = mockContext(c);
  c.getContext = () => ctx;
  return c;
}

export function installMockDocument() {
  if (globalThis.document) return;
  globalThis.document = { createElement: () => mockCanvas(16, 16) };
}

/** A mock canvas that records every fillRect with the fill colour and global alpha at that moment: { canvas, ctx, calls }.
 *  save()/restore() keep the alpha like a real canvas. */
export function recordingCanvas(w = 480, h = 270) {
  const calls = [];
  const c = { width: w, height: h, style: {} };
  const inner = mockContext(c);
  const saved = [];
  let alpha = 1;
  const own = {
    fillRect: (x, y, ww, hh) => calls.push({ x, y, w: ww, h: hh, fill: inner.fillStyle, alpha }),
    save: () => saved.push(alpha),
    restore: () => saved.length && (alpha = saved.pop()),
  };
  const ctx = new Proxy(inner, {
    get: (t, k) => (k in own ? own[k] : k === 'globalAlpha' ? alpha : t[k]),
    set: (t, k, v) => (k === 'globalAlpha' ? (alpha = v) : (t[k] = v), true),
  });
  c.getContext = () => ctx;
  return { canvas: c, ctx, calls };
}
