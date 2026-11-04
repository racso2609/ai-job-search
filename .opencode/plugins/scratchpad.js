// Injects the SCRATCHPAD environment variable that the AI Job Search workflow
// expects (Claude Code exposes it in its system prompt; opencode does not).
//
// Several commands and subagents write fetched, untrusted pages to
// "${SCRATCHPAD}/...". With the variable unset, `${SCRATCHPAD:?set this...}`
// makes the shell command fail. This plugin sets it to a stable, out-of-tree
// temp directory for every shell execution (AI tool calls and user terminals).
//
// Override by exporting SCRATCHPAD yourself before starting opencode.

import { tmpdir } from "node:os"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

export const ScratchpadPlugin = async () => {
  const scratchpad = process.env.SCRATCHPAD || join(tmpdir(), "ai-job-search")
  try {
    mkdirSync(scratchpad, { recursive: true })
  } catch {
    // Best effort. The workflow's tools create the dir too if needed.
  }
  return {
    "shell.env": async (input, output) => {
      output.env.SCRATCHPAD = scratchpad
    },
  }
}
