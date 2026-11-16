---
applyTo: "**"
description: Knowledge-graph-first code exploration with graphify
---

## graphify

This project has a graphify knowledge graph at `graphify-out/` (provisioned by the devcontainer). If the `graphify` command or `graphify-out/` is missing, use regular code search instead; don't install or build it.

- For codebase or architecture questions, first run `graphify query "<question>"` to get a scoped subgraph.
- Use `graphify path "<A>" "<B>"` for dependency relationships between modules (e.g. a Server Action and the Supabase client it uses).
- Use `graphify explain "<concept>"` for focused concept lookups.
- After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost).
- Run graphify from the `foodbiz-pwa` repo root; don't commit `graphify-out/` unless the team decides to track it.
