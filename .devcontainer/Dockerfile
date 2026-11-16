FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm

# 1. System packages, GitHub CLI repository, and Python 3
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    jq \
    python3 \
    python3-pip \
    python3-venv \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# 2. Install graphifyy for Python tooling / knowledge graph
RUN pip3 install --no-cache-dir --break-system-packages graphifyy

# 3. Install Playwright OS dependencies & Chromium browser for browser agents / tests
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
    && chmod -R 777 /ms-playwright

# 4. Global npm tooling. Supabase is pinned to the package.json devDependency version
#    (bump both together); Vercel and Claude Code have no project pin and track latest.
ARG SUPABASE_CLI_VERSION=3.1.0
RUN su node -c "npm install -g vercel@latest supabase@${SUPABASE_CLI_VERSION} @anthropic-ai/claude-code@latest"

# Default container environment
ENV NEXT_TELEMETRY_DISABLED=1

