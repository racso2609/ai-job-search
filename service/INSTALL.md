# Install & Configure — AI Job Search background service

This guide takes you from a fresh clone to a running service that:

- scrapes job portals and ranks matches on a schedule,
- pings you on **Telegram** with an approve/skip decision per job,
- drafts a tailored CV + cover letter on **Apply** and sends you the PDFs,
- watches **Gmail** for recruiter replies and proposes tracker updates,
- offers a **Google Calendar** event when an interview is detected.

Everything the repo already does interactively still works; the service is a
thin unattended wrapper around it.

> **Just want the interactive workflow?** You don't need this service. Run
> `opencode` in the repo and use `/setup`, `/scrape`, `/apply` directly.

---

## 0. TL;DR

```bash
git clone <your-fork> ai-job-search && cd ai-job-search
./service/install.sh              # local install + cold test
./service/install.sh --docker     # or: build & start in Docker
```

Then complete the two manual steps the installer cannot do for you:
**Telegram token** (§2) and **Google OAuth** (§4). Re-run
`./service/install.sh --auth` once Google OAuth is set up.

---

## 1. Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| **Bun** ≥ 1.3 | runs the daemon and portal CLIs | https://bun.sh |
| **opencode** ≥ 1.19 | runs the AI workflow headless | https://opencode.ai |
| **Python** 3.10+ | `tools/*.py` | system package manager |
| **LaTeX** (`lualatex` + `xelatex`) | compiles the CV/cover letter PDFs | see below |
| **AI provider key** | opencode needs a model | same as your interactive setup |

**LaTeX is only needed for the Apply flow.** The Docker image bundles it, so if
you install with `--docker` you can skip installing LaTeX on the host. On the
host, TinyTeX is the lightest option:

```bash
# macOS/Linux, minimal
curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh
tlmgr install moderncv fontawesome5 needspace fontspec xetex
```

The installer reports LaTeX as a **warning**, never a hard failure.

---

## 2. Telegram bot + chat id

1. In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the
   **token** (looks like `123456789:AAE...`).
2. Get your **chat id**: message **@userinfobot**; it replies with your numeric
   id. (Alternatively, message your new bot, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read
   `result[].message.chat.id`.)
3. Send your bot a message once, so it is allowed to reply to you.

The installer prompts for both and writes them to `service/.env`. If you run it
non-interactively, edit the file afterwards:

```dotenv
TELEGRAM_BOT_TOKEN=123456789:AAE...
TELEGRAM_CHAT_ID=987654321
```

---

## 3. Google Cloud OAuth (Gmail + Calendar)

Gmail and Calendar are reached through **MCP servers** that authenticate with a
Google OAuth **Desktop** client. You create it once and reuse it for both.
This part cannot be automated — Google requires the browser consent flow.

### 3.1 Create the OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create (or pick) a project.
2. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**: choose **External**, fill the
   app name and your email; add yourself as a **Test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app**.
   - Create, then **Download JSON**.
5. Move the downloaded file into the repo (it is gitignored via `service/.env`'s
   directories — keep it out of git):

```bash
mkdir -p service/secrets
mv ~/Downloads/client_secret_*.json service/secrets/gcp-oauth.keys.json
```

### 3.2 Point the MCP servers at the credentials

Add these to `service/.env`:

```dotenv
GMAIL_CREDENTIALS_PATH=./service/secrets/gcp-oauth.keys.json
GMAIL_OAUTH_PATH=./service/secrets/gmail-token.json
GOOGLE_OAUTH_CREDENTIALS=./service/secrets/gcp-oauth.keys.json
```

### 3.3 Authenticate (opens a browser once)

```bash
./service/install.sh --auth
# or directly:
opencode mcp auth gmail
opencode mcp auth calendar
```

Tokens are stored under `~/.local/share/opencode/mcp-auth.json` (and the
Gmail-token path above). You stay signed in; no need to repeat this.

> **Headless server?** Run the auth step on a machine **with a browser** (your
> laptop), then copy `~/.local/share/opencode/mcp-auth.json` and
> `service/secrets/` to the server. The refresh tokens keep working.

---

## 4. Install

### 4.1 Local (Bun)

```bash
./service/install.sh
cd service && bun run start
```

`install.sh` does, in order: prerequisite check → `bun install` (daemon +
portal CLIs) → `service/.env` scaffolding → enable the gmail/calendar MCP
servers in `opencode.json` → **cold test (preflight)**.

### 4.2 Docker

```bash
./service/install.sh --docker
docker compose -f service/docker-compose.yml logs -f
```

The image bundles opencode, Bun, Python and a full LaTeX toolchain. The repo is
bind-mounted into the container, so your profile, state and PDFs persist on the
host. Provider auth is cached in the `opencode-data` volume.

### Installer flags

| Flag | Effect |
|------|--------|
| *(none)* | local install + cold test |
| `--docker` | build & start with docker compose |
| `--auth` | also run the interactive MCP OAuth |
| `--no-test` | skip the cold test |

---

## 5. Cold test (preflight)

The installer always ends by running the self-check:

```bash
bun run service/src/preflight.js
```

It verifies, and exits non-zero on any **critical** failure:

