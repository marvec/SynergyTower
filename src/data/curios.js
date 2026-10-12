// Office curiosities: what the player finds when poking at furniture that is not part of the gameplay.
// Quips are said by the player in a speech bubble; the fridge, plants and HR filing cabinets open close-ups.
// ASCII only (the bitmap font), keep quips under ~110 characters so the bubble stays small.

/** Quips by furniture type. Poking the same object again says the next one. */
export const QUIPS = {
  desk: [
    'A sticky note says "Back in 5 min". It is dated March.',
    'Three mugs, all labelled WORLD\'S BEST BOSS. Bought by the boss.',
    'A keyboard with the E key worn out. Someone writes a lot of emails.',
    'The monitor has a sticky note: "PASSWORD: see other sticky note".',
    'A desk calendar still on last year. Optimism, or a statement.',
    'A tiny zen garden. The rake marks spell "HELP".',
    'Somebody\'s lunch, guarded by a sticky note: "I counted the grapes."',
    'A to-do list. Item 1: "Make a to-do list". It is ticked. Nothing else is.',
    'A stress ball with teeth marks. Quarter-end was rough.',
    'A framed photo of a dog. The dog is wearing a lanyard. The dog has a badge.',
    'Seven pens. None of them work. All of them are kept, just in case.',
    'A mouse mat that says "I\'D RATHER BE IN A MEETING". Sarcasm, hopefully.',
    'Post-its arranged into a pixel-art cat. Clearly the most productive desk here.',
    'An out-of-office note: "Gone fishing. Literally. Back Monday with fish."',
    'A drawer full of ketchup sachets, soy sauce and one emergency tie.',
    'A cactus called "Deadline". It is thriving. Deadlines usually do.',
    'Under the desk: three pairs of shoes and a slipper. Just the one.',
    'A tangle of cables connects to absolutely nothing. It looks important.',
    'The keyboard has crumbs from at least three different lunches. A buffet.',
    'A motivational calendar. Today: "Believe in yourself". Yesterday: torn out angrily.',
    'A sticky note on the monitor: "Smile, you are on a video call". You are not.',
    'A mug full of paperclips, labelled "SAVINGS ACCOUNT".',
    'A neat stack of printouts titled "Things I will read later". Dated 2019.',
    'A desk fan, pointed at the neighbour\'s desk. A cold war.',
    'A tiny flag on a stick says "THIS IS MY DESK". It is a hot desk.',
    'A self-help book: "Inbox Zero". The bookmark is in the preface.',
    'The chair is still spinning slowly. Whoever sat here left in a hurry.',
  ],
  headsetdesk: [
    'The headset is still warm. And slightly sticky.',
    'A laminated card: "SMILE - THEY CAN HEAR IT". Underlined twice.',
    'Hold music leaks from the headset. It is the same 8 seconds, forever.',
    'A tally sheet: "Customers who said THANK YOU: 4". Since 2018.',
    'A script on the wall: "Have you tried turning it off and on again?" Underlined. Highlighted. Laminated.',
    'The call queue counter says 47. It said 47 yesterday. It may be a sticker.',
    'A sticky note: "Customer called me \'darling\' 3x today. Personal best."',
    'A tiny bell labelled "RING WHEN A CALL GOES WELL". It is covered in dust.',
    'The headset has a foam cover shaped like a cat ear. Only one. The other was lost in battle.',
    'A mug: "I SURVIVED THE BLACK FRIDAY QUEUE". The handle did not.',
    'A list of polite ways to say "no". It is three pages long. Double-sided.',
    'A note: "Your call is important to us" - in the handwriting of someone who meant it once.',
    'A drawer of throat lozenges, sorted by flavour and by level of desperation.',
    'A whiteboard tally: "Calls about the password reset: |||| |||| |||| ||||". Today.',
    'A photo of a beach, taped to the monitor. On hold music, it almost sounds like waves.',
    'The mute button is worn completely smooth. Wise.',
    'A sticky note: "Do NOT say \'per the terms and conditions\' to Mrs Patel again."',
    'A rubber chicken in the drawer. For emergencies. Nobody asks what kind.',
    'A cheat sheet of 14 ways to spell the CEO\'s surname. Customers have tried them all.',
    'A timer stuck at 59:59. Somebody\'s average handling time. A legend.',
    'A spare headset, still in the box, guarded like treasure.',
    'A note in neat writing: "Breathe. Smile. Escalate." It is a mantra.',
    'A stack of feedback cards. The top one says "Very nice voice, still angry".',
    'A sticker on the phone: "Press 1 for joy". Pressing 1 does nothing.',
  ],
  tradingdesk: [
    'Six monitors, all red. One is just a screensaver of a red sunset.',
    'A sticky note: "BUY LOW". Under it, smaller: "(too late)".',
    'A rubber duck in a tiny suit. It handles the risk management.',
    'Someone drew a line going up on a napkin and framed it.',
    'A sticky note: "Buy the rumour, sell the news, bring snacks to the meeting."',
    'A bobblehead bull and a bobblehead bear, glued facing each other. A tense standoff.',
    'A spreadsheet printout with one cell circled in red: "WHY?"',
    'A mug that says "HODL". It is full of cold coffee. They are holding that too.',
    'The keyboard has no F9 key. Someone pressed it too hard during a crash.',
    'A tiny gong on the desk. Next to it, a tinier sign: "Not for small wins."',
    'A calculator with the 7 worn off. Someone really likes sevens.',
    'A note: "Diversify!" Below it, a list of five types of the same snack.',
    'A stopwatch, a calendar and a crystal ball. Two of them are for show.',
    'One monitor shows a stock chart. Another shows a live stream of a cat. Both are volatile.',
    'A risk register. Entry 1: "Coffee machine breaks." Mitigation: "Panic."',
    'A sticky note: "Never catch a falling knife". Next to it, a bandage.',
    'A framed screenshot of a share price at its all-time high. A fond memory.',
    'A stress ball shaped like a bull. It has been squeezed flat.',
    'A list of "Bad trades I will never repeat". It is on page 6.',
    'A plastic dinosaur labelled "LEGACY SYSTEMS". It is guarding the server cable.',
    'The chair is set to maximum height. The trader thinks better looking down on the market.',
    'A sticky note on the phone: "Do not call mum during market open (again)".',
    'A pair of lucky socks drying on the monitor. Tomorrow is earnings day.',
    'A tiny trophy: "Best Guess of Q3". It is very small, like the margin.',
  ],
  bossdesk: [
    'The nameplate is bigger than the monitor.',
    'A golf putter, a golf ball and a mug that says "I\'D RATHER BE GOLFING".',
    'A stack of papers labelled "TO READ". It has a fine layer of dust.',
    'A framed photo of the boss shaking hands with a slightly larger boss.',
    'A drawer, locked. A second drawer, also locked. Respect.',
    'A golden pen in a stand. It has never written anything. It signs things.',
    'A desk organiser with compartments for "VISION", "STRATEGY" and "SNACKS". Only one is full.',
    'A framed quote: "Lead from the front". The desk faces the wall.',
    'A remote control for the blinds. And a second one for the second remote.',
    'A stack of books on leadership. The spines are uncracked. The coaster is well used.',
    'An executive toy: five metal balls clicking. Hypnotic. Possibly the decision process.',
    'A sticky note: "Remember everyone\'s name". Below it, a list of nicknames instead.',
    'A model yacht. "One day", says the engraved plaque. "Maybe Q4."',
    'A drawer slightly open: a secret stash of the good biscuits.',
    'A desk phone with 30 speed-dial buttons. All of them say "Lawyer".',
    'An inbox tray labelled "URGENT". It is empty. The tray labelled "LATER" is overflowing.',
    'A crystal award: "Visionary of the Year". The year is blurred out on purpose.',
    'A globe with a pin in every city where the boss had a meeting with a view.',
    'A notepad: "Ideas". Page 1: "Synergy?" Page 2: "More synergy."',
    'A bowl of mints. Leaving without taking one is considered a resignation.',
    'A tiny zen sand garden, perfectly raked. Nobody is allowed to touch it. Not even the boss.',
    'A framed org chart with the boss at the top. In marker, someone added a cloud above it.',
    'A whiteboard marker labelled "MINE". Only the boss writes on whiteboards.',
    'A doorbell button on the desk. Pressing it plays the company jingle.',
    'A sticky note under the monitor: "Ask for feedback. Don\'t read it."',
  ],
  mydesk: [
    'An empty desk. The chair has your shape already. Promising.',
    'A note from Facilities: "This desk is reserved for YOU (eventually)".',
    'A sticky note: "New starter? Welcome! The good chair is already taken."',
    'The drawer contains a welcome pack: one pen, one lanyard, one mint (expired).',
    'The desk is so clean it echoes.',
    'Someone has already drawn a tiny flag on it: "UNCLAIMED TERRITORY".',
    'A label on the monitor: "ASSET 4417 - DO NOT REMOVE". The monitor has no cable.',
    'The desk wobbles slightly. A folded memo under one leg is waiting for promotion too.',
    'A note: "Reserved for high performers". In pencil. Easily erased.',
    'An empty mug ring on the desk. The ghost of a previous employee.',
  ],
  chair: [
    'You spin the chair once. Nobody saw. Probably.',
    'The chair sinks slowly to its lowest setting with a sad hiss.',
    'Still warm. You decide not to think about it.',
    'A label under the seat: "Ergonomic. Allegedly."',
  ],
  chairup: [
    'A chair, neatly tucked in. Someone here was raised right.',
    'The chair creaks a polite hello.',
    'There is a sticky note on the back: "MINE - BRING IT BACK - DAVE".',
  ],
  bigchair: [
    'Real leather. It smells of decisions.',
    'The chair is set to "recline". It has never been set to anything else.',
    'You sit down for one second. You feel a strong urge to restructure something.',
  ],
  sofa: [
    'The sofa has a dent the exact shape of a power nap.',
    'You find 40 paperclips and a crayon between the cushions. You leave them for the next adventurer.',
    'A cushion says "LIVE LAUGH LEVERAGE".',
    'The sofa sighs as you touch it. It has seen many all-hands meetings.',
  ],
  beanbag: [
    'You sink in. It takes a while to get back out. Creativity!',
    'The beanbag makes a sound like a deflating start-up.',
    'Somebody wrote "THINK OUTSIDE THE BAG" on it in marker.',
  ],
  stool: [
    'A stool. It wobbles exactly as much as all office stools.',
    'One leg is shorter. A folded memo fixes it. The memo was important.',
  ],
  kitchentable: [
    'Crumbs from at least four departments. A true cross-functional table.',
    'A note on the table: "Please wipe the table. - The table".',
    'Someone left a newspaper open at the crossword. 1 across: "SYNERGY".',
  ],
  meetingtable: [
    'A forgotten laptop charger. It belongs to the table now.',
    'Under the table: chewing gum shaped like the company logo. Art.',
    'The table still remembers the 3-hour meeting about meeting lengths.',
    'Six empty water bottles and one agenda nobody read.',
  ],
  boardtable: [
    'A table so long the people at the other end are in a different time zone.',
    'Leather coasters with the company logo. Each one numbered.',
    'There is a button under the table. You decide not to press it.',
  ],
  counter: [
    'Fourteen mugs, none washed. A sign: "YOUR MOTHER DOES NOT WORK HERE".',
    'A jar of sugar sachets. And a jar of sugar sachets from other cafes.',
    'A sponge so old it has its own badge.',
  ],
  coffeemachine: [],
  espressobar: [
    'A shiny espresso machine with 23 buttons. Two of them do something.',
    'A sign: "BARISTA TRAINING REQUIRED". Signed by nobody.',
    'The milk frother screams when you look at it.',
  ],
  microwave: [
    'The inside looks like abstract art. Mostly tomato.',
    'A sign: "NO FISH". Under it, in another hand: "not even a little?"',
    'The timer says 0:01. Someone gave up one second too early.',
    'The light is on, nobody is home. The popcorn button is worn smooth.',
  ],
  vending: [
    'B4: Kale crisps (expired). B5: Inspiration (sold out).',
    'A crisp packet hangs on the spiral, stuck forever. A monument.',
    'The machine eats your imaginary coin and says nothing. Classic.',
    'C2 is labelled "MYSTERY". It has been C2 since 2015.',
  ],
  watercooler: [
    'You overhear nothing. The real gossip moved to the group chat.',
    'Glug. The bottle burps politely.',
    'A sign: "Cups are for water only". There are no cups.',
    'The cooler is the most social member of the team.',
  ],
  whiteboard: [
    'Someone wrote "DO NOT ERASE" in 2017. Nobody has dared since.',
    'A diagram with 14 arrows, all pointing at the word "VALUE".',
    'The markers are all dry except the red one. It is always the red one.',
    'Half-erased: "Q3 goals: 1. Survive  2. ????  3. Profit".',
  ],
  mailshelf: [
    'A parcel addressed to "Whoever ordered the stapler (you know who)".',
    'Mail for someone who left in 2019. It keeps coming. They are popular.',
    'A postcard from the CEO\'s holiday. It says "Working hard!" with a beach on it.',
  ],
  boxes: [
    'Boxes marked "MISC". Inside: more boxes, marked "MISC 2".',
    'A box of 400 branded stress balls. Someone was very stressed.',
    'A box labelled "Christmas decorations 2016 (DO NOT REUSE - incident)".',
  ],
  filing: [
    'The drawer is labelled "Receipts 1998-2003". It is very full.',
    'Folder: "Meeting minutes about meeting minutes, vol. 4".',
    'The cabinet is locked. The key is taped to the side of the cabinet.',
    'One drawer only opens if you say please. You say please. It opens.',
  ],
  bookshelf: [
    'Books: "Who Moved My Stapler?", "The 8 Habits", "Leading with Leading".',
    'A book called "Mastering Excel". The bookmark is on page 3.',
    'A row of binders labelled "STRATEGY". All of them are empty.',
    'A trophy for "Most Improved Bookshelf". It is this bookshelf.',
  ],
  trophy: [
    'Engraved: "Employee of the Month - every month - Ken". Ken made it.',
    'A trophy for "Best Synergy 2014". Nobody remembers what happened.',
    'A golden stapler on a plinth. You feel you should bow.',
  ],
  poster: [
    'A poster of a kitten on a rope: "HANG IN THERE (your review is next)".',
    'A poster: "TEAMWORK". Someone drew a tiny moustache on the eagle.',
    'A poster: "There is no I in TEAM. There is one in REVIEW, though."',
  ],
  printer: [
    'PC LOAD LETTER. Nobody knows what it means. Nobody ever has.',
    'The printer is printing a single blank page. It does this hourly.',
    'Tray 2 is empty. Tray 1 is empty. Tray 3 is a sandwich.',
  ],
  copier: [
    'Someone copied their hand. Forty times. Collated.',
    'A sign: "Copier is for WORK only". It is wearing a party hat.',
    'The lid is warm. The copier is either busy or thinking.',
  ],
  shredder: [
    'A sign: "Shredder is not a toy". Under it: a tiny shredded paper crown.',
    'The bin is full of very small confetti. Payroll had a good day.',
    'You hear it humming softly. It is hungry.',
  ],
  serverrack: [
    'A label: "PROD - DO NOT UNPLUG". The plug is held in with tape.',
    'The fans hum in C minor. A sad, important song.',
    'One blinking light is green, one is red, one is purple. Nobody knows purple.',
    'Taped to the rack: "If this beeps, call Kevin. Do not call Kevin after 5."',
  ],
  toilet: [
    'Occupied. Someone is reading the quarterly report in there. All of it.',
    'A sign: "Please flush twice. Once for you, once for the team."',
    'A laminated notice on the door: "Restroom feedback survey: 1-5 stars".',
  ],
  sink: [
    'Hand-washing poster: "20 seconds. Or one verse of the company song."',
    'The soap dispenser gives you exactly one sad bubble.',
    'The mirror has a sticky note: "You are an asset!"',
  ],
  fountain: [
    'Coins at the bottom. One of them is a button from the CEO\'s jacket.',
    'A sign: "Please do not wish for a raise. The fountain is not in the budget."',
  ],
  directory: [
    'Floor directory. Somebody added "Floor 41: Narnia" in marker.',
    'Your name is not on the directory yet. Give it time.',
  ],
  gong: [
    'A note: "Ring ONLY for closed deals". You resist. Mostly.',
    'The gong has a dent. Something happened at the Christmas party.',
  ],
  easel: [
    'A half-finished mood board. The mood is "beige".',
    'A sketch of the new logo. It is the old logo, but italic.',
  ],
  camera: [
    'The camera is pointed at a plant. The plant is the brand ambassador.',
    'A sticky note on the lens: "Smile, you are content".',
  ],
  tvscreen: [
    'The screen shows a dashboard. Every number is green and nobody trusts it.',
    'The screensaver is the company logo bouncing. It never quite hits the corner.',
  ],
  turnstile: [
    'Beep. The turnstile recognises you now. You have a friend.',
    'The turnstile clicks politely. It is the most reliable employee here.',
  ],
  elevator: [],
  plant: [],
  fridge: [],
};

