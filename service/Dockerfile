# AI Job Search — background service image.
#
# Bundles everything the framework's commands need when run headless:
# opencode + bun + node/npm + python3 + a LaTeX toolchain, the two Google MCP
# servers, and the daemon itself.
#
# Build context is the REPO ROOT (service/docker-compose.yml: context: ..).
# The .dockerignore that applies therefore lives at the repo root.
#
#   docker compose -f service/docker-compose.yml up -d --build
#
# Design notes
# ------------
# * Base is oven/bun:debian, not alpine: the LaTeX packages and the MCP servers
#   are Debian/glibc only.
# * node + npm are installed explicitly. Bun ships a `node` shim but no npm, and
#   both MCP servers are `#!/usr/bin/env node` packages that must be installed
#   with npm.
# * TeX Live is trimmed to what the templates actually load. `texlive-fonts-extra`
#   (1.7 GB, the single biggest layer of the old image) is NOT installed: only
#   fontawesome5 + academicons are needed from it, and those are copied in from
#   the `texlive-fonts-extra` package itself, which is not a dependency of
#   anything else we install.
# * The image runs as a non-root user matching the host uid/gid so that the
#   bind-mounted repo (.:/workspace) is not written as root.

ARG BUN_TAG=1.3.14-debian
FROM oven/bun:${BUN_TAG}

ARG DEBIAN_FRONTEND=noninteractive
ARG OPENCODE_VERSION=1.19.5
# Host uid/gid so files written into the bind mount stay owned by the host user.
ARG UID=1000
ARG GID=1000

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    TZ=UTC

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      # runtime for tools/*.py and the daemon
      python3 python3-pip python3-venv \
      # general tooling used by the workflow
      git ca-certificates curl unzip gnupg \
      # LaTeX: engines + the packages the CV/cover templates load.
      # moderncv, fontspec, textpos, titlesec, needspace, import, cite,
      # microtype, xltxtra, tikz, academicons, fontawesome5.
      texlive-latex-base texlive-latex-recommended texlive-latex-extra \
      texlive-pictures texlive-xetex texlive-luatex texlive-fonts-recommended \
      # Latin Modern, the default moderncv body font
      lmodern \
      # pdftotext / pdfinfo for the ATS checks
      poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# fontawesome5 + academicons live in the 1.7 GB texlive-fonts-extra package.
# Pull only those two packages out of the .deb instead of installing the whole
# thing (see service/install-tex-extra.sh for the why and the per-tree detail).
COPY service/install-tex-extra.sh /tmp/install-tex-extra.sh
RUN sh /tmp/install-tex-extra.sh && rm -f /tmp/install-tex-extra.sh

# pypdf is the fallback when pdftotext is absent (verify_pdf.py).
RUN pip install --no-cache-dir pypdf

