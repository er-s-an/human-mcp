# Website ↔ OpenClaw API/Auth/Stamp Freeze Pack

## Purpose

Freeze the demo-safe machine-to-machine contract for the Enter website and OpenClaw lane so website/API/auth/stamp work can proceed without guessing.

## Evidence Base

This freeze is grounded in the current plan + code evidence:

- `.omx/plans/ralplan-dr-humanmcp-full-demo-hour16.md`
- `/Users/xiejiachen/humanmcp/.omx/plans/website-execution-scope.md`
- `/Users/xiejiachen/humanmcp/.omx/plans/openclaw-execution-scope.md`
- `/Users/xiejiachen/humanmcp/.omx/plans/prd-humanmcp-dual-system-mvp.md`
- `/Users/xiejiachen/humanmcp/.omx/plans/test-spec-humanmcp-dual-system-mvp.md`
- `/Users/xiejiachen/openclaw/ui/src/ui/humanmcp.ts`
- `/Users/xiejiachen/openclaw/ui/src/ui/components/humanmcp-stage-panel.ts`

## Frozen Decisions

1. **Website is the business source of truth.**
   - `HumanProfile`, `Assignment`, `Proof`, `VerificationResult`, `Reward/Level`, and `StampStatus` live on the website side.
   - OpenClaw reads and triggers transitions, but does not become a second truth source.
2. **OpenClaw never receives the canonical `secret_phrase`.**
   - `GET /api/v1/humans` must not expose it.
   - Verify is initiated by OpenClaw and executed/persisted by the website.
3. **All machine-to-machine REST calls from OpenClaw require bearer auth.**
   - Operator/browser assumptions are not enough.
   - Missing/invalid auth is a blocker, not a silent fallback.
4. **Proof verification is idempotent and first-terminal-write-wins.**
   - Repeating verify on the same `proof_id` must return the same terminal result.
5. **Stamping splits into a real branch and a demo-safe virtual/manual branch.**
   - `virtual_done` is the P0-safe terminal state.
   - `hardware_done` is allowed when the real arm path works.
6. **Current request-shape mismatch is frozen as a compatibility rule.**
   - Canonical verify request: `{"operator":"openclaw","mode":"auto"}`.
   - Transitional compatibility: accept the current OpenClaw payload `{"force_verify":true}` until the client and website are aligned.

## Auth Contract

### Required headers for OpenClaw/API automation

- `Accept: application/json`
- `Authorization: Bearer <token>`
- `Content-Type: application/json` for POST routes

### Token handling rules

- Do not hardcode tokens in code, docs, screenshots, commits, or shell history exports.
- Inject the token through env/config only.
- OpenClaw currently reads:
  - `VITE_HUMAN_MCP_API_BASE_URL`
  - `VITE_HUMAN_MCP_AUTH_TOKEN`
- Shell/operator verification uses:
  - `HUMAN_MCP_API_BASE_URL`
  - `HUMAN_MCP_AUTH_TOKEN`

### Auth failure semantics

Freeze the contract as:

- Missing auth header -> treat as auth failure and stop the automation step.
- Invalid/expired token -> treat as auth failure and stop the automation step.
- Do **not** fall back to unauthenticated machine-to-machine calls.
- Website/browser pages may have their own auth model, but OpenClaw/API calls always send the bearer token.

## Endpoint Freeze

> Base URL must already include `/api/v1`.

| Route | Caller | Purpose | Frozen request | Frozen response / rule |
|---|---|---|---|---|
| `GET /humans?online=true&skill=...` | OpenClaw | Fetch callable humans | Query only | Returns human list; never returns canonical `secret_phrase` |
| `GET /tasks?human_id=...&status=...` | Website/operator | Fetch inbox/task state | Query only | Supports `delivered -> seen -> submitted` viewing flow |
| `POST /tasks/assign` | QR landing page / Website or OpenClaw operator path | Create or replay assignment | `task_id`, `subtask_id`, `human_id`, `prompt`, `reward`, `deadline_sec` | Same business key returns same `assignment_id`; replay is `200`, not `409` |
| `POST /tasks/{assignment_id}/seen` | Website/client | Mark first read | No extra frozen fields required | Idempotent; repeats keep `seen` |
| `POST /humans/{human_id}/proofs` | Website/client | Submit proof | `assignment_id`, `task_id`, `subtask_id`, `narrative`, `secret_phrase`, `proof_text` | Creates a new `proof_id` with `status=pending`; `422` if required fields are missing |
| `GET /proofs?status=pending&cursor=...` | OpenClaw | Poll pending proofs | Query only | Returns `cursor` + proof items; invalid cursor is `400` |
| `POST /proofs/{proof_id}/verify` | OpenClaw / manual operator path | Verify or manually override | Canonical `{"operator":"openclaw","mode":"auto"}`; transitional compatibility accepts `{"force_verify":true}`; manual override uses same endpoint | `200 verified=true/false`; `409` when assignment is expired/cancelled; idempotent per `proof_id` |
| `POST /stamps/{proof_id}/complete` | OpenClaw / operator | Persist stamp outcome | Canonical `{"mode":"virtual|hardware|manual","result":"...","operator":"..."}` | Returns `proof_id` + `stamp_status`; repeated same terminal write is idempotent |

## Proof Verify Flow Freeze

### Happy path

