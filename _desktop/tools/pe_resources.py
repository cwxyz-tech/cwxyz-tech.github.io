"""
Replaces the icon and version info of a Windows .exe from Linux, with no Windows tools.

usage: python3 pe_resources.py IN.exe OUT.exe compiled.res

The exe's existing resources are read, the icon (RT_ICON / RT_GROUP_ICON) and version info (RT_VERSION)
are swapped for the ones in the .res file (compiled from an .rc with llvm-rc), and the whole resource tree is
written into a new section at the end of the file. The resource data directory is pointed at the new
section; the old .rsrc bytes are simply left unused. Only for unsigned exes (it refuses signed ones).
"""
import struct
import sys

RT_ICON, RT_GROUP_ICON, RT_VERSION = 3, 14, 16


def align(n, a):
    return (n + a - 1) // a * a


# ---------- reading ----------

class PE:
    def __init__(self, data):
        self.d = bytearray(data)
        d = self.d
        assert d[:2] == b"MZ", "not an exe"
        self.pe = struct.unpack_from("<I", d, 0x3C)[0]
        assert d[self.pe:self.pe + 4] == b"PE\0\0", "not a PE file"
        self.nsec = struct.unpack_from("<H", d, self.pe + 6)[0]
        optsz = struct.unpack_from("<H", d, self.pe + 20)[0]
        self.opt = self.pe + 24
        assert struct.unpack_from("<H", d, self.opt)[0] == 0x20B, "expected a 64-bit exe"
        self.salign, self.falign = struct.unpack_from("<II", d, self.opt + 32)
        self.dd = self.opt + 112
        self.sec = self.opt + optsz

    def sections(self):
        out = []
        for i in range(self.nsec):
            o = self.sec + 40 * i
            name = bytes(self.d[o:o + 8]).rstrip(b"\0").decode("latin-1")
            vs, va, rs, ra = struct.unpack_from("<IIII", self.d, o + 8)
            out.append(dict(name=name, vsize=vs, va=va, rsize=rs, raw=ra, off=o))
        return out

    def rva_to_off(self, rva):
        for s in self.sections():
            if s["va"] <= rva < s["va"] + max(s["vsize"], s["rsize"]):
                return rva - s["va"] + s["raw"]
        raise ValueError("RVA %x not in any section" % rva)

    def data_dir(self, i):
        return struct.unpack_from("<II", self.d, self.dd + 8 * i)


def read_resources(pe):
    """-> {type: {name: {lang: bytes}}}; type/name are ints or strings."""
    rva, size = pe.data_dir(2)
    base = pe.rva_to_off(rva)
    d = pe.d

    def key(name_field):
        if name_field & 0x80000000:
            o = base + (name_field & 0x7FFFFFFF)
            n = struct.unpack_from("<H", d, o)[0]
            return bytes(d[o + 2:o + 2 + 2 * n]).decode("utf-16-le")
        return name_field

    def walk(off, depth):
        named, ids = struct.unpack_from("<HH", d, base + off + 12)
        out = {}
        for i in range(named + ids):
            nf, of = struct.unpack_from("<II", d, base + off + 16 + 8 * i)
            k = key(nf)
            if of & 0x80000000:
                out[k] = walk(of & 0x7FFFFFFF, depth + 1)
            else:
                drva, dsize = struct.unpack_from("<II", d, base + of)
                o = pe.rva_to_off(drva)
                out[k] = bytes(d[o:o + dsize])
        return out

    return walk(0, 0)


def read_res_file(data):
    """Parses a compiled .res file -> {type: {name: {lang: bytes}}}."""
    out, o = {}, 0

    def ident(o):
        if struct.unpack_from("<H", data, o)[0] == 0xFFFF:
            return struct.unpack_from("<H", data, o + 2)[0], o + 4
        end = o
        while struct.unpack_from("<H", data, end)[0] != 0:
            end += 2
        return data[o:end].decode("utf-16-le"), end + 2

    while o + 8 <= len(data):
        dsize, hsize = struct.unpack_from("<II", data, o)
        typ, p = ident(o + 8)
        name, p = ident(p)
        p = align(p - o, 4) + o
        lang = struct.unpack_from("<H", data, p + 6)[0]
        body = data[o + hsize:o + hsize + dsize]
        if dsize:
            out.setdefault(typ, {}).setdefault(name, {})[lang] = body
        o = align(o + hsize + dsize, 4)
    return out


# ---------- writing ----------

def sort_keys(keys):
    named = sorted([k for k in keys if isinstance(k, str)], key=lambda s: s.upper())
    ids = sorted(k for k in keys if isinstance(k, int))
    return named, ids


