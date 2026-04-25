# AirJelly P2/P3 Roadmap

This roadmap keeps the current demo bridge in place while the project moves toward a production Enter/OpenCloud coordinator and then AirJelly-native helper delivery.

- P2 = formal Enter/OpenCloud coordinator integration with auth, persistence, assignment/proof/verify/stamp APIs.
- P3 = AirJelly-native helper notification/inbox integration.

## Current Bridge vs Production

| Area | Current bridge | Production target |
| --- | --- | --- |
| Coordinator | Repo-local dual-end coordinator + notifier: [`scripts/humanmcp_dual_end_coordinator.mjs`](../../scripts/humanmcp_dual_end_coordinator.mjs) and [`scripts/humanmcp_airjelly_inbox_notifier.mjs`](../../scripts/humanmcp_airjelly_inbox_notifier.mjs) | Enter/OpenCloud coordinator service |
| State | JSON state file under `.omx/state/` | Persistent Enter/OpenCloud-backed state |
| Notification | macOS notification, browser open, AirJelly `createTask` when `--create-airjelly-task` is enabled | AirJelly-native inbox/notification path |
| Truth source | Demo-safe bridge state | Production Enter/OpenCloud data |

Keep the bridge as the rehearsal fallback. Production should swap the backing service, not the user-facing contract.

## P2: Enter/OpenCloud Coordinator Integration

### What the other computer needs

- Network reachability to the coordinator host and the Enter/OpenCloud API.
- Auth credentials injected through env only.
- Writable persistent storage for active assignments, proofs, verify results, and stamp state.
- The same stage-state contract Surface A already reads.
- Access to this repo’s validation scripts, or an equivalent deployment environment that exposes the same API contract.

### Acceptance criteria

- `POST /tasks/assign` creates or replays exactly one assignment for the demo business key.
- `GET /proofs?status=pending` returns persisted proof rows after assignment dispatch.
- `POST /proofs/{proof_id}/verify` persists the verify result and is idempotent.
- `POST /stamps/{proof_id}/complete` persists the terminal stamp result and is idempotent.
- Restarting the coordinator does not lose `assignmentId`, `proofId`, `verified`, or `stampStatus`.
- The live stage-state feed remains readable from Surface A and reflects production truth, not local rehearsal state.
- No secret, token, or canonical `secret_phrase` is committed to the repo.

### Validation commands

```bash
bash scripts/humanmcp_contract_probe.sh check-env
bash scripts/humanmcp_contract_probe.sh smoke-read
bash scripts/humanmcp_contract_probe.sh assign-demo <human_id>
bash scripts/humanmcp_contract_probe.sh verify-proof <proof_id>
bash scripts/humanmcp_contract_probe.sh complete-stamp <proof_id> virtual_done
node verification/check-demo-readiness.mjs --strict --remote-feed http://<windows-host>:4173/humanmcp/stage-state
```

### Bridge regression checks

Use these to prove the current bridge still behaves while P2 is being built:

```bash
node verification/check-dual-end-bridge.mjs
node verification/check-dual-end-flow.mjs
node verification/check-dual-end-privacy-gates.mjs
node verification/check-demo-readiness.mjs --strict
```

### P2 done when

- The Enter/OpenCloud-backed coordinator is the system of record.
- Assignment, proof, verify, and stamp calls survive a restart.
- Surface A can read the live feed without any demo-only local truth leaking into production.

## P3: AirJelly-Native Helper Notification/Inbox Integration

### What the other computer needs

- AirJelly runtime or SDK access on the helper machine.
- At least one working native method among `createNotification`, `showNotification`, `notify`, `pushNotification`, or `openInboxNotification`.
- AirJelly `createTask` support for the current P3 helper task trail.
- A future native notification RPC can replace `createTask` when AirJelly exposes one.
- A browser or OS notification fallback for hosts without the native method.

### Acceptance criteria

- The notifier can deliver a task into AirJelly via `createTask` without relying on browser-only open behavior.
- If a native notification RPC exists later, it is preferred; if not, the bridge uses `createTask` plus system notification and browser open.
- The helper sees only the redacted task packet and match summary; raw AirJelly memory stays local.
- The helper can mark the task seen/opened and the coordinator records the event.
- P3 does not change the Enter/OpenCloud assignment/proof/stamp contract from P2.

### Validation commands

```bash
node scripts/humanmcp_airjelly_inbox_notifier.mjs --coordinator http://<host>:4180 --human-id lindsay --open
node scripts/humanmcp_airjelly_inbox_notifier.mjs --coordinator http://<host>:4180 --human-id lindsay --open --create-airjelly-task
node verification/check-dual-end-bridge.mjs
```

### P3 done when

- `--create-airjelly-task` creates a visible AirJelly task on the helper machine.
- The notifier logs `AirJelly task created for <task_id>` for the delivered HumanMCP task.
- The browser/system fallback still works when AirJelly is unavailable.
- The coordinator continues to record the same task, proof, and stamp identifiers used by P2.

## Release order

1. Finish P2 first.
2. Keep the current bridge as the fallback until P2 is stable.
3. Ship P3 after P2 so the native helper path only changes notification delivery, not the data contract.
