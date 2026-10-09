// Elevator Pitch content. Each reel word: { w, cat, base }. `base` is the hidden CEO appeal (0..4);
// a word whose `cat` matches the CEO's mood of the day gets MOOD_BONUS on top. Words stay <= 14 chars.
// Categories: animals, ai, space, green, money, boring (the six moods) + buzz (always decent, never a mood).

export const MOOD_BONUS = 5;

export const MOODS = {
  animals: {
    label: 'animals',
    rumours: [
      'the CEO just got a puppy.',
      "the CEO's cat has two million followers.",
      'the CEO cried at a dog food commercial.',
      'the CEO wants a company llama. Named Kevin.',
      'the CEO brought a ferret to the board meeting.',
    ],
  },
  ai: {
    label: 'AI',
    rumours: [
      'the CEO asked a chatbot for life advice.',
      'the CEO thinks an AI wrote Shakespeare.',
      "the CEO renamed the board 'the neural net'.",
      'the CEO now says "as a large language model".',
      "the CEO's smart fridge got a promotion.",
    ],
  },
  space: {
    label: 'space',
    rumours: [
      'the CEO just booked a trip to orbit.',
      'the CEO watched a rocket launch. Twice. Live.',
      'the CEO bought a telescope and a cape.',
      'the CEO calls the penthouse "mission control".',
      'the CEO wants an office on the moon by Q4.',
    ],
  },
  green: {
    label: 'sustainability',
    rumours: [
      'the CEO just came back from a yoga retreat.',
      'the CEO hugged a tree. On LinkedIn.',
      "the CEO's new yacht runs on kale. Allegedly.",
      'the CEO composts the quarterly reports.',
      'the CEO now drinks oat milk "for the planet".',
    ],
  },
  money: {
    label: 'money',
    rumours: [
      "the CEO's bonus depends on this quarter.",
      'the CEO just bought a second yacht.',
      'the CEO dreams in stock tickers.',
      'the CEO tipped the barista in shares.',
      'the CEO asked HR if salaries are "mandatory".',
    ],
  },
  boring: {
    label: 'boring stuff',
    rumours: [
      "the CEO's doctor banned all excitement.",
      'the CEO just discovered spreadsheets.',
      "the CEO's favourite font is Arial. Size 11.",
      'the CEO finds beige "a bit loud".',
      'the CEO spent the weekend reading tax law.',
    ],
  },
};