// ---------------------------------------------------------------- fridge
/** Notes and magnets on the fridge door. */
export const FRIDGE_DOOR = [
  'FRIDGE CLEAN-OUT EVERY FRIDAY! (sign dated 2017)',
  'To whoever ate my yoghurt: I know. - K.',
  'A child\'s drawing: "MY MUMS OFFIS". It is very accurate.',
  'Takeaway menu, 2014. Three dishes circled. One crossed out angrily.',
  'Magnet: "I SURVIVED THE REORG (2 OF 3)".',
  'Rota: "Fridge duty this week: ________". Blank since forever.',
  'A sticky note: "This shelf is for Marketing." Below: "No. - Sales"',
  'Magnet shaped like a tiny fridge. Very meta.',
  'Please label your food. (This note is labelled.)',
  'Lost: one lunch box, blue. Answers to "LUNCH".',
];

/** Ordinary fridge contents: [label, detail, shape]. Shapes: box, jar, bottle, carton, cake, bag. */
export const FRIDGE_ITEMS = [
  ['DO NOT EAT - KAREN', 'A single grape inside a very large box. It is a statement.', 'box'],
  ['Gary\'s yoghurt (week 3)', 'The lid is slightly domed. Gary is on holiday until next month.', 'jar'],
  ['NOT YOURS', 'Neither is it the writer\'s. Nobody knows whose it is.', 'box'],
  ['Milk (exp. ???)', 'The date has been scratched off. Bold choice.', 'carton'],
  ['Birthday cake for Dana', 'Dana left in 2021. The cake stayed for the culture.', 'cake'],
  ['Ketchup x73', 'Seventy-three sachets in a bag. A strategic reserve.', 'bag'],
  ['Fish, Friday', 'Today is not Friday. Nobody is sure which Friday.', 'box'],
  ['Sandwich of Theseus', 'Every part has been replaced by a different person\'s lunch. Is it still the same sandwich?', 'box'],
  ['Mustard (for emergencies)', 'An unopened jar. HR says there has never been an emergency.', 'jar'],
  ['Oat milk - TEAM', 'Shared by the team. Mostly by one person, though.', 'carton'],
  ['LEFTOVERS - MEETING', 'Seven sad canapes from the 2 pm. They have opinions.', 'box'],
  ['Hot sauce (IT ONLY)', 'Rated "do not". Signed by the whole IT department.', 'bottle'],
  ['Salad (aspirational)', 'Bought on Monday with good intentions. It is Thursday.', 'box'],
  ['Sparkling water', 'Gone flat. Like the Q2 forecast.', 'bottle'],
  ['Mum\'s soup - BACK OFF', 'Labelled in three languages and one diagram.', 'jar'],
  ['Lunch (Raj)', 'A neat bento box with a tiny note: "you got this, Raj".', 'box'],
  ['Cheese. Probably.', 'It started as cheese. It may be applying for a different role.', 'box'],
  ['Butter (shared)', 'Has toast crumbs, jam, and one confused coffee bean in it.', 'box'],
  ['Pickles from the offsite', 'The offsite was in 2018. The pickles endured.', 'jar'],
  ['Juice - TASTED', 'Somebody wrote TASTED on it. It was not the owner.', 'bottle'],
];

