#!/usr/bin/env python3
"""Ελάχιστος πελάτης PixelLab MCP-over-HTTP (ίδιο token με το Claude Code).

  pl.py call <tool> '<json args>'        → εκτυπώνει την απάντηση (κείμενο)
  pl.py call <tool> @args.json           → args από αρχείο (για μεγάλα data: URLs)
  pl.py wait <job_id> <out.png> [index]  → περιμένει και κατεβάζει το αποτέλεσμα
  pl.py data <file.png>                  → τυπώνει data: URL του αρχείου

Χρήσιμο για edit_image_pixen/inpaint με data: URLs που δεν χωρούν σε MCP tool call.
"""
import base64, json, sys, time, urllib.request
from pathlib import Path

MCP_URL = 'https://api.pixellab.ai/mcp'
DL = 'https://api.pixellab.ai/mcp/images/{job}/download?index={index}'


def token() -> str:
    cfg = json.load(open(Path.home() / '.claude.json'))
    for scope in [cfg] + list(cfg.get('projects', {}).values()):
        srv = scope.get('mcpServers', {}).get('pixellab')
        if srv and 'headers' in srv:
            return srv['headers']['Authorization']
    raise SystemExit('pixellab token not found in ~/.claude.json')


def mcp_call(name: str, arguments: dict) -> str:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": name, "arguments": arguments}}).encode()
    req = urllib.request.Request(MCP_URL, data=body, method='POST', headers={
        'Authorization': token(), 'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read().decode()
    payload = None
    for line in raw.splitlines():
        if line.startswith('data:'):
            payload = json.loads(line[5:].strip())
    if payload is None:
        payload = json.loads(raw)
    if 'error' in payload:
        raise RuntimeError(payload['error'])
    res = payload['result']
    text = '\n'.join(c['text'] for c in res.get('content', []) if c.get('type') == 'text')
    if res.get('isError'):
        raise RuntimeError(text)
    return text


def data_url(path: str) -> str:
    return 'data:image/png;base64,' + base64.b64encode(Path(path).read_bytes()).decode()


def wait(job: str, out: str, index: int = 0, timeout: int = 900) -> None:
    url = DL.format(job=job, index=index)
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                Path(out).write_bytes(r.read())
            print('saved', out)
            return
        except Exception:
            time.sleep(5)
    raise SystemExit(f'timeout waiting for {job}')


def main(argv):
    if len(argv) < 2:
        print(__doc__); return
    cmd = argv[1]
    if cmd == 'call':
        args = argv[3]
        arguments = json.load(open(args[1:])) if args.startswith('@') else json.loads(args)
        # @file:path μέσα σε τιμές → data URL
        for k, v in list(arguments.items()):
            if isinstance(v, str) and v.startswith('@file:'):
                arguments[k] = data_url(v[6:])
        print(mcp_call(argv[2], arguments))
    elif cmd == 'wait':
        wait(argv[2], argv[3], int(argv[4]) if len(argv) > 4 else 0)
    elif cmd == 'data':
        print(data_url(argv[2]))
    else:
        print(__doc__)


if __name__ == '__main__':
    main(sys.argv)
