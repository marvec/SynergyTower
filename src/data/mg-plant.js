// Desk Plant Survival content: weekly captions (by mood) and random office events.
export const CAPTIONS_GOOD = [
  'Plant attended a webinar.',
  'Plant exceeded expectations.',
  'Plant joined a Slack channel.',
  'Plant was cc-ed on everything.',
  'Plant updated its OKRs.',
  'Plant gave a TED talk to the stapler.',
  'Plant got a shout-out in all-hands.',
  'Plant now has a LinkedIn premium.',
  'Plant took a mindfulness course.',
  'Plant volunteered for the offsite.',
  'Plant drafted a vision statement.',
  'Plant is "thriving in ambiguity".',
  'Plant was asked to mentor an intern.',
  'Plant leveraged some synergy.',
  'Plant photosynthesised a KPI.',
  'Plant booked a meeting room for itself.',
  'Plant is up for Employee of the Month.',
  'Plant renamed itself Kevin.',
  'Plant passed the compliance quiz.',
  'Plant has a growth mindset. Literally.',
  'Plant approved your expense report.',
  'Plant started a book club.',
];

export const CAPTIONS_BAD = [
  'Plant updated its LinkedIn.',
  'Plant is "exploring options".',
  'Plant asked HR about leave.',
  'Plant skipped the standup.',
  'Plant feels undervalued.',
  'Plant took a long lunch. Forever?',
  'Plant has been quiet-quitting.',
  'Plant filed a complaint.',
  'Plant stopped replying to emails.',
  'Plant is on a performance plan.',
  'Plant googled "is my desk toxic".',
  'Plant left a passive-aggressive note.',
  'Plant is dropping leaves like hints.',
  'Plant requested a new manager.',
];

// Random office events. kind drives the effect in plant.js.
export const EVENTS = [
  { kind: 'ac', text: 'Facilities set the AC to Arctic.', sub: 'Water drains slowly.' },
  { kind: 'coffee', text: 'A colleague dumped cold coffee in it!', sub: 'Water up. Careful!' },
  { kind: 'weekend', text: 'Weekend! Office closed.', sub: 'No actions for a bit.' },
  { kind: 'window', text: 'Someone moved your plant to the window.', sub: 'Light shooting up!' },
  { kind: 'fruit', text: 'Fruit bowl incident: aphids incoming!', sub: 'Get the spray.' },
  { kind: 'intern', text: 'The intern "helped" and watered it.', sub: 'Water up. Again.' },
  { kind: 'heat', text: 'Heatwave! The AC is "under review".', sub: 'Water evaporating fast.' },
  { kind: 'audit', text: 'Facilities audit: blinds forced open.', sub: 'Close them again!' },
];
