#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "RELEASE_MANIFEST.sha256"
EXCLUDED_PARTS = {".git", ".codex", "__pycache__"}
EXCLUDED_NAMES = {MANIFEST.name}


def files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDED_PARTS for part in rel.parts) or rel.name in EXCLUDED_NAMES:
            continue
        yield rel, path


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def render() -> str:
    return "".join(f"{digest(path)}  {rel.as_posix()}\n" for rel, path in files())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    expected = render()
    if args.write:
        MANIFEST.write_text(expected, encoding="utf-8")
        print(f"Wrote {MANIFEST.name} ({len(expected.splitlines())} files)")
        return
    if not MANIFEST.is_file():
        raise SystemExit(f"Missing {MANIFEST.name}; run scripts/release_manifest.py --write")
    actual = MANIFEST.read_text(encoding="utf-8")
    if actual != expected:
        raise SystemExit(f"{MANIFEST.name} is stale; run scripts/release_manifest.py --write")
    print(f"Release manifest check: PASS ({len(expected.splitlines())} files)")

if __name__ == "__main__":
    main()
