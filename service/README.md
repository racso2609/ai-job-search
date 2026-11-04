# AI Job Search — background service (v1)

Runs the job-search loop unattended on your server and pings you on Telegram
when new jobs are found. You decide per job, in Telegram, whether to apply.

## What v1 does

```
cron (SCRAPE_CRON)
   │
   ▼
opencode run --command scrape   →  job_scraper/seen_jobs.json
   │
   ▼
opencode run --command rank     →  seen_jobs.json entries get rank_score, status=ranked
   │
   ▼
daemon reads ranked jobs above MIN_SCORE that it has not alerted on yet
   │
   ▼
Telegram: one batch summary (top-N) + a message per job with [Apply] [Skip]
   │
   ▼
your tap  →  appended to service/state/decisions.jsonl
```

v1 **records** your decision. It does **not** yet run `/apply`, watch Gmail, or
create calendar events — that is v2 (see "Roadmap").

## How it reuses the repo

The daemon is intentionally thin. It does not reimplement any job-search logic:
it shells out to `opencode run --command <name>`, which loads the workspace's
own skills, agents and `opencode.json` exactly as the interactive flow does.
The decision channel is the only new surface.

## Prerequisites

- A Telegram bot token and your chat id (see `service/.env.example`).
- opencode configured with an AI provider (the same config you use interactively).
- Docker + Docker Compose (recommended), or Bun 1.3+ for a bare run.

## Run with Docker (recommended)

```bash
cp service/.env.example service/.env
$EDITOR service/.env              # fill TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, provider key

docker compose -f service/docker-compose.yml up -d --build
docker compose -f service/docker-compose.yml logs -f
```

The compose file bind-mounts the repo into the container, so your profile, CVs,
`seen_jobs.json`, tracker and the `service/state/` decisions all persist on the
host. Provider auth is cached in the `opencode-data` volume.

## Run without Docker (Bun)

```bash
cd service && bun install
cp .env.example .env && $EDITOR .env
bun run start          # long-running daemon (bot + cron)
bun run once           # one scrape+rank+notify cycle, no bot (smoke test)
```

`bun run once` is the fastest way to verify the opencode bridge works before
wiring up Telegram.

## Configuration

All knobs are environment variables (see `service/.env.example`):

| Var | Default | Meaning |
|-----|---------|---------|
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather (required) |
| `TELEGRAM_CHAT_ID` | — | Your chat id (required) |
| `SCRAPE_CRON` | `0 8,18 * * *` | Cron for the cycle |
| `TZ` | `UTC` | Timezone for the cron |
| `RUN_ON_START` | `true` | Run one cycle at container start |
| `TOP_N` | `5` | Jobs per Telegram summary |
| `MIN_SCORE` | `0` | Only notify `rank_score` >= this (0-100) |
| `DASHBOARD_URL` | — | Public URL of `reports/application-dashboard.html` |
| `OPENCODE_MODEL` | (opencode default) | e.g. `cheaperinference/deepseek-v4.1-flash` |
| `OPENCODE_TIMEOUT_MS` | `1800000` | Per-run timeout (30 min) |

## State files

- `service/state/notify_state.json` — job keys already alerted, so a job is
  never notified twice.
- `service/state/decisions.jsonl` — append-only log of your taps:
  `{ts, key, company, role, url, score, decision}`. v2 reads this to trigger
  `/apply` on the `apply` rows.

Both are gitignored.

## Dashboard

The batch message optionally links to the offline dashboard. Generate it and
serve `reports/` statically, then set `DASHBOARD_URL`:

```bash
opencode run --command html-report
# serve reports/ any way you like (nginx, caddy, python -m http.server)
```

## Operational notes

- **Rate limits.** LinkedIn tolerates low volume only. Keep the schedule modest
  (the default is twice a day).
- **Trust boundary.** Postings are untrusted third-party data. The repo's
  commands already apply the integrity gate and never follow instructions
  embedded in a posting; the daemon adds no new fetch paths.
- **Failures.** A failed `scrape` or `rank` is logged and the cycle continues;
  the next cycle retries. Telegram send failures are logged, not fatal.

## Roadmap (v2+)

- **Apply flow:** on an `apply` decision, run `opencode run --command apply <url>`
  and deliver the drafted CV + cover letter PDFs to Telegram for review.
- **Gmail watch:** schedule `opencode run --command gmail-sync` and forward the
  proposed status changes to Telegram for approval.
- **Calendar:** when `gmail-sync` detects an interview invite, create a Google
  Calendar event via an MCP server (opencode MCP binding).
- **Interactive approvals:** a Telegram reply loop that maps back into the
  command's confirmation step instead of the daemon deciding.
