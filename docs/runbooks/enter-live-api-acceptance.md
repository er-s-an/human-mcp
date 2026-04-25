# Enter Live API Acceptance Runbook

Use this runbook after the Windows/OpenClaw rehearsal feed is reachable from the Mac. The goal is to move from `mode=rehearsal` to a real Enter-backed proof/verify/stamp path without changing the three-screen demo contract.

## Current Accepted Baseline

- Mac can fetch `http://172.16.21.116:4173/humanmcp/stage-state`.
- Windows/OpenClaw publishes `source=windows-openclaw`.
- Windows/OpenClaw publishes CORS headers for Surface A.
- Surface A shows `FEED=CONNECTED` and `MODE=rehearsal`.
- Stage can sit at `stamp_ready` with `stampStatus=requested`.
- AirJelly is still `Mock Mode` unless a real adapter explicitly reports otherwise.

## Enter Database Handoff Inventory

This repo currently contains no raw database dump, migration, SQLite file, or
schema artifact. The actionable handoff surface is therefore the Enter API
contract already frozen for OpenClaw:

- task replay/create: `POST /tasks/assign`
- proof polling: `GET /proofs?status=pending`
- proof verification: `POST /proofs/{proof_id}/verify`
- stamp persistence: `POST /stamps/{proof_id}/complete`

Impact on the demo contract:

- Mac Surface A remains read-only and mirrors the Windows/OpenClaw snapshot.
- Windows/OpenClaw must publish the Enter `assignmentId` once assignment is
  backed by the database.
- Windows/OpenClaw must publish the Enter `proofId` once proof polling is
  backed by the database.
- `mode=live` is allowed only after those identifiers come from Enter, not from
  rehearsal fixtures.

## Do Not Change

- Do not make Mac Surface A a writer.
- Do not bypass bearer auth for OpenClaw-to-Enter requests.
- Do not claim `mode=live` until Enter API proof/verify is actually used.
- Do not claim `AirJelly Connected` from rehearsal data.
- Do not block the demo on hardware stamp; `virtual_done` is the P0-safe terminal branch.

## Enter DB Handoff Review

Before changing `mode` to `live`, use [`enter-db-handoff-impact.md`](./enter-db-handoff-impact.md) to inventory the received schema/API evidence, confirm which Windows/Enter commands still need credentials, and keep Surface A read-only.

## Windows/OpenClaw Next Task

1. Inject Enter API config through environment only:

```powershell
$env:VITE_HUMAN_MCP_API_BASE_URL = 'https://<enter-host>/api/v1'
$env:VITE_HUMAN_MCP_AUTH_TOKEN = 'Bearer <redacted>'
```

2. Confirm the same config from an operator shell:

```powershell
$env:HUMAN_MCP_API_BASE_URL = 'https://<enter-host>/api/v1'
$env:HUMAN_MCP_AUTH_TOKEN = 'Bearer <redacted>'
```

3. Run the contract probe from a shell that has the handoff snapshot:

```bash
scripts/humanmcp_contract_probe.sh check-env
scripts/humanmcp_contract_probe.sh smoke-read
scripts/humanmcp_contract_probe.sh assign-demo <human_id>
```

4. Wire OpenClaw actions to Enter instead of local rehearsal data:

- `GET /humans?online=true`
- `POST /tasks/assign`
- `GET /proofs?status=pending`
- `POST /proofs/{proof_id}/verify`
- `POST /stamps/{proof_id}/complete`

5. Keep publishing the same Windows stage-state snapshot while replacing rehearsal values with Enter response values.

6. Only after verify is backed by Enter, change:

```json
{
  "mode": "live"
}
```

## Acceptance Gates

### Gate 1: Read Auth

Pass criteria:

- `check-env` passes.
- `smoke-read` reaches humans, tasks, and pending proofs.
- Missing or invalid auth produces an explicit blocked state, not silent unauthenticated fallback.

Expected stage-state if blocked:

```json
{
  "stage": "auth_blocked",
  "expressionState": "needs_help",
  "stampStatus": null,
  "message": "OpenClaw is blocked on Enter API auth."
}
```

### Gate 2: Assign

Pass criteria:

