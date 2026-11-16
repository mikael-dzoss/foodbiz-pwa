## Summary

<!-- What and why. Link the issue: Closes #123 -->

## Checklist

- [ ] PR title follows `<type>(<scope>): <description> (#<issue>)`
- [ ] `npm run gate` passes locally and coverage floors are not lowered (`docs/CONTRIBUTING.md#validation-gate`)
- [ ] Tests added/updated for behavior changes
- [ ] No secrets; only `NEXT_PUBLIC_*` values reach the browser
- [ ] New tables have RLS policies (if applicable)
- [ ] Docs updated (if applicable)
- [ ] For bug fixes: the `bug` label is applied to this PR