/** The ancient container at the back. [label, detail]. It always moves. */
export const FRIDGE_ANCIENT = [
  ['Mystery from 2019', 'Something inside lifts the lid, blinks twice and sinks back. You close the fridge door politely.'],
  ['Was soup once', 'It wobbles. It may now be a small independent nation. Diplomacy is advised.'],
  ['Science project', 'Facilities have a ticket for this one. The ticket is also from 2019.'],
  ['Unlabeled. Fuzzy.', 'It hums quietly. You think it said "close the door". You do.'],
  ['Ancient lentils', 'The lentils have formed a committee. They are discussing you.'],
];

export const FRIDGE_LINES = ['Something at the back moved.', 'You hear a faint "blub".', 'That smell has seniority.', 'The fridge light flickers nervously.'];

// ---------------------------------------------------------------- plants
export const PLANT_NAMES = ['Gerald', 'Fernando', 'Leafy McLeafface', 'Kevin (the green one)', 'Photosynthia', 'Mr. Pot', 'Planty McPlantface', 'The Intern', 'Sir Fronds-a-lot', 'Ficus Maximus', 'Kale-vin', 'Barbara'];
export const PLANT_TAGS = [
  'Please water me. - {name}',
  'Do NOT water. I am a cactus at heart. - {name}',
  '{name}. Joined: 2011. Promoted: never.',
  'Property of Facilities. Emotional support: everyone.',
  '{name} likes jazz and indirect sunlight.',
];
/** The watering log stuck in the soil: everybody waters on Monday. */
export const WATER_LOGS = [
  ['Mon - Dana', 'Mon - Raj', 'Mon - Ana', 'Mon - Dana again'],
  ['Watered (Tue)', 'Watered (Tue, oops)', 'Gave it coffee', 'Sang to it'],
  ['Mon - me', 'Mon - also me', 'Fri - sorry, holiday', 'Mon - who drowned it?'],
  ['Fed: water', 'Fed: half a latte', 'Fed: motivational talk', 'Fed: water (finally)'],
];
/** Lost things buried in the soil, found on some plants. */
export const PLANT_FINDS = [
  'a USB stick labelled "BACKUP FINAL (2) REAL"',
  'a single earring, shaped like a tiny stapler',
  'three paperclips, holding hands',
  'a business card: "Chief Vibes Officer"',
  'a rubber duck. It looks relieved.',
  'the TV remote from the boardroom. Mystery solved.',
  'a fortune cookie slip: "You will attend many meetings."',
];
export const WORM_LINES = [
  'The worm waves. You both agree not to tell Facilities.',
  'The worm looks at you, nods once, and goes back to work. Very senior.',
  'The worm is wearing a tiny lanyard. It has better access than you.',
  'The worm wriggles a little "hello". Polite. More than some people.',
];
export const PLASTIC_LINE = 'It is plastic. Someone has watered it every Monday for three years.';

