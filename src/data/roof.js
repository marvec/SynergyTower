// Text for the roof (core/roof.js, scenes/roof.js): the fire-escape window, the climb, the smokers, the guard, the pay
// telescope, the window cleaners' cradle and what the player says about the roof's props. Only characters the bitmap
// font has (tests/font.test.js).

/** The fire-escape window when it will not open (core/roof.js roofBlock). */
export const STUCK_LINES = {
  closed: "It's stuck. Someone has screwed it shut. Today, anyway.",
  hold: "It's stuck. Probably for the best: HR is watching.",
  badge: "It's stuck. And you don't even have a badge yet.",
  away: "It's stuck.",
};
/** Poking the window on a floor without a fire escape is just a window (no line). Poking the fire-escape one: */
export const WINDOW_PEEK = 'Cigarette butts on the sill. And the latch is loose...';

/** The climb's joke, by how far it is to the roof (floor 2, 12, 22, 32). */
export const CLIMB_UP = {
  2: '38 floors. The smokers do this every day.',
  12: '28 floors of fire escape. Nobody said networking was easy.',
  22: '18 floors. Do not look down. You looked down.',
  32: 'Only 8 floors. The executives call this cardio.',
};
export const CLIMB_DOWN = ['Down is easier. Mostly.', 'Mind the third rung. Everybody does.', 'Back to work. Act natural.'];
export const CLIMB_SKIP = 'SPACE / click: skip';

/** A colleague on a roof floor, now and then (FloorScene, `{name}` = a smoker's first name). */
export const ROOF_TEASERS = [
  "{name}'s on the roof again. Don't ask me how.",
  'Have you noticed {name} always smells of smoke after lunch?',
  "{name} goes out the {room} window. I didn't tell you that.",
  'Every afternoon {name} vanishes for twenty minutes. Every single afternoon.',
  'If you need {name}, try upstairs. Way upstairs.',
];

/** The smokers chatting at the bench (speech bubbles). */
export const SMOKER_CHATTER = [
  'Best view in the company. Worst habit in the company.',
  'Do not tell HR we are up here.',
  'I come up here to think. Mostly about quitting.',
  'Five more minutes. The quarterly report can wait.',
  'Did you see the new org chart? I am a dotted line now.',
  'The bees get more budget than my team.',
  'That pigeon has been in more meetings than me.',
  'One day I will take the cradle down and never come back.',
  'Facilities changed the lock again. We changed the window.',
  'Smoke break, sync-up. Same thing, really.',
  'I told my manager I was at the dentist.',
  'Look at that sunset. Or smog. Hard to tell.',
];

/** The smokers' card. */
export const SMOKER_GREETINGS = ['Oh. Hi. You did not see us, right?', 'New face! Grab a spot by the bucket.', 'Shh. Facilities patrol comes out of that door.', 'Want one? We do not judge. Much.'];
export const SMOKE_OFFER = 'Want one?';
export const NO_THANKS = ['Good for you. Seriously.', 'Fresh air it is, then.', 'Smart. I quit three times this year.', 'More for us.', 'Respect. Your lungs say thanks.'];
export const SMALL_TALK = [
  'The real meetings happen up here, you know.',
  'Promotions are decided by who gets the window seat in the canteen.',
  'Never trust a manager who says "quick sync".',
  'IT can read your emails. They just do not want to.',
  'The CEO has a helicopter. It has never left the ground.',
  'The vending machine on our floor owes me eleven coins.',
  'Legal and HR share a coffee machine. Think about that.',
  'The window cleaners have the best job here. Nobody bothers them.',
];
/** Gossip with real information (scenes/roof.js fills in the numbers). */
export const GOSSIP_EVENT = (mins) =>
  mins > 0
    ? `Word is something's happening downstairs in about ${mins} minute${mins === 1 ? '' : 's'}. Fire drill, cake, audit... Act surprised.`
    : "Something's about to happen downstairs. Fire drill, cake, audit... I can feel it.";
export const GOSSIP_STATION = (title, floor, left) =>
  left > 0 ? `"${title}" on floor ${floor} is free again in ${left}. Just saying.` : `"${title}" on floor ${floor} is free right now. Nobody wants it.`;
export const GOSSIP_PARTY = 'The Christmas party is coming. Pace yourself at the bar.';
/** The archive tip (core/roof.js archiveHint): after a shared cigarette, or "No thanks" plus small talk. */
export const CONFESSION = (label, floor) => `Between us: I nicked an HR folder and stuffed it in the archive. ${label}. Floor ${floor}'s lot are looking for it. Don't tell HR.`;
export const CONFESSION_AGAIN = (label) => `Like I said: ${label}. And you never heard it from me.`;
export const AFTER_SMOKE = ['Not bad for a beginner.', 'You held that like a pro.', 'Coughing is part of the experience.', 'Same time tomorrow?'];

