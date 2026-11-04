import { config } from "./config.js"
import { log } from "./logger.js"
import { runOpencode, textFromEvents } from "./opencode.js"
import { rankedJobs, isNotified, markNotified } from "./state.js"
import { sendSummary } from "./telegram.js"

// One full cycle: scrape -> rank -> notify the user on Telegram.
export async function runCycle() {
  log.info("=== cycle start ===")

  const scrape = await runOpencode("scrape", [])
  if (scrape.code !== 0) {
    log.error(`scrape exited ${scrape.code}${scrape.killed ? " (timeout)" : ""}`)
    log.error(scrape.stderr.slice(-2000))
    // Continue: rank may still surface jobs from previous scrapes.
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

  // Select jobs to notify: ranked, above threshold, not already alerted.
  const candidates = rankedJobs()
    .filter((j) => (j.rank_score ?? 0) >= config.minScore)
    .filter((j) => !isNotified(j.key))
    .slice(0, config.topN)

  if (!candidates.length) {
    log.info("no new ranked jobs to notify")
    await sendSummary([], {
      header: `Job scan ${new Date().toISOString().slice(0, 10)}`,
    })
    log.info("=== cycle end ===")
    return
  }

  await sendSummary(candidates, {
    header: `Job scan ${new Date().toISOString().slice(0, 10)}`,
  })
  markNotified(candidates.map((j) => j.key))
  log.info(`notified ${candidates.length} job(s)`)
  log.info("=== cycle end ===")
}
