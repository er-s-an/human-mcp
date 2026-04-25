# Enter Database Handoff Inventory

This inventory records the Mac-side response to the Enter database handoff for the HumanMCP/OpenClaw demo. It is intentionally non-secret: database URLs, tokens, service keys, and canonical `secret_phrase` values must stay out of this repository and out of Surface A.

## Database artifact inventory

The current Mac Surface A worktree contains no direct database client, migration, schema, seed, Prisma, Drizzle, Supabase, SQLite, or SQL files. The Mac repo remains a read-only context screen plus verification harness.

Local artifacts that define the handoff boundary are:

| Area | Local artifact | Role after Enter DB handoff |
| --- | --- | --- |
| API/auth contract | `docs/website-openclaw-auth-stamp-freeze.md` | Defines the REST boundary that shields OpenClaw and Surface A from direct DB access. |
| Live acceptance gates | `docs/runbooks/enter-live-api-acceptance.md` | Verifies persisted assignment/proof/stamp state through the Enter API, not through DB reads. |
| Operator env checklist | `docs/website-openclaw-env-checklist.md` | Ensures secrets are injected through runtime env only. |
| Contract probe | `scripts/humanmcp_contract_probe.sh` | Exercises Enter-backed reads/writes with bearer auth from a credentialed shell. |
| Mac readiness harness | `verification/check-demo-readiness.mjs` | Validates Surface A and, when supplied, the Windows/OpenClaw feed shape. |
| Windows handoff | `docs/runbooks/windows-openclaw-handoff.md` | Keeps Surface B the only live stage-state writer. |

## Impact map

- **Enter database / website:** owns persisted truth for humans, assignments, proofs, verification, rewards, and stamp completion. Database access stays behind the website/API lane.
- **Windows/OpenClaw Surface B:** consumes the Enter REST API, is the single live stage-state writer and publishes one shared stage-state snapshot, and writes terminal stamp completion through `POST /stamps/{proof_id}/complete`.
- **Mac Surface A:** remains a read-only consumer of `GET /humanmcp/stage-state`; it must not read the Enter database or call write endpoints.
- **Validation harness:** continues to validate the Mac worktree locally and validates the Windows feed remotely. It does not prove database persistence unless the feed is `mode=live` and the IDs came from Enter API responses.

## API fields that must be backed by Enter persistence

When the live handoff is active, the Windows-published snapshot should carry identifiers that can be traced back to Enter API responses:

- `assignmentId` from `POST /tasks/assign`
- `proofId` from `GET /proofs?status=pending`
- `verified` and `rewardDelta` from `POST /proofs/{proof_id}/verify`
- `stampStatus` from `POST /stamps/{proof_id}/complete`
- `mode=live` only after verify/stamp activity is backed by Enter, not local rehearsal state

## Windows Surface B path commands

Run these on Windows from the provided Surface B checkout. Keep secrets in environment variables only.

```powershell
$SurfaceBRoot = 'C:\Users\31376\Documents\Codex\2026-04-24\c-users-31376-xwechat-files-wxid\humanmcp-surface-b'
Set-Location $SurfaceBRoot

$env:VITE_HUMAN_MCP_API_BASE_URL = 'https://<enter-host>/api/v1'
$env:VITE_HUMAN_MCP_AUTH_TOKEN = 'Bearer <redacted>'
$env:HUMAN_MCP_API_BASE_URL = $env:VITE_HUMAN_MCP_API_BASE_URL
$env:HUMAN_MCP_AUTH_TOKEN = $env:VITE_HUMAN_MCP_AUTH_TOKEN

# If this checkout has a ui subdirectory, run UI commands there.
if (Test-Path .\ui) { Set-Location .\ui }
npm test -- humanmcp.test.ts
npm run dev -- --host 0.0.0.0 --port 4173
```

From a credentialed shell that has the Mac probe script or an equivalent copy:

```bash
scripts/humanmcp_contract_probe.sh check-env
scripts/humanmcp_contract_probe.sh smoke-read
scripts/humanmcp_contract_probe.sh verify-proof <proof_id>
scripts/humanmcp_contract_probe.sh complete-stamp <proof_id> virtual_done
```

## Mac verification commands

```bash
node --check script.js
node --check scripts/stage_state_rehearsal_server.mjs
node verification/check-demo-readiness.mjs --strict
node verification/check-demo-readiness.mjs --strict --remote-feed http://<windows-host>:4173/humanmcp/stage-state
```

Use the remote feed check after Windows publishes a fresh sample. If the remote feed is unavailable, keep the demo on Surface B and use the operator phrase `operator sync mode`.

## Open questions for the Enter/Windows owner

- Confirm the Enter API base host and token out of band.
- Confirm whether the database handoff includes a seeded demo human and reusable demo task.
- Confirm whether the P0 stamp branch is `virtual_done` or `hardware_done`; if uncertain, use `virtual_done`.
- Confirm the final Windows LAN feed URL and provide one fresh sample snapshot before Mac switches from rehearsal to live feed.
