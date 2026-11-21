# Dev Container Environment & Secrets Guide

This devcontainer is configured for persistent session data, tool state, and secure secret isolation across rebuilds.

---

## 1. Private Environment Secrets (`~/.devcontainer-data/foodbiz-pwa/env`)

To prevent API keys from leaking into personal host shell profiles or accidental git commits, container environment variables are loaded via Docker's `--env-file` from your host machine.

### Host Path

`~/.devcontainer-data/foodbiz-pwa/env` (expanded via `${localEnv:HOME}`)

### Permissions & Format

- Permissions: `chmod 600` (private to your host user account).
- Format: Standard key-value pairs (`KEY=VALUE`).

> [!WARNING]
> **Do NOT wrap values in quotes!**
> Docker's `--env-file` parser treats quotes literally.
>
> - **Correct:** `STITCH_API_KEY=AIzaSyAbc123...`
> - **Incorrect:** `STITCH_API_KEY="AIzaSyAbc123..."`

### Supported Keys

```env
GH_CLI_PAT=your-github-pat
STITCH_API_KEY=your-stitch-api-key
VERCEL_API_TOKEN=your-vercel-token
# Future OAuth & Provider Secrets:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

When `GH_CLI_PAT` is set, `.devcontainer/post-create.sh` automatically authenticates `gh` (`gh auth login --with-token`) and configures `git` credentials for `github.com`.

> [!NOTE]
> Updating this file on your host while the devcontainer is already running requires restarting or reloading the container (`Cmd/Ctrl+Shift+P` -> `Developer: Reload Window` or `Dev Containers: Rebuild Container`) for changes to take effect.

---

## 2. Session & Configuration Persistence Across Rebuilds

| Path in Container                           | Persistence Mechanism                            | What It Persists                                                                                                                                                                                                                                                                                    |
| :------------------------------------------ | :----------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/home/node/.claude/`                       | Docker Named Volume (`foodbiz-pwa-claude-data`)  | Claude Code everything: `CLAUDE_CONFIG_DIR` points here, so it holds the global config (`.claude.json`: OAuth account, projects), credentials (`.credentials.json`), `settings.json` (hooks such as `rtk hook claude`), plugins (tokenslim, agent-usage-guard), memory, conversation logs and plans |
| `/home/node/.gemini/`                       | Docker Named Volume (`foodbiz-pwa-gemini-data`)  | Antigravity extension and `agy` CLI state: login, session transcripts, artifacts, brain states                                                                                                                                                                                                      |
| `/workspaces/foodbiz-pwa/node_modules`      | Docker Named Volume (`foodbiz-pwa-node-modules`) | Node dependencies                                                                                                                                                                                                                                                                                   |
| `/workspaces/foodbiz-pwa/.claude/worktrees` | Docker Named Volume (`foodbiz-pwa-worktrees`)    | Agent git worktrees on a Linux filesystem (avoids the macOS bind-mount overhead); they symlink `node_modules`                                                                                                                                                                                       |
| `/workspaces/foodbiz-pwa/.next`             | Docker Named Volume (`foodbiz-pwa-next`)         | The main checkout's build output and Turbopack cache, kept off the macOS bind mount for speed                                                                                                                                                                                                       |

`/home/node/.claude.json` is not used: with `CLAUDE_CONFIG_DIR` set, Claude Code reads `$CLAUDE_CONFIG_DIR/.claude.json` instead. `gh` is re-authenticated from `GH_CLI_PAT` on every container creation, so its login needs no volume.

---

## 3. Restoring Existing Sessions & Real Credentials

A normal rebuild keeps the named volumes, so nothing needs restoring. Only after the volumes are deleted (or on a new machine) do you need to restore from a backup:

1. Before the rebuild, `.devcontainer/init-host.sh` (the `initializeCommand`) creates the host env file if it is missing.
2. Once the rebuilt container opens, restore Claude Code from a personal archive of `/home/node/.claude` (for example a local, git-excluded `restore-claude.sh` reading `claude-backup.tar.gz`). Extract it to `/` and `chown -R node:node /home/node/.claude`.
3. Sign in to `agy` again only if the `foodbiz-pwa-gemini-data` volume was lost.
