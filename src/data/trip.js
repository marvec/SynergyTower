// Business trip text and clients (spec 2026-10-12-business-trip). Pure data, ASCII only (bitmap font).

/** The client behind each trip floor: an invented company, its office look and the room it is proud of. */
export const CLIENTS = {
  10: {
    name: 'Megafreight Logistics',
    short: 'Megafreight',
    dept: 'support', // their pride: a call centre (headset desks)
    look: { carpet: ['#4d6b5c', '#557566'], wall: '#3c574c' },
    ask: 'Their parcel hotline is melting down and they want someone from us on site, today.',
  },
  30: {
    name: 'Goldvault Capital',
    short: 'Goldvault',
    dept: 'finance', // a trading floor
    look: { carpet: ['#6b4b3b', '#755344'], wall: '#4b3a32' },
    ask: 'They are about to sign the biggest deal of the quarter and want a face from us in the room.',
  },
};

/** What the account manager calls out now and then while the trip is still on offer. */
export const TRIP_TEASERS = [
  'Anyone up for a road trip? A client is asking for us.',
  'I need someone to drive out to a client. Today. Ideally in one piece.',
  'The pool car has a full tank and nobody to drive it...',
  'Who here has a driving licence and nerves of steel?',
  'Client visits pay double, you know. Just saying.',
  'The client wants someone on site. Someone who is not me.',
  'Business trip! Free coffee! Leather seats! Any takers?',
  'I have the car keys and three calls at once. Help.',
];

export const TRIP_OFFER = (client) =>
  `"${client.name} just called. ${client.ask} I am stuck on calls: can you take the pool car?"\n` +
  'Drive there in about 3 minutes and beat the checkpoint clock. Then you get 15 minutes in their office: ' +
  'tasks cost the usual coffee but pay double paperclips, and their coffee brewers refill every 2 minutes.\n' +
  'The pool car takes a few dents, but wreck it or arrive late and the deal is off. One chance only.';

/** The account manager afterwards. */
export const TRIP_AFTER = {
  missed: [
    'The client went with another agency. These things happen. To you, mostly.',
    'The pool car is in the body shop. Again.',
    'Let us not mention the business trip in your review.',
  ],
  done: [
    'The client loved you! Well, liked. Tolerated, at least.',
    'They want you back next quarter. I said you are very busy.',
    'Best client visit this year. The bar was low, but still.',
  ],
};

/** The drive. */
export const DRIVE_HELP = 'Up or Space: accelerate. Down: brake. Left/Right: steer. Mouse or touch: hold to drive, the car steers towards the pointer. Radio: T or click it for the next station, M switches it off.';
/** Called out after a crash the car survives (the damage gauge goes up a notch). */
export const DENT_LINES = [
  'THAT WILL BUFF OUT',
  'NOBODY SAW THAT',
  'THE FLEET MANAGER WILL HEAR OF THIS',
  'IT WAS LIKE THAT WHEN I GOT IT',
  'ADD IT TO THE EXPENSES',
  'STILL DRIVES. MOSTLY.',
];
export const LAST_DENT = 'ONE MORE AND THE CAR IS DONE';
/** The car is wrecked (the last crash it could take). */
export const CRASH_LINES = [
  'The pool car is a write-off. So is the deal.',
  'Insurance will want a word. So will your manager.',
  'You hit it. Hard. The client will not be seeing you today.',
  'That tree had been there for 200 years. It is fine. The car is not.',
];
export const LATE_LINES = [
  'Too late: the client has gone to lunch. With a competitor.',
  'The meeting started without you. And ended without you.',
  'The client waited 4 minutes, which is their record. You missed it.',
];
export const ARRIVE_LINES = [
  'Parked across two spaces. Nobody will notice.',
  'You made it, and the car is mostly the same shape.',
  'Right on time. The receptionist looks impressed.',
];
export const ROAD_SIGNS = ['CLIENT 12 KM', 'NO U-TURNS', 'SPEED CAMERAS', 'BUSINESS PARK'];

/** The client's staff when you talk to them. */
export const CLIENT_NPC_LINES = [
  'You must be the consultant. Coffee is that way.',
  'Are you from the agency? We love agencies. Mostly.',
  'Our CEO says your CEO says hi.',
  'Visitor lanyard! How official. Do not lose it.',
  'Your tower has 40 floors? Ours has one. A big one.',
  'Please do not touch the fountain. It is load-bearing.',
  'We do synergy here too, but in a different font.',
  'This open plan is so open we lost a whole team in it.',
  'The boardroom has a better view than the CEO.',
  'Our brewers refill every 2 minutes. It is our competitive edge.',
  'If anyone asks, you have been here since nine.',
  'We pay your company double for this. Make it look hard.',
];

/** The wrap-up card when the visit is over. */
export const WRAP_LINES = [
  'The client is thrilled. Someone get the invoice ready.',
  'They walked you to the door. That is either respect or relief.',
  'A firm handshake, a branded pen, a long drive home.',
];
