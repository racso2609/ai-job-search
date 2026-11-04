import { spawn } from "node:child_process"
import { config } from "./config.js"
import { log } from "./logger.js"

// Runs `opencode run --command <cmd> [args] --format json` inside the repo and
// returns { code, stdout, stderr, events }. The daemon drives the repo's own
// commands headlessly; opencode loads the workspace skills/agents/config.
export function runOpencode(command, args = [], { timeoutMs } = {}) {
  return new Promise((resolve) => {
    const argv = ["run", "--command", command]
    if (args.length) argv.push("--", ...args)
    argv.push("--format", "json")
    if (config.opencode.model) argv.push("--model", config.opencode.model)

    const timeout = timeoutMs ?? config.opencode.timeoutMs
    log.info(`running: ${config.opencode.bin} ${argv.join(" ")}`)

    const child = spawn(config.opencode.bin, argv, {
      cwd: config.paths.repo,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      log.warn(`opencode run ${command} exceeded ${timeout}ms - killing`)
      child.kill("SIGTERM")
      setTimeout(() => child.kill("SIGKILL"), 5000)
    }, timeout)

    child.stdout.on("data", (d) => (stdout += d.toString()))
    child.stderr.on("data", (d) => (stderr += d.toString()))

    child.on("error", (err) => {
      clearTimeout(timer)
      log.error(`failed to spawn ${config.opencode.bin}:`, err.message)
      resolve({ code: -1, stdout, stderr: String(err.message), events: [], killed })
    })

    child.on("close", (code) => {
      clearTimeout(timer)
      const events = parseEvents(stdout)
      resolve({ code, stdout, stderr, events, killed })
    })
  })
}

// opencode --format json emits one JSON object per line (JSONL). Tolerate a
// trailing partial line and non-JSON noise on stdout.
function parseEvents(stdout) {
  const events = []
  for (const line of stdout.split("\n")) {
    const t = line.trim()
    if (!t.startsWith("{")) continue
    try {
      events.push(JSON.parse(t))
    } catch {
      /* partial or non-event line */
    }
  }
  return events
}

// Concatenate the assistant's text parts from the JSONL stream, for logging.
export function textFromEvents(events) {
  const parts = []
  for (const e of events) {
    const txt = e?.properties?.part?.text ?? e?.part?.text
    if (typeof txt === "string") parts.push(txt)
  }
  return parts.join("\n")
}
