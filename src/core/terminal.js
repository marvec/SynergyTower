// The office workstation shell: a tiny fake Linux with a virtual file system. Pure (no DOM).
// Secret: `systemctl isolate levelXX.target` jumps to floor XX (the shell returns { warp: XX }).
import { FLOORS } from './economy.js';
import { floorName, titleForFloor, departmentForFloor } from '../data/departments.js';
import { FORTUNES, MAN_PAGES, PROCESSES, JOURNAL } from '../data/terminal.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const levelUnit = (n) => `level${pad2(n)}.target`;
const LEVEL_RE = /^level(\d{1,2})(\.target)?$/;

/** A login name from the player's name: lowercase letters and digits, max 12. */
export function loginName(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return n || 'newhire';
}

const COMMANDS = [
  'alias', 'apt', 'apt-get', 'brew', 'cal', 'cat', 'cd', 'chmod', 'chown', 'clear', 'cowsay', 'cp', 'curl', 'date', 'df',
  'echo', 'emacs', 'env', 'exit', 'find', 'fortune', 'free', 'git', 'grep', 'head', 'help', 'history', 'hostname', 'htop', 'id',
  'ifconfig', 'init', 'ip', 'journalctl', 'kill', 'less', 'll', 'logout', 'ls', 'make', 'man', 'mkdir', 'more', 'mv', 'nano',
  'neofetch', 'node', 'npm', 'passwd', 'ping', 'pip', 'printenv', 'ps', 'pwd', 'python', 'python3', 'reboot', 'rm', 'rmdir',
  'shutdown', 'sl', 'ssh', 'sudo', 'systemctl', 'tail', 'top', 'touch', 'uname', 'uptime', 'vi', 'vim', 'w', 'wget', 'which',
  'who', 'whoami', 'yum',
];

/**
 * ctx: { user, floor, maxFloor, deptId, corp, ws (workstation number), now (ms) }
 * Returns a shell: prompt(), run(line) → { out: string[], clear?, exit?, warp? }, complete(line) → line.
 */