/** The facilities guard. */
export const GUARD_ROLE = 'Facilities';
export const GUARD_OUT = ['Right. Just a quick look round.', 'Nobody up here. Good.', 'Five minutes of peace.'];
export const GUARD_SEES = ['Oi!', 'Hey! You!', 'Hold it!'];
export const GUARD_LOST = ['Huh. Must be the pigeons.', 'Could have sworn...', 'Getting old.'];
export const GUARD_BACK = 'Back to the boiler room.';
export const GUARD_SMOKERS = ["Evening, lads. I didn't see you, you didn't see me.", 'Any of you got a light?'];
export const CAUGHT_TITLE = 'Facilities';
export const CAUGHT_TEXT = 'The roof is closed to staff.\nThe guard walks you down the stairs and back to your floor. The window will be screwed shut for the rest of the day.\n(He does not tell HR. He was up there for a cigarette too.)';
export const GUARD_SAFE = 'He did not even look this way.';

/** The pay telescope. */
export const TELESCOPE_PAY = (sp, s) => `Coin-operated viewer. ${sp} paperclips for ${s} seconds of the city.`;
export const TELESCOPE_BROKE = (sp) => `It wants ${sp} paperclips. You are short.`;
export const TELESCOPE_HELP = 'ARROWS/drag: look around · UP/DOWN/wheel: zoom · SPACE/click: spot';
export const EGG_NAMES = { hotel: 'the holiday hotel', client: "the client's office", balloon: 'a hot-air balloon', waver: 'someone waving', rival: 'the rival tower' };
export const EGG_LINES = {
  hotel: 'Is that... the beach hotel? On the horizon? I can almost smell the sun cream.',
  client: 'The client\'s office! I can see the parking spot I crashed into.',
  balloon: 'A hot-air balloon. Someone has a better job than me.',
  waver: 'Someone across the street is waving. I wave back. We are friends now.',
  rival: 'The rival tower. Their logo is bigger. It is not about size.',
};
export const SPOTTED_ALL = 'Every sight spotted. You should give tours.';
export const TELESCOPE_SHUTTER = 'Clunk. The shutter comes down.';

/** The cradle. */
export const CRADLE_TITLE = "Window cleaners' cradle";
export const CRADLE_TEXT = (floor) => `A ride down the outside of the tower, all the way to floor ${floor}, then back in through the window. The controls are labelled UP and DOWN. How hard can it be?`;
export const CRADLE_GO = 'Ride down';
export const CRADLE_FACES = ['waves', 'stares', 'spills coffee', 'waves back', 'pretends not to see', 'calls security', 'takes a selfie', 'faints'];

/** Leaving by the ladder. */
export const LADDER_TITLE = 'Fire escape';
export const LADDER_TEXT = (floor) => `Back down the ladder to floor ${floor}.`;
export const ROOF_DOOR_LOCKED = 'Locked. FACILITIES ONLY. Someone has drawn a skull on the sign.';
export const ROOF_BANNER = 'THE ROOF';
export const ROOF_SUB = 'Mind the guard. Mind the edge. Mind the bees.';

