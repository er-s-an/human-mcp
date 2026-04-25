# Demo verification harness

This worker lane adds a lightweight, dependency-free verification harness for the local Mac context-screen demo worktree.

## What it checks

- Required plan stage states exist in `script.js`.
- The happy-path stage sequence exists in order.
- The worktree contains AirJelly source-label copy.
- The worktree contains an AirJelly adapter mode (`AirJelly Connected` or `AirJelly Adapter: Mock Mode`).
- The worktree contains the `fallback_scripted` + `operator sync mode` fallback language.
- The worktree contains stage-feed contract markers (`/humanmcp/stage-state`, `stage-state.json`, or SSE/event markers).
- The worktree contains the Task Packet Preview contract: `Human will see`, `Human will NOT see`, and Privacy Budget `P0` to `P4`.
- The worktree contains the local rehearsal feed server used to test Surface A before Windows is ready.
- Fixture snapshots satisfy the controller-snapshot contract from the plan.
- The Enter database handoff inventory exists and preserves the REST-only/read-only Surface A boundary.

## Proof flow contract versions

The current Enter proof API may still require `secret_phrase`, `narrative`, and
`proof_text`. Those fields are **post-task evidence** for proof/verify.
They are not the privacy-safe context contract.

The demo context contract is the **Task Packet Preview**:

- shown before assignment dispatch or task reveal,
- split into `Human will see` and `Human will NOT see`,
- governed by Privacy Budget `P0` to `P4`,
- defaulted to `P1 · redacted artifact slice`,
- blocked at `P4`,
- audited separately from proof submission.

Regression checks should fail if Task Packet fields disappear, if P-level privacy
budget is not parseable as `P0` to `P4`, or if docs/UI collapse the preview into
`secret_phrase + narrative` proof copy.

## Commands

```bash
node --check scripts/stage_state_rehearsal_server.mjs
node verification/check-demo-readiness.mjs --report verification/latest-report.json
node verification/check-demo-readiness.mjs --strict
node verification/check-demo-readiness.mjs --strict --remote-feed http://<windows-host>:4173/humanmcp/stage-state
# Optional credentialed API smoke test after Enter API env is injected:
scripts/humanmcp_contract_probe.sh check-env
scripts/humanmcp_contract_probe.sh smoke-read
```

- Default mode writes a human-readable console report and can optionally emit JSON.
- `--strict` exits non-zero when the local worktree is not demo-ready.
- `--remote-feed` validates a Windows/OpenClaw stage-state feed for HTTP reachability, JSON shape, CORS, approved stage vocabulary, source ownership, and fresh `updatedAt`.

## Files

- `verification/demo-requirements.json` — frozen requirements used by the harness.
- `verification/stage-state-fixtures.json` — sample happy/fallback controller snapshots for validator smoke coverage.
- `verification/check-demo-readiness.mjs` — source, fixture, remote feed, and Enter database handoff validator.
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
