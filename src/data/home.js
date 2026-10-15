// Home office text (core/home.js, scenes/home.js). Pure data, ASCII only (bitmap font).

/**
 * The chores at home (MinigameScene mode 'home'). `brew` is the coffee game (brewing by hand at the coffee maker): it
 * pours cups instead of costing one. Its id is not `coffee` because that id is the office station game Coffee Run.
 */
export const CHORES = [
  { game: 'vacuum', title: 'Vacuum the flat', where: 'Living room', blurb: 'Dust bunnies have unionised under the sofa. Suck them all up before they elect a leader.' },
  { game: 'dishes', title: 'Wash the dishes', where: 'Kitchen', blurb: 'A week of plates. Scrub each one clean, then set it in the rack without breaking it.' },
  { game: 'laundry', title: 'Do the laundry', where: 'Bathroom', blurb: 'Whites, colours and delicates. One red sock in the wrong drum and everything is pink.' },
  { game: 'ironing', title: 'Iron a shirt', where: 'Living room', blurb: 'Smooth out every crease for tomorrow. Keep the iron moving or it scorches.' },
  { game: 'bath', title: 'Take a bath', where: 'Bathroom', blurb: 'Hot tap, cold tap. Keep the water just right and let the bubbles do the rest.' },
  { game: 'brew', title: 'Brew coffee', where: 'Kitchen', blurb: 'Your own coffee maker, free refills. Grind, heat, pour: three cups if you get it right.' },
];
export const CHORE_GAMES = CHORES.filter((c) => c.game !== 'brew').map((c) => c.game);

/** What your manager calls out now and then on floors 8, 18, 28 and 38 while today's home office is on offer. */
export const HOME_TEASERS = [
  'You look exhausted. Have you considered working from your sofa?',
  'Some people get more done at home. Some people, I said.',
  'Your camera does not need to see this office to see you work.',
  'The commute is the worst part of the job. You could skip it today.',
  'Remote work is a privilege. A privilege I am considering for you.',
  'You yawned three times in the stand-up. I counted.',
  'Your laundry is not going to fold itself, I imagine.',
  'I trust you. Mostly. Your status light will tell me the rest.',
];

export const HOME_OFFER = (minutes) =>
  '"You look exhausted. Finish it from home today. Just stay online, I will be watching your status."\n' +
  `${minutes} minutes at home: do your chores (a cup of coffee each, a few paperclips and XP), brew your own coffee and ` +
  'keep the presence meter on your computer from running dry. Three lapses and I call you back in. ' +
  'Come back on good terms and every station on this floor is ready for you. One home office day a day.';

/** Your manager afterwards (today's home office is used up). */
export const HOME_AFTER = [
  'How was home? Your status light was very... green. Mostly.',
  'Did you shower before the video call? Do not answer that.',
  'Nice to see you in person. You look rested. Suspiciously rested.',
  'One home office day a day. The office misses you. The printer does not.',
  'Your camera background was very tidy. Was it real?',
  'Remote work went fine. Let us not make it a habit.',
];

/** Why there is no home office right now. */
export const HOME_REFUSALS = {
  hold: 'Not with that compliance hold. HR wants you where they can see you.',
  badge: 'You have not even checked in yet. Home can wait.',
  away: 'You are not even supposed to be here right now.',
  busy: 'Finish what you are doing first, then go home.',
};

export const HOME_GOODBYE = 'Off you go. And keep that status green!';

/** The boss on Teams when the presence meter runs dry. */
export const LAPSE_LINES = [
  'Boss: "Your status says Away. Are you away?"',
  'Boss: "Just checking in. Are you still with us?"',
  'Boss: "I pinged you three times. Ping me back."',
  'Boss: "Yellow status. Interesting choice for a work day."',
  'Boss: "Is your laptop asleep, or are you?"',
];
export const SENT_BACK = 'Boss: "That is three times your status went yellow. Come back to the office. Now, please."';