/** What the player says about the roof's props (curios, read instead of the office QUIPS when fl.roof). */
export const ROOF_QUIPS = {
  acunit: [
    'It hums in a key that makes me want to quit.',
    'Warm air comes out. Like most of the meetings downstairs.',
    'Somewhere below, someone is freezing because of this.',
    'It says "Do not sit on unit". There is a cushion on it.',
    'The fan spins. Nobody knows what it is connected to.',
    'A sticker: "Serviced 2009". Bold.',
    'It is louder than the open-plan office. Somehow.',
    'Someone has hidden a stash of biscuits behind it.',
    'The vents smell faintly of Finance.',
    'If I stand here long enough, I get blow-dried.',
    'This is where the office temperature war is lost.',
    'It rattles every third second. I counted.',
    'A label: "Property of Building Services. Do not hug."',
    'Warm, humming and pointless. I know the feeling.',
    'There is a note taped to it: "Pls fix. - Floor 14".',
    'I think a pigeon lives inside.',
    'It drips. Nobody knows where to.',
    'The best hiding spot on the roof. I am just saying.',
    'Its fan has more drive than my department.',
    'Somebody has scratched "KPI" into the paint. And crossed it out.',
  ],
  watertank: [
    'The water for the whole tower. I will be drinking bottled from now on.',
    'Hello? ...hello? ...hello? Nice echo.',
    'A sign: "Potable". There is a rubber duck floating on top.',
    'It sits on four legs like a very large, very wet chair.',
    'The staves creak in the wind. Reassuring.',
    'Facilities says it is inspected yearly. Which year, they did not say.',
    'Somebody has painted a smiley face on it. It is not smiling.',
    'If this leaks, Legal is on the floor below.',
    'The tea downstairs tastes of this. Now I know why.',
    'It is bigger than the meeting rooms. And better attended.',
    'I knock. It knocks back. I leave.',
    'The ladder up the side is missing every other rung.',
    'A good place to hide from the guard. And from life.',
    'It is wooden. A wooden water tank. In this century.',
    'The coffee machines get their water from here. That explains a lot.',
    'It gurgles when someone flushes downstairs.',
    'There is moss on the shady side. And on the sunny side.',
    'Someone wrote "Carl was here" on a leg. Carl was everywhere.',
    'It holds thousands of litres. And one lost badge.',
    'The fattest thing on the roof, and nobody has put it on a diet.',
  ],
  antenna: [
    'It picks up every radio station. And the CEO\'s phone calls.',
    'The red light blinks so helicopters do not hit it. Comforting.',
    'Rumour says it broadcasts the share price to the moon.',
    'It buzzes when it rains. I am not standing here when it rains.',
    'Somebody has tied a Christmas bauble to the top. In June.',
    'Five bars of signal. Up here I can finally take a call.',
    'IT says it is the "uplink". Uplink to what, they will not say.',
    'A warning sign: "Do not climb". Who would?',
    'It sways a little in the wind. So do I, now.',
    'The pigeons avoid it. They know something.',
    'It is taller than the CEO\'s ambitions. Just.',
    'I touched it. My hair stood up. I will not do that again.',
    'It is the highest point in the company. Not counting egos.',
    'There is a cable going down into the building. And a second one going nowhere.',
    'The light blinks in Morse. I think it says "help".',
    'Up close, it is just a very long stick with opinions.',
    'Marketing wants to put the logo on it.',
    'Every phone downstairs gets one bar because this one hogs them all.',
    'A tag: "Tested: yes". Tested how? By whom?',
    'I can feel it humming in my teeth.',
  ],
  roofshack: [
    'The roof door. FACILITIES ONLY. In red. Twice.',
    'The stairwell head. The guard comes out of here. Quietly, I hope.',
    'Someone has wedged a brick in the door. Twice now.',
    'A sign: "Door alarmed". It does not look alarmed. It looks bored.',
    'Behind this door: 40 floors of stairs and one tired guard.',
    'There is a vent on top that smells of the canteen.',
    'Someone has stuck a "No Smoking" sign here. Under it: twenty butts.',
    'The handle is warm. Somebody was just here.',
    'It is concrete, grey and solid. The company in one building.',
    'There is a little window in the door. Something looked back.',
    'A notice: "Roof access by appointment only". With whom?',
    'Stencilled on the wall: "Exit". It is an entrance from here.',
    'The roof door creaks. Everyone on the roof freezes.',
    'Graffiti: "Tom loves the cradle". Tom has problems.',
    'This is where the bucket brigade keeps its buckets.',
    'A rota on the door: guard patrols "every now and then". Very precise.',
    'It hums. I do not know why a shack would hum.',
    'Someone keyed "SYNERGY" into the paint. Then "WHY".',
    'Behind it is the only shade on the roof.',
    'If I listen closely, I can hear the lift music from here.',
  ],
  roofbench: [
    'The smokers\' bench. The most honest meeting room in the company.',
    'It has a plaque: "In memory of the 2015 budget".',
    'The slats are warm from the sun. And from the gossip.',
    'Somebody carved their initials. And their salary.',
    'It wobbles. Like my career.',
    'From here you can see three competitors and one ex.',
    'Every decision on this floor was made on this bench.',
    'There is gum under it. Executive gum, from the look of it.',
    'It faces the sunset. Somebody planned this.',
    'A bench with a view. Wasted on smokers.',
    'Nobody sits on the left end. It is "Dave\'s spot".',
    'A note taped under the seat: "IOU one lighter".',
    'The paint is peeling in the shape of an org chart.',
    'More secrets have been told here than in HR.',
    'It is bolted down. Someone tried.',
    'I sit for a second. My problems are still there.',
    'The wood says "Made by the team-building day". It shows.',
    'There is a cushion from the boardroom on it.',
    'A good bench. Better than my chair downstairs.',
    'Pigeon-certified. They have left their reviews.',
  ],
  sandbucket: [
    'A fire bucket. Full of cigarette butts. Fire safety!',
    'Sand, butts and one confused beetle.',
    'Somebody has planted a tiny flag in it. "Mine".',
    'It says FIRE. It is mostly ash.',
    'The archaeologists of the future will study this bucket.',
    'There is a ring buried in it. I am not digging.',
    'Health and Safety inspected it. They added a butt.',
    'The smokers call it "the office".',
    'It smells like every bad decision ever made on a Friday.',
    'A lighter, a key and a lost USB stick. The bucket provides.',
    'I see a business card in there. A recruiter\'s.',
    'It is the only thing up here that gets emptied regularly. In theory.',
    'Red, round and full of regret.',
    'If there is ever a fire, we are in trouble.',
    'Somebody has drawn a smiley face in the sand.',
    'There is more ash in here than in the shredder.',
    'One butt has lipstick on it. The plot thickens.',
    'The sand is from the holiday hotel. Somebody brought it back.',
    'A sticker: "Property of Floor 22". It moved.',
    'This bucket has seen things.',
  ],
  pigeons: [
    'Pigeons. They have been in the company longer than me.',
    'One of them looks exactly like my manager.',
    'They are not scared of me. That hurts.',
    'They coo in a rhythm. I think they are in a stand-up.',
    'This one has a ring on its leg. Senior pigeon.',
    'They are waiting for crumbs. Same as the interns.',
    'One is limping. It probably filed a claim.',
    'They stare at me like I owe them a deliverable.',
    'The CEO tried to have them removed. They stayed. He did not.',
    'They know where the biscuits are. They are not telling.',
    'Two pigeons, one crust. A negotiation.',
    'I swear that one just nodded at me.',
    'They walk in circles. Like our projects.',
    'Pigeons do not do appraisals. Lucky pigeons.',
    'One of them steals from the smokers\' crisps. Every day.',
    'They have the best view and no idea.',
    'Shoo. ...they did not shoo.',
    'They have more followers than the company account.',
    'Facilities put spikes on the ledge. The pigeons use them as a perch.',
    'Coo. Coo coo. Sounds like a status update.',
  ],
  beehive: [
    'The company beehives. "Our ESG strategy." Three boxes of it.',
    'Buzzing. The busiest department on the roof.',
    'A sign: "Do not disturb. They have targets too."',
    'The bees have a better work-life balance than me.',
    'The honey is sold in reception as "Synergy Gold". Six pounds a jar.',
    'There is a queen. She has never been to a meeting.',
    'They fly to the park and back all day. No commute complaints.',
    'Sustainability report: page one, a photo of these boxes.',
    'I can hear them working. They never stop. Show-offs.',
    'They have a flat hierarchy. Apart from the queen.',
    'A bee lands on me. I do not move. I have never been so still.',
    'Every hive has a logo sticker. The bees did not ask for it.',
    'The beekeeper comes on Tuesdays. In a suit. The other kind.',
    'They make honey out of flowers. We make slides out of coffee.',
    'Marketing wants a bee mascot. The bees said no.',
    'A plaque: "Sponsored by the Board". The bees pay no rent.',
    'Fifty thousand colleagues in a box. Sounds like open plan.',
    'The bees are on strike when it rains. Good for them.',
    'I could watch them all day. Do not tell my manager.',
    'They dance to tell each other where the flowers are. Like a stand-up, but useful.',
  ],
  rooflamp: [
    'A lamp post on a roof. For the night shift smokers.',
    'The bulb buzzes. Moths hold their meetings here at night.',
    'It has a little tag: "Lamp 4 of 6". Where is lamp 7?',
    'At night it is the only light up here. Apart from the cigarettes.',
    'Someone has stuck a "Like" sticker on it.',
    'It leans a little. Towards the bench, naturally.',
    'The base is dented. Somebody reversed the cradle into it.',
    'It is on a timer. The timer is on a different timezone.',
    'A spider has built an office in the lamp head.',
    'It flickers when the lift goes past. Spooky.',
    'This lamp has seen every late-night confession up here.',
    'Facilities replaces the bulb every year. Whether it needs it or not.',
    'It is cold to the touch. And so am I, up here.',
    'Somebody has wrapped tinsel round it. Last Christmas. Or the one before.',
    'The light is orange. Like the CEO\'s tan.',
    'Below it, a ring of butts. A shrine.',
    'It hums a little tune. I swear it is the hold music.',
    'A good lamp. It does one job and does it.',
    'It has been painted grey four times. It is still grey.',
    'A sign: "Do not lean". So I do not.',
  ],
};