# Node 22 from NodeSource: Debian's nodejs is v20, and imap-mcp-server requires
# node >= 22.12.0. Installed system-wide (root) so the binaries are on PATH for
# the non-root app user.
ARG NODE_MAJOR=22
RUN set -eux; \
    mkdir -p /etc/apt/keyrings; \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg; \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends nodejs; \
    rm -rf /var/lib/apt/lists/*; \
    node --version; npm --version

# ---------------------------------------------------------------------------
# 2. Non-root user matching the host
# ---------------------------------------------------------------------------
# oven/bun already ships uid/gid 1000 as `bun` (home /home/bun). Reuse it when
# the requested id is 1000; only create a new user for a different host uid.
RUN set -eux; \
    if getent passwd "${UID}" >/dev/null; then \
      APP_USER="$(getent passwd "${UID}" | cut -d: -f1)"; \
      APP_HOME="$(getent passwd "${UID}" | cut -d: -f6)"; \
      usermod -s /bin/bash "${APP_USER}" || true; \
    else \
      APP_USER=app; APP_HOME=/home/app; \
      groupadd -g "${GID}" app 2>/dev/null || true; \
      useradd -m -u "${UID}" -g "${GID}" -s /bin/bash app; \
    fi; \
    mkdir -p "${APP_HOME}/.local/share" "${APP_HOME}/.local/bin" "${APP_HOME}/.config"; \
    chown -R "${UID}:${GID}" "${APP_HOME}"; \
    ln -sfn "${APP_HOME}" /home/app; \
    chown -h "${UID}:${GID}" /home/app; \
    echo "${APP_USER}" > /etc/app-user
ENV HOME=/home/app

# ---------------------------------------------------------------------------
# 3. opencode (installed as the app user so its data dir is owned correctly)
# ---------------------------------------------------------------------------
USER 1000:1000
RUN curl -fsSL https://opencode.ai/install | VERSION=${OPENCODE_VERSION} bash \
    && ln -sf /home/app/.opencode/bin/opencode /home/app/.local/bin/opencode || true
ENV PATH="/home/app/.local/bin:/home/app/.opencode/bin:${PATH}"
RUN opencode --version

# ---------------------------------------------------------------------------
# 4. Google MCP servers (node packages, installed globally for the app user)
# ---------------------------------------------------------------------------
# Pinned to the versions running on the host so behaviour does not drift.
# Installed under a user-owned prefix (the app user cannot write /usr/local).
ARG CALENDAR_MCP_VERSION=2.8.1
ARG IMAP_MCP_VERSION=2.2.0
RUN set -eux; \
    NPM_PREFIX="$HOME/.npm-global"; \
    mkdir -p "$NPM_PREFIX"; \
    npm install -g --prefix "$NPM_PREFIX" --no-audit --no-fund \
      "@cocal/google-calendar-mcp@${CALENDAR_MCP_VERSION}" \
      "imap-mcp-server@${IMAP_MCP_VERSION}"; \
    ln -sf "$NPM_PREFIX/lib/node_modules/@cocal/google-calendar-mcp/build/index.js" "$HOME/.local/bin/google-calendar-mcp"; \
    ln -sf "$NPM_PREFIX/lib/node_modules/imap-mcp-server/dist/index.js" "$HOME/.local/bin/imap-mcp"; \
    chmod +x "$NPM_PREFIX/lib/node_modules/@cocal/google-calendar-mcp/build/index.js" \
             "$NPM_PREFIX/lib/node_modules/imap-mcp-server/dist/index.js"; \
    "$HOME/.local/bin/google-calendar-mcp" --version || true; \
    ls -l "$HOME/.local/bin/"

# ---------------------------------------------------------------------------
# 5. The repo itself
# ---------------------------------------------------------------------------
# The repo is also bind-mounted at runtime (.:/workspace) so state, CVs and the
# tracker persist. Copying it here makes the image usable on its own — e.g.
# `docker run --rm -it ai-job-search:local bash` — and gives a warm dependency
# layer. The runtime mount shadows this copy, which is expected.
WORKDIR /workspace
COPY --chown=app:app . /workspace

# Daemon deps + portal CLIs (both idempotent; portal install failures tolerated,
# same as the Dockerfile did before).
RUN cd /workspace/service && bun install --frozen-lockfile \
    && cd /workspace && python3 tools/install_portal_clis.py || true

# ---------------------------------------------------------------------------
# 6. Runtime
# ---------------------------------------------------------------------------
# Fail fast if a required binary is missing, instead of discovering it at the
# first Telegram tap. kpsewhich returns 0 even when some of its arguments are
# missing, so each TeX path is checked on its own line.
RUN set -eux; \
    for b in bun node npm python3 opencode lualatex xelatex pdflatex pdftotext pdfinfo git google-calendar-mcp imap-mcp; do \
      command -v "$b" >/dev/null || { echo "MISSING: $b" >&2; exit 1; }; \
    done; \
    python3 -c "import pypdf"; \
    for f in moderncv.cls fontspec.sty fontawesome5.sty academicons.sty academicons.ttf FontAwesome5Free-Solid-900.otf; do \
      kpsewhich "$f" | grep -q . || { echo "MISSING TeX file: $f" >&2; exit 1; }; \
    done

WORKDIR /workspace
CMD ["bun", "run", "service/src/index.js"]