/** Video calls: the ring, then the outcome. */
export const CALL_RING = 'Incoming video call from your boss! Camera on in 20 s!';
export const CALL_ANSWERED = [
  'Boss: "Ah, there you are. Great background. Carry on."',
  'Boss: "Just wanted to see your face. Very productive face."',
  'Boss: "Quick sync done. That was the meeting."',
  'Boss: "You look busy. Good. Bye."',
];
export const CALL_MISSED = 'Boss: "Missed call. I will write that down."';

/** Leaving by the front door before the time is up. */
export const HOME_LEAVE = (left) => `${left} of the home office day left. Head back to the office now?`;

/** The summary back at the office. */
export const HOME_SUMMARY_TITLE = { done: 'Back from home', early: 'Back early', sent_back: 'Called back in' };
export const HOME_SUMMARY = (sum) =>
  `${{ done: 'A day at home well spent.', early: 'You pop back in before lunch.', sent_back: 'Your boss is waiting at the elevator.' }[sum.result]}\n` +
  `Chores done: ${sum.chores}. Status lapses: ${sum.lapses}/${sum.maxLapses}.` +
  (sum.calls ? ` Video calls answered: ${sum.answered}/${sum.calls}.` : '') +
  '\n' +
  (sum.cleared ? 'Rested and back: every station on this floor is ready for you.' : 'No fresh start this time: the stations keep their cooldowns.');

