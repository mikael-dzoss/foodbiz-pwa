# Contributing to FoodBiz PWA

Code standards live in [`AGENTS.md`](../AGENTS.md#rules) and [`.agents/rules/`](../.agents/rules/); they apply to humans and agents alike. Local setup: [`README.md`](../README.md#getting-started).

## Branches

| Branch    | Purpose                                                   |
| --------- | --------------------------------------------------------- |
| `develop` | Integration branch; all work PRs target it. Not deployed. |
| `staging` | Pre-production qualification (promoted from `develop`).   |
| `main`    | Production (promoted from `staging`).                     |

```mermaid
flowchart LR
  F["feature/ bug/ utils/"] -->|"PR"| D["develop"]
  D -->|"promotion PR"| S["staging"]
  S -->|"promotion PR"| M["main"]
```

Never commit or push directly to `develop`, `staging` or `main`. Branch off `develop`:

| Prefix     | Use                                     | Example                          |
| ---------- | --------------------------------------- | -------------------------------- |
| `feature/` | Story issue                             | `feature/42-order-status-filter` |
| `bug/`     | Bug issue                               | `bug/38-kpi-profit`              |
| `utils/`   | Tooling, docs, config, dependencies, CI | `utils/agentic-setup`            |

## Workflow

1. Pick or create an issue (agents: [`github_issue.instructions.md`](../.agents/rules/github_issue.instructions.md); create issues only via the `issue-logger` skill).
2. Branch off `develop` (see [Branches](#branches)) and commit small working slices.
3. Pass the [validation gate](#validation-gate).
4. Open a PR against `develop`; the [PR template](../.github/pull_request_template.md) is the checklist.
5. Promotion to `staging`/`main`: [`DEPLOYMENT.md#releasing`](DEPLOYMENT.md#releasing).

## Commits and PR titles

Format: `<type>(<scope>): <description> (#<issue>)`, e.g. `feat(orders): add order status filter (#42)`. PR titles use the same format (checked by CI).

- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `perf`, `style`
- Scopes: an issue `area:` (`dashboard`, `orders`, `products`, `expenses`, `analytics`, `storefront`, `auth`, `settings`, `customers`, `design-system`, `infra`) or `pwa`, `supabase`, `config`

## Validation gate

All must pass with zero errors before a PR (CI's `Quality gate` runs the same):

```bash
npm run format:check   # Prettier (+ Tailwind class sorting); fix with npm run format
npm run lint
npm run typecheck      # next typegen && tsc --noEmit
npm run test:coverage  # tests + coverage floors + ratchet
npm run test:tooling   # tooling tests (Vitest + Python)
npm run build
npm run test:e2e       # mock-mode Chromium journeys + light/dark WCAG AA checks
```

### Browser and accessibility checks

Install Chromium once with `npx playwright install --with-deps chromium`, then run
`npm run test:e2e` (or `npm run test:e2e:ui` for interactive debugging).
Playwright starts its own mock-mode development server at `http://127.0.0.1:3100`;
stop other Next.js dev servers in this checkout first. It never reuses an existing
server, calls Supabase, or enables mock authentication in production.
In mock mode, the request proxy skips Supabase session refresh, so these browser
tests do not require public Supabase environment variables or a local `.env` file.
Supabase mode still validates its public configuration; mock mode remains forbidden
in production.

The suite uses one worker and no retries because the mock repositories are
process-local and shared between browser contexts. Each run starts with fresh
fixtures; mutations use unique names or separate guests and do not rely on test
order. Manager tests sign in through the demo UI. Checkout uses separate customer
and manager contexts and reloads tracking after acceptance (live polling is not
part of this gate).

Browser axe checks cover storefront catalog, product detail, populated cart and
checkout, tracking (EN/FR), manager sign-in, dashboard, products/product sheet,
orders/manual entry/order detail, and expenses/expense sheet in light and dark.
Customer list/detail checks additionally cover EN/FR at 360 px in both themes,
including search, persistent canonical-name and note edits, and propagation to linked orders.
WCAG 2/2.1/2.2 A/AA violations, including color contrast, fail CI. Component axe
tests run in the regular Vitest gate; JSDOM cannot calculate contrast, so only
that rule is disabled there, not in browser tests. Automated checks supplement,
but do not replace, keyboard and screen-reader testing.

The consolidated CI summary requires the browser job to succeed. Download
`playwright-results` for the HTML report, light/dark screenshots, and failure
traces (retained seven days). Locally use `npx playwright show-report` or
`npx playwright show-trace test-results/<test>/trace.zip`.

Coverage policy:

- **Production floors** (global, in `vitest.config.mts`): `test:coverage` fails below them, then `scripts/coverage-ratchet.mjs` raises lines/functions/statements toward actual coverage (capped at 70%; branches fixed at 80%). Commit the raised thresholds. A drop is fine while floors pass.
- Never lower thresholds, add coverage excludes or skip tests to pass; if a change can't meet the floors, stop and ask.
- **Per-layer targets** (reported in the CI PR comment, not enforced yet): Domain 85%, Features 80%, Config 80%, Lib 75%, Components 70%, App 70%. Mention gaps in the PR.
- **Tooling** (`scripts/`, `.github/.scripts/`, `.agents/skills/*/scripts/`) must have tests; changes update them. Coverage target 60%, informative only.
