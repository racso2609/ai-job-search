// Cold-start self-check. Verifies the environment is ready to run the daemon
// before it is started. Run directly or via the installer:
//
//   bun run service/src/preflight.js
//
// Exit 0 = all critical checks pass. Exit 1 = a critical check failed.
// Warnings (non-critical) never fail the run.

import { spawnSync } from "node:child_process"
import { existsSync, accessSync, constants } from "node:fs"
import { config, ensureDirs } from "./config.js"

ensureDirs()

const results = []
let criticalFail = false

function check(name, fn, { critical = true, hint = "" } = {}) {
  let outcome
  try {
    outcome = fn()
  } catch (e) {
    outcome = { ok: false, detail: e?.message ?? String(e) }
  }
  if (outcome === true) outcome = { ok: true, detail: "" }
  const ok = outcome?.ok === true
  results.push({ name, ok, critical, detail: outcome?.detail ?? "", hint })
  if (!ok && critical) criticalFail = true
}

function which(bin) {
  const r = spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8" })
  return r.status === 0 ? r.stdout.trim() : ""
}

function version(bin, arg = "--version") {
  const r = spawnSync(bin, [arg], { encoding: "utf8" })
  return r.status === 0 ? (r.stdout || r.stderr).trim().split("\n")[0] : ""
}

// --- checks -------------------------------------------------------------------

check("bun", () => {
  const v = version(which("bun") || "bun")
  return v ? { ok: true, detail: v } : { ok: false, detail: "bun not found on PATH" }
}, { hint: "https://bun.sh" })

check("python3", () => {
  const v = version(which("python3") || "python3")
  return v ? { ok: true, detail: v } : { ok: false, detail: "python3 not found on PATH" }
})

check("opencode", () => {
  const bin = config.opencode.bin
  const path = which(bin)
  if (!path) return { ok: false, detail: `${bin} not found on PATH` }
  const v = version(path)
  return { ok: true, detail: v || path }
}, { hint: "https://opencode.ai" })

check("repo: job_scraper/ seen_jobs.json", () => {
  // Not required to exist on a first run, but the dir must.
  const dir = `${config.paths.repo}/job_scraper`
  return existsSync(dir)
    ? { ok: true, detail: config.paths.seenJobs }
    : { ok: false, detail: "job_scraper/ missing - is the repo complete?" }
})

check("state dir writable", () => {
  try {
    accessSync(config.paths.stateDir, constants.W_OK)
    return { ok: true, detail: config.paths.stateDir }
  } catch (e) {
    return { ok: false, detail: e.message }
  }
})

check("TELEGRAM_BOT_TOKEN set", () => {
  const t = process.env.TELEGRAM_BOT_TOKEN
  return t && t.includes(":")
    ? { ok: true, detail: "present" }
    : { ok: false, detail: "missing or malformed (expected <id>:<secret>)" }
}, { hint: "service/.env" })

check("TELEGRAM_CHAT_ID set", () => {
  const t = process.env.TELEGRAM_CHAT_ID
  return t && t.trim()
    ? { ok: true, detail: "present" }
    : { ok: false, detail: "missing" }
}, { hint: "service/.env" })

check("opencode commands discoverable", () => {
  // Verify the command files exist, then confirm opencode parses the config.
  const dir = `${config.paths.repo}/.opencode/commands`
  const want = ["scrape", "rank", "daemon-apply", "daemon-gmail", "daemon-calendar"]
  const missing = want.filter((c) => !existsSync(`${dir}/${c}.md`))
  if (missing.length) return { ok: false, detail: `missing files: ${missing.join(", ")}` }
  const r = spawnSync(config.opencode.bin, ["debug", "config"], {
    encoding: "utf8",
    cwd: config.paths.repo,
    timeout: 60000,
  })
  if (r.error || r.status !== 0) {
    return { ok: false, detail: "opencode debug config failed" }
  }
  return { ok: true, detail: `${want.length} command files present` }
})

check("workspace agents load", () => {
  const r = spawnSync(config.opencode.bin, ["agent", "list"], {
    encoding: "utf8",
    cwd: config.paths.repo,
    timeout: 60000,
  })
  const out = `${r.stdout || ""}${r.stderr || ""}`
  const want = ["posting-fetcher", "posting-scorer", "application-reviewer"]
  const missing = want.filter((a) => !out.includes(a))
  return missing.length === 0
    ? { ok: true, detail: "3 agents found" }
    : { ok: false, detail: `missing: ${missing.join(", ")}` }
})

check("latex (lualatex)", () => {
  const v = version(which("lualatex") || "lualatex")
  return v ? { ok: true, detail: v } : { ok: false, detail: "not found - PDF compile will not work" }
}, { critical: false, hint: "needed only for /apply; bundled in the Docker image" })

check("latex (xelatex)", () => {
  const v = version(which("xelatex") || "xelatex")
  return v ? { ok: true, detail: v } : { ok: false, detail: "not found - cover letter compile will not work" }
}, { critical: false, hint: "needed only for /apply; bundled in the Docker image" })

check("pypdf / pdftotext (ATS check)", () => {
  const pdft = which("pdftotext")
  if (pdft) return { ok: true, detail: "pdftotext present" }
  const r = spawnSync("python3", ["-c", "import pypdf"], { encoding: "utf8" })
  return r.status === 0
    ? { ok: true, detail: "pypdf present" }
    : { ok: false, detail: "neither pypdf nor pdftotext - ATS check degrades" }
}, { critical: false })

// Gmail/Calendar MCP are optional: warn when not enabled/authenticated.
function mcpStatus(server) {
  const r = spawnSync(config.opencode.bin, ["mcp", "list"], {
    encoding: "utf8",
    cwd: config.paths.repo,
    timeout: 60000,
  })
  const out = `${r.stdout || ""}${r.stderr || ""}`.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b\[[0-9;]*m/g,
    "",
  )
  const re = new RegExp(`${server}\\s+(connected|disabled|failed|error)`, "i")
  const m = out.match(re)
  return m ? m[1].toLowerCase() : ""
}

check("MCP: gmail connected", () => {
  const s = mcpStatus("gmail")
  if (s === "connected") return { ok: true, detail: "connected" }
  return { ok: false, detail: s || "not configured" }
}, { critical: false, hint: "enable in opencode.json + 'opencode mcp auth gmail' (see service/INSTALL.md)" })

check("MCP: calendar connected", () => {
  const s = mcpStatus("calendar")
  if (s === "connected") return { ok: true, detail: "connected" }
  return { ok: false, detail: s || "not configured" }
}, { critical: false, hint: "enable in opencode.json + 'opencode mcp auth calendar' (see service/INSTALL.md)" })

// --- report -------------------------------------------------------------------

export function getResults() {
  return results
}

export function report() {
  const line = "\u2500".repeat(60)
  console.log(`\n${line}\nPreflight self-check\n${line}`)
  for (const r of results) {
    const mark = r.ok ? "PASS" : r.critical ? "FAIL" : "WARN"
    console.log(`[${mark}] ${r.name}${r.detail ? ` - ${r.detail}` : ""}`)
    if (!r.ok && r.hint) console.log(`       hint: ${r.hint}`)
  }
  console.log(line)
  const crit = results.filter((r) => !r.ok && r.critical).length
  const warn = results.filter((r) => !r.ok && !r.critical).length
  console.log(
    crit === 0
      ? `Ready. ${warn} warning(s).\n`
      : `Not ready: ${crit} critical check(s) failed, ${warn} warning(s).\n`,
  )
  return crit === 0
}

// Only run when executed directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = report()
  process.exit(ok ? 0 : 1)
}
