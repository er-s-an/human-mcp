# OpenClaw Surface B Integration Review

## Scope

This document freezes the **Surface B** contract for the Windows/OpenClaw machine: the expression/status/stamp screen, the shared stage-state snapshot it owns, and the fallback behavior when the robot or website stamp completion path is unavailable.

Write scope for this worker was documentation-only. The OpenClaw repo at `/Users/xiejiachen/openclaw` was reviewed read-only and was **not** edited.

## Reviewed Brownfield Evidence

### Existing OpenClaw surfaces already in place

- `ui/src/ui/humanmcp.ts`
  - Exposes `VITE_HUMAN_MCP_API_BASE_URL` and `VITE_HUMAN_MCP_AUTH_TOKEN`.
  - Normalizes humans / assignments / proofs / verify responses.
  - Provides `listHumans`, `assignTask`, `listPendingProofs`, and `verifyProof`.
  - Does **not** currently expose a dedicated stamp-complete client helper.
- `ui/src/ui/components/humanmcp-stage-panel.ts`
  - Already renders the HumanMCP operator panel and stage display.
  - Polls proofs every 5 seconds.
  - Still owns local `verification` and `localStampStatus` state, plus `Virtual stamp` and `Operator fallback` buttons.
- `ui/src/ui/components/humanmcp-stage-display.ts`
  - Already renders the expression-facing stage display from a snapshot with AI state, stage, metrics, toolbox, and log trace.
- `ui/src/ui/views/overview.ts`
  - Already mounts the stage panel in the overview screen.
- `ui/src/ui/humanmcp.test.ts`
  - Already covers auth header creation, payload normalization, verify responses, stamp normalization, and stage derivation.

### Review conclusion

Surface B should stay on the existing OpenClaw overview/stage-panel path. The remaining work on the Windows machine is **controller unification and launch/runbook hardening**, not a UI rewrite.

## Surface B Contract

### Ownership boundary

Windows/OpenClaw is the **single live stage-state writer**.

It owns:

- task assignment dispatch
- proof polling
- verify calls
- robot stamp trigger
- virtual/manual stamp fallback
- operator controls
- publication of the shared stage-state snapshot

It must **not** let Surface A (Mac context screen) or the Enter website infer terminal truth on their own. Surface A may only consume the Windows snapshot read-only.

### What Surface B must render

Surface B is the Windows/OpenClaw full-screen operator surface and must always show:

1. **Expression state** — the visible OpenClaw face / AI mood.
2. **Stage state** — the contract state used by both screens.
3. **Task context** — active human, task, subtask, proof, reward delta.
4. **Stamp path** — `requested`, robot in-flight, hardware done, virtual done, or manual/reconciliation mode.
5. **Operator controls** — retry, skip/manual advance, virtual stamp, operator fallback, optional robot trigger.
6. **Stage trace** — short recent log rows visible enough for live recovery.

### Required state fields for Surface B rendering

Surface B must render directly from the controller snapshot below rather than mixing snapshot data with independent terminal UI state.

| Field | Required | Meaning |
| --- | --- | --- |
| `stage` | yes | Shared authoritative stage value |
| `expressionState` | yes | OpenClaw expression / AI mood for Surface B |
| `humanName` | yes when assigned | The currently active human/capability |
| `taskId` / `subtaskId` | yes when assigned | HumanMCP task identity |
| `proofId` | yes after proof appears | Pending or verified proof identity |
| `verified` | yes after verify attempt | `true`, `false`, or `null` before verify |
| `rewardDelta` | optional | Verify reward result |
| `stampStatus` | yes after verify | Robot/virtual/manual branch state |
| `message` | yes | Operator-readable live summary |
| `updatedAt` | yes | ISO timestamp used for feed staleness checks |
| `operatorActions` | yes | Which controls remain legal in the current state |

## Shared Stage-State JSON Contract

### Transport

Primary P0 transport:

- `GET /humanmcp/stage-state`
- response: one JSON controller snapshot
- publisher: Windows/OpenClaw machine only
- consumer: Mac Surface A read-only

Optional enhancement:

- `GET /humanmcp/stage-events` via SSE

Contingency transport if the endpoint is not ready in time:

- write `stage-state.json` to a Windows-served path and have Surface A poll that file

### Canonical snapshot shape

