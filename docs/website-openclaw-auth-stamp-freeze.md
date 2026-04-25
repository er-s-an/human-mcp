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
7. **Task Packet Preview is a pre-dispatch gate, not proof text.**
   - Before a QR-created assignment is dispatched, the Enter website must show a Task Packet Preview modal.
   - The modal shows exactly what the human reviewer will see and what they will not see.
   - Proof fields such as `secret_phrase`, `narrative`, and `proof_text` remain evidence/verification fields after the task is done; they do not replace the structured Task Packet.

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
| `POST /tasks/assign` | QR landing page / Website or OpenClaw operator path | Create or replay assignment | `task_id`, `subtask_id`, `human_id`, `prompt`, `reward`, `deadline_sec`; optional `task_packet`/`metadata.task_packet` when the backend supports metadata | Same business key returns same `assignment_id`; replay is `200`, not `409`; if metadata is unsupported, the website may keep the preview packet client-side keyed by assignment id for demo proof |
| `POST /tasks/{assignment_id}/seen` | Website/client | Mark first read | No extra frozen fields required | Idempotent; repeats keep `seen` |
| `POST /humans/{human_id}/proofs` | Website/client | Submit proof after the human completes the assigned task | `assignment_id`, `task_id`, `subtask_id`, `narrative`, `secret_phrase`, `proof_text`; optional `proof_metadata`/`proof_contract_ref` | Creates a new `proof_id` with `status=pending`; `422` if required fields are missing; this proof payload is evidence, not the pre-dispatch Task Packet |
| `GET /proofs?status=pending&cursor=...` | OpenClaw | Poll pending proofs | Query only | Returns `cursor` + proof items; invalid cursor is `400` |
| `POST /proofs/{proof_id}/verify` | OpenClaw / manual operator path | Verify or manually override | Canonical `{"operator":"openclaw","mode":"auto"}`; transitional compatibility accepts `{"force_verify":true}`; manual override uses same endpoint | `200 verified=true/false`; `409` when assignment is expired/cancelled; idempotent per `proof_id` |
| `POST /stamps/{proof_id}/complete` | OpenClaw / operator | Persist stamp outcome | Canonical `{"mode":"virtual|hardware|manual","result":"...","operator":"..."}` | Returns `proof_id` + `stamp_status`; repeated same terminal write is idempotent |

## Proof Verify Flow Freeze

### Happy path

1. Human scans the QR code and opens the Enter website.
2. If the demo promise is “scan to receive a task,” the QR landing page / website must create or replay `assignment_id` via `POST /tasks/assign` before showing the task inbox. A plain website `GET` or static landing page view does **not** prove assignment by itself.
3. If the task was pre-created by OpenClaw/operator, the QR URL must carry or resolve the existing `assignment_id` / `human_id` and must not create a duplicate assignment.
4. Before dispatch or task detail display, Enter shows **Task Packet Preview**:
   - **Human will see:** product category, current headline/artifact slice, one screenshot or bounded artifact excerpt, target user, the single question, and the expected output schema.
   - **Human will NOT see:** the user’s name, full browser screen, raw AirJelly memory, private messages, credentials, revenue data, unrelated tabs, and any P4 content.
   - Privacy Budget is visible as `P0` to `P4`; the default demo budget is `P1`, and `P4` must block dispatch.
   - `Confirm` creates/replays the assignment; `Cancel` must not create a new assignment.
5. User/client marks `seen` via `POST /tasks/{assignment_id}/seen`.
6. User submits proof via `POST /humans/{human_id}/proofs`.
7. Website stores proof as `pending`.
8. OpenClaw polls `GET /proofs?status=pending&cursor=...`.
9. OpenClaw calls `POST /proofs/{proof_id}/verify`.
10. Website performs the actual validation and writes the terminal result.
11. Success response must contain at least:
   - `proof_id`
   - `verified`
   - `human_name`
   - `level`
   - `reward_delta`
   - `can_stamp`
   - `stamp_status`
   - `verified_by`
   - `verified_at`
12. If verified and `can_stamp=true`, the website moves business state to `stamp_status=requested`.

### Task Packet / Privacy Budget contract

The structured packet is the context contract for human escalation in the OPC demo.
It must be visible before dispatch and auditable after dispatch.

Minimum packet shape:

```json
{
  "task_type": "feedback / judgment",
  "privacy_level": "P1",
  "privacy_budget": "P1 · redacted artifact slice",
  "role": "target-user reviewer",
  "goal": "Help a one-person company founder improve landing-page clarity.",
  "visible_context": {
    "product_category": "AI developer tool",
    "current_headline": "Ship debugging fixes faster",
    "artifact_slice": "one screenshot or bounded copy excerpt"
  },
  "redacted_context": [
    "user name",
    "full browser screen",
    "raw AirJelly memory",
    "private messages",
    "revenue data",
    "credentials",
    "unrelated tabs"
  ],
  "single_question": "Can you understand the offer in 10 seconds?",
  "output_schema": {
    "understood_in_10s": "boolean",
    "click_intent": "yes | maybe | no",
    "main_confusion": "string",
    "suggested_change": "string"
  },
  "guardrails": "Suggestion only; user keeps final approval."
}
```

Privacy Budget levels:

- `P0` — internal only; no human dispatch.
- `P1` — demo default; redacted artifact slice and one question.
- `P2` — limited workflow context with explicit approval.
- `P3` — sensitive review; requires stronger consent, audit, and operator review.
- `P4` — blocked; credentials, private messages, raw memory, full screen, or irreversible/private material.

The proof API can continue to require `secret_phrase` and `narrative` for current backend validation.
That is an evidence mechanism. It must not be presented as the privacy-safe context boundary.

### QR assignment rule

The QR code is a human entry point into the website, not an OpenClaw scan event. Therefore:

- **Scan opens website only:** no assignment is guaranteed unless the website route runs the assign flow or resolves a pre-created assignment.
- **Scan creates assignment:** the QR landing route must show the Task Packet Preview modal, then call `POST /tasks/assign` only after `Confirm`, persist/replay the returned id, and render the assigned task.
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
- QR assignment displays Task Packet Preview before dispatch, with two columns for visible and redacted context.
- Privacy Budget `P0` to `P4` is visible; `P1` is the demo default and `P4` blocks dispatch.
- `POST /proofs/{proof_id}/verify` is idempotent on `proof_id`.
- Manual verify uses the same endpoint, not a side-channel contract.
- `virtual_done` is accepted as the P0-safe terminal stamp state.
- `hardware_done` remains optional and must not block the demo.
