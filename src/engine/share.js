// Sharing a short text (the Daily Memo's result): the app's share sheet, the phone browser's, the clipboard, or at
// last a box with the text selected to copy by hand. Call it from a click or key press: share sheets and the
// clipboard need a recent user activation.
import { C } from './ui.js';
import { isTouch, plugin } from './platform.js';

let boxOpen = false;
export const shareBoxOpen = () => boxOpen;

const cancelled = (e) => e?.name === 'AbortError' || /cancel/i.test(e?.message || '');

/**
 * Shares `text` the first way that works: 'native' (the app's sheet), 'share' (Web Share on a phone or tablet; on a
 * desktop a copied text pastes more easily into a chat), 'clipboard' (with a toast), 'dialog' (the box), or
 * 'cancelled' when the player closed a share sheet (no toast, no fallback).
 */
export async function shareText(game, text) {
  const sheet = plugin('Share');
  if (sheet) {
    try {
      await sheet.share({ text });
      return 'native';
    } catch (e) {
      if (cancelled(e)) return 'cancelled';
    }
  }
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (isTouch() && nav?.share) {
    try {
      await nav.share({ text });
      return 'share';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      game.toast('Copied! Paste it anywhere.', C.good);
      return 'clipboard';
    } catch {
      /* no permission: the box */
    }
  }
  openShareBox(text);
  return 'dialog';
}

/** A DOM box (canvas text cannot be selected) with the exact text, selected, and a Close button. Esc closes it. */
export function openShareBox(text) {
  if (boxOpen) return null;
  boxOpen = true;
  const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
  const wrap = el('div', { id: 'sharebox' });
  const form = el('form');
  const area = el('textarea', { value: text, readOnly: true, rows: 3 });
  const row = el('div', { className: 'row' });
  const close = el('button', { type: 'button', textContent: 'Close' });
  row.appendChild(close);
  for (const c of [el('h2', { textContent: 'Share your result' }), el('p', { textContent: 'Copy this text and paste it anywhere.' }), area, row]) form.appendChild(c);
  wrap.appendChild(form);
  document.body.appendChild(wrap);
  const done = () => {
    boxOpen = false;
    wrap.remove();
  };
  wrap.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') done();
  });
  wrap.addEventListener('pointerdown', (e) => e.target === wrap && done());
  form.addEventListener('submit', (e) => e.preventDefault());
  close.addEventListener('click', done);
  area.focus();
  area.select();
  return wrap;
}
