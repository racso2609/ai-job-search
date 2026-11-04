import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { config } from "./config.js"
import { log } from "./logger.js"

// --- seen_jobs.json (read-only from the daemon's perspective) -----------------

export function readSeenJobs() {
  const p = config.paths.seenJobs
  if (!existsSync(p)) return { seen: {} }
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"))
    return raw && typeof raw === "object" && raw.seen ? raw : { seen: {} }
  } catch (e) {
    log.error("seen_jobs.json is not valid JSON:", e.message)
    return { seen: {} }
  }
}

// Ranked jobs that /rank produced, highest score first.
export function rankedJobs() {
  const { seen } = readSeenJobs()
  return Object.entries(seen)
    .map(([key, v]) => ({ key, ...v }))
    .filter((j) => j.status === "ranked" && typeof j.rank_score === "number")
    .sort((a, b) => b.rank_score - a.rank_score)
}

// --- notify state: which job keys we have already alerted on -------------------

function loadNotifyState() {
  const p = config.paths.notifyState
  if (!existsSync(p)) return { notified: [] }
  try {
    const s = JSON.parse(readFileSync(p, "utf8"))
    if (!Array.isArray(s.notified)) s.notified = []
    return s
  } catch {
    return { notified: [] }
  }
}

function saveNotifyState(s) {
  writeFileSync(config.paths.notifyState, JSON.stringify(s, null, 2))
}

export function isNotified(key) {
  return loadNotifyState().notified.includes(key)
}

export function markNotified(keys) {
  const s = loadNotifyState()
  const set = new Set(s.notified)
  for (const k of keys) set.add(k)
  s.notified = [...set]
  saveNotifyState(s)
}
// --- decisions: append-only log of the user's TG choices -----------------------

export function recordDecision({ key, company, role, url, decision, score }) {
  const row = {
    ts: new Date().toISOString(),
    key,
    company: company ?? "",
    role: role ?? "",
    url: url ?? "",
    score: score ?? null,
    decision, // "apply" | "skip"
  }
  appendFileSync(config.paths.decisions, JSON.stringify(row) + "\n")
  log.info(`decision recorded: ${decision} -> ${company} / ${role}`)
}

export function readDecisions() {
  const p = config.paths.decisions
  if (!existsSync(p)) return []
  return readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

// --- pending approvals: proposals awaiting a Telegram tap ----------------------
//
// Maps an opaque id (sent as the button callback data) to the proposal payload,
// so a callback can be resolved back to the exact proposal. Persisted so taps
// that arrive after a restart still resolve.

function loadPending() {
  const p = config.paths.pending
  if (!existsSync(p)) return {}
  try {
    const s = JSON.parse(readFileSync(p, "utf8"))
    return s && typeof s === "object" ? s : {}
  } catch {
    return {}
  }
}

function savePending(map) {
  writeFileSync(config.paths.pending, JSON.stringify(map, null, 2))
}

export function addPending(id, payload) {
  const map = loadPending()
  map[id] = { ...payload, created: new Date().toISOString() }
  savePending(map)
  return id
}

export function getPending(id) {
  return loadPending()[id] ?? null
}

export function removePending(id) {
  const map = loadPending()
  delete map[id]
  savePending(map)
}

// Gmail message ids already classified, so a scan never re-proposes the same
// email. Mirrors gmail_sync/state.json but owned by the daemon.
export function gmailSeen() {
  const p = config.paths.gmailSeen
  if (!existsSync(p)) return { processed: [] }
  try {
    const s = JSON.parse(readFileSync(p, "utf8"))
    if (!Array.isArray(s.processed)) s.processed = []
    return s
  } catch {
    return { processed: [] }
  }
}

export function markGmailSeen(ids) {
  const s = gmailSeen()
  const set = new Set(s.processed)
  for (const id of ids) set.add(id)
  writeFileSync(
    config.paths.gmailSeen,
    JSON.stringify({ processed: [...set] }, null, 2),
  )
}