/** What poking furniture in the flat makes you say (scenes/home.js; core/curios.js reads it when `fl.home`). */
export const HOME_QUIPS = {
  sofa: [
    'My sofa. It knows the shape of me better than my manager does.',
    'There is a remote in here somewhere. There always is.',
    'The cushions hold crumbs from at least three takeaways.',
    'A quick sit? No. A quick sit becomes a long nap.',
    'This sofa has seen more of my meetings than the meeting room.',
    'I found 40 cents and a paperclip down the side. Office habits.',
    'The left cushion is mine. The right cushion is laundry.',
    'Comfiest office chair I have ever had. Terrible lumbar support.',
    'It folds out into a bed. It has never been folded back.',
    'The cat used to sleep here. I do not have a cat.',
    'A throw blanket, artfully thrown. It took me four tries.',
    'If I sit down now, my status goes yellow. I know it.',
    'This is where the magic happens. Mostly snacks.',
    'Sofa, couch or settee? Whatever it is, it is calling me.',
    'There is a dent shaped like a laptop. Work life balance.',
    'The springs squeak at exactly the wrong moment on calls.',
    'I could work from here. I could also not.',
    'My second monitor is a cushion. It does not display much.',
    'Bought it on sale. It was on sale for a reason.',
    'It matches nothing in the flat. That is a design choice.',
    'Five more minutes on the sofa. Said nobody productive.',
  ],
  hometv: [
    'The TV. Off, on a work day. Mostly off.',
    'It is just a black mirror. I look tired in it.',
    'Background noise for focus. That is what I tell myself.',
    'Streaming says "Are you still watching?" Rude, but fair.',
    'I could put the news on. Or I could stay sane.',
    'There are 400 channels and nothing about spreadsheets.',
    'Last night I watched a documentary about offices. To relax.',
    'The remote needs new batteries. So do I.',
    'Cooking show in the morning, crime drama at lunch. Balance.',
    'Every streaming app wants a different password. Like work.',
    'This TV is bigger than my office monitor. Priorities.',
    'If my boss calls, the TV is a "second screen for metrics".',
    'Paused on a cliffhanger since Sunday. I will survive.',
    'It has a sleep timer. I wish my laptop had one.',
    'Smart TV. It knows more about me than HR.',
    'A quiz show is on. I know none of the answers. Corporate brain.',
    'The screen saver is a fireplace. Cosy and productive.',
    'Nature documentary: a lion ignores its emails. Relatable.',
    'I will just check the weather. Twenty minutes later...',
    'The TV light is blinking. Even it wants an update.',
    'No TV until five. Or at least until four.',
  ],
  houseplant: [
    'My plant. It is thriving. Unlike the one at my desk.',
    'I water it on Mondays. It is Monday somewhere.',
    'A new leaf! I should put that in my status update.',
    'It leans towards the window. It wants out too.',
    'I named it Kevin. Kevin does not do meetings.',
    'A plant that gets daylight. The office ones are jealous.',
    'The soil is dry. So is my calendar today.',
    'Talking to plants helps them grow. It helps me too.',
    'It is a peace lily. Peace, lily. Peace.',
    'It survived my last holiday. Tough little thing.',
    'One yellow leaf. It is fine. We are all fine.',
    'My best coworker: quiet, green, never replies all.',
    'Repotted it last spring. It has not thanked me.',
    'Photosynthesis: the original working from home.',
    'It has more growth this quarter than the company.',
    'I bought it to clean the air. The air is still my air.',
    'Fertilizer in the drawer. Ambition in short supply.',
    'Its pot is a mug from the office. It knows.',
    'It is reaching for the light. Same, plant. Same.',
    'Watered. Do not let me water it again today.',
    'If it dies, I am not a plant person. It is still alive.',
  ],
  bookshelf: [
    'My bookshelf. Half books, half things that are not books.',
    'A self-help book about getting up early. Unopened.',
    'Leadership in 10 Easy Steps. Step one: buy the book.',
    'Board games with missing pieces. All of them.',
    'A dictionary. Synergy is not in it. I checked.',
    'Novels I started. The bookmarks are all on page 30.',
    'A photo of me at a team building. Everyone looks hostage.',
    'The Art of Saying No. Borrowed by my manager. Never returned.',
    'A cookbook with one recipe stained. Toast, I think.',
    'Travel guides for places I will visit when I retire.',
    'A shelf of chargers for devices I no longer own.',
    'A book about tidying. Behind a pile of untidy books.',
    'My diploma, framed, leaning, slightly dusty.',
    'A trophy from a quiz night. Third place. Out of three.',
    'Time Management for Busy People. Too busy to read it.',
    'Old university notes. Not one word about paperclips.',
    'A tiny cactus guards the poetry section.',
    'Everything is sorted by colour. Finding things is not the goal.',
    'A novel called The Office. It is not about an office.',
    'A box of business cards from two job titles ago.',
    'One day I will read all of these. Probably at retirement.',
  ],
  counter: [
    'The kitchen counter. Crumbs from every meal this week.',
    'A toaster, a fruit bowl, one sad banana.',
    'Someone wiped this recently. It was not me.',
    'Mail I will open later. Later is a long time.',
    'The good knife. Do not touch the good knife.',
    'A jar of spoons. Why do I own forty spoons?',
    'Lunch was eaten standing here. Very agile of me.',
    'Two half-drunk mugs. Both mine. Both cold.',
    'A recipe card propped up, never followed.',
    'Keys, receipts, a battery. The everything spot.',
    'The kettle cord reaches exactly nowhere useful.',
    'A herb pot. The basil is surviving on hope.',
    'Sticky. I will not investigate further.',
    'A cookbook open on the same page for a month.',
    'The fruit bowl is mostly decorative now.',
    'Bread, slightly stale. Toast-grade, at least.',
    'My chopping board has seen things. Mostly onions.',
    'The countertop is my standing desk at lunch.',
    'A sticky note: "BUY MILK". There is milk. Probably.',
    'A tiny plant, a big spill, a short story.',
    'I could cook something. I could also not.',
  ],
  kitchentable: [
    'My kitchen table. Also my dining room. Also my meeting room.',
    'Two chairs, one used. The other holds coats.',
    'Placemats bought for guests who never came.',
    'A ring from a mug, permanently in the wood.',
    'This table hosted my best-ever video call. I was in pyjamas.',
    'A salt shaker, a pepper grinder, a lone fork.',
    'Breakfast here, lunch here, dinner on the sofa.',
    'One leg is shorter. A folded menu fixes it.',
    'A pile of letters marked URGENT. Since spring.',
    'The perfect spot for a jigsaw I never finish.',
    'Bills on the left, takeaway menus on the right.',
    'It wobbles when I type. So I do not type here.',
    'My plant cuttings in a glass. Very aspirational.',
    'A candle for dinner dates. Unlit since forever.',
    'Fruit bowl number two. Equally decorative.',
    'I did my taxes here once. The table remembers.',
    'Board games night was here. One player. Me.',
    'A crossword, half done, in pen. Bold of me.',
    'Coffee rings form a pleasing Olympic logo.',
    'Remote work tip: never take a call from this chair.',
    'Kitchen table, conference table. Same thing really.',
  ],
  toilet: [
    'The toilet. The only room nobody schedules meetings in.',
    'Some people take calls here. I am not those people.',
    'A crossword book lives here for emergencies.',
    'The lid is down. My flatmate trained me well. I live alone.',
    'Toilet roll: two left. That is a problem for tomorrow.',
    'A candle on the cistern. Smells of "Ocean Breeze".',
    'The flush handle needs a jiggle. Technical debt.',
    'Mute your microphone before you visit. Always.',
    'Five minutes of peace, no status light needed.',
    'The best ideas come here. None of them are work ideas.',
    'A tiny shelf of magazines from 2019.',
    'At least here my status is not on display.',
    'Blue toilet water. Fancy.',
    'The office toilets have a queue. This one does not.',
    'Quietest room in the flat. Best acoustics too.',
    'The spare roll is under the sink. Hopefully.',
    'Clean. Clean enough. Clean-ish.',
    'Working from home perk number one: my own toilet.',
    'Nobody is reading their emails at the next cubicle.',
    'I will not bring the laptop in here. I will not.',
    'Remember to wash your hands. And close the laptop.',
  ],
  sink: [
    'The washbasin. Toothpaste on the mirror, as usual.',
    'Two toothbrushes. One is for shoes.',
    'The tap drips once every eleven seconds. I timed it.',
    'A soap bar shaped like a seashell. Too pretty to use.',
    'My reflection says I need a haircut. And a holiday.',
    'Hair gel for video calls. Only the top half counts.',
    'Contact lens case, empty. Glasses day.',
    'A cup with three toothbrushes. I have one mouth.',
    'Face wash, face cream, face serum. Same face.',
    'The plug is missing. It has been missing for years.',
    'A razor, a comb, a wish for more time.',
    'The mirror steams up. Very dramatic.',
    'Hand towel, slightly damp, always.',
    'Mouthwash: the minty reset before a video call.',
    'A sticky note on the mirror: YOU CAN DO IT.',
    'The cabinet holds 14 half-empty bottles.',
    'Splash water on your face. Feel professional.',
    'The water takes a minute to get warm. Like me.',
    'Floss. Bought in hope, used in theory.',
    'A rubber duck guards the soap dish.',
    'I look ready for a meeting. From the neck up.',
  ],
  rug: [
    'A rug. It ties the room together.',
    'Soft underfoot. My socks approve.',
    'There is a stain shaped like a spreadsheet.',
    'The vacuum is scared of the tassels.',
    'Bought online. It looked bigger in the photo.',
    'It hides a scratch in the floor. Our little secret.',
    'Good for yoga. Or for lying on, thinking about yoga.',
    'The corner keeps curling up. I keep stepping on it.',
    'Crumbs live here now. They pay no rent.',
    'A pattern from a faraway land. Made in a factory.',
    'Warm on cold mornings. Hero of the flat.',
    'I tripped on it during a call. Camera was on.',
    'It is very fluffy. Possibly too fluffy.',
    'Good spot for stretching between meetings.',
    'Dust bunnies gather here for their meetings.',
    'A rug is just a carpet that knows its place.',
    'It matches the sofa. That was luck, not taste.',
    'Lint, glitter, a paperclip. A paperclip?!',
    'I shake it out the window twice a year.',
    'The bath mat version is less fluffy, more damp.',
    'Stand on it barefoot. Instant calm.',
  ],
  homebed: [
    'My bed. Unmade. It is a statement about work life balance.',
    'It is right there. I could just lie down. For one second.',
    'Napping is a productivity technique. I read it online.',
    'The pillow still has the shape of my head from this morning.',
    'If I get in, I am not getting out. I know myself.',
    'The duvet is calling. I am letting it go to voicemail.',
    'I could take my calls from here. Camera off, obviously.',
    'Freshly washed sheets. Well, washed sheets.',
    'Under the bed: shoes, a suitcase, a box marked TAXES.',
    'The alarm clock looks at me like it knows something.',
    'Power nap: 20 minutes. My record nap: the whole afternoon.',
    'A bed is just a sofa that commits.',
    'My laptop has slept here more than I have this week.',
    'Making the bed counts as a chore. I think. It should.',
    'A mattress topper, a weighted blanket, four pillows. Comfort.',
    'I am not lying down. I am just checking the duvet.',
    'Rested employees are productive employees. Let me be rested.',
    'Sleep is for the weekend. Today is not the weekend.',
    'There is a sock in here that went missing in March.',
    'The bed is perfectly comfortable. That is the problem.',
    'Lie down and the status goes yellow. Tempting, though.',
  ],
};

