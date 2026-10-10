// Lost Password content: pets (pixel maps drawn with a marker), their names and the other stuff on office whiteboards.
// Pet map chars: k marker outline, c pet colour, w white, p pink, '.' empty.
export const PETS = {
  dog: {
    colors: ['#b07a42', '#e0c08a', '#6b4a2e', '#2b2b2b'],
    map: [
      'kk......kk..',
      'kckk..kkck..',
      'kcccckccck..',
      '.kcwkccwk...',
      '.kckkcckk...',
      '..kcppck....',
      '...kkkkk....',
      '..kcccck...k',
      '.kcccccckkck',
      '.kcccccccck.',
      '.kckkkkkck..',
      '.kk.....kk..',
    ],
  },
  cat: {
    colors: ['#f29c38', '#8a8f9e', '#2b2b2b', '#f4f1e8'],
    map: [
      'k....k......',
      'kk..kk......',
      'kckkck......',
      'kwccwk......',
      'kckpck......',
      '.kcck.......',
      '.kccck....k.',
      'kcccccck..k.',
      'kccccccck.k.',
      'kcccccccckk.',
      'kckkkkkkck..',
      'kk......kk..',
    ],
  },
  hamster: {
    colors: ['#e0b070', '#f4f1e8', '#c08850'],
    map: [
      '............',
      '..kk....kk..',
      '.kpck..kcpk.',
      '.kcckkkkcck.',
      'kccccccccck.',
      'kcwkcccwkck.',
      'kcccppcccck.',
      'kccccccccck.',
      '.kccccccck..',
      '..kkkkkkk...',
      '..k.k.k.k...',
      '............',
    ],
  },
  fish: {
    colors: ['#f29c38', '#4a90e2', '#d84a8a'],
    map: [
      '............',
      '.....kkk....',
      '....kccck...',
      'k..kcccccck.',
      'kk.kcwkcccck',
      'kckccccccck.',
      'kckccccccck.',
      'kk.kcccccck.',
      'k..kccccck..',
      '....kccck...',
      '.....kkk....',
      '............',
    ],
  },
  parrot: {
    colors: ['#3bb66a', '#e2504a', '#4a90e2'],
    map: [
      '...kkk......',
      '..kccck.....',
      '.kcwkcck....',
      'kkccccck....',
      'kpkcccck....',
      '.kkcccccck..',
      '...kccccck..',
      '...kcccccck.',
      '....kcccck..',
      '.....kcck...',
      '....kk.kk...',
      '...kkkkkkk..',
    ],
  },
  turtle: {
    colors: ['#3b8a4a', '#7a9a3a', '#5a7a4a'],
    map: [
      '............',
      '............',
      '...kkkkk....',
      '..kcwcwck...',
      '.kcwcccwck..',
      '.kccwcwccckk',
      'kcccccccckwk',
      'kkkkkkkkkkkk',
      '.kk.....kk..',
      '............',
      '............',
      '............',
    ],
  },
};

export const SPECIES_NAME = { dog: 'dog', cat: 'cat', hamster: 'hamster', fish: 'goldfish', parrot: 'parrot', turtle: 'turtle' };

export const PET_NAMES = [
  'Waffles', 'Pickles', 'Biscuit', 'Nugget', 'Whiskers', 'Captain', 'Noodle', 'Pretzel', 'Muffin', 'Bean', 'Taco',
  'Pixel', 'Mochi', 'Gizmo', 'Pancake', 'Ziggy', 'Bubbles', 'Kevin', 'Sprinkles', 'Meatball', 'Toast', 'Dumpling',
];

/** Everything else people leave on whiteboards. */
export const DECOY_BOARDS = [
  { title: 'Q3 ROADMAP', lines: ['1. Synergy', '2. ???', '3. Profit'] },
  { title: 'DO NOT ERASE!!!', lines: ['(since 2019)', 'seriously', 'ask Gary'] },
  { title: 'WHO TOOK MY YOGURT', lines: ['it had my NAME on it', 'I will find you', '- management'] },
  { title: 'SPRINT 42', lines: ['To do: everything', 'Doing: meetings', 'Done: coffee'] },
  { title: 'NEW SLOGANS', lines: ['"Synergy, but more"', '"We do the things"', '"Disrupt Tuesday"'] },
  { title: 'LUNCH ORDER', lines: ['3x pizza', '1x salad (lie)', 'Gary: no onions'] },
  { title: 'WIFI', lines: ['network: Corp-Guest', 'password: ask IT', 'IT: ask the wall'] },
  { title: 'BRAINSTORM', lines: ['no bad ideas', 'except that one', 'you know the one'] },
  { title: 'OKRs', lines: ['O: be great', 'KR1: be greater', 'KR2: see KR1'] },
  { title: 'DAYS WITHOUT', lines: ['a reply-all', 'incident:', '0'] },
];

