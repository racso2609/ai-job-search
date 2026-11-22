import cron from "node-cron"
import { config, ensureDirs } from "./config.js"
import { log } from "./logger.js"
import { startBot, setHandlers } from "./telegram.js"
import { Queue } from "./queue.js"
import {
  runScrapeCycle,
  runGmailCycle,
  handleApplyTap,
  handleCalendarTap,
  handleSupportMessage,
} from "./pipeline.js"

const once = process.argv.includes("--once")

// One shared queue: only one opencode run happens at a time.
const queue = new Queue()

function enqueueCycle(name, fn) {
  // Queue.push() returns the job id (not a promise); job failures are caught,
  // logged and emitted as "failed" by Queue.#drain(). Guard the synchronous
  // path too: a throw here would escape the cron callback and main()'s catch.
  try {
    queue.push(name, fn)
  } catch (err) {
    log.error(`enqueue ${name} failed:`, err?.stack ?? err)
  }
}

async function main() {
  ensureDirs()

  if (once) {
    log.info("--once: running the scrape cycle without the bot")
    await runScrapeCycle()
    process.exit(0)
  }

  // Route Telegram taps into the queue so they never run in parallel with a
  // scheduled cycle.
  setHandlers({
    onApply: (jobKey, meta) => enqueueCycle(`apply ${jobKey}`, () => handleApplyTap(jobKey, meta)),
    onCalendarApprove: (prop) => enqueueCycle(`calendar ${prop.company}`, () => handleCalendarTap(prop)),
    onGmailApprove: null, // Gmail approval writes are done by the user via /outcome, not here
    // Free-text messages: the daemon answers questions and builds reports on
    // demand. Same single queue, so a support turn never runs in parallel with
    // a scrape cycle.
    onSupport: config.enableSupport
      ? (text) => enqueueCycle("support", () => handleSupportMessage(text))
      : null,
  })

  startBot()

  if (!cron.validate(config.scrapeCron)) {
    log.error(`invalid SCRAPE_CRON "${config.scrapeCron}"`)
    process.exit(1)
  }
  cron.schedule(
    config.scrapeCron,
    () => enqueueCycle("scrape-cycle", runScrapeCycle),
    { timezone: config.timezone },
  )
  log.info(`scrape scheduler: "${config.scrapeCron}" (${config.timezone})`)

  if (config.enableGmail) {
    if (!cron.validate(config.gmailCron)) {
      log.error(`invalid GMAIL_CRON "${config.gmailCron}" - gmail watch disabled`)
    } else {
      cron.schedule(
        config.gmailCron,
        () => enqueueCycle("gmail-cycle", runGmailCycle),
        { timezone: config.timezone },
      )
      log.info(`gmail scheduler: "${config.gmailCron}" (${config.timezone})`)
    }
  }

  if (config.runOnStart) {
    enqueueCycle("initial-scrape", runScrapeCycle)
  }

  const shutdown = () => {
    log.info("shutting down")
    process.exit(0)
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((e) => {
  log.error("fatal:", e?.stack ?? e)
  process.exit(1)
})