/** Your own fridge (the home close-up): its door, its shelves, the one thing at the back. */
export const HOME_FRIDGE = {
  title: 'Your fridge',
  door: [
    'A shopping list: milk, eggs, "motivation".',
    'Takeaway menu, three dishes worn from pointing.',
    'Magnet from a holiday you barely remember.',
    'A sticky note: "CALL MUM". It is from last month.',
    'Dentist appointment card. You have already missed it.',
    'A postcard from the office party. You are not in it.',
    'Magnet: "WORLD\'S OKAYEST EMPLOYEE".',
  ],
  items: [
    ['Leftover pizza', 'Two slices, from Friday. Still the best breakfast option.', 'box'],
    ['Oat milk', 'You switched to it for the office. It stuck.', 'carton'],
    ['Eggs (4)', 'There were six. You do not remember the other two.', 'box'],
    ['Hot sauce', 'It goes on everything. It has gone on everything.', 'bottle'],
    ['Cheese', 'A sensible cheddar. Your one adult purchase.', 'box'],
    ['Pickles', 'A jar you open for one pickle every three weeks.', 'jar'],
    ['Lemonade', 'Flat. You keep it for the memories.', 'bottle'],
    ['Yoghurt', 'Your own yoghurt. Nobody can steal it here. Bliss.', 'jar'],
    ['Birthday cake', 'Your own cake, from your own birthday. Nobody sang.', 'cake'],
    ['Salad kit', 'Bought with good intentions. Still sealed.', 'bag'],
    ['Butter', 'Rock hard. You will spread it anyway.', 'box'],
    ['Jam', 'Grandma made it. The label says "for emergencies".', 'jar'],
    ['Cold brew', 'You make it yourself now. Very artisanal. Very cheap.', 'bottle'],
    ['Takeaway rice', 'A small white box of rice, for luck.', 'box'],
  ],
  ancient: [
    ['Meal prep (Monday)', 'Five boxes of meal prep. You ate one. The other four have formed a committee.'],
    ['Soup from mum', 'It was going to be lunch. That was a season ago.'],
    ['Science experiment', 'A green fuzz waves at you. You wave back, out of politeness.'],
  ],
  lines: [
    'Nothing to eat. Again.',
    'I will order something later.',
    'That container at the back is not my problem today.',
    'At least nobody steals my yoghurt here.',
    'I should go shopping. I will not.',
    'Cold. Like my inbox.',
  ],
};
