#!/usr/bin/env python3
"""VICE remote-monitor probe for the C64 build (tests and debugging, no game logic).

  python3 c64/tools/vmon.py LABEL "m linebuf linebuf+40" ["more commands" ...] [--secs=60] [--hits=1] [--keys=TEXT]
                           [--port=6519] [--d64=path] [--lbl=path]

Starts x64sc (warp, no sound) with the remote monitor on port 6519, sets a breakpoint at LABEL (from
build/main.lbl), autostarts build/synergy.d64 and, each time the breakpoint hits (up to --hits), runs the
commands. Label names in the commands are replaced by their addresses. --keys types text into the keyboard
buffer when the breakpoint first hits (\\n = RETURN), or at the address --keysat (a breakpoint of its own,
removed once used). Prints the monitor output.
"""
import os, re, socket, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
secs = float(opts.get('secs', 60))
hits = int(opts.get('hits', 1))
labels = {}
for line in open(opts.get('lbl', os.path.join(ROOT, 'build', 'main.lbl'))):
    p = line.split()
    if len(p) >= 3 and p[0] == 'al':
        labels[p[2][1:]] = p[1][2:].lower()


def sub(cmd):
    def addr(m):
        name, off = m.group(1), m.group(2)
        if name not in labels:
            return m.group(0)
        return '%04x' % (int(labels[name], 16) + (int(off[1:], 0) if off else 0))
    return re.sub(r'\b([A-Za-z_][A-Za-z0-9_]*)(\+(?:0x)?[0-9a-fA-F]+)?\b', addr, cmd)


label, cmds = args[0], args[1:]
port = int(opts.get('port', 6519))
vice = subprocess.Popen(['x64sc', '-default', '-silent', '-sounddev', 'dummy', '-warp', '-remotemonitor',
                         '-remotemonitoraddress', f'ip4://127.0.0.1:{port}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            s = socket.create_connection(('127.0.0.1', port))
            break
        except OSError:
            time.sleep(0.2)
    s.settimeout(0.5)

    def send(c):
        s.sendall((c + '\n').encode())

    def drain(wait=0.6):
        out = b''
        t = time.time()
        while time.time() - t < wait:
            try:
                d = s.recv(65536)
                if not d:
                    break
                out += d
                t = time.time()
            except socket.timeout:
                pass
        return out.decode(errors='replace')

    drain(1.0)
    keysat = opts.get('keysat')
    if keysat:
        send(f'break exec {labels.get(keysat, keysat)}')
        drain()
    send(f'break exec {labels[label] if label in labels else label}')
    drain()
    send(f'autostart "{opts.get("d64", os.path.join(ROOT, "build", "synergy.d64"))}"')
    drain()
    send('x')
    t0 = time.time()
    n = 0
    buf = ''
    while n < hits and time.time() - t0 < secs:
        try:
            d = s.recv(65536).decode(errors='replace')
        except socket.timeout:
            continue
        buf += d
        if 'Stop on' in buf:
            if keysat and ('exec ' + labels.get(keysat, keysat).lower()) in buf.lower():
                buf = ''
                send('del 1')
                drain()
                send('keybuf ' + opts['keys'].replace('\\n', '\\x0d'))
                print(drain())
                send('x')
                keysat = None
                continue
            n += 1
            buf = ''
            if n == 1 and 'keys' in opts and not opts.get('keysat'):
                send('keybuf ' + opts['keys'].replace('\\n', '\\x0d'))
                print(drain())
            for c in cmds:
                c = c.replace('{n}', str(n))
                if c.startswith('@frames '):  # let it run N frames (a breakpoint on wait_frame, ignored N times)
                    send(f"break exec {labels['wait_frame']}")
                    out = drain()
                    num = re.search(r'BREAK: (\d+)', out) or re.search(r'#(\d+)', out)
                    send(f'ignore {num.group(1)} {c.split()[1]}')
                    drain()
                    send('x')
                    b2 = ''
                    t1 = time.time()
                    while 'Stop on' not in b2 and time.time() - t1 < secs:
                        try:
                            b2 += s.recv(65536).decode(errors='replace')
                        except socket.timeout:
                            pass
                    send(f'del {num.group(1)}')
                    drain()
                    print(f'> {c}')
                    continue
                send(sub(c))
                print(f'> {c}\n' + drain())
            if 'lines' in opts:  # one command per hit, typed at the prompt after the commands above ran
                cmdl = opts['lines'].split(';;')
                if n - 1 < len(cmdl):
                    send('keybuf ' + cmdl[n - 1] + '\\x0d')
                    drain()
            if n < hits:
                send('x')
    if n < hits:
        print(f'(breakpoint hit {n} times in {secs} s)')
    send('quit')
finally:
    time.sleep(0.5)
    vice.kill()
