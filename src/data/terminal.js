// Content for the office workstation terminal: fortunes, manual pages, process list. Pure data.
export const FORTUNES = [
  'You will attend a meeting that could have been an email.',
  'A synergy is coming. Look busy.',
  'Your next promotion is closer than your next vacation.',
  'The printer knows what you did.',
  'Today is a good day to reply "per my last email".',
  'Somewhere, a spreadsheet is missing a formula. It is yours.',
  'You will find the good stapler. Then lose it again.',
  'An unexpected calendar invite will ruin your lunch.',
  'Fortune favours those who mute themselves.',
  'The coffee machine respects you. Return the favour.',
  'Beware of colleagues bearing "quick questions".',
  'Your inbox will reach zero. In another life.',
  'He who deploys on Friday debugs on Saturday.',
  'Great leaders delegate. Great employees hide.',
  'The quarter ends. The quarter always ends.',
  'Synergy is not a strategy. Unless it is on a slide.',
  'A reorg is near. Update your LinkedIn.',
  'Your password expires in 3 days. So does your patience.',
];

export const MAN_PAGES = {
  ls: 'ls - list directory contents. Try ls -a: some files are shy, like interns.',
  cd: 'cd - change directory. Changing departments requires a promotion, or other means.',
  cat: 'cat - print files. No actual cats are allowed in the building (see Pet Policy v7).',
  sudo: 'sudo - execute a command as another user. You are not on the list. Nobody is on the list.',
  systemctl:
    'systemctl - control the systemd system and service manager.\n' +
    '  list-units [--type=TYPE]   list loaded units\n' +
    '  status UNIT                show runtime status of a unit\n' +
    '  start|stop|restart UNIT    (requires manager approval)\n' +
    '  isolate UNIT               start a unit and its dependencies and stop all others\n' +
    'NOTES: in this building every floor is a target unit.',
  man: 'man - an interface to the reference manuals. Also: what the CEO calls everyone.',
  fortune: 'fortune - print a random, hopefully interesting, adage. Approved by Legal.',
  rm: 'rm - remove files. Disabled under the data retention policy. Everything is kept. Forever.',
  history: 'history - show command history. HR also keeps a copy.',
  coffee: 'coffee - not a command. A lifestyle.',
};

export const PROCESSES = [
  ['1', 'root', 'systemd'],
  ['42', 'root', 'coffee-daemon --strength=max'],
  ['101', 'root', 'elevatord --floors=40'],
  ['404', 'root', 'printerd (not responding)'],
  ['666', 'hr', 'watch -n1 who'],
  ['1337', '$USER', 'procrastinate --until=friday'],
  ['2048', 'ceo', 'yacht-sync --background'],
  ['4096', 'root', 'meeting-scheduler --overbook'],
  ['8080', 'it', 'reboot-everything --when=meeting'],
  ['9001', 'finance', 'excel --sheets=9001'],
];

export const JOURNAL = [
  'systemd[1]: Started Office Coffee Daemon.',
  'coffee[42]: Brewing pot #3141. Nobody cleaned pot #3140.',
  'hr[666]: User $USER arrived at 09:07. Noted.',
  'printerd[404]: PC LOAD LETTER',
  'printerd[404]: What does that even mean?',
  'elevatord[101]: Loaded floor targets level01.target .. level40.target.',
  'meeting-scheduler[4096]: Double-booked room "Synergy" for the 12th time today.',
  'kernel: motivation: out of memory, killing process "enthusiasm"',
  'systemd[1]: motivation.service: Failed with result "monday".',
];
