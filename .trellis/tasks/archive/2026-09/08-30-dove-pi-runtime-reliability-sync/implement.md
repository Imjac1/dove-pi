# Implementation plan: Dove Pi runtime reliability and synchronization

## Execution Order

- [ ] Approve this plan; do not start the parent task.
- [ ] Complete `08-30-dove-extension-identity-sync`.
- [ ] Complete `08-30-dove-request-lifecycle-idempotency`.
- [ ] Complete `08-30-dove-tool-loop-context-control`.
- [ ] Complete `08-30-dove-audit-observability-regression`.
- [ ] Run parent integration review and archive the tree.

## Cross-Child Gates

- [ ] Preserve Pi/core/installer ownership and unrelated Pi plugins/user state.
- [ ] Keep logs redacted and bounded.
- [ ] Update runtime spec after contracts are verified.
- [ ] Update README files only for user-visible behavior.

## Full Validation

```powershell
npm run typecheck
npm test
npm run test:installer
npm run doctor
npm run pi:smoke
```

Use temporary `DOVE_PI_HOME`, Pi state, and project directories for isolated replay. Never run E2E maintenance tests against the real installation.

## Rollback Points

1. Before removing the launcher workaround.
2. Before request coalescing at Pi input.
3. Before provider-visible context retention changes.
4. Before maintenance log schema migration.
