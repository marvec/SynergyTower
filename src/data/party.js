// The Christmas party's text (core/party.js, scenes/party.js): the invitation, the CEO's speech, guests' lines, the bar,
// the summary, the carols' syllables and the hall's curio lines. Plain ASCII (the bitmap font).

export const PARTY_ACTIVITIES = [
  { game: 'dance', title: 'Dance-Off', where: 'DJ booth', blurb: 'The DJ challenges you. Hit the arrows on the beat.' },
  { game: 'giftwrap', title: 'Secret Santa', where: 'Secret Santa table', blurb: 'Wrap your Secret Santa gift: cut, tape, bow. Your own gift is waiting for you.' },
  { game: 'carols', title: 'Carol Karaoke', where: 'Stage', blurb: 'Take the mic and sing a carol. Stay on the note.' },
  { game: 'buffet', title: 'Christmas Buffet', where: 'Buffet', blurb: 'Turkey, mince pies, gingerbread. Fill your plate before it is gone.' },
  { game: 'photobooth', title: 'Photo Booth', where: 'Photo booth', blurb: 'Four shots. Strike the pose on the card when the flash goes off.' },
];

export const PARTY_INVITE = (corp, minutes) =>
  `The ${corp} Christmas party is on! Dancing, a buffet, karaoke, Secret Santa and a free bar.\n` +
  `It lasts ${minutes} minutes, and you only get one party a year.\n` +
  'No time now? The elevator has a party button until you go.';

export const PARTY_REFUSALS = {
  hold: 'HR says: no party during a compliance hold.',
  badge: 'Check in at the front desk first. No badge, no party.',
  away: 'Finish what you are doing first.',
  done: 'You have been to this year\'s party already.',
  closed: 'The party is over. See you next December!',
  on: 'The party is already on.',
};

export const CEO_SPEECH = (corp) =>
  `What a year for ${corp}! We leveraged our synergies, pivoted twice and disrupted ourselves.\n` +
  'Your bonus is in the form of this party. And one Stock Option each.\n' +
  'Raise your glasses to another year of growth, alignment and mandatory fun!';

export const CEO_SPEECH_YOU = (corp) =>
  `You tap your glass. As CEO of ${corp}, the speech is yours.\n` +
  '"What a year. We shifted paradigms and moved the needle. The needle is fine."\n' +
  '"Here is to all of you, and to one Stock Option each. Cheers!"';

export const PARTY_LINES = [
  'Great party! Is that the CFO doing the robot?',
  'I came for the buffet. I am staying for the buffet.',
  'Who put the reply-all Secret Santa list together?',
  'This is the only meeting I enjoy all year.',
  'The DJ only takes requests by email.',
  'I wrapped my gift in last quarter\'s report.',
  'Nobody talk about work. Okay, one KPI.',
  'The punch has synergy in it. Literally.',
  'My Secret Santa is someone in Legal. I am scared.',
  'I have never seen the CEO dance. I want to unsee it.',
  'Is there a dress code? I wore my best lanyard.',
  'The photo booth has more filters than our spam folder.',
  'Last year someone sang for 20 minutes. It was me.',
  'I am networking. With the cheese board.',
  'Do not tell IT, but I left my laptop at my desk.',
  'This is my third mince pie. Do not count.',
  'Best part of the year. Worst music.',
  'The disco ball was a budget line item. It was approved.',
  'I asked for a raise and got a party hat.',
  'Merry Christmas! Or as Finance says, Q4 close.',
  'The karaoke list is all carols. Bold choice.',
  'Somebody tell the intern the open bar is not a meeting room.',
];

export const TIPSY_LINES = [
  'Have you been to the bar? You look... festive.',
  'You are swaying. Or the room is. One of you is.',
  'Maybe some water? Just a thought.',
  'Did you just high-five the Christmas tree?',
  'You told me that story already. Twice. It was good.',
  'Careful, HR is right over there.',
  'Your Santa hat is on sideways. It works.',
  'I love you too, colleague. Please sit down.',
  'Let us not dance on the buffet table.',
  'You called me "boss" three times. I am in Accounts.',
  'Somebody order a taxi for this legend.',
  'Your karaoke was... brave.',
];

