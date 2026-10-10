// Feedback form: a DOM overlay (real text fields work better than canvas ones, especially on phones).
// Protected by reCAPTCHA v3, whose script is only loaded when the form is first opened.
import { FEEDBACK_URL, RECAPTCHA_SITE_KEY } from '../config.js';
import { track } from './analytics.js';

let recaptcha = null;
function loadRecaptcha() {
  recaptcha ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    s.async = true;
    s.onload = () => window.grecaptcha.ready(() => resolve(window.grecaptcha));
    s.onerror = () => {
      recaptcha = null;
      reject(new Error('Could not load reCAPTCHA (offline?)'));
    };
    document.head.appendChild(s);
  });
  return recaptcha;
}

/** Topics offered in the form; the server only accepts these ids. */
export const TOPICS = [
  { id: 'task', label: 'Suggest a new task type', hint: 'Which office chore should become a mini-game? How would it play?' },
  { id: 'bug', label: 'Report a bug', hint: 'What happened, and what did you expect? Which floor or task?' },
  { id: 'sponsor', label: 'Sponsorship / your logo on a poster', hint: 'Your brand, and what you would like to put on the hallway posters.' },
  { id: 'other', label: 'Other inquiry', hint: 'Your message' },
];

let open = false;
export const feedbackOpen = () => open;

/** Opens the form. `context` is a short string (career progress etc.) attached to the email; `topic` preselects a TOPICS id. */
export function openFeedback(context = '', topic = 'task') {
  if (open) return;
  open = true;
  track('feedback_open', { topic });
  if (RECAPTCHA_SITE_KEY) loadRecaptcha().catch(() => {});

  const wrap = document.createElement('div');
  wrap.id = 'feedback';
  wrap.innerHTML = `
    <form>
      <h2>Contact the author</h2>
      <p>Got an idea for a new task, found a bug, or want your logo in the tower? Get in touch.</p>
      <select name="topic">${TOPICS.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
      <textarea name="message" rows="6" maxlength="4000" required></textarea>
      <input name="email" type="email" maxlength="200" />
      <div class="status" role="status"></div>
      <div class="row">
        <button type="button" class="cancel">Cancel</button>
        <button type="submit">Send</button>
      </div>
      <small>Protected by reCAPTCHA. Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy</a>
        and <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms</a> apply.</small>
    </form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector('form');
  const status = wrap.querySelector('.status');
  const send = form.querySelector('[type=submit]');
  const close = () => {
    open = false;
    wrap.remove();
  };
  const syncTopic = () => {
    const t = TOPICS.find((x) => x.id === form.topic.value);
    form.message.placeholder = t.hint;
    form.email.required = t.id === 'sponsor';
    form.email.placeholder = form.email.required ? 'Your email (so we can reply)' : 'Your email (optional, for a reply)';
  };
  form.topic.value = TOPICS.some((t) => t.id === topic) ? topic : 'task';
  syncTopic();
  form.topic.addEventListener('change', syncTopic);
  const say = (text, cls = '') => {
    status.textContent = text;
    status.className = `status ${cls}`;
  };

  wrap.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  });
  wrap.addEventListener('pointerdown', (e) => e.target === wrap && close());
  form.querySelector('.cancel').addEventListener('click', close);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = form.message.value.trim();
    if (message.length < 3) return say('Please write a few words first.', 'err');
    if (form.email.required && !form.email.value.trim()) return say('Please leave an email so we can reply.', 'err');
    if (!RECAPTCHA_SITE_KEY) return say('Feedback is not set up yet (missing reCAPTCHA key).', 'err');
    send.disabled = true;
    say('Sending…');
    try {
      const grecaptcha = await loadRecaptcha();
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'feedback' });
      const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: form.topic.value, message, email: form.email.value.trim(), context, token }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || `Server error ${res.status}`);
      track('feedback_sent', { topic: form.topic.value });
      say('Thanks! Your feedback was sent.', 'ok');
      setTimeout(close, 1500);
    } catch (err) {
      say(`${err.message}. Please try again.`, 'err');
      send.disabled = false;
    }
  });
  setTimeout(() => form.message.focus(), 0);
}
