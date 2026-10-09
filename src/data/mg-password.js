// Password Policy content: word lists the rules draw from and IT's running commentary. Pure data.
export const FRUITS = ['kiwi', 'fig', 'plum', 'mango', 'guava', 'apple', 'pear', 'lime', 'lemon', 'melon', 'peach', 'grape', 'date'];
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const COFFEE = ['tall', 'grande', 'venti'];
export const ANIMALS = ['moo', 'oink', 'baa', 'woof', 'quack', 'meow'];
export const VALUES = ['TRUST', 'BOLD', 'AGILE'];

// Department word for the "credit" rule: [word, punchline]. Upper-case and checked case-sensitively.
export const DEPT_WORDS = {
  lobby: ['VIP', 'Visitors must feel special.'],
  support: ['TICKET', 'Or it never happened.'],
  sales: ['ABC', 'Always Be Closing.'],
  marketing: ['BRAND', 'Brand awareness is key.'],
  it: ['IT', 'IT needs the credit.'],
  finance: ['ROI', 'Finance wants a return.'],
  legalhr: ['HR', 'HR is watching.'],
  exec: ['CEO', 'The CEO asked nicely.'],
};

// Shown in the status line each time a new rule is appended.
export const IT_QUIPS = [
  'Security says hi.',
  'This one is mandatory per ISO 9001-ish.',
  'Compliance just walked in.',
  'New rule, fresh from a webinar.',
  'Approved by a committee of seven.',
  'Our auditor insisted.',
  'The intern found this on a forum.',
  'Hackers hate this one trick.',
  'Legal added a small amendment.',
  'Sorry, the CISO had a dream.',
  'This keeps the bots away. Mostly.',
  'Per the 2009 policy, still valid.',
  'Ticket #4471: "make it harder".',
  'IT is enjoying this a lot.',
  'Please hold. Security is thinking.',
  'Industry best practice, probably.',
  'One more. Trust the process.',
  'The firewall requested this.',
  'We read about this in an airport book.',
  'Mandatory since the incident.',
  'Do not ask about the incident.',
  'This rule was voted in by Gary.',
  'Rolled out without a pilot. Enjoy!',
  'Your old password was "fine".',
  'Zero trust means zero trust.',
  'The VPN also wants this.',
  'Please do not write it on a sticky note.',
  'Strong passwords build strong teams.',
];

// Status line when the password passes everything.
export const DONE_LINES = [
  'Password accepted. Expires in 30 days.',
  'Accepted! Please change it tomorrow.',
  'Welcome back. Do not forget it.',
  'Accepted. IT has saved it in a spreadsheet.',
  'Great password. Now type it 40 times a day.',
];

export const SCREEN_TITLES = [
  'IT SECURITY - Your password has expired',
  'IT SECURITY - Mandatory password rotation',
  'IT SECURITY - Password too old (31 days)',
  'IT SECURITY - Choose a new password',
];
