// Vercel Function: POST /api/feedback. Verifies a reCAPTCHA v3 token, then emails the message via Resend.
// Env: RECAPTCHA_SECRET, RESEND_API_KEY, FEEDBACK_TO (required); FEEDBACK_FROM, ALLOWED_ORIGINS, RECAPTCHA_MIN_SCORE (optional).
const DEFAULT_ORIGINS = [
  'https://synergytower.co.uk',
  'https://www.synergytower.co.uk',
  'https://marvec.github.io',
  'http://localhost:5317',
  'http://localhost:4317',
].join(',');
const MAX_MESSAGE = 4000;
const TOPICS = { task: 'Task idea', bug: 'Bug report', sponsor: 'Sponsorship', other: 'Inquiry' };

function cors(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((s) => s.trim());
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, headers) => Response.json(body, { status, headers });
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function verifyCaptcha(token, ip) {
  const params = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET, response: token });
  if (ip) params.set('remoteip', ip);
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: params });
  const r = await res.json();
  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  return r.success && r.action === 'feedback' && (r.score ?? 0) >= minScore ? null : r;
}

export function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('origin')) });
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  const headers = cors(origin);
  if (!headers['Access-Control-Allow-Origin']) return json({ error: 'Origin not allowed' }, 403);
  for (const k of ['RECAPTCHA_SECRET', 'RESEND_API_KEY', 'FEEDBACK_TO']) {
    if (!process.env[k]) return json({ error: `Server is missing ${k}` }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, headers);
  }
  const message = clean(body.message, MAX_MESSAGE);
  const email = clean(body.email, 200);
  const context = clean(body.context, 500);
  const topic = TOPICS[body.topic] || TOPICS.other;
  if (message.length < 3) return json({ error: 'Message is empty' }, 400, headers);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400, headers);
  if (topic === TOPICS.sponsor && !email) return json({ error: 'Email is required for sponsorship' }, 400, headers);
  if (typeof body.token !== 'string' || !body.token) return json({ error: 'Missing captcha' }, 400, headers);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  const failed = await verifyCaptcha(body.token, ip);
  if (failed) {
    console.warn('captcha rejected', JSON.stringify({ score: failed.score, action: failed.action, errors: failed['error-codes'] }));
    return json({ error: 'Captcha check failed' }, 403, headers);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM || 'SynergyTower <onboarding@resend.dev>',
      to: process.env.FEEDBACK_TO.split(',').map((s) => s.trim()),
      subject: `[SynergyTower ${topic}] ${message.split('\n')[0].slice(0, 60)}`,
      text: `${message}\n\n---\nTopic: ${topic}\nFrom: ${email || '(no email)'}\nOrigin: ${origin}\nContext: ${context || '-'}\n`,
      ...(email && { reply_to: email }),
    }),
  });
  if (!res.ok) {
    console.error('resend failed', res.status, await res.text());
    return json({ error: 'Could not send the message' }, 502, headers);
  }
  return json({ ok: true }, 200, headers);
}
