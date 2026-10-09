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
