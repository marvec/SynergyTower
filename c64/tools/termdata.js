// Data for the workstation terminal overlay (src/sys_term.s), from src/core/terminal.js and src/data/terminal.js.
// Texts are templates: placeholder bytes are replaced on the C64:
//   1 user, 2 host, 3 floor, 4 corp, 5 title (highest floor), 6 floor name, 7 department, 9 the command,
//   10 line break, 11 previous floor's unit (levelNN.target), 12 this floor's unit
// All texts are byte-pair encoded with the terminal's own table (tools/bpe.js; 128-255 = pairs).
import { asc } from './floor.js';
import { trainBpe, encodeBpe, encodeAsm } from './bpe.js';

const U = '\x01', H = '\x02', F = '\x03', C = '\x04', T = '\x05', N = '\x06', D = '\x07', CMD = '\x09', NL = '\n';
const PREV = '\x0b', CUR = '\x0c';

/** Simple commands: name -> output template (from the switch in src/core/terminal.js). */
function simpleOutputs({ FORTUNES, PROCESSES, JOURNAL }) {
  const ps = ['  PID USER      COMMAND', ...PROCESSES.map(([pid, u, c]) => `${pid.padStart(5)} ${u === '$USER' ? U + ' ' : u.padEnd(9)} ${c}`)].join(NL);
  return {
    whoami: U,
    id: `uid=1337(${U}) gid=100(synergy) groups=100(synergy),42(meetings),999(coffee)`,
    hostname: H,
    cal: 'Every day this month: meetings. Fridays: also meetings, but casual.',
    uptime: ' 09:41  up 3 quarters, 2 reorgs,  1 user,  load average: 9.99, 9.99, 9.99',
    exit: 'logout',
    su: 'su: Authentication failure. (The root password is on a sticky note. Somewhere.)',
    ps,
    top: ps + NL + '(press q to quit... just kidding, it already did)',
    kill: 'kill: Operation not permitted. Processes have feelings and union representation.',
    df: ['Filesystem       Size  Used Avail Use% Mounted on', '/dev/coffee      2.0L  2.0L    0B 100% /kitchen', `/dev/inbox        1T  1.0T    0B 100% /home/${U}/mail`, '/dev/motivation   10G    0B   10G   0% /soul', 'tmpfs            16G  4.0K   16G   1% /tmp'].join(NL),
    free: ['              total     used     free', 'Mem:            16G      16G       0B   (chat app: 14G)', 'Swap:           2G       2G       0B', 'Patience:      low     high    none'].join(NL),
    ifconfig: [`eth0: inet 10.0.${F}.42  netmask 255.255.255.0  (monitored)`, 'vpn0: DOWN (as usual)', 'lo:   inet 127.0.0.1  (there is no place like it)'].join(NL),
    curl: `${CMD}: blocked by the corporate proxy. Category: "Fun".`,
    apt: 'E: Could not open lock file. Are you root? (You are not. You are an employee.)',
    npm: ['added 1204 packages, and audited 1205 packages in 3m', '87 vulnerabilities (12 moderate, 75 "fine")'].join(NL),
    pip: 'error: externally-managed-environment. Everything here is externally managed.',
    vim: 'You are now trapped in vim. Forever. (Just kidding: interactive editors are disabled by IT.)',
    emacs: 'emacs: needs 8 more megabytes of RAM and a beard.',
    nano: 'nano: the only sane choice. Sadly the file system is read-only.',
    python: `${CMD}: interactive interpreters are disabled. Last time someone wrote a script that did their job.`,
    sl: ['A steam locomotive rushes past your desk. Choo choo!', '(You meant ls. Everybody means ls.)'].join(NL),
    neofetch: [`${U}@${H}`, '-------------------', 'OS: SynergyOS 40 (Corporate)', `Host: ${C} Tower`, `Floor: ${F} - ${N} (${D})`, `Title: ${T}`, 'Kernel: 6.6.6-corporate', 'Shell: bash (corporate edition)', 'CPU: Intel Pentium II @ 2 meetings/hour', 'Memory: mostly chat app'].join(NL),
    journalctl: JOURNAL.map((l, i) => `Oct 10 09:0${i} ${H} ${l.replace('$USER', U)}`).join(NL),
    who: [`${U}         tty1   09:07  (you)`, 'ceo        yacht  06:00  (remote, very remote)', 'hr         pts/0  08:00  (watching)'].join(NL),
    find: ['find: searching for meaning...', 'find: 0 results. Try a different department.'].join(NL),
    alias: ["alias ll='ls -la'", "alias please='sudo'", "alias meeting='sleep 3600'"].join(NL),
    passwd: "passwd: new password must contain a haiku, a dinosaur and the CEO's birthday.",
    reboot: [`${CMD}: Interactive authentication required.`, 'Shutdown is scheduled for Friday 17:00, as always.'].join(NL),
    init: `${CMD}: runlevels are so 2009. Floors are systemd targets now.`,
    coffee: 'coffee: command not found. Did you mean: walk to the kitchen?',
    readonly: `${CMD}: Read-only file system (corporate policy 4.2.1: no unapproved files)`,
    env: ['USER=' + U, `HOME=/home/${U}`, 'SHELL=/bin/bash', 'HOSTNAME=' + H, 'FLOOR=' + F, 'EDITOR=nano', 'LANG=en_US.SYNERGY-8', 'PATH=/usr/local/bin:/usr/bin:/bin:/opt/synergy/bin'].join(NL),
    fortunes: FORTUNES,
  };
}

