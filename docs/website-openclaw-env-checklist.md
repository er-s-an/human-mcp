# Website ↔ OpenClaw Env / Config Checklist

Use this checklist before rehearsal or live demo. Leave secrets blank in files; inject them at runtime.

## 1. Shared API Contract

- [ ] API base URL is known and ends with `/api/v1`
- [ ] OpenClaw and operator shell point to the same API base URL
- [ ] All machine-to-machine requests use `Authorization: Bearer <token>`
- [ ] No token is committed to git, screenshots, docs, or terminal recordings

## 2. Windows / OpenClaw Machine

- [ ] `VITE_HUMAN_MCP_API_BASE_URL` is set
- [ ] `VITE_HUMAN_MCP_AUTH_TOKEN` is set
- [ ] OpenClaw build/runtime is reading those env vars
- [ ] OpenClaw can reach `GET /humans`
- [ ] OpenClaw can reach `GET /proofs?status=pending`
- [ ] OpenClaw operator knows whether the stamp branch for this run is `hardware_done` or `virtual_done`

## 2.5 Mac / Surface A Machine

- [ ] `node scripts/stage_state_rehearsal_server.mjs --port 4173 --scenario happyPath` can start locally
- [ ] Surface A can open `http://127.0.0.1:4173/?feed=http://127.0.0.1:4173/humanmcp/stage-state`
- [ ] Happy path can be advanced through `/humanmcp/rehearsal/next` to `complete`
- [ ] `virtualStampPath` reaches `complete` with `virtual_done`
- [ ] `fallbackPath` reaches `fallback_scripted` and the operator banner is visible
- [ ] After Windows is ready, Surface A is reopened with the Windows feed URL instead of the local rehearsal feed

## 3. Website / Admin / Operator Lane

- [ ] At least one seed human exists
- [ ] At least one reusable demo task exists
- [ ] Manual verify path is available through the same verify endpoint / admin action
- [ ] Proof submission requires `assignment_id`, `task_id`, `subtask_id`, `narrative`, `secret_phrase`, and `proof_text`
- [ ] `GET /humans` response hides the canonical `secret_phrase`
- [ ] `POST /tasks/assign` idempotency has been checked once
- [ ] `POST /proofs/{proof_id}/verify` idempotency has been checked once
- [ ] `POST /stamps/{proof_id}/complete` can persist `virtual_done`

## 4. Operator Shell / Smoke Test

- [ ] `HUMAN_MCP_API_BASE_URL` is exported
- [ ] `HUMAN_MCP_AUTH_TOKEN` is exported
- [ ] `scripts/humanmcp_contract_probe.sh check-env` passes
- [ ] `scripts/humanmcp_contract_probe.sh smoke-read` reaches humans/tasks/proofs
- [ ] `scripts/humanmcp_contract_probe.sh verify-proof <proof_id>` works with a known pending proof
- [ ] `scripts/humanmcp_contract_probe.sh complete-stamp <proof_id> virtual_done` is ready as the fallback reconciliation command

## 5. Stamp Branch Call Before Show Time

Pick one and say it out loud in the runbook:

- [ ] **Real branch**: verify -> hardware stamp -> `hardware_done`
- [ ] **Virtual branch**: verify -> virtual/manual stamp -> `virtual_done`

If uncertain, choose **virtual_done** as the P0-safe default.

## 6. Red Flags (Do Not Start Rehearsal)

- [ ] Missing bearer token
- [ ] OpenClaw can only work unauthenticated
- [ ] `GET /humans` exposes canonical secret data
- [ ] Verify duplicates reward/stamp side effects on retry
- [ ] Local stamp success cannot be written back to website truth