- OpenClaw can create/replay one demo assignment through `POST /tasks/assign`.
- The returned assignment identity appears in `/humanmcp/stage-state`.
- Surface A updates from Windows feed without changing its URL.

Expected stage-state:

```json
{
  "mode": "live",
  "stage": "assigned",
  "expressionState": "calling",
  "assignmentId": "<enter_assignment_id>",
  "taskId": "openclaw_live_demo",
  "subtaskId": "surface-b"
}
```

### Gate 3: Proof Poll

Pass criteria:

- User submits proof on Enter website.
- OpenClaw sees it through `GET /proofs?status=pending`.
- `proofId` in stage-state is the real Enter proof id.

Expected stage-state:

```json
{
  "mode": "live",
  "stage": "proof_pending",
  "expressionState": "proof_verifying",
  "proofId": "<enter_proof_id>",
  "verified": false
}
```

### Gate 4: Verify

Pass criteria:

- OpenClaw calls `POST /proofs/{proof_id}/verify`.
- Website returns and persists the verify result.
- Repeating verify does not duplicate reward or stamp state.

Expected successful stage-state:

```json
{
  "mode": "live",
  "stage": "stamp_ready",
  "expressionState": "verified",
  "verified": true,
  "stampStatus": "requested",
  "rewardDelta": 10
}
```

### Gate 5: Virtual Stamp Writeback

Pass criteria:

- OpenClaw chooses virtual stamp for P0.
- OpenClaw calls `POST /stamps/{proof_id}/complete` with `mode=virtual`, `result=virtual_done`.
- Website persists the terminal stamp state.
- Stage-state ends at `stamped` or `complete` with `stampStatus=virtual_done`.

Probe command:

```bash
scripts/humanmcp_contract_probe.sh complete-stamp <proof_id> virtual_done
```

Expected final stage-state:

```json
{
  "mode": "live",
  "stage": "complete",
  "expressionState": "stamped",
  "stampStatus": "virtual_done"
}
```

## Mac Verification Command

After each gate, the Mac side should run:

```bash
node verification/check-demo-readiness.mjs --strict --remote-feed http://172.16.21.116:4173/humanmcp/stage-state
```

This only validates the shared feed. It does not prove Enter is live unless `mode=live` and the proof/assignment ids are known to come from Enter.

After Gate 2 or later, add the stricter Enter-backed check:

```bash
node verification/check-demo-readiness.mjs --strict --remote-feed http://172.16.21.116:4173/humanmcp/stage-state --expect-live-enter
```

That stricter check fails if the remote feed claims a live Enter-backed stage but
omits the required database-derived identifiers for that stage.

## Windows Path Commands

Run these from Windows PowerShell after substituting the actual checkout path and
redacted credentials:

```powershell
$OpenClawRoot = 'C:\Users\31376\Documents\Codex\2026-04-24\c-users-31376-xwechat-files-wxid\humanmcp-surface-b'
Set-Location $OpenClawRoot
$env:VITE_HUMAN_MCP_API_BASE_URL = 'https://<enter-host>/api/v1'
$env:VITE_HUMAN_MCP_AUTH_TOKEN = 'Bearer <redacted>'
$env:HUMAN_MCP_API_BASE_URL = $env:VITE_HUMAN_MCP_API_BASE_URL
$env:HUMAN_MCP_AUTH_TOKEN = $env:VITE_HUMAN_MCP_AUTH_TOKEN
bash scripts/humanmcp_contract_probe.sh check-env
bash scripts/humanmcp_contract_probe.sh smoke-read
bash scripts/humanmcp_contract_probe.sh assign-demo <human_id>
npm run build
npm run dev -- --host 0.0.0.0 --port 4173
```

## Windows Handoff Back To Mac

Send this after each gate:

```text
Gate passed: read-auth | assign | proof-poll | verify | virtual-stamp-writeback
Stage-state URL: http://172.16.21.116:4173/humanmcp/stage-state
Mode: rehearsal | live
Latest assignment id:
Latest proof id:
Latest stage:
Latest stamp status:
Enter API base URL host only:
Auth configured by env: yes/no
Virtual stamp writeback tested: yes/no
Known gap:
```
