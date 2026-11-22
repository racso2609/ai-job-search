import { existsSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Repo root is the parent of service/.
export const REPO_ROOT = resolve(__dirname, "..", "..")

function req(name) {
  const v = process.env[name]
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var ${name}. See service/.env.example and service/README.md.`,
    )
  }
  return v.trim()
}

function opt(name, fallback) {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : fallback
}

export const config = {
  telegram: {
    token: () => req("TELEGRAM_BOT_TOKEN"),
    chatId: () => req("TELEGRAM_CHAT_ID"),
  },

  // Cron expression for the scrape+rank+notify cycle. Default: 08:00 and 18:00 daily.
  scrapeCron: opt("SCRAPE_CRON", "0 8,18 * * *"),
  // Cron expression for the Gmail watch cycle. Empty disables it.
  gmailCron: opt("GMAIL_CRON", "0 */3 * * *"),
  // Timezone for the cron schedule (node-cron honours this).
  timezone: opt("TZ", "UTC"),

  // Run one cycle immediately on startup, then follow the cron.
  runOnStart: opt("RUN_ON_START", "true") === "true",

  // How many top-ranked jobs to include in the Telegram summary.
  topN: Number.parseInt(opt("TOP_N", "5"), 10),
  // Only notify jobs at or above this rank_score (0-100). 0 = every ranked job.
  minScore: Number.parseInt(opt("MIN_SCORE", "0"), 10),

  // Phase 2 feature flags.
  // When true, an [Apply] tap immediately drafts the application (daemon-apply).
  enableApply: opt("ENABLE_APPLY", "true") === "true",
  // When true, the Gmail watch cron runs the daemon-gmail scan.
  enableGmail: opt("ENABLE_GMAIL", "true") === "true",
  // When true, an approved interview proposal offers a calendar event.
  enableCalendar: opt("ENABLE_CALENDAR", "true") === "true",
  // When true, a free-text Telegram message is answered on demand by the
  // support agent (questions and reports). Turn it off to keep the bot
  // tap-only.
  enableSupport: opt("ENABLE_SUPPORT", "true") === "true",

  // opencode CLI settings.
  opencode: {
    bin: opt("OPENCODE_BIN", "opencode"),
    model: opt("OPENCODE_MODEL", ""), // empty -> opencode default
    // Max wall-clock ms for one opencode run (scrape/rank can be slow).
    timeoutMs: Number.parseInt(opt("OPENCODE_TIMEOUT_MS", "1800000"), 10), // 30 min
  },

  paths: {
    repo: REPO_ROOT,
    seenJobs: join(REPO_ROOT, "job_scraper", "seen_jobs.json"),
    tracker: join(REPO_ROOT, "job_search_tracker.csv"),
    reports: join(REPO_ROOT, "reports"),
    stateDir: opt("STATE_DIR", join(REPO_ROOT, "service", "state")),
    notifyState: "",
    decisions: "",
  },
  // Public base URL of the dashboard, if you serve reports/ over HTTP.
  // Example: https://jobs.example.com/application-dashboard.html
  dashboardUrl: opt("DASHBOARD_URL", ""),
}

config.paths.notifyState = join(config.paths.stateDir, "notify_state.json")
config.paths.decisions = join(config.paths.stateDir, "decisions.jsonl")
config.paths.pending = join(config.paths.stateDir, "pending.json")
config.paths.gmailSeen = join(config.paths.stateDir, "gmail_seen.json")

export function ensureDirs() {
  for (const d of [config.paths.stateDir, config.paths.reports]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
  }
}
