#!/usr/bin/env python3
"""Generate .opencode/commands/*.md from .claude/commands/*.md (opencode port).

Faithful copy: body is preserved verbatim. Only adds opencode frontmatter
(description) and a short runtime-note preamble to the two commands that
dispatch subagents (/apply, /rank).
"""
import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[2]
SRC = REPO / ".claude" / "commands"
DST = REPO / ".opencode" / "commands"
DST.mkdir(parents=True, exist_ok=True)

RUNTIME_NOTE = (
    "> **opencode runtime note.** The repo's `Agent` tool is opencode's `task` tool: "
    "dispatch a subagent with `subagent_type: <name>` (the subagents `posting-fetcher`, "
    "`posting-scorer`, and `application-reviewer` are defined in `.opencode/agents/`). "
    "Skills (`.claude/skills/*`, `.agents/skills/*`) load through the `skill` tool. "
    "`SCRATCHPAD` is set by the workspace plugin `.opencode/plugins/scratchpad.js`.\n"
)

# Commands that dispatch subagents and benefit from the runtime note.
NEEDS_NOTE = {"apply", "rank"}


def first_title(text: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            # "# /apply - Drafter-Reviewer Job Application Workflow" -> title after " - "
            m = re.match(r"^#\s+\S+\s*-\s*(.+)$", line)
            return (m.group(1) if m else line[2:]).strip()
    return ""


def main() -> None:
    count = 0
    for src in sorted(SRC.glob("*.md")):
        name = src.stem
        body = src.read_text(encoding="utf-8")
        desc = first_title(body) or name
        front = f"---\ndescription: {desc}\n---\n\n"
        if name in NEEDS_NOTE:
            body = RUNTIME_NOTE + "\n" + body
        (DST / f"{name}.md").write_text(front + body, encoding="utf-8")
        count += 1
    print(f"generated {count} commands -> {DST}")


if __name__ == "__main__":
    main()
