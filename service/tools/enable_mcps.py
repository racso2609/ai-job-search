#!/usr/bin/env python3
"""Enable or disable the gmail/calendar MCP servers in opencode.json.

Usage:
    python3 service/tools/enable_mcps.py enable
    python3 service/tools/enable_mcps.py disable
    python3 service/tools/enable_mcps.py status
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG = ROOT / "opencode.json"
SERVERS = ["gmail", "calendar"]


def load():
    with CONFIG.open(encoding="utf-8") as fh:
        return json.load(fh)


def save(data):
    with CONFIG.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    if action not in ("enable", "disable", "status"):
        print(f"unknown action: {action}", file=sys.stderr)
        return 2

    data = load()
    mcp = data.setdefault("mcp", {})
    missing = [s for s in SERVERS if s not in mcp]

    if action == "status":
        for s in SERVERS:
            state = "missing" if s in missing else ("enabled" if mcp[s].get("enabled") else "disabled")
            print(f"{s}: {state}")
        return 0

    want = action == "enable"
    for s in SERVERS:
        if s in mcp:
            mcp[s]["enabled"] = want
    save(data)
    print(f"{action}d: {', '.join(s for s in SERVERS if s not in missing)}")
    if missing:
        print(f"not found in config: {', '.join(missing)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
