// synergytower.co.uk/feedback: the game's contact form on a page of its own, so places that can only show a web
// address (the Commodore 64 version, printed material) can point here. ?topic=task|bug|sponsor|other preselects a
// topic; ?from=... (e.g. c64) is attached to the message as its context.
import { openFeedback, TOPICS } from '../engine/feedback.js';
import { initAnalytics } from '../engine/analytics.js';

const params = new URLSearchParams(location.search);
const topic = TOPICS.some((t) => t.id === params.get('topic')) ? params.get('topic') : 'task';
const from = (params.get('from') || '').replace(/[^\w .,@-]/g, '').slice(0, 60);
const context = from ? `feedback page (from ${from})` : 'feedback page';

initAnalytics();
const show = () => openFeedback(context, topic);
document.getElementById('open').addEventListener('click', show);
show();