/** The virtual file system (buildFs in src/core/terminal.js): path (home = "~"), flags, text. */
function files({ JOURNAL, FLOORS }) {
  const d = (path, extra = {}) => ({ path, dir: true, ...extra });
  const f = (path, text, extra = {}) => ({ path, text, ...extra });
  return [
    d('/'), d('/home'), d('~'),
    f('~/README.txt', `Welcome to your workstation, ${U}.${NL}This terminal is monitored for quality and training purposes.${NL}Type "help" if you are lost. Type "exit" to go back to pretending to work.`),
    f('~/todo.txt', ['TODO', '[ ] answer 412 emails', '[ ] look busy when the manager walks by', '[x] coffee', '[x] coffee', '[ ] ask IT why the elevator runs on systemd', '[ ] find the good stapler'].join(NL)),
    f('~/.bash_history', ['ls', 'cat todo.txt', 'sudo make me a sandwich', 'systemctl status coffee', 'systemctl list-units --type=target', `systemctl isolate ${PREV}   # quick trip, the elevator queue is huge`, 'history -c   # TODO: actually run this before the audit'].join(NL)),
    f('~/.secret', 'There is no secret here. Stop looking. (Okay, maybe check your bash history.)'),
    d('~/Documents'),
    f('~/Documents/resignation_draft.txt', ['Dear Management,', 'After careful consideration I have decided to', '[draft auto-saved 1,204 days ago]'].join(NL)),
    f('~/Documents/salary.xlsx', '', { locked: 'Finance has redacted this file' }),
    f('~/Documents/vision_lobby.txt', `${C}: Synergizing tomorrow's lobby paradigms, today.${NL}(Approved by 14 committees.)`),
    d('/etc'),
    f('/etc/motd', ['SynergyOS 40 LTS - "Corporate Penthouse"', `Floor ${F} workstation ${H}.`, 'Reminder: elevator scheduling has migrated to systemd. Every floor is a target. Please do not abuse it.'].join(NL)),
    f('/etc/hostname', H),
    f('/etc/passwd', ['root:x:0:0:root:/root:/bin/bash', 'ceo:x:1:1:Chief Executive Officer:/penthouse:/bin/yacht', 'hr:x:666:666:Human Resources:/var/hr:/bin/watch', 'coffee:x:42:42:Coffee Daemon:/kitchen:/bin/brew', `${U}:x:1337:100:${T}:/home/${U}:/bin/bash`].join(NL)),
    f('/etc/shadow', '', { locked: 'nice try' }),
    d('/etc/systemd'), d('/etc/systemd/system'),
    f('/etc/systemd/system/coffee.service', ['[Unit]', 'Description=Office Coffee Daemon', '', '[Service]', 'ExecStart=/usr/bin/brew --forever', 'Restart=always'].join(NL)),
    f(`/etc/systemd/system/${CUR}`, ['[Unit]', `Description=Floor ${F} - ${N}`, 'Requires=coffee.service', 'AllowIsolate=yes'].join(NL)),
    d('/var'), d('/var/log'),
    f('/var/log/syslog', JOURNAL.join(NL).replace(/\$USER/g, U)),
    f('/var/log/hr.log', [`[09:07] ${U} arrived. 7 minutes late. Noted.`, `[10:15] ${U} visited the kitchen. Third time.`, `[11:30] ${U} opened a terminal. Interesting...`].join(NL)),
    d('/root', { locked: true }),
    d('/tmp'),
    f('/tmp/definitely_not_a_job_search.txt', ['Positions applied: 3', 'Interviews: 0', 'Cover letter: "Dear Sir or Madam or Algorithm"'].join(NL)),
    d('/opt'), d('/opt/synergy'),
    f('/opt/synergy/elevator.conf', ['# Elevator controller config', `floors=${FLOORS}`, 'backend=systemd', `# Each floor is a unit named levelNN.target (NN = 01..${FLOORS}).`, '# Isolating a target moves the caller there. Do NOT tell the interns.'].join(NL)),
    d('/penthouse', { locked: 'CEO only' }),
  ];
}

