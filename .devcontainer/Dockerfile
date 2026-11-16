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

# 3. Install RTK (Rust Token Killer) for CLI output compression in Claude Code
ARG RTK_VERSION=1.2.0
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
        amd64) rtk_target="x86_64-unknown-linux-musl" ;; \
        arm64) rtk_target="aarch64-unknown-linux-musl" ;; \
        *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac \
    && tmp="$(mktemp -d)" \
    && curl -fsSL "https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/rtk-${rtk_target}.tar.gz" -o "$tmp/rtk.tar.gz" \
    && curl -fsSL "https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/checksums.txt" -o "$tmp/checksums.txt" \
    && (cd "$tmp" && grep "rtk-${rtk_target}.tar.gz" checksums.txt | sed "s/rtk-${rtk_target}.tar.gz/rtk.tar.gz/" | sha256sum -c -) \
    && tar -xzf "$tmp/rtk.tar.gz" -C /usr/local/bin \
    && chmod +x /usr/local/bin/rtk \
    && rm -rf "$tmp"

# 4. Install Playwright OS dependencies & Chromium browser for browser agents / tests
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
    && chmod -R 777 /ms-playwright

# 5. Global npm tooling. Supabase is pinned to the package.json devDependency version
#    (bump both together); Vercel and Claude Code have no project pin and track latest.
ARG SUPABASE_CLI_VERSION=3.1.0
RUN su node -c "npm install -g vercel@latest supabase@${SUPABASE_CLI_VERSION} @anthropic-ai/claude-code@latest"

# Default container environment
ENV NEXT_TELEMETRY_DISABLED=1

