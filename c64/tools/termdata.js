// Data for the workstation terminal (src/sys_term.s), from the JS shell (src/core/terminal.js, src/data/terminal.js).
// The C64 terminal fits the 8 KB overlay slot, so it keeps the JS commands' replies but not all of their logic:
// no pipes or && chains, ls without -l, a smaller file system. Texts are byte-pair encoded with the terminal's own
// table and may hold placeholders, filled in when printed:
//   1 login name  2 host  3 floor  4 floor name  5 title  6 corp  7 home directory  9 the arguments
//   8 the first argument, or the default text that follows it up to 12
//   11 the floor in two digits  13 the floor below in two digits  (10 is a line break)
import { trainBpe, encodeBpe } from './bpe.js';

const FL2 = '\x0b';
const U = '\x01', HOST = '\x02', FL = '\x03', FNAME = '\x04', TITLE = '\x05', CORP = '\x06', HOME = '\x07';

const arg1 = (dflt) => `\x08${dflt}\x0c`;

/** Handlers in src/sys_term.s (H_* there, same order). */
export const H = ['TEXT', 'HELP', 'LS', 'CD', 'PWD', 'CAT', 'ECHO', 'CLEAR', 'HISTORY', 'EXIT', 'MAN', 'SUDO', 'SYSTEMCTL', 'SWITCH', 'WHICH', 'FORTUNE', 'COWSAY'];

const bytes = (s) => {
  const out = [...s].map((c) => c.charCodeAt(0));
  const bad = out.find((c) => c > 126 || (c < 32 && c !== 10 && !(c >= 1 && c <= 13)));
  if (bad !== undefined) throw new Error(`terminal: no C64 glyph (${bad}) in "${s}"`);
  return out;
};