const bytesOf = (s) => [...s].map((c) => c.charCodeAt(0)).map((c) => (c === 10 ? 10 : c));

export function termDataAsm({ FORTUNES, MAN_PAGES, PROCESSES, JOURNAL, COMMANDS, FLOORS, floorNames, titles, onDisk, source }) {
  const simple = simpleOutputs({ FORTUNES, PROCESSES, JOURNAL });
  const fs = files({ JOURNAL, FLOORS });
  // Every text, for the pair table
  const texts = [];
  const add = (s) => (texts.push(bytesOf(s)), s);
  for (const [k, v] of Object.entries(simple)) if (k !== 'fortunes') add(v);
  FORTUNES.forEach(add);
  Object.values(MAN_PAGES).forEach(add);
  fs.forEach((e) => (add(e.path), e.text && add(e.text), typeof e.locked === 'string' && add(e.locked)));
  floorNames.forEach(add);
  titles.forEach(add);
  const messages = messageLines(source);
  for (const l of messages) for (const m of l.matchAll(/"((?:[^"\\]|\\.)*)"/g)) add(m[1]);
  const pairs = trainBpe(texts.map((t) => t.map((c) => (c < 32 && c !== 10 ? c : c))));
  const enc = (s) => [...encodeBpe(bytesOf(s), pairs), 0].join(', ');
  const out = ['; generated by c64/build.js (tools/termdata.js) from src/core/terminal.js, src/data/terminal.js'];
  out.push(`tbpe_a: .byte ${pairs.map((p) => p[0]).join(', ')}`, `tbpe_b: .byte ${pairs.map((p) => p[1]).join(', ')}`);
  // simple command outputs: names table (command words that map to an output)
  const alias = { ll: null, logout: 'exit', quit: 'exit', htop: 'top', wget: 'curl', 'apt-get': 'apt', yum: 'apt', brew: 'apt', vi: 'vim', python3: 'python', node: 'python', ip: 'ifconfig', shutdown: 'reboot', poweroff: 'reboot', halt: 'reboot', telinit: 'init', w: 'who', printenv: 'env', mkdir: 'readonly', touch: 'readonly', mv: 'readonly', cp: 'readonly', chmod: 'readonly', chown: 'readonly' };
  const keys = Object.keys(simple).filter((k) => k !== 'fortunes' && k !== 'readonly');
  const words = [...keys, ...Object.keys(alias).filter((k) => alias[k])];
  const target = (w) => alias[w] || w;
  const outKeys = [...keys, 'readonly'];
  out.push('.segment "TDATA"'); // the big texts: loaded to $8000 (the floor's place) while the terminal runs
  outKeys.forEach((k, i) => out.push(`so${i}: .byte ${enc(simple[k])}`));
  out.push(`SIMPLE_N = ${words.length}`, `EXIT_OUT = ${outKeys.indexOf('exit')}`, `JOURNAL_OUT = ${outKeys.indexOf('journalctl')}`, `FLOORS_ON_DISK = ${onDisk}`);
  words.forEach((w, i) => out.push(`sw${i}: .byte ${asc(w).join(', ')}, 0`));
  out.push(`sw_lo: .byte ${words.map((_, i) => `<sw${i}`).join(', ')}`, `sw_hi: .byte ${words.map((_, i) => `>sw${i}`).join(', ')}`);
  out.push(`sw_out: .byte ${words.map((w) => outKeys.indexOf(target(w))).join(', ')}`);
  out.push(`so_lo: .byte ${outKeys.map((_, i) => `<so${i}`).join(', ')}`, `so_hi: .byte ${outKeys.map((_, i) => `>so${i}`).join(', ')}`);
  // fortunes, man pages
  FORTUNES.forEach((t, i) => out.push(`fo${i}: .byte ${enc(t)}`));
  out.push(`FORTUNE_N = ${FORTUNES.length}`, `fo_lo: .byte ${FORTUNES.map((_, i) => `<fo${i}`).join(', ')}`, `fo_hi: .byte ${FORTUNES.map((_, i) => `>fo${i}`).join(', ')}`);
  const man = Object.entries(MAN_PAGES);
  man.forEach(([k, t], i) => out.push(`mw${i}: .byte ${asc(k).join(', ')}, 0`, `mt${i}: .byte ${enc(t)}`));
  out.push(`MAN_N = ${man.length}`, `mw_lo: .byte ${man.map((_, i) => `<mw${i}`).join(', ')}`, `mw_hi: .byte ${man.map((_, i) => `>mw${i}`).join(', ')}`, `mt_lo: .byte ${man.map((_, i) => `<mt${i}`).join(', ')}`, `mt_hi: .byte ${man.map((_, i) => `>mt${i}`).join(', ')}`);
  out.push('.segment "RODATA"');
  // all commands (help, which)
  out.push(`CMD_N = ${COMMANDS.length}`);
  COMMANDS.forEach((c, i) => out.push(`cm${i}: .byte ${asc(c).join(', ')}, 0`));
  out.push(`cm_lo: .byte ${COMMANDS.map((_, i) => `<cm${i}`).join(', ')}`, `cm_hi: .byte ${COMMANDS.map((_, i) => `>cm${i}`).join(', ')}`);
  // files: path (plain, "~" = home), flags (1 dir, 2 locked), lock message, text
  out.push(`FS_N = ${fs.length}`);
  fs.forEach((e, i) => {
    out.push(`fp${i}: .byte ${[...e.path].map((c) => c.charCodeAt(0)).join(', ')}, 0`);
    out.push(`fx${i}: .byte ${e.text ? enc(e.text) : '0'}`);
    out.push(`fl${i}: .byte ${typeof e.locked === 'string' ? enc(e.locked) : '0'}`);
  });
  out.push(`fp_lo: .byte ${fs.map((_, i) => `<fp${i}`).join(', ')}`, `fp_hi: .byte ${fs.map((_, i) => `>fp${i}`).join(', ')}`);
  out.push(`fx_lo: .byte ${fs.map((_, i) => `<fx${i}`).join(', ')}`, `fx_hi: .byte ${fs.map((_, i) => `>fx${i}`).join(', ')}`);
  out.push(`fl_lo: .byte ${fs.map((_, i) => `<fl${i}`).join(', ')}`, `fl_hi: .byte ${fs.map((_, i) => `>fl${i}`).join(', ')}`);
  out.push(`f_flags: .byte ${fs.map((e) => (e.dir ? 1 : 0) | (e.locked ? 2 : 0)).join(', ')}`);
  // floor names + titles (40)
  floorNames.forEach((n, i) => out.push(`fn${i}: .byte ${enc(n)}`));
  titles.forEach((n, i) => out.push(`ti${i}: .byte ${enc(n)}`));
  out.push(`fn_lo: .byte ${floorNames.map((_, i) => `<fn${i}`).join(', ')}`, `fn_hi: .byte ${floorNames.map((_, i) => `>fn${i}`).join(', ')}`);
  out.push(`ti_lo: .byte ${titles.map((_, i) => `<ti${i}`).join(', ')}`, `ti_hi: .byte ${titles.map((_, i) => `>ti${i}`).join(', ')}`);
  out.push(`TFLOORS = ${FLOORS}`);
  return { asm: out.join('\n') + '\n', source: encodeMessages(source, pairs) };
}

/** The .byte lines of messages (labels s_..., and the lines continuing them) in the overlay's source. */
function messageLines(source) {
  const out = [];
  let label = '';
  for (const line of source.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w]*):/);
    if (m) label = m[1];
    else if (line.trim() && !line.match(/^\s+\.byte/)) label = '';
    if (label.startsWith('s_') && line.includes('.byte') && line.includes('"')) out.push(line);
  }
  return out;
}

/** The overlay's source with its messages byte-pair encoded (names, n_..., stay plain for comparisons). */
function encodeMessages(source, pairs) {
  let label = '';
  return source
    .split('\n')
    .map((line) => {
      const m = line.match(/^([A-Za-z_][\w]*):/);
      if (m) label = m[1];
      else if (line.trim() && !line.match(/^\s+\.byte/)) label = '';
      return label.startsWith('s_') && line.includes('.byte') && line.includes('"') ? encodeAsm(line, pairs) : line;
    })
    .join('\n');
}
