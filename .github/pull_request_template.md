## Summary

<!-- What and why. Link the issue: Closes #123 -->

## Checklist

- [ ] PR title follows `<type>(<scope>): <description>`
- [ ] `npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run test:tooling && npm run build` pass locally
- [ ] Coverage did not decrease (thresholds in `vitest.config.mts` not lowered; raised values committed)
- [ ] Tests added/updated for behavior changes
- [ ] No secrets; only `NEXT_PUBLIC_*` values reach the browser
- [ ] New tables have RLS policies (if applicable)
- [ ] Docs updated (if applicable)
