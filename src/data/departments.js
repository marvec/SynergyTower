// Department content: 8 departments × 5 floors = 40 floors. Pure data.
// carpet: [base, alt] tile colours; wall: wall top colour; special: the department room type.
export const DEPARTMENTS = [
  {
    id: 'lobby',
    name: 'Lobby & Mailroom',
    carpet: ['#8f8a7e', '#9a958a'],
    wall: '#5b5f6b',
    special: 'mailroom',
    music: 'lobby',
    titles: ['Unpaid Intern', 'Paid Intern', 'Mailroom Clerk', 'Reception Associate', 'Facilities Coordinator'],
    floorNames: ['Grand Lobby', 'Mailroom', 'Badge Office', 'Visitor Center', 'Facilities'],
    npcLines: [
      'Badge says "Visitor". Bold choice.',
      'The revolving door ate my lunch again.',
      'Package for... "Occupant"? That might be you.',
      'Welcome! The elevator only goes up if you deserve it.',
      'I sorted 400 letters today. 3 were for me. All spam.',
      'Rumour says the CEO has a slide in the penthouse.',
      'Fun fact: the lobby fountain is our biggest asset.',
      'Have you tried turning the intern off and on again?',
    ],
  },
  {
    id: 'support',
    name: 'Customer Support',
    carpet: ['#5f7f8f', '#6a8a99'],
    wall: '#4a5566',
    special: 'callcenter',
    music: 'office',
    titles: ['Support Agent I', 'Support Agent II', 'Escalation Specialist', 'Ticket Whisperer', 'Support Team Lead'],
    floorNames: ['Call Center', 'Ticket Queue', 'Escalations', 'Knowledge Base', 'Support HQ'],
    npcLines: [
      'Have you tried clearing your cache? Your life cache?',
      'Your call is important to us. Not to me, but to us.',
      'I closed 80 tickets. 81 opened. Circle of life.',
      'Customer asked if we can "make the internet faster".',
      'My headset has been on so long it is now part of my skull.',
      'Ticket #40421: "printer is sad". Same, printer. Same.',
      'Hold music is just my soul, on loop.',
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    carpet: ['#8f6a4f', '#99755a'],
    wall: '#5a4a44',
    special: 'bullpen',
    music: 'office',
    titles: ['Sales Development Rep', 'Account Executive', 'Senior Account Executive', 'Key Account Manager', 'Regional Sales Director'],
    floorNames: ['Cold Call Corner', 'Pipeline Plaza', 'Quota Quarters', 'Key Accounts', 'Sales Summit'],
    npcLines: [
      'Always Be Closing. Except the fridge door. Close that.',
      'I just sold a pen to a pen salesman.',
      'Quarter ends Friday. Panic begins Monday.',
      'My pipeline is mostly hopes and calendar invites.',
      'Ring the gong! No wait, that was the fire alarm.',
      'Discount? I can do 0% off, but with enthusiasm.',
      'Let me circle back to you on that circle back.',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    carpet: ['#8a5f8a', '#946a94'],
    wall: '#55465a',
    special: 'studio',
    music: 'office',
    titles: ['Marketing Coordinator', 'Content Strategist', 'Brand Evangelist', 'Growth Hacker', 'Head of Synergy Marketing'],
    floorNames: ['Brand Lab', 'Content Farm', 'Social Hub', 'Growth Garage', 'Campaign Tower'],
    npcLines: [
      'We pivoted the font. Engagement up 0.2%.',
      'Can we make the logo bigger? And smaller? At once?',
      'Our new slogan: "Synergy. Now with more synergy."',
      'I A/B tested my lunch. B was a sandwich.',
      'The brand guidelines are 400 pages. The brand is a dot.',
      'Let us go viral. Not like last flu season.',
      'Have you seen our mission statement? Neither have I.',
    ],
  },
  {
    id: 'it',
    name: 'IT & Engineering',
    carpet: ['#4f6a5f', '#5a7569'],
    wall: '#3f4a48',
    special: 'serverroom',
    music: 'tech',
    titles: ['Helpdesk Technician', 'Junior Developer', 'Senior Developer', 'DevOps Wizard', 'Principal Architect'],
    floorNames: ['Helpdesk', 'Code Mines', 'Bug Tracker', 'Server Farm', 'Architecture Loft'],
    npcLines: [
      'It works on my machine. Ship my machine?',
      'I deployed on a Friday. I live here now.',
      'The cloud is just someone else\'s basement.',
      'Have you tried turning it off and on again?',
      'My code has no bugs. Only undocumented features.',
      'We migrated to microservices. Now everything is micro-broken.',
      'Password must contain a haiku and a dinosaur.',
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    carpet: ['#5f6a8f', '#6a7599'],
    wall: '#444a5f',
    special: 'tradingdesk',
    music: 'tech',
    titles: ['Junior Accountant', 'Financial Analyst', 'Senior Controller', 'Treasury Manager', 'Director of Finance'],
    floorNames: ['Accounts Payable', 'Ledger Lane', 'Audit Alcove', 'Treasury', 'Finance Spire'],
    npcLines: [
      'The numbers add up. I just do not like the total.',
      'Expense report: "Coffee, emotional support". Rejected.',
      'I see spreadsheets when I close my eyes.',
      'We are not over budget. The budget is under us.',
      'EBITDA? Every Body Is Tired, Darling, Again.',
      'Rounding errors are just numbers with ambition.',
      'Pivot tables are the only pivots I trust.',
    ],
  },
  {
    id: 'legalhr',
    name: 'Legal & HR',
    carpet: ['#6a6a5a', '#757565'],
    wall: '#4f4f45',
    special: 'archive',
    music: 'office',
    titles: ['HR Generalist', 'Talent Acquisition Partner', 'Compliance Officer', 'Corporate Counsel', 'VP People & Culture'],
    floorNames: ['People Ops', 'Talent Atrium', 'Compliance Corner', 'Legal Chambers', 'Culture Deck'],
    npcLines: [
      'Please do not microwave fish. It is in the handbook.',
      'This conversation may be recorded for training purposes.',
      'Mandatory fun is at 4pm. Attendance is mandatory.',
      'Legally I cannot say hello without a disclaimer.',
      'We are a family. A family with an org chart.',
      'Your vacation request is pending since 2019.',
      'Terms and conditions apply. To everything. Forever.',
    ],
  },
  {
    id: 'exec',
    name: 'Executive Suite',
    carpet: ['#7a2f35', '#853a40'],
    wall: '#3a2a2e',
    special: 'boardroom',
    music: 'exec',
    titles: ['Vice President', 'Senior Vice President', 'Executive Vice President', 'Chief Operating Officer', 'Chief Executive Officer'],
    floorNames: ['VP Row', 'Senior Suites', 'Executive Lounge', 'Ops Command', 'CEO Penthouse'],
    npcLines: [
      'Let us take this offline. And by offline I mean golf.',
      'My calendar has meetings about my meetings.',
      'I do not read emails. I have people for that.',
      'Think outside the box. The box is a corner office.',
      'We need more synergy. Define it? No.',
      'The board wants growth. I want a nap.',
      'Our quarterly vision is 20/20. Hindsight, that is.',
    ],
  },
];

export function departmentForFloor(floor) {
  return DEPARTMENTS[Math.min(DEPARTMENTS.length - 1, Math.floor((floor - 1) / 5))];
}

export function titleForFloor(floor) {
  const d = departmentForFloor(floor);
  return d.titles[(floor - 1) % 5];
}

export function floorName(floor) {
  const d = departmentForFloor(floor);
  return d.floorNames[(floor - 1) % 5];
}
