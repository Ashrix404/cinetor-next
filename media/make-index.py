#!/usr/bin/env python3
"""Print media/index.json for every file under the given folder: path, bytes, sha256."""
import hashlib, json, os, sys

root = sys.argv[1]
files = []
for dirpath, _, names in os.walk(root):
    for n in sorted(names):
        if n == "index.json":
            continue
        p = os.path.join(dirpath, n)
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        rel = os.path.relpath(p, root).replace(os.sep, "/")
        files.append({"name": n, "path": rel, "bytes": os.path.getsize(p), "sha256": h.hexdigest()})
files.sort(key=lambda x: x["path"])
print(json.dumps({"files": files}, ensure_ascii=False, indent=1))