export const HR_WATCH_LINES = [
  'HR is watching. Festively.',
  'Remember: the code of conduct applies at parties too.',
  'I am not working. I am observing.',
  'Lovely party. I am taking notes.',
  'Pace yourselves, everyone.',
  'There is water at the bar. Just saying.',
  'Mistletoe has been removed per policy 4.2.',
  'Have fun. Within the guidelines.',
  'Who is doing the worm? I need a name for the form.',
  'Everyone is having fun. Good. Measured fun.',
];

export const BARTENDER = {
  name: 'Bartender',
  serve: ['Coming right up!', 'Cheers!', 'One festive drink.', 'Enjoy, and take it easy.', 'Here you go. Merry Christmas!'],
  enough: 'I think you have had enough. Here is some water.',
  water: 'Water. The wisest drink of the night.',
};

export const DRINKS = [
  { kind: 'mulled', label: 'Mulled wine' },
  { kind: 'eggnog', label: 'Eggnog' },
  { kind: 'punch', label: 'Synergy Punch' },
];

export const PARTY_LEAVE = (left) => `Leave the party already? There are ${left} to go, and you only get one party a year.`;

export const FIRED_JOKE = (count) => `Security has a guest list. ${count === 1 ? 'One name' : `${count} names`} you let go are not on it.`;

export const PARTY_SUMMARY_TITLE = { done: 'That was a party!', early: 'An early night' };

export const PARTY_SUMMARY = (sum) =>
  `Activities: ${sum.activities}/${sum.total}. Paperclips: +${sum.sp}. Stock Options: +1 (year-end bonus).\n` +
  (sum.gift ? `Your Secret Santa gift: a little Christmas tree for your desk (Collection tab).\n` : '') +
  (sum.drinks ? `Drinks: ${sum.drinks}. We called you a taxi.` : 'Not a drop. Somebody has to drive.');

/** Carols for Carol Karaoke: one syllable per sung note of SONGS[id] (tests/partyData.test.js checks the count). */
export const CAROLS = [
  {
    id: 'jinglebells',
    title: 'Jingle Bells',
    syllables: [
      'Jin-', 'gle', 'bells,', 'jin-', 'gle', 'bells,', 'jin-', 'gle', 'all', 'the', 'way!', 'Oh', 'what', 'fun', 'it', 'is', 'to', 'ride', 'in', 'a',
      'one', 'horse', 'o-', 'pen', 'sleigh,', 'hey!', 'Jin-', 'gle', 'bells,', 'jin-', 'gle', 'bells,', 'jin-', 'gle', 'all', 'the', 'way!',
      'Oh', 'what', 'fun', 'it', 'is', 'to', 'ride', 'in', 'a', 'one', 'horse', 'o-', 'pen', 'sleigh!',
    ],
  },
  {
    id: 'deckhalls',
    title: 'Deck the Halls',
    syllables: [
      'Deck', 'the', 'halls', 'with', 'boughs', 'of', 'hol-', 'ly,', 'Fa', 'la', 'la', 'la', 'la,', 'la', 'la', 'la', 'la!',
      "'Tis", 'the', 'sea-', 'son', 'to', 'be', 'jol-', 'ly,', 'Fa', 'la', 'la', 'la', 'la,', 'la', 'la', 'la', 'la!',
    ],
  },
  {
    id: 'wenceslas',
    title: 'Good King Wenceslas',
    syllables: [
      'Good', 'King', 'Wen-', 'ces-', 'las', 'looked', 'out', 'on', 'the', 'feast', 'of', 'Ste-', 'phen.',
      'When', 'the', 'snow', 'lay', 'round', 'a-', 'bout,', 'deep', 'and', 'crisp', 'and', 'e-', 'ven.',
    ],
  },
];

