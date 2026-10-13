// A real <input> positioned over a canvas rect, so typing works on desktop and mobile keyboards.
export class TextField {
  constructor(screen, { x, y, w, h, value = '', maxLength = 22, placeholder = '' }) {
    this.screen = screen;
    this.rect = { x, y, w, h };
    this.el = document.createElement('input');
    this.el.type = 'text';
    this.el.maxLength = maxLength;
    this.el.value = value;
    this.el.placeholder = placeholder;
    this.el.autocomplete = 'off';
    this.el.spellcheck = false;
    this.el.className = 'st-textfield';
    Object.assign(this.el.style, {
      position: 'fixed',
      boxSizing: 'border-box',
      border: '0',
      outline: 'none',
      background: '#f4f1e8',
      color: '#1b1e2b',
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      fontWeight: 'bold',
      padding: '0 6px',
      borderRadius: '0',
      zIndex: '5',
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        this.el.blur();
        this.onEnter?.();
      }
      e.stopPropagation();
    });
    document.body.appendChild(this.el);
    this.layout();
    // Follow the canvas when it re-fits: rotation, or iOS shrinking the view for the keyboard (visualViewport only).
    this.unfit = screen.onFit?.(() => this.layout());
  }
  get value() {
    return this.el.value.trim();
  }
  focus() {
    this.el.focus();
  }
  get focused() {
    return document.activeElement === this.el;
  }
  layout() {
    const r = this.screen.toClient(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    Object.assign(this.el.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      fontSize: `${Math.max(10, Math.round(r.height * 0.55))}px`,
    });
  }
  destroy() {
    this.unfit?.();
    this.el.remove();
  }
}
