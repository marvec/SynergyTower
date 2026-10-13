// Colleague identities (name + role shown in speech bubbles) and the lines for the CEO's personnel decisions.
export const FIRST_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Jamie', 'Robin', 'Avery',
  'Priya', 'Ken', 'Olga', 'Mateo', 'Aisha', 'Lars', 'Mei', 'Tomas', 'Fatima', 'Igor',
  'Chloe', 'Diego', 'Hana', 'Felix', 'Zara', 'Omar', 'Greta', 'Raj', 'Sofia', 'Kofi',
  'Linda', 'Gary', 'Brenda', 'Kevin', 'Karen', 'Doug', 'Pam', 'Stan', 'Wendy', 'Barry',
  'Nina', 'Pavel', 'Ingrid', 'Yusuf', 'Elena', 'Bjorn', 'Lucia', 'Arjun', 'Petra', 'Hugo',
  'Martina', 'Jakub', 'Tereza', 'Ondrej', 'Klara', 'Vojta', 'Ayumi', 'Chidi', 'Marta', 'Ivo',
];

// Whose figure wears a skirt (src/scenes/floorWorld.js npcLook). Names in neither list are gender-neutral: either figure.
export const WOMEN_NAMES = [
  'Priya', 'Olga', 'Aisha', 'Mei', 'Fatima', 'Chloe', 'Hana', 'Zara', 'Greta', 'Sofia', 'Linda', 'Brenda', 'Karen',
  'Pam', 'Wendy', 'Nina', 'Ingrid', 'Elena', 'Lucia', 'Petra', 'Martina', 'Tereza', 'Klara', 'Ayumi', 'Marta',
];
export const MEN_NAMES = [
  'Ken', 'Mateo', 'Lars', 'Tomas', 'Igor', 'Diego', 'Felix', 'Omar', 'Raj', 'Kofi', 'Gary', 'Kevin', 'Doug', 'Stan',
  'Barry', 'Pavel', 'Yusuf', 'Bjorn', 'Arjun', 'Hugo', 'Jakub', 'Ondrej', 'Vojta', 'Ivo',
];

export const LAST_NAMES = [
  'Smith', 'Novak', 'Kowalski', 'Nguyen', 'Garcia', 'Okafor', 'Svoboda', 'Tanaka', 'Muller', 'Rossi',
  'Johansson', 'Patel', 'Ivanova', 'Dvorak', 'Kim', 'Haddad', 'Fischer', 'Silva', 'Horvat', 'Larsen',
  'Moreau', 'Chen', 'Kaur', 'Schmidt', 'Popescu', 'Mendez', 'Nakamura', 'Brown', 'Cerny', 'Jensen',
  'Ortiz', 'Wagner', 'Petrov', 'Adeyemi', 'Kral', 'Lindqvist', 'Murphy', 'Santos', 'Weber', 'Yilmaz',
  'Spreadsheetson', 'McSynergy', 'Overtime', 'Deckard', 'Bottomline', 'Quarterly', 'Pipeline', 'Bandwidth',
];

// Roles per department (each fits a speech bubble: <= 26 characters).
export const ROLES = {
  lobby: ['Receptionist', 'Mailroom Clerk', 'Security Guard', 'Facilities Manager', 'Badge Office Clerk', 'Concierge', 'Parcel Logistics Lead', 'Chief Greeting Officer', 'Revolving Door Operator'],
  support: ['Support Agent', 'Ticket Triage Lead', 'Escalation Engineer', 'Knowledge Base Writer', 'Customer Happiness Hero', 'Hold Music Curator', 'Live Chat Ninja', 'Refund Gatekeeper'],
  sales: ['Account Executive', 'Sales Development Rep', 'Deal Closer', 'Pipeline Manager', 'Regional Sales Lead', 'Cold Call Specialist', 'Upsell Evangelist', 'Quota Survivor'],
  marketing: ['Brand Manager', 'Content Strategist', 'Social Media Lead', 'SEO Wizard', 'Growth Hacker', 'Copywriter', 'Chief Vibes Officer', 'Hashtag Architect'],
  it: ['Backend Developer', 'Frontend Developer', 'DevOps Engineer', 'Sysadmin', 'QA Engineer', 'Scrum Master', 'Data Scientist', 'Helpdesk Technician', 'Cloud Whisperer'],
  finance: ['Accountant', 'Financial Analyst', 'Auditor', 'Controller', 'Payroll Specialist', 'Treasury Analyst', 'Spreadsheet Sorcerer', 'Budget Guardian'],
  legalhr: ['Corporate Lawyer', 'Paralegal', 'Compliance Officer', 'Recruiter', 'HR Business Partner', 'Talent Acquisition Lead', 'Culture Champion', 'Policy Wordsmith'],
  exec: ['Chief Financial Officer', 'Chief Operating Officer', 'VP of Synergy', 'Executive Assistant', 'Chief Strategy Officer', 'SVP of Vision', 'Board Liaison', 'Chief Innovation Officer'],
};

// One-line personnel file notes shown in the CEO's decision dialog.
export const FILE_NOTES = [
  'Brings donuts on Fridays.',
  'Unclear what they actually do.',
  'Owns 400 sticky notes. Uses 3.',
  'Replied-all to the whole company (2019).',
  'Strong LinkedIn presence.',
  'Mostly in meetings. Possibly lives there.',
  'Microwaved fish. Twice.',
  'Has a standing desk. Mentions it daily.',
  'Never once muted on a call.',
  'Fixed the printer. Legend.',
  'Labels everything in the fridge.',
  'Says "synergy" unironically.',
  'Knows where the good stapler is.',
  'Organised the office fantasy league.',
  'Out of office since March.',
  'Their plant is the healthiest on the floor.',
  'Ate the CEO birthday cake. Allegedly.',
  'Wins every thermostat war.',
  'Volunteered for the fire drill. Twice.',
  'Has a spreadsheet tracking spreadsheets.',
];

// What a colleague says when the CEO fires them.
export const FIRED_LINES = [
  'But I just bought a standing desk!',
  'Can I at least keep the stapler?',
  'I will be updating my LinkedIn.',
  'Fine. I was going to quit anyway. Probably.',
  'Is this about the fridge incident?',
  'You will hear from my lawyer. Once I can afford one.',
  'At least I get to leave before five.',
  'My plant is coming with me.',
  'I knew I should not have replied-all.',
  'Does this mean my meetings are cancelled? Yes!',
  'Tell the coffee machine I loved it.',
  'Do I still get the free pens?',
  'This could have been an email.',
  'Freedom! Wait... health insurance...',
  'I would like to circle back on this decision.',
  'Can we take this offline? Like, forever?',
  'I have so much unused vacation. Had.',
  'Who will water the plastic plant now?',
  'I was this close to inbox zero.',
  'Okay. I am taking the good chair.',
];

// What a colleague says when the CEO decides to keep them.
export const KEPT_LINES = [
  'Thank you! I will synergize twice as hard.',
  'Phew. Back to pretending to be busy.',
  'I will not let you down. Probably.',
  'My mortgage thanks you.',
  'I will name my next spreadsheet after you.',
  'You will not regret this. Much.',
  'Best. One-on-one. Ever.',
  'I was never worried. I was very worried.',
  'I will stop microwaving fish. Promise.',
  'Can I put this in my performance review?',
];
