# Windows OpenClaw Handoff Runbook

This runbook is the exact handoff for the Windows machine owner who will operate **Surface B** and publish the shared stage-state feed.

## Inputs the Windows owner needs before launch

- OpenClaw repo checkout on Windows
- HumanMCP API base URL
- HumanMCP auth token (if required by the website deployment)
- Windows LAN IP or hostname that the Mac can reach
- Decision: real robot trigger available or fallback-only demo

## 1. Prepare the Windows repo checkout

Open PowerShell and define the repo root:

```powershell
$OpenClawRoot = 'C:\openclaw'
Set-Location $OpenClawRoot
```

If the repo lives elsewhere, change only `$OpenClawRoot` and keep the rest of the steps the same.

## 2. Inject runtime config without editing code

```powershell
$env:VITE_HUMAN_MCP_API_BASE_URL = 'https://<your-humanmcp-host>/api/v1'
$env:VITE_HUMAN_MCP_AUTH_TOKEN = 'Bearer <redacted>'
```

Rules:

- never hardcode the token into source files
- never put the canonical `secret_phrase` on the Windows/OpenClaw machine
- keep the same base URL/auth contract used by the website lane

## 3. Install dependencies and run the existing OpenClaw checks

```powershell
Set-Location "$OpenClawRoot\ui"
npm install
npm test -- humanmcp.test.ts
```

Expected outcome:

- tests should cover auth headers, normalization, verify flow, and current stage-state helpers
- if the test environment fails before running assertions, capture the exact console output and continue with the fallback rehearsal plan instead of blocking the whole demo

## 4. Freeze Surface B launch shape

Surface B must remain the existing OpenClaw overview/stage-panel path.

```powershell
Set-Location "$OpenClawRoot\ui"
npm run dev -- --host 0.0.0.0 --port 4173
```

Expected operator URL on Windows:

- `http://localhost:4173`

Expected Mac-readable URL once the stage-state publisher is live:

- `http://<windows-host>:4173/humanmcp/stage-state`

If the HTTP endpoint is not ready, use the contingency file URL instead:

- `http://<windows-host>:4173/humanmcp/stage-state.json`

## 5. Implement or wire the single-writer controller before rehearsal

The Windows owner must ensure these actions all update one shared snapshot:

- preview the Human Task Packet before assignment dispatch
- assign task
- refresh / poll proofs
- verify proof
- trigger robot stamp
- virtual stamp fallback
- operator/manual fallback
- retry / manual advance

Do **not** let the Mac screen or a second UI loop derive terminal truth independently.

The preview step is a real gate:

- Show `AI wants to call a human reviewer.`
- Show `Human will see` and `Human will NOT see` columns.
- Show Privacy Budget `P0` to `P4`; default `P1`, block `P4`.
- `Confirm` may create/replay the Enter assignment.
- `Cancel` must not create an assignment.
- Keep `secret_phrase`, `narrative`, and `proof_text` out of Task Packet state.

## 6. Publish the stage-state snapshot

Preferred contract:

- `GET /humanmcp/stage-state`
- returns the JSON contract from `openclaw-surface-b-integration-review.md`

Contingency contract:

- write `stage-state.json` at `ui/public/humanmcp/stage-state.json`
- refresh that file whenever controller state changes
- keep `updatedAt` current so the Mac can detect stale feed data

## 7. Robot stamp branch

Use this only if the robot interface is known-good on the demo machine.

1. Verify proof from Surface B.
2. Confirm snapshot shows `stage=stamp_ready` and `stampStatus=requested`.
3. Trigger the robot.
4. While running, publish `stampStatus=robot_inflight`.
5. On success, publish `stampStatus=hardware_done` and `stage=stamped`.
6. If the website stamp-complete endpoint exists, write back completion; otherwise leave a clear reconciliation note for after the demo.

## 8. Virtual/manual fallback branch

This branch must be demo-ready even if the robot path never starts.

### Virtual stamp

1. Verify proof from Surface B.
2. Trigger `Virtual Stamp`.
3. Publish `stage=virtual_stamp`.
4. End at `stage=stamped`, `stampStatus=virtual_done`.
5. If cloud writeback is still missing, change final `stampStatus` to `reconciliation_pending` only after the audience-visible stamp moment is complete.

### Operator/manual fallback

1. Use `Operator Fallback` when verify succeeded but robot/virtual path is not trustworthy.
2. Publish `stage=manual_override`.
3. Once the operator has verbally/visually completed the moment, publish `stampStatus=manual_done`.
4. Finish at `stage=complete`.
5. Log the proof id for post-demo reconciliation.

## 9. Exact handoff from Windows owner to Mac owner

After Windows is live, send the Mac owner all of the following:

1. Windows LAN URL for the feed (`/humanmcp/stage-state` or `/humanmcp/stage-state.json`)
2. confirmation that Windows/OpenClaw is the only live stage-state writer
3. the final fallback choice for the demo:
   - `robot`
   - `virtual`
   - `manual`
4. one fresh sample snapshot copied from the running feed
5. the operator phrase to use if the Mac feed goes stale: **"operator sync mode"**

Use the copy/paste packet in [`windows-openclaw-handoff-packet.md`](./windows-openclaw-handoff-packet.md) so the Windows-to-Mac handoff stays deterministic under rehearsal pressure.

Use the state cheat sheet in [`windows-openclaw-stage-state-transition-table.md`](./windows-openclaw-stage-state-transition-table.md) during rehearsal so operators call the same stage names on both machines.

## 10. Rehearsal acceptance checklist

The Windows machine is ready only when all are true:

- Surface B launches from the existing OpenClaw overview/stage panel
- auth/base URL values are injected through env only
- one snapshot feed is reachable from the Mac
- the snapshot includes `stage`, `expressionState`, `stampStatus`, `message`, and `updatedAt`
- Task Packet Preview blocks assignment dispatch until confirmed
- Privacy Budget `P0` to `P4` is visible; `P4` blocks dispatch
- Mac feed loss for >5 seconds can be handled by keeping Surface B as the authority
- at least one fallback path (`virtual` or `manual`) has been rehearsed end-to-end
- proof ids requiring reconciliation are written down before shutdown