export function createShell(ctx) {
  const user = ctx.user || 'newhire';
  const home = `/home/${user}`;
  const host = `f${pad2(ctx.floor)}-ws${ctx.ws || 1}`;
  const fs = buildFs({ ...ctx, user, home, host });
  const history = [];
  let cwd = home;

  const env = { USER: user, HOME: home, SHELL: '/bin/bash', HOSTNAME: host, FLOOR: String(ctx.floor), EDITOR: 'nano', LANG: 'en_US.SYNERGY-8', PATH: '/usr/local/bin:/usr/bin:/bin:/opt/synergy/bin' };

  const resolve = (p) => {
    if (!p || p === '~') return home;
    if (p.startsWith('~/')) p = home + p.slice(1);
    const parts = (p.startsWith('/') ? [] : cwd.split('/').filter(Boolean));
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return '/' + parts.join('/');
  };
  const isDir = (p) => fs[p]?.dir === true;
  const children = (dir) => Object.keys(fs).filter((k) => k !== dir && k.startsWith(dir === '/' ? '/' : dir + '/') && !k.slice(dir === '/' ? 1 : dir.length + 1).includes('/')).map((k) => k.slice(k.lastIndexOf('/') + 1)).sort();
  const short = (p) => (p === home ? '~' : p.startsWith(home + '/') ? '~' + p.slice(home.length) : p);

  const readFile = (arg, cmd) => {
    const p = resolve(arg);
    const f = fs[p];
    if (!f) return { err: `${cmd}: ${arg}: No such file or directory` };
    if (f.dir) return { err: `${cmd}: ${arg}: Is a directory` };
    if (f.locked) return { err: `${cmd}: ${arg}: Permission denied${f.locked === true ? '' : ` (${f.locked})`}` };
    return { text: f.text };
  };

  const expand = (w) => w.replace(/\$\{?([A-Z_]+)\}?/g, (_, k) => (k in env ? env[k] : '')).replace(/^\$\?$/, '0');

  function systemctl(args) {
    const [verb = 'list-units', unitArg] = args;
    const unit = unitArg && !unitArg.includes('.') && !LEVEL_RE.test(unitArg) ? `${unitArg}.service` : unitArg;
    const services = {
      'coffee.service': ['active', 'running', 'Office Coffee Daemon'],
      'elevator.service': ['active', 'running', 'Elevator Controller'],
      'printer.service': ['failed', 'failed', 'Printer (PC LOAD LETTER)'],
      'motivation.service': ['inactive', 'dead', 'Employee Motivation'],
      'surveillance.service': ['active', 'running', 'HR Wellbeing Monitor'],
      'synergy.target': ['active', 'active', 'Synergy'],
    };
    const levelOf = (u) => {
      const m = LEVEL_RE.exec(u || '');
      return m ? Number(m[1]) : null;
    };
    const levelDesc = (n) => `Floor ${n} - ${floorName(n)}`;
    if (verb === 'list-units' || verb === 'list-targets') {
      const targets = verb === 'list-targets' || args.includes('--type=target') || (args.includes('-t') && args.includes('target'));
      const out = ['UNIT                   LOAD   ACTIVE   SUB      DESCRIPTION'];
      const row = (u, a, sub, d) => `${u.padEnd(22)} loaded ${a.padEnd(8)} ${sub.padEnd(8)} ${d}`;
      if (targets) {
        for (let n = 1; n <= FLOORS; n++) out.push(row(levelUnit(n), n === ctx.floor ? 'active' : 'inactive', n === ctx.floor ? 'active' : 'dead', levelDesc(n)));
        out.push(row('synergy.target', 'active', 'active', 'Synergy'));
        out.push('', `${FLOORS + 1} loaded units listed.`);
      } else {
        for (const [u, [a, sub, d]] of Object.entries(services)) out.push(row(u, a, sub, d));
        out.push(row(levelUnit(ctx.floor), 'active', 'active', levelDesc(ctx.floor)));
        out.push('', `${Object.keys(services).length + 1} loaded units listed. Pass --type=target to see all targets.`);
      }
      return { out };
    }
    if (verb === 'status') {
      if (!unit) return { out: [`* ${host}`, '    State: degraded', '     Jobs: 412 queued (mostly meetings)', '   Failed: 1 units (printer.service)'] };
      const n = levelOf(unit);
      if (n != null) {
        if (n < 1 || n > FLOORS) return { out: [`Unit ${unit} could not be found.`] };
        const on = n === ctx.floor;
        return { out: [`* ${levelUnit(n)} - ${levelDesc(n)}`, `     Loaded: loaded (/etc/systemd/system/${levelUnit(n)}; static)`, `     Active: ${on ? 'active since 09:00 (you are here)' : 'inactive (dead)'}`, `       Docs: man:${titleForFloor(n).toLowerCase().replace(/[^a-z]+/g, '-')}(7)`] };
      }
      const sv = services[unit];
      if (!sv) return { out: [`Unit ${unit} could not be found.`] };
      const extra = {
        'coffee.service': '     Memory: 2.1 L of espresso',
        'printer.service': '     Result: paper-jam (since 1998)',
        'motivation.service': '     Since: Monday 09:00',
        'surveillance.service': '      Tasks: 1 (watching you type this)',
      }[unit];
      return { out: [`* ${unit} - ${sv[2]}`, `     Loaded: loaded (/etc/systemd/system/${unit}; enabled)`, `     Active: ${sv[0]} (${sv[1]})`, ...(extra ? [extra] : [])] };
    }
    if (verb === 'isolate') {
      if (!unit) return { out: ['Too few arguments.'] };
      const n = levelOf(unit);
      if (n == null) {
        if (services[unit]) return { out: [`Failed to start ${unit}: Operation refused, unit may not be isolated.`] };
        return { out: [`Failed to start ${unit}: Unit ${unit} not found.`] };
      }
      if (n < 1 || n > FLOORS) return { out: [`Failed to start ${unit}: Unit ${unit} not found.`, `(This tower has ${FLOORS} floors. Floor ${n} is a rumour.)`] };
      if (n === ctx.floor) return { out: [`${levelUnit(n)} is already active. You are standing in it.`] };
      return {
        out: [
          `         Stopping ${levelUnit(ctx.floor)} - ${levelDesc(ctx.floor)}...`,
          `[  OK  ] Stopped target ${levelUnit(ctx.floor)}.`,
          `         Starting ${levelUnit(n)} - ${levelDesc(n)}...`,
          `[  OK  ] Reached target ${levelUnit(n)} - ${levelDesc(n)}.`,
          'Calling the elevator...',
        ],
        warp: n,
      };
    }
    if (['start', 'stop', 'restart', 'enable', 'disable', 'kill', 'mask'].includes(verb)) {
      if (!unit) return { out: ['Too few arguments.'] };
      if (unit === 'coffee.service' && verb !== 'start' && verb !== 'restart') return { out: ['Refusing. Stopping coffee.service would bring down the entire company.'] };
      if (unit === 'motivation.service') return { out: [`Job for motivation.service failed because the control process exited with error code.`, `See "journalctl -u motivation" for details.`] };
      if (levelOf(unit) != null) return { out: [`Floors cannot be ${verb}ed directly. Use "systemctl isolate".`] };
      return { out: [`Failed to ${verb} ${unit}: Access denied.`, 'Interactive authentication required (ask your manager\'s manager).'] };
    }
    if (['poweroff', 'reboot', 'halt', 'suspend'].includes(verb)) return { out: [`Failed to ${verb} system: Interactive authentication required.`, 'Shutdown is scheduled for Friday 17:00, as always.'] };
    return { out: [`Unknown command verb ${verb}.`] };
  }

  function exec(argv) {
    const [cmd, ...args] = argv;
    const a = args.map(expand);
    const out = (...lines) => ({ out: lines.flatMap((l) => String(l).split('\n')) });
    switch (cmd) {
      case undefined:
        return { out: [] };
      case 'help':
        return out(
          'SynergyOS bash, corporate edition. Available commands:',
          ...chunk(COMMANDS, 9).map((r) => '  ' + r.join(' ')),
          'Some commands are more interesting than others. RTFM: man <command>.',
        );
      case 'ls':
      case 'll': {
        const flags = a.filter((x) => x.startsWith('-')).join('');
        const all = flags.includes('a') || cmd === 'll';
        const long = flags.includes('l') || cmd === 'll';
        const targets = a.filter((x) => !x.startsWith('-'));
        const p = resolve(targets[0] || '.');
        if (!fs[p]) return out(`ls: cannot access '${targets[0]}': No such file or directory`);
        if (fs[p].locked && fs[p].dir) return out(`ls: cannot open directory '${targets[0]}': Permission denied`);
        let names = fs[p].dir ? children(p) : [targets[0]];
        if (!all) names = names.filter((n) => !n.startsWith('.'));
        if (all && fs[p].dir) names = ['.', '..', ...names];
        if (!long) return out(names.map((n) => (isDir(p === '/' ? '/' + n : `${p}/${n}`) ? n + '/' : n)).join('  ') || '');
        return out(
          `total ${names.length * 4}`,
          ...names.map((n) => {
            const fp = fs[p].dir ? resolve(`${p}/${n}`) : p;
            const f = fs[fp] || { dir: true };
            const owner = f.owner || (fp.startsWith(home) ? user : 'root');
            const size = f.dir ? 4096 : (f.text || '').length;
            return `${f.dir ? 'd' : '-'}${f.locked ? 'rw-------' : 'rw-r--r--'} 1 ${owner.padEnd(8)} ${String(size).padStart(5)} Oct 10 09:00 ${n}`;
          }),
        );
      }
      case 'cd': {
        const p = resolve(a[0]);
        if (!fs[p]) return out(`cd: no such file or directory: ${a[0]}`);
        if (!fs[p].dir) return out(`cd: not a directory: ${a[0]}`);
        if (fs[p].locked) return out(`cd: permission denied: ${a[0]}`);
        cwd = p;
        return out();
      }
      case 'pwd':
        return out(cwd);
      case 'cat':
      case 'less':
      case 'more':
      case 'head':
      case 'tail': {
        const files = a.filter((x) => !x.startsWith('-'));
        if (!files.length) return out(`${cmd}: missing file operand (reading from your mind is not supported yet)`);
        const lines = [];
        for (const f of files) {
          const r = readFile(f, cmd);
          lines.push(r.err || r.text);
        }
        return out(...lines);
      }
      case 'grep': {
        const [pat, file] = a.filter((x) => !x.startsWith('-'));
        if (!pat) return out('usage: grep PATTERN FILE');
        if (!file) return out('grep: reading from stdin is not in the budget. Name a file.');
        const r = readFile(file, 'grep');
        if (r.err) return out(r.err);
        const hits = r.text.split('\n').filter((l) => l.toLowerCase().includes(pat.toLowerCase()));
        return out(...hits);
      }
      case 'echo':
        return out(a.join(' ').replace(/^["']|["']$/g, ''));
      case 'whoami':
        return out(user);
      case 'id':
        return out(`uid=1337(${user}) gid=100(synergy) groups=100(synergy),42(meetings),999(coffee)`);
      case 'hostname':
        return out(host);
      case 'date':
        return out(new Date(ctx.now || 0).toUTCString().replace('GMT', 'SYNERGY TIME'));
      case 'cal':
        return out('Every day this month: meetings. Fridays: also meetings, but casual.');
      case 'uptime':
        return out(' 09:41  up 3 quarters, 2 reorgs,  1 user,  load average: 9.99, 9.99, 9.99');
      case 'uname':
        return out(a.includes('-a') ? `SynergyOS ${host} 6.6.6-corporate #1 SMP PREEMPT_DYNAMIC Q4 x86_64 GNU/Linux` : 'SynergyOS');
      case 'clear':
        return { out: [], clear: true };
      case 'history':
        return out(...history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`));
      case 'exit':
      case 'logout':
      case 'quit':
        return { out: ['logout'], exit: true };
      case 'man':
        if (!a[0]) return out('What manual page do you want? (The employee handbook is 900 pages. Pick one.)');
        return out(MAN_PAGES[a[0]] || `No manual entry for ${a[0]}. Have you tried asking in #general?`);
      case 'sudo': {
        const rest = a.join(' ');
        if (rest === 'make me a sandwich') return out('Okay.');
        if (rest === '!!' || rest === 'su' || rest === '-i' || rest === 'su -') return out(`${user} is not in the sudoers file. This incident will be reported to HR.`);
        if (ctx.maxFloor >= FLOORS) return out('You are the CEO. You do not need sudo. You need a yacht.');
        return out(`[sudo] password for ${user}: ********`, `${user} is not in the sudoers file. This incident will be reported to HR.`);
      }
      case 'su':
        return out('su: Authentication failure. (The root password is on a sticky note. Somewhere.)');
      case 'rm':
      case 'rmdir':
        if (a.some((x) => x === '/' || x === '/*') && a.some((x) => x.startsWith('-') && x.includes('r'))) return out('Nice try. The tower is load-bearing.');
        if (!a.filter((x) => !x.startsWith('-')).length) return out(`${cmd}: missing operand`);
        return out(`${cmd}: cannot remove '${a.filter((x) => !x.startsWith('-'))[0]}': Operation not permitted (data retention policy: keep everything forever)`);
      case 'mkdir':
      case 'touch':
      case 'mv':
      case 'cp':
      case 'chmod':
      case 'chown':
        return out(`${cmd}: Read-only file system (corporate policy 4.2.1: no unapproved files)`);
      case 'ps':
      case 'top':
      case 'htop':
        return out('  PID USER      COMMAND', ...PROCESSES.map(([pid, u, c]) => `${pid.padStart(5)} ${(u === '$USER' ? user : u).padEnd(9)} ${c}`), ...(cmd === 'ps' ? [] : ['(press q to quit... just kidding, it already did)']));
      case 'kill':
        return out('kill: Operation not permitted. Processes have feelings and union representation.');
      case 'df':
        return out('Filesystem       Size  Used Avail Use% Mounted on', '/dev/coffee      2.0L  2.0L    0B 100% /kitchen', '/dev/inbox        1T  1.0T    0B 100% /home/' + user + '/mail', '/dev/motivation   10G    0B   10G   0% /soul', 'tmpfs            16G  4.0K   16G   1% /tmp');
      case 'free':
        return out('              total     used     free', 'Mem:            16G      16G       0B   (chat app: 14G)', 'Swap:           2G       2G       0B', 'Patience:      low     high    none');
      case 'ifconfig':
      case 'ip':
        return out(`eth0: inet 10.0.${ctx.floor}.42  netmask 255.255.255.0  (monitored)`, 'vpn0: DOWN (as usual)', 'lo:   inet 127.0.0.1  (there is no place like it)');
      case 'ping': {
        const h = a.find((x) => !x.startsWith('-')) || 'localhost';
        return out(`PING ${h}: 56 data bytes`, ...[1, 2, 3].map((i) => `64 bytes from ${h}: icmp_seq=${i} ttl=64 time=${[420, 69, 1337][i - 1]} ms`), `--- ${h} ping statistics ---`, '3 packets transmitted, 3 received, 0% packet loss, 100% bureaucracy');
      }
      case 'curl':
      case 'wget':
        return out(`${cmd}: blocked by the corporate proxy. Category: "Fun".`);
      case 'ssh':
        return out(`ssh: connect to host ${a[0] || 'nowhere'} port 22: Connection refused (submit access request form 27-B/6)`);
      case 'git': {
        const sub = a[0];
        if (sub === 'status') return out('On branch main', "Your branch is behind 'origin/main' by 4812 commits.", 'nothing to commit, working tree clean (suspiciously)');
        if (sub === 'blame') return out('It was Kevin.');
        if (sub === 'push') return out(' ! [rejected]  main -> main (pushing on a Friday is forbidden)');
        if (sub === 'log') return out('commit 1a2b3c4 "fix" ', 'commit 5d6e7f8 "fix fix"', 'commit 9a0b1c2 "final fix (real)"', 'commit 3d4e5f6 "initial commit (2009)"');
        return out('usage: git <command>. Popular choices: status, log, blame, push.');
      }
      case 'apt':
      case 'apt-get':
      case 'yum':
      case 'brew':
        return out('E: Could not open lock file. Are you root? (You are not. You are an employee.)');
      case 'npm':
        return out('added 1204 packages, and audited 1205 packages in 3m', '87 vulnerabilities (12 moderate, 75 "fine")');
      case 'pip':
        return out('error: externally-managed-environment. Everything here is externally managed.');
      case 'vim':
      case 'vi':
        return out('You are now trapped in vim. Forever. (Just kidding: interactive editors are disabled by IT.)');
      case 'emacs':
        return out('emacs: needs 8 more megabytes of RAM and a beard.');
      case 'nano':
        return out('nano: the only sane choice. Sadly the file system is read-only.');
      case 'python':
      case 'python3':
      case 'node':
        return out(`${cmd}: interactive interpreters are disabled. Last time someone wrote a script that did their job.`);
      case 'make':
        if (a.join(' ') === 'me a sandwich') return out('What? Make it yourself.');
        return out(`make: *** No rule to make target '${a[0] || 'money'}'. Stop.`);
      case 'fortune':
        return out(FORTUNES[Math.floor(((ctx.now || 0) / 1000 + history.length * 7) % FORTUNES.length)]);
      case 'cowsay': {
        const msg = a.join(' ') || 'Moo-ve fast and break things.';
        const bar = '-'.repeat(Math.min(60, msg.length + 2));
        return out(` ${bar}`, `< ${msg} >`, ` ${bar}`, '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||');
      }
      case 'sl':
        return out('A steam locomotive rushes past your desk. Choo choo!', '(You meant ls. Everybody means ls.)');
      case 'neofetch':
        return out(
          `${user}@${host}`,
          '-------------------',
          'OS: SynergyOS 40 (Corporate)',
          `Host: ${ctx.corp || 'Synergy Corp'} Tower`,
          `Floor: ${ctx.floor} - ${floorName(ctx.floor)} (${departmentForFloor(ctx.floor).name})`,
          `Title: ${titleForFloor(ctx.maxFloor)}`,
          'Kernel: 6.6.6-corporate',
          'Shell: bash (corporate edition)',
          'CPU: Intel Pentium II @ 2 meetings/hour',
          'Memory: mostly chat app',
        );
      case 'journalctl':
        if (a.includes('-u')) return out('-- No entries -- (motivation has not logged anything since Monday)');
        return out(...JOURNAL.map((l) => `Oct 10 09:0${JOURNAL.indexOf(l)} ${host} ${l.replace('$USER', user)}`));
      case 'who':
      case 'w':
        return out(`${user.padEnd(10)} tty1   09:07  (you)`, 'ceo        yacht  06:00  (remote, very remote)', 'hr         pts/0  08:00  (watching)');
      case 'find':
        return out('find: searching for meaning...', 'find: 0 results. Try a different department.');
      case 'which':
        if (!a[0]) return out();
        return out(COMMANDS.includes(a[0]) ? `/usr/bin/${a[0]}` : `${a[0]} not found`);
      case 'env':
      case 'printenv':
        return out(...Object.entries(env).map(([k, v]) => `${k}=${v}`));
      case 'alias':
        return out("alias ll='ls -la'", "alias please='sudo'", "alias meeting='sleep 3600'");
      case 'passwd':
        return out('passwd: new password must contain a haiku, a dinosaur and the CEO\'s birthday.');
      case 'reboot':
      case 'shutdown':
      case 'poweroff':
      case 'halt':
        return out(`${cmd}: Interactive authentication required.`, 'Shutdown is scheduled for Friday 17:00, as always.');
      case 'init':
      case 'telinit':
        return out(`${cmd}: runlevels are so 2009. Floors are systemd targets now.`);
      case 'systemctl':
        return systemctl(a);
      case 'coffee':
        return out('coffee: command not found. Did you mean: walk to the kitchen?');
      default:
        return out(`${cmd}: command not found`);
    }
  }

  return {
    user,
    host,
    get cwd() {
      return cwd;
    },
    history,
    prompt: () => `${user}@${host}:${short(cwd)}$ `,
    run(line) {
      const trimmed = String(line).trim();
      if (trimmed) history.push(trimmed);
      const res = { out: [] };
      // `a && b` and `a ; b` run in order; a pipe only supports `| grep X`, `| head` and `| wc -l`.
      for (const part of trimmed.split(/\s*(?:&&|;)\s*/)) {
        const [first, ...pipes] = part.split('|').map((x) => x.trim());
        const r = exec(tokenize(first));
        let lines = r.out;
        for (const p of pipes) {
          const [pc, ...pa] = tokenize(p);
          if (pc === 'grep' && pa[0]) lines = lines.filter((l) => l.toLowerCase().includes(pa[0].toLowerCase()));
          else if (pc === 'head') lines = lines.slice(0, 10);
          else if (pc === 'tail') lines = lines.slice(-10);
          else if (pc === 'wc') lines = [String(lines.length)];
          else if (pc === 'lolcat') lines = lines.map((l) => l);
          else lines = [`${pc}: pipes to "${pc}" are not in this quarter's budget.`];
        }
        res.out.push(...lines);
        if (r.clear) {
          res.clear = true;
          res.out = [];
        }
        if (r.exit) res.exit = true;
        if (r.warp) res.warp = r.warp;
        if (res.exit || res.warp) break;
      }
      return res;
    },
    /** Tab completion: commands for the first word, unit names after `systemctl`, file names otherwise. */
    complete(line) {
      const words = line.split(' ');
      const last = words[words.length - 1];
      let pool;
      if (words.length === 1) pool = COMMANDS;
      else if (words[0] === 'systemctl' && words.length === 2) pool = ['list-units', 'status', 'isolate', 'start', 'stop', 'restart'];
      else if (words[0] === 'systemctl' && words.length === 3) pool = [...Array.from({ length: FLOORS }, (_, i) => levelUnit(i + 1)), 'coffee.service', 'printer.service', 'motivation.service'];
      else {
        const slash = last.lastIndexOf('/');
        const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
        const dir = resolve(dirPart || '.');
        if (!isDir(dir)) return line;
        pool = children(dir).map((n) => dirPart + n + (isDir(resolve(dirPart + n)) ? '/' : ''));
      }
      const hits = pool.filter((c) => c.startsWith(last));
      if (!hits.length) return line;
      let common = hits[0];
      for (const h of hits) while (!h.startsWith(common)) common = common.slice(0, -1);
      const done = hits.length === 1 && !common.endsWith('/') ? ' ' : '';
      words[words.length - 1] = common + done;
      return words.join(' ');
    },
  };
}

function tokenize(s) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(s || ''))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function buildFs({ user, home, host, floor, maxFloor, deptId, corp }) {
  const dir = { dir: true };
  const file = (text, extra = {}) => ({ text, ...extra });
  const prev = Math.max(1, floor - 1);
  return {
    '/': dir,
    '/home': dir,
    [home]: dir,
    [`${home}/README.txt`]: file(`Welcome to your workstation, ${user}.\nThis terminal is monitored for quality and training purposes.\nType "help" if you are lost. Type "exit" to go back to pretending to work.`),
    [`${home}/todo.txt`]: file('TODO\n[ ] answer 412 emails\n[ ] look busy when the manager walks by\n[x] coffee\n[x] coffee\n[ ] ask IT why the elevator runs on systemd\n[ ] find the good stapler'),
    [`${home}/.bash_history`]: file(
      `ls\ncat todo.txt\nsudo make me a sandwich\nsystemctl status coffee\nsystemctl list-units --type=target\nsystemctl isolate ${levelUnit(prev)}   # quick trip, the elevator queue is huge\nhistory -c   # TODO: actually run this before the audit`,
    ),
    [`${home}/.secret`]: file('There is no secret here. Stop looking. (Okay, maybe check your bash history.)'),
    [`${home}/Documents`]: dir,
    [`${home}/Documents/resignation_draft.txt`]: file('Dear Management,\nAfter careful consideration I have decided to\n[draft auto-saved 1,204 days ago]'),
    [`${home}/Documents/salary.xlsx`]: file('', { locked: 'Finance has redacted this file' }),
    [`${home}/Documents/vision_${deptId}.txt`]: file(`${corp || 'Synergy Corp'}: Synergizing tomorrow's ${deptId} paradigms, today.\n(Approved by 14 committees.)`),
    '/etc': dir,
    '/etc/motd': file(`SynergyOS 40 LTS - "Corporate Penthouse"\nFloor ${floor} workstation ${host}.\nReminder: elevator scheduling has migrated to systemd. Every floor is a target. Please do not abuse it.`),
    '/etc/hostname': file(host),
    '/etc/passwd': file(`root:x:0:0:root:/root:/bin/bash\nceo:x:1:1:Chief Executive Officer:/penthouse:/bin/yacht\nhr:x:666:666:Human Resources:/var/hr:/bin/watch\ncoffee:x:42:42:Coffee Daemon:/kitchen:/bin/brew\n${user}:x:1337:100:${titleForFloor(maxFloor)}:${home}:/bin/bash`),
    '/etc/shadow': file('', { locked: 'nice try' }),
    '/etc/systemd': dir,
    '/etc/systemd/system': dir,
    '/etc/systemd/system/coffee.service': file('[Unit]\nDescription=Office Coffee Daemon\n\n[Service]\nExecStart=/usr/bin/brew --forever\nRestart=always'),
    [`/etc/systemd/system/${levelUnit(floor)}`]: file(`[Unit]\nDescription=Floor ${floor} - ${floorName(floor)}\nRequires=coffee.service\nAllowIsolate=yes`),
    '/var': dir,
    '/var/log': dir,
    '/var/log/syslog': file(JOURNAL.join('\n').replace(/\$USER/g, user)),
    '/var/log/hr.log': file(`[09:07] ${user} arrived. 7 minutes late. Noted.\n[10:15] ${user} visited the kitchen. Third time.\n[11:30] ${user} opened a terminal. Interesting...`),
    '/root': { dir: true, locked: true },
    '/tmp': dir,
    '/tmp/definitely_not_a_job_search.txt': file('Positions applied: 3\nInterviews: 0\nCover letter: "Dear Sir or Madam or Algorithm"'),
    '/opt': dir,
    '/opt/synergy': dir,
    '/opt/synergy/elevator.conf': file(`# Elevator controller config\nfloors=${FLOORS}\nbackend=systemd\n# Each floor is a unit named levelNN.target (NN = 01..${FLOORS}).\n# Isolating a target moves the caller there. Do NOT tell the interns.`),
    '/penthouse': { dir: true, locked: 'CEO only' },
  };
}