1. Human scans the QR code and opens the Enter website.
2. If the demo promise is “scan to receive a task,” the QR landing page / website must create or replay `assignment_id` via `POST /tasks/assign` before showing the task inbox. A plain website `GET` or static landing page view does **not** prove assignment by itself.
3. If the task was pre-created by OpenClaw/operator, the QR URL must carry or resolve the existing `assignment_id` / `human_id` and must not create a duplicate assignment.
4. User/client marks `seen` via `POST /tasks/{assignment_id}/seen`.
5. User submits proof via `POST /humans/{human_id}/proofs`.
6. Website stores proof as `pending`.
7. OpenClaw polls `GET /proofs?status=pending&cursor=...`.
8. OpenClaw calls `POST /proofs/{proof_id}/verify`.
9. Website performs the actual validation and writes the terminal result.
10. Success response must contain at least:
   - `proof_id`
   - `verified`
   - `human_name`
   - `level`
   - `reward_delta`
   - `can_stamp`
   - `stamp_status`
   - `verified_by`
   - `verified_at`
11. If verified and `can_stamp=true`, the website moves business state to `stamp_status=requested`.

### QR assignment rule

The QR code is a human entry point into the website, not an OpenClaw scan event. Therefore:

- **Scan opens website only:** no assignment is guaranteed unless the website route runs the assign flow or resolves a pre-created assignment.
- **Scan creates assignment:** the QR landing route must call `POST /tasks/assign`, persist/replay the returned id, then render the assigned task.
- **Scan opens existing assignment:** the QR URL must include a safe lookup key or assignment identifier, then call `GET /tasks?human_id=...&status=...` and `POST /tasks/{assignment_id}/seen`.
- The acceptance artifact must show the same id in the website response and in the Windows/OpenClaw `/humanmcp/stage-state` `assignmentId`.

### Failure / recovery path

- Secret mismatch or business rejection returns `200` with `verified=false`; it is **not** a transport failure.
- Expired/cancelled assignment returns `409`.
- Repeat verify on the same `proof_id` returns the same terminal answer and must not duplicate rewards or stamp transitions.
- Manual verify uses the **same** verify endpoint and follows the same first-terminal-write-wins rule.
- Rejected proof may be retried only by creating a **new** `proof_id` through a fresh proof submission.

## Stamp Branch Freeze

### Branch A — real stamp (preferred when live hardware works)

Preconditions:

- Verify succeeded.
- `can_stamp=true`.
- Real hardware path is healthy.
- Stamp writeback endpoint is available.

Flow:

1. Website verify returns `stamp_status=requested`.
2. OpenClaw performs the hardware stamp.
3. OpenClaw writes back `POST /stamps/{proof_id}/complete` with `mode=hardware`, `result=hardware_done`.
4. Website persists `stamp_status=hardware_done` as terminal truth.

### Branch B — virtual stamp (default P0 demo-safe path)

Use when:

- Hardware is unavailable, risky, or too slow.
- The story must continue without blocking.

Flow:

1. Website verify returns `stamp_status=requested`.
2. OpenClaw performs the virtual stage animation / operator-visible stamp success.
3. OpenClaw writes back `POST /stamps/{proof_id}/complete` with `mode=virtual`, `result=virtual_done`.
4. Website persists `stamp_status=virtual_done` as the demo terminal truth.

### Branch C — manual/operator fallback

Use when:

- Verify succeeded, but the stage operator must recover the flow.
- Hardware or automation is unstable.

Flow:

1. Operator advances the stage locally.
2. Operator or admin writes back through the same stamp completion endpoint with `mode=manual`, result chosen from:
   - `virtual_done` when a virtual/manual stage completion counts as success
   - `failed` when the stamp attempt failed but the flow may retry
   - `skipped` when the demo intentionally bypasses the stamp
3. Website remains the canonical source of final `stamp_status`.

### Explicit non-goal

Do **not** let local OpenClaw-only stamp state become the final business truth. If the writeback endpoint is down, the demo may continue locally, but the operator must reconcile the final stamp state back to the website before calling the run complete.

## Env / Config Freeze

See `docs/website-openclaw-env-checklist.md` for the operator checklist. Minimum frozen contract:

- OpenClaw UI/build machine:
  - `VITE_HUMAN_MCP_API_BASE_URL`
  - `VITE_HUMAN_MCP_AUTH_TOKEN`
- Operator shell / curl / smoke script:
  - `HUMAN_MCP_API_BASE_URL`
  - `HUMAN_MCP_AUTH_TOKEN`
- Never commit populated `.env` files.
- Base URL is the full API root ending in `/api/v1`.

## Verification Pack

Use `scripts/humanmcp_contract_probe.sh`:

```bash
scripts/humanmcp_contract_probe.sh check-env
scripts/humanmcp_contract_probe.sh smoke-read
scripts/humanmcp_contract_probe.sh verify-proof <proof_id>
scripts/humanmcp_contract_probe.sh complete-stamp <proof_id> virtual_done
```

Expected operator interpretation:

- `smoke-read` proves auth + base URL + read routes.
- `verify-proof` proves the proof verify branch is callable.
- `complete-stamp` proves the chosen stamp branch can be reconciled back to website truth.

## Demo Gate

The website/OpenClaw lane is considered frozen only if all of the following are true:

- Bearer auth is configured from env, not hardcoded.
- `GET /humans` does not leak the canonical secret.
- `POST /tasks/assign` is idempotent on the business key.
- `POST /proofs/{proof_id}/verify` is idempotent on `proof_id`.
- Manual verify uses the same endpoint, not a side-channel contract.
- `virtual_done` is accepted as the P0-safe terminal stamp state.
- `hardware_done` remains optional and must not block the demo.
