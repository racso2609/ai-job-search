import { createHash } from "node:crypto"
import { config } from "./config.js"
import { log } from "./logger.js"
import { runOpencode } from "./opencode.js"
import {
  rankedJobs,
  isNotified,
  markNotified,
  gmailSeen,
  markGmailSeen,
  recordDecision,
} from "./state.js"
import {
  sendSummary,
  sendGmailProposal,
  sendCalendarProposal,
  sendApplication,
  sendMessage,
} from "./telegram.js"
import { runApply, runGmailScan, runCalendar } from "./worker.js"

function shortId(s) {
  return createHash("sha1").update(s).digest("hex").slice(0, 12)
}

// Cycle 1: scrape -> rank -> notify the user on Telegram.
export async function runScrapeCycle() {
  log.info("=== scrape cycle start ===")

  const scrape = await runOpencode("scrape", [])
  if (scrape.code !== 0) {
    log.error(`scrape exited ${scrape.code}${scrape.killed ? " (timeout)" : ""}`)
    log.error(scrape.stderr.slice(-2000))
  } else {
    log.info("scrape done")
  }

  const rank = await runOpencode("rank", [])
  if (rank.code !== 0) {
    log.error(`rank exited ${rank.code}${rank.killed ? " (timeout)" : ""}`)
    log.error(rank.stderr.slice(-2000))
  } else {
    log.info("rank done")
  }

  const candidates = rankedJobs()
    .filter((j) => (j.rank_score ?? 0) >= config.minScore)
    .filter((j) => !isNotified(j.key))
    .slice(0, config.topN)

  const header = `Job scan ${new Date().toISOString().slice(0, 10)}`
  if (!candidates.length) {
    log.info("no new ranked jobs to notify")
    await sendSummary([], { header })
    log.info("=== scrape cycle end ===")
    return
  }

  const delivered = await sendSummary(candidates, { header })
  markNotified(delivered)
  log.info(`notified ${delivered.length}/${candidates.length} job(s)`)
  log.info("=== scrape cycle end ===")
}

// Cycle 2: Gmail watch -> classify -> propose status updates on Telegram.
export async function runGmailCycle() {
  if (!config.enableGmail) return
  log.info("=== gmail cycle start ===")

  const result = await runGmailScan([])
  if (result.ok === false) {
    log.warn(`gmail scan unavailable: ${result.error ?? "no result"}`)
    log.info("=== gmail cycle end ===")
    return
  }

  const seen = new Set(gmailSeen().processed)
  const fresh = (result.proposals ?? []).filter(
    (p) => p.message_id && !seen.has(p.message_id),
  )

  for (const prop of fresh) {
    const id = shortId(prop.message_id)
    await sendGmailProposal(prop, id)
    // Chain a calendar offer for an interview with a concrete time.
    if (
      config.enableCalendar &&
      prop.signal === "interview" &&
      prop.interview_datetime
    ) {
      await sendCalendarProposal(
        {
          company: prop.company,
          role: prop.role,
          datetime: prop.interview_datetime,
          duration_minutes: 45,
          url: prop.url,
          interviewer: prop.interviewer,
        },
        shortId(`${prop.message_id}:cal`),
      )
    }
  }

  const allIds = (result.proposals ?? [])
    .map((p) => p.message_id)
    .filter(Boolean)
  if (allIds.length) markGmailSeen(allIds)

  log.info(
    `gmail: ${fresh.length} new proposal(s), ${result.unmatched?.length ?? 0} unmatched, ${result.conflicts?.length ?? 0} conflict(s)`,
  )
  log.info("=== gmail cycle end ===")
}

// --- Telegram handlers (wired in index.js) ------------------------------------

export async function handleApplyTap(jobKey, meta) {
  if (!config.enableApply) {
    await sendMessage(`Apply is disabled (ENABLE_APPLY=false). Job ${jobKey} recorded.`)
    return
  }
  const url = meta?.url
  if (!url) {
    await sendMessage(`No URL stored for this job - cannot draft automatically.`)
    return
  }
  await sendMessage(`Drafting your application for ${meta.company ?? ""}... this can take a few minutes.`)
  const result = await runApply(url)
  if (result.ok === false) {
    await sendMessage(`Draft failed: ${result.error ?? "unknown error"}`)
    return
  }
  await sendApplication(result)
  recordDecision({
    key: jobKey,
    company: result.company,
    role: result.role,
    url,
    decision: "drafted",
    score: result.fit_score,
  })
}

export async function handleCalendarTap(prop) {
  if (!config.enableCalendar) {
    await sendMessage("Calendar is disabled (ENABLE_CALENDAR=false).")
    return
  }
  const result = await runCalendar(prop)
  if (result.ok === false) {
    await sendMessage(`Calendar event failed: ${result.error ?? "unknown error"}`)
    return
  }
  await sendMessage(
    `Added to calendar: ${result.summary ?? ""}\n${result.html_link ?? ""}`,
  )
}
