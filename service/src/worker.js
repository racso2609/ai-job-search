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

// --- Degeneration detection ---------------------------------------------------
//
// A long run can end without its final JSON block for two reasons that are both
// model failures, not workflow failures, so retrying is the right response:
//
//   1. The model degenerates into emitting tool-call markup as plain text
//      (`</invoke>`, `</parameter>`, `</result>` repeated hundreds of times).
//      opencode never parses that markup, so the turn ends with no result.
//   2. The model burns its whole output budget on reasoning (`reason: "length"`
//      with zero output tokens) and never reaches the final block.
//
// A healthy run emits at most a handful of these tags (they only appear inside
// example fences), so a high count is unambiguous evidence of degeneration.
const DEGENERATE_MARKUP = /<\/(?:invoke|parameter|result)>/g
const DEGENERATE_MARKUP_THRESHOLD = 20
const RETRY_DELAY_MS = 5000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Classifies why a run produced no JSON result. Returns { reason, retryable }.
export function diagnoseMissingResult(res) {
  const text = textFromStdout(res.stdout)
  const markup = (text.match(DEGENERATE_MARKUP) ?? []).length
  if (markup >= DEGENERATE_MARKUP_THRESHOLD) {
    return {
      reason: `model degenerated into ${markup} raw markup tags instead of a result`,
      retryable: true,
    }
  }

  // Look for a step that exhausted the output budget without emitting text.
  const events = res.events ?? []
  for (const e of events) {
    const part = e?.part ?? e?.properties?.part
    if (part?.type !== "step-finish") continue
    const tokens = part.tokens ?? {}
    const output = tokens.output ?? 0
    if (part.reason === "length" && output === 0) {
      return {
        reason: "model exhausted its output budget on reasoning and never emitted a result",
        retryable: true,
      }
    }
  }

  if (res.killed) {
    return { reason: `run exceeded its time budget`, retryable: false }
  }
  if (res.code !== 0) {
    return { reason: `run exited ${res.code}`, retryable: false }
  }
  return { reason: "run finished without a JSON result block", retryable: true }
}

// Runs a daemon command and returns its parsed JSON result (or null).
//
// Retries once when the failure is a model degeneration: a fresh session usually
// completes, and a retry is far cheaper than a silently dropped application.
async function runCommandJson(name, args, { attempts = 2 } = {}) {
  let res
  let diag
  for (let attempt = 1; attempt <= attempts; attempt++) {
    res = await runOpencode(name, args)
    if (res.code !== 0) {
      log.error(`${name} exited ${res.code}${res.killed ? " (timeout)" : ""}`)
      log.error(res.stderr.slice(-1500))
    }

    const json = extractJsonBlock(res.stdout)
    if (json) {
      if (attempt > 1) log.info(`${name}: succeeded on attempt ${attempt}`)
      return { res, json, diag: null }
    }

    diag = diagnoseMissingResult(res)
    log.warn(`${name}: no JSON result block (attempt ${attempt}/${attempts}) - ${diag.reason}`)

    if (!diag.retryable || attempt === attempts) break
    log.info(`${name}: retrying in ${RETRY_DELAY_MS}ms`)
    await sleep(RETRY_DELAY_MS)
  }
  return { res, json: null, diag }
}

// Runs the headless apply for a job URL. Returns the result object, or
// { ok: false, error } when the run produced no usable result.
export async function runApply(jobUrl) {
  const { json, diag } = await runCommandJson("daemon-apply", [jobUrl])
  if (!json) return { ok: false, error: diag?.reason ?? "drafting produced no result" }
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
