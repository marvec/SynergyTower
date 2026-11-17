// Browser half of `bun itch/build-art.js`: draws the art and sends each PNG back to the server, which saves it.
import { cover, banner } from './art.js';

const status = document.getElementById('status');
const done = [];
for (const [name, make] of [['cover.png', cover], ['banner.png', banner]]) {
  const c = make();
  document.body.append(c);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  await fetch(`/save/${name}`, { method: 'POST', body: blob });
  done.push(`${name} ${c.width}x${c.height}`);
}
status.textContent = `Saved: ${done.join(', ')}`;
document.title = 'done';
