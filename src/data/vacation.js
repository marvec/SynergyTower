// Vacation text (spec 2026-10-13-vacation). Pure data, ASCII only (bitmap font).

export const HOTEL_NAME = 'Paradise Palms Resort';

/** The holiday activities: one mini-game each, where it is in the hotel and what the card says. */
export const ACTIVITIES = [
  { game: 'sleep', title: 'Sleep in', where: 'Your suite', blurb: 'A king-size bed, blackout curtains and no alarm. Count sheep until you drift off.' },
  { game: 'buffet', title: 'Dinner buffet', where: 'Restaurant', blurb: 'All you can eat, all inclusive. Touch anything on the buffet and it is yours.' },
  { game: 'beachball', title: 'Pool ball', where: 'Pool', blurb: 'Keep the beach ball out of the water. Nobody is keeping score. Well, you are.' },
  { game: 'swim', title: 'Swim to the buoy', where: 'Jetty', blurb: 'Warm water, clear as glass. Swim out to the buoy and back.' },
  { game: 'sunbathe', title: 'Sunbathe', where: 'Beach', blurb: 'Golden brown is the goal. Turn over before you go lobster red.' },
  { game: 'cocktail', title: 'Pool bar cocktail', where: 'Tiki bar', blurb: 'The barman throws the fruit, you catch it in the glass. Umbrella included.' },
  { game: 'massage', title: 'Massage', where: 'Spa cabana', blurb: 'A year of spreadsheets lives in your shoulders. Find the knots and let them go.' },
  { game: 'sandcastle', title: 'Sandcastle', where: 'Beach', blurb: 'Build the tallest sandcastle on the beach, one bucket at a time.' },
];

/** What your manager calls out now and then on floor 20 while today's holiday is still on offer. */
export const BOSS_TEASERS = [
  'Your leave balance is looking very healthy. Suspiciously healthy.',
  'HR says some of us have not taken a holiday since the merger.',
  'I just got back from the beach. You should try it sometime.',
  'Burnout is not a KPI, you know. Not yet, anyway.',
  'There is a resort with an all-inclusive buffet. I am just saying.',
  'If anyone wants to request leave, my door is open. Today only.',
  'Out of office. Three beautiful words.',
  'You look tired. Have you considered a pina colada?',
];

export const VACATION_OFFER = (cost) =>
  '"You have not taken a single day off since you started. HR keeps sending me charts. I can sign a leave request ' +
  'for you, but the company only covers the paperwork."\n' +
  `${cost} paperclips buy you 15 minutes at the ${HOTEL_NAME}, ultra all inclusive. Every holiday activity you enjoy ` +
  'there sends you back with an extra coffee. Check out early through the hotel exit any time.';

/** Your manager afterwards. */
export const BOSS_AFTER = [
  'Nice tan. Now, about those deadlines...',
  'Welcome back! Your inbox missed you. A lot.',
  'One holiday a day is the company policy. I wrote it myself.',
  'I hope you did not check your email. I did. For you.',
];

/** Guests and staff at the hotel. */
export const HOTEL_LINES = [
  'Another pina colada? It is all inclusive!',
  'I have been on this sun lounger since Tuesday.',
  'The buffet has a chocolate fountain. Two of them.',
  'Do not tell my boss where I am.',
  'The sea is so warm today. Like a bath with fish.',
  'I booked a massage for every hour. Why not?',
  'Room service brought me a towel swan. I named him Gary.',
  'Out of office reply: ON. Phone: in the safe.',
  'The pool bar opens at nine. In the morning.',
  'I tried to read a book. I fell asleep on page two.',
  'Is it Monday? It does not matter here.',
  'My kids are at the kids club. I am at the adults club.',
  'The lifeguard waved at me. I waved back. We are friends now.',
  'Five stars, and the sixth one is the sunset.',
  'The wifi is weak here. That is the best feature.',
  'Sunscreen first. Trust me, I learned the hard way.',
];

export const HOTEL_WRAP_LINES = [
  'The taxi to the airport is waiting. So is your inbox.',
  'You leave a little browner, a little calmer and a lot more caffeinated.',
  'The hotel staff wave goodbye. The towel swan looks sad.',
];
