import { test, expect } from 'bun:test';
import { createShell, loginName, levelUnit } from '../src/core/terminal.js';
import { buildFloor } from '../src/core/tasks.js';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import { measureText } from '../src/engine/font.js';
import { ROLES, FILE_NOTES, FIRST_NAMES, LAST_NAMES } from '../src/data/people.js';

const shell = (floor = 12) => createShell({ user: 'pat', floor, maxFloor: floor, deptId: 'finance', corp: 'Acme', ws: 3, now: 0 });

test('login names are lowercase alphanumerics', () => {
  expect(loginName('Pat O\'Neil!')).toBe('patoneil');
  expect(loginName('')).toBe('newhire');
});

test('systemctl isolate levelXX.target warps to that floor', () => {
  const sh = shell(12);
  const r = sh.run('systemctl isolate level30.target');
  expect(r.warp).toBe(30);
  expect(r.out.some((l) => l.includes('Reached target level30.target'))).toBe(true);
  expect(shell(12).run('systemctl isolate level5.target').warp).toBe(5);
  expect(shell(12).run('systemctl isolate level01.target').warp).toBe(1);
});

test('isolate refuses unknown floors, the current floor and services', () => {
  expect(shell(12).run('systemctl isolate level41.target').warp).toBeUndefined();
  expect(shell(12).run('systemctl isolate level00.target').warp).toBeUndefined();
  expect(shell(12).run('systemctl isolate level12.target').warp).toBeUndefined();
  expect(shell(12).run('systemctl isolate coffee.service').warp).toBeUndefined();
});

test('the secret is discoverable: hidden bash history and target listing', () => {
  const sh = shell(12);
  expect(sh.run('ls').out.join(' ')).not.toContain('.bash_history');
  expect(sh.run('ls -a').out.join(' ')).toContain('.bash_history');
  expect(sh.run('cat .bash_history').out.join('\n')).toContain(`systemctl isolate ${levelUnit(11)}`);
  const units = sh.run('systemctl list-units --type=target').out;
  expect(units.filter((l) => l.startsWith('level')).length).toBe(E.FLOORS);
});

test('basic shell commands work', () => {
  const sh = shell(12);
  expect(sh.run('pwd').out).toEqual(['/home/pat']);
  sh.run('cd /etc');
  expect(sh.run('pwd').out).toEqual(['/etc']);
  expect(sh.run('cat motd').out.join(' ')).toContain('systemd');
  expect(sh.run('cat shadow').out[0]).toContain('Permission denied');
  sh.run('cd ~');
  expect(sh.prompt()).toBe('pat@f12-ws3:~$ ');
  expect(sh.run('nosuchcmd').out[0]).toBe('nosuchcmd: command not found');
  expect(sh.run('echo $USER').out).toEqual(['pat']);
  expect(sh.run('clear').clear).toBe(true);
  expect(sh.run('exit').exit).toBe(true);
  expect(sh.run('cat todo.txt | grep coffee').out.length).toBe(2);
  expect(sh.history.length).toBeGreaterThan(5);
});

test('tab completion completes commands, files and level targets', () => {
  const sh = shell(12);
  expect(sh.complete('syst')).toBe('systemctl ');
  expect(sh.complete('systemctl iso')).toBe('systemctl isolate ');
  expect(sh.complete('systemctl isolate level3')).toBe('systemctl isolate level3');
  expect(sh.complete('systemctl isolate level07')).toBe('systemctl isolate level07.target ');
  expect(sh.complete('cat to')).toBe('cat todo.txt ');
});

test('every floor has exactly one reachable terminal computer without a task', () => {
  for (let f = 1; f <= E.FLOORS; f++) {
    const t = buildFloor(f).items.filter((it) => it.terminal);
    expect(t.length).toBe(1);
    expect(t[0].task).toBeUndefined();
  }
});

test('warpToFloor jumps anywhere and raises the highest floor', () => {
  const s = S.newGame({ playerName: 'Pat' }, 0);
  expect(S.warpToFloor(s, 41).ok).toBe(false);
  expect(S.warpToFloor(s, 25)).toEqual({ ok: true, promoted: true });
  expect([s.floor, s.maxFloor]).toEqual([25, 25]);
  expect(S.warpToFloor(s, 3)).toEqual({ ok: true, promoted: false });
  expect([s.floor, s.maxFloor]).toEqual([3, 25]);
});

test('only the CEO can fire, each colleague only once', () => {
  const s = S.newGame({ playerName: 'Pat' }, 0);
  expect(S.fireEmployee(s, 101, 10).ok).toBe(false);
  s.maxFloor = E.FLOORS;
  const sp = s.sp;
  expect(S.fireEmployee(s, 101, 10).ok).toBe(true);
  expect(s.sp).toBe(sp + 10);
  expect(s.fired[101]).toBe(true);
  expect(S.fireEmployee(s, 101, 10).ok).toBe(false);
  expect(s.stats.fired).toBe(1);
});

test('names, roles and file notes fit their boxes', () => {
  for (const roles of Object.values(ROLES)) for (const r of roles) expect(measureText(r)).toBeLessThanOrEqual(140);
  for (const n of FILE_NOTES) expect(measureText(`File: ${n}`)).toBeLessThanOrEqual(225);
  const longest = Math.max(...FIRST_NAMES.map((f) => measureText(f))) + 4 + Math.max(...LAST_NAMES.map((l) => measureText(l)));
  expect(longest).toBeLessThanOrEqual(140);
});
