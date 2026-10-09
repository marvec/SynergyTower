// PowerPoint Karaoke content. Charts are generated procedurally from these labels; the correct narration
// is derived from the generated data. Placeholders: {Y} metric (capitalised), {y} metric, {unit}, {prep}, {X},
// {L} pie label, {A}/{B}/{a}/{b} matrix axes and high/low, {S1}/{S2} funnel stages, {C} Venn overlap.

/** Metrics for bar/line charts (lower case; capitalised when they start a sentence). */
export const METRICS = [
  'synergy', 'coffee consumed', 'morale', 'vibes', 'buzzwords per minute', 'meetings', 'unread emails', 'hype',
  'free snacks', 'burnout', 'slide count', 'printer jams', 'reply-alls', 'bean bags', 'pivots', 'optimism',
  'stand-up length', 'jargon density', 'meetings per decision', 'passive aggression', 'casual Fridays', 'innovation',
];

/** Department-flavoured metrics (used about half the time). */
export const DEPT_METRICS = {
  lobby: ['visitors', 'lost badges', 'parcels', 'lobby fountain usage'],
  support: ['tickets', 'hold time', 'angry calls', 'customer sighs'],
  sales: ['pipeline', 'deals closed', 'handshakes', 'quota anxiety'],
  marketing: ['brand love', 'likes', 'logo size', 'brand awareness'],
  it: ['uptime', 'reboots', 'bugs', 'cloud spend'],
  finance: ['EBITDA', 'cash burn', 'receipts', 'spreadsheet tabs'],
  legalhr: ['compliance', 'lawsuits', 'team-building', 'policy pages'],
  exec: ['shareholder value', 'yachts', 'golf rounds', 'vision'],
};

