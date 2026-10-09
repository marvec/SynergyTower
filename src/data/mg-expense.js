// Expense Fraud Detective content. Each receipt:
//   { merchant, lines: [[text, amount]], reason, fraud, tell, day?, dept? }
// `day` forces the weekday printed on the receipt (otherwise a random Mon-Fri), `dept` makes the receipt more
// likely in that department. `tell` is the one-line verdict shown after the call. ASCII only.
// Fit: merchant <= 30 chars, line text <= 22 chars, reason wraps to <= 3 lines of ~32 chars, tell <= 56 chars.
export const RECEIPTS = [
  // --- Legit ---
  { merchant: 'OfficeMax Depot', lines: [['Printer toner x2', 64], ['Paper, 5 reams', 22.5]], reason: 'Printer ran dry during the Q3 report.', fraud: false, tell: 'Toner: boring, but real.' },
  { merchant: 'Bistro Bellini', day: 'Tue', lines: [['Lunch menu x2', 38], ['Sparkling water', 4.5]], reason: 'Client lunch with Acme, 2 people.', fraud: false, tell: 'Two people, a Tuesday, a sane bill. Legit.', dept: 'sales' },
  { merchant: 'City Taxi Co.', lines: [['Ride: airport-office', 42]], reason: 'Back from the Berlin trade fair.', fraud: false, tell: 'A taxi from the airport. Fine.' },
  { merchant: 'Rail Express', lines: [['2nd class return', 89]], reason: 'Visit to the Leeds branch.', fraud: false, tell: 'Second class, even. A hero.' },
  { merchant: 'Hotel Grey Stay', lines: [['1 night, single', 112], ['Breakfast', 14]], reason: 'Overnight for the supplier audit.', fraud: false, tell: 'One night, one breakfast. Approved.', dept: 'finance' },
  { merchant: 'CloudSoft Inc.', lines: [['Team license, 1 mo', 49]], reason: 'Design tool for the new campaign.', fraud: false, tell: 'A real subscription for real work.', dept: 'marketing' },
  { merchant: 'Kopi Corner', lines: [['Coffee x3', 9.6]], reason: 'Coffee for the onboarding session.', fraud: false, tell: 'Three coffees at coffee prices.' },
  { merchant: 'PostNow Courier', lines: [['Courier: contract', 18.4]], reason: 'Signed contract to the client, urgent.', fraud: false, tell: 'Couriered contracts are legit.', dept: 'legalhr' },
  { merchant: 'TechHub Store', lines: [['USB-C adapter', 24.99]], reason: 'The projector would not talk to my laptop.', fraud: false, tell: 'Every office needs one more dongle.', dept: 'it' },
  { merchant: 'Print & Bind', lines: [['Board deck x12', 76]], reason: 'Printed decks for the board meeting.', fraud: false, tell: 'Board decks: real, sadly.', dept: 'exec' },
  { merchant: 'Mileage Log', lines: [['Mileage: 84 km', 25.2]], reason: 'Drove to the client site and back.', fraud: false, tell: '84 km for a site visit. Fine.', dept: 'sales' },
  { merchant: 'Conference Expo', lines: [['Ticket: SaaS Summit', 299]], reason: 'Pre-approved by my manager in March.', fraud: false, tell: 'Pre-approved conference. OK.', dept: 'sales' },
  { merchant: 'Pizza Napoli', day: 'Thu', lines: [['Pizza x4', 48]], reason: 'Team worked late on the release.', fraud: false, tell: 'Late-night release pizza is sacred.', dept: 'it' },
  { merchant: 'Books & Co.', lines: [['Tax Code 2026', 59]], reason: 'Reference for the annual audit.', fraud: false, tell: 'A tax book. Thrilling. Legit.', dept: 'finance' },
  { merchant: 'Parking Central', lines: [['Parking, 3 h', 12]], reason: 'Meeting at the bank downtown.', fraud: false, tell: 'Three hours of parking. Fine.', dept: 'finance' },
  { merchant: 'Flowers by Ann', lines: [['Get-well bouquet', 35]], reason: 'For Dana in accounting (surgery).', fraud: false, tell: 'Get-well flowers are allowed.', dept: 'legalhr' },
  { merchant: 'Sky Air', lines: [['Economy PRG-LON', 184]], reason: 'Client kickoff in London.', fraud: false, tell: 'Economy class! A true team player.', dept: 'exec' },
  { merchant: 'Bistro Bellini', day: 'Wed', lines: [['Dinner x3', 96]], reason: 'Dinner with 2 clients from Globex.', fraud: false, tell: 'Three people, a fair bill. Legit.', dept: 'sales' },
  { merchant: 'Snack Co.', lines: [['Fruit basket', 28]], reason: 'Welcome basket for the new hires.', fraud: false, tell: 'Fruit for new hires. Approved.' },
  { merchant: 'SignPro', lines: [['Trade fair banner', 140]], reason: 'Booth banner for the expo.', fraud: false, tell: 'Booth banners are a real expense.', dept: 'marketing' },
  { merchant: 'Coffee Lab', lines: [['Latte', 4.2]], reason: 'Coffee during a long client call.', fraud: false, tell: 'A latte at a latte price.' },
  { merchant: 'HelpDesk Supply', lines: [['Headset', 39], ['Ear cushions x2', 8]], reason: 'Old headset broke mid-call.', fraud: false, tell: 'Support runs on headsets.', dept: 'support' },
  { merchant: 'Locksmith Lou', lines: [['Lobby door repair', 95]], reason: 'Front door would not lock.', fraud: false, tell: 'A door that locks. Revolutionary.', dept: 'lobby' },
  { merchant: 'Paper Planet', lines: [['Visitor badges x200', 30]], reason: 'We ran out of visitor badges.', fraud: false, tell: 'Badges for visitors. Legit.', dept: 'lobby' },

  // --- Fraud ---
  { merchant: 'Aqua Thrills', day: 'Sat', lines: [['Jet ski rental, 1 pc', 380]], reason: 'Team-building.', fraud: true, tell: 'Jet skis are not team-building.' },
  { merchant: 'Bistro Bellini', lines: [['Dinner x47', 2350]], reason: 'Client dinner, 47 people.', fraud: true, tell: '47 clients? You have three.', dept: 'sales' },
  { merchant: 'Marina Deluxe', lines: [['Yacht, 1x', 45000]], reason: 'Office supplies.', fraud: true, tell: 'A yacht is not office supplies.' },
  { merchant: 'Le Petit Chateau', day: 'Sun', lines: [['Brunch x2', 140], ['Champagne', 90]], reason: 'Client meeting.', fraud: true, tell: 'A client meeting on a Sunday? With champagne?' },
  { merchant: 'Kopi Corner', lines: [['Latte, large', 400]], reason: 'Needed caffeine for the deadline.', fraud: true, tell: 'No latte costs 400.' },
  { merchant: 'Karaoke Palace', lines: [['Private room, 4 h', 260], ['Tambourine', 15]], reason: 'Presentation skills training.', fraud: true, tell: 'Karaoke is not training.' },
  { merchant: 'Mileage Log', lines: [['Mileage: 9,000 km', 2700]], reason: 'Trip to the post office.', fraud: true, tell: 'The post office is 2 km away.' },
  { merchant: 'PetPalace', lines: [['Dog grooming', 85]], reason: 'Office morale (my dog).', fraud: true, tell: 'Your dog is not on the payroll.' },
  { merchant: 'Ski Resort Alpina', day: 'Sat', lines: [['Lift pass, 7 days', 420]], reason: 'Strategy offsite (solo).', fraud: true, tell: 'A solo ski week is a vacation.', dept: 'exec' },
  { merchant: 'TechHub Store', lines: [['Game console', 499], ['Controllers x2', 120]], reason: 'For testing our spreadsheets.', fraud: true, tell: 'Spreadsheets do not need a console.', dept: 'it' },
  { merchant: 'Lucky Star Casino', lines: [['Chips', 1000]], reason: 'Risk management research.', fraud: true, tell: 'Gambling is not risk research.', dept: 'finance' },
  { merchant: 'Gold & Bling', lines: [['Gold watch', 3200]], reason: 'Better time management.', fraud: true, tell: 'A gold watch is not time management.' },
  { merchant: 'City Taxi Co.', lines: [['Ride: home-office', 18], ['Tip', 180]], reason: 'Daily commute.', fraud: true, tell: 'A 180 tip on an 18 ride? And commutes are on you.' },
  { merchant: 'Burger Barn', day: 'Sat', lines: [['Kids menu x3', 21], ['Birthday cake', 30]], reason: 'Working lunch.', fraud: true, tell: "A kid's birthday is not a working lunch." },
  { merchant: 'Hotel Grand Lux', lines: [['Suite, 5 nights', 4800], ['Minibar', 600]], reason: 'Day trip to the branch.', fraud: true, tell: 'Five nights in a suite for a day trip?', dept: 'exec' },
  { merchant: 'Office Supply Co.', lines: [['Stapler', 8], ['Massage chair', 2400]], reason: 'Ergonomics.', fraud: true, tell: 'The stapler, sure. The massage chair, no.' },
  { merchant: 'Sky Air', lines: [['First class PRG-BRNO', 900]], reason: 'Meeting in Brno (2 h by train).', fraud: true, tell: 'A first-class flight for a train ride.', dept: 'exec' },
  { merchant: 'Ink Tattoo Studio', lines: [['Company logo tattoo', 350]], reason: 'Brand awareness.', fraud: true, tell: 'Tattoos are not a brand strategy.', dept: 'marketing' },
  { merchant: 'Selfie Studio', lines: [['Selfies, 200 pcs', 1500]], reason: 'Social media campaign (starring me).', fraud: true, tell: 'Selfies of yourself are not a campaign.', dept: 'marketing' },
  { merchant: 'Rail Express', lines: [['Train to Hawaii', 2100]], reason: 'Client visit.', fraud: true, tell: 'There is no train to Hawaii.' },
  { merchant: 'Lemonade Stand', lines: [['Lemonade', 600]], reason: 'Vendor negotiation (my nephew).', fraud: true, tell: 'Your nephew is not a vendor.', dept: 'finance' },
  { merchant: 'Golf Club Elite', day: 'Sun', lines: [['Green fee x4', 480]], reason: 'Sales pipeline review.', fraud: true, tell: 'Sunday golf is not a pipeline review.', dept: 'sales' },
  { merchant: 'Party Planet', lines: [['Bounce castle', 350]], reason: 'Quarterly planning session.', fraud: true, tell: 'Nobody plans a quarter in a bounce castle.' },
  { merchant: 'Pharma Plus', lines: [['Hangover kit', 19.99]], reason: 'Recovery after the client party.', fraud: true, tell: 'Hangovers are not reimbursable.', dept: 'sales' },
  { merchant: 'City Police', lines: [['Speeding fine', 240]], reason: 'I was late for a meeting.', fraud: true, tell: 'Fines are your own problem.' },
  { merchant: 'Salon Vogue', lines: [['Haircut + colour', 180]], reason: 'Looking sharp for the board.', fraud: true, tell: 'Your hair is not a business asset.', dept: 'exec' },
  { merchant: 'Rocket Tours', lines: [['Space flight deposit', 25000]], reason: 'Thinking outside the box.', fraud: true, tell: 'Space is very outside the box. Rejected.', dept: 'exec' },
  { merchant: 'Crypto Kiosk', lines: [['MoonCoin', 5000]], reason: 'Treasury diversification.', fraud: true, tell: 'That is not a treasury strategy.', dept: 'finance' },
  { merchant: 'Server Supply', lines: [['Server rack', 1200]], reason: 'For my home office (gaming).', fraud: true, tell: 'You literally wrote "gaming".', dept: 'it' },
  { merchant: 'Fancy Pens Ltd.', lines: [['Gold fountain pen', 900]], reason: 'To sign one NDA.', fraud: true, tell: 'A 900 pen to sign one NDA?', dept: 'legalhr' },
  { merchant: 'Spa Serenity', lines: [['Full-day spa', 320]], reason: 'Recovering from a support call.', fraud: true, tell: 'One rough call is not a spa day.', dept: 'support' },
  { merchant: 'Hot Tub World', lines: [['Hot tub, 6 seats', 5400]], reason: 'Lobby waiting area upgrade.', fraud: true, tell: 'Visitors do not need a hot tub.', dept: 'lobby' },
  { merchant: 'Pizza Napoli', day: 'Sun', lines: [['Pizza x1', 12], ['Movie rental', 6]], reason: 'Overtime (at home).', fraud: true, tell: 'Sunday pizza and a movie is a night in.' },
];

/** Who submitted the expense report. */
export const SUBMITTERS = [
  'J. Smith', 'K. Novak', 'Brad (Sales)', 'Tiffany R.', 'Chad V.', 'P. Dvorak', 'Gary F.', 'Linda K.',
  'M. Chen', 'VP Synergy', 'Intern #4', 'R. Patel', 'S. Okafor', 'D. Muller', 'Big Tony', 'A. Garcia',
];

/** Verdict feedback prefixes. */
export const RIGHT_LINES = ['Correct!', 'Sharp eye!', 'Audited!', 'Nailed it!', 'Good call!'];
export const WRONG_LINES = ['Wrong!', 'Oops!', 'Audit failed!', 'Finance is sad.'];
