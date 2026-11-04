#!/usr/bin/env bash
# AI Job Search - background service installer.
#
# Checks prerequisites, installs dependencies, scaffolds .env, enables the
# Gmail/Calendar MCP servers, and runs a cold-start self-check (preflight).
#
#   ./service/install.sh              # local (Bun) install + cold test
#   ./service/install.sh --docker     # build & start via docker compose
#   ./service/install.sh --auth       # also run the interactive MCP OAuth
#   ./service/install.sh --no-test    # skip the cold test
#
# Safe to re-run: existing files are not overwritten without asking.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="local"
DO_AUTH="false"
DO_TEST="true"
for arg in "$@"; do
  case "$arg" in
    --docker) MODE="docker" ;;
    --auth) DO_AUTH="true" ;;
    --no-test) DO_TEST="false" ;;
    -h|--help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'
else
  B=""; G=""; Y=""; R=""; N=""
fi
say()  { printf '%s\n' "${B}==>${N} $*"; }
ok()   { printf '%s\n' "  ${G}ok${N}   $*"; }
warn() { printf '%s\n' "  ${Y}warn${N} $*"; }
die()  { printf '%s\n' "  ${R}error${N} $*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# --- 1. prerequisites ---------------------------------------------------------

say "Checking prerequisites"
have bun      || die "bun not found. Install: https://bun.sh"
ok "bun $(bun --version)"
have python3  || die "python3 not found"
ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
have opencode || die "opencode not found. Install: https://opencode.ai"
ok "opencode $(opencode --version 2>/dev/null || echo '?')"

# --- 2. dependencies ----------------------------------------------------------

say "Installing daemon dependencies"
( cd service && bun install --silent )
ok "bun install (service/)"

say "Installing job-portal CLI dependencies"
python3 tools/install_portal_clis.py || warn "portal CLI install reported issues (continuing)"
ok "portal CLIs"

# --- 3. .env ------------------------------------------------------------------

say "Configuring service/.env"
ENV_FILE="service/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp service/.env.example "$ENV_FILE"
  ok "created service/.env from .env.example"
else
  ok "service/.env already exists (left as-is)"
fi

prompt_var() {
  # prompt_var VAR_NAME "human hint"
  local name="$1" hint="$2" cur
  # Use the LAST assignment; earlier empty placeholders are ignored.
  cur="$(grep -E "^${name}=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
  if [ -n "${cur:-}" ]; then
    ok "$name already set"
    return 0
  fi
  if [ ! -t 0 ]; then
    warn "$name not set and no TTY - edit $ENV_FILE later"
    return 0
  fi
  printf '  %s %s: ' "$hint" "$name"
  local val; read -r val
  if [ -n "$val" ]; then
    # Replace every assignment line for this key with one clean line.
    awk -v k="$name" -v v="$val" '
      $0 ~ "^"k"=" { if (!done) { print k"="v; done=1 } next }
      { print }
      END { if (!done) print k"="v }
    ' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    ok "$name set"
  else
    warn "$name left empty"
  fi
}

prompt_var TELEGRAM_BOT_TOKEN "Telegram bot token (from @BotFather)"
prompt_var TELEGRAM_CHAT_ID   "Telegram chat id (from @userinfobot)"

# --- 4. MCP servers (Gmail + Calendar) ----------------------------------------

say "Enabling Gmail + Calendar MCP servers"
python3 service/tools/enable_mcps.py enable >/dev/null
ok "gmail + calendar enabled in opencode.json"

if [ "$DO_AUTH" = "true" ]; then
  say "Authenticating MCP servers (interactive)"
  warn "Google OAuth needs a Desktop OAuth client JSON - see service/INSTALL.md"
  opencode mcp auth gmail    || warn "gmail auth did not complete"
  opencode mcp auth calendar || warn "calendar auth did not complete"
else
  warn "skipping MCP OAuth. Run './service/install.sh --auth' or see service/INSTALL.md"
fi

# --- 5. cold test (preflight) -------------------------------------------------

if [ "$DO_TEST" = "true" ]; then
  say "Running cold-start self-check (preflight)"
  # Load .env safely (no shell evaluation: values may contain spaces/globs).
  while IFS='=' read -r k v; do
    case "$k" in
      ''|\#*) continue ;;
    esac
    v="${v%\"}"; v="${v#\"}"
    export "$k=$v"
  done < "$ENV_FILE"
  if bun run service/src/preflight.js; then
    ok "preflight passed"
  else
    warn "preflight reported critical failures (see above)"
  fi
fi

# --- 6. launch ----------------------------------------------------------------

if [ "$MODE" = "docker" ]; then
  say "Building and starting via docker compose"
  have docker || die "docker not found"
  docker compose -f service/docker-compose.yml up -d --build
  ok "started. Logs: docker compose -f service/docker-compose.yml logs -f"
else
  say "Done. Start the daemon with:"
  printf '%s\n' "  ${B}cd service && bun run start${N}   # or: bun run once (single cycle)"
fi