/** X axes: unit word, preposition for "{Y} peaked {prep} {X}", short labels. */
export const X_SETS = [
  { unit: 'quarter', prep: 'in', labels: ['Q1', 'Q2', 'Q3', 'Q4'] },
  { unit: 'day', prep: 'on', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { unit: 'month', prep: 'in', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
  { unit: 'year', prep: 'in', labels: ['2022', '2023', '2024', '2025', '2026'] },
  { unit: 'hour', prep: 'at', labels: ['9am', '11am', '1pm', '3pm', '5pm'] },
  { unit: 'cup of coffee', prep: 'at', labels: ['0 cups', '1 cup', '2 cups', '3 cups', '4 cups'] },
  { unit: 'reorg', prep: 'after', labels: ['Reorg 1', 'Reorg 2', 'Reorg 3', 'Reorg 4'] },
  { unit: 'sprint', prep: 'in', labels: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'] },
];

/** Narrations per series shape. */
export const TREND = {
  rising: [
    '{Y} only goes up. Up and to the right!',
    'As you can see, {y} grows every {unit}.',
    "{Y} is climbing steadily. You're welcome.",
    'Look at {y} go. Straight up!',
    'Every {unit}, more {y}. Unstoppable.',
  ],
  falling: [
    '{Y} keeps falling, which is great news.',
    '{Y} goes down every {unit}. By design.',
    'As you can see, {y} is in free fall. Bold.',
    '{Y} shrinks every single {unit}. Lean!',
    'Less {y} every {unit}. Very intentional.',
  ],
  peak: [
    "{Y} peaked {prep} {X}. We don't talk about after.",
    '{Y} was highest {prep} {X}. Then lunch happened.',
    'Our {y} high point? Clearly {prep} {X}.',
    '{Y} topped out {prep} {X}. Peak us.',
  ],
  dip: [
    '{Y} hit rock bottom {prep} {X}, then bounced back.',
    '{Y} was lowest {prep} {X}. Character building.',
    'We had a little {y} dip {prep} {X}. Fixed it.',
    '{Y} bottomed out {prep} {X}. Comeback story!',
  ],
  flat: [
    '{Y} is perfectly flat. We call that stability.',
    '{Y} has not moved at all. Consistency!',
    'Every {unit}, the exact same {y}. Iconic.',
    '{Y} stayed level the whole time. Zen.',
  ],
};

/** Pie charts: title + slice labels. */
export const PIES = [
  { title: 'Where My Day Goes', labels: ['Meetings', 'Email', 'Real work', 'Coffee', 'Lunch'] },
  { title: 'Budget Breakdown', labels: ['Consultants', 'Snacks', 'Rebrand', 'Product', 'Golf'] },
  { title: 'Why Projects Fail', labels: ['Scope creep', 'Mondays', 'Reply-alls', 'Vibes', 'Gary'] },
  { title: 'Office Temperature', labels: ['Too hot', 'Too cold', 'Just right', 'Unknown'] },
  { title: 'Customer Feedback', labels: ['Confused', 'Angry', 'Asleep', 'Happy'] },
  { title: 'What Is On Our Slides', labels: ['Logos', 'Buzzwords', 'Clip art', 'Data'] },
  { title: 'Office Fridge Contents', labels: ['Old yoghurt', 'Mystery box', 'Oat milk', 'Hope'] },
  { title: 'Meeting Activities', labels: ['Nodding', 'Muted', 'Snacking', 'Deciding'] },
  { title: 'Excuses For Being Late', labels: ['Traffic', 'Elevator', 'The cat', 'Time zones'] },
  { title: 'Our Tech Stack', labels: ['Excel', 'Duct tape', 'Prayer', 'Cloud'] },
  { title: 'Bonus Pool Allocation', labels: ['CEO', 'Board', 'Pizza party', 'Everyone else'] },
  { title: 'Sources of Truth', labels: ['Rumours', 'Slack', 'Gary', 'Docs'] },
];

export const PIE_T = [
  '{L} is clearly the biggest slice.',
  'Most of it, as planned, goes to {L}.',
  "The lion's share is {L}. Obviously.",
  'Nearly half of the pie is {L}. Strategic.',
];

/** 2x2 matrices: [horizontal axis, vertical axis]. */
export const MATRICES = [
  ['effort', 'impact'], ['hype', 'revenue'], ['confidence', 'competence'], ['meetings', 'output'],
  ['budget', 'vibes'], ['buzzwords', 'substance'], ['coffee', 'sleep'], ['ambition', 'attendance'],
  ['slides', 'results'], ['noise', 'signal'], ['risk', 'paperwork'], ['speed', 'accuracy'],
];

export const MATRIX_TITLES = ['The Magic Quadrant', 'Strategy Matrix', 'Where We Stand', 'Competitive Landscape', 'Positioning'];

export const MATRIX_T = [
  'We are {a} {A}, {b} {B}. Classic us.',
  "We're {a} on {A} and {b} on {B}. Textbook.",
  'Note our spot: {a} {A}, {b} {B}. Visionary.',
];

/** Funnels: 4 stages each. */
export const FUNNELS = [
  { title: 'Sales Funnel', stages: ['Leads', 'Calls', 'Demos', 'Deals'] },
  { title: 'Hiring Funnel', stages: ['Applicants', 'Interviews', 'Offers', 'Hires'] },
  { title: 'Idea Pipeline', stages: ['Ideas', 'Meetings', 'Approvals', 'Launches'] },
  { title: 'Email Funnel', stages: ['Sent', 'Opened', 'Read', 'Replied'] },
  { title: 'Innovation Funnel', stages: ['Brainstorms', 'Post-its', 'Decks', 'Products'] },
  { title: 'Coffee Funnel', stages: ['Cravings', 'Queue', 'Machine', 'Real coffee'] },
  { title: 'Ticket Lifecycle', stages: ['Opened', 'Triaged', 'Assigned', 'Closed'] },
  { title: 'Visitor Journey', stages: ['Arrived', 'Signed in', 'Got badge', 'Found lift'] },
  { title: 'Budget Requests', stages: ['Requested', 'Reviewed', 'Approved', 'Received'] },
  { title: 'New Year Goals', stages: ['Resolutions', 'Gym signups', 'Gym visits', 'Abs'] },
];

export const FUNNEL_T = [
  'We lose the most between {S1} and {S2}.',
  'The big drop is from {S1} to {S2}.',
  'Biggest leak: {S1} to {S2}. On it.',
];

/** Venn diagrams: two sets and their (funny) overlap. */
export const VENNS = [
  { a: 'Meetings', b: 'Lunch', c: 'Lunch meetings' },
  { a: 'Coffee', b: 'Deadlines', c: 'Panic' },
  { a: 'Read email', b: 'Replied', c: 'Nobody' },
  { a: 'Agile', b: 'Waterfall', c: 'Our process' },
  { a: 'Urgent', b: 'Important', c: 'Nothing, ever' },
  { a: 'Cheap', b: 'Fast', c: 'Unicorns' },
  { a: 'Has budget', b: 'Has a plan', c: 'Rumours' },
  { a: 'Works hard', b: 'Promoted', c: 'Gary' },
  { a: 'Cats', b: 'Keyboards', c: 'Typos' },
  { a: 'Hybrid', b: 'Remote', c: 'Confusion' },
  { a: 'Slides', b: 'Data', c: 'This slide' },
  { a: 'Experts', b: 'Available', c: 'On holiday' },
  { a: 'Interns', b: 'Coffee runs', c: 'Career growth' },
];

export const VENN_TITLES = ['Strategic Overlap', 'Where Magic Happens', 'Synergy Map', 'The Sweet Spot'];

export const VENN_T = [
  'The overlap is {C}. Obviously.',
  'Where {A} meets {B}: {C}.',
  'Right in the middle? {C}.',
];

/** Narrations that describe the wrong kind of chart (never used for their own type). */
export const WRONG_TYPE = {
  pie: ['As this pie chart shows, it is mostly crust.', 'The biggest slice here is clearly dessert.'],
  venn: ['These two circles overlap perfectly. Synergy!', 'Note the overlap: that is where we live.'],
  matrix: ['We sit firmly in the top-right quadrant.', 'Top-right quadrant, baby. Magic.'],
  funnel: ['Our funnel loses nobody. Look at it.', 'The funnel narrows, as funnels do.'],
  bar: ['Look at the tallest bar. That one is mine.', 'Each bar is taller than the last!'],
  line: ['The line goes up, then sideways, then up.', 'Follow the red line. Trust the line.'],
};

/** Confident nonsense that fits any slide (i.e. none). */
export const NONSENSE = [
  'And this is why we bought a boat.',
  'Trust me, I have a lanyard.',
  'This slide was made by an intern. Applause.',
  "Synergy. That's the whole slide.",
  'Any questions? No? Great.',
  "I'll let the chart speak. It's shy.",
  'Moving on before legal sees this.',
  'This is our five-year plan. Ish.',
  'My horoscope agrees with this data.',
  "Note the font. That's leadership.",
  'This is fine. Everything is fine.',
  "Let's just say: blockchain.",
  'I made this at 3am. You can tell.',
  "The colours were chosen by the CEO's dog.",
  'Please clap.',
  'Imagine this, but in the cloud.',
  'Which is why lunch is cancelled.',
  'Numbers are a social construct.',
  "I'll circle back on what this means.",
  'As my mentor Gary always said: wow.',
  'Spoiler: we pivot on the next slide.',
  'Key takeaway: more meetings.',
  'Source: a vibe I had in the shower.',
  "Don't zoom in. Please.",
  'This chart is also available as an NFT.',
  'Look how professional this looks.',
  'The data is wrong, but the vibes are right.',
  "Let's take this one offline.",
  'Insert inspirational quote here.',
  "Remember: there's no I in chart.",
  'Hence the new logo.',
  "That's why we're all getting hats.",
  "And that's my TED talk.",
  'Sorry, wrong deck. This is my vacation.',
  'In conclusion: synergy, but bigger.',
  'Our consultants charged 2M for this one.',
];

/** Slide titles for bar/line charts, by department (plus generic ones). */
export const TITLES = {
  lobby: ['Visitor Experience Q3', 'Lobby KPIs', 'Badge Strategy 2030', 'Foyer Excellence'],
  support: ['Ticket Velocity', 'Customer Delight-ish', 'Support Deep Dive', 'Hold Music Review'],
  sales: ['Pipeline Review', 'Q3 Pipeline Vibes', 'Why We Missed Quota', 'Sales Kickoff'],
  marketing: ['Brand Health Check', 'Campaign Learnings', 'Brand Synergy Map', 'Rebrand Rationale'],
  it: ['Uptime Retrospective', 'Infra Roadmap', 'Cloud Strategy v9', 'Incident Recap'],
  finance: ['EBITDA Story Time', 'Cost Synergies', 'Forecast (Optimistic)', 'Budget Reality'],
  legalhr: ['Compliance Update', 'People Strategy', 'Culture Metrics', 'Policy Refresh'],
  exec: ['Shareholder Value', 'Board Update', 'Vision 2030', 'Strategic North Star'],
  generic: ['Q3 Vibes', 'Key Learnings', 'Strategic Update', 'Moving Forward', 'Big Picture', 'Deep Dive', 'Quarterly Recap', 'Lessons Learned'],
};

/** Audience reactions. */
export const CHEERS = ['*clap clap*', 'Bravo!', 'Woo!', 'Visionary!', 'So true!', 'Preach!', '*applause*', 'Promote them!'];
export const CRICKETS = ['cri cri...', '*cough*', '...', '*phone buzz*', 'Huh?', '*yawn*', 'Wait, what?'];
