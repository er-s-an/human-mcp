# Enter DB Handoff Impact Review

Use this note when the Enter-side database handoff arrives but before anyone changes the Mac Surface A contract. It records what was visible from this Mac repo on 2026-04-25 and what still needs credentialed Windows/Enter confirmation.

## Artifact inventory

| Area | Artifact / evidence | Impact |
| --- | --- | --- |
| Mac repo | No checked-in SQL, migration, ORM schema, or seed file is present under `/Users/xiejiachen/Documents/New project`. | Surface A cannot validate database tables directly. Keep validation at the API/feed boundary. |
| Team context | `.omx/context/enter-db-surface-b-update-20260425T034618Z.md` says Enter provided database information, but the exact handoff location/format is still unknown. | Treat the DB handoff as pending until the Windows/Enter owner supplies a schema or API-host confirmation. |
| Enter API contract | Existing docs and probe cover `/humans`, `/tasks/assign`, `/proofs?status=pending`, `/proofs/{proof_id}/verify`, and `/stamps/{proof_id}/complete`. | These endpoints remain the stable handoff surface; do not make Surface A read database rows directly. |
| OpenClaw code surface | `/Users/xiejiachen/openclaw/ui/src/ui/humanmcp.ts` already normalizes snake_case and camelCase fields for humans, assignments, proofs, verify, and stamp results. | The current adapter can absorb common DB/API naming differences if endpoint response shape stays within the documented contract. |
| Windows repo handoff path | Expected Windows path: `C:\Users\31376\Documents\Codex\2026-04-24\c-users-31376-xwechat-files-wxid\humanmcp-surface-b`. This path is not accessible from the Mac worktree. | Commands below must be run on Windows or by the Windows owner. |

## Database-to-stage impact map

| Enter DB/API fact to confirm | Required API evidence | Stage-state field affected | Mac Surface A change needed? |
| --- | --- | --- | --- |
| Humans table exposes callable online users without leaking canonical `secret_phrase`. | `GET /humans?online=true` returns `human_id`/`humanId`, display name, optional level/reward/skills. | `stage=assigned` readiness; candidate/operator copy. | No, unless the feed field names change. |
| Assignments are idempotent by demo business key. | Repeating `POST /tasks/assign` returns the same `assignment_id` or a safe replay response. | `assignmentId`, `taskId`, `subtaskId`, `stage=assigned`. | No. Surface A mirrors the Windows snapshot only. |
| Proof rows preserve pending status and proof identity. | `GET /proofs?status=pending` returns `proof_id`/`proofId`, `assignment_id`, status, and timestamp. | `proofId`, `stage=proof_pending`, `expressionState=proof_verifying`. | No. |
| Verify persists reward/stamp readiness exactly once. | `POST /proofs/{proof_id}/verify` returns `verified`, `reward_delta`, `can_stamp`, `stamp_status=requested`, and stable repeat behavior. | `verified`, `rewardDelta`, `stampStatus=requested`, `stage=stamp_ready`. | No. |
| Stamp completion persists the terminal branch. | `POST /stamps/{proof_id}/complete` returns/persists `virtual_done`, `hardware_done`, or explicit reconciliation status. | `stampStatus`, terminal `stage=stamped` or `stage=complete`. | No, unless a new terminal value is introduced. |

## Review decision

- **Mac Surface A UX:** no code change is needed for the DB handoff. Surface A must stay read-only and consume only the Windows/OpenClaw stage-state feed.
- **Validation harness:** keep local validation focused on source/feed contract checks. Remote DB truth is proven by the Enter API probe plus a Windows-published snapshot, not by Mac database access.
- **Docs:** the handoff gap is now explicit: schema/API proof must be provided by the Windows/Enter owner before anyone claims `mode=live`.

## Windows / Enter commands still requiring Windows or credentials

Run these from PowerShell on the Windows Surface B machine after substituting the real path and environment values. Do not paste secrets into docs or commits.

```powershell
$SurfaceBRoot = 'C:\Users\31376\Documents\Codex\2026-04-24\c-users-31376-xwechat-files-wxid\humanmcp-surface-b'
Set-Location $SurfaceBRoot

$env:VITE_HUMAN_MCP_API_BASE_URL = 'https://<enter-host>/api/v1'
$env:VITE_HUMAN_MCP_AUTH_TOKEN = 'Bearer <redacted>'
$env:HUMAN_MCP_API_BASE_URL = $env:VITE_HUMAN_MCP_API_BASE_URL
$env:HUMAN_MCP_AUTH_TOKEN = $env:VITE_HUMAN_MCP_AUTH_TOKEN

# If this repo contains the Mac probe script, run it from repo root; otherwise copy the script only, not secrets.
bash scripts/humanmcp_contract_probe.sh check-env
bash scripts/humanmcp_contract_probe.sh smoke-read
bash scripts/humanmcp_contract_probe.sh verify-proof <proof_id>
bash scripts/humanmcp_contract_probe.sh complete-stamp <proof_id> virtual_done

# Launch Surface B after the API/env checks are known.
Set-Location "$SurfaceBRoot\ui"
npm install
npm test -- humanmcp.test.ts
npm run dev -- --host 0.0.0.0 --port 4173
```

Send this back to the Mac owner after each gate:

```text
Schema/API proof source: <migration/schema path or Enter owner confirmation>
Stage-state URL: http://<windows-host>:4173/humanmcp/stage-state
Mode: rehearsal | live
Latest assignment id:
Latest proof id:
Latest stamp status:
Virtual stamp writeback tested: yes/no
Known DB/API gap:
```
