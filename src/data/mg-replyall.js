// Reply-All Apocalypse content: thread topics per department, reply-all snippets, senders and the
// important (starred) mails that must survive. ASCII only; rows are ~260 px wide (~50 chars).

/** The original company-wide mail that started it all, per department. */
export const TOPICS = {
  default: ['Printer on 3rd floor', 'Who took my yogurt?', 'Fire drill at 2pm', 'Lost: blue umbrella'],
  lobby: ['Who parked in the fire lane?', 'Lost: one (1) visitor badge', 'Revolving door stuck again', 'Package for "Steve"'],
  support: ['Ticket queue is on fire', 'New hold music poll', 'Who unplugged the phones?', 'Headset hygiene reminder'],
  sales: ['Who took my stapler?', 'Q3 leaderboard (final)', 'Gong ringing etiquette', 'Client gift ideas?'],
  marketing: ['New logo feedback', 'Font of the month vote', 'Rebrand rebrand meeting', 'Who ordered 9000 pens?'],
  it: ['Server down??', 'Planned outage tonight', 'Do NOT click that link', 'Password rotation day'],
  finance: ['Expense policy update', 'Budget freeze (again)', 'Who owns cost center 42?', 'Invoice template v12'],
  legalhr: ['Mandatory fun day RSVP', 'Updated dress code', 'Birthday cake schedule', 'Policy 4.2.1 reminder'],
  exec: ['Board meeting moved', 'Offsite location vote', 'Vision 2030 deck', 'Parking spot reshuffle'],
};

/** What colleagues reply to the whole company. */
export const REPLIES = [
  'Please remove me from this list',
  'STOP REPLYING ALL',
  '+1',
  'Who is this?',
  'Unsubscribe',
  'Me too!',
  'Sent from my phone',
  'Please stop replying all',
  'Why am I on this?',
  'Unsubscribe me too',
  'Can everyone stop?',
  'Replying all to say stop replying all',
  'Thanks!',
  'Ok',
  'Same',
  "I'm not even in this department",
  'Out of office until May',
  'This is not my printer',
  'lol',
  'Is this a phishing test?',
  'Agreed.',
  'Wrong Gary, sorry',
  'REMOVE ME',
  'Please use BCC next time',
  'Who approved this list?',
  'I muted it. Still getting it.',
  'Do not reply all (sent to all)',
  'Can IT fix this?',
  'IT here: please stop.',
  'Sent from my smart fridge',
  'Is lunch still on?',
  'Congrats on the baby?',
  'Sorry, my cat walked on the keyboard',
  'Per my last reply-all...',
  'Happy birthday Linda!',
  'New phone, who dis',
  'Recall: this message',
  'Can we take this offline?',
  'Has anyone tried unplugging it?',
  'STOP!!!1',
  'I am on vacation, please stop',
  'Unsubscribe (third request)',
  'Adding my manager for visibility',
  'Looping in the whole Berlin office',
  'Can someone summarize this thread?',
  'Asking for a friend: what is this?',
  'Please advise.',
  'Thoughts?',
];

/** Colleagues who reply all. Keep each name short (column is ~66 px wide). */
export const SENDERS = [
  'Gary F.', 'Linda K.', 'Intern #4', 'Bob (Sales)', 'Deb in Acct', 'Steve 2', 'Wrong Gary', 'Night Guard',
  'Karen M.', 'Facilities', 'Mike R.', 'Temp 0042', 'Pat (Legal)', 'Old Laptop', 'Dave (IT)', 'Raj P.',
  'Sue at Desk 9', 'Tom H.', 'Mia (Berlin)', 'Ex-employee', 'Printer Guy', 'Ann B.', 'Kevin', 'Not Kevin',
];

/** Important mail: star icon, coloured sender, never "RE:". Lookalike junk reuses these subjects. */
export const VIPS = [
  { sender: 'CEO', color: '#c0392b', subjects: ['All-hands: be there', 'Quick favour', 'Your idea was great'] },
  { sender: 'HR Team', color: '#7a3bb6', subjects: ['Bonus info', 'Your payslip', 'Promotion paperwork'] },
  { sender: 'Client', color: '#2f8a3a', subjects: ['Signed contract', 'PO approved', 'Renewal: yes!'] },
  { sender: 'Your Boss', color: '#1f6fb6', subjects: ['Review at 3pm', 'Need the deck', 'Good job today'] },
];

/** Lines shown when you delete something important. */
export const OOPS = ['That was the CEO!', 'Bonus? Deleted.', 'Client mail gone!', 'Your boss saw that.', 'Not that one!'];