export function termDataAsm({ COMMANDS, FORTUNES, MAN_PAGES, PROCESSES, JOURNAL, FLOORS, floorNames }) {
  const texts = []; // all texts, encoded at the end
  const T = (s) => (texts.includes(s) ? texts.indexOf(s) : texts.push(s) - 1); // (the same text once)
  const lines = (...l) => T(l.join('\n'));
  // ---- commands: name -> [handler, argument]
  const cmd = {};
  const text = (names, ...l) => names.split(' ').forEach((n) => (cmd[n] = ['TEXT', lines(...l)]));
  const sw = (names, cases) => {
    names.split(' ').forEach((n) => (cmd[n] = ['SWITCH', switches.length]));
    switches.push(cases.map(([pat, ...l]) => [pat, lines(...l)]));
  };
  const switches = [];
  for (const [n, h] of Object.entries({ help: 'HELP', ls: 'LS', ll: 'LS', cd: 'CD', pwd: 'PWD', cat: 'CAT', less: 'CAT', more: 'CAT', head: 'CAT', tail: 'CAT', echo: 'ECHO', clear: 'CLEAR', history: 'HISTORY', exit: 'EXIT', logout: 'EXIT', quit: 'EXIT', man: 'MAN', sudo: 'SUDO', systemctl: 'SYSTEMCTL', which: 'WHICH', fortune: 'FORTUNE', cowsay: 'COWSAY' }))
    cmd[n] = [h, 0];
  text('whoami', U);
  text('id', `uid=1337(${U}) gid=100(synergy) groups=42(meetings)`);
  text('hostname', HOST);
  text('date', 'Mon, 10 Oct 09:41:00 SYNERGY TIME');
  text('cal', 'Every day this month: meetings. Fridays: also meetings, but casual.');
  text('uptime', 'up 3 quarters, 2 reorgs, load average: 9.99');
  sw('uname', [['-a', `SynergyOS ${HOST} 6.6.6-corporate`], ['', 'SynergyOS']]);
  text('su', 'su: Authentication failure. (The password is on a sticky note.)');
  sw('rm rmdir', [['-rf /', 'Nice try. The tower is load-bearing.'], ['', 'rm: not permitted (data retention policy: keep everything forever)']]);
  text('mkdir touch mv cp chmod chown', 'Read-only file system (policy 4.2.1)');
  const ps = ['  PID USER  COMMAND', ...PROCESSES.slice(0, 6).map(([pid, u, c]) => `${pid.padStart(5)} ${u === '$USER' ? U : u.padEnd(5)} ${c}`)];
  text('ps', ...ps);
  text('top htop', ...ps);
  text('kill', 'kill: not permitted. Processes have union representation.');
  text('df', '/dev/coffee      2.0L  100%', '/dev/inbox         1T  100%', '/dev/motivation   10G    0%');
  text('free', 'Mem: 16G used (chat app: 14G)', 'Patience: none');
  text('ifconfig ip', `eth0: 10.0.${FL}.42 (monitored)`, 'vpn0: DOWN (as usual)');
  text('ping', `PING ${arg1('localhost')}: time=1337 ms`, '0% packet loss, 100% bureaucracy');
  text('curl wget ssh', 'Blocked by the corporate proxy. Category: "Fun".');
  sw('git', [
    ['status', 'On branch main, 4812 commits behind.'],
    ['blame', 'It was Kevin.'],
    ['push', 'rejected: pushing on a Friday is forbidden'],
    ['log', '"fix", "fix fix", "final fix (real)"'],
    ['', 'usage: git status, log, blame, push'],
  ]);
  text('apt apt-get yum brew pip npm', 'E: Are you root? (You are not. You are an employee.)');
  text('vim vi emacs nano', 'Editors are disabled by IT. You are trapped anyway.');
  text('python python3 node', 'Disabled. Last time someone scripted their job.');
  sw('make', [['me a sandwich', 'What? Make it yourself.'], ['', `make: No rule to make target '${arg1('money')}'.`]]);
  text('sl', 'A train rushes past your desk. Choo choo! (You meant ls.)');
  text('neofetch', `${U}@${HOST}`, 'OS: SynergyOS 40', `Host: ${CORP} Tower`, `Floor: ${FL} - ${FNAME}`, `Title: ${TITLE}`, 'CPU: 2 meetings/hour');
  sw('journalctl', [['-u', '-- No entries -- (motivation has not logged anything since Monday)'], ['', ...JOURNAL.slice(3, 5)]]);
  text('who w', `${U} (you)`, 'ceo (remote, very remote)', 'hr (watching)');
  text('find', 'find: searching for meaning... 0 results.');
  text('env printenv', `USER=${U}`, `HOME=${HOME}`, `HOSTNAME=${HOST}`, `FLOOR=${FL}`);
  text('alias', "alias meeting='sleep 3600'");
  text('passwd', 'passwd: must contain a haiku and a dinosaur.');
  text('reboot shutdown poweroff halt', 'Shutdown is scheduled for Friday 17:00.');
  text('init telinit', 'Runlevels are so 2009. Floors are targets now.');
  text('coffee', 'Did you mean: walk to the kitchen?');
  text('grep', "grep: not in this quarter's budget.");
  for (const c of COMMANDS) if (!cmd[c]) throw new Error(`terminal: no C64 reply for "${c}"`);
  // ---- the fixed messages of the handlers (MSG_* in sys_term.s, same order)
  const MSG = {
    motd: lines('SynergyOS 40 LTS. Monitored for quality and training purposes.', 'Type "help". "exit" or RUN/STOP closes. F1 completes.'),
    helpHead: T('SynergyOS bash, corporate edition. Commands:'),
    helpTail: T('Some are more interesting than others. Try man.'),
    notFound: T(`${arg1('')}: command not found`),
    noFile: T(`${arg1('')}: No such file or directory`),
    isDir: T(`${arg1('')}: Is a directory`),
    notDir: T(`cd: not a directory: ${arg1('')}`),
    denied: T(`${arg1('')}: Permission denied`),
    catNoArg: T('cat: missing file (mind reading not supported yet)'),
    manNoArg: T('What manual page do you want?'),
    manNone: T(`No manual entry for ${arg1('')}. Ask in #general.`),
    sudoCeo: T('You are the CEO. You do not need sudo. You need a yacht.'),
    sudoNo: T(`${U} is not in the sudoers file. This incident will be reported to HR.`),
    sudoSandwich: T('Okay.'),
    whichNo: T(`${arg1('')} not found`),
    logout: T('logout'),
    scHost: lines(`* ${HOST}`, '    State: degraded', '     Jobs: 412 queued (mostly meetings)', '   Failed: 1 units (printer.service)'),
    scUnits: lines('coffee.service     active', 'elevator.service   active', 'printer.service    failed', 'motivation.service dead', 'Pass --type=target to see the floors.'),
    scNoUnit: T(`Unit ${arg1('')} could not be found.`),
    scFew: T('Too few arguments.'),
    scHere: T('You are standing in it: that target is already active.'),
    scRumour: T('This tower has 40 floors. Others are a rumour.'),
    scStop: T(`[  OK  ] Stopped target level${FL2}.target.`),
    scStart: T('[  OK  ] Reached target '),
    scCall: T('Calling the elevator...'),
    scDenied: T("Access denied (ask your manager's manager)."),
    scVerb: T(`Unknown command verb ${arg1('')}.`),
    cowDefault: T('Moo-ve fast and break things.'),
    cow: lines('        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'),
  };
  // ---- man pages, fortunes, floor names (systemctl list-units --type=target / status levelNN)
  const man = Object.entries(MAN_PAGES).filter(([k]) => ['ls', 'cd', 'sudo', 'systemctl', 'man'].includes(k)).map(([k, v]) => [k, T(v.split('\n').slice(0, 1).concat(k === 'systemctl' ? ['  isolate UNIT   start a unit, stop all others', 'NOTES: every floor is a target unit.'] : []).join('\n'))]);
  const fortunes = FORTUNES.slice(0, 8).map((f) => T(f));
  void floorNames;
  // ---- the file system: paths ("~" = the home directory), d = directory, l = locked (its reason)
  const prev = '\x0d'; // (the floor below: filled in like the floor number)
  const files = [
    ['/', 'd'], ['/home', 'd'], ['~', 'd'],
    ['~/README.txt', '', 'Type "help" if you are lost. Type "exit" to go back to pretending to work.'],
    ['~/todo.txt', '', '[ ] answer 412 emails\n[x] coffee\n[x] coffee\n[ ] ask IT why the elevator runs on systemd'],
    ['~/.bash_history', '', `cat todo.txt\nsudo make me a sandwich\nsystemctl list-units --type=target\nsystemctl isolate level${prev}.target`],
    ['~/.secret', '', 'No secret here. (Maybe check your bash history.)'],
    ['~/Documents', 'd'],
    ['~/Documents/salary.xlsx', 'l', 'Finance has redacted this file'],
    ['/etc', 'd'],
    ['/etc/motd', '', 'Reminder: elevator scheduling has migrated to systemd. Every floor is a target.'],
    ['/etc/passwd', '', `ceo:x:1:1:Chief Executive Officer:/penthouse\n${U}:x:1337:100:${TITLE}:${HOME}`],
    ['/var', 'd'], ['/var/log', 'd'],
    ['/var/log/hr.log', '', `[09:07] ${U} arrived. 7 minutes late. Noted.\n[11:30] ${U} opened a terminal. Interesting...`],
    ['/root', 'l', ''],
    ['/opt', 'd'], ['/opt/synergy', 'd'],
    ['/opt/synergy/elevator.conf', '', `floors=${FLOORS}\nbackend=systemd\n# Each floor is a unit levelNN.target.\n# Isolating a target moves the caller there.`],
    ['/penthouse', 'l', 'CEO only'],
  ];
  const fsText = files.map(([, , t]) => (t === undefined ? -1 : T(t)));
  // ---- encode
  const all = texts.map(bytes);
  const pairs = trainBpe(all);
  const enc = all.map((b) => encodeBpe(b, pairs));
  const out = ['; generated by c64/build.js (tools/termdata.js)'];
  const db = (name, arr) => out.push(`${name}: .byte ${arr.join(', ')}`);
  db('tbpe_a', pairs.map((p) => p[0]));
  db('tbpe_b', pairs.map((p) => p[1]));
  // texts one after the other (text n: past n zero bytes)
  db('texts', enc.flatMap((e) => [...e, 0]));
  // commands (sorted): name, 0, handler, argument ... then 0
  const names = Object.keys(cmd).sort();
  db('cmds', [...names.flatMap((n) => [...bytes(n), 0, H.indexOf(cmd[n][0]), cmd[n][1]]), 0]);
  out.push(...H.map((h, i) => `H_${h} = ${i}`));
  // switches: per table: n, then (pattern\0, text index) ...
  switches.forEach((cases, i) => db(`sw${i}`, [cases.length, ...cases.flatMap(([pat, t]) => [...bytes(pat), 0, t])]));
  db('sw_lo', switches.map((_, i) => `<sw${i}`));
  db('sw_hi', switches.map((_, i) => `>sw${i}`));
  for (const [k, v] of Object.entries(MSG)) out.push(`MSG_${k.toUpperCase()} = ${v}`);
  // man pages: name\0 text, ... 0
  db('man_tab', [...man.flatMap(([k, t]) => [...bytes(k), 0, t]), 0]);
  out.push(`N_FORTUNES = ${fortunes.length}`, `FORTUNE0 = ${fortunes[0]}`);
  // files: flags (1 dir, 2 locked), text index (255 none), path\0 ... ; 0 = end
  db('fs_tab', [...files.flatMap(([p, f], i) => [(f.includes('d') ? 1 : 0) | (f.includes('l') ? 2 : 0) | 4, fsText[i] < 0 ? 255 : fsText[i], ...bytes(p), 0]), 0]);
  if (texts.length > 255) throw new Error('terminal: more than 255 texts');
  return { asm: out.join('\n') + '\n', size: enc.reduce((n, e) => n + e.length + 3, 256), texts };
}
