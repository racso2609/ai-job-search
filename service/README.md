# AI Job Search — background service

Runs the job-search loop unattended on your server and pings you on Telegram
when something needs a decision: new jobs to apply to, recruiter replies, and
interview invites to add to your calendar.

**New here? Read [`INSTALL.md`](INSTALL.md).** It covers prerequisites, the
Telegram bot, Google OAuth, and the cold-start self-check. This file is the
reference for what the service does and how it is wired.

## What it does

```
cron (SCRAPE_CRON) → opencode run --command scrape → opencode run --command rank
                   → ranked jobs → Telegram: batch summary + [Apply]/[Skip] per job

[Apply tap]  → queue → opencode run --command daemon-apply <url>
             → CV + cover letter PDFs sent to Telegram; drafted row in tracker

cron (GMAIL_CRON) → opencode run --command daemon-gmail
                  → Telegram: per-proposal [Approve]/[Ignore]
                  → interview with a time → [Add to calendar]
                  → queue → opencode run --command daemon-calendar
```

The service never reimplements the repo's logic. It shells out to
`opencode run --command <name>`, which loads the workspace's skills, agents and
`opencode.json` exactly as the interactive flow does. The `daemon-*` commands in
`.opencode/commands/` are non-interactive variants that end with a JSON result
block the daemon parses.

**The daemon never submits an application.** On Apply it drafts, compiles and
sends you the PDFs; you submit through the portal. This matches the repo rule
that nothing is sent automatically.

## Quick start

```bash
./service/install.sh              # local install + cold test
./service/install.sh --docker     # build & start in Docker
cd service && bun run start       # run the daemon (local)
```

See [`INSTALL.md`](INSTALL.md) for Telegram, Google OAuth and systemd/Docker.

## Layout

```
service/
├── install.sh            # installer + cold test
├── INSTALL.md            # full install & configuration guide
├── Dockerfile            # opencode + bun + python + LaTeX
├── docker-compose.yml    # one-command deploy
├── .env.example          # configuration template
├── tools/
│   └── enable_mcps.py    # flip gmail/calendar MCP on/off in opencode.json
└── src/
    ├── index.js          # entry: crons + bot + queue wiring
    ├── config.js         # env → config object
    ├── queue.js          # serial job queue (one opencode run at a time)
    ├── worker.js         # runs daemon-* commands, parses their JSON
    ├── pipeline.js       # scrape cycle, gmail cycle, tap handlers
    ├── telegram.js       # bot, inline buttons, PDF sending
    ├── state.js          # notify/decisions/pending/gmail-seen state
    ├── opencode.js       # spawn `opencode run` headless
    ├── logger.js         # timestamped logging
    └── preflight.js      # cold-start self-check
```

## Configuration

All knobs are environment variables (see `.env.example`):

| Var | Default | Meaning |
|-----|---------|---------|
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather (required) |
| `TELEGRAM_CHAT_ID` | — | Your chat id (required) |
| `SCRAPE_CRON` | `0 8,18 * * *` | scrape+rank+notify schedule |
| `GMAIL_CRON` | `0 */3 * * *` | Gmail watch schedule |
| `TZ` | `UTC` | timezone for both crons |
| `RUN_ON_START` | `true` | run a scrape cycle at startup |
| `TOP_N` | `5` | jobs per Telegram summary |
| `MIN_SCORE` | `0` | only notify `rank_score` ≥ this |
| `ENABLE_APPLY` | `true` | draft on an Apply tap |
| `ENABLE_GMAIL` | `true` | run the Gmail watch cycle |
| `ENABLE_CALENDAR` | `true` | offer calendar events |
| `DASHBOARD_URL` | — | public URL of the HTML dashboard |
| `OPENCODE_MODEL` | (default) | model override |
| `OPENCODE_TIMEOUT_MS` | `1800000` | per-run timeout |

## State files (`service/state/`, gitignored)

| File | Purpose |
|------|---------|
| `notify_state.json` | job keys already alerted |
| `decisions.jsonl` | append-only log of every tap |
| `pending.json` | proposals awaiting a tap (survives restarts) |
| `gmail_seen.json` | Gmail message ids already classified |

## Cold test

```bash
cd service && bun run preflight
```

Checks binaries, config, the 5 daemon commands, the 3 agents, LaTeX and the MCP
connections. Critical failures exit non-zero; LaTeX and MCP gaps are warnings.
`install.sh` runs it automatically at the end.

## Operational notes

- **Queue.** One opencode run at a time, so a tap never collides with a cycle.
- **Rate limits.** LinkedIn tolerates low volume; the default is twice a day.
- **Trust boundary.** Postings are untrusted data; the `daemon-*` commands keep
  `tools/posting_guard.py` and follow no instructions embedded in a posting.
- **Failures.** A failed cycle is logged and retried next tick; a failed send is
  logged, not fatal.
