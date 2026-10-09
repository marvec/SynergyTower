// Org Chart Shuffle content: employee names (<= 6 chars), quirks (verb phrases that read after "whoever"),
// chart titles per department and HR's verdicts. Pure data.
export const NAMES = [
  'Dana', 'Kevin', 'Priya', 'Lee', 'Sam', 'Kim', 'Ada', 'Bob', 'Cleo', 'Dev', 'Eve', 'Finn', 'Gus', 'Hana',
  'Kai', 'Lena', 'Milo', 'Nia', 'Otto', 'Rosa', 'Tess', 'Vera', 'Raj', 'Yuki', 'Omar', 'Ines', 'Jules', 'Marta',
  'Nadia', 'Pavel', 'Quinn', 'Rita', 'Sven', 'Theo', 'Uma', 'Wes', 'Zoe', 'Bruno', 'Chen', 'Ivo', 'Lars', 'Mei',
  'Noor', 'Femi', 'Gary',
];

export const QUIRKS = [
  'owns the good stapler',
  'waters the plants',
  'microwaves fish',
  'replies all to everything',
  'has a standing desk',
  'brings sad donuts',
  'names the printers',
  'hums during calls',
  'labels their yogurt',
  'never unmutes',
  'owns three lanyards',
  'books 8am meetings',
  'loves a good pivot',
  'has a desk cactus',
  'quotes LinkedIn posts',
  'wears a headset all day',
  'hoards the snacks',
  'runs the fantasy league',
  'still uses the fax',
  'types very loudly',
  'prints every email',
  'talks about CrossFit',
  'fixes the coffee machine',
  'owns a label maker',
  'runs the fire drills',
  'writes 40-slide decks',
  'reheats old coffee',
  'has 9000 unread emails',
  'knows the wifi password',
  'wears socks with sandals',
  'claps when planes land',
  'brings their dog to work',
];

export const CHART_TITLES = {
  default: ['Q3 Synergy Realignment', 'Surprise Reorg v7', 'Org Chart 2.0 (Final)'],
  lobby: ['Front Desk Realignment', 'Mailroom Restructure', 'Lobby Synergy Pods'],
  support: ['Ticket Swarm Pods', 'Support Tiger Team', 'Customer Joy Squads'],
  sales: ['Sales Tiger Teams', 'Pipeline Pods', 'Quota Crusher Reorg'],
  marketing: ['Brand Squad Shuffle', 'Growth Guild Reorg', 'Viral Pods Initiative'],
  it: ['IT Platform Squads', 'DevOps Tribe Remix', 'Agile Release Trains'],
  finance: ['Cost Center Realignment', 'Q3 Budget Pods', 'Lean Ledger Squads'],
  legalhr: ['People Ops Refresh', 'Compliance Circles', 'Talent Pods Pilot'],
  exec: ['C-Suite Shake-Up', 'Leadership Matrix 3.0', 'Strategic Realignment'],
};

// Banner after SUBMIT, by result.
export const VERDICT_PERFECT = [
  'Reorg approved! Nobody cried.',
  'Flawless. HR is printing lanyards.',
  'Approved. The CEO says "synergy".',
  'Perfect. Effective yesterday.',
];
export const VERDICT_OK = [
  'Approved with "minor feedback".',
  'Mostly right. Two people quit.',
  'Close enough for a press release.',
  'HR will "socialise" the gaps.',
];
export const VERDICT_BAD = [
  'Chaos. Kevin now manages Kevin.',
  'Rejected. Please re-reorg.',
  'The org chart is now a circle.',
  'Legal has questions. Many.',
];