```json
{
  "version": "2026-04-24",
  "source": "windows-openclaw",
  "mode": "live",
  "stage": "stamp_ready",
  "expressionState": "verified",
  "humanId": "human_123",
  "humanName": "Alice",
  "endpoint": "/humanmcp/alice/vision",
  "assignmentId": "assign_123",
  "taskId": "openclaw_live_demo",
  "subtaskId": "surface-b",
  "proofId": "proof_987",
  "verified": true,
  "level": "L2",
  "rewardDelta": 10,
  "stampStatus": "requested",
  "message": "Proof verified; robot or fallback stamp can complete now.",
  "updatedAt": "2026-04-24T11:30:00.000Z",
  "operatorActions": {
    "canRetry": true,
    "canManualAdvance": true,
    "canVirtualStamp": true,
    "canOperatorFallback": true,
    "canTriggerRobot": true
  },
  "fallback": {
    "macContextMode": "live",
    "reason": null
  }
}
```

A parseable example is checked in at [`docs/runbooks/examples/stage-state.example.json`](./examples/stage-state.example.json).

### Allowed `stage` values

These values follow the approved demo plan and extend the narrower current OpenClaw MVP enum.

- `idle`
- `auth_blocked`
- `no_humans`
- `assigned`
- `calling`
- `proof_pending`
- `verify_failed`
- `verified`
- `stamp_ready`
- `virtual_stamp`
- `manual_override`
- `stamped`
- `complete`
- `fallback_scripted`

### Allowed `expressionState` values

These should stay compatible with the existing OpenClaw stage display model.

- `idle`
- `thinking`
- `calling`
- `waiting`
- `proof_verifying`
- `verified`
- `stamped`
- `conflict`
- `needs_help`

### Allowed `stampStatus` values

Use these values so robot and fallback branches remain unambiguous:

- `null` — no verify result yet
- `requested` — verify passed and stamping is allowed
- `robot_inflight` — robot trigger sent, waiting for completion
- `hardware_done` — physical stamp completed
- `virtual_done` — virtual stamp fallback completed
- `manual_done` — operator/manual stamp fallback completed
- `reconciliation_pending` — local fallback succeeded, cloud writeback still owed

## Required state-transition rules

1. `verified=true` plus `stampStatus=requested` moves the shared stage to `stamp_ready`.
2. Robot success moves `stampStatus` to `hardware_done` and stage to `stamped`.
3. Virtual fallback moves stage to `virtual_stamp` first, then `stamped` with `stampStatus=virtual_done`.
4. Manual/operator fallback moves stage to `manual_override`, then `complete` when the operator confirms the show can continue.
5. If Mac Surface A cannot fetch a fresh snapshot for **more than 5 seconds**, it must switch itself to `fallback_scripted`; Surface B stays authoritative.
6. Surface B may trigger actions, but it must not keep a separate terminal truth once the controller snapshot exists.

## Brownfield gap list to close on the Windows machine

1. **Promote the controller snapshot to authority**
   - The current panel still derives stage locally from assignment/proof/verification/local stamp state.
   - That derivation must become a single publisher snapshot used by both Surface B and Surface A.
2. **Extend stage vocabulary**
   - Current `HumanMcpStageState` in `humanmcp.ts` only covers `idle`, `assigned`, `proof_pending`, `rejected`, `verified`, `stamp_ready`, and `stamped`.
   - The Windows controller must add the approved demo states above, especially `auth_blocked`, `no_humans`, `calling`, `verify_failed`, `manual_override`, and `fallback_scripted`.
3. **Separate robot stamp from fallback stamp**
   - Current panel buttons only model `virtual_done` and operator fallback.
   - The Windows handoff must explicitly distinguish `robot_inflight`, `hardware_done`, `virtual_done`, and `manual_done`/`reconciliation_pending`.
4. **Publish the snapshot on LAN**
   - Preferred: `GET /humanmcp/stage-state`.
   - Backup: write `stage-state.json` to a Windows-served path.
5. **Keep auth/config out of code**
   - Continue injecting base URL and auth token through env/config only.
   - Do not embed any secret token into repo files or documentation artifacts.

## Robot / Virtual Stamp Fallback Policy

### Primary path

1. Proof is verified by website/cloud truth.
2. Windows/OpenClaw controller sets `stage=stamp_ready`, `stampStatus=requested`.
3. Operator triggers the robot stamp.
4. On success, snapshot becomes `stampStatus=hardware_done`, `stage=stamped`.
5. If the website stamp-complete endpoint exists and is stable, write back cloud completion after hardware success.

### Mandatory demo-safe fallback

If the robot path or cloud stamp-complete endpoint is unavailable:

1. Keep the verified proof as truth.
2. Trigger **virtual stamp** or **manual operator fallback** from Surface B.
3. Move snapshot to either:
   - `stage=virtual_stamp` -> `stage=stamped`, `stampStatus=virtual_done`, or
   - `stage=manual_override` -> `stage=complete`, `stampStatus=manual_done`
4. If cloud writeback still cannot happen, set `stampStatus=reconciliation_pending` before handoff closes.
5. Record the proof id and required post-demo reconciliation step in the operator log.

This keeps the show moving without falsely claiming a physical robot success.