/** Curio lines for the party hall's furniture (core/curios.js reads these when fl.party): at least 20 each. */
export const PARTY_QUIPS = {
  stage: [
    'A stage. Last year\'s karaoke still echoes here.',
    'The spotlight is pointed at the exit. Coincidence?',
    'Someone taped a setlist here: 14 carols, 0 breaks.',
    'The stage creaks under the weight of expectations.',
    'A sign: "Speeches max. 2 minutes". Nobody reads it.',
    'A microphone stand with a tinsel boa. Very corporate.',
    'The monitor speaker hums. So does Accounts.',
    'Gaffer tape marks where the CEO must not stand.',
    'Someone left a setlist: "Jingle Bells" x3, "Mambo No. 5" x1.',
    'The backdrop says HAPPY HOLIDAYS. The sponsor said otherwise.',
    'A cable runs across the stage. Health and Safety has noted it.',
    'The curtain is a bedsheet from the Facilities cupboard.',
    'A sticky note: "Do NOT let Dave have the mic again".',
    'The stage was built by the intern. It is level-ish.',
    'Three steps up. Every one of them a career risk.',
    'There is a glitter cannon. It has not been approved.',
    'A "Reserved for the CEO" chair. The CEO is not sitting.',
    'The mic still has a name label: "Property of Marketing".',
    'Fog machine, switched off. Fire safety insisted.',
    'You imagine a standing ovation. It is quite nice.',
    'A foam finger that says "#1 in Q4". Nobody asks.',
    'The risers wobble. So does the roadmap.',
  ],
  poinsettia: [
    'A poinsettia. It has a facilities asset tag.',
    'Red leaves, green leaves. Very on brand.',
    'Do not eat the poinsettia. There is a memo about it.',
    'It looks festive. It looks tired. It looks like you.',
    'Watered by everyone, so watered by no one.',
    'The leaves are red. The soil is a cry for help.',
    'Someone hung a tiny bauble on it. Morale +1.',
    'It was bought in the sale on the 26th. Planning ahead.',
    'A poinsettia in a pot wrapped in foil. Peak elegance.',
    'It survived last year. It will not survive this one.',
    'The tag reads: "Keep away from draughts and Sales".',
    'Not a Christmas tree, but it has ambitions.',
    'A tiny card: "From the Facilities team, with love".',
    'It is plastic. It has been plastic since March.',
    'Someone put a paper hat on it. It suits it.',
    'A poinsettia, thriving by neglect. A role model.',
    'The foil wrapper is held on with a lanyard clip.',
    'It is next to the radiator. This is a plant crime.',
    'You count the leaves. Seven. A lucky number.',
    'It looks like it has seen the Q3 numbers.',
    'The pot has a sticky note: "Do not move. Again."',
    'The label spells it "pointsettia". Charming.',
  ],
  partytable: [
    'Crackers, napkins and a name card that says "Guest".',
    'The centrepiece is a pine cone with a budget code.',
    'Someone has stacked the paper hats into a pyramid.',
    'A half-eaten mince pie. Evidence.',
    'The table plan put Sales next to Legal. Brave.',
    'A cracker joke: "Why was the CFO cold? No cash flow." Groan.',
    'Napkins folded into swans. Probably by HR.',
    'A plate of cheese cubes on sticks. Untouched. Suspicious.',
    'The tablecloth is red. The stains are redder.',
    'Name cards: "Bob", "Bob (other)", "Bob from IT".',
    'Someone has hidden the good crackers under the table.',
    'A bowl of nuts. Allergy sign: "Contains the Marketing team".',
    'Paper chains, glued by the team-building committee.',
    'There is one chair too few. A classic.',
    'A candle with a sign: "Not to be lit. Policy."',
    'Wine glasses, plastic cups and one proper mug.',
    'The seating plan has been redone three times. Politics.',
    'A tiny reindeer made from a pipe cleaner. Cute.',
    'Someone left a spreadsheet of who owes whom a drink.',
    'A bread roll that has been here since the speech.',
    'The crackers do not bang. Budget cuts.',
    'The table is bolted down. For reasons we do not discuss.',
  ],
  chair: [
    'A party chair, slightly sticky.',
    'Someone has saved this seat with a tinsel scarf.',
    'The chairs are rented. The vibe is borrowed.',
    'You sit down for a second. It feels like a holiday.',
    'A Santa hat on the seat. Finders keepers?',
    'The cushion has a glitter patch. It is on you now.',
    'A cardigan hangs on the back. Property of Accounts.',
    'The chair wobbles. You pretend it is a feature.',
    'Rented chair, tag: "Return by 6 pm or else".',
    'Someone wrote "mine" on a sticky note and stuck it here.',
    'A lovely view of the buffet. Strategic seating.',
    'It is warm. Someone just left. You feel like a detective.',
    'A paper hat lies on the seat. It is a bit sat on.',
    'The chair legs have little socks. Floor protection.',
    'You rest your feet. No one can prove anything.',
    'It is padded. Nothing else here is.',
    'A chair facing the stage, a safe distance away.',
    'A name tag on the back: "Reserved: Gary". Gary is gone.',
    'Someone left a plate with one grape on the seat.',
    'The chair squeaks every time you think of Monday.',
    'A coat is draped over it. The coat is better dressed than you.',
    'You are not tired. You are just resting your eyes.',
  ],
  punchbowl: [
    'The punch is pink. The recipe is classified.',
    'A ladle, a punch bowl and a sticky note: "Synergy!"',
    'It smells of cinnamon and quarterly targets.',
    'Someone has floated a rubber duck in it.',
    'The label says "non-alcoholic". The label is lying.',
    'A slice of orange floats by like a tiny lifeboat.',
    'The ladle is chained to the bowl. It has happened before.',
    'It is warm. Nobody asks why.',
    'A note: "Do not drink more than three. Signed, HR".',
    'There are cranberries in it. And a button.',
    'It has been topped up with something from Finance\'s desk.',
    'The bowl is a trophy from the 2019 bowling day.',
    'You sniff it. Your eyes water. Your career flashes.',
    'A sign reads "Punch (Contains Punches)". Bad pun.',
    'The red cup next to it says "Chairman". Not yours.',
    'The level never goes down. That is the scary part.',
    'Cinnamon stick, star anise, a surprising amount of ginger.',
    'Somebody added sparkling water. Brave and boring.',
    'A little puddle beside the bowl. A drip of history.',
    'The punch is on the budget. The budget is on the punch.',
    'Cheers to whoever refills this at midnight.',
    'You do not need any. You take some anyway.',
  ],
  xmastree: [
    'The tree is real. The presents under it are empty boxes.',
    'An ornament shaped like the company logo. Of course.',
    'The star on top is a little crooked. Like the quarter.',
    'Fairy lights, tinsel and a lanyard someone lost.',
    'Facilities approved the tree after three meetings.',
    'It sheds needles on the carpet. Cleaning has opinions.',
    'A bauble reads "Best Team 2019". It is a bit faded.',
    'The lights blink in a pattern. Is it Morse code? It is not.',
    'Someone hung a USB stick on a branch. Bold.',
    'The tree stand was borrowed from the cafeteria.',
    'Tinsel on every branch, and also on Dave.',
    'It smells like pine and a tiny bit of toner.',
    'A candy cane hangs here. Someone has licked it.',
    'The presents have labels like "To: Whoever". Nice.',
    'It is tall enough to touch the ceiling tile. Almost.',
    'An angel on top with a very corporate smile.',
    'Strings of popcorn, eaten halfway by the night shift.',
    'A paper snowflake made by the intern. Excellent work.',
    'The tree has its own SharePoint site. No one visits.',
    'Branches droop under the weight of all that morale.',
    'Look closely: a rubber duck sits in the branches.',
    'It is the only thing here with real roots. Metaphor.',
  ],
};
