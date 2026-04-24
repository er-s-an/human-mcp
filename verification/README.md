# Demo verification harness

This worker lane adds a lightweight, dependency-free verification harness for the local Mac context-screen demo worktree.

## What it checks

- Required plan stage states exist in `script.js`.
- The happy-path stage sequence exists in order.
- The worktree contains AirJelly source-label copy.
- The worktree contains an AirJelly adapter mode (`AirJelly Connected` or `AirJelly Adapter: Mock Mode`).
- The worktree contains the `fallback_scripted` + `operator sync mode` fallback language.
- The worktree contains stage-feed contract markers (`/humanmcp/stage-state`, `stage-state.json`, or SSE/event markers).
- The worktree contains the local rehearsal feed server used to test Surface A before Windows is ready.
- Fixture snapshots satisfy the controller-snapshot contract from the plan.

## Commands

```bash
node --check scripts/stage_state_rehearsal_server.mjs
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
- `scripts/stage_state_rehearsal_server.mjs` — dependency-free local feed and scenario controller for Mac Surface A rehearsal.

## Local rehearsal feed

```bash
node scripts/stage_state_rehearsal_server.mjs --port 4173 --scenario happyPath
```

Open:

```text
http://127.0.0.1:4173/?feed=http://127.0.0.1:4173/humanmcp/stage-state
```

Advance the current scenario:

```bash
curl -X POST http://127.0.0.1:4173/humanmcp/rehearsal/next
```

Available scenarios:

- `happyPath`
- `fallbackPath`
- `virtualStampPath`
