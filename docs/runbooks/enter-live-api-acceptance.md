# Enter Live API Acceptance Runbook

Use this runbook after the Windows/OpenClaw rehearsal feed is reachable from the Mac. The goal is to move from `mode=rehearsal` to a real Enter-backed proof/verify/stamp path without changing the three-screen demo contract.

## Current Accepted Baseline

- Mac can fetch `http://172.16.21.116:4173/humanmcp/stage-state`.
- Windows/OpenClaw publishes `source=windows-openclaw`.
- Windows/OpenClaw publishes CORS headers for Surface A.
- Surface A shows `FEED=CONNECTED` and mirrors the Windows `MODE` (`rehearsal` before Enter handoff, `live` after Enter-backed gates pass).
- Stage can sit at `stamp_ready` with `stampStatus=requested` or finish at `stamped`/`complete` with `stampStatus=virtual_done`.
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

## OPC / Task Packet Demo Contract

The demo story is **AI Operating Team for One-Person Companies**:

1. AirJelly observes the solo founder's local work context and current artifact.
2. OpenClaw decides that a permissioned human reviewer is useful.
3. HumanMCP packages a minimal, redacted Task Packet.
4. The human user scans the QR code and opens the Enter website.
5. Enter shows **Task Packet Preview** before assignment dispatch or task reveal.
6. The reviewer answers one scoped question.
7. The proof/verify/stamp path records the result and returns control to the founder.

`secret_phrase`, `narrative`, and `proof_text` are proof submission evidence.
They do not define what context the human reviewer is allowed to see.
The Task Packet Preview is the pre-dispatch privacy boundary.

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

- The human QR code opens the Enter website, not an OpenClaw scanner path.
- Before assignment dispatch or task detail display, the website shows a **Task Packet Preview** modal.
- The modal says “AI wants to call a human reviewer.”
- The modal has two explicit columns:
  - `Human will see`: product category, current headline/artifact slice, one screenshot or bounded excerpt, target user, one question, output schema.
  - `Human will NOT see`: user name, full browser screen, raw AirJelly memory, private messages, credentials, revenue data, unrelated tabs.
- The modal visualizes Privacy Budget `P0`, `P1`, `P2`, `P3`, and `P4`; demo default is `P1`, and `P4` blocks dispatch.
- `Confirm` creates/replays the assignment; `Cancel` does not create a new assignment.
- If the demo claim is “scan to receive a task,” the website QR landing route can create/replay one demo assignment through `POST /tasks/assign`, or it can resolve a pre-created assignment id from the QR URL.
- A plain website visit is not enough evidence; the validation must show the assignment id created or resolved by the website flow.
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

QR website validation evidence:

```text
QR URL opened:
Task Packet Preview shown before assignment dispatch: yes/no
Privacy Budget level shown:
Human will see column:
Human will NOT see column:
Preview action: confirmed | cancelled | existing assignment resolved
Human id resolved by website:
Assignment flow: created by website | replayed by website | pre-created by OpenClaw/operator
Assignment id returned/resolved by website:
Website marked seen: yes/no
Same assignment id appears in Surface B feed: yes/no
Proof fields kept out of preview: yes/no
Known gap:
```

If the website source is not available from the Mac checkout, verify this with API evidence:

1. Capture task count or task ids for the target `human_id` before opening the QR URL.
2. Open the QR URL as the human would.
3. Capture task count or task ids again.
4. Confirm a new/replayed `assignment_id` appears, or confirm the QR resolved an existing assignment id.
5. Confirm `/humanmcp/stage-state` publishes the same id.

### Gate 2.5: Task Packet Preview

Pass criteria:

- Preview is generated from `taskPacket` / `task_packet` or safe defaults derived from the current assignment.
- The preview supports both snake_case and camelCase fields.
- Missing packet fields degrade to safe copy instead of a blank modal.
- If backend assignment metadata is supported, `POST /tasks/assign` may include `task_packet` or `metadata.task_packet`.
- If backend metadata is not supported, the frontend keeps the packet keyed by `assignmentId` for demo display and audit, without changing the proof API.
- The preview never renders canonical `secret_phrase`, raw AirJelly memory, full-screen data, private messages, credentials, or revenue data.
- After confirmation, the task detail/proof page still uses the existing proof submission fields, but displays the Task Packet summary separately.

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