export const SLOTS = [
  {
    id: 'opener',
    label: 'OPENER',
    words: [
      { w: 'Imagine', cat: 'buzz', base: 3 },
      { w: 'Hear me out:', cat: 'buzz', base: 3 },
      { w: 'Picture this:', cat: 'buzz', base: 3 },
      { w: 'Synergy-wise,', cat: 'buzz', base: 4 },
      { w: 'Big idea:', cat: 'buzz', base: 3 },
      { w: 'Woof! Imagine', cat: 'animals', base: 2 },
      { w: 'Paws up:', cat: 'animals', base: 2 },
      { w: 'Fur real now:', cat: 'animals', base: 3 },
      { w: 'Beep boop:', cat: 'ai', base: 2 },
      { w: 'As an AI,', cat: 'ai', base: 3 },
      { w: 'Neurally,', cat: 'ai', base: 2 },
      { w: 'Houston:', cat: 'space', base: 2 },
      { w: 'To the moon:', cat: 'space', base: 3 },
      { w: 'Zero-G idea:', cat: 'space', base: 2 },
      { w: 'Organically,', cat: 'green', base: 2 },
      { w: 'Mindfully,', cat: 'green', base: 2 },
      { w: 'Eco-wise,', cat: 'green', base: 3 },
      { w: 'Cha-ching!', cat: 'money', base: 3 },
      { w: 'Profit idea:', cat: 'money', base: 2 },
      { w: 'Money talk:', cat: 'money', base: 2 },
      { w: 'Per my email,', cat: 'boring', base: 0 },
      { w: 'So, um,', cat: 'boring', base: 0 },
      { w: 'Fine, so', cat: 'boring', base: 1 },
      { w: 'Quick memo:', cat: 'boring', base: 1 },
    ],
  },
  {
    id: 'verb',
    label: 'BUZZ VERB',
    words: [
      { w: 'disrupting', cat: 'buzz', base: 4 },
      { w: 'leveraging', cat: 'buzz', base: 3 },
      { w: 'synergizing', cat: 'buzz', base: 4 },
      { w: 'scaling', cat: 'buzz', base: 3 },
      { w: 'gamifying', cat: 'buzz', base: 3 },
      { w: 'pivoting to', cat: 'buzz', base: 3 },
      { w: 'petting', cat: 'animals', base: 2 },
      { w: 'unleashing', cat: 'animals', base: 3 },
      { w: 'herding', cat: 'animals', base: 2 },
      { w: 'automating', cat: 'ai', base: 3 },
      { w: 'prompting', cat: 'ai', base: 2 },
      { w: 'training AI on', cat: 'ai', base: 3 },
      { w: 'launching', cat: 'space', base: 3 },
      { w: 'orbiting', cat: 'space', base: 2 },
      { w: 'terraforming', cat: 'space', base: 3 },
      { w: 'composting', cat: 'green', base: 2 },
      { w: 'recycling', cat: 'green', base: 2 },
      { w: 'rewilding', cat: 'green', base: 3 },
      { w: 'monetizing', cat: 'money', base: 3 },
      { w: 'tokenizing', cat: 'money', base: 2 },
      { w: 'cashing in on', cat: 'money', base: 2 },
      { w: 'auditing', cat: 'boring', base: 1 },
      { w: 'filing', cat: 'boring', base: 0 },
      { w: 'reconciling', cat: 'boring', base: 0 },
      { w: 'stapling', cat: 'boring', base: 0 },
    ],
  },
  {
    id: 'thing',
    label: 'THING',
    words: [
      { w: 'blockchain', cat: 'buzz', base: 3 },
      { w: 'the cloud', cat: 'buzz', base: 3 },
      { w: 'big data', cat: 'buzz', base: 3 },
      { w: 'the metaverse', cat: 'buzz', base: 3 },
      { w: 'synergy', cat: 'buzz', base: 4 },
      { w: 'dog collars', cat: 'animals', base: 2 },
      { w: 'cat videos', cat: 'animals', base: 3 },
      { w: 'pet insurance', cat: 'animals', base: 2 },
      { w: 'AI', cat: 'ai', base: 3 },
      { w: 'chatbots', cat: 'ai', base: 2 },
      { w: 'robot lawyers', cat: 'ai', base: 2 },
      { w: 'Mars', cat: 'space', base: 3 },
      { w: 'moon dust', cat: 'space', base: 2 },
      { w: 'satellites', cat: 'space', base: 2 },
      { w: 'carbon credits', cat: 'green', base: 2 },
      { w: 'bamboo straws', cat: 'green', base: 2 },
      { w: 'kombucha', cat: 'green', base: 3 },
      { w: 'crypto', cat: 'money', base: 3 },
      { w: 'dividends', cat: 'money', base: 2 },
      { w: 'gold bars', cat: 'money', base: 2 },
      { w: 'spreadsheets', cat: 'boring', base: 0 },
      { w: 'my lunch', cat: 'boring', base: 0 },
      { w: 'a 3% saving', cat: 'boring', base: 1 },
      { w: 'fax machines', cat: 'boring', base: 0 },
      { w: 'the stapler', cat: 'boring', base: 0 },
    ],
  },
  {
    id: 'audience',
    label: 'AUDIENCE',
    words: [
      { w: 'for Gen Z', cat: 'buzz', base: 3 },
      { w: 'at scale', cat: 'buzz', base: 4 },
      { w: 'for enterprise', cat: 'buzz', base: 4 },
      { w: 'for everyone', cat: 'buzz', base: 3 },
      { w: 'for dogs', cat: 'animals', base: 3 },
      { w: 'for cats', cat: 'animals', base: 2 },
      { w: 'for hamsters', cat: 'animals', base: 2 },
      { w: 'for robots', cat: 'ai', base: 2 },
      { w: 'for chatbots', cat: 'ai', base: 2 },
      { w: 'for the AIs', cat: 'ai', base: 3 },
      { w: 'for aliens', cat: 'space', base: 3 },
      { w: 'for astronauts', cat: 'space', base: 2 },
      { w: 'in zero-G', cat: 'space', base: 2 },
      { w: 'for the planet', cat: 'green', base: 3 },
      { w: 'for bees', cat: 'green', base: 2 },
      { w: 'for trees', cat: 'green', base: 2 },
      { w: 'for whales', cat: 'money', base: 2 },
      { w: 'for investors', cat: 'money', base: 3 },
      { w: 'for the 1%', cat: 'money', base: 2 },
      { w: 'for Gary', cat: 'boring', base: 0 },
      { w: 'for my mum', cat: 'boring', base: 0 },
      { w: 'for no one', cat: 'boring', base: 0 },
      { w: 'for accounting', cat: 'boring', base: 1 },
    ],
  },
];

