import { config } from "./config.js"
import { log } from "./logger.js"
import { runOpencode } from "./opencode.js"

// Extracts the last fenced ```json block from an opencode run's text output.
// The daemon commands are instructed to end with exactly one such block.
export function extractJsonBlock(stdout) {
  const text = textFromStdout(stdout)
  const re = /```json\s*([\s\S]*?)```/g
  let last = null
  let m
  while ((m = re.exec(text))) {
    try {
      last = JSON.parse(m[1])
    } catch {
      // Not valid JSON; keep scanning for a later block.
    }
  }
  return last
}

// opencode --format json streams JSONL events; assistant text lives in
// properties.part.text. Concatenate every text part into one string.
function textFromStdout(stdout) {
  const parts = []
  for (const line of stdout.split("\n")) {
    const t = line.trim()
    if (!t.startsWith("{")) {
      parts.push(line)
      continue
    }
    try {
      const e = JSON.parse(t)
      const txt = e?.properties?.part?.text ?? e?.part?.text
      if (typeof txt === "string") parts.push(txt)
    } catch {
      parts.push(line)
    }
  }
  return parts.join("\n")
}

// Runs a daemon command and returns its parsed JSON result (or null).
async function runCommandJson(name, args) {
  const res = await runOpencode(name, args)
  if (res.code !== 0) {
    log.error(`${name} exited ${res.code}${res.killed ? " (timeout)" : ""}`)
    log.error(res.stderr.slice(-1500))
  }
  const json = extractJsonBlock(res.stdout)
  if (!json) log.warn(`${name}: no JSON result block found in output`)
  return { res, json }
}

// Runs the headless apply for a job URL. Returns the result object or null.
export async function runApply(jobUrl) {
  const { json } = await runCommandJson("daemon-apply", [jobUrl])
  return json
}

// Runs the headless Gmail scan. Returns the result object or null.
export async function runGmailScan(args = []) {
  const { json } = await runCommandJson("daemon-gmail", args)
  return json
}

// Runs the calendar event creation for a proposal. Returns result or null.
export async function runCalendar(event) {
  const { json } = await runCommandJson("daemon-calendar", [
    JSON.stringify(event),
  ])
  return json
}