| Check | Critical |
|-------|----------|
| bun, python3, opencode on PATH | yes |
| `job_scraper/` present | yes |
| state dir writable | yes |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` set | yes |
| opencode discovers the 5 daemon commands | yes |
| workspace agents load (3) | yes |
| `lualatex` / `xelatex` present | no (warn) |
| `pypdf` or `pdftotext` present | no (warn) |
| gmail MCP connected | no (warn) |
| calendar MCP connected | no (warn) |

A green run prints `Ready.` and exits 0. Warnings mean a feature (PDFs, Gmail,
Calendar) is degraded until you finish §3.

You can re-run the cold test any time:

```bash
cd service && bun run preflight
```

---

## 6. Configuration

All settings live in `service/.env` (see `service/.env.example`).

| Var | Default | Meaning |
|-----|---------|---------|
| `TELEGRAM_BOT_TOKEN` | — | **required** |
| `TELEGRAM_CHAT_ID` | — | **required** |
| `SCRAPE_CRON` | `0 8,18 * * *` | scrape+rank+notify schedule |
| `GMAIL_CRON` | `0 */3 * * *` | Gmail watch schedule (empty = off) |
| `TZ` | `UTC` | timezone for both crons |
| `RUN_ON_START` | `true` | run a scrape cycle at startup |
| `TOP_N` | `5` | jobs per Telegram summary |
| `MIN_SCORE` | `0` | only notify `rank_score` ≥ this (0-100) |
| `ENABLE_APPLY` | `true` | draft on an Apply tap |
| `ENABLE_GMAIL` | `true` | run the Gmail watch cycle |
| `ENABLE_CALENDAR` | `true` | offer calendar events |
| `DASHBOARD_URL` | — | public URL of the HTML dashboard |
| `OPENCODE_MODEL` | (default) | e.g. `cheaperinference/deepseek-v4.1-flash` |
| `OPENCODE_TIMEOUT_MS` | `1800000` | per-opencode-run timeout |
| `STATE_DIR` | `service/state` | where daemon state is written |

---

## 7. Run it as a real service

### systemd (Linux server)

```ini
# /etc/systemd/system/ai-job-search.service
[Unit]
Description=AI Job Search daemon
After=network-online.target

[Service]
WorkingDirectory=/opt/ai-job-search/service
ExecStart=/usr/local/bin/bun run start
EnvironmentFile=/opt/ai-job-search/service/.env
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-job-search
journalctl -u ai-job-search -f
```

### Docker

The compose file already sets `restart: unless-stopped`.

### launchd (macOS)

Run `./service/install.sh --no-test` then create a `LaunchAgent` that runs
`bun run start` in `service/` with `KeepAlive`. Docker on macOS is the simpler
route.

---

## 8. How it works

```
cron (SCRAPE_CRON) → opencode run --command scrape → opencode run --command rank
                   → ranked jobs in job_scraper/seen_jobs.json
                   → Telegram: batch summary + per-job [Apply]/[Skip]

[Apply tap]  → queue → opencode run --command daemon-apply <url>
             → PDFs sent to Telegram; drafted row in the tracker

cron (GMAIL_CRON) → opencode run --command daemon-gmail
                  → Telegram: per-proposal [Approve]/[Ignore]
                  → interview with a time → [Add to calendar]
                  → queue → opencode run --command daemon-calendar
```

One shared **queue** runs opencode jobs serially, so a tap never collides with
a scheduled cycle. The daemon never reimplements repo logic: it shells out to
`opencode run --command <name>`, and the `daemon-*` commands are non-interactive
variants that emit a JSON result block.

**The daemon never submits an application.** It drafts, compiles and sends you
the PDFs; you submit through the portal yourself. This matches the repo's rule
that nothing is sent automatically.

### State files (`service/state/`, gitignored)

| File | Purpose |
|------|---------|
| `notify_state.json` | job keys already alerted (no double notifications) |
| `decisions.jsonl` | append-only log of every tap |
| `pending.json` | proposals awaiting a tap (survives restarts) |
| `gmail_seen.json` | message ids already classified |

---

## 9. Troubleshooting

**Preflight fails on `TELEGRAM_*`.** The vars are empty in `service/.env`, or
the file has an earlier empty placeholder line. Keep one assignment per key.

**MCP gmail/calendar show `disabled` or `failed`.** Run
`./service/install.sh --auth`. `failed` after enabling means credentials are
missing (§3) or the OAuth consent has not run.

**`opencode: command not found` inside Docker.** The image installs it at
`/usr/local/bin/opencode`; rebuild with `--build`.

**Apply fails with a LaTeX error.** LaTeX is missing on the host — install
TinyTeX (§1) or use the Docker image.

**A tap arrives but nothing happens.** It is queued behind a running cycle;
check the logs. The queue runs one job at a time.

**`docker compose` complains about a missing `.env`.** Run the installer first
(it creates `service/.env`), or `cp service/.env.example service/.env`.

**LinkedIn rate-limits.** Lower the frequency: set `SCRAPE_CRON=0 8 * * *`.

---

## 10. Security notes

- Postings are **untrusted third-party data**; the `daemon-*` commands keep the
  repo's integrity gate (`tools/posting_guard.py`) and never follow instructions
  embedded in a posting.
- `service/.env` and `service/secrets/` hold tokens and are gitignored. Never
  commit them.
- If you fork a public repo, remember the fork is public: keep personal data
  (profile, tracker, CVs) out of commits.