/** CEO's verdict after a full pitch, by score band. */
export const REPLIES = {
  great: [
    'Love it. Put it on a slide.',
    'Brilliant! Can we IPO by Friday?',
    'Finally, someone with vision. Like me.',
    "I'm telling the board it was my idea.",
    "Yes! That's the synergy I pay for.",
    'Book a keynote. Rent a fog machine.',
    'Shut up and take my budget.',
    'Genius. I felt that in my stock options.',
  ],
  good: [
    'Interesting. Send me a deck.',
    'Hm. Has a certain... something.',
    'Not bad. Needs more AI. Or less.',
    "I'd invest. Small amounts. Maybe.",
    "Let's circle back. Warmly.",
    'Promising. Add a hockey-stick graph.',
    'My assistant will pretend to call you.',
  ],
  meh: [
    'Hm. Is that... legal?',
    'Did you just make that up?',
    "I've heard worse. This morning.",
    "My nephew pitched that. He's six.",
    "Let's take this offline. Forever.",
    'Fascinating. Truly. *checks watch*',
    'Bold. Wrong, but bold.',
  ],
  bad: [
    "That's just a spreadsheet.",
    'Who hired you? HR, find out.',
    "I've had more exciting audits.",
    'Please stand further away.',
    'Were you always this beige?',
    "That's not a pitch. That's a sigh.",
    "I'm pressing every button. Every one.",
  ],
};

/** When the elevator dings at the top. */
export const ARRIVALS = [
  'Fascinating. This is my floor.',
  "Ding! That's me. Email my assistant.",
  "My floor. Please don't follow me.",
  'Ah, the penthouse. Bye, er... you.',
  'My stop. The stairs are that way.',
];

/** CEO's opener, by department. */
export const INTROS = {
  lobby: "Aren't you the new intern? Go on.",
  support: 'Support? Make it quick.',
  sales: 'Sales, huh? Impress me.',
  marketing: 'Marketing. Dazzle me.',
  it: 'IT? Is my wifi fixed yet?',
  finance: 'Finance. Make it profitable.',
  legalhr: 'Legal? Am I in trouble?',
  exec: 'One exec to another: go.',
};

/** Quick CEO reactions as each reel stops. */
export const REACTIONS = {
  high: ['Ooh!', 'Go on...', 'Yes!', 'Mmm!', 'Spicy!'],
  mid: ['Hm.', 'Okay.', 'Sure.', 'And?'],
  low: ['Yawn.', 'Ugh.', 'Really?', 'Hmph.', 'Zzz'],
  stall: ['Uhh...', 'Umm...', 'Errr...', 'So, like...'],
};

/** CEO's prompt before the 2nd and 3rd pitch. */
export const NEXTS = [
  'Another one. Go.',
  'Next idea. Faster.',
  'Again. Wow me this time.',
  'Still listening. Barely.',
  'We have a few floors left.',
  'Okay, pivot. Next!',
];