def build_rsrc(tree, section_rva):
    """Serializes a resource tree into the bytes of a resource section placed at section_rva."""
    dirs, strings, leaves = [], {}, []

    # lay out directories breadth-first so every directory's position is known
    def collect(node):
        named, ids = sort_keys(node.keys())
        entry = {"node": node, "keys": named + ids, "named": len(named), "ids": len(ids)}
        dirs.append(entry)
        for k in named + ids:
            if isinstance(k, str):
                strings.setdefault(k, None)
        return entry

    queue = [collect(tree)]
    while queue:
        nxt = []
        for e in queue:
            e["children"] = []
            for k in e["keys"]:
                v = e["node"][k]
                if isinstance(v, dict):
                    c = collect(v)
                    e["children"].append(c)
                    nxt.append(c)
                else:
                    leaf = {"data": v}
                    leaves.append(leaf)
                    e["children"].append(leaf)
        queue = nxt

    off = 0
    for e in dirs:
        e["off"] = off
        off += 16 + 8 * len(e["keys"])
    for s in strings:
        strings[s] = off
        off += 2 + 2 * len(s)
    off = align(off, 4)
    for leaf in leaves:
        leaf["entry"] = off
        off += 16
    for leaf in leaves:
        off = align(off, 8)
        leaf["at"] = off
        off += len(leaf["data"])
    out = bytearray(align(off, 8))

    for e in dirs:
        struct.pack_into("<IIHHHH", out, e["off"], 0, 0, 4, 0, e["named"], e["ids"])
        for i, (k, c) in enumerate(zip(e["keys"], e["children"])):
            name_field = (0x80000000 | strings[k]) if isinstance(k, str) else k
            target = (0x80000000 | c["off"]) if "off" in c and "keys" in c else c["entry"]
            struct.pack_into("<II", out, e["off"] + 16 + 8 * i, name_field, target)
    for s, o in strings.items():
        enc = s.encode("utf-16-le")
        struct.pack_into("<H", out, o, len(s))
        out[o + 2:o + 2 + len(enc)] = enc
    for leaf in leaves:
        struct.pack_into("<IIII", out, leaf["entry"], section_rva + leaf["at"], len(leaf["data"]), 0, 0)
        out[leaf["at"]:leaf["at"] + len(leaf["data"])] = leaf["data"]
    return bytes(out)


def patch(exe_in, exe_out, res_path):
    pe = PE(open(exe_in, "rb").read())
    sec_rva, sec_size = pe.data_dir(4)
    if sec_rva or sec_size:
        sys.exit("This exe is code-signed; patching would break the signature. Refusing.")

    tree = read_resources(pe)
    new = read_res_file(open(res_path, "rb").read())
    for t in (RT_ICON, RT_GROUP_ICON, RT_VERSION):
        if t in new:
            tree[t] = new[t]

    secs = pe.sections()
    last = max(secs, key=lambda s: s["va"])
    new_rva = align(last["va"] + max(last["vsize"], last["rsize"]), pe.salign)
    blob = build_rsrc(tree, new_rva)
    raw_size = align(len(blob), pe.falign)
    file_end = align(max(s["raw"] + s["rsize"] for s in secs), pe.falign)
    if len(pe.d) > file_end:
        sys.exit("The exe has extra data after its last section; refusing to patch.")

    hdr_end = pe.sec + 40 * (pe.nsec + 1)
    size_of_headers = struct.unpack_from("<I", pe.d, pe.opt + 60)[0]
    assert hdr_end <= size_of_headers, "no room for another section header"
    assert pe.d[hdr_end - 40:hdr_end] == bytes(40), "the space for a new section header isn't empty"

    o = hdr_end - 40
    pe.d[o:o + 8] = b".cgrsrc\0"
    # VirtualSize, VirtualAddress, SizeOfRawData, PointerToRawData, relocs, linenums, nrelocs, nlines, characteristics
    struct.pack_into("<IIIIIIHHI", pe.d, o + 8, len(blob), new_rva, raw_size, file_end, 0, 0, 0, 0, 0x40000040)
    struct.pack_into("<H", pe.d, pe.pe + 6, pe.nsec + 1)
    struct.pack_into("<I", pe.d, pe.opt + 56, align(new_rva + len(blob), pe.salign))            # SizeOfImage
    struct.pack_into("<I", pe.d, pe.opt + 16, struct.unpack_from("<I", pe.d, pe.opt + 16)[0] + raw_size)  # SizeOfInitializedData
    struct.pack_into("<II", pe.d, pe.dd + 16, new_rva, len(blob))                               # resource directory
    out = pe.d[:file_end] + blob + bytes(raw_size - len(blob))

    # PE checksum (not required for apps, but keep it correct)
    struct.pack_into("<I", out, pe.opt + 64, 0)
    import array, sys as _sys
    even = len(out) - len(out) % 2
    words = array.array("H", bytes(out[:even]))
    if _sys.byteorder == "big":
        words.byteswap()
    total = sum(words)
    if len(out) % 2:
        total += out[-1]
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    struct.pack_into("<I", out, pe.opt + 64, (total + len(out)) & 0xFFFFFFFF)

    open(exe_out, "wb").write(out)
    return tree


if __name__ == "__main__":
    t = patch(sys.argv[1], sys.argv[2], sys.argv[3])
    print("resource types:", sorted(t.keys(), key=str))
