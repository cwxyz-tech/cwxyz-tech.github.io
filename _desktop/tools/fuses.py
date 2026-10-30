"""Sets Electron's security fuses in a built app binary (same idea as @electron/fuses). usage: fuses.py BINARY"""
import sys
SENT = b"dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"
WANT = {0: b"0",   # RunAsNode: no running the app as a plain Node.js engine (ELECTRON_RUN_AS_NODE)
        1: b"1",   # EnableCookieEncryption
        2: b"0",   # EnableNodeOptionsEnvironmentVariable: ignore NODE_OPTIONS
        3: b"0",   # EnableNodeCliInspectArguments: ignore --inspect / --inspect-brk (no attaching a debugger)
        7: b"0"}   # GrantFileProtocolExtraPrivileges: file:// pages get no extra powers
f = sys.argv[1]
d = bytearray(open(f, "rb").read())
i = d.find(SENT)
assert i >= 0 and d.find(SENT, i + 1) < 0, "fuse sentinel not found exactly once"
assert d[i + len(SENT)] == 1, "unknown fuse version"
base, n = i + len(SENT) + 2, d[i + len(SENT) + 1]
for k, v in WANT.items():
    assert k < n and d[base + k] in b"01r"
    d[base + k] = v[0]
open(f, "wb").write(d)
print("fuses now:", bytes(d[base:base + n]).decode())
