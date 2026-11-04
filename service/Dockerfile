# AI Job Search — background service image.
#
# Bundles everything the framework's commands need when run headless:
# opencode + bun + python3 + a LaTeX toolchain, plus the daemon.
#
# Build context is the repo root. The daemon lives in ./service.

FROM oven/bun:1.3.14-debian

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PIP_BREAK_SYSTEM_PACKAGES=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      git ca-certificates curl unzip \
      texlive-latex-base texlive-latex-recommended texlive-latex-extra \
      texlive-fonts-recommended texlive-fonts-extra texlive-xetex \
      lmodern poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pypdf

ARG OPENCODE_VERSION=1.19.5
RUN curl -fsSL https://opencode.ai/install | VERSION=${OPENCODE_VERSION} bash \
    && ln -sf /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && opencode --version

WORKDIR /workspace

COPY . /workspace
RUN cd /workspace && python3 tools/install_portal_clis.py || true

RUN cd /workspace/service && bun install

WORKDIR /workspace
CMD ["bun", "run", "service/src/index.js"]
