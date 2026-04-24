# Demo verification harness

This worker lane adds a lightweight, dependency-free verification harness for the local Mac context-screen demo worktree.

## What it checks

- Required plan stage states exist in `script.js`.
- The happy-path stage sequence exists in order.
- The worktree contains AirJelly source-label copy.
- The worktree contains an AirJelly adapter mode (`AirJelly Connected` or `AirJelly Adapter: Mock Mode`).
- The worktree contains the `fallback_scripted` + `operator sync mode` fallback language.
- The worktree contains stage-feed contract markers (`/humanmcp/stage-state`, `stage-state.json`, or SSE/event markers).
- Fixture snapshots satisfy the controller-snapshot contract from the plan.

## Commands

```bash
node verification/check-demo-readiness.mjs --report verification/latest-report.json
node verification/check-demo-readiness.mjs --strict
```

- Default mode writes a human-readable console report and can optionally emit JSON.
- `--strict` exits non-zero when the local worktree is not demo-ready.

## Files

- `verification/demo-requirements.json` — frozen requirements used by the harness.
- `verification/stage-state-fixtures.json` — sample happy/fallback controller snapshots for validator smoke coverage.
- `verification/check-demo-readiness.mjs` — source and fixture validator.
- `verification/latest-report.json` — latest machine-readable run report (generated after execution).
