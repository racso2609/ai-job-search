import cron from "node-cron"
import { config, ensureDirs } from "./config.js"
import { log } from "./logger.js"
import { startBot } from "./telegram.js"
import { runCycle } from "./pipeline.js"

const once = process.argv.includes("--once")

async function main() {
  ensureDirs()

  if (once) {
    log.info("--once: running a single cycle without the Telegram bot")
    await runCycle()
    process.exit(0)
  }

  startBot()

  if (!cron.validate(config.scrapeCron)) {
    log.error(`invalid SCRAPE_CRON "${config.scrapeCron}"`)
    process.exit(1)
  }

  cron.schedule(
    config.scrapeCron,
    () => {
      runCycle().catch((e) => log.error("cycle failed:", e?.stack ?? e))
    },
    { timezone: config.timezone },
  )

  log.info(`scheduler active: "${config.scrapeCron}" (${config.timezone})`)

  if (config.runOnStart) {
    runCycle().catch((e) => log.error("initial cycle failed:", e?.stack ?? e))
  }

  process.on("SIGTERM", () => {
    log.info("SIGTERM received, exiting")
    process.exit(0)
  })
  process.on("SIGINT", () => {
    log.info("SIGINT received, exiting")
    process.exit(0)
  })
}

main().catch((e) => {
  log.error("fatal:", e?.stack ?? e)
  process.exit(1)
})
