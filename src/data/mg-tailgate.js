// Badge Tailgate content: lobby signage per department and what people say when security stops them.
// Bubbles wrap at ~96 px (about 19 chars per line, 3 lines max). ASCII only.

/** [big sign, small print] above the turnstiles. */
export const SIGNS = {
  lobby: ['WELCOME TO SYNERGY TOWER', 'Badges required beyond this point'],
  support: ['SUPPORT FLOOR', 'Have you tried badging in again?'],
  sales: ['SALES FLOOR', 'Always Be Badging'],
  marketing: ['MARKETING', 'Badges: on brand since 2009'],
  it: ['IT DEPARTMENT', 'No badge, no Wi-Fi password'],
  finance: ['FINANCE', 'Unbadged entry will be invoiced'],
  legalhr: ['LEGAL & HR', 'Tailgating violates policy 4.2.1'],
  exec: ['EXECUTIVE FLOOR', 'Visitors need approval from 3 VPs'],
};

/** Strangers without a disguise. */
export const EXCUSES = [
  'I left my badge in my other pants.',
  "I'm new. Like, very new.",
  "I'm with him!",
  'Badge? I AM the badge.',
  'Just here for the free coffee.',
  'I work on floor 41.',
  'My badge is in the cloud.',
  "I'm a consultant. Billing you now.",
  'Is this the gym?',
  "I'm the CEO's nephew!",
  'Who are you, the badge police?',
  'I was just holding the door.',
  'I had an interview here. In 2019.',
  "I'm a mystery shopper.",
  'My dog ate my badge.',
  "I'm from the future. Let me in.",
  'I only want to see the view.',
  "You'll regret this. Probably.",
  'Fine. I will use the window.',
  'Do you know who I am? Me neither.',
];

/** Strangers in disguise, by outfit. */
export const DISGUISE = {
  ladder: ["I'm here to fix the... ladder.", 'Ladder inspection. Very urgent.', 'Nobody stops a man with a ladder!'],
  pizza: ['Pizza for... uh... everyone?', 'Extra cheese, no badge.', 'It gets cold! Let me through!'],
  hivis: ['Hi-vis means I belong.', 'I have a clipboard. Clearly official.', 'Routine inspection of... your gate.'],
  duck: ['Quack. (I am the mascot.)', 'Quack quack. (Let me in.)', 'QUACK! (This is not over.)'],
};

/** Legit people you should not have stopped. */
export const LEGIT = [
  "I'm the CFO. You're welcome.",
  "I've worked here 22 years!",
  'My badge literally beeped.',
  'I sign your paychecks.',
  "I'm late for MY meeting.",
  'Seriously? Again?',
  "It's me. Dave. From IT.",
  "I'm reporting this to HR.",
  'I AM HR.',
  'Wow. Great security. Truly.',
];
export const LEGIT_VISITOR = ['I have a VISITOR sticker!', "I'm the auditor. Noted.", 'Reception gave me this sticker!', 'Your guest experience: 1 star.'];
export const LEGIT_ODD = {
  ladder: ["I'm literally facilities.", 'The ladder is for the lights!'],
  pizza: ["It's my lunch. I work here.", 'The pizza and I have a badge.'],
  hivis: ["I'm the safety officer!", 'Fire warden. With a badge.'],
  duck: ["Quack! I'm in Marketing.", 'Mascot day. Badge on beak.'],
};

/** Floaters when security gets it wrong. */
export const WRONG = ['Wrong stop!', 'Ma\'am, that was the CFO.', 'They had a badge!', 'Awkward...'];
export const SNEAKED = ['Sneaked in!', 'Tailgater!', 'Security breach!', 'Got past you!'];