// ---------------------------------------------------------------- HR personnel files
export const COFFEE_ORDERS = [
  'Oat flat white, extra hot, a whisper of cinnamon',
  'Black. Very black. No questions.',
  'Decaf (do not tell anyone)',
  'Triple espresso, then a triple espresso',
  'Tea. Bag left in. For hours.',
  'Hot water with lemon, judged by all',
  'Whatever is in the pot, plus 4 sugars',
  'Mocha with sprinkles, "for morale"',
  'Iced latte, even in December',
  'Cappuccino, the foam must be "architectural"',
];
export const RATINGS = [
  ['Exceeds expectations', 5],
  ['Meets expectations of exceeding expectations', 4],
  ['Meets expectations', 3],
  ['Meets some expectations, on Tuesdays', 3],
  ['Expectations under review', 2],
  ['Expectations moved to Q3', 2],
];
export const STRENGTHS = [
  'Unmatched at finding the good stapler',
  'Always unmuted at the right moment',
  'Brings snacks to difficult meetings',
  'Can format a table in under an hour',
  'Remembers everyone\'s birthday (and age)',
  'Fixes the printer by looking at it',
  'Writes emails with zero exclamation marks',
  'Knows where the spare chairs go',
  'Reads the whole agenda. Every time.',
  'Calm in a fire drill. Suspiciously calm.',
  'Can say "let\'s take this offline" in 4 languages',
  'Has never once replied-all',
];
export const GROWTH = [
  'Using fewer fonts per slide (currently 7)',
  'Leaving meetings that ended an hour ago',
  'Labelling food in the fridge',
  'Not naming files "final_final_v3"',
  'Muting during lunch',
  'Saying no to meetings about saying no',
  'Giving the good stapler back',
  'Letting other people finish their sentences',
  'Using the calendar instead of hoping',
  'Not microwaving fish (see incident log)',
];
export const INCIDENTS = [
  'The Stapler Incident, 2016 (resolved, mostly)',
  'Microwaved fish. Floor evacuated. Twice.',
  'Replied-all to 4,000 people with "thanks!"',
  'Set the office plant as their manager in the org chart',
  'Brought a goat to "Bring your pet to work" day',
  'Locked in the stationery cupboard for 3 hours. Reorganised it.',
  'Used the CEO\'s mug. Washed it. Put it back. Still counts.',
  'None. Suspiciously none.',
  'Accidentally booked the boardroom for all of 2023',
  'Started a slow clap at the all-hands. Nobody joined.',
];
export const EMERGENCY = [
  'Their mum. Again.',
  'Their cat (has its own phone)',
  'The pizza place on the corner',
  'Kevin from IT (do not call after 5)',
  'Their personal trainer, "Big Steve"',
  'A sibling who is also in HR, somewhere else',
  'The voicemail of their past self',
];
export const DESKS = [
  'Row 3, the window that does not open',
  'Next to the printer (by choice!)',
  'Under the air vent. Bring a scarf.',
  'Hot desk. Usually lukewarm.',
  'The corner. They earned the corner.',
  'Beside the fridge (see: incidents)',
  'Wherever the good chair is today',
];
export const EXTRA_NOTES = [
  'Shoe size recorded for reasons HR can no longer recall.',
  'Owns the only working highlighter on this floor.',
  'Has asked about the parking space 14 times.',
  'Wears a different lanyard every day. Collector?',
  'Once fixed the wifi by unplugging it and plugging it back in. Celebrated.',
  'Keeps a spare tie for other people. Hero.',
  'Laughs at every joke in the all-hands. Even the CFO\'s.',
  'Allergic to synergy (doctor\'s note attached).',
  'Sends "per my last email" emails. Kindly.',
  'Their plant is doing better than they are.',
];
export const DOODLES = ['cat', 'stapler', 'sun', 'chart'];

/** The MISC drawer: files that are not about people, sort of. [title, role, lines]. */
export const MISC_FILES = [
  ['Gerald (office plant)', 'Decor, Senior', ['Rating: Photosynthesises expectations', 'Strengths: Never interrupts. Excellent listener.', 'Growth: Leaves (all of them, on Fridays)', 'Notes: Over-watered by 6 colleagues. Thriving anyway.']],
  ['The Stapler Incident', 'Case file, 2016', ['Status: Resolved, mostly', 'Parties: Accounts vs. Reception', 'Evidence: one red stapler, one bent paperclip', 'Outcome: Everyone gets a stapler. Nobody is happy.']],
  ['The Office Dog (Biscuit)', 'Morale, Chief', ['Rating: Very good boy', 'Strengths: Attends every meeting. Happy each time.', 'Growth: Eating the post', 'Salary: 2 biscuits/day, 1 extra on Fridays']],
  ['Printer #3', 'Hardware, Intermittent', ['Rating: Does not meet expectations (PC LOAD LETTER)', 'Strengths: Excellent at jamming', 'Growth: Printing', 'Notes: Has been kicked 412 times. Prefers 3 kicks.']],
];
/** What the leaves look like when poked (real plants). */
export const PLANT_LOOKS = [
  'Healthy, a little damp. Six people watered it this morning.',
  'One leaf is turning yellow. It is the one facing the meeting room.',
  'It leans towards the window, like everyone else at 4:55 pm.',
  'There is a sticky note on a leaf: "I am fine. - the plant".',
  'It has grown 2 cm since the last reorg. More than the share price.',
  'The leaves are dusty. You blow on them gently. The plant appreciates it.',
];
